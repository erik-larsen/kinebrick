# [KineBrick](https://erik-larsen.github.io/kinebrick/)

A web viewer that makes LEGO Technic models move. Load an LDraw model and drag its parts: push a car and it rolls, its tyres turning against the ground; turn its steering wheel and the front axle swings, and the car drives round a curve, a differential letting each rear wheel turn at its own speed. Gear trains turn at the right ratios, a worm drive locks when driven from its gear, a two-speed gearbox shifts when you slide its driving ring, and parts stop where they'd run into each other. Ctrl-click a part to keep it spinning like a motor, or Alt-click it to freeze it. KineBrick works all this out from the parts themselves, with no hand-made animation.

![The steering car test model, steered a little: a grey plate with yellow Technic bricks, a black steering wheel whose 8 tooth gear turns a 24 tooth gear on the pivoting front axle, a grey differential between the rear wheels, and four big black tyres on grey rims](media/screenshot.jpeg)

## Status

M6.2 works: a gear drives a rack, and closed loops of parts, such as an engine's crank, connecting rod and piston, stay together however long they run. Parts can't pass through each other. Thirteen test models, picked from a menu in the viewer, including a V8 engine from a real LEGO set:

- [Simple car](models/simple-car.ldr): drag the frame and it rolls along its length, its wheels turning by distance ÷ tyre radius; turn a tyre and the car rolls with it.
- [Geared car](models/geared-car.ldr): the same car with two 8 tooth gears inside, so rolling the car spins a second axle the other way.
- [Gear train](models/gear-train.ldr): 8, 24 and 40 tooth gears on a Technic brick. Turning any gear turns the others at the right ratios (the 40 tooth gear turns 1/5 as far as the 8 tooth gear).
- [Right-angle drive](models/right-angle.ldr): two 12 tooth double bevel gears meshing at a right angle, one on a horizontal axle and one on a vertical axle.
- [Differential](models/differential.ldr): a differential on a stand, driven by an 8 tooth gear. Turning the input turns both outputs together. Freeze the input (Alt-click it) and turning one output turns the other the opposite way.
- [Steering car](models/steering-car.ldr): a car whose front axle pivots in the middle, turned by a steering wheel through 8 and 24 tooth gears, with big tyres and the differential at the back. Turn the steering wheel, then push the car: it drives round a circle, every wheel at its own speed. The steering stops at about 20 degrees either way, where the front tyres meet the chassis.
- [Worm drive](models/worm-drive.ldr): a worm driving a 24 tooth gear, one tooth per turn of the worm. Turning the gear does nothing: a worm can't be driven from its gear.
- [Two-speed gearbox](models/gearbox.ldr): an input axle with 8 and 16 tooth gears, driving a 24 and a 16 tooth clutch gear that freewheel on the output shaft, with a driving ring between them. Slide the ring towards the 24 tooth gear for first gear (the output turns a third as far as the input), towards the 16 tooth gear for second (as far as the input), or to the middle for neutral (the output stays put).
- [Single-cylinder engine](models/engine.ldr): a crank on an axle drives a piston up and down its cylinder through a connecting rod. Turning the crank once moves the piston down its one-stud stroke and back; pushing the piston turns the crank, except at the top and bottom of its stroke.
- [Four-bar linkage](models/four-bar.ldr): four beams pinned in a loop on a Technic brick. The short crank turns all the way round, rocking the far beam to and fro through about 63 degrees.
- [Rack and pinion](models/rack-and-pinion.ldr): an 8 tooth gear on two 1x4 racks, which ride on a plate that slides along a row of tiles between rails. A quarter turn of the gear moves the rack 2 teeth; pushing the rack turns the gear. The rack travels 80 LDU either way, until the gear reaches the end of the teeth, its plate overhanging the tiles.
- [V8 engine (LEGO 8448)](models/8448-engine.ldr): the engine from LEGO set 8448, Super Street Sensation, as built in the LDraw Official Model Repository. Eight pistons in two banks run on a flat-plane crankshaft; turning the crankshaft, by its 24 tooth gear or its fan, takes all eight through their strokes.
- [Steering car, solid rear axle](models/steering-car-solid.ldr): the same car with one solid axle at the back. It rolls straight ahead, but once steered it jams, because the inner and outer rear wheels would have to roll different distances.

The viewer labels the part under the pointer, and can draw each body in its own colour, each joint's axis, and where each pair of gears meet (see [Options](#options)). Next is M6.3: Ackermann steering.

## What KineBrick is, and isn't

- **It is** a mechanism inferrer. Each LEGO part gets a description of what it can do (an axle turns in a round hole, a tyre rolls on the ground). KineBrick reads where the parts sit in the model, decides how they connect, and solves how they move together.
- **It is** iterative. Part types are added one at a time, starting with the ones that move. A brick that only holds things together needs no special treatment: it moves with whatever it's attached to.
- **It isn't** a new 3D viewer. Rendering comes from [three.js](https://threejs.org) and its `LDrawLoader`.
- **It isn't** a general physics engine. Movement comes from the mechanism's geometry (kinematics). Forces, springs and mass come later, through an existing physics engine rather than our own.

## How it works

KineBrick looks up each part's connection points (where its holes, axles, pins and studs are), finds the ones that line up, and groups parts that move together into bodies. Bodies are joined by joints: an axle turning in a hole, a beam turning on a pin, a piston sliding in its cylinder. Each joint, each pair of meshing gears and each tyre on the ground gives equations between the bodies' speeds, and whatever motion the equations leave free is what you can drive. When you drag a part, KineBrick moves the mechanism along that motion in small steps, and stops where two parts would run into each other.

The details, from the connection table and part roles to how a drag decides what to move, are in [ARCHITECTURE.md](ARCHITECTURE.md).

## Interaction

All manipulation happens directly in the 3D view, by dragging parts with the mouse or a finger. There are no dialogs for moving parts, and no free xyz gizmo: a part can only move the ways its mechanism allows, so the view only offers those.

1. **Hover.** The part under the cursor glows yellow, and the rest of its body (the parts that would move with it) glows faintly. A label shows the part's number, name, role and body, for example "3701 Technic Brick 1 x 4 with Holes · structure · frame".
2. **Press.** Pressing on a part fixes a grab point where the cursor touched it. The view shows how that point can move. Pressing a frame part shows an arrow for its straight-line motion (the car rolling). Pressing a part that spins on an axle (a gear, a crank, a tyre) shows an arc around the axle: dragging it turns the part, and everything connected follows. A tyre on the ground turns the same way, and the car rolls as it turns, so to push the car, grab the frame. The arc is measured against whatever the axle is mounted in, so it travels with a moving car and stays in step with the part. Pressing a part that moves some other way shows an arrow, and dragging it pushes it, like a frame part: a piston, a connecting rod, or the middle beam of a linkage, which turns and travels at once. Pressing a gearbox's driving ring shows an arrow along the shaft it slides on. A part that can't move shows no handle, and a brief cue says why: it's jammed, or it's part of a frame that stays put because the model has no means of locomotion (only wheels so far; tracks and legs would count too).
3. **Drag.** Pushing a frame part: as the cursor moves, the mechanism moves as far along its allowed motion as needed to bring the grab point as close to the cursor as it can get. Every body moves with it. Dragging either 1x4 brick of the test car rolls the car in the direction of the drag. Turning a part that spins on an axle: the part turns like a knob, by the angle the cursor sweeps around its axle, and everything connected follows. A cursor that stops moving stops the turn, even if the axle is still being carried along (the car rolling), and close to the axle the turn is damped, so a short drag never gives a big turn. Gearing can still make the rest of the model move further than the cursor: on the geared car, turning the small 8 tooth gear rolls the car about three times as far, the other way. Anything the drag doesn't need to move stays put: pushing a car leaves its steering alone, turning its steering wheel leaves the car where it is, and in neutral the gearbox's clutch gears spin freely while its output shaft stays still. Worms lock: turning the gear of a worm drive does nothing, as on the real thing. Pushing a piston turns the crank, except at the top and bottom of its stroke (dead centre), where pushing can't turn the crank and the drag stops; a real engine carries through on momentum, which waits for forces in M7. Turning the crank goes all the way round. Sliding a driving ring: the ring jumps to whichever of its positions is nearest to where the cursor has dragged it along the shaft, and that shifts gear. The mechanism is worked out afresh at each shift, so frozen parts are unfrozen.
4. **Release.** The model stays where it was left. Momentum waits for forces in M7.
5. **Freeze.** Alt-clicking (Option-clicking on a Mac) a part freezes its body: its parts get a cyan outline and the body a 📌 badge, like a grounded part in Fusion 360; Alt-clicking it again unfreezes it, and "Unfreeze all" unfreezes everything. A frozen part that turns on an axle stops turning; a frozen frame stops moving. This matters when a mechanism can move more than one way: a differential's two outputs can turn independently, so turning one alone leaves it open how the other and the housing share the motion. Freeze the input, and the other output must turn the opposite way.
6. **Keep turning.** Ctrl-clicking a part that spins on an axle keeps it turning on its own, like a motor, at a quarter turn a second relative to what its axle is mounted in: its body gets a green outline and a 🔄 badge, and the rest of the mechanism follows, as in a turn drag. Shift-Ctrl-clicking turns it the other way. Clicking any part of that body again the same way stops it; clicking it the other way (adding or dropping Shift) turns it round. One part turns at a time, so Ctrl-clicking another part moves the motor there. It pauses while you drag something else, keeps going through a gearbox shift, and stops for good when it can't go on: two parts would run into each other (the steering wheel turned until the front tyres meet the chassis), or a frozen part jams it. Reset stops it too. While it turns, the camera follows the model, so a car driving away stays in view; you can still orbit and zoom around it. A part that can't turn at all, such as the gear of a worm drive, or that doesn't spin on an axle, such as a connecting rod, doesn't start, and a brief cue says why.

While dragging, a small readout shows the numbers, so the motion can be checked by eye: how far the frame has moved and the size of the circle it's turning on, how far each body has turned, and how far each sliding part has moved. A wheel on the ground also shows how far it rolled ÷ its radius, which its turn should match. After a shift, the readout counts from zero again. Reset puts the model back as it was loaded, gearbox shifted back too.

Dragging on a part moves the mechanism; dragging on empty space turns the camera.

Each kind of information has its own channel, so they never fight: fill colour shows the parts' own LEGO colours (or, as an option, which body each part belongs to), a yellow glow shows what the pointer is on, and status gets an outline and a badge pinned to the part (📌 frozen in cyan, 🔄 kept turning in green, ⚠ loose in red). When a drag stops because two parts would run into each other, those two parts flash a red outline. Outlines show through other parts in a darker shade.

### Options

Three views for checking the mechanism are off unless you turn them on, with the checkboxes or in the address, so the published viewer shows the plain model:

- **Body colours** (`bodycolours`): each body in its own colour instead of the parts' LEGO colours, the frame grey.
- **Joint axes** (`axes`): each joint's axis as a thin pink rod.
- **Gear contacts** (`contacts`): a pink dot where each pair of gears' teeth meet.

For example, `?model=gearbox&option=bodycolours,axes,contacts` opens the gearbox with all three on. Switching model keeps them.

## Milestones

Each milestone ends with a model that moves correctly and a test that checks it.

| # | Milestone | Done when |
|---|---|---|
| M0 | Viewer and connection debug view | The test car loads. Each body is drawn in its own colour and each joint shows its axis. Hovering a part highlights it, tints its body, and labels it with its number, name, role and body. |
| M1 | Rolling car | Pressing a frame part of the test car shows an arrow along the car's length. Dragging either 1x4 brick rolls the car in the direction of the drag, and all four wheels turn by the right amount (distance ÷ tyre radius), shown in the readout. Straight line only. |
| M2 | Spur gears | Gear trains on parallel axles turn at the right ratios. Pushing the car can drive a gear train. Dragging any spinning part (a gear, a crank, a tyre) turns it along an arc about its axle, and the rest of the mechanism follows. |
| M3 | Bevel gears and differential | Right-angle drives work. A differential lets the two wheels on one axle turn at different speeds. |
| M4 | Steering | The front axle pivots in the middle, like a wagon's, turned by a gear on a steering column. Pushing the steered car makes it follow a curve, each wheel turning at its own speed; the rear wheels are on a differential. The same car with a solid rear axle jams when steered. |
| M4.5 | Collisions | Parts stop when they'd run into each other: the steering car's front wheels stop at the chassis, about 20 degrees either way. No part of any test model passes through another. |
| M5 | Worm gears, clutches, gearboxes | A worm turns its gear one tooth per turn and locks when driven from the gear. A two-speed gearbox shifts by sliding its driving ring: first gear turns the output a third as far as the input, second as far, and in neutral the output stays put. Clutches that slip under load wait for forces in M7. |
| M6 | Linkages | In three parts, below. These need sliding joints, ball joints, and closed loops of parts kept together. |
| M6.1 | Loops | A single-cylinder engine runs: turning its crank all the way round moves the piston up and down its cylinder, and pushing the piston turns the crank until dead centre. A four-bar linkage of beams on pins (a crank that turns all the way round, rocking a beam to and fro) moves through its full range. After many turns, no joint has drifted apart. |
| M6.2 | Rack and pinion | Turning a gear slides a rack along: a quarter turn of an 8 tooth gear moves the rack 2 teeth. Pushing the rack turns the gear. The racks ride on a plate sliding along tiles between rails, which may overhang them, and stop when the gear reaches the end of the teeth. |
| M6.3 | Ackermann steering | Rack and pinion steering, with steering links on ball joints to a steering arm at each front wheel. Each front wheel pivots on its own, the inside one turning further, so pushing the steered car makes every wheel roll round the same centre. |
| M7 | Forces | Springs, shock absorbers, suspension arms (which need springs to hold the car up; without them the frame's height is one more free motion), clutches that slip under load, and pushes or torques as input, through the MuJoCo physics engine. |

A car with two fixed axles can't turn without its tyres sliding sideways, which is why M1 is straight-line only and turning waits for steering in M4. Steering alone isn't enough either: in a turn the inside wheels travel a shorter path than the outside ones, so two wheels on one solid axle can't both roll without slipping. Real LEGO cars just scrub their tyres; KineBrick's tyres never slip, so the M4 car has a differential at the back and each front wheel spinning on its own stub axle.

### Later

- **Marching ants for loose parts.** A loose part's own edge lines drawn dashed and crawling, on top of its red outline. Motion draws the eye, and it would only appear when something's wrong.
- **Suggest a fix for a loose part.** For a part that isn't attached, find the nearest position where its anti-studs would land on studs, and suggest moving it there ("move 10 LDU along z to sit on the plate"). Suggest only; KineBrick doesn't edit models.
- **Clips and hinges.** The LDCad shadow library describes these with their own kinds of snap line, which KineBrick doesn't read yet, so a part held only by a clip or hinge is wrongly reported as loose.

## Getting started

You need [Node.js](https://nodejs.org) (which comes with `npm`).

1. Install the dependencies: `npm install`
2. Start the viewer: `npm run dev`, then open the address it prints. Pick a test model from the menu at the top left.

The viewer doesn't need the LDraw parts library: each test model is packed, with every part it uses, into one file in `packed/`. The libraries are only needed to rebuild the data after changing a test model (see below).

The project uses plain TypeScript, and [Vite](https://vite.dev) as its development server: Vite serves the code to the browser, converts TypeScript to JavaScript as it goes, and reloads the page whenever a file is saved.

Other commands:

- `npm test` runs the tests.
- `npm run build` builds the site into `dist/`. Every push to `main` builds and publishes it to GitHub Pages (see `.github/workflows/pages.yml`).
- `npm run data` rebuilds the [connection table](ARCHITECTURE.md#the-connection-table) and the packed models, after adding or changing a test model. It needs both libraries in the project folder (neither is committed):
  - the LDraw parts library: download [complete.zip](https://library.ldraw.org/library/updates/complete.zip) and unzip it, so you have `ldraw/parts`, `ldraw/p` and `ldraw/LDConfig.ldr`;
  - the LDCad shadow library: `git clone --depth 1 https://github.com/RolandMelkert/LDCadShadowLibrary.git ldcad-shadow`.

## Data sources and licenses

| Source | Used for | License |
|---|---|---|
| [LDraw parts library](https://library.ldraw.org) | Part shapes and connection primitives; the packed models in `packed/` include the parts they use | CC BY 4.0 |
| [three.js](https://threejs.org) | Rendering and LDraw loading | MIT |
| [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) | Fast tests of whether two parts' shapes overlap | MIT |
| [LDCad shadow library](https://github.com/RolandMelkert/LDCadShadowLibrary) | Connection points in the [connection table](ARCHITECTURE.md#the-connection-table) | CC BY-SA 4.0 |
| [LDraw Official Model Repository](https://library.ldraw.org/omr) | The V8 engine test model: "8448 - box5.ldr" by Orion Pobursky, flattened into one file (`models/8448-engine.ldr`) | CC BY 2.0 (CCAL 2.0) |

## Prior art

- **[SR 3D Builder](https://wiki.ldraw.org/wiki/Sr3d).** Windows LEGO CAD that could animate gears, hinges and pistons. Discontinued, and its own website is gone, so this links to the LDraw wiki.
- **[LDCad](https://www.melkert.net/LDCad).** LEGO CAD whose animations are written by hand in Lua for each model.
- **[TechnicBrickPower gear calculator](https://www.eurobricks.com/forum/forums/topic/186656-new-technic-gear-ratio-calculator-tool).** Web tool that finds the gear trains in an LDraw file and shows their ratios. Gears only, and no live animation.
- **[yoff/LegoTechnicSimulation](https://github.com/yoff/LegoTechnicSimulation).** Python tool that finds bodies, joints and gear meshes in an LDraw file and exports them to Blender or MuJoCo. Like KineBrick's connection table, it gets connection points from LDraw primitives. Its code can't be reused directly: it's Python, and it has no license.

## License

The code is [MIT](LICENSE). The connection table is derived from the LDCad shadow library, so it is shared under the same license, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). The V8 engine model is by Orion Pobursky, from the LDraw Official Model Repository, under [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/).
