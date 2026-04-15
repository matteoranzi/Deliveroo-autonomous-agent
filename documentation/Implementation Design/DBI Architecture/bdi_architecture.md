# BDI Architecture & Implementation Design

## Overview

This document describes the design decisions and integration architecture for the BDI-based autonomous agent.
It reflects the current codebase state and defines how existing and future components should interact.

---

## Component Map

```
src/
├── main.js                            ← bootstrap, socket wiring, execution loop
└── MultiAgentSystem/
    ├── AgentsOrchestrator.js          ← coordinates multiple agents (multi-agent future)
    └── BDI_Agent/
        ├── BDI_Agent.js         ← BDI agent class (belief base lives here)
        └── capabilities/
            ├── mapUtils.js            ← getNeighbors (pure map logic, shared utility)
            ├── Navigation/
            │   ├── PathFinder.js      ← aStar + heuristics (stateless, domain-agnostic)
            │   ├── WorkerPool.js      ← fixed-size thread pool for parallel A* execution
            │   └── aStarWorker.js     ← worker thread entry point
            └── Analysis/
                └── MapAnalysis.js     ← SCC computation (Tarjan / Kosaraju)
```

---

## BDI Layer Breakdown

### Beliefs — `BDI_Agent`

The agent's belief base is the single source of truth for world state.
It is responsible for maintaining and merging all information the agent has about the environment.

```
BeliefBase (inside BDI_Agent):
    staticMap       WorldMap        received once on connection, never changes
    sccMap          number[][]      derived from staticMap, computed once at startup
    liveMap         WorldMap        staticMap + dynamic sensing overlay (current truth)
    me              AgentState      position, score, carried parcels
    knownParcels    Map<id, Parcel> sensed parcels with reward and decay estimate
    sensedAgents    Map<id, Agent>  positions of other agents (friend and foe)
    gameConfig      IOGameOptions   CLOCK tick, parcel decay rates, etc.
```

**Key rule**: capabilities (A\*, getNeighbors) always receive `liveMap` as a parameter —
they never read world state directly. The agent passes its current belief state to them.

**Belief revision** happens on socket events:
- `onMap` → populate `staticMap`, compute `sccMap`, initialize `liveMap`
- `onYou` → update `me`
- `onSensing` → update `liveMap` overlay, `knownParcels`, `sensedAgents`; trigger intention reconsideration if the current path is affected

### Desires — event-driven goal generation

Desires are generated reactively from belief changes, not polled:

| Belief change | Generated desire |
|---|---|
| New parcel sensed | `PickUp(parcel)` if reward > threshold |
| Carrying parcel(s) | `Deliver` if reward decay makes it urgent |
| Path blocked by sensing update | Re-evaluate current navigation intention |

Desires are prioritized (e.g., by expected reward / distance trade-off).
The agent commits to the highest-priority achievable desire as its current intention.

### Intentions & Plan Library

An intention is a committed plan. The plan library defines how to achieve each desire:

```
NavigateTo(targetTile):
    precondition:  sccMap[me] === sccMap[target]   (reachable)
    body:          path = await aStarPool.run({ map: liveMap, startTile: me, endTile: target })
                   if path is null → FAIL
                   execute steps one by one via socket.emit("move", ...)
                   on move failure → retry with expiration, then FAIL
    on failure:    drop intention, re-deliberate

PickUp(parcel):
    precondition:  me is on parcel tile
    body:          socket.emit("pickup", parcel.id)

Deliver():
    precondition:  carrying parcels, on delivery tile
    body:          socket.emit("deliver")

ClearPath(obstacle):          ← FUTURE
    precondition:  obstacle blocking path, push target tile is valid
    body:          run Sokoban-like state-space solver
                   execute push sequence via NavigateTo sub-goals
```

The current `agentMovingActions` queue is a simplified stub for the `NavigateTo` plan body.
It should be replaced with proper intention execution that supports abortion and replanning.

---

## Navigation Design

### A\* is domain-agnostic

`PathFinder.aStar(map, startTile, targetTile, heuristic?)` takes a map and returns a path.
It does not know about sensing, agents, parcels, or game rules.
All domain knowledge is encoded in the `liveMap` passed to it.

