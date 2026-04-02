import {MinPriorityQueue} from "@datastructures-js/priority-queue";
import {TILE_TYPES} from "#types/world.js";

/**
 * @typedef {import("#@unitn-asa/deliveroo-js-sdk/src/types/IOTile.js").IOTile} IOTile
 *
 * @typedef {import("#types/world.js").TilePosition} TilePosition
 * @typedef {import("#types/world.js").WorldMap} WorldMap
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
     * @param {Array<Array<TilePosition|null>>} cameFrom
     * @param {TilePosition} currentTile
     * @returns {PathResult}
     */
    reconstructPath(cameFrom, currentTile) {
        let distance = 0;
        let navigationPath = [];
        let nextTile;

        while (cameFrom[currentTile.x][currentTile.y] !== null) {
            nextTile = cameFrom[currentTile.x][currentTile.y];
            let direction = this.whichMoveDirection(currentTile, nextTile, true);
            navigationPath.push({TilePosition: currentTile, MoveDirection: direction});
            currentTile = nextTile;
            distance++;
        }
        navigationPath.push({TilePosition: currentTile, MoveDirection: null});

        return {totalDistance: distance, path: navigationPath.reverse()};
    }

    /**
     * @param {WorldMap} map
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
                    console.log("map")
                    console.log(map)
                    const neighborTileType = map.tiles[neighborX][neighborY];

                    console.log("Neighbor: x=" + neighborX + ",y=" + neighborY, "type=" + neighborTileType);
                    if (neighborTileType === TILE_TYPES.wall) {
                        console.log("found a wall neighbor: ", neighborTileType);
                        continue;
                    }

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
     * @param {WorldMap} map
     * @param {TilePosition} startTile
     * @param {TilePosition} targetTile
     * @param {HeuristicFunction} heuristic
     * @returns {PathResult | null} If path exists, the route and total distance is returned. null otherwise
     */
    aStar(map, startTile, targetTile, heuristic = this.manhattanDistance) {
        console.log("Starting A* pathfinding...");

        const minQueue = new MinPriorityQueue((tileScore) => tileScore.distance, [{tile: startTile, distance: 0}]);
        const cameFrom    = Array.from({length: map.width}, () => new Array(map.height).fill(null));
        const costScore   = Array.from({length: map.width}, () => new Array(map.height).fill(Infinity));
        const heuristicScore = Array.from({length: map.width}, () => new Array(map.height).fill(Infinity));

        costScore[startTile.x][startTile.y] = 0;
        heuristicScore[startTile.x][startTile.y] = heuristic(startTile, targetTile);

        while (!minQueue.isEmpty()) {
            const { tile: currentTile, distance: dequeuedDistance } = minQueue.dequeue();

            // stale entry: a better path to this tile was already processed
            if (dequeuedDistance > costScore[currentTile.x][currentTile.y] + heuristicScore[currentTile.x][currentTile.y]) continue;

            if (currentTile.x === targetTile.x && currentTile.y === targetTile.y) {
                return this.reconstructPath(cameFrom, currentTile);
            }

            for (const neighborTile of this.getNeighbors(map, currentTile)) {
                const tentativeCostScore = costScore[currentTile.x][currentTile.y] + COST_TO_NEIGHBOR;

                if (tentativeCostScore < costScore[neighborTile.x][neighborTile.y]) {
                    cameFrom[neighborTile.x][neighborTile.y] = currentTile;
                    costScore[neighborTile.x][neighborTile.y] = tentativeCostScore;
                    heuristicScore[neighborTile.x][neighborTile.y] = tentativeCostScore + heuristic(neighborTile, targetTile);
                    minQueue.enqueue({tile: neighborTile, distance: heuristicScore[neighborTile.x][neighborTile.y]});
                }
            }
        }

        return null;
    }

// ________________________________ end PATHFINDING ALGORITHMS ____________________________________

}