import {MinPriorityQueue} from "@datastructures-js/priority-queue";
import {TILE_TYPES} from "#types/world.js";

/**
 * @typedef {import("#@unitn-asa/deliveroo-js-sdk/src/types/IOTile.js").IOTile} IOTile
 * @typedef {import("#@unitn-asa/deliveroo-js-sdk/src/types/IOGameOptions.js").IOMapOptions} IOMapOptions
 *
 * @typedef {import("#types/world.js").TilePosition} TilePosition
 * @typedef {import("#types/world.js").MoveDirection} MoveDirection
 * @typedef {import("#types/world.js").NavigationPath} NavigationPath
 * @typedef {import("#types/world.js").PathResult} PathResult
 */

/**
 * @typedef {Object} TileScore
 * @property {TilePosition} tile
 * @property {number} distance
 */

/**
 * @callback HeuristicFunction
 * @param {TilePosition} startTile
 * @param {TilePosition} targetTile
 * @returns {number}
 */

const COST_TO_NEIGHBOR = 1;

/**
 * A Map keyed by TilePosition, hiding the string serialization of coordinates.
 * @template V
 */
class TileMap {
    #map = new Map();

    /** @param {TilePosition} tile @returns {V | undefined} */
    get(tile) { return this.#map.get(`${tile.x},${tile.y}`); }

    /**
     * @param {TilePosition} tile
     * @param {V} value
     */
    set(tile, value) { this.#map.set(`${tile.x},${tile.y}`, value); return this; }

    /** @param {TilePosition} tile @returns {boolean} */
    has(tile) { return this.#map.has(`${tile.x},${tile.y}`); }
}

/**
 * @description Implements pathfinding algorithms to find the optimal path between two tiles on the map, considering the map layout and obstacles. The main algorithm implemented is A*, but other algorithms can be added in the future.
 * The class also includes heuristic functions (Manhattan, Diagonal, Euclidean) to estimate the cost to reach the target tile, and utility functions to reconstruct the path and get neighboring tiles.
 * The pathfinding algorithms can be used by the agent controller to navigate the map efficiently.
 */
export class PathFinder {



    // _______________________________ HEURISTICS ____________________________________
    /**
     * @param {TilePosition} startTile
     * @param {TilePosition} targetTile
     * @returns {number}
     */
    manhattanDistance(startTile, targetTile) {
        return Math.abs(startTile.x - targetTile.x) + Math.abs(startTile.y - targetTile.y);
    }

    /**
     *
     * @param {TilePosition} startTile
     * @param {TilePosition} targetTile
     * @returns {number}
     */
    diagonalDistance(startTile, targetTile) {
        return Math.max(Math.abs(startTile.x - targetTile.x), Math.abs(startTile.y - targetTile.y));
    }

    /**
     * @param {TilePosition} startTile
     * @param {TilePosition} targetTile
     * @returns {number}
     */
    euclideanDistance(startTile, targetTile) {
        return Math.sqrt(Math.pow(startTile.x - targetTile.x, 2) + Math.pow(startTile.y - targetTile.y, 2));
    }
    // ________________________________ end HEURISTICS ____________________________________



    // _______________________________ UTILITIES ____________________________________

    /**
     * @param {TilePosition} currentTile
     * @param {TilePosition} nextTile
     * @param {boolean} reverse - if true, the move direction is calculated from currentTile to nextTile, otherwise from nextTile to currentTile (useful for path reconstruction)
     * @returns {MoveDirection | null}
     * @description Returns the move to perform to go to the next tile. If the next tile is not adjacent to the current tile, null is returned.
     */
    whichMoveDirection(currentTile, nextTile, reverse = false) {
        if (reverse) {
            [currentTile, nextTile] = [nextTile, currentTile];
        }

        if (currentTile.x === nextTile.x && currentTile.y < nextTile.y) return 'up';
        if (currentTile.x === nextTile.x && currentTile.y > nextTile.y) return 'down';
        if (currentTile.x < nextTile.x && currentTile.y === nextTile.y) return 'right';
        if (currentTile.x > nextTile.x && currentTile.y === nextTile.y) return 'left';

        return null;
    }

    /**
     * @param {TileMap<TilePosition>} cameFrom
     * @param {TilePosition} currentTile
     * @returns {PathResult}
     */
    reconstructPath(cameFrom, currentTile) {
        let distance = 0;
        let navigationPath = []

        while (cameFrom.has(currentTile)) {
            let nextTile = cameFrom.get(currentTile);

            navigationPath.push({TilePosition: currentTile, MoveDirection: this.whichMoveDirection(currentTile, nextTile, true)});

            currentTile = nextTile;
            distance++;
        }

        console.log("[Navigation Path]")
        console.log(navigationPath.reverse());

        return {totalDistance: distance, path: navigationPath.reverse()};
    }

    /**
     * @param {IOMapOptions} map
     * @param {TilePosition} currentTile
     * @returns {TilePosition[]}
     */
    //TODO implement fuzzy logic with known crates positions
    getNeighbors(map, currentTile) {
        let neighbors = [];

        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0 || Math.abs(dx) + Math.abs(dy) === 2) continue; // Skip the current tile and diagonal neighbors (since invalid moves)

                const neighborX = currentTile.x + dx;
                const neighborY = currentTile.y + dy;

                // FIXME make sure values of map.width and map.height are correct, since Deliveroo server response gives them wrong
                const validCoordinates = neighborX >= 0 && neighborX < map.width && neighborY >= 0 && neighborY < map.height;
                if (validCoordinates) {
                    const neighborTileType = map.tiles[neighborX][neighborY];

                    if (neighborTileType === TILE_TYPES.wall) continue;

                    // Check if neighbor tile is reachable
                    if (neighborTileType === TILE_TYPES.directional.up && dy === -1) continue; // below neighbor
                    if (neighborTileType === TILE_TYPES.directional.right && dx === -1) continue; // left neighbor
                    if (neighborTileType === TILE_TYPES.directional.down && dy === 1) continue; // above neighbor
                    if (neighborTileType === TILE_TYPES.directional.left && dx === 1) continue; // right neighbor

                    //FIXME implement complete logic considering crate sliding and crate spawning cells (saved in agent memory)
                    if (neighborTileType === TILE_TYPES.crateSpawning) continue;


                    //FIXME implement fuzzy logic when a tile is occupied by another agent (agent sensing + memory)
                    // maybe pathfinding doesn't care and agent controller handles it by insisting on the move, otherwise marks in memory as unreachable and launches a new pathfinding with the updated map (maybe also considering a timeout for that tile to be free again, since other agent will move away eventually)

                    neighbors.push({x: neighborX, y: neighborY});
                }
            }
        }

        return neighbors;
    }
// ________________________________ end UTILITIES ____________________________________




// ________________________________ PATHFINDING ALGORITHMS ____________________________________

    //TODO add fuzzy_logic handling objects temporary blocking paths (maybe can be freed, otherwise find another path slightly longer but surely free)
    // and so retrieve also mapMemory to evaluate path based on known positions of crates

    //TEST if it works even when startTile === targetTile

    /**
     * @param {IOMapOptions} map
     * @param {TilePosition} startTile
     * @param {TilePosition} targetTile
     * @param {HeuristicFunction} heuristic
     * @returns {PathResult | null} If path exists, the route and total distance is returned. null otherwise
     */
    aStar(map, startTile, targetTile, heuristic = this.manhattanDistance) {
        console.log("Starting A* pathfinding...");

        const minQueue = new MinPriorityQueue((tileScore) => tileScore.distance, [{tile: startTile, distance: 0}])
        const cameFrom = new TileMap();
        const costScore = new TileMap();
        const heuristicScore = new TileMap();

        for (let x = 0; x < map.width; x++) {
            for (let y = 0; y < map.height; y++) {
                const tilePos = {x, y};
                costScore.set(tilePos, Infinity);
                heuristicScore.set(tilePos, Infinity);
            }
        }

        costScore.set(startTile, 0);
        heuristicScore.set(startTile, heuristic(startTile, targetTile));

        while (!minQueue.isEmpty()) {
            const { tile: currentTile, distance: dequeuedDistance } = minQueue.dequeue();
            const currentDistance = costScore.get(currentTile) + heuristicScore.get(currentTile);

            // stale entry: a better path to this tile was already processed
            if (dequeuedDistance > currentDistance) continue;

            if (currentTile.x === targetTile.x && currentTile.y === targetTile.y) {
                let a = this.reconstructPath(cameFrom, currentTile);
                console.dir(a, { depth: null })
            }

            for (const neighborTile of this.getNeighbors(map, currentTile)) {
                const tentativeCostScore = costScore.get(currentTile) + COST_TO_NEIGHBOR;

                if (tentativeCostScore < costScore.get(neighborTile)) {
                    cameFrom.set(neighborTile, currentTile);
                    costScore.set(neighborTile, tentativeCostScore);
                    heuristicScore.set(neighborTile, tentativeCostScore + heuristic(neighborTile, targetTile));
                    minQueue.enqueue({tile: neighborTile, distance: heuristicScore.get(neighborTile)});
                }
            }
        }

        return null
    }

// ________________________________ end PATHFINDING ALGORITHMS ____________________________________

}