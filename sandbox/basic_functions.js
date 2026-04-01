import 'dotenv/config';
import { DjsConnect } from "@unitn-asa/deliveroo-js-sdk/client";

console.log("HOST: " + process.env.HOST);
console.log("TOKEN: " + process.env.TOKEN);
const socket = DjsConnect(process.env.HOST, process.env.TOKEN);

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
/*
socket.on("you", (me) => {  
  console.log("[YOU]", { me });  
});  
  
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
});  
  

//calculate parcel decay time from sensing.

let myparcelreward = sensing.parcels[0].reward;
if(myparcelreward > 0) {
sensing.parcels[0].reward 





let lastTime = 0;
let currentTime = 0

let averageTime = 0;


socket.on("info", (info) => {  
    currentTime = info.ms;
    let averageTime = currentTime - lastTime;
    console.log("[average]", averageTime);
    lastTime = currentTime;socket


});






  
// Connection  
socket.on("connect", () => {  
  console.log("[CONNECTED] Socket ID:", socket.id);  
});  
  
socket.on("disconnect", () => {  
  console.log("[DISCONNECTED]");  
});


