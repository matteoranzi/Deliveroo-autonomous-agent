import { Worker } from 'worker_threads';
import { availableParallelism } from 'os';

/**
 * A fixed-size pool of persistent worker threads.
 * Workers are reused across tasks, avoiding per-task spawn overhead.
 */
export class WorkerPool {
    /** @type {Worker[]} */
    #workers;
    /** @type {Worker[]} */
    #idle;
    /** @type {Array<{data: any, resolve: Function, reject: Function}>} */
    #queue = [];

    /**
     * @param {URL} workerUrl - URL of the worker module (use `new URL('./worker.js', import.meta.url)`)
     * @param {number} [size] - number of worker threads (defaults to available CPU parallelism)
     */
    constructor(workerUrl, size = availableParallelism()) {
        this.#workers = Array.from({ length: size }, () => new Worker(workerUrl));
        this.#idle = [...this.#workers];
    }

    /**
     * Submit a task to the pool. Resolves with the worker's postMessage result.
     * @param {any} data - structured-cloneable data sent to the worker
     * @returns {Promise<any>}
     */
    run(data) {
        return new Promise((resolve, reject) => {
            this.#queue.push({ data, resolve, reject });
            this.#dispatch();
        });
    }

    #dispatch() {
        if (this.#idle.length === 0 || this.#queue.length === 0) return;

        const worker = this.#idle.pop();
        const { data, resolve, reject } = this.#queue.shift();

        const onMessage = (result) => {
            worker.off('error', onError);
            this.#idle.push(worker);
            this.#dispatch();
            resolve(result);
        };

        const onError = (err) => {
            worker.off('message', onMessage);
            this.#idle.push(worker);
            this.#dispatch();
            reject(err);
        };

        worker.once('message', onMessage);
        worker.once('error', onError);
        worker.postMessage(data);
    }

    /**
     * Terminate all workers. Call on shutdown.
     * @returns {Promise<void>}
     */
    destroy() {
        return Promise.all(this.#workers.map((w) => w.terminate()));
    }
}