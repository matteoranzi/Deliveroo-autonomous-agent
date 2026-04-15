import { BDI_Agent } from './MultiAgentSystem/BDI_Agent/BDI_Agent.js';
import {BT_Agent} from './sandbox/behaviour_tree.js';

// const agent = new BDI_Agent();
const agent = new BT_Agent();
await agent.start();