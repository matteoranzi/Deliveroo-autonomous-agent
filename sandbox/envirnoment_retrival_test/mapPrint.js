import 'dotenv/config'
import { DjsConnect } from "@unitn-asa/deliveroo-js-sdk/client";

const socket = DjsConnect();

let tiles = [];
let maxX = 0;
let maxY = 0;

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
        if (tile.type === 1) map[tile.y][tile.x] = '.';
        else if (tile.type === 2) map[tile.y][tile.x] = '#';
        else map[tile.y][tile.x] = '?';
    }

    console.clear();
    console.log('MAP:\n');

    for (let y = maxY; y >= 0; y--) {
        console.log(map[y].join(' '));
    }
}