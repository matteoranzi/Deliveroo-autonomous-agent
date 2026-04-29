* If users makes a move by hand (using the keyboard), then the agent doesn't properly update in time the position indexes
> Destination tile of current navigation path:  { x: 10, y: 24 } 
> file:///Users/matteoranzi/Documents/Universita%CC%80/_Magistrale/Autonomous%20Software%20Agents/Project/Deliveroo-autonomous-agent/src/sandbox/behaviour_tree.js:240
> (tile) => this.#sccMap[startTile.x][startTile.y] === this.#sccMap[tile.x][tile.y] 
> ^ TypeError: Cannot read properties of undefined (reading '24')

* sccMap index sometimes are wrong.

* Sensed Agents doesn't work properly.