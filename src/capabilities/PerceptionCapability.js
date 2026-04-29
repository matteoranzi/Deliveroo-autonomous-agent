export class PerceptionCapability {

    // Beliefs owned by this capability
    #sensedParcels = [];
    // #agentsMap = new Map();
    #info;
    #me;
    #sensedWorld = {tiles: []}

    // Registers all socket listeners - this capability owns sensor wiring
    attach(socket) {
        socket.onSensing(sensing => this.#updateSensing(sensing));
        socket.on('info', info => this.#updateInfo(info));
        socket.onYou(you => this.#me = you);
    }

    //Query API used by plans
    getParcelsNearby() {
        throw new Error('getParcelsNearby() not implemented');
    }
    getRivalsNearby() {
        throw new Error('getRivalsNearby() not implemented');
    }
    isOnDeliveryTile() {
        throw new Error('isOnDeliveryTile() not implemented');
    }
    isOnParcelTile() {
        throw new Error('isOnParcelTile() not implemented');
    }
    getStalestSpawner() {
        // sort by updateTime
        throw new Error('getStalestSpawner() not implemented');
    }
    getCarriedParcels(agentID) {
        throw new Error('getCarriedParcels(agentID) not implemented');
    }

    //=============== Internal==================================================================

    #updateSensing(sensing) {
        this.#sensedWorld = sensing;
    }
    #updateInfo(info) {
        this.#info = info;
    }
}