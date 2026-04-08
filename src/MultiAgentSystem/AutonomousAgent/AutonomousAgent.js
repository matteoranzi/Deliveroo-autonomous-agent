import 'dotenv/config'
import { DjsConnect } from "@unitn-asa/deliveroo-js-sdk/client";
import {PathFinder} from "#MultiAgentSystem/AutonomousAgent/capabilities/Navigation/PathFinder.js";
import {MapAnalysis} from "#MultiAgentSystem/AutonomousAgent/capabilities/Analysis/MapAnalysis.js";
import {TILE_TYPES} from "#types/world.js";

/**
 * @typedef {import("#@unitn-asa/deliveroo-js-sdk/src/types/IOGameOptions.js").IOGameOptions} IOGameOptions
 * @typedef {import("#@unitn-asa/deliveroo-js-sdk/src/types/IOAgent.js").IOAgent} IOAgent
 * @typedef {import("#@unitn-asa/deliveroo-js-sdk/src/types/IOCrate.js").IOCrate} IOCrate
 * @typedef {import("#@unitn-asa/deliveroo-js-sdk/src/types/IOParcel.js").IOParcel} IOParcel
 * @typedef {import("#types/world.js").TilePosition} TilePosition
 * @typedef {import("#types/world.js").WorldMap} WorldMap
 * @typedef {import("#types/world.js").WorldSensing} WorldSensing
 * @typedef {import("#types/world.js").NavigationPath} NavigationPath
 * @typedef {import("#types/world.js").TileMoveTile} TileMoveTile
 */

const START_DELAY_MS = 1000;

export class AutonomousAgent {

    // ── Beliefs ───────────────────────────────────────────────────────────────

    /** @type {WorldMap} */
    #worldMap = { width: 0, height: 0, tiles: [] };
    /** @type {number[][]} */
    #sccMap = [];

    /** @type {WorldSensing} */
    #sensedWorld =  { width: 0, height: 0, tiles: [] };

    /** @type {Map<string, [IOAgent]>} */
    #agentsMap = new Map();
    /** @type {Map<string, IOParcel>} */
    #parcelsMap = new Map();
    /** @type {Map<string, IOCrate>} */
    #cratesMap = new Map();

    /** @type {Array} */
    #deliveryTiles = [];
    /** @type {Array} */
    #parcelSpawnerTiles = [];

    /** @type {IOAgent} */
    #me = {};

    /** @type {IOGameOptions} */
    #gameConfig = {};

    /** @type {number} */
    #elapsedTime = 0;



    // ── Intention execution ───────────────────────────────────────────────────

    /** @type {TileMoveTile[]} */
    #agentMovingActions = [];

    // ── Infrastructure ────────────────────────────────────────────────────────

    #socket = DjsConnect();
    #pathFinder = new PathFinder();
    #mapAnalysis = new MapAnalysis();

    // ── Initialization ────────────────────────────────────────────────────────

    /**
     * Waits for all initial beliefs to be populated from the server, then
     * computes derived beliefs and registers continuous listeners.
     * @returns {Promise<void>}
     */
    async #initialize() {
        await Promise.all([
            this.#waitForMap(),
            this.#waitForYou(),
            this.#waitForInfo(),
            this.#waitForConfig(),
        ]);

        // Derived belief — computed once from the static map
        this.#sccMap = this.#mapAnalysis.stronglyConnectedComponents(this.#worldMap);
        console.log("Strongly Connected Components");
        console.table(this.#sccMap);

        // Sensing is a continuous listener, not a one-shot init Promise
        this.#socket.onSensing((sensing) => {
            // TODO: trigger intention reconsideration if the current planned path is affected
            // console.log("Sensing update:", sensing);

            for (let position of sensing.positions) {
                this.#sensedWorld.tiles[position.x][position.y].updateTime = this.#elapsedTime
            }

            for (let agent of sensing.agents) {
                //XXX: for now intermediate step values are skipped
                if (agent.x %1 !== 0 || agent.y %1 !== 0) continue;

                if(!this.#agentsMap.has(agent.id)) {
                    console.log("Nice to meet you, ", agent.name);
                    this.#agentsMap.set(agent.id, [agent]);
                } else { // This agent remembers him
                    const agentHistory = this.#agentsMap.get(agent.id);
                    const last = agentHistory.at(-1);
                    const secondLast = (agentHistory.length > 1 ? agentHistory.at(-2) : "no knowledge");

                    if (last !== "lost") { // This agent was seeing him also last time
                        if (last.x !== agent.x && last.y !== agent.y) {
                            agentHistory.push(agent);
                            console.log("I'm seeing you moving, ", agent.name);
                        } else {
                            //Still seeing him, but he is not moving
                            console.log("I'm still seeing you, but you are not moving, ", agent.name);
                        }
                    } else { // This agent didn't see him last time
                        agentHistory.push(agent);

                        if (secondLast.x !== agent.x && secondLast.y !== agent.y) {
                            console.log("Welcome back, seems that you moved, ", agent.name);
                        } else {
                            console.log("Welcome back, seems you are stil here as before, ", agent.name);
                        }
                    }
                }
            }

            for (const [id, agentHistory] of this.#agentsMap.entries()) {
                const last = agentHistory.at(-1);
                const secondLast = (agentHistory.length > 1 ? agentHistory.at(-2) : "no knowledge");

                if (!sensing.agents.map(agent => agent.id).includes(id)) {
                    // If this agent is not seeing him anymore

                    if (last !== "lost") {
                        agentHistory.push("lost");
                        console.log("I lost sight of you, ", last.name);
                    } else {
                        // Still not seeing him, but I already lost him before
                        console.log("It's a while that I down't see ", secondLast.name, ". I remember him in: ", secondLast.x , ", ", secondLast.y);
                        if ( this.#pathFinder.manhattanDistance({x: this.#me.x, y: this.#me.y}, {x: secondLast.x, y: secondLast.y}) <= this.#gameConfig.GAME.player.observation_distance ) {
                            console.log( 'I remember ', secondLast.name, 'was within ', this.#gameConfig.GAME.player.observation_distance, ' tiles from here. Forget him.' );
                            this.#agentsMap.delete(id)
                        }
                    }
                }
            }
        });

        this.#socket.on("info", (info) => {
            // console.log(info);
            this.#elapsedTime = info.ms;
        })


        console.log("All beliefs acquired — agent ready.");
    }

    /**
     * One-shot init Promise — resolves when the static map is received.
     * @returns {Promise<void>}
     */
    #waitForMap() {
        return new Promise((resolve) => {
            this.#socket.onMap((width, height, tiles) => {
                // XXX: server bug — reported width/height may be incorrect, derive from tile positions
                for (const tile of tiles) {
                    if (tile.x > this.#worldMap.width)  this.#worldMap.width  = tile.x;
                    if (tile.y > this.#worldMap.height) this.#worldMap.height = tile.y;
                }
                this.#worldMap.width++;
                this.#worldMap.height++;

                this.#sensedWorld.width = this.#worldMap.width
                this.#sensedWorld.height = this.#worldMap.height

                this.#worldMap.tiles = Array.from(
                    { length: this.#worldMap.width },
                    () => new Array(this.#worldMap.height).fill(null)
                );
                this.#sensedWorld.tiles = Array.from(
                    { length: this.#sensedWorld.width },
                    () => new Array(this.#sensedWorld.height).fill(null)
                );

                for (const tile of tiles) {
                    const tileType = String(tile.type);
                    this.#worldMap.tiles[tile.x][tile.y] = tileType;
                    this.#sensedWorld.tiles[tile.x][tile.y] = { updateTime: 0 };


                    switch (tileType) {
                        case TILE_TYPES.parcelSpawner: this.#parcelSpawnerTiles.push(tile); break;
                        case TILE_TYPES.delivery:      this.#deliveryTiles.push(tile);      break;
                    }
                }

                console.table(this.#worldMap.tiles);
                resolve();
            });
        });
    }

    /**
     * Resolves on the first "you" event (initial position).
     * The listener stays active so that #me is updated on every subsequent position change.
     * @returns {Promise<void>}
     */
    #waitForYou() {
        return new Promise((resolve) => {
            //XXX consider there half-step event
            this.#socket.onYou((you) => {
                this.#me = you;
                resolve(); // no-op after first call
            });
        });
    }

    /**
     * Resolves on the first "info" tick. The listener stays active for future ticks.
     * @returns {Promise<void>}
     */
    #waitForInfo() {
        return new Promise((resolve) => {
            this.#socket.on("info", (info) => {
                // TODO: store info.ms as last-sensed timestamp per tile
                resolve(); // no-op after first call
            });
        });
    }

    /**
     * One-shot init Promise — resolves when the game config is received.
     * @returns {Promise<void>}
     */
    #waitForConfig() {
        return new Promise((resolve) => {
            this.#socket.on("config", (config) => {
                this.#gameConfig = config;
                console.log("Game config:", config);
                resolve();
            });
        });
    }

    // ── Plans ─────────────────────────────────────────────────────────────────

    /**
     * Finds the shortest path to the closest reachable delivery tile.
     * Only tiles in the same SCC as the agent's current position are considered.
     * @returns {Promise<NavigationPath>}
     */
    // TODO: consider avoiding delivery tiles in areas crowded by other agents
    async #getPathToClosestDeliveryTile() {
        const startTile = { x: this.#me.x, y: this.#me.y };

        // XXX: only targets in the same SCC are currently considered reachable.
        // TODO implement verification if it make sense to change SCC (for example in destination scc there are more spawning AND delivery tiles)
        const eligibleTiles = this.#deliveryTiles.filter(
            (tile) => this.#sccMap[startTile.x][startTile.y] === this.#sccMap[tile.x][tile.y]
        );

        const paths = await Promise.all(
            eligibleTiles.map((tile) =>
                Promise.resolve(this.#pathFinder.aStar(this.#worldMap, startTile, { x: tile.x, y: tile.y }))
            )
        );

        return paths
            .filter((path) => path !== null)
            .reduce(
                (shortest, path) => path.distance < shortest.distance ? path : shortest,
                { distance: Infinity, path: [] }
            );
    }

    /** @param {NavigationPath} navigationPath */
    #loadIntentionActions(navigationPath) {
        for (const step of navigationPath.path) {
            this.#agentMovingActions.push(step);
        }
    }

    // ── Execution ─────────────────────────────────────────────────────────────

    /**
     * Starts the agent's deliberation and execution loops.
     *
     * - Execution loop: drains #agentMovingActions one step per server tick, retrying on failure.
     * - Deliberation: plans the next intention and loads its actions into the queue.
     *
     * @returns {Promise<void>}
     */
    async start() {
        console.log("Initializing...");
        await this.#initialize()
        console.log("Starting...");

        const move = (direction) => new Promise((resolve) => this.#socket.emit("move", direction, resolve));

        const executionLoop = async () => {
            while (true) {
                if (this.#agentMovingActions.length > 0) {
                    const nextAction = this.#agentMovingActions.shift();
                    // console.log(`Moving ${nextAction.direction}: (${nextAction.from.x},${nextAction.from.y}) → (${nextAction.to.x},${nextAction.to.y})`);
                    const success = await move(nextAction.direction);
                    if (!success) {
                        // console.log(`Move failed (${nextAction.direction}), retrying...`);
                        // TODO: add retry expiration to avoid infinite loops on permanent blockage
                        this.#agentMovingActions.unshift(nextAction);
                    }
                } else {
                    await new Promise((r) => setTimeout(r, this.#gameConfig.CLOCK));
                }
            }
        };

        const deliberate = async () => {
            const navigationPath = await this.#getPathToClosestDeliveryTile();
            console.log("Navigation path planned:");
            console.dir(navigationPath, { depth: null });
            this.#loadIntentionActions(navigationPath);
        };

        setTimeout(() => executionLoop(), START_DELAY_MS);
        await deliberate();
    }
}