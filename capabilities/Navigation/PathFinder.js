import {MinPriorityQueue} from "@datastructures-js/priority-queue";
import {getNeighbors} from "#capabilities/mapUtils.js";

/**
 * @typedef {import("#@unitn-asa/deliveroo-js-sdk/src/types/IOTile.js").IOTile} IOTile
 *
 * @typedef {import("#types/world.js").TilePosition} TilePosition
 * @typedef {import("#types/world.js").WorldMap} WorldMap
 * @typedef {import("#types/world.js").MoveDirection} MoveDirection
 * @typedef {import("#types/world.js").NavigationPath} NavigationPath
 * @typedef {import("#types/world.js").TileMoveTile} TileMoveTile
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
     * @param {TilePosition[][]} cameFrom
     * @param {TilePosition} currentTile
     * @returns {NavigationPath}
     */
    reconstructPath(cameFrom, currentTile) {
        let navigationPath = {distance: 0, path: []};
        let srcTile;

        while (cameFrom[currentTile.x][currentTile.y] !== null) {
            srcTile = cameFrom[currentTile.x][currentTile.y];
            let direction = this.whichMoveDirection(currentTile, srcTile, true);

            let tileMoveTile = {from: srcTile, direction: direction, to: currentTile};
            navigationPath.path.push(tileMoveTile);

            currentTile = srcTile;
            navigationPath.distance++;
        }

        // reverse the path to get the correct order from start to target
        navigationPath.path = navigationPath.path.reverse();

        return navigationPath;
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
     * @returns {NavigationPath | null} If path exists, the route and total distance is returned. null otherwise
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

            for (const neighborTile of getNeighbors(map, currentTile)) {
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