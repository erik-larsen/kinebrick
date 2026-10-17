# KineBrick architecture

How KineBrick works inside, for anyone changing the code. What it does, and how to use it, is in the [README](README.md).

## How it works

1. **Load.** `LDrawLoader` reads the model and the official LDraw parts library. Each part becomes its own 3D object that can be moved on its own.
2. **Assign roles.** Each part is looked up in KineBrick's role list (see [Part roles](#part-roles)). Parts not in the list are `structure`.
3. **Look up connection points.** Each part's connection points come from KineBrick's [connection table](#the-connection-table): where the part's holes, axles, pins and studs are, which way they point, how long they are, and what shape they are.
4. **Connect.** Connection points from different parts that line up become connections. An axle passing through a round hole becomes a *joint* (it can turn). An axle passing through an axle hole becomes a *rigid* connection (the parts turn together). A tyre sitting on its rim is rigid too. A stud sitting in an anti-stud (the socket under a brick or plate) attaches two parts as well. A pin through round holes in two parts is a joint between them: the parts turn on it. A piston in the bore of its cylinder is a *sliding* joint: it slides along the bore, and being round, turns in it too. A towball in a ball socket (where a connecting rod meets its piston) is a *ball* joint: it turns any way about the ball's centre.
5. **Check.** Every part should be attached to the rest of the model through some chain of connections. Parts that aren't get a red outline and a ⚠ badge, and are listed in the viewer, since they're usually in the wrong place: a brick half a stud off, sitting between the studs instead of on them, or floating above the plate.
6. **Group.** Parts that are rigidly connected (an axle in an axle hole, a tyre on a rim) or attached by studs move as one *body*. The body with the most `structure` parts is the *frame*. The simple car has three bodies: the frame (plate plus bricks), and two axles, each with its two rims and tyres locked onto it. The steering car's pivoting front axle carrier, a few bricks and plates of its own, is a separate body that turns on the frame.
7. **Solve.** Joints and ground contact become equations between the bodies' speeds. A joint says two bodies move together except for turning about its axis; a sliding joint also lets them slide along it, and a ball joint lets them turn any way about its centre. Two meshing gears say their teeth move at the same speed where they touch, so their speeds are in the ratio of their tooth counts; that works the same for spur gears side by side and bevel gears at an angle. A part the user has frozen says its body doesn't turn. A tyre on the ground says the point touching the ground doesn't move, so the tyre rolls without slipping. The ground is level with the lowest tyre; a model with no tyres has no means of locomotion, so its frame stays put, as if standing on a table. Whatever motion the equations leave free is what the user can drive. If no motion is left free, the mechanism is jammed. [The solver](#the-solver) explains how.
8. **Animate.** The user drags a part (see [Drags](#drags)); the solver works out how every body moves, in small steps; the viewer moves each body's parts. After each step, KineBrick checks whether any two parts have started to pass through each other; if so, it undoes the step and the drag stops there, like a steering wheel turned until the front tyres meet the chassis. It only checks parts that aren't directly connected (an axle in a hole, a tyre on its rim and meshing gear teeth all touch legitimately) and that don't already touch when the model loads. The shapes are the parts' own LDraw meshes, tested with [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh). Shifting a gearbox changes what's connected to what, so when a driving ring clicks into a new position, KineBrick works the mechanism out afresh (steps 2 to 7) from where every part now is.

### Bodies and the frame

Treating every `structure` part as one frame only works while no group of structure parts moves against the rest. That stops being true with a steering front axle (M4) and suspension arms (M7). From M4, structure parts form bodies by how they're attached, through stud and rigid connections (already found for the check in step 5), and the frame is the largest of those bodies.

## The solver

Moving one part affects the others, but the solver doesn't pass motion along a chain from part to part ("the wheel pushes the axle, the axle turns the gear…"). It writes every connection down as a rule, then solves all the rules at once. Chaining only comes in at the very end, to place the bodies on screen. The code is in `src/kinematics.ts`.

1. **Work with bodies, not parts.** Parts locked together move as one (step 6 above), so the solver moves bodies. The simple car's 15 parts are 3 bodies: the frame, and two wheel-and-axle bodies.
2. **Describe motion with 6 numbers per body.** At any instant a body is spinning (3 numbers: about which axis, how fast) and moving (3 numbers: which way, how fast). From those six, the speed of any point on the body follows. With three bodies, the car's whole motion at that instant is 18 numbers, and the solver's job is to work out which sets of 18 numbers are allowed.
3. **Turn every connection into equations.** Each connection is a rule about those numbers, written as "this combination of numbers must equal zero":

   | Connection | Rule | Equations |
   |---|---|---|
   | Joint (an axle in a round hole, say) | Both bodies move together, except for turning about the axis | 5 |
   | Two gears meshing (spur, bevel or worm) | Where the teeth touch, both gears' teeth move at the same speed across the mesh | 1 |
   | Tyre on the ground | The point touching the ground doesn't move | 3 |
   | A frozen body that turns on a joint | It doesn't turn on that joint | 1 |
   | The frame, frozen or with no tyres on the ground | It doesn't move | 6 |

   The car gives 2 joints × 5 + 4 tyres × 3 = 22 equations in 18 unknowns. Some repeat each other: four tyres on one flat ground say much the same thing.
4. **Solve for what's left free.** The algebra-class method of eliminating unknowns one at a time (Gaussian elimination, here Gauss-Jordan) finds every motion that satisfies all the rules at once: the *free motions*. The simple car has exactly 1, rolling along its length with each wheel turning just the right amount. The gear train has 1, its three gears turning together at 1 : −1/3 : 1/5. The differential has 2, and a jammed mechanism, such as two gear paths that disagree, has 0. Solving everything together is what handles loops, repeated rules and jams; a chain would have to decide which part wins.
5. **Pick a motion and an amount.** When more than one motion is free, the drag decides which: the free motions are made orthonormal (independent, and of equal size), so mixing them by least squares gives the smallest overall motion that does what the drag asks. Turning a part prefers a motion that leaves the frame still, so turning the steering wheel doesn't also roll the car. Before the drag, holds remove the free motions it doesn't need (see [Drags](#drags)). The drag then says how far: a push picks the amount that brings the grab point closest to the pointer, and a turn the amount that turns the part's joint by the angle the pointer swept.
6. **Move in small steps, re-solving each time.** The equations depend on where things are: tyre contact points and axles move as the car rolls. So each move is split into small steps, at most 1 LDU or about 2 degrees each, and every step rebuilds the equations, re-solves, and moves a little.
7. **Place the bodies by chaining out from the frame.** Positions aren't stored per body. The solver stores the frame's position and one angle per joint, and places each body by starting from the frame and walking outward along a tree of joints: an axle body is the frame's position, turned by its joint's angle. So an axle can never drift out of its hole, however long the drag.
8. **Close the loops.** A closed loop of parts, like crank, connecting rod, piston, cylinder and back to the frame, has one more joint than the tree follows, and small steps would slowly let that joint drift apart. So after each step, KineBrick moves every body by the smallest amount that brings the loop's joints back together. (This arrives with M6.1.)
9. **Show it.** Each part on screen gets its body's position, so the plate and bricks move with the frame, and the axle, rims and tyres with their wheel body.

## The connection table

The connection table lists the connection points of every part KineBrick knows about. The viewer only reads the table; a script builds it from three sources:

1. **The LDraw parts library.** Parts are built from shared pieces of geometry called primitives, and the library says which primitives each part uses and where they sit. Many parts reuse the same primitives for the same features: a rim's centre is a copy of `axlehol5.dat`, a stud is a copy of `stud.dat`.
2. **The [LDCad shadow library](https://github.com/RolandMelkert/LDCadShadowLibrary).** LDCad is a LEGO CAD program, and its shadow library adds connection data to LDraw parts and primitives: each hole, axle, pin or stud with its position, direction, length and cross-section (round, axle-shaped, or a pin's ridges and collars). Data on a primitive carries into every part that uses it, so describing `axlehol5.dat` once covers every rim built from it. It's called a shadow library because its files mirror the LDraw library's folders and file names, and LDCad loads each one alongside the LDraw file of the same name, as if its lines were part of that file, without changing the official file.
3. **KineBrick's own corrections.** A short hand-written file adds what neither source covers: where a tyre sits on its rim, gear tooth counts, the teeth that lock a clutch gear to a driving ring and the positions the ring clicks into, the connection points of parts the shadow library doesn't describe (the engine crankshaft), and which bores a part may slide in. The shadow library marks most holes as ones an axle or pin could slide through, but KineBrick doesn't model what stops an axle sliding out (bushes, gears either side), so it only lets parts slide where the corrections say so: a piston in its cylinder. The script also measures each tyre's outer radius from its shape, since that sets how far it rolls per turn.

The table is committed to the repository so that changes to it can be reviewed. When the LDraw or shadow library updates, we rebuild it and check the diff. It covers every part used by the test models, and grows with each milestone's test models.

## Part roles

A role is a short label for what a part does in a mechanism. It tells KineBrick which connections the part makes and how it may move. Each part has exactly one role, and parts nobody has described yet get `structure`.

| Role | Examples | What it does |
|---|---|---|
| `structure` | bricks, plates, beams | Nothing on its own. Part of the frame. |
| `axle` | 3706 Technic Axle 6 | Locks into axle holes, turns freely in round holes. |
| `rim` | 3482 Wheel Rim 8 x 17.5 | Carries a tyre. Locks onto an axle through its axle hole. |
| `tyre` | 3483 Tyre 56 x 17; 3634 Tyre 10/130 x 17 (a bigger tyre for the same rim) | Locks onto the rim it sits on. Rolls on the ground without slipping. |
| `gear` | 3647, 4019, 3648, 3649 Technic Gear 8, 16, 24, 40 Tooth | Locks onto an axle through its axle hole. Meshes with a gear whose axle is parallel and exactly the two gears' pitch radii away (1.25 LDU per tooth). |
| `gear` (bevel) | 32270, 32269 Technic Gear 12, 20 Tooth Double Bevel; 6589 Technic Gear 12 Tooth Bevel | Bevel teeth lie on a 45 degree cone. Meshes with another bevel gear whose axle crosses its own, when the tips of their cones meet where the axles cross. Double bevel gears also mesh side by side, like spur gears. |
| `worm` | 4716 Technic Worm Gear 2L | Locks onto an axle through its axle hole. Meshes with a spur gear whose axle crosses its own at right angles, the two pitch radii apart (2 studs for a 24 tooth gear); each turn of the worm moves the gear on one tooth. Can't be driven from the gear: it locks. |
| `gear` (clutch) | 2471, 18946 Technic Gear 24, 16 Tooth with Clutch on Both Sides | Turns freely on an axle through its round hole. The clutch teeth on each face lock it to a driving ring pushed against them. |
| `driving ring` | 18947 Technic Transmission Driving Ring 3L | Locks onto the ridged axle joiner it slides on (18948), and clicks into three positions along it: the middle (neutral) and half a stud either way, where its teeth lock it to the clutch gear on that side. Dragging it shifts gear. |
| `pin` | 3673 Technic Pin | Joins two parts through round holes, and both turn on it. It turns with one of them, since which way a pin spins doesn't matter. |
| `friction pin` | 2780 Technic Pin with Friction and Slots | The same, but stiff: during a drag, KineBrick turns it only if nothing else can move. |
| `connecting rod` | 2852 Technic Engine Connecting Rod | Its big end turns on the crank's pin; its small end is a towball that sits in the piston's socket. |
| `piston` | 2851 Technic Engine Piston Round | Slides, and turns, in the bore of an engine cylinder (2850a Technic Engine Cylinder Head). Holds the connecting rod's towball. |
| `steering wheel` | 2819 Technic Steering Wheel Small | Locks onto an axle through its axle hole. Like `structure`, but the body it's on is named after it. |
| `differential` | 6573 Technic Differential with Gear 16 Tooth and 24 Tooth | Turns on the two output axles that pass into it. Carries a 16 and a 24 tooth gear ring outside, and a post inside for the middle (planet) bevel gear, which meshes with a bevel gear on each output. |

More roles arrive with each milestone: the rack, steering links, springs.

## Drags

What a drag does for the user is in the README's [Interaction](README.md#interaction) section. Underneath:

- **Push.** Each step works out, for every motion the mechanism allows, how far the grab point would move on screen, and picks the mix of motions that best closes the gap to the cursor (least squares), moving at most 1 LDU per step.
- **Turn.** The part turns like a knob, by the angle the cursor sweeps around its axle since the last pointer move (`src/turn.ts`). Close to the axle the turn is damped, so a short drag never gives a big turn. Seen side-on, where that doesn't work, it turns by how far the cursor moves along the way the grab point turns on screen.
- **Holds.** For the length of a drag, KineBrick holds still every part it can without stopping the drag, so that anything the drag doesn't need to move stays put. It tries the deepest parts of the mechanism first (a differential's planet gear before the differential), but never holds a part in a way that carries along the shaft it turns on, if that shaft could have stayed put (a clutch gear freewheeling on a gearbox's output shaft). Wheels on the ground are never held this way, since rolling is their job. Worms lock: a worm is held still during any drag that would drive it from its gear's side. These holds last only for the drag, are never shown, and are separate from the parts the user freezes (Alt-click), which stay frozen until unfrozen.
- **Shift.** At each click of a driving ring, every part's current placement becomes its new starting placement, and the mechanism is worked out afresh: new bodies, joints, collisions to watch, and readout. Frozen parts are unfrozen, since the bodies they refer to are gone.
- **Motor.** A part kept turning (Ctrl-click) is driven every frame like a turn drag, with its holds worked out afresh each frame.

## Testing

`npm test` runs the tests. They check the mechanism logic: given a test model, KineBrick finds the right bodies, joints and gear meshes, and moves them correctly. They run in Node with no browser; each loads a real model from `models/`, works out its mechanism, moves it, and checks the numbers.

| File | What it checks |
|---|---|
| `mechanism.test.ts` | The simple car splits into a frame and two wheel-and-axle bodies, with one turning joint per axle. |
| `attachment.test.ts` | Every test model is fully attached, and a misplaced brick is caught, sitting between the studs or floating above the plate. |
| `kinematics.test.ts` | The simple car stands on four tyres and can move exactly one way; its wheels turn by distance ÷ tyre radius, it stays on the ground, and it rolls back to where it started. With no tyres, the frame stays put and only the axles turn. |
| `gears.test.ts` | The 8, 24 and 40 tooth gear train turns at the right ratios, both ways. Rolling the geared car spins its extra axle the other way. Turning a wheel rolls the car one tyre circumference per turn. |
| `bevel.test.ts` | The right-angle drive turns 1:1. The differential has two free motions; the input drives the housing at a third; with the input frozen the outputs turn opposite ways; with one output frozen the housing turns half as far; a drag on the input keeps the outputs together; and freezing the input and one output jams it. |
| `worm.test.ts` | The worm meshes with its gear, turns it one tooth per turn, can be driven from the worm, and locks when driven from the gear. |
| `gearbox.test.ts` | The driving ring sits centred on its joiner with three places to click into. Neutral leaves the output still, first gear turns it a third as far as the input, second as far. The gearbox is fully attached in every position. |
| `steering.test.ts` | The steering car can move two ways, steer and roll. The steering wheel turns the front axle a third as far without moving the car. Going straight, the rear wheels turn the same; round a curve, the outer one rolls further. Pushing the car, or turning a rear wheel, leaves the steering alone. With a solid rear axle it can steer, but then can't roll. |
| `collisions.test.ts` | On simple boxes: parts apart move freely and are caught when they start to overlap; parts on the same body, connected parts, and parts touching at the start aren't watched. |
| `turn.test.ts` | The knob: it turns by the angle the pointer sweeps around the axle and keeps in step over full turns; it doesn't turn when the pointer is still; a short drag next to the axle gives a short turn; it turns the right way; and it gives up when the plane of turning is seen edge-on. |

What the tests don't cover, and is checked by hand in the browser instead:

- Anything on screen: hover, arrows and arcs, push drags, the motor, shifting, freeze outlines and badges, and the options.
- Re-reading the model in the viewer after a shift. The gearbox tests rebuild the mechanism with the ring moved, but not through `src/main.ts`.
- Collisions between the test models' real part shapes. Those need the parts' meshes, which only load in the browser, so clashes in the test models have been found by checking there.
- The script that builds the connection table, beyond what the model tests use of the table it builds.

Browser-level tests for these paths can come later.

## Conventions

- **Units.** LDraw units (LDU). 1 stud = 20 LDU, a brick is 24 LDU tall, a plate is 8 LDU.
- **Axes.** LDraw's own axes: −Y is up. The viewer flips the model when it displays it.
- **Spelling.** Part names follow LDraw, so `tyre`, not `tire`.

## Code map

| Path | What's in it |
|---|---|
| `models/` | Test models |
| `src/main.ts` | The viewer: model picker, loading, camera, readout, re-reading after a shift |
| `src/ldr.ts` | Reads the parts of an LDraw model file |
| `src/mechanism.ts` | Works out bodies and joints from the connection table ([How it works](#how-it-works), steps 2 to 6) |
| `src/kinematics.ts` | Works out the allowed motions and moves the bodies (step 7), and the holds of a drag |
| `src/shift.ts` | Finds the parts that slide into set positions (driving rings) and moves them |
| `src/collisions.ts` | Stops parts passing through each other |
| `src/interaction.ts` | Hover, press, drag, freeze, keep turning (see [Drags](#drags)) |
| `src/turn.ts` | How far to turn a part when the pointer moves, like a knob |
| `src/appearance.ts` | How parts look: fill colour (LEGO colours, or one per body), yellow glow for hover, outlines and badges for status |
| `src/outlines.ts` | Outlines drawn around parts after the scene renders |
| `src/jointAxes.ts` | Draws joint axes |
| `src/connections.ts` | What a connection point looks like in the table |
| `src/*.test.ts` | The tests (see [Testing](#testing)) |
| `scripts/build-connections.ts` | Builds the connection table (`npm run connections`) |
| `scripts/pack-models.ts` | Packs each test model with the LDraw parts it uses (`npm run pack`) |
| `packed/` | The packed models and part titles the viewer loads (generated, don't edit) |
| `data/connections.json` | The connection table (generated, don't edit) |
| `data/corrections.ldr` | KineBrick's own additions to the connection table |
| `data/roles.json` | Each part's role; parts not listed are `structure` |
