import { parentPort } from 'worker_threads';
import { PathFinder } from '#capabilities/Navigation/PathFinder.js';

const pathFinder = new PathFinder();

parentPort.on('message', ({ map, startTile, endTile }) => {
    parentPort.postMessage(pathFinder.aStar(map, startTile, endTile));
});