/**
 * @typedef {import("#@unitn-asa/deliveroo-js-sdk/src/types/IOTile.js").IOTile} IOTile
 * @typedef {import("#@unitn-asa/deliveroo-js-sdk/src/types/IOTileType.js").IOTileType} IOTileType
 */

/**
 * @typedef {Object} TilePosition
 * @property {number} x
 * @property {number} y
 */

/**
 * @typedef {Object} WorldMap
 * @property {number} width                             Map width in tiles
 * @property {number} height                            Map height in tiles
 * @property {IOTileType[][]} tiles                     2D array of tile types
 */

/**
 * @typedef {"up" | "right" | "left" | "down"} MoveDirection
 */

/**
 * @typedef {Array<[TilePosition, MoveDirection]>} NavigationPath
 * @description An array of move-tile pairs where each pair contains a
 * tile position and the direction to move from it.
 */

/**
 * @typedef {Object} PathResult
 * @property {number} totalDistance
 * @property {NavigationPath} path
 */

export {};



export const TILE_TYPES = {
    wall: "0",
    parcelSpawner: "1",
    delivery: "2",
    walkable: "3",
    // base: "4", // ASK Wrong documentation in IOTile.js code?
    crateSliding: "5",
    crateSpawning: "5!",

    directional: {
        left: "←",
        right: "→",
        up: "↑",
        down: "↓",
    }
}