export class Rule {
    #name;
    #evaluate;

    constructor(name, evaluateFn) {
        this.#name = name;
        this.#evaluate = evaluateFn;
    }

    evaluate(beliefContext) {
        const result = this.#evaluate(beliefContext);
        if(!result) console.log(`Rule ${this.#name} evaluated to FAILED.`);
        return result;
    }

    get name() {
        return this.#name;
    }

    // Combinators: produce new Rule instances
    and(other) {
        return new Rule(`(${this.#name} AND ${other.name})`,
            (context) => this.evaluate(context) && other.evaluate(context));
    }

    or(other) {
        return new Rule(`(${this.#name} OR ${other.name})`,
            (context) => this.evaluate(context) || other.evaluate(context));
    }

    not() {
        return new Rule(`NOT (${this.#name})`,
            (context) => !this.evaluate(context));
    }
}