**Heuristic**: Manhattan distance (default) — admissible and consistent on a grid with unit costs.
Other heuristics (diagonal, euclidean) are available but only appropriate if movement rules change.

**Stale entry check**: uses lazy deletion with an `fScore` array.
A dequeued entry is skipped if its f-score is greater than the current best known f-score for that tile:
```js
if (dequeuedDistance > fScore[currentTile.x][currentTile.y]) continue;
```

### Neighbor logic lives in `mapUtils.getNeighbors`

`getNeighbors(map, tile, crateSpawningFriend?)` encodes what "walkable" means:
walls, directional tiles, crate-spawning tiles. It is a pure function of the map.

When sensing adds dynamic obstacles (known crate positions, sensed agents),
these are reflected in `liveMap` before pathfinding is called — not passed as separate parameters to A\*.
This keeps `getNeighbors` stateless and testable in isolation.

### SCC is a derived belief, not a runtime computation

`MapAnalysis.stronglyConnectedComponents(staticMap)` runs once at startup.
The result (`sccMap: number[][]`) is stored as a belief.
Plans use it to filter eligible target tiles: only tiles in the same SCC as the agent are reachable.

### Parallel pathfinding via WorkerPool

When evaluating multiple delivery tiles, each A\* call runs in a dedicated thread via `WorkerPool`.
The pool is created once at module level and reused across all deliberation cycles.

```
WorkerPool (size = availableParallelism())
    ├── worker 0  ─ aStarWorker.js
    ├── worker 1  ─ aStarWorker.js
    └── ...

getPathToClosestDeliveryTile():
    eligibleTiles = deliveryTiles filtered by SCC
    paths = await Promise.all(eligibleTiles.map(tile => aStarPool.run({...})))
    return shortest non-null path
```

Workers stay alive between tasks (persistent pool, not spawn-per-task).
`WorldMap` is passed to workers via `workerData` structured clone — no shared memory needed.

---

## Sensing Integration (Future)

When the agent senses tiles within range (< 5 tile distance):

1. `onSensing` handler updates `liveMap` overlay (mark tiles as blocked/free, update agent positions)
2. If current intention's planned path crosses a newly blocked tile → intention is dropped, replanning triggered
3. A\* is re-run with the updated `liveMap` — no changes to pathfinder needed

Dynamic costs (fuzzy/probabilistic obstacles) are handled by adjusting edge weights in `getNeighbors`
rather than adding logic to A\*.

---

## Obstacle Pushing (Future)

For movable obstacles (crates on sliding tiles), a separate capability is needed.
This is a Sokoban-like problem and is **not** an extension of the existing A\* pathfinder.

The solver operates on a compound state space:
```
State = (agentPosition, frozenset(obstaclePositions))
```

It is invoked as a plan (`ClearPath`) when:
- A\* returns null (no free path exists)
- The blocked tile is identified as a pushable obstacle
- A valid push target tile exists

The solver returns either a sequence of moves or `IMPOSSIBLE`.
On `IMPOSSIBLE`, the agent re-deliberates (try another route, drop goal, report failure).

---

## Design Decisions Log

| Decision | Rationale |
|---|---|
| `PathFinder` should be refactored to standalone exported functions | No instance state; class is only a namespace; ES modules provide namespacing for free |
| `getNeighbors` stays in `mapUtils`, not on agent class | Pure function of map data; does not vary per agent instance; usable by worker threads without agent context |
| `liveMap` is the merged belief passed to A\* | Keeps pathfinder domain-agnostic; sensing integration happens at belief layer, not in algorithm |
| `sccMap` computed once at startup | Static map never changes; recomputing per deliberation cycle would be wasteful |
| `WorkerPool` created at module level | Infrastructure, not agent state; shared across all deliberation cycles; avoids spawn overhead |
| Sokoban solver is a separate capability | Different state space from grid A\*; invoked as a named plan, not embedded in navigation |
| Heuristic is a function parameter, not a constructor field | More flexible than storing it as instance state; allows per-call override without creating new instances |