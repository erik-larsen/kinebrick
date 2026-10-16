# KineBrick

A web viewer that makes LEGO Technic models move. Load an LDraw model of a simple car, push the chassis, and the car rolls: the tyres turn against the ground, the rims and axles turn with them, and the bricks ride along. KineBrick works this out from the parts themselves, with no hand-made animation.

![The simple car test model: a black 4x8 plate with yellow Technic bricks on all four sides, two black axles through the side bricks, and four grey rims with black tyres](media/screenshot.jpeg)

## Status

M1 works: drag any part of the test car, [models/simple-car.ldr](models/simple-car.ldr), and it rolls along its length, its wheels turning by distance ÷ tyre radius. The viewer also draws each body in its own colour and each joint's axis, and labels the part under the pointer (M0). Next is M2, spur gears.

## What KineBrick is, and isn't

- **It is** a mechanism inferrer. Each LEGO part gets a description of what it can do (an axle turns in a round hole, a tyre rolls on the ground). KineBrick reads where the parts sit in the model, decides how they connect, and solves how they move together.
- **It is** iterative. Part types are added one at a time, starting with the ones that move. A brick that only holds things together needs no special treatment: it moves with whatever it's attached to.
- **It isn't** a new 3D viewer. Rendering comes from [three.js](https://threejs.org) and its `LDrawLoader`.
- **It isn't** a general physics engine. Movement comes from the mechanism's geometry (kinematics). Forces, springs and mass come later, through an existing physics engine rather than our own.

## How it works

1. **Load.** `LDrawLoader` reads the model and the official LDraw parts library. Each part becomes its own 3D object that can be moved on its own.
2. **Assign roles.** Each part is looked up in KineBrick's role list (see [Part roles](#part-roles)). Parts not in the list are `structure`.
3. **Look up connection points.** Each part's connection points come from KineBrick's [connection table](#the-connection-table): where the part's holes, axles, pins and studs are, which way they point, how long they are, and what shape they are.
4. **Connect.** Connection points from different parts that line up become connections. An axle passing through a round hole becomes a *joint* (it can turn). An axle passing through an axle hole becomes a *rigid* connection (the parts turn together). A tyre sitting on its rim is rigid too.
5. **Group.** All `structure` parts together form one body, the *frame*. Every other part joins a body through its rigid connections. The test car has three bodies: the frame (plate plus bricks), and two axles, each with its two rims and tyres locked onto it.
6. **Solve.** Joints and ground contact become equations between the bodies' speeds. A joint says two bodies move together except for turning about its axis. A tyre on the ground says the point touching the ground doesn't move, so the tyre rolls without slipping. The ground is level with the lowest tyre; if no tyre touches it, the frame is held still instead. Whatever motion the equations leave free is what the user can drive. If no motion is left free, the mechanism is jammed.
7. **Animate.** The user drags a part (see [Interaction](#interaction)); the solver works out how every body moves; the viewer moves each body's parts.

Treating every `structure` part as one frame only works while no group of structure parts moves against the rest. That stops being true with steering knuckles (M4) and suspension arms (M6). By then KineBrick will need to know how structure parts attach to each other. The connection table already lists studs, so the data will be there.

## The connection table

The connection table lists the connection points of every part KineBrick knows about. The viewer only reads the table; a script builds it from three sources:

1. **The LDraw parts library.** Parts are built from shared pieces of geometry called primitives, and the library says which primitives each part uses and where they sit. Many parts reuse the same primitives for the same features: a rim's centre is a copy of `axlehol5.dat`, a stud is a copy of `stud.dat`.
2. **The [LDCad shadow library](https://github.com/RolandMelkert/LDCadShadowLibrary).** LDCad is a LEGO CAD program, and its shadow library adds connection data to LDraw parts and primitives: each hole, axle, pin or stud with its position, direction, length and cross-section (round, axle-shaped, or a pin's ridges and collars). Data on a primitive carries into every part that uses it, so describing `axlehol5.dat` once covers every rim built from it. It's called a shadow library because its files mirror the LDraw library's folders and file names, and LDCad loads each one alongside the LDraw file of the same name, as if its lines were part of that file, without changing the official file.
3. **KineBrick's own corrections.** A short hand-written file adds what neither source covers: where a tyre sits on its rim, gear tooth counts, and whether a pin turns freely or holds by friction (the shadow library treats both kinds of pin the same). The script also measures each tyre's outer radius from its shape, since that sets how far it rolls per turn.

The table is committed to the repository so that changes to it can be reviewed. When the LDraw or shadow library updates, we rebuild it and check the diff. It only covers parts that matter for movement: parts with a role, and parts with Technic holes that axles and pins can go through. It grows with each milestone's test models.

## Part roles

A role is a short label for what a part does in a mechanism. It tells KineBrick which connections the part makes and how it may move. Each part has exactly one role, and parts nobody has described yet get `structure`.

| Role | Examples | What it does |
|---|---|---|
| `structure` | bricks, plates, beams | Nothing on its own. Part of the frame. |
| `axle` | 3706 Technic Axle 6 | Locks into axle holes, turns freely in round holes. |
| `rim` | 3482 Wheel Rim 8 x 17.5 | Carries a tyre. Locks onto an axle through its axle hole. |
| `tyre` | 3483 Tyre 56 x 17 | Locks onto the rim it sits on. Rolls on the ground without slipping. |

More roles arrive with each milestone: gears, the differential, the rack, the worm gear, clutch gears, driving rings, pins, linkages, springs.

## Interaction

All manipulation happens directly in the 3D view, by dragging parts with the mouse or a finger. There are no dialogs for moving parts, and no free xyz gizmo: a part can only move the ways its mechanism allows, so the view only offers those.

1. **Hover.** The part under the cursor is highlighted, and the rest of its body (the parts that would move with it) gets a faint tint. A label shows the part's number, name, role and body, for example "3701 Technic Brick 1 x 4 with Holes · structure · frame".
2. **Press.** Pressing on a part fixes a grab point where the cursor touched it. The view shows how that point can move: an arrow for a straight-line motion (the car rolling), an arc for a turning one (a crank). A part that can't move shows no handle, and a brief cue says it's jammed. A part that spins on an axle which is itself moving, such as a tyre of a rolling car, is grabbed by its axle: pressing the tyre pushes the car at that spot. (Every point on a rolling tyre loops through the air, so following the tyre's own surface would make the arrow tilt and turn as the wheel rolls.) A part on an axle that stays still, such as a gear in a fixed gearbox, turns when dragged.
3. **Drag.** As the cursor moves, the mechanism moves as far along its allowed motion as needed to bring the grab point as close to the cursor as it can get. Every body moves with it. Dragging either 1x4 brick of the test car rolls the car in the direction of the drag.
4. **Release.** The model stays where it was left. Momentum waits for forces in M7.

While dragging, a small readout shows the numbers, such as "moved 40 LDU · wheels 74°", so the motion can be checked by eye.

Dragging on a part moves the mechanism; dragging on empty space turns the camera.

## Milestones

Each milestone ends with a model that moves correctly and a test that checks it.

| # | Milestone | Done when |
|---|---|---|
| M0 | Viewer and connection debug view | The test car loads. Each body is drawn in its own colour and each joint shows its axis. Hovering a part highlights it, tints its body, and labels it with its number, name, role and body. |
| M1 | Rolling car | Pressing a frame part of the test car shows an arrow along the car's length. Dragging either 1x4 brick rolls the car in the direction of the drag, and all four wheels turn by the right amount (distance ÷ tyre radius), shown in the readout. Straight line only. |
| M2 | Spur gears | Gear trains on parallel axles turn at the right ratios. Pushing the car can drive a gear train. |
| M3 | Bevel gears and differential | Right-angle drives work. A differential lets the two wheels on one axle turn at different speeds. |
| M4 | Steering | Rack and pinion steering turns the front wheels, and the car follows a curve. |
| M5 | Worm gears, clutches, gearboxes | Connections that change while the model runs, such as shifting gears. |
| M6 | Linkages | Pistons, crankshafts and suspension arms move through their full range. |
| M7 | Forces | Springs, shock absorbers and pushes or torques as input, through the MuJoCo physics engine. |

A car with two fixed axles can't turn without its tyres sliding sideways, which is why M1 is straight-line only and turning waits for steering in M4.

## Conventions

- **Units.** LDraw units (LDU). 1 stud = 20 LDU, a brick is 24 LDU tall, a plate is 8 LDU.
- **Axes.** LDraw's own axes: −Y is up. The viewer flips the model when it displays it.
- **Spelling.** Part names follow LDraw, so `tyre`, not `tire`.

## Getting started

You need [Node.js](https://nodejs.org) (which comes with `npm`) and the LDraw parts library.

1. Download [complete.zip](https://library.ldraw.org/library/updates/complete.zip) from LDraw.org and unzip it into the project folder, so you have `ldraw/parts`, `ldraw/p` and `ldraw/LDConfig.ldr`. The `ldraw/` folder is not committed to git.
2. Install the dependencies: `npm install`
3. Start the viewer: `npm run dev`, then open the address it prints.

The project uses plain TypeScript, and [Vite](https://vite.dev) as its development server: Vite serves the code to the browser, converts TypeScript to JavaScript as it goes, and reloads the page whenever a file is saved.

Other commands:

- `npm test` runs the tests.
- `npm run connections` rebuilds the [connection table](#the-connection-table). It needs the LDCad shadow library in the project folder, in `ldcad-shadow/` (also not committed): `git clone --depth 1 https://github.com/RolandMelkert/LDCadShadowLibrary.git ldcad-shadow`

## Project layout

| Path | What's in it |
|---|---|
| `models/` | Test models |
| `src/main.ts` | The viewer: loading, camera, readout |
| `src/ldr.ts` | Reads the parts of an LDraw model file |
| `src/mechanism.ts` | Works out bodies and joints from the connection table ([How it works](#how-it-works), steps 2 to 5) |
| `src/mechanism.test.ts` | Tests for the above, using the test car |
| `src/kinematics.ts` | Works out the allowed motions and moves the bodies (step 6) |
| `src/kinematics.test.ts` | Tests for the above: the car rolls the right distance per wheel turn and stays on the ground |
| `src/interaction.ts` | Hover, press, drag (see [Interaction](#interaction)) |
| `src/appearance.ts` | Body colours and hover highlighting |
| `src/jointAxes.ts` | Draws joint axes |
| `src/connections.ts` | What a connection point looks like in the table |
| `scripts/build-connections.ts` | Builds the connection table |
| `data/connections.json` | The connection table (generated, don't edit) |
| `data/corrections.ldr` | KineBrick's own additions to the connection table |
| `data/roles.json` | Each part's role; parts not listed are `structure` |

## Data sources and licenses

| Source | Used for | License |
|---|---|---|
| [LDraw parts library](https://library.ldraw.org) | Part shapes and connection primitives | CC BY 4.0 |
| [three.js](https://threejs.org) | Rendering and LDraw loading | MIT |
| [LDCad shadow library](https://github.com/RolandMelkert/LDCadShadowLibrary) | Connection points in the [connection table](#the-connection-table) | CC BY-SA 4.0 |

## Prior art

- **[SR 3D Builder](https://wiki.ldraw.org/wiki/Sr3d).** Windows LEGO CAD that could animate gears, hinges and pistons. Discontinued, and its own website is gone, so this links to the LDraw wiki.
- **[LDCad](https://www.melkert.net/LDCad).** LEGO CAD whose animations are written by hand in Lua for each model.
- **[TechnicBrickPower gear calculator](https://www.eurobricks.com/forum/forums/topic/186656-new-technic-gear-ratio-calculator-tool).** Web tool that finds the gear trains in an LDraw file and shows their ratios. Gears only, and no live animation.
- **[yoff/LegoTechnicSimulation](https://github.com/yoff/LegoTechnicSimulation).** Python tool that finds bodies, joints and gear meshes in an LDraw file and exports them to Blender or MuJoCo. Like KineBrick's connection table, it gets connection points from LDraw primitives. Its code can't be reused directly: it's Python, and it has no license.

## License

The code is [MIT](LICENSE). The connection table is derived from the LDCad shadow library, so it is shared under the same license, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
