import {PathFinder} from "#capabilities/pathFinder.js";
import 'dotenv/config'
import { DjsConnect } from "@unitn-asa/deliveroo-js-sdk/client";
import {TILE_TYPES, TILE_TYPES as TILE_TYPE} from "#types/world.js";

const socket = DjsConnect();

let pathFinder = new PathFinder();

// _______________________________ EVENTS ____________________________________
let deliverooMap = {}
let parcelSpawnerTiles = []
let deliveryTiles = []
let me = {};

const onMapReady = new Promise((resolve) => {
    socket.onMap((width, height, tiles) => {
        deliverooMap = {width, height, tiles}

        //XXX Due to server bug, the map is sent with width and height one less than the actual ones, so we need to increment them here
        // ASK Marco Robol to fix the server bug
        // TODO: remove this when the server bug is fixed
        deliverooMap.width++;
        deliverooMap.height++;

        for (let tile of deliverooMap.tiles) {
            switch (tile.type) {
                case TILE_TYPES.parcelSpawner:
                    parcelSpawnerTiles.push(tile);
                    break;
                case TILE_TYPES.delivery:
                    deliveryTiles.push(tile);
                    break;
            }

        }
        console.log("Deliveroo map", deliverooMap);
        console.log("Parcel Spawner Tiles", parcelSpawnerTiles);
        console.log("DeliveryTiles", deliveryTiles);
        resolve();
    });
});

const onYouReady = new Promise((resolve) => {
    socket.onYou((you) => {
        me = you;
        console.log("Me", me);
        resolve();
    });
});

// _______________________________ MAIN ____________________________________
Promise.all([onMapReady, onYouReady]).then(() => {
    console.log("All data received, starting agent...");
    main();
});

function main() {
    let startTile = {x: me.x, y: me.y};
    let endTile = {x: deliveryTiles[0].x, y: deliveryTiles[0].y};
    let path = pathFinder.aStar(deliverooMap, startTile, endTile);
    // console.log("[A Star path]")
    // console.log(path);
}

