import {PerceptionCapability} from "../capabilities/PerceptionCapability.js";
import {MemoryCapability} from "../capabilities/MemoryCapability.js";
import {NavigationCapability} from "../capabilities/NavigationCapability.js";
import {PlanLibrary} from "./PlanLibrary.js";
import {DeliverOpportunisticPlan} from "../plans/deliver/DeliverOpportunisticPlan.js";
import {DeliverStandardPlan} from "../plans/deliver/DeliverStandardPlan.js";

export class BDI_Agent {
    #perception = new PerceptionCapability();
    #memory = new MemoryCapability();
    #navigation = new NavigationCapability();
    #planLibrary = new PlanLibrary();

    #currentIntention = null;

    #socket;
    #worldMap;

    async #initialize() {
        //FIXME: here is missing Promise.all on important events: map, you, config...
        //await Promise.all([])

        // Capabilities wire their own socket listeners
        this.#perception.attach(this.#socket, this.#worldMap);
        //this.memory.attach()

        // Static planes registered once
        this.#planLibrary.register(
            new DeliverOpportunisticPlan(this.#perception, this.#navigation),
            // new DeliverStandardPlan(this.#memory, this.#navigation),
        );
    }

    async #deliberationLoop() {
        while (true) {
            // Maintenance
            //this.#memory.tick();
            this.#planLibrary.expireStale();

            // Build fresh belief snapshot
            const ctx = buildBeliefContext(
                this.#perception,
                this.#memory,
                this.#navigation,
                this.#currentIntention,
            );

            // Deliberate
            const desires = this.#generateDesires(ctx);
            const selected = this.#selectIntention(desires, ctx);

            if(!selected) {
                await new Promise(r => setTimeout(r, 100));
                continue;
            }

            const {desire, plan} = selected;
            if (desire.goal !== this.#currentIntention) {
                this.#navigation.invalidatePath();
                this.currentIntention = desire.goal;
            }

            const status = await plan.body(ctx);

            if (status === 'SUCCEDED' || status === 'FAILED') {
                this.#currentIntention = null; // force re-deliberation
            }
        }
    }

    #selectIntention(desires, ctx) {
        for (const desire of desires) {
            const plan = this.#planLibrary.selectFor(desire.goal, ctx);

            if (plan) return {desire, plan};
        }

        return null;
    }

}