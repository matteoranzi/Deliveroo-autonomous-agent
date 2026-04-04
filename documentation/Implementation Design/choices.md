* Inizialmente inferire tick del server calcolando il delta time ottenuto dall'evento info (oggeto info.ms), per esempio
```NodeJS
let lastTime = 0;
let currentTime = 0

let deltaTime = 0;

socket.on("info", (info) => {  
currentTime = info.ms;
let deltaTime = currentTime - lastTime;
console.log("[average]", deltaTime);
lastTime = currentTime;socket;
});
```

**NB: These information can be found in "config" event

* Inferire il decaying time delle parcels: delta time calcolato monitorando quando un evento sensing informa la modifica del reward di un parcel già conosciuto
* L'agente parte con un planning naive alla ricerca di parcels, appena avrà inferito questi dati potrà implementare un planning più sofisticato
* Il decaying time è importante per capire se conviene raccogliere un parcel o meno, se il reward è troppo basso potrebbe essere più conveniente cercarne un altro

*  consider to choose also not the closer parcel delivery tile in case of a busy area of other Agents
