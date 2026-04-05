import 'dotenv/config';
import { DjsConnect } from "@unitn-asa/deliveroo-js-sdk/client";

console.log("HOST: " + process.env.HOST);
console.log("TOKEN: " + process.env.TOKEN);
const socket = DjsConnect(process.env.HOST, process.env.TOKEN);

let currentReward = 0;
let previousReward = 0;
let meX = 0;
let meY = 0;

/*
async function myFn () {
    try {
        let up = await socket.emitMove('up');
        let right = await socket.emitMove('right');
    } catch (e) {
        console.log(e)
    }
}

myFn ()

socket.on( 'tile', (x) => {
    console.log(x)
} )
*/
// Agent identity

socket.on("you", (me) => {
    console.log("[YOU]", { me });
    meX = me.x
    meY = me.y
});

/*
// Map information
socket.on("map", (width, height, tiles) => {
  console.log("[MAP]", { width, height, tiles });
});

socket.on("tile", (x, y, delivery) => {
  console.log("[TILE]", { x, y, delivery });
});
 */
// Sensing
socket.on("sensing", (sensing) => {
    console.log("[AGENTS SENSING]", sensing);

    for (let parcel of sensing.parcels) {
        if (parcel.x === meX && parcel.y === meY) {

        }
    }
});


//calculate parcel decay time from sensing.

let myparcelreward = sensing.parcels[0].reward;
if(myparcelreward > 0) {
    sensing.parcels[0].reward


}



// Connection
socket.on("connect", () => {
    console.log("[CONNECTED] Socket ID:", socket.id);
});

socket.on("disconnect", () => {
    console.log("[DISCONNECTED]");
});


