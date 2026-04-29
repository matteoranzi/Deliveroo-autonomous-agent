export class PlanLibrary {
    /** @type {Map<string, BasePlan>} */
    #plans = new Map();

    // Registration
    /**
     * Registers a plan. Called once during agent initialization via #buildPlanLibrary() in BDI_Agent.
     * @param {BasePlan} plan
     */
    register(...plan) {
        plan.forEach(p => this.#plans.set(p.id, p));
    }

    // Garbage collection

    /**
     * Removes expired dynamic plans.
     * Called at the top of each deliberation tick by DBI_Agent
     */
    expireStale() {
        const now = Date.now();
        for (const [id, plan] of this.#plans.entries()) {
            if (plan.expiresAt && plan.expiresAt < now) {
                this.#plans.delete(id);
            }
        }
    }

    // Selection

    /**
     * Returns the highest-priority applicable plan for a given trigger.
     *
     * @param {string} trigger
     * @param {BeliefContext} ctx
     * @returns {BasePlan | null}
     */
    selectFor(trigger, ctx) {
        const candidates = [...this.#plans.values()].filter(p => p.triggers.includes(trigger) && p.isApplicable(ctx));
        if (!candidates || candidates.length === 0) return null;

        return candidates.reduce((best, p) => p.priority > best.priority ? p : best);
    }
}