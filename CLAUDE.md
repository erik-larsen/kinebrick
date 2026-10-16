# Technic mechanism viewer — project brief

Web LDraw viewer that infers Technic mechanisms from part placement and animates them from user inputs (drag an axle, apply torque).

## Goal
Load a Technic model (e.g. car with gearbox, differential, rack & pinion steering) and have it move correctly. Domain-specific solver driven by per-part mechanical roles — not a general physics sim.

## Prior art (none covers this end to end)
- SR 3D Builder — Windows desktop CAD with gears/hinges/pistons/shocks animation. Discontinued.
- LDCad — animation via hand-written Lua per model; nothing inferred. Its shadow library has per-part snap/connection metadata (axle, pin, hole) — reuse it.
- TechnicBrickPower gear calculator (web, 2021) — infers gear trains from .ldr, shows ratios, predicts jamming. Gears only, kinematics only.
- github.com/yoff/LegoTechnicSimulation — Python, offline. LDraw → rigid units → revolute joints → gear mesh detection → Blender/MuJoCo export (gear meshes as joint equality constraints). Closest architecture; worth reading.

## Design split
1. Kinematics: gears, differentials, rack & pinion, worm, clutches, gearbox selectors. Linear velocity constraints over joint graph; differential = extra DOF. Linkages (steering, suspension, pistons) add nonlinear position solve.
2. Dynamics: springs/shocks, real force/torque input. Use MuJoCo built for WASM rather than writing a solver.

## Hardest part
Connection inference from LDraw transforms: axle-in-hole, friction vs frictionless pin, which gears mesh (centre distance + clocking), tolerances. Source connectivity from LDCad shadow library (or Studio connectivity data) instead of hand-authoring.

## Plan
1. Pick base web LDraw viewer + full parts library.
2. Connection layer from shadow-library snap data → rigid units + joints.
3. Gear-graph kinematic solver; drag input axle to spin a gearbox model. (≈ TechnicBrickPower scope, but live.)
4. Differentials, rack & pinion, worm, clutches, selectors.
5. Linkages (position solve).
6. Dynamics backend (MuJoCo WASM) for springs/shocks/force inputs.
7. Walk the parts catalog, tagging mechanical roles.

## Working rules
- Never run git commit or git push; stage and offer a commit message.
- Start answers with a concise solution summary; ask for files rather than speculate.
