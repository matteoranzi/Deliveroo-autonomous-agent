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
 * @typedef {Object} SensedTile
 * @property {number} updateTime
 * @property {string[]=} parcelsId
 * @property {string=} agentId
 * @property {string=} crateId
 */

/**
 * @typedef {Object} WorldMap
 * @property {number} width                             Map width in tiles
 * @property {number} height                            Map height in tiles
 * @property {IOTileType[][]} tiles                     2D array of tile types
 */

/**
 * @typedef {Object} WorldSensing
 * @property {number} width
 * @property {number} height
 * @property {SensedTile[][]} tiles
 */



/**
 * @typedef {"up" | "right" | "left" | "down"} MoveDirection
 */


/**
 * @typedef {Object} TileMoveTile
 * @property {TilePosition} from
 * @property {MoveDirection} direction
 * @property {TilePosition} to
 */

/**
 * @typedef {Object} NavigationPath
 * @property {number} distance
 * @property {TileMoveTile[]} path
 * @description An array of tile-move-tile tuples, where each tuple represents a move from one tile to another
 * in a specific direction. The first element of the tuple is the starting tile position, the second element
 * is the move direction, and the third element is the target tile position.
 */

export {};



export const TILE_TYPES = {
    wall: '0',
    parcelSpawner: '1',
    delivery: '2',
    walkable: '3',
    crateSliding: '5',
    crateSpawning: '5!',

    directional: {
        left: '←',
        right: '→',
        up: '↑',
        down: '↓',
    }
}