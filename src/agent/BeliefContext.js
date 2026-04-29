/**
 * @typedef {Object} BeliefContext
 * @property {IOAgent} me
 * @property {PerceptionCapability} perception
 * @property {MemoryCapability} memory
 * @property {NavigationCapability} navigation
 * @property {string | null} currentIntention what the agent is currently committed to
 * @property {string[]} intentionsHistory last N completed intentions
 * @property {Map<string, *>} workingMemory short-term remembered facts
 * @property {IOTile[]} deliveryTiles
 * @property {IOTile[]} spawnerTiles
 * @property {number[][]} sccMap
 */