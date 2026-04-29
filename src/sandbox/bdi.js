import 'dotenv/config'
import { DjsConnect } from "@unitn-asa/deliveroo-js-sdk/client";
import { PathFinder } from "#MultiAgentSystem/BDI_Agent/capabilities/Navigation/PathFinder.js";
import { MapAnalysis } from "#MultiAgentSystem/BDI_Agent/capabilities/Analysis/MapAnalysis.js";
import { TILE_TYPES } from "#types/world.js";

/**
 * @typedef {import("#@unitn-asa/deliveroo-js-sdk/src/types/IOGameOptions.js").IOGameOptions} IOGameOptions
 * @typedef {import("#@unitn-asa/deliveroo-js-sdk/src/types/IOAgent.js").IOAgent} IOAgent
 * @typedef {import("#@unitn-asa/deliveroo-js-sdk/src/types/IOCrate.js").IOCrate} IOCrate
 * @typedef {import("#@unitn-asa/deliveroo-js-sdk/src/types/IOParcel.js").IOParcel} IOParcel
 * @typedef {import("#types/world.js").TilePosition} TilePosition
 * @typedef {import("#types/world.js").WorldMap} WorldMap
 * @typedef {import("#types/world.js").WorldSensing} WorldSensing
 * @typedef {import("#types/world.js").NavigationPath} NavigationPath
 * @typedef {import("#types/world.js").TileMoveTile} TileMoveTile
 */

// ─────────────────────────────────────────────────────────────────────────────
// Plan type definition
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A Plan in the Plan Library.
 *
 * @typedef {Object} Plan
 * @property {string}   id          - Unique identifier, used to avoid re-registering duplicates.
 * @property {string}   trigger     - The desire/goal this plan handles (e.g. 'DELIVER', 'PICKUP').
 * @property {number}   priority    - Higher = preferred when multiple plans match the same trigger.
 * @property {() => boolean} context - Precondition: must return true for this plan to be applicable.
 * @property {() => Promise<void>} body - The executable plan body (BT or procedural).
 * @property {'static'|'dynamic'} source - 'static' = from PlanLibrary, 'dynamic' = injected ad-hoc.
 * @property {number|null} [expiresAt] - Optional: epoch ms after which a dynamic plan auto-removes itself.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Desire type definition
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A Desire is a candidate goal with a computed utility score.
 *
 * @typedef {Object} Desire
 * @property {string} goal    - Matches a Plan's trigger field.
 * @property {number} utility - Score used to rank and select intentions.
 */

const START_DELAY_MS = 1000;

export class BDI_Agent_2 {

    // ── Beliefs ───────────────────────────────────────────────────────────────

    /** @type {WorldMap} */
    #worldMap = { width: 0, height: 0, tiles: [] };
    /** @type {number[][]} */
    #sccMap = [];
    /** @type {WorldSensing} */
    #sensedWorld = { width: 0, height: 0, tiles: [] };
    /** @type {Map<string, IOAgent>} */
    #agentsMap = new Map();
    /** @type {Map<string, IOParcel>} */
    #parcelsMap = new Map();
    /** @type {Map<string, IOCrate>} */
    #cratesMap = new Map();
    /** @type {IOTile[]} */
    #deliveryTiles = [];
    /** @type {IOTile[]} */
    #parcelSpawnerTiles = [];
    /** @type {IOAgent} */
    #me = {};
    /** @type {IOParcel[]} */
    #sensedParcels = [];
    /** @type {IOGameOptions} */
    #gameConfig = {};
    /** @type {number} */
    #elapsedTime = 0;

    // ── Intention execution state ─────────────────────────────────────────────

    /** @type {TileMoveTile[]} */
    #agentMovingActions = [];

    /**
     * The currently committed intention (goal string), or null if idle.
     * Compared on each deliberation tick to detect intention change.
     * @type {string|null}
     */
    #currentIntention = null;

    // ── Plan Library ──────────────────────────────────────────────────────────

    /**
     * The static Plan Library: all pre-defined plans, keyed by plan id.
     * Populated in #buildPlanLibrary(), called once after initialization.
     *
     * Multiple plans per trigger are supported — the deliberation cycle
     * selects the highest-priority applicable one via #selectPlan().
     *
     * @type {Map<string, Plan>}
     */
    #planLibrary = new Map();

    /**
     * Dynamic plan registry: ad-hoc plans injected at runtime.
     * These are checked BEFORE the static library (higher precedence by default).
     * Plans with an expiresAt field are garbage-collected automatically.
     *
     * @type {Map<string, Plan>}
     */
    #dynamicPlans = new Map();

    // ── Infrastructure ────────────────────────────────────────────────────────

    #socket = DjsConnect();
    #pathFinder = new PathFinder();
    #mapAnalysis = new MapAnalysis();

    // ─────────────────────────────────────────────────────────────────────────
    // Initialization
    // ─────────────────────────────────────────────────────────────────────────

    async #initialize() {
        await Promise.all([
            this.#waitForMap(),
            this.#waitForYou(),
            this.#waitForInfo(),
            this.#waitForConfig(),
        ]);

        console.log("Initial beliefs acquired");

        this.#sccMap = this.#mapAnalysis.stronglyConnectedComponents(this.#worldMap);
        console.log("SCC map computed");

        // Continuous belief update from sensing events
        this.#socket.onSensing((sensing) => {
            for (const position of sensing.positions) {
                this.#sensedWorld.tiles[position.x][position.y].updateTime = this.#elapsedTime;
            }
            this.#sensedParcels = sensing.parcels;
        });

        this.#socket.on("info", (info) => {
            this.#elapsedTime = info.ms;
        });

        // Build static Plan Library — must happen after beliefs are ready
        // because context closures capture #me, #sensedParcels, etc.
        this.#buildPlanLibrary();

        console.log("Plan Library ready. Agent initialized.");
    }

    #waitForMap() {
        return new Promise((resolve) => {
            this.#socket.onMap((width, height, tiles) => {
                for (const tile of tiles) {
                    if (tile.x > this.#worldMap.width)  this.#worldMap.width  = tile.x;
                    if (tile.y > this.#worldMap.height) this.#worldMap.height = tile.y;
                }
                this.#worldMap.width++;
                this.#worldMap.height++;

                this.#sensedWorld.width  = this.#worldMap.width;
                this.#sensedWorld.height = this.#worldMap.height;

                this.#worldMap.tiles = Array.from(
                    { length: this.#worldMap.width },
                    () => new Array(this.#worldMap.height).fill(null)
                );
                this.#sensedWorld.tiles = Array.from(
                    { length: this.#sensedWorld.width },
                    () => new Array(this.#sensedWorld.height).fill(null)
                );

                for (const tile of tiles) {
                    const tileType = String(tile.type);
                    this.#worldMap.tiles[tile.x][tile.y] = tileType;
                    this.#sensedWorld.tiles[tile.x][tile.y] = { updateTime: 0 };

                    switch (tileType) {
                        case TILE_TYPES.parcelSpawner: this.#parcelSpawnerTiles.push(tile); break;
                        case TILE_TYPES.delivery:      this.#deliveryTiles.push(tile);      break;
                    }
                }

                resolve();
            });
        });
    }

    #waitForYou() {
        return new Promise((resolve) => {
            this.#socket.onYou((you) => {
                you.x = Math.round(you.x);
                you.y = Math.round(you.y);
                this.#me = you;
                resolve();
            });
        });
    }

    #waitForInfo() {
        return new Promise((resolve) => {
            this.#socket.on("info", (_info) => resolve());
        });
    }

    #waitForConfig() {
        return new Promise((resolve) => {
            this.#socket.on("config", (config) => {
                this.#gameConfig = config;
                resolve();
            });
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Plan Library construction
    //
    // Each plan entry has:
    //   trigger  — which desire/goal this plan addresses
    //   priority — used to rank among multiple applicable plans for the same trigger
    //   context  — precondition that must hold for the plan to be applicable NOW
    //   body     — async function that executes ONE deliberation tick of the plan
    //
    // Having multiple plans per trigger (e.g. two DELIVER plans) is the key
    // BDI advantage: the agent can choose the best strategy given current context,
    // rather than executing a single hardcoded procedure.
    // ─────────────────────────────────────────────────────────────────────────

    #buildPlanLibrary() {

        // ── DELIVER plans ─────────────────────────────────────────────────────
        // Two plans for the same desire.
        // Plan 1 handles the normal case; Plan 2 handles the case where the agent
        // is already near a delivery tile (opportunistic delivery — higher priority).

        this.#registerPlan({
            id: 'deliver-standard',
            trigger: 'DELIVER',
            priority: 10,
            source: 'static',
            context: () => this.#hasParcel() && this.#deliveryTilesReachable(),
            body: async () => {
                if (this.#isOnDeliveryTile()) {
                    console.log("[DELIVER-standard] On delivery tile — putting down.");
                    await this.#socket.emitPutdown();
                    this.#agentMovingActions.length = 0;
                } else if (this.#hasNavigationPath(dest => this.#destinationIsDeliveryTile(dest))) {
                    await this.#stepAlongPath();
                } else {
                    const path = await this.#getPathToClosestTargetTiles(this.#deliveryTiles);
                    this.#loadIntentionActions(path);
                }
            },
        });

        this.#registerPlan({
            id: 'deliver-opportunistic',
            trigger: 'DELIVER',
            priority: 20,    // higher priority: used when already adjacent to a delivery tile
            source: 'static',
            context: () => {
                if (!this.#hasParcel()) return false;
                // Opportunistic: a delivery tile is within 2 steps
                return this.#deliveryTiles.some(t =>
                    Math.abs(t.x - this.#me.x) + Math.abs(t.y - this.#me.y) <= 2
                );
            },
            body: async () => {
                if (this.#isOnDeliveryTile()) {
                    console.log("[DELIVER-opportunistic] On delivery tile — putting down immediately.");
                    await this.#socket.emitPutdown();
                    this.#agentMovingActions.length = 0;
                } else {
                    // Navigate to the adjacent tile rather than full pathfinding
                    const closestAdjacent = this.#deliveryTiles
                        .filter(t => Math.abs(t.x - this.#me.x) + Math.abs(t.y - this.#me.y) <= 2)
                        .sort((a, b) =>
                            (Math.abs(a.x - this.#me.x) + Math.abs(a.y - this.#me.y)) -
                            (Math.abs(b.x - this.#me.x) + Math.abs(b.y - this.#me.y))
                        )[0];

                    const path = this.#pathFinder.aStar(
                        this.#worldMap,
                        { x: this.#me.x, y: this.#me.y },
                        { x: closestAdjacent.x, y: closestAdjacent.y }
                    );
                    this.#loadIntentionActions(path);
                }
            },
        });

        // ── PICKUP plans ──────────────────────────────────────────────────────
        // Plan 1: standard pickup — navigate to closest parcel.
        // Plan 2: bulk pickup — if multiple parcels are clustered nearby,
        //         use a greedy sweep route rather than point-to-point.

        this.#registerPlan({
            id: 'pickup-standard',
            trigger: 'PICKUP',
            priority: 10,
            source: 'static',
            context: () => !this.#hasParcel() && this.#sensedParcels.length > 0,
            body: async () => {
                if (this.#isOnParcelTile()) {
                    console.log("[PICKUP-standard] On parcel tile — picking up.");
                    await this.#socket.emitPickup();
                    this.#agentMovingActions.length = 0;
                } else if (this.#hasNavigationPath(dest => this.#destinationIsParcelTile(dest))) {
                    await this.#stepAlongPath();
                } else {
                    const path = await this.#getPathToClosestTargetTiles(
                        this.#sensedParcels.map(p => ({ x: p.x, y: p.y }))
                    );
                    this.#loadIntentionActions(path);
                }
            },
        });

        this.#registerPlan({
            id: 'pickup-bulk',
            trigger: 'PICKUP',
            priority: 15,    // preferred when many parcels are nearby
            source: 'static',
            context: () => {
                const nearby = this.#sensedParcels.filter(p =>
                    Math.abs(p.x - this.#me.x) + Math.abs(p.y - this.#me.y) <= 5
                );
                return !this.#hasParcel() && nearby.length >= 3;
            },
            body: async () => {
                // Greedy: always move toward the closest uncollected parcel among the cluster
                const nearbyParcels = this.#sensedParcels.filter(p =>
                    Math.abs(p.x - this.#me.x) + Math.abs(p.y - this.#me.y) <= 5 &&
                    p.carriedBy === null
                );

                if (nearbyParcels.length === 0) return;

                if (this.#isOnParcelTile()) {
                    console.log("[PICKUP-bulk] On parcel tile — picking up (bulk sweep).");
                    await this.#socket.emitPickup();
                    this.#agentMovingActions.length = 0;
                } else {
                    const path = await this.#getPathToClosestTargetTiles(
                        nearbyParcels.map(p => ({ x: p.x, y: p.y }))
                    );
                    this.#loadIntentionActions(path);
                }
            },
        });

        // ── EXPLORE plans ─────────────────────────────────────────────────────
        // Plan 1: random exploration (fallback).
        // Plan 2: targeted exploration — head toward spawner tiles that were
        //         sensed longest ago (stale knowledge = likely new parcels there).

        this.#registerPlan({
            id: 'explore-random',
            trigger: 'EXPLORE',
            priority: 1,    // lowest: only if targeted exploration not applicable
            source: 'static',
            context: () => true,    // always applicable — guaranteed fallback
            body: async () => {
                if (this.#hasNavigationPath(dest => this.#destinationIsValidTile(dest))) {
                    await this.#stepAlongPath();
                } else {
                    const validTiles = [];
                    for (let x = 0; x < this.#worldMap.width; x++) {
                        for (let y = 0; y < this.#worldMap.height; y++) {
                            const type = this.#worldMap.tiles[x][y];
                            if (type !== null && type !== TILE_TYPES.wall) {
                                validTiles.push({ x, y });
                            }
                        }
                    }
                    const randomTile = validTiles[Math.floor(Math.random() * validTiles.length)];
                    const path = this.#pathFinder.aStar(
                        this.#worldMap,
                        { x: this.#me.x, y: this.#me.y },
                        randomTile
                    );
                    this.#loadIntentionActions(path);
                }
            },
        });

        this.#registerPlan({
            id: 'explore-staleness',
            trigger: 'EXPLORE',
            priority: 5,    // preferred over random when spawner tiles exist
            source: 'static',
            context: () => this.#parcelSpawnerTiles.length > 0,
            body: async () => {
                if (this.#hasNavigationPath(dest => this.#destinationIsValidTile(dest))) {
                    await this.#stepAlongPath();
                } else {
                    // Find the spawner tile with the oldest sense timestamp
                    const stalestSpawner = this.#parcelSpawnerTiles
                        .filter(t => this.#sensedWorld.tiles[t.x]?.[t.y] !== undefined)
                        .sort((a, b) =>
                            this.#sensedWorld.tiles[a.x][a.y].updateTime -
                            this.#sensedWorld.tiles[b.x][b.y].updateTime
                        )[0];

                    if (!stalestSpawner) return;

                    console.log(`[EXPLORE-staleness] Heading to stale spawner @ (${stalestSpawner.x},${stalestSpawner.y})`);
                    const path = this.#pathFinder.aStar(
                        this.#worldMap,
                        { x: this.#me.x, y: this.#me.y },
                        { x: stalestSpawner.x, y: stalestSpawner.y }
                    );
                    this.#loadIntentionActions(path);
                }
            },
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Plan registration
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Registers a plan into the static Plan Library.
     * Silently replaces any existing plan with the same id.
     * @param {Plan} plan
     */
    #registerPlan(plan) {
        this.#planLibrary.set(plan.id, plan);
    }

    /**
     * Injects an ad-hoc dynamic plan at runtime.
     *
     * Dynamic plans are checked BEFORE static plans, giving them override
     * capability. Use this to react to real-time events (e.g. a rival agent
     * spotted, a high-value parcel appeared, a path is suddenly blocked).
     *
     * Dynamic plans with an expiresAt will be garbage-collected automatically
     * at the start of each deliberation tick.
     *
     * @param {Plan} plan
     *
     * @example
     * // Called from an external sensor/event handler:
     * agent.injectDynamicPlan({
     *     id: 'avoid-agent-X',
     *     trigger: 'EXPLORE',
     *     priority: 50,
     *     source: 'dynamic',
     *     expiresAt: Date.now() + 5000,   // active for 5 seconds
     *     context: () => this.#rivalIsNear('agent-X'),
     *     body: async () => { ... }        // flee / detour logic
     * });
     */
    injectDynamicPlan(plan) {
        if (plan.source !== 'dynamic') {
            console.warn(`[PlanLibrary] injectDynamicPlan called with source='${plan.source}'. Forcing 'dynamic'.`);
            plan.source = 'dynamic';
        }
        this.#dynamicPlans.set(plan.id, plan);
        console.log(`[PlanLibrary] Dynamic plan injected: '${plan.id}' for trigger '${plan.trigger}'`);
    }

    /**
     * Removes a dynamic plan by id. Idempotent.
     * @param {string} planId
     */
    removeDynamicPlan(planId) {
        this.#dynamicPlans.delete(planId);
        console.log(`[PlanLibrary] Dynamic plan removed: '${planId}'`);
    }

    /**
     * Garbage-collects expired dynamic plans.
     * Called at the start of each deliberation tick.
     */
    #expireDynamicPlans() {
        const now = Date.now();
        for (const [id, plan] of this.#dynamicPlans) {
            if (plan.expiresAt !== null && plan.expiresAt !== undefined && now > plan.expiresAt) {
                console.log(`[PlanLibrary] Dynamic plan expired and removed: '${id}'`);
                this.#dynamicPlans.delete(id);
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // BDI Deliberation cycle
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Generates all currently achievable desires as scored Desire objects.
     *
     * Each desire's utility is computed from domain heuristics:
     *   - DELIVER: high base score + bonus for parcel value / time decay
     *   - PICKUP:  score based on parcel count and distance
     *   - EXPLORE: low base score, increases with time since last new parcel seen
     *
     * @returns {Desire[]} sorted descending by utility
     */
    #generateDesires() {
        const desires = [];

        if (this.#hasParcel()) {
            desires.push({ goal: 'DELIVER', utility: this.#deliveryUtility() });
        }

        if (this.#sensedParcels.length > 0) {
            desires.push({ goal: 'PICKUP', utility: this.#pickupUtility() });
        }

        desires.push({ goal: 'EXPLORE', utility: this.#exploreUtility() });

        return desires.sort((a, b) => b.utility - a.utility);
    }

    /**
     * For each ranked desire, selects the highest-priority applicable plan.
     * Dynamic plans are checked before static plans.
     * Returns the first (desire, plan) pair that is fully applicable.
     *
     * @returns {{ desire: Desire, plan: Plan } | null}
     */
    #selectIntention() {
        const desires = this.#generateDesires();

        for (const desire of desires) {
            const plan = this.#selectPlan(desire.goal);
            if (plan) return { desire, plan };
        }

        return null;
    }

    /**
     * Selects the highest-priority applicable plan for a given trigger.
     * Dynamic plans take precedence over static ones at equal priority values
     * (because dynamic plans are checked first in the merge).
     *
     * @param {string} trigger
     * @returns {Plan | null}
     */
    #selectPlan(trigger) {
        // Merge dynamic (checked first) + static plans into one candidate list
        const candidates = [
            ...this.#dynamicPlans.values(),
            ...this.#planLibrary.values(),
        ].filter(p => p.trigger === trigger && p.context());

        if (candidates.length === 0) return null;

        // Highest priority wins; ties go to dynamic plans (they appear first in the array)
        return candidates.reduce((best, p) => p.priority > best.priority ? p : best);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Utility functions (desire scoring)
    // ─────────────────────────────────────────────────────────────────────────

    #deliveryUtility() {
        const carriedParcels = this.#sensedParcels.filter(p => p.carriedBy === this.#me.id);

        // Sum of current parcel values, penalised by average distance to delivery
        const totalValue = carriedParcels.reduce((sum, p) => sum + (p.reward ?? 1), 0);
        const avgDeliveryDist = this.#deliveryTiles.length > 0
            ? Math.min(...this.#deliveryTiles.map(t =>
                Math.abs(t.x - this.#me.x) + Math.abs(t.y - this.#me.y)
            ))
            : 999;

        return totalValue * 10 - avgDeliveryDist * 0.5;
    }

    #pickupUtility() {
        const uncollected = this.#sensedParcels.filter(p => p.carriedBy === null);
        if (uncollected.length === 0) return 0;

        const closest = uncollected.reduce((best, p) => {
            const d = Math.abs(p.x - this.#me.x) + Math.abs(p.y - this.#me.y);
            return d < best.dist ? { dist: d, parcel: p } : best;
        }, { dist: Infinity, parcel: null });

        const decayRate = this.#gameConfig.parcelDecayInterval ?? 1000;
        const timeBonus = closest.parcel?.reward ?? 1;

        return timeBonus * 5 - closest.dist * 0.3 - (decayRate < 2000 ? 2 : 0);
    }

    #exploreUtility() {
        // Base score — always available as fallback
        // Slightly increases when we haven't seen a new parcel in a while
        const timeSinceLastParcel = this.#sensedParcels.length === 0
            ? this.#elapsedTime
            : 0;

        return 1 + Math.min(timeSinceLastParcel * 0.001, 3);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Navigation helpers
    // ─────────────────────────────────────────────────────────────────────────

    async #getPathToClosestTargetTiles(targetTiles) {
        const startTile = { x: this.#me.x, y: this.#me.y };

        const eligibleTiles = targetTiles.filter(
            tile => this.#sccMap[startTile.x][startTile.y] === this.#sccMap[tile.x][tile.y]
        );

        const paths = await Promise.all(
            eligibleTiles.map(tile =>
                Promise.resolve(this.#pathFinder.aStar(this.#worldMap, startTile, { x: tile.x, y: tile.y }))
            )
        );

        return paths
            .filter(p => p !== null)
            .reduce(
                (shortest, p) => p.distance < shortest.distance ? p : shortest,
                { distance: Infinity, path: [] }
            );
    }

    /** @param {NavigationPath} navigationPath */
    #loadIntentionActions(navigationPath) {
        this.#agentMovingActions.length = 0;
        for (const step of navigationPath.path) {
            this.#agentMovingActions.push(step);
        }
    }

    /**
     * Executes the next step in the current navigation path.
     * Clears the path on failure.
     */
    async #stepAlongPath() {
        const nextMove = this.#agentMovingActions.shift();
        const success  = await this.#resilientMove(nextMove.direction);
        if (!success) {
            console.error(`[Nav] Move failed — clearing path.`);
            this.#agentMovingActions.length = 0;
        }
    }

    async #resilientMove(direction, maxAttempts = 3) {
        const move = dir => new Promise(resolve => this.#socket.emit("move", dir, resolve));

        for (let i = 0; i < maxAttempts; ++i) {
            const result = await move(direction);
            if (result) return result;
            await new Promise(r => setTimeout(r, 500));
        }

        await this.#socket.emitShout(`Help! Blocked trying to move ${direction}`);
        console.error(`[Nav] Move ${direction} failed after ${maxAttempts} attempts.`);
        return null;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Belief query helpers
    // ─────────────────────────────────────────────────────────────────────────

    #hasParcel() {
        return this.#sensedParcels.some(p => p.carriedBy === this.#me.id);
    }

    #isOnDeliveryTile() {
        return this.#worldMap.tiles[this.#me.x][this.#me.y] === TILE_TYPES.delivery;
    }

    #isOnParcelTile() {
        return this.#sensedParcels.some(p => p.x === this.#me.x && p.y === this.#me.y);
    }

    #deliveryTilesReachable() {
        return this.#deliveryTiles.some(
            t => this.#sccMap[this.#me.x][this.#me.y] === this.#sccMap[t.x][t.y]
        );
    }

    /** @param {(dest: TilePosition) => boolean} predicate */
    #hasNavigationPath(predicate) {
        if (this.#agentMovingActions.length > 0) {
            return predicate(this.#agentMovingActions.at(-1).to);
        }
        return false;
    }

    /** @param {TilePosition} dest */
    #destinationIsDeliveryTile(dest) {
        return this.#worldMap.tiles[dest.x][dest.y] === TILE_TYPES.delivery;
    }

    /** @param {TilePosition} dest */
    #destinationIsParcelTile(dest) {
        return this.#sensedParcels.some(p => p.x === dest.x && p.y === dest.y);
    }

    /** @param {TilePosition} dest */
    #destinationIsValidTile(dest) {
        const type = this.#worldMap.tiles[dest.x]?.[dest.y];
        return type !== null && type !== TILE_TYPES.wall;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Main execution loop
    // ─────────────────────────────────────────────────────────────────────────

    async start() {
        console.log("Initializing...");
        await this.#initialize();
        console.log("Starting BDI deliberation loop...");

        const deliberationLoop = async () => {
            while (true) {
                // 1. Expire any timed-out dynamic plans
                this.#expireDynamicPlans();

                // 2. Select the best applicable intention for this tick
                const selected = this.#selectIntention();

                if (!selected) {
                    console.warn("[BDI] No applicable plan found. Waiting...");
                    await new Promise(r => setTimeout(r, 200));
                    continue;
                }

                const { desire, plan } = selected;

                // 3. Detect intention change — clear navigation state on switch
                if (desire.goal !== this.#currentIntention) {
                    console.log(`[BDI] Intention switch: ${this.#currentIntention} → ${desire.goal} (plan: ${plan.id})`);
                    this.#agentMovingActions.length = 0;
                    this.#currentIntention = desire.goal;
                }

                // 4. Execute one tick of the selected plan body
                await plan.body();
            }
        };

        setTimeout(deliberationLoop, START_DELAY_MS);
    }
}