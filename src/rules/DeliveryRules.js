import {Rule} from "./Rule.js";

export const DeliveryRules = {
    hasParcel: new Rule("HasParcel", ctx => ctx.perception.getCarriedParcels(ctx.me.id).length > 0),
    deliveryReachable: new Rule("DeliveryReachable", ctx => ctx.perception.deliveryTilesReachable(ctx.me, ctx.sccMap)),
    adjacentToDelivery: new Rule("AdjacentToDelivery", ctx => ctx.perception.isAdjacentToDeliveryTile(ctx.me)),
    parcelsNearby: new Rule("ParcelsNearby", ctx => ctx.perception.getParcelsNearby().length > 0),
    manyParcelsNearby: new Rule("ManyParcelsNearby", ctx => ctx.perception.getParcelsNearby().length >= 3),
};
