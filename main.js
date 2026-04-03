import {PathFinder} from "#capabilities/pathFinder.js";
import 'dotenv/config'
import { DjsConnect } from "@unitn-asa/deliveroo-js-sdk/client";
import {TILE_TYPES} from "#types/world.js";

/**
 * @typedef {import("#@unitn-asa/deliveroo-js-sdk/src/types/IOGameOptions.js").IOGameOptions} IOGameOptions
 * @typedef {import("#@unitn-asa/deliveroo-js-sdk/src/types/IOInfo.js").IOInfo} IOInfo
 */

/**
 * @typedef {import("#types/world.js").TilePosition} TilePosition
 * @typedef {import("#types/world.js").WorldMap} WorldMap
 * @typedef {import("#types/world.js").MoveDirection} MoveDirection
 * @typedef {import("#types/world.js").NavigationPath} NavigationPath
 * @typedef {import("#types/world.js").TileMoveTile} TileMoveTile
 */

/**
 * @typedef {Object} AgentAction
 * @property {string} type
 * @property {Object} payload
 * @description Represents an action that the agent can perform, such as moving in a direction, picking up a parcel, or delivering a parcel.
 * The type property indicates the type of action (e.g., "move", "pickUp", "deliver"), while the payload property contains
 * any additional information needed to perform the action (e.g., the direction to move, the ID of the parcel to pick up, etc.).
 * This structure allows for a flexible and extensible way to represent the various actions that the agent can take in response to the environment and its goals.
 */

const START_ACTIONS_DELAY = 1000;

const socket = DjsConnect();

let pathFinder = new PathFinder();

let elapsedTimeMS = 0;

let parcelSpawnerTiles = []
let deliveryTiles = []
let me = {};
/**
 * @type {WorldMap}
 */
let worldMap = {width: 0, height: 0, tiles: []};
/**
 *
 * @type {IOGameOptions}
 */
let gameConfig = {}

/**
 *
 * @type {TileMoveTile[]}
 * @description A queue of actions that the agent will perform. The agent will pop actions from this queue and execute them in order.
 * This allows the agent to plan a sequence of actions in response to the environment and its goals, and then execute them over time as the server emits "info" events (i.e., server ticks).
 */
let agentMovingActions = []


// _______________________________ EVENTS ____________________________________
const onMapReady = new Promise((resolve) => {
    socket.onMap((width, height, tiles) => {
        //XXX Due to server bug, the map is sent with width and height one less than the actual ones, so we need to increment them here
        // ASK Marco Robol to fix the server bug
        // TODO: remove this when the server bug is fixed
        worldMap.width = width + 1;
        worldMap.height = height + 1;
        worldMap.tiles = Array.from({length: worldMap.width}, () => new Array(worldMap.height).fill(null));

        for (let tile of tiles) {
            worldMap.tiles[tile.x][tile.y] = tile.type;

            switch (tile.type) {
                case TILE_TYPES.parcelSpawner:
                    parcelSpawnerTiles.push(tile);
                    break;
                case TILE_TYPES.delivery:
                    deliveryTiles.push(tile);
                    break;
            }

        }
        // console.log("World map", worldMap);
        // console.log("Parcel Spawner Tiles", parcelSpawnerTiles);
        // console.log("DeliveryTiles", deliveryTiles);
        resolve();
    });
});
const onYouReady = new Promise((resolve) => {
    socket.onYou((you) => {
        me = you;
        // console.log("Me", me);
        resolve();
    });
});
const onInfoReady = new Promise((resolve) => {
    socket.on("info", (info) => {
        //TODO here is useful saving the current time to store the last time a tile has been sensed

        elapsedTimeMS = info.ms;

        // console.log(info);
        resolve();
    });
})
const onConfigReady = new Promise((resolve) => {
    socket.on("config", (config) => {
        gameConfig = config;
        console.log(config);
        resolve();
    })
})


// _______________________________ UTILS ____________________________________
/**
 * Find the closest delivery tile and return the path to it
 * @return {NavigationPath}
 */
// TODO consider to choose also not the closer parcel delivery tile in case of a busy area of other Agents
function getPathToCloserDeliveryTile() {
    let startTile = {x: me.x, y: me.y};
    let shortestPath = {distance: Infinity, path: []}

    for (let deliveryTile of deliveryTiles) {
        let endTile = {x: deliveryTile.x, y: deliveryTile.y};
        let currentPath = pathFinder.aStar(worldMap, startTile, endTile);

        if (currentPath.distance < shortestPath.distance) {
            shortestPath = currentPath;
        }
    }

    return shortestPath;
}


/**
 *
 * @param {NavigationPath} navigationPath
 */
function planAgentMoves(navigationPath) {
    for (let step of navigationPath.path) {
        agentMovingActions.push(step);
    }
}


// _______________________________ MAIN ____________________________________
Promise.all([onMapReady, onYouReady, onInfoReady, onConfigReady]).then(() => {
    console.log("All data received, starting agent...");

    const move = (direction) => new Promise((resolve) => socket.emit("move", direction, resolve));

    const agentDoesStuff = setTimeout(async () => {
        while (true) {
            if (agentMovingActions.length > 0) {
                let nextAction = agentMovingActions.shift();
                console.dir(`Agent tick, current position: (${me.x}, ${me.y}), next action: move ${nextAction.direction} to (${nextAction.to.x}, ${nextAction.to.y})`, {depth: null});
                const moveResult = await move(nextAction.direction);
                if (!moveResult) console.log("Move failed, the agent could not move in the direction: " + nextAction.direction);
            } else {
                await new Promise(r => setTimeout(r, gameConfig.CLOCK));
            }
        }
    }, START_ACTIONS_DELAY);

    main();
});

function main() {
    console.log("Starting agent...");

    let navigationPath = getPathToCloserDeliveryTile();
    console.log("Best navigation path")
    console.dir(navigationPath, {depth: null});

    planAgentMoves(navigationPath);
}

