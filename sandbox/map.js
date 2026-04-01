import 'dotenv/config'
import { DjsConnect } from "@unitn-asa/deliveroo-js-sdk/client";

const NON_WALKABLE_TILE = "0"
const PARCEL_SPAWNING_TILE = "1"
const DELIVER_TILE = "2"
const WALKABLE_TILE = "3"
const MOVABLE_TILE = "5"
const BOX_TILE = "5!"

const LEFT_DIR_TILE = "←"
const RIGHT_DIR_TILE = "→"
const UP_DIR_TILE = "↑"
const DOWN_DIR_TILE = "↓"

const socket = DjsConnect()


let mapData = {
    width: 0,
    height: 0,
    tiles: [],
    matrix: []
}

function createMatrix( width, height, tiles ) {
    const matrix = Array.from({length: height}, () => Array(width).fill(null));
    for (const tile of tiles) {
        if(tile &&
            Number.isInteger(tile.x) &&
            Number.isInteger(tile.y) &&
            tile.x >= 0 &&
            tile.y >= 0 &&
            tile.x < width &&
            tile.y < height
        ) {
            matrix[tile.x][tile.y] = tile.type;
        }
    }

    return matrix;
}

async function printMap() {
    const { width, height, matrix } = mapData;
    for (let y = 0; y < height; y++) {
        let row = "";
        for (let x = 0; x < width; x++) {
            row += matrix[x][y] + "\t";
        }
        console.log(row);
    }
}

// foo();
printMap();

function foo() {
    // socket.map.then( ( { width, height, tiles } ) => {
    //     console.log( 'Received map data:', { width, height, tiles } );
    // } ).catch( (err) => {
    //     console.error( 'Error receiving map data:', err );
    // } );
}

//
// socket.on( 'tile', (tile, y, delivery) => {
//     map[tile.x][tile.y] = tile.type
// } )
