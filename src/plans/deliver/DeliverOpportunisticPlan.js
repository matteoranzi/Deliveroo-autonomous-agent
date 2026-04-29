import {BasePlan} from "../BasePlan.js";
import {PlanApplicability} from "../../rules/PlanApplicability.js";

export class DeliverOpportunisticPlan extends BasePlan {
    static trigger = "DELIVER";
    static priority = 20;
    static rule = PlanApplicability.deliverOpportunistic;

    isApplicable(ctx) {
        return DeliverOpportunisticPlan.rule.evaluate(ctx);
    }
}