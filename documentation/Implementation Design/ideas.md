* In navigation path, consider spawning crates tiles as valid neighbors and once there, if the movement is not possible, recalculate navigation path based on new sensing information
* When following a navigation path, agent should pay attention to creates position in order to avoid to block its path and check better alternative between:
  * go around it
  * move it away from the path (how to implement the "move away from the path" behavior?)
  * chose a different path
  * 
---
* In multi-agent, share information (internal knowledge) via "shout" or "say" (check APIs).
