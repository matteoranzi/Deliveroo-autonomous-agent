import 'dotenv/config';
import { DjsConnect } from "@unitn-asa/deliveroo-js-sdk/client";

console.log("HOST: " + process.env.HOST);
console.log("TOKEN: " + process.env.TOKEN);
const socket = DjsConnect(process.env.HOST, process.env.TOKEN);


async function myFn () {
    try {
        let up = await socket.emitMove('up');
        let right = await socket.emitMove('right');
    } catch (e) {
        console.log(e)
    }
}

myFn ()

socket.on( 'tile', (x, y, delivery) => {
    console.log(x, y, delivery)
} )