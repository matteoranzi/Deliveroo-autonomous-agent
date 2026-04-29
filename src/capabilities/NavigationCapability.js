//TODO put absolute path in package.json
import {PathFinder} from "../services/PathFinder.js";


// Owns: navigation beliefs + movement plans + path state
// Does NOT own: world map (belongs to PerceptionCapability)
// Depends on: PathFinder (service), WorldMap belief (injected)

// TODO pass log object to easily enable or disable console logs
export class NavigationCapability {
    #socket;

    // Beliefs owned by this capability
    #currentPath = {goalId: null, actions: []};
    #isBlocked = false;

    // Injected dependencies
    #pathFinder;
    #getWorldMap; //belief accessor injected from agent. This capability does not own the full belief base, only queries what it needs
    #getSccMap;
    #getMe;

    constructor({socket, pathFinder, getWorldMap, getMe, getSccMap}) {
        this.#socket = socket;

        this.#pathFinder = pathFinder;
        this.#getWorldMap = getWorldMap;
        this.#getSccMap = getSccMap;
        this.#getMe = getMe;
    }

    // Capability API - exposed to plans

    /** Plan a path to target and load it as the current committed path. */
    async planPathToNearestTarget(targets, goalID) {
        const me = this.#getMe;
        const map = this.#getWorldMap;
        const sccMap = this.#getSccMap;
        const path = await this.#computeNearestTarget(map, sccMap, me, targets);

        if(!path) {
            this.#isBlocked = true;
            return false;
        }

        this.#currentPath = {goalId: goalID, actions: [...path.actions]};
        this.#isBlocked = false;
        return true;
    }

    /** Execute one movement step. Returns 'SUCCEDED' | 'FAILED' | 'RUNNING' */
    async stepOnce() {
        if (this.#currentPath.actions.length === 0) return 'SUCCEDED';

        const next = this.#currentPath.actions.shift();
        const success = await this.#resilientMove(next.direction);

        if(!success) {
            this.#isBlocked = true;
            this.#currentPath.actions.length = 0;
            return 'FAILED';
        }

        return this.#currentPath.actions.length === 0 ? 'SUCCEDED' : 'RUNNING';
    }

    /** True if a path for the given goal is currently loaded. */
    hasPathFor(goalID) {
        return this.#currentPath.goalId === goalID
            && this.#currentPath.actions.length > 0;
    }

    invalidatePath() {
        this.#currentPath = {goalId: null, actions: []};
    }

    get isBlocked() {
        return this.#isBlocked;
    }

    
    //=============== Internal==================================================================

    // TODO: consider avoiding delivery tiles in areas crowded by other agents
    async #computeNearestTarget(map, sccMap, me, targets) {
        const start = { x: me.x, y: me.y };

        // XXX: only targets in the same SCC are currently considered reachable.
        // TODO implement verification if it make sense to change SCC (for example in destination scc there are more spawning AND delivery tiles)
        const eligibleTargets = targets.filter(
            (t) => sccMap[start.x][start.y] === sccMap[t.x][t.y]
        );

        const paths = await Promise.all(
            eligibleTargets.map((tile) =>
                Promise.resolve(this.#pathFinder.aStar(map, start, { x: tile.x, y: tile.y }))
            )
        );

        return paths
            .filter((path) => path !== null)
            .reduce(
                (shortest, path) => path.distance < shortest.distance ? path : shortest,
                { distance: Infinity, path: [] }
            );
    }

    async #resilientMove(direction, maxAttempts = 3) {
        const move = (direction) => new Promise((resolve) => this.#socket.emit("move", direction, resolve));

        for (let i = 0; i < maxAttempts; ++i) {
            // console.log(`Moving ${direction} (attempt ${i + 1}/${maxAttempts})...`);
            const result = await move(direction);
            if (result) return result;

            // console.log(`Move ${direction} failed (attempt ${i + 1}/${maxAttempts}), retrying...`);
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // await this.#socket.emitShout(`Help! Blocked trying to move ${direction}`);
        console.error(`Move ${direction} failed after ${maxAttempts} attempts. Giving up.`);
        return null;
    }
}