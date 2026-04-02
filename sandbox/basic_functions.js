import 'dotenv/config';
import { DjsConnect } from "@unitn-asa/deliveroo-js-sdk/client";

console.log("HOST: " + process.env.HOST);
console.log("TOKEN: " + process.env.TOKEN);
const socket = DjsConnect(process.env.HOST, process.env.TOKEN);

let mapData = {
    width: 0,
    height: 0,
    tiles: [],
}

let mapMemory ={
    parcels: []
}



// Map information
socket.on("map", (width, height, tiles) => {
    console.log("[MAP]", { width, height, tiles });

    mapData.width = width;
    mapData.height = height;
    mapData.tiles = tiles;
});



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


