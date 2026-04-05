import 'dotenv/config'
import { DjsConnect } from "@unitn-asa/deliveroo-js-sdk/client";

const socket = DjsConnect();

let tiles = [];
let maxX = 0;
let maxY = 0;

const NON_WALKABLE_TILE = "0"
const PARCEL_SPAWING_TILE = "1"
const DELIVER_TILE = "2"
const WALKABLE_TILE = "3"
const MOVABLE_TILE = "5"
const BOX_TILE = "5!"


const LEFT_DIR_TILE = "←"
const RIGHT_DIR_TILE = "→"
const UP_DIR_TILE = "↑"
const DOWN_DIR_TILE = "↓"


socket.on('tile', (tile) => {
    tiles.push(tile);

    if (tile.x > maxX) maxX = tile.x;
    if (tile.y > maxY) maxY = tile.y;

    clearTimeout(globalThis.printTimer);
    globalThis.printTimer = setTimeout(printMap, 500);
});

function printMap() {
    let map = [];

    for (let y = 0; y <= maxY; y++) {
        map[y] = [];
        for (let x = 0; x <= maxX; x++) {
            map[y][x] = ' ';
        }
    }

    for (let tile of tiles) {
        map[tile.y][tile.x] = tile.type;
    }

    console.clear();
    console.log('MAP:\n');

    for (let y = maxY; y >= 0; y--) {
        console.log(map[y].join(' '));
    }
}