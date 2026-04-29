import {DeliveryRules} from "./DeliveryRules.js";

export const PlanApplicability = {
    deliverOpportunistic: DeliveryRules.hasParcel.and(DeliveryRules.adjacentToDelivery),
    deliverStandard: DeliveryRules.hasParcel.and(DeliveryRules.deliveryReachable).and(DeliveryRules.adjacentToDelivery.not()),

    pickupBulk: DeliveryRules.hasParcel.not().and(DeliveryRules.manyParcelsNearby),
    pickupStandard: DeliveryRules.hasParcel.not().and(DeliveryRules.parcelsNearby),
};