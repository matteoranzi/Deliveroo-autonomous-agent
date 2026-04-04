> **QUESTION**: In a BDI agent, should domain-specific algorithms (like a Sokoban solver) be implemented as capabilities (plans) or as part of the deliberation process?

BDI Agents and Built-in Capabilities

This is a fundamental question about the division between reasoning and capability in BDI architecture.
   
---                                                                                                                                                                                                                                                                                                              
The BDI Perspective

In a BDI agent:
- Beliefs — what the agent knows about the world (map, obstacle positions, goal)
- Desires — high-level goals (reach delivery tile)
- Intentions — committed plans to achieve desires

The BDI reasoning cycle selects which plan to execute, not how low-level actions work. The agent reasons about capabilities, not with raw physics.
                                                                                                                                                                                                                                                                                                                   
---                                                                                                                                                                                                                                                                                                              
The Right Analogy: Human Cognition

A human delivery worker doesn't re-derive mechanics every time they push a box. They have internalized motor skills — capabilities — that the deliberative mind calls upon. The deliberation is: "I need to push that crate left", not "let me compute force vectors".

BDI operates the same way:

Deliberation layer:  "Box is blocking path → adopt intention to clear it"                                                                                                                                                                                                                                        
Capability layer:    solve_obstacle_push(box, target_tile) → sequence of moves
                                                                                                                                                                                                                                                                                                                   
---
So: Algorithm as Capability is Correct

Putting the Sokoban-like solver in a capability/plan library is architecturally sound because:

| Concern                           | Answer                                                          |
|-----------------------------------|-----------------------------------------------------------------|
| Is it a belief?                   | No — it's procedural knowledge, not world state                 |
| Is it a desire?                   | No — it's a means, not a goal                                   |
| Is it an intention?               | Partially — it's a plan body, best encapsulated as a capability |
| Should deliberation re-derive it? | No — that would conflate meta-reasoning with execution          |

The agent's deliberative layer should reason at the level of "can I clear this path?" and invoke the solver as a black box. The solver returns either a sequence of actions or IMPOSSIBLE, which the agent uses to revise its intentions (try another route, abandon goal, ask for help).
                  
---                                                                                                                                                                                                                                                                                                              
Where BDI Reasoning Does Apply

The interesting BDI work happens around the solver, not inside it:

Belief update:   obstacle detected on intended path
Desire trigger:  still need to reach goal
Plan selection:                                                                                                                                                                                                                                                                                                  
- Plan A: find alternative route (no pushing needed)
- Plan B: invoke push_solver → if solvable, adopt sub-intention                                                                                                                                                                                                                                              
- Plan C: if both fail → drop intention, report failure                                                                                                                                                                                                                                                      
Intention revision: if push_solver returns IMPOSSIBLE → re-deliberate

This is means-end reasoning — a core BDI strength — applied over the capability, not replacing it.
                  
---
Rule of Thumb

▎ If a problem requires domain-specific algorithmic search (pathfinding, constraint solving, scheduling), it belongs in the plan/capability layer.
▎ The BDI deliberation layer handles which goals to pursue, which plans to select, and how to react to failure — not how to execute low-level computation.

Encoding the solver directly in the deliberation loop would blur the abstraction boundary and make the agent brittle — it would be re-planning at the wrong level of granularity.  