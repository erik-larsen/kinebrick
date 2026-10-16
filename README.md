# kinebrick

A web viewer that makes LEGO Technic models move. Load an LDraw model of a simple car, push the chassis, and the car rolls: the tyres turn against the ground, the rims and axles turn with them, and the bricks ride along. kinebrick works this out from the parts themselves, with no hand-made animation.

![The simple car test model: a black 4x8 plate with yellow Technic bricks on all four sides, two black axles through the side bricks, and four grey rims with black tyres](media/screenshot.jpeg)

## Status

Planning. Nothing runs yet. The first test model is [models/simple-car.ldr](models/simple-car.ldr).

## What kinebrick is, and isn't

- **It is** a mechanism inferrer. Each LEGO part gets a description of what it can do (an axle turns in a round hole, a tyre rolls on the ground). kinebrick reads where the parts sit in the model, decides how they connect, and solves how they move together.
- **It is** iterative. Part types are added one at a time, starting with the ones that move. A brick that only holds things together needs no special treatment: it moves with whatever it's attached to.
- **It isn't** a new 3D viewer. Rendering comes from [three.js](https://threejs.org) and its `LDrawLoader`.
- **It isn't** a general physics engine. Movement comes from the mechanism's geometry (kinematics). Forces, springs and mass come later, through an existing physics engine rather than our own.

## How it works

1. **Load.** `LDrawLoader` reads the model and the official LDraw parts library. Each part becomes its own 3D object that can be moved on its own.
2. **Assign roles.** Each part is looked up in kinebrick's role list (see [Part roles](#part-roles)). Parts not in the list are `structure`.
3. **Connect the moving parts.** LDraw parts are built from shared pieces of geometry called primitives, and some primitives mark connection points: a Technic brick's round holes are copies of `peghole.dat`, a rim's centre is a copy of `axlehol5.dat`. Where these primitives sit tells us where a part can connect and how. An axle passing through a round hole becomes a *joint* (it can turn). An axle passing through an axle hole becomes a *rigid* connection (the parts turn together). A tyre sitting on a rim is rigid too; no primitive marks that, so the `tyre` role supplies it.
4. **Group.** All `structure` parts together form one body, the *frame*. Every other part joins a body through its rigid connections. The test car has three bodies: the frame (plate plus bricks), and two axles, each with its two rims and tyres locked onto it.
5. **Solve.** Joints and ground contact become equations between the bodies' speeds. Whatever motion the equations leave free is what the user can drive. If no motion is left free, the mechanism is jammed.
6. **Animate.** The user pushes the model; the solver works out how every body moves; the viewer moves each body's parts.

Treating every `structure` part as one frame only works while no group of structure parts moves against the rest. That stops being true with steering knuckles (M4) and suspension arms (M6). By then kinebrick will need to know how structure parts attach to each other, for example through the stud connection data in the LDCad shadow library.

## Part roles

A role is a short label for what a part does in a mechanism. It tells kinebrick which connections the part makes and how it may move. Each part has exactly one role, and parts nobody has described yet get `structure`.

| Role | Examples | What it does |
|---|---|---|
| `structure` | bricks, plates, beams | Nothing on its own. Part of the frame. |
| `axle` | 3706 Technic Axle 6 | Locks into axle holes, turns freely in round holes. |
| `rim` | 3482 Wheel Rim 8 x 17.5 | Carries a tyre. Locks onto an axle through its axle hole. |
| `tyre` | 3483 Tyre 56 x 17 | Locks onto the rim it sits on. Rolls on the ground without slipping. |

More roles arrive with each milestone: gears, the differential, the rack, the worm gear, clutch gears, driving rings, pins, linkages, springs.

## Milestones

Each milestone ends with a model that moves correctly and a test that checks it.

| # | Milestone | Done when |
|---|---|---|
| M0 | Viewer and connection debug view | The test car loads. Each body is drawn in its own colour and each joint shows its axis. |
| M1 | Rolling car | Pushing either 1x4 brick of the test car rolls the car in the direction of the push, and all four wheels turn by the right amount (distance ÷ tyre radius). Straight line only. |
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

## Data sources and licenses

| Source | Used for | License |
|---|---|---|
| [LDraw parts library](https://library.ldraw.org) | Part shapes and connection primitives | CC BY 4.0 |
| [three.js](https://threejs.org) | Rendering and LDraw loading | MIT |
| [LDCad shadow library](https://github.com/RolandMelkert/LDCadShadowLibrary) | Possible later source of stud connection data (see [How it works](#how-it-works)) | CC BY-SA 4.0: anything derived from it must be shared under the same license |

## Prior art

- **[SR 3D Builder](https://wiki.ldraw.org/wiki/Sr3d).** Windows LEGO CAD that could animate gears, hinges and pistons. Discontinued, and its own website is gone, so this links to the LDraw wiki.
- **[LDCad](https://www.melkert.net/LDCad).** LEGO CAD whose animations are written by hand in Lua for each model.
- **[TechnicBrickPower gear calculator](https://www.eurobricks.com/forum/forums/topic/186656-new-technic-gear-ratio-calculator-tool).** Web tool that finds the gear trains in an LDraw file and shows their ratios. Gears only, and no live animation.
- **[yoff/LegoTechnicSimulation](https://github.com/yoff/LegoTechnicSimulation).** Python tool that finds bodies, joints and gear meshes in an LDraw file and exports them to Blender or MuJoCo. kinebrick borrows its approach of reading connection points from primitives. Its code can't be reused directly: it's Python, and it has no license.

## License

[MIT](LICENSE).
