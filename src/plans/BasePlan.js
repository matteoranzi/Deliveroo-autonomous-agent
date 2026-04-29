export class BasePlan {
    /** @type {string[]} Override in subclass */
    static triggers = null;
    /** @type {number} Override in subclass */
    static priority = 0;
    /** @type {*} Override in subclass */
    static rule = null;

    #id;
    #expiresAt;

    constructor(id, expiresAt = null) {
        this.#id = id;
        this.#expiresAt = expiresAt;
    }

    get id() { return this.#id; }
    get expiresAt() { return this.#expiresAt; }

    /** @returns {string[]} */
    get triggers() { return this.constructor.triggers; }
    /** @returns {number} */
    get priority() { return this.constructor.priority; }
    /** @returns {*} */
    get rule() { return this.constructor.rule; }

    /** @param {*} ctx @returns {boolean} */
    isApplicable(ctx) { throw new Error("isApplicable() not implemented"); }

    /** @returns {Promise<'SUCCEDED'|'FAILED'|'RUNNING'>} */
    async body() { throw new Error("body() not implemented"); }

    /** Called when body() returns FAILED */
    async onFailure() { throw new Error("onFailure() not implemented"); }
}