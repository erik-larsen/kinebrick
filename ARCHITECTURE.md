# Kinebrick Viewer architecture

How Kinebrick works inside, for anyone changing the code. What it does, and how to use it, is in the [README](README.md).

Everything here is kinematics: how a mechanism can move, worked out from its geometry, with no masses or forces. That's version 1.0.

Forces (momentum, springs that spring, clutches that slip) are for version 2.0. It will hand the same bodies and joints to the [MuJoCo](https://mujoco.org) physics engine, rather than add physics of Kinebrick's own.

## How it works

From a model file to a mechanism you can drag, in eight steps:

| Step | What happens |
|---|---|
| 1. [Load](#1-load) | Read the model's parts, and the paths of anything flexible |
| 2. Assign roles | Look each part up in the [role list](#part-roles); parts not in it are `structure` |
| 3. Look up connection points | From the [connection table](#the-connection-table): where each part's holes, axles, pins and studs are, which way they point, how long they are, and their shapes |
| 4. [Connect](#4-connect) | Connection points that line up become connections and joints |
| 5. [Check](#5-check) | Find parts attached to nothing |
| 6. [Group](#6-group) | Rigidly connected parts become bodies |
| 7. [Solve](#7-solve) | Joints, gears and ground contact become equations; what they leave free is what can move |
| 8. [Animate](#8-animate) | Drags move the mechanism in small steps, stopping at collisions |

### 1. Load

`LDrawLoader` reads the model, packed into one file with every LDraw part it uses (see `packed/`). A model opened from your own computer is packed the same way in the browser, its parts fetched from an LDraw library online.

- **Each part becomes its own 3D object**, so it can be moved on its own.
- **Each kind of part is built once.** The loader means to build each kind once and copy it wherever the model places it. But asked for the same part many times at once, it starts building it every time, before the first build is there to copy. So Kinebrick has the first request build it and the rest copy it. (The 8880 Super Car's 140 kinds of part were built 1411 times over, most of its loading time.)
- **The mechanism comes first.** It's worked out before the shapes are built, since it needs only where the parts are. A string's shape, which isn't shown (see [the solver](#10-show-it)), is built from its first piece only, for its colour.
- **Progress.** While it loads, the panel says how far the download has got, then which step it's on.
- **Multi-part files (MPD)** are made of submodels. Kinebrick flattens them, placing each submodel's parts where the submodel puts them, and uses any unofficial parts the file brings with it.
- **A part whose role is `split`** is read as the parts its file is made of.

**Paths drawn by LDCad.** Something flexible the LDCad program drew along a path (a chain or track round its wheels, a rubber band, a string, a hose) comes as a submodel with:

- where the path runs: `0 !LDCAD PATH_POINT` lines, as circles round wheels (with their middles, axes and radii) and points it passes through;
- what it's made of: `PATH_SKIN`;
- the links or pieces LDCad placed along it, as parts (a chain's links) or shapes (a string's pieces). Some may be in a subpart of the path's submodel: LDCad puts links it gives a colour of their own there, as on the 42131 Cat D11's tracks.

Kinebrick keeps the path, and knows those parts as its links.

**Paths drawn by LSynth.** The LSynth program's paths, as the official model repository's files have them, come with nothing to say where they run: just their segments, one after another. They're a rope of `LS60` string segments, `LS51` hose segments or `LS70` cable segments, embedded in the file as `<set> - LS60.dat`.

- **A run of segments**, each within 6 LDU of the last, is a path whose links they are.
- **A rope's circles** are where it keeps turning the same way through at least 30 degrees, round a drum or over a pulley. Each is the circle that best fits the tightest stretch of the turn, since LSynth eases a rope into and out of each. On a drum it's wound round more than once, it's its whole turns.
- **A hose or cable** only shows where it runs.

**Chains placed link by link.** Older models in the official model repository place a chain's links (3711) one by one, as parts, with no path to say where it runs (the 8835 Forklift, the 8844 Helicopter).

- **A chain** is a run of links, each one's end within 4 LDU of the pin of the one before (16 LDU along it), in whatever order the file has them.
- **It's looped** if it closes up, or if its two ends are within two links of each other: the 8835 Forklift's chain is a link short, both its ends hooked to the carriage it lifts, which closes it. A chain left open further isn't a path.
- **Its circles** are where it keeps turning the same way, at least 10 degrees at each link (a chain placed by hand bends a little along its straight runs), through at least 30 degrees. Each is the circle that best fits the links turning at least two thirds as tightly as the tightest.
- **Each circle's radius** is how far the chain moves for a radian of the wheel's turning: 8 links of 16 LDU to a turn of a 16 tooth gear, 12 to a 24 tooth one, so the wheels it wraps turn at the ratio of their teeth.
- **Placed by hand,** its circles are only roughly round its wheels (see [chains and tracks](#rules-for-real-models)).

**Shapes drawn directly.** Shapes a submodel draws directly rather than with parts (hoses, springs and strings bent to fit, as CAD programs generate them, out of triangles or LDraw primitives such as cylinders) are drawn, moving with a part placed by the same submodel line. They take no part in the mechanism.

### 4. Connect

Connection points from different parts that line up become connections:

| What | Becomes |
|---|---|
| An axle through a round hole | A **joint**: it can turn |
| An axle through an axle hole | A **rigid** connection: the parts turn together |
| A tyre on its rim | Rigid |
| A stud in an anti-stud (the socket under a brick or plate) | Attached |
| The small pin under a 1-wide plate or tile, in a hollow stud (a tile running crosswise over Technic bricks, half a stud off the grid) | Attached |
| An axle stub fixed to a part (a connector's, a crankshaft's) | Goes into holes like an axle |
| A pin fixed to a part (a cross block's pins, a long pin's beyond its stop bush, an old steering arm's pivots), told from a stud by its collar or its springy tip | Goes into holes like a pin |
| An axle hole closed at one end, even with a thin round lip at its mouth | Takes an axle |
| A pin hole closed at one end (a panel's) | Takes a pin |
| A pin through round holes in two parts | A **joint** between them: the parts turn on it |
| A piston in the bore of its cylinder, or a plate resting on smooth tiles | A **sliding** joint |
| A towball in a ball socket (where a connecting rod meets its piston, or a steering link meets a steering arm) | A **ball** joint: it turns any way about the ball's centre |

How far a sliding joint goes:

- **A piston** slides along its bore for as long as the two still overlap by half a stud. Its skirt may come out of the bottom, as on a real engine. Being round, a real piston could also turn in its bore, but that can't be seen, so Kinebrick doesn't let it.
- **A plate** slides along its row of tiles for as long as it still overlaps them by a stud, overhanging the end. A plate on tiles could really slide any way across them; rails either side keep it in line, and Kinebrick takes them as read.

**Speed.** Only connection points whose boxes share a cube of a 40 LDU grid are compared, rather than every pair. That keeps finding a 1400 part model's connections to about a second.

#### Rules for real models

Real models need a few more rules, found by working through official sets.

**Tolerances.** Built models are rarely exact, so:

| What | Counts if within | Why (an official model) |
|---|---|---|
| Connection points line up | 2 degrees in direction, 1 LDU between axes | |
| Gears mesh | 2 LDU of exactly their pitch radii apart | Real teeth still engage that much off |
| A spur gear meshes with a crown gear | Anywhere over its band of teeth, 3.5 LDU of its pitch radius | A crane's boom drive has one 2 LDU out |
| Bevel gears mesh | Their cones' tips 3.5 LDU of where their axles cross, or their pitch circles 3.5 LDU of meeting where their cones touch | A car sets one of a pair 20 LDU from the crossing, the other at 17 |
| A ball sits in its socket | 2.5 LDU between their middles | A car seats its driveshaft's ball 1 LDU deeper into a wheel hub's socket (a bore), and its steering links reach 100 LDU between towballs 98 apart |
| A tyre touches the ground | 1 LDU of the lowest | |
| A loose part gets a second chance | 2 LDU | A helicopter's rotor linkage is built a little stretched, its levers' ends 1.8 and 1.2 LDU off their pins. (Not every part: a steering arm's two pin holes are 2 LDU apart, and a pin would catch both.) |

Some parts are moved onto a line or point:

- **Turning joints on parallel axes within 0.1 LDU of one line** are put on one line. An official tractor's two rear half axles are 0.02 LDU apart, and its hitch, hung on both, would otherwise be held fast.
- **A ball joint within 3 LDU of an axis one of its parts turns about** is put on that axis.
  - An official Unimog's driveshaft ends in a ball 0.23 LDU off its constant velocity joint's axis. As that joint turned, the ball went round with it, which the shaft couldn't follow: its drivetrain locked after a step.
  - The 42110 Land Rover draws its front suspension drooped a little too far, so its half shafts' balls sit 2 LDU off the steering hubs' axes. Its steering, which turns the wheels a little as it steers them, locked the same way.
  - No ball in the OMR sits between 2 and 15 LDU off such an axis: a crank's is a stud or more out.
- **Where two such axes cross at a ball**, one each side of a constant velocity joint, the ball is put where they cross, on both. An official Porsche 911 GT3 RS's steering column ends in a ball a hair off the axis of the shaft beyond it, and stopped a few degrees on.

**Studs in Technic holes.** A stud in a round Technic hole turns in it, like a pin: an old engine's piston turns on its connecting rod's stud.

**Clips and hinges** make turning joints:

- a clip (a universal joint's ends grip its centre's arms so) is a round hole;
- a hinge described by a cylinder (the old 2x5 hinge plates) is a pin and its hole;
- a finger hinge: a row of fingers on one part interleaved with another's (a cab's window shutters, hinge plates);
- a swivel hinge: the 1x4 swivel hinge plates, one half's thin pin in the other's hole.

Hinges hold the angle they're set at, as friction pins do (see [step 6](#6-group)): bodywork set at angles on them (a car's bumper corners, its seat backs and spoiler) stays put.

**Pins and bars in other sockets.**

- A pin's end holds in an anti-stud as a stud does (a 1 x 1 round tile on a half pin, a plate on a long pin's end).
- A bar, closed at one end (a beam's angled bar, a tile's bottom pin, a minifig's sword), goes into a pin's hollow or a bar hole, and turns in it.
- A round peg closed at one end and wider than a stud turns in a round socket its size: a turntable's two halves, a linear actuator's end in its bracket.
- A square one slides along a square socket its size: a rack with a beam under it, in its housing (a telescopic boom).

**Parts a set brings with it.** The OMR embeds parts that weren't in the LDraw library yet in the model's file, named `<set> - <part>.dat` (`42116 - 42924.dat`). Most are in the library now, so such a part is read as the library's, if Kinebrick knows nothing of its own name.

**Headlight bricks.** A hole that opens into an anti-stud (through a headlight brick from underneath) sits on a stud as any brick does.

**Guided racks.** A rack held by nothing but the gear it meshes with (a fork-lift's carriage riding up its mast) slides along its length past the gear, as if guided, like a plate on tiles.

- **Also guided:** a rack that could still move with its gear held still, and everything the gear's shaft turns in held still with it (a steering rack on tie rods, which in the real model slides in a channel of bricks).
- **Not guided:** one whose linkage already sets its path (a tie bar fixed to the tops of two turntables, which moves on an arc), since a straight guide would jam it.
- **Not guided either:** one that moves only as the shaft's other mounts move round it (the 8849 Tractor's front axle rocks on its steering shaft, taking the rack with it).

**Strings.** A path that isn't looped (a crane's rope) is a string:

- **wound on a drum** at its start, if its first circle is on a wheel;
- **then over the pulleys** after that (its other circles on wheels);
- **and tied at its end** to the part nearest there.

A circle on no wheel, round something attached near its middle (within 15 LDU of its edge, and not the drum), is a **guide** the string slides over: LSynth runs a crane's rope over a cross block at its boom tip.

What hangs on a string, and so isn't loose:

- **A group of parts attached to nothing else, with one of the string's pulleys among them** (a crane's hook block).
- **One tied to its end, if the string hangs down to it** (within 30 degrees of straight down, from 20 LDU before the end; the turns of a knot there don't count as pulleys), as LSynth's cranes hang their hooks. It hangs beneath the last circle before it, as it did at the start.

A string that goes round no wheel, or is tied to something attached to nothing that doesn't hang on it (a tow truck's cable run out level to its hook), moves nothing and is left out.

**Grooves.** A plate slid edge first into a groove is held there: one of its anti-studs lies in the groove, the plate facing across it. (The bucket of an official bulldozer is two plates slotted into a pair of tipper ends.) The corrections describe each groove as a box in its part's coordinates.

**Plates on edge.** A plate standing on its edge between two rows of studs is held there: a plate is 8 LDU thick, just the gap between neighbouring studs.

**Between four studs.** A part with a single round opening underneath, centred between four studs, grips them: a classic way to set a part half a stud off the grid.

- The opening is a 1x1 round plate's or brick's anti-stud, or the open end of a Technic connector's axle hole.
- Examples: a crane's outrigger legs on their pads, the two connectors a bulldozer's bucket is wedged on.
- It works at any angle: the four studs point the way the opening does, at its level, each 14.1 LDU (half a stud's diagonal) off its axis.
- A Technic bush standing on end between four studs grips them too, as a 2 x 2 brick's tube does (the 858 Auto Engines' round caps). Only a bush that would otherwise be loose: one on an axle that turns in a Technic plate's hole may sit between its studs as well, and mustn't hold the axle still.

**On an axle's tip.** A part that would otherwise be loose, its axle hole lined up with an axle's tip and starting right there, is pushed on that axle. Real parts give a little, so a builder may press a part on an axle already filled by others, where in LDraw it can only sit against its tip (the 858 Auto Engines' fans, two round plates on an axle pin past the bush their rubber band runs in).

**On tiles.** A part held by nothing but smooth tiles under it slides along them, since nothing grips a tile from above (a crane's outriggers slide out on tiles), as long as it overlaps them by a stud.

- A part attached some other way is left to that: a tile would let it slide any way, so a slide along the tile could jam it.
- Slides between the same two bodies on parallel lines (an outrigger on two rows of tiles side by side) are one joint, which travels as far as any of its rows allows.

**Four-bar couplers.** A part pinned to two arms that turn on one body, all on parallel axes (a steering rack pinned to both steering arms), is the coupler of a four-bar linkage, which sets its path: a curve, as the arms swing. So it isn't also slid straight on that body or on the frame, by tiles under it or as a guided rack: the two together would only fit as the model was built. (The 8841 Dune Buggy's and the 8063 Tractor's steering jammed a step from the start.)

**Guided pistons.** A piston with no cylinder part of its own (the old 2x2 piston block, whose cylinder is a square of bricks) slides along its own axis against the nearest part it isn't fixed to.

**Universal joints.** As a cross on two hinges, a universal joint would lock solid if the model's shafts missed its middle by a fraction of an LDU, as built models do.

- **So the cross is fixed to one end**, and instead the two shafts turn at the same rate and their ends stay together: a *coupling*, in the solver.
- **Where both shafts turn in the same part** (a steering column's, in the frame), that part keeps their ends together already, so only their turning is tied. As an equation, their ends staying together would come out a hair's breadth from what the frame does (parts in an LDraw file are placed only so precisely), and stop some other motion altogether: the 8880 Super Car couldn't go round a corner.
- **A double universal joint's** short middle shaft turns about the line through their middles.
- **A grooved ball (2907)** on the end of a driveshaft, in a wheel hub's socket (2999), is a coupling too. Ridges in the socket fit its grooves, so the hub turns with the shaft at any angle, as a constant velocity joint does, and steered wheels are driven through it. It ties only their turning: the shaft and the hub are each held in place by their own joints, and the hub's steering pivot may miss the ball's middle a little, as the LDraw shapes have it.
- **A later constant velocity joint's nudged ball (32494)** ties their turning the same way, its nudges fitting slots in the socket of a portal axle's steering hub (92909) or a joint's female half (92906). It ties them about the hub's axis: that of its holes through the socket, as a sphere has no axis of its own. Its ball joint is kept as well, since its shaft often hangs on nothing else (a half shaft with a universal joint at its other end).
- **Each shaft's turning is measured in what it turns in nearest the frame.** A driveshaft turns in the frame and in its differential's side gear alike.

**Shock absorbers.** A shock absorber's rod is fixed in its cylinder: its spring holds it at the length it was built at, so a car sits on its suspension. Springs, like everything to do with forces, wait for version 2.0.

**Linear actuators.** A linear actuator is three parts: its body, an input at its back end, and a piston that a screw inside drives in and out of its front end as the input turns. Built separately or as one of the LDraw library's shortcuts (read as its pieces: see `split`), each is found by its body, with the input and piston on the body's axis. Whatever their shapes connect them by (the piston's rod sits in the body's bore like a stud in a hole) gives way to:

- **the input turning in the body;**
- **the piston sliding in the body,** from where its head is in the library's contracted shortcut to where it is in the extended one;
- **a screw between them:** the piston goes one lead along the axis for each turn of the input, relative to the body.

| Actuator | Stroke | Lead (LDU per turn) | From builders' measurements |
|---|---|---|---|
| Small (92693c01) | 60 LDU (3 studs) | 3.02 | 7160 degrees, 19.9 turns, end to end |
| Large (62271c01) | 100 LDU (5 studs) | 3.73 | 9649 degrees, 26.8 turns |
| Extra large (u9487c01) | 160 LDU (8 studs) | 3.66 | 43.75 turns |
| Large, later type (u9559c01) | 100 LDU | 3.66 | none: it shares the extra large one's base, so taken to be geared alike |

Like a worm, the screw can't be driven from its piston (see [Holds](#holds)): pushing what the piston moves doesn't turn the input. Its input, 47157, also comes on the 9V geared motor, where it holds its axle still, so it stays on the [list of parts that don't move yet](#parts-that-dont-move-yet), but the viewer doesn't list it where it's an actuator's input.

**Motors.** A motor's output, its axle hole (on the old 4.5V and 9V motors, an axle stub), turns in the motor: an axle in it, and the gears on that, turn in the motor rather than being fixed to it and to whatever it's built into. It turns stiffly, as a friction pin's joint does: a drag holds it, as the motor's gearbox does, unless nothing else can move (see [Holds](#holds)). Keeping a gear on it turning (see [Motor](#motor)) runs the motor. Each LDraw shortcut for a whole motor is one part, so its output's bush isn't drawn turning. Motors whose case has axle holes of its own besides the output (the Mindstorms EV3 motors, the old 4.5V motor with its gearbox) aren't given the role yet.

**Bushes in Technic plates.** A Technic plate's holes are counterbored 4 LDU deep for a bush's flange (a brick's only 2). So a bush pushed at least 3 LDU into one grips the plate, which turns with the bush's axle: an old helicopter's rotors are Technic plates driven so.

**Sliding on axles.** A part turning on an axle may slide along it too, as far as the parts either side of it on the axle let it, when a linkage works it that way. That is, its body turns on another body about an axis across the axle, in a closed loop of joints back to the axle. (An old helicopter's swashplate, raised and lowered on its rotor shaft by the pilot's levers, tilts the blades through their pitch links.)

- **Parts stacked against it** that turn on the axle too ride along with it, turning against it (the swashplate's top half, which turns with the rotor while the bottom one doesn't).
- **What stays put along its axle:** a connecting rod on a crank, which swings across its axle; the frame's holes; other parts held on the axle in several places; and other parts generally, held there by their neighbours or by friction.

**Resting parts.** Kinebrick has no gravity, so a part that only rests on another is kept touching whatever is highest under it, as its weight would keep it (`restingParts`). Both kinds are in the 858 inline engine's valve train:

- **A push rod:** an upright axle with bushes on it and nothing else, turning in round holes in one other body, standing by its bottom bush on a shaft that turns across it below. It rests on the highest of that shaft's cylinders under its foot (the camshaft's pins, or the camshaft itself between them), or by a bush higher up on the hole under it. Its holes become slides that turn, so pins lift it as they come round under it, and it drops back after them.
- **A rocker:** a part turning on an axle across a push rod, whose underside lies on the rod's top bush. It rests on the rod, or on whatever studs are under its parts' undersides, whichever is higher: when the rod drops, a valve's rocker comes down on the plate the rod stands through.
- **Only where built resting:** the rod (and the rocker) must be built touching what it rests on, to within an LDU. A part built a little into a flat thing it rests on (the rockers, 1.6 LDU into the studs under them) rests where it's built: that's taken as much lower.

**Decoration** connects to nothing that matters; each piece moves with the part whose connection point is nearest:

- stickers (the parts the LDraw library calls stickers);
- flexible sections (the segments of ribbed hoses and cables), and the other segments real sets draw their cables and hoses with;
- the old pneumatic hoses used for exhausts and cables.

**Chains and tracks.** A path's links (role `path`) only show where it runs: their own pins connect to nothing, and each moves with the part nearest it, like decoration. Its caps (a cable's plugs, or the receiver it comes out of) are parts in their own right, and connect as any part does.

A looped path (a chain, a track, a rubber band) goes round wheels:

- **Which circles are on wheels.** A circle of the path whose middle a turning joint's axis runs through, along the circle's axis, is on a wheel. The wheel is the joint's body with a part on that axis nearest the circle's middle along it (a 40 tooth gear a track runs round, or an axle a winch's string is wound on).
- **A chain placed link by link** is only roughly round its wheels: its circle is on the wheel whose axis passes within 2 LDU of its middle (the 8835 Forklift's are 0.7 LDU off its sprockets), and is moved onto that axis.
- **What it turns in.** It turns in the joint's other body. Of its joints on that axis, it's the one in what's nearest the frame: a gearbox's output shaft turns in the frame and in the clutch gears freewheeling on it, and it's how it turns in the frame that drives its chain.
- **A circle on nothing that turns** (a peg a rubber band is hooked round) is left out: the band slides round it.
- **A rubber band** is drawn afresh round where its circles are now. One whose circles don't lie in one plane keeps the pieces LDCad drew it with, and they move with the first thing it's hooked round (the 855 Mobile Crane's, on its cab, slews with it).
- **A track's links** (those [the corrections](#the-connection-table) give a depth) reach a little beyond the path, so under each of its wheels it touches the ground like a tyre that reaches as far.

### 5. Check

Every part should be attached to the rest of the model through some chain of connections.

- **Parts that aren't** get a red outline and a ⚠ badge, and are listed in the viewer. They're usually in the wrong place: a brick half a stud off, sitting between the studs instead of on them, or floating above the plate.
- **Loose parts still ride along with the model.** Each group of them attached to each other is fixed to the part with the connection point nearest to one of them, preferring a part of the same submodel.
- **Why ride along:** left where they were, they'd stand in the way of everything moving past them. (An official bulldozer's bucket plates, before Kinebrick knew its tipper ends' grooves, stopped its tracks.)

### 6. Group

Parts that are rigidly connected (an axle in an axle hole, a tyre on a rim) or attached by studs move as one *body*. The body with the most `structure` parts is the *frame*.

- **The simple car** has three bodies: the frame (plate plus bricks), and two axles, each with its two rims and tyres locked onto it.
- **The steering car's** pivoting front axle carrier, a few bricks and plates of its own, is a separate body that turns on the frame.
- **Two parts pinned together at two places**, on different axes, can't turn on either, so they're one body too (the engine's cylinder head, pinned to the frame).
- **Parts joined by friction pins** are one body as well, if the model can still move that way: friction holds a structure together (the V8's engine block, cylinder banks and intake). If the model couldn't move at all with its friction pins held, they're its only way to move (a linkage built on friction pins), so they stay joints, stiff ones.

### 7. Solve

Joints and ground contact become equations between the bodies' speeds. [The solver](#the-solver) explains how.

| What | Equation |
|---|---|
| A turning joint | Two bodies move together, except for turning about its axis |
| A sliding joint | Also lets them slide along it |
| A ball joint | Lets them turn any way about its centre |
| Two meshing gears | Their teeth move at the same speed where they touch, so their speeds are in the ratio of their tooth counts. The same for spur gears side by side, bevel gears at an angle, and a gear on a rack |
| A part resting on others (a push rod on a camshaft) | Where it touches the highest of them, it moves as that does, towards it: it neither lifts off nor sinks in |
| A part the user has frozen | Its body doesn't turn |
| A tyre on the ground | The point touching the ground doesn't move up or down, or along the way the tyre rolls, so it rolls without slipping. Sideways it may scrub a little, as real tyres do |

- **Tyres on one body**, such as the two on a solid axle with no differential, roll without slipping only on average. Going round a bend, the axle turns both alike though the outer one travels further, so one skids back and the other forward, as on a real car. Held to rolling exactly, a steered car with a solid axle couldn't roll at all.
- **The ground** is level with the lowest tyre. A model with no tyres has no means of locomotion, so its frame stays put, as if standing on a table.
- **Whatever motion the equations leave free** is what the user can drive. If no motion is left free, the mechanism is jammed.

### 8. Animate

The user drags a part (see [Drags](#drags)); the solver works out how every body moves, in small steps; the viewer moves each body's parts.

**Collisions.** After each step, Kinebrick checks whether any two parts have started to pass through each other. If so, it undoes the step and the drag stops there, like a steering wheel turned until the front tyres meet the chassis.

**The ground.** The same goes for a part that would go below the ground (a crane's hook let down too far).

- It's checked by the box round each part, and where that reaches below the ground, by the part's own shape. A box turned with its part reaches further: a big wheel's rim, turned an eighth of a turn, would seem to reach below its tyre.
- Parts that reach the ground when the model loads (tyres, outrigger pads) aren't checked.

**Pairs that aren't checked:**

- parts directly connected (an axle in a hole, a tyre on its rim and meshing gear teeth all touch legitimately);
- any two gears: Kinebrick doesn't know where each gear's teeth are round it, so two gears coming into mesh would seem to run into each other tip to tip, short of it (the 952 Tractor's harrow, lowered onto its power take-off, stopped 3 LDU short, its gears not quite meshing);
- parts on the same pin or axle (two beams on one pin lie face to face);
- parts that already touch when the model loads;
- parts within an LDU of each other when the model loads: real models are built tight, and a bush built flush against a brick just rubs past it as the wheel steers.

Each shape is pulled in a quarter of an LDU at each face of its box, so parts that merely touch, such as a beam sliding across the flush head of a pin, don't count.

**Speed.** Pairs are checked by the bodies they're on. Parts on two bodies that haven't moved against each other since last found clear can't have started to overlap, so all their pairs are skipped at once, and a box round each body's parts skips most of the rest. The shapes are the parts' own LDraw meshes, tested with [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh).

**Shifting.** Shifting a gearbox changes what's connected to what, so when a driving ring clicks into a new position, Kinebrick works the mechanism out afresh (steps 2 to 7) from where every part now is.

### Bodies and the frame

Treating every `structure` part as one frame only works while no group of structure parts moves against the rest. That stops being true with a steering front axle (M4), linkages (M6) and suspension arms.

From M4, structure parts form bodies by how they're attached, through stud and rigid connections (already found for the check in step 5), and the frame is the largest of those bodies.

## The solver

Moving one part affects the others, but the solver doesn't pass motion along a chain from part to part ("the wheel pushes the axle, the axle turns the gear…"). Instead:

- it writes every connection down as a rule;
- then solves all the rules at once;
- and chains only at the very end, to place the bodies on screen.

The code is in `src/kinematics.ts`.

| Step | In short |
|---|---|
| 1. Bodies, not parts | Parts locked together move as one |
| 2. 6 numbers per body | How each body spins and moves, at this instant |
| 3. [Connections become equations](#3-connections-become-equations) | Each connection is a rule those numbers must keep |
| 4. [Solve for what's free](#4-solve-for-whats-free) | Every motion that keeps all the rules |
| 5. [Tyres scrub a little](#5-tyres-scrub-a-little) | Which of those the tyres allow |
| 6. [Pick a motion and an amount](#6-pick-a-motion-and-an-amount) | The one the drag asks for, and how far |
| 7. [Small steps](#7-small-steps) | Re-solve as the model moves, and stop at dead points |
| 8. [Place the bodies](#8-place-the-bodies) | Chain out from the frame along a tree of joints |
| 9. [Close the loops](#9-close-the-loops) | Pull back the joints the tree doesn't follow |
| 10. Show it | Move each part to its body's place |

### 1. Bodies, not parts

Parts locked together move as one ([step 6](#6-group) above), so the solver moves bodies. The simple car's 15 parts are 3 bodies: the frame, and two wheel-and-axle bodies.

### 2. 6 numbers per body

At any instant a body is:

- **spinning:** 3 numbers, about which axis and how fast;
- **moving:** 3 numbers, which way and how fast.

From those six, the speed of any point on the body follows. With three bodies, the car's whole motion at that instant is 18 numbers. The solver's job is to work out which sets of 18 numbers are allowed.

### 3. Connections become equations

Each connection is a rule about those numbers, written as "this combination of numbers must equal zero":

| Connection | Rule | Equations |
|---|---|---|
| Joint (an axle in a round hole, say) | Both bodies move together, except for turning about the axis | 5 |
| Two gears meshing (spur, bevel or worm), or a gear and a rack | Where the teeth touch, both gears' teeth move at the same speed across the mesh | 1 |
| Tyre on the ground | The point touching the ground doesn't move along the way the tyre rolls (sideways and up or down: see [step 5](#5-tyres-scrub-a-little)). Tyres on one body (a solid axle) get one rule between them: on average | 1 |
| A universal joint | Its two shafts turn at the same rate, each in its mount, and its two ends stay together | 4 |
| A grooved ball in a wheel hub, or a nudged ball in a steering hub | The driveshaft and the hub turn at the same rate, each in its mount (a nudged ball is a ball joint too) | 1 |
| Sliding joint (a piston in its bore) | Both bodies move together, except for sliding along the axis | 5 |
| A linear actuator's screw | Where the screw's thread meets the piston's nut, they move together across the thread, as a worm's thread and its gear's tooth do: the piston slides one lead for each turn of the input | 1 |
| A part that slides and turns on an axle (a swashplate) | Both bodies move together, except for sliding along the axis and turning about it | 4 |
| A part resting on others (a push rod on a camshaft's pins) | Where it touches whichever is highest under it now, both move at the same speed towards each other | 1 |
| Ball joint (a towball in its socket) | Both bodies move the same at the ball's centre | 3 |
| A body held only by a ball joint at each end (a steering link) | It turns about the line between the balls as the bodies at its ends do, on average. Nothing else would stop it spinning there, and nothing would make it. (Unless gears or a coupling turn it: a half shaft with a constant velocity joint's ball at each end, which turns its wheel's hub, isn't held so.) | 1 |
| A body held only by a turning joint and a ball on that joint's axis (a towball in a steering rack, its tie rod's socket on the ball) | It doesn't turn on that joint. Nothing would make it, and with nothing to stop it, any amount of that spin could be mixed into a motion (the 8448 Super Car's steering, once its tyres stood on the ground) | 1 |
| A frozen body that turns on a joint | It doesn't turn on that joint | 1 |
| The frame, frozen or with no tyres on the ground | It doesn't move | 6 |
| A chain, track or rubber band looped round wheels | Each wheel's rim moves at the loop's speed, relative to what the wheel turns in: wheels it goes round the same way turn the same way, at speeds in the inverse ratio of its radii round them | 1 per wheel after the first |
| A string | Its free length changes by just what its drum pays out: worked out from its layout (round each circle and straight between them) and how that changes as the bodies carrying its circles move | 1 |
| A pulley on a string | Its rim moves at the string's speed past it (what the drum pays out, less how fast the string up to it is getting longer), unless it shares its body with another of the string's pulleys (two pulleys side by side on one axle can't both: one slips) | 1 each |
| A hook hanging on a string | It stays beneath the middle of the two pulleys either side of its own, as it was at the start, and upright, turning with what it hangs from only about the vertical | 5 |
| A track on the ground | Under each of its wheels, like a tyre at the path's radius (the run along the ground moves at the path's speed), except that it skids sideways freely there, as a tracked vehicle does to turn. But its middle doesn't slide sideways: the average of its wheels' sideways speeds is 0 | 1 per wheel, and 1 |

The car gives 2 joints × 5 + 2 axles × 1 (each axle's two tyres share one rule) = 12 equations in 18 unknowns, plus the tyres' sideways and up-and-down rules, which [step 5](#5-tyres-scrub-a-little) applies.

### 4. Solve for what's free

The algebra-class method of eliminating unknowns one at a time (Gaussian elimination, here Gauss-Jordan) finds every motion that satisfies all the rules at once: the *free motions*.

- **Repeated rules.** A rule counts as already implied by the others when what's left of it after elimination is tiny (under a millionth). That matters for linkages: a flat four-bar moves only because some of its joints' rules repeat each other.
- **Rounding.** Each elimination uses the entry that's largest in both its row and its column, which keeps rounding errors small. Eliminating down one column at a time let them grow, on a car steered askew, until a repeated rule looked like a new one and the steering jammed.

How many free motions:

| Mechanism | Free motions |
|---|---|
| The simple car | 6: rolling along its length with each wheel turning just the right amount, sliding sideways, turning on the spot (each axle's tyres skidding opposite ways), and rising, pitching and rocking on its tyres. The next step rules out all but the first |
| The gear train | 1: its three gears turning together at 1 : −1/3 : 1/5 |
| The differential | 2 |
| A jammed mechanism, such as two gear paths that disagree | 0 |

Solving everything together is what handles loops, repeated rules and jams; a chain would have to decide which part wins.

### 5. Tyres scrub a little

Real steering only gets close to every wheel rolling round one centre, and real tyres scrub. So:

| Motion | Kept if |
|---|---|
| The tyres roll | It first takes on whatever mix of the non-rolling motions scrubs least; then what's left scrubs sideways by at most 2% of how far the tyres roll, over all the tyres on the ground together |
| The one way of rolling that scrubs least | It scrubs at most 10%, or as much as the model allows: `0 !KINEBRICK SCRUB [percent=16]` in its main file, or the Tyre scrub option |
| It leaves the frame where it is (steering a parked car) | Always, however much it scrubs: a car whose wheels sit off their steering pivots drags its tyres round, as a real one does |
| No tyre rolls, and the frame moves | No tyre scrubs at all: a car can't be pushed sideways |
| The frame rises or sinks over its tyres (a car moving on its suspension) | Its tyres scrub sideways no further than the frame rises or sinks over them, though none may rise or sink itself |

- **Suspension.** A car's arms swing its wheels out and in as they go up and down, and its frame tips. They often swing its wheels straight up and down as the model was built, scrubbing nothing, but a step on they don't: the 42000 Grand Prix Racer's wishbones jammed after one.
- **Why only the least-scrubbing way gets 10%.** A car whose front wheels turn alike, rather than the inner one further, needs more than 2% to roll at full lock (an official fork-lift truck's, at 2%, couldn't roll with its steering turned). But any other way to roll must still keep within 2%, or a steered car could also scrub its way straight on.

**Rising and sinking.** A tyre may also rise or sink, by at most 5% of how far it moves across the ground. A wheel steered on a pivot that leans a little (an official go-kart's lean 1.4 degrees) rises or sinks a little as it turns, but an axle can't rock with the car standing still, pushing one tyre into the ground. Lift counts against 2% too, however much scrub is allowed.

**Setting the car back down.** Rolling, a car makes use of that little rise and sink to scrub less, and step after step it would add up: a car driven round in circles slowly tipped over. So after each step, unless the car is held still, the whole model is set back down on its tyres. It's moved as one, up or down and tipped about level directions, as little as puts each tyre back at the height it touched the ground at the start. Moving it all as one opens no joint.

How the test cars scrub:

| Car | Scrub |
|---|---|
| The steering car, with its pivoting front axle | None at all |
| The Ackermann car, its steering arms pointing at the middle of its rear axle | Well under 1% at full lock |
| The same car with its rear axle moved forward to half the wheelbase | More than 2% at full lock: allowed only 2%, it could steer there but not roll |

The readout shows how far each tyre has scrubbed.

### 6. Pick a motion and an amount

**Which motion.** When more than one motion is free, the drag decides which. The free motions are made orthonormal (independent, and of equal size), so mixing them by least squares gives the smallest overall motion that does what the drag asks.

How a turn measures how big a motion is:

- **By how fast the joints turn**, every joint, rather than by how fast every body moves. Measured by the bodies, a turn of a bulldozer's track would also nudge its bucket arm, which nothing holds, against the way the whole bulldozer turns, and step after step the arm drifted into the bulldozer.
- **Every way a joint turns counts:** a ball joint's turning each way, and a part's turning as it slides on an axle. Otherwise a part free to spin to no purpose (a steering rack in its round guide) would cost nothing.
- **What doesn't count:** a body with a position of its own (a crane's hook) moves only as it must, and the pulleys a string turns don't count either. How fast a sliding joint slides doesn't count: in LDU rather than radians, it would outweigh everything else.

What a turn prefers:

- **Turning a part prefers a motion that leaves the frame still**, so turning the steering wheel doesn't also roll the car.
- **Not a tyre on the ground:** turning one rolls the car. Where the suspension would let it steer its wheel round the tyre with the car standing still (the 8448 Super Car's front wheels, there being no springs yet), that way is left out, and the drag's holds are chosen as if only rolling could turn it.
- **Holds** remove the free motions the drag doesn't need, before it starts (see [Drags](#drags)).

**How far.** A push picks the amount that brings the grab point closest to the pointer, and a turn the amount that turns the part's joint by the angle the pointer swept.

### 7. Small steps

The equations depend on where things are: tyre contact points and axles move as the car rolls. So each move is split into small steps, at most 1 LDU or about 2 degrees each, and every step rebuilds the equations, re-solves, and moves a little.

**Dead points.** A turn stops short of a *dead point*: a linkage at the end of its reach, such as a steering arm whose tie rod has come into line with it, so the rack can't push it further round. There its joints would have to turn faster and faster, and a step past it can't be followed (the loops can't be closed again, or closing them would flip the linkage over). So a step isn't taken, and the turn stops there and won't go on that way:

- **if the fastest joint in a closed loop would turn more than half as fast again as in the step before**, for each turn of the joint being turned, as long as it turned no more than 10 degrees in the step before. (Other joints' rates may change for other reasons: a steered tractor's front wheels as it rolls and scrubs. And sampled more coarsely, an engine's connecting rods, geared up from a wheel the motor turns, swing faster and slower from step to step.)
- **if after it a joint is left apart**, or closing the loops had to wrench well away from where its motion was taking it (the step is undone). Not a resting part's joint: what it rests on may change in the step (a pin coming round under a push rod), and with it how fast it goes, as a dead point wouldn't.

Gears keep that rate steady, and linkages change it gently, except near a dead point. Without this, an official car's steering, turned past its dead point, flipped its front wheels over and let its rack slip against its gear.

**Play.** Real parts have a little play, and some loops of rigid parts are built to fit only where the model was built. An official race car hangs each front upright on two towballs 81 LDU apart from arms 80 apart; a step on, the loop is a hair out, so to the solver it can't move at all. So where nothing turns a joint exactly, the solver tries again letting the loops' joints come a little apart:

- **Which motion:** of the motions that keep every other rule (gears, holds, universal joints, and tyres rolling without scrubbing or lifting at all, so this never stands in for scrubbing more than allowed), the one that opens the loops least.
- **How far apart:** at most 1 LDU for each radian the joint turns. A beam on two pins half a stud apart would open 10 times that, so it stays put. Steps taken on it may leave the loops up to 0.1 LDU apart, rather than a thousandth.
- **What it gives:** the race car's suspension then turns half a radian, and an official hovercraft's rudder, tied to its other rudder twice over, a quarter. A loop opening faster than that, or a dead point, still stops a turn where it did.
- **Not while choosing holds:** play counts only when a drag turns, not when its holds are chosen. Counting it there kept holds a drag needed to let go of: an official concrete mixer truck's drivetrain, so that turning a wheel steered the truck instead of rolling it, and stopped partway round.

### 8. Place the bodies

Positions aren't stored per body. The solver stores the frame's position and one angle per turning joint, and places each body by starting from the frame and walking outward along a tree of turning joints: an axle body is the frame's position, turned by its joint's angle.

- **So an axle can never drift out of its hole**, however long the drag.
- **A body reached only through sliding and ball joints**, such as a piston, has a position of its own.

**The tree also keeps the solving small.** Rather than 6 numbers per body, steps 4 and 9 solve for 6 per body with a position of its own, plus 1 per joint in the tree (for the Auto Chassis, 58 numbers instead of 228). Every motion that keeps the tree's joints together is just the bodies with positions of their own moving and the tree's joints turning, so the tree's joints drop out of the equations: they always hold.

- **Orthonormal first.** Those numbers are first mixed into an orthonormal set (by Gram-Schmidt), so that the smallest motion in them is the smallest motion of the bodies too.
- **Faster.** Elimination costs grow with the cube of the numbers solved for, so this makes a step 4 to 9 times faster: a Go-Kart step went from 12 ms to under 2.
- **Mixed from the deepest bodies up.** A joint's number moves only the bodies beyond it, so each number is mixed only with those of the bodies beyond it, staying among those bodies.
- **Kept until the bodies move**, since a drag asks for the free motions many times at one place.

### 9. Close the loops

A closed loop of parts, like crank, connecting rod, piston, cylinder and back to the frame, has joints the tree doesn't follow: one per loop, and every sliding and ball joint. Small steps would slowly let those drift apart.

So after each step, Kinebrick works out how far each has come apart, and moves every body by the smallest amount that closes the gaps while keeping every other rule. It doesn't turn the joint a drag is turning, so that turns by exactly what the drag asked.

**When the rules can't all hold.** A model's rounded-off positions can make two rules that should repeat each other disagree slightly. Then it comes as close as it can, by least squares:

- **Every rule is scaled to the same size first.** Rules about turning would otherwise count for less than rules about moving, whose numbers (in LDU) run larger, and a single-cylinder engine's piston would tip a little further out of line at every step.
- **Rules that pass turning on** (gear meshes, universal joints, chains) **count a thousand times as much as the rest.** Being about speeds, a slip in them would never be undone, so where the rules can't all hold, a joint is left apart instead, which a turn notices ([step 7](#7-small-steps)).

**Racks.** A rack that slides in what its gear turns in also has a gap of its own: how far it has slid short of what its gear has turned. A step's motion keeps a gear's rule only at the step's start. For a rack the tree reaches through a linkage (a steering rack on its tie rods), that left it a little behind its gear every step: each step's travel a fifth of a percent short at first, and up to a tenth short in the last steps before a dead point. Closing the loops now pulls it back.

**Resting parts.** A resting part (see [step 4](#4-connect)) has a gap too: how far it is off whatever is highest under it now, or into it. Closing the loops puts it back on that. As a camshaft turns, that may be a different thing from the step before: the rod drops onto the plate it stands through as a pin goes from under it, or jumps up onto a pin that comes round beside its foot.

**How it's solved.** By QR on the rules themselves, which keeps rounding errors small (on rules times their own transposes, an engine drifted):

- **By Givens rotations**, taking in a rule at a time, and working only on what isn't zero.
- **Kept mostly zeros.** In the tree's numbers, a rule about one joint involves only that joint's bodies, and the joints back to the frame. So taking the deepest bodies' numbers first, the rules stay mostly zeros as they're rotated.
- **The tree's mixing is kept from round to round** while the gaps at least halve each round.
- **Speed:** on the 8880 Super Car (137 bodies) a step went from about 3 seconds to under a tenth of one this way.

**When it stops.** A few rounds of that bring the gaps back to within a hundred-billionth of an LDU, or, once a round no longer halves the gap, as close as the model's rounded-off positions allow. A round that opened the gaps up is undone.

### 10. Show it

Each part on screen gets its body's position, so the plate and bricks move with the frame, and the axle, rims and tyres with their wheel body.

- **A chain's links** go round it as far as it has moved.
- **A string** is drawn afresh as a thin tube along its layout. The pieces LDCad drew it with fit only where the hook hung in the model file, so they're hidden.

## The connection table

The connection table lists the connection points of every part Kinebrick knows about. The viewer only reads the table; a script builds it from three sources.

### 1. The LDraw parts library

Parts are built from shared pieces of geometry called primitives, and the library says which primitives each part uses and where they sit. Many parts reuse the same primitives for the same features: a rim's centre is a copy of `axlehol5.dat`, a stud is a copy of `stud.dat`.

### 2. The LDCad shadow library

LDCad is a LEGO CAD program, and its [shadow library](https://github.com/RolandMelkert/LDCadShadowLibrary) adds connection data to LDraw parts and primitives:

- each hole, axle, pin or stud, with its position, direction, length and cross-section (round, axle-shaped, or a pin's ridges and collars);
- each towball and ball socket.

Data on a primitive carries into every part that uses it, so describing `axlehol5.dat` once covers every rim built from it.

It's called a shadow library because its files mirror the LDraw library's folders and file names. LDCad loads each one alongside the LDraw file of the same name, as if its lines were part of that file, without changing the official file.

From the shadow library:

- **a finger hinge's fingers** and the gaps between them become their own section shape (H), so fingers turn between fingers;
- **a rim that clicks onto a wheel hub** (its `techWhlCon1` connection) is keyed, so it turns with the hub.

### 3. Kinebrick's own corrections

A short hand-written file, `data/corrections.ldr`, adds what neither source covers:

- where a tyre sits on its rim;
- gear tooth counts;
- the teeth that lock a clutch gear to a driving ring, and the positions the ring clicks into;
- the connection points of parts the shadow library doesn't describe (the engine crankshaft), or describes only in part (the pin hole behind the ball of a torque tube's ball joint, 92910, that the drive shaft turns in);
- where a rack's teeth are: the LDraw shapes draw them 8 LDU apart, but they're really one gear tooth, 7.854 LDU;
- which parts may slide along which (below);
- pins the shadow library closes at one end, as it does a stud, opened up: a towball pin's, and the 2x2 and 4x4 turntables', whose tops turn on their bases by that pin;
- for a track's links, how far they reach out beyond the line through their pins (a chain tread's grousers, 8 LDU): how far beyond its path a track touches the ground;
- for a part with grooves a plate slides into (a tipper end), where the grooves are.

**Sliding.** The shadow library marks most holes as ones an axle or pin could slide through. But Kinebrick doesn't model what stops an axle sliding out (bushes, gears either side), so it only lets parts slide where the corrections say so: a piston in its cylinder, a 1x8 plate along 1x4 tiles, a 1x4 plate on a 1x1 tile.

**What the script works out itself:**

- each tyre's outer radius, measured from its shape, since that sets how far it rolls per turn;
- the parts the LDraw library calls stickers or flexible sections (a ribbed hose's or a cable's segments, "Flexible_Section" in their header, or a file moved to one), which are decoration.

### Reviewing it

The table is committed to the repository so that changes to it can be reviewed. When the LDraw or shadow library updates, we rebuild it and check the diff. It covers every part used by the test models, and grows with each milestone's test models.

### The whole library's table

The same script builds a second table, `data/library-connections.json`, for every part in the LDraw library, for models opened from your own computer.

- **Size.** Most parts share their connection points with others (each printed version of a part has the same ones). So it lists each cylinder once, and gives each part the places of its cylinders in that list. That takes it from 42 MB to under 7 MB (600 KB as the site sends it, compressed).
- **Fetched only when needed:** the viewer fetches it only for such a model.
- **Corrections and roles** are still only those of the parts the test models use, so in another model a gear Kinebrick hasn't been told about doesn't mesh.

**Tyres and rims are the exception.** Each one the corrections don't give a seat (its title says which it is, "Tyre …" or "Wheel Rim …") gets one measured from its shape, in both tables:

- around the axis it's round about;
- at a rim's largest radius (its flanges too), and at a tyre's smallest (its bore);
- and each tyre its tread.

A tyre sits on a rim that reaches out to its bore or as much as 16 LDU past it (on the tyres and rims the corrections give seats, a rim's flanges reach 2 to 14 LDU past). That gives every tyre and rim in the OMR's Technic sets a seat, and the 8448 Super Car's racing tyres too.

## Part roles

A role is a short label for what a part does in a mechanism. It tells Kinebrick which connections the part makes and how it may move.

- Each part has exactly one role.
- Parts nobody has described yet get `structure`.

| Role | Examples | What it does |
|---|---|---|
| `structure` | Bricks, plates, beams | Nothing on its own. Part of the frame. |
| `axle` | 3706 Technic Axle 6; 32062 Technic Axle 2 Notched; 6538b Technic Axle Joiner Offset | Locks into axle holes, turns freely in round holes. Axle joiners count as axles. |
| `bush` | 3713 Technic Bush with Two Flanges; 32123a Technic Bush 1/2 Smooth | Locks onto an axle. Doesn't count towards which body is the frame. |
| `rim` | 3482 Wheel Rim 8 x 17.5; 2998 Wheel Rim 32 x 56; 56145 Wheel Rim 20 x 30, and the other common studless rims | Carries a tyre. Locks onto an axle through its axle hole, or (2998) clicks onto a wheel hub (2999), turning with it. |
| `tyre` | 3483 Tyre 56 x 17; 3634 Tyre 10/130 x 17 (a bigger tyre for the same rim); 2997 Tyre 34/38 x 56 ZR; 55976 Tyre 26/52 x 30 Off Road, and the other common studless tyres | Locks onto the rim it sits on. Rolls on the ground without slipping. |
| `gear` | 3647, 4019, 3648, 3649 Technic Gear 8, 16, 24, 40 Tooth; 3648a, the old 24 tooth gear; 10928, 94925, the reinforced 8 and 16 tooth gears | Locks onto an axle through its axle hole. Meshes with a gear whose axle is parallel and the two gears' pitch radii away. |
| `gear` (crown) | 3650a, 3650b, 3650c Technic Gear 24 Tooth Crown; 4142, the old differential's (73071) 28 tooth crown wheel | Its teeth also point along its axis, so a gear meshes with them on an axle crossing its own ([below](#gears-and-racks)). Meshes side by side as a spur gear too. |
| `gear` (bevel) | 32270, 32269 Technic Gear 12, 20 Tooth Double Bevel; 18575, the reinforced 20 tooth; 6589 Technic Gear 12 Tooth Bevel; 87407 Technic Gear 20 Tooth Bevel with Peghole; 32198, the old 20 tooth bevel; 4143 Technic Gear 14 Tooth Bevel (the older differential's); 32072 Technic Gear 4 Knob, the knob wheel | Bevel teeth lie on a 45 degree cone. Meshes with another bevel gear whose axle crosses its own ([below](#gears-and-racks)); a knob wheel only with another knob wheel. Double bevel gears also mesh side by side, like spur gears with teeth of the same size, and with racks. |
| `worm` | 4716 Technic Worm Gear 2L | Locks onto an axle through its axle hole. Meshes with a spur gear whose axle crosses its own at right angles, the two pitch radii apart (2 studs for a 24 tooth gear); each turn of the worm moves the gear on one tooth. Can't be driven from the gear: it locks. |
| `gear` (clutch) | 2471, 18946 Technic Gear 24, 16 Tooth with Clutch on Both Sides; 6542a Technic Gear 16 Tooth with Clutch (on one side, for the older ring) | Turns freely on an axle through its round hole. The clutch teeth on each face lock it to a driving ring pushed against them. |
| `driving ring` | 18947 Technic Transmission Driving Ring 3L; 6539, the older 2L ring | Locks onto the ridged axle joiner it slides on (18948; 6538a for the older ring). Clicks into three positions along it: the middle (neutral), and half a stud either way (5 LDU for the older ring), where its teeth lock it to the clutch gear on that side. Dragging it shifts gear. |
| `shift lever` | 6549 Technic 4 Speed Shift Lever | A stick on a ball, standing up through a gate (the 6543 plate with its H-shaped slot), its foot below the ball between two driving rings ([below](#shift-levers)). Dragging it, or the knob on top of it, shifts gear. |
| `pin` | 3673 Technic Pin; 39888 Technic Pin Long without Friction Type 2; 32002 Technic Pin 3/4; 4274 Technic Pin 1/2 | Joins two parts through round holes, and both turn on it. It turns with one of them, since which way a pin spins doesn't matter. |
| `friction pin` | 2780 Technic Pin with Friction and Slots; 4459 Technic Pin with Friction; 6558 Technic Pin Long with Friction and Slot; 61332, 42924 Technic Pin, Pin Long with Friction Type 2 (the ones studless sets use); 65487, 15100 Technic Pin with Friction with Perpendicular Pin Hole; 6628 Technic Pin Towball with Friction (a towball on a pin); 313, the pin of the old 2x5 hinge plates, which hold their angle | The same, but holds what it joins: as one body if the model can still move that way, else as a stiff joint, turned during a drag only if nothing else can move. |
| `connecting rod` | 2852 Technic Engine Connecting Rod | Its big end turns on the crank's pin; its small end is a towball that sits in the piston's socket. |
| `piston` | 2851 Technic Engine Piston Round; 3652 Technic Piston 2 x 2 Block | Slides in the bore of an engine cylinder (2850a Technic Engine Cylinder Head). Holds the connecting rod's towball. |
| `rack` | 3743 Technic Gear Rack 1 x 4; 87761, 64781 Technic Gear Rack 1 x 7, 1 x 13 with Pegholes and Axleholes; 2790a Technic Steering Rack | Teeth in a row that a gear slides ([below](#gears-and-racks)). A body carrying racks is named after them. |
| `crankshaft` | 2853a Technic Engine Crankshaft with Slot (2853 is an old name for it); 2854 Technic Engine Crankshaft Centre | Locks onto an axle through its axle hole. Its crank pin, an axle stub half a stud away, carries a connecting rod; a crankshaft centre joins two crank pins. A body carrying a crankshaft is named after it. |
| `universal joint` | 3326a, 3326b Technic Universal Joint Centre; 62519, the 3L joint's | The cross between a universal joint's two ends: the shafts either side turn together, and the joint bends. |
| `decoration` | 165, 166, the old pneumatic tube end and segment, which models use as exhausts and cables; the segments real sets draw cables and hoses with: u9190, u9218 Power Functions cables, 71944k01, 71944k02 (and 79, 80, moved to them) ribbed hoses, 343 Flex-System cable | Moves with the part nearest to it; never loose. Stickers and flexible sections count as decoration too. |
| `grooved ball` | 2907 Technic Ball with Grooves | On a driveshaft's end, in a wheel hub's socket: the hub turns with the shaft (see [universal joints](#rules-for-real-models)). |
| `nudged ball` | 32494 Technic Wheel Spindle Axle Driver | A constant velocity joint's ball, on a half shaft's end, in a steering hub's or a joint's socket: the hub turns with the shaft, and the ball stays in the socket (see [universal joints](#rules-for-real-models)). |
| `steering link` | 2739a Technic Steering Link 6L | A ball socket at each end, 100 LDU apart, on the towballs of a rack and a steering arm. Turns any way on them, except about its own length. |
| `path` | 3873 Technic Chain Tread, 3711 Technic Chain Link, when LDCad placed them along a path, or 3711 placed link by link; LSynth's segments, run one after another | Not looked up: a part in a path's submodel, a link of a chain placed link by link, or a run of LSynth's segments (see [Load](#1-load)), is one of its links. Connects to nothing; moves with the part nearest it, or round its loop. |
| `split` | 3403c01 Turntable 4 x 4 (Complete); 61927-f1, 92693c01-f2, 40918-f1, the linear actuators' shortcuts, contracted and extended, and their old names | One LDraw file (a shortcut) for parts that move against each other: read as those parts, here the base and the top that turns on it. |
| `linear actuator` | 92693c01, 62271c01, u9487c01, u9559c01 Technic Linear Actuator Body Assembly, small, large, extra large and the later large; 92695, 62273, their inputs; 92696, 62274c01, 62274c02, their pistons | The input turns in the body, and a screw slides the piston out of it as it does ([below](#rules-for-real-models)). |
| `motor` | 58120, 99499, 58121 Power Functions Medium, Large and XL Motors; 22169, 22172 Control+ L and XL Motors; 69730, 54675, 54696p01, 68488 Powered Up Angular Motors; 21980, 26913, 87577, 99498 and the other Power Functions motors; 71427, 74569, 47154c01 the 9V motors; 6216m and the other 4.5V and 12V Technic motors; 2985c01 Technic Micromotor; 53787 Mindstorms NXT Motor; each with its coiled cable too; 12799 Technic Motor Pull Back 6 x 5 x 3, whose spring waits for forces in 2.0 | Its output turns in it ([below](#rules-for-real-models)). Doesn't count towards which body is the frame. |
| `steering wheel` | 2819 Technic Steering Wheel Small | Locks onto an axle through its axle hole. Like `structure`, but the body it's on is named after it. |
| `differential` | 6573 Technic Differential with Gear 16 Tooth and 24 Tooth; 62821 Technic Differential with One Gear 28 Tooth Bevel | Turns on the two output axles that pass into it. Carries gear rings outside, and a post inside for the middle (planet) bevel gear, which meshes with a bevel gear on each output ([below](#gears-and-racks)). |

### Gears and racks

**Tooth size.** Every gear's pitch radius is 1.25 LDU per tooth, LEGO's one tooth size, rather than measured off its shape: an 8 tooth gear's is 10 LDU, a 24's 30, and the 12 and 14 tooth bevels' 15 and 17.5.

**Crown gears.** A spur gear of the same tooth size meshes with a crown gear's teeth on an axle crossing its own at right angles, its pitch circle touching the crown gear's pitch plane (3 LDU from its middle, measured from official models).

- Their teeth mesh one for one wherever the spur gear sits along the crown gear's radius (an official helicopter's sits 2 LDU in), so they turn in the ratio of their tooth counts.
- The old differential's crown wheel is driven by a 14 tooth bevel gear (4143). Its sloping teeth engage it over their depth, within 3.5 LDU of its pitch radius from the crown wheel's pitch plane.

**Bevel gears** mesh with another bevel gear whose axle crosses their own:

- **when the tips of their cones meet where the axles cross;**
- **or, on axles at right angles,** the cones also touch all along a line when their tips are either side of the crossing, as far from it as each other. Then gears with teeth of the same size mesh if their pitch circles meet on that line:
  - a 12 and a 20 tooth double bevel gear, 30 and 20 LDU from each other's axle;
  - a 12 tooth bevel and the old 20 tooth one, as in the 8281 Mini Tractor's power take-off;
  - a differential's 28 tooth ring and a 20 tooth gear.

**Racks.**

- **Their teeth.** A plate with teeth along its top, its pitch line 4 LDU above it. The 1980s steering rack (2790a) is a round bar whose teeth are rings round it, its pitch radius 8 LDU, which slides through its holder (2791a).
- **What meshes.** A spur gear whose axis lies across the rack, square to its teeth or tipped by up to 31 degrees about the rack's length (a slanted steering column's gear; a round rack's teeth face every way), and whose pitch circle touches the pitch line, within 4.5 LDU. Official models set a rack's gear up to 4 LDU off it.
- **How it moves.** The rack moves one tooth for each tooth the gear turns, until the gear reaches the end of the teeth.
- **Rows of racks.** Racks lined up end to end on one body make one long row of teeth, and the gear rolls from one to the next.

**Differentials.**

- **6573** carries a 16 and a 24 tooth gear ring outside.
- **62821** carries a 28 tooth bevel ring, whose cone's tip is 10 LDU from the differential's middle, on the far side from the ring. It meshes with the 20 tooth bevel gear official models set 40 LDU out, its axle crossing the differential's at its middle and its tip 10 LDU the other side, their cones touching along a line.

### Shift levers

A shift lever clicks between its gate's five places:

- **the middle**, where every ring it reaches is in its middle (neutral);
- **the end of each slot.** Tilted into one, its foot swings the other way, into the ring on that side, and slides it to its click-in position that way.

### Roles still to come, and parts that need none

- **More roles arrive with each milestone**, as real models need them: pulleys and strings.
- **Shock absorbers need none:** a square rod fixed in a square cylinder (see [Rules for real models](#rules-for-real-models)). Their springs, like everything to do with forces, wait for version 2.0.
- **A steering arm needs no role of its own:** it's plates and a towball on the part a wheel turns on.

### Parts that don't move yet

Parts Kinebrick knows it can't move yet are listed in `data/not-moving-yet.json`, each with what it doesn't do:

- a gear without teeth data, which doesn't mesh;
- a tyre without a tread, which doesn't roll;
- shock absorbers, which don't compress;
- pneumatics;
- the pull-back motor, whose output holds its axle still.

They connect as plain parts. The viewer lists any in a model, so a part that silently doesn't move is said to.

- **Where the list came from:** it was checked by hand from the scan (`npm run scan`), whose report also lists the parts that look like they move but have neither a role nor a place on the list, still to be checked.
- **A part that gets a role comes off the list** (a test checks).

## Drags

What a drag does for the user is in the README's [Interaction](README.md#interaction) section. Underneath:

### Push or turn

A part that turns like a knob is turned: one on a joint whose axis stays put in what it's mounted on. That's when it:

- is mounted on the frame, or on something that can't move against it (the 858 V-6 engine's crankshaft turns in its block, which is held between its two cylinder banks, the bigger of which is the frame);
- isn't part of a closed loop;
- or turns on one axis wherever it's held: a shaft rather than a link.

Turned: a gear, a crank, a wheel, a linkage's rocker, a crane's winch drum (whose axle also passes through bricks pinned to the cab), or the axle at the top of its boom (which drives the boom's luffing).

Pushed: anything else, such as a frame part, a piston, a connecting rod, the middle beam of a linkage.

Only knob-like parts can be kept turning, and only they get a line in the readout.

- **Push.** Each step works out, for every motion the mechanism allows, how far the grab point would move on screen. It picks the mix of motions that best closes the gap to the cursor (least squares), moving at most 1 LDU per step.
- **Turn.** The part turns like a knob, by the angle the cursor sweeps around its axle since the last pointer move (`src/turn.ts`).
  - Close to the axle the turn is damped, so a short drag never gives a big turn.
  - Seen side-on, where that doesn't work, it turns by how far the cursor moves along the way the grab point turns on screen.
  - A pointer that stops moving stops the turn, even while the axle is carried along (a car rolling).
- **A frame at a time.** Pointer movements are gathered up and worked through once a frame, for at most 25 ms, so a big model on a slow computer keeps redrawing while it catches up with the pointer. What's left (a turn still owed, or a push not yet at the pointer) carries on in the next frame, and letting go first finishes it.

### Holds

For the length of a drag, Kinebrick holds still every part it can without stopping the drag, so that anything the drag doesn't need to move stays put. These holds last only for the drag, are never shown, and are separate from the parts the user freezes (Alt-click), which stay frozen until unfrozen.

**What it tries to hold, in order:**

1. **The car's frame**, unless the drag needs it to move (pushing the car, or turning a wheel, which drives it). So steering never moves the car.
2. **Whatever only slides or swivels on one other part**, held on that part: a bumper resting on smooth tiles, a crane's outriggers, a gear lever on its ball. But not if it carries a gear (a rack, which its gear moves or holds), or ends in a universal joint (a half shaft on a ball in its wheel's hub: held against the wheel, it would go round with it, and on the 42110 Land Rover, whose half shafts sit at an angle to their wheels, rolling steered the car to let it).
3. **What steers a car standing on its tyres:** the parts that turn when, and only when, its wheels turn about upright axes (found with the tyres lifted off the ground and not turning on their axles). So turning a wheel rolls the car rather than steering it (a steered wheel turns, too, as it swings round its pivot).
4. **Parts on friction pins, and what turns in a motor.**
5. **The deepest parts of the mechanism** (a differential's planet gear before the differential).

**What it never holds, or holds differently:**

- **Not in a way that carries along the shaft a part turns on**, if that shaft could have stayed put (a clutch gear freewheeling on a gearbox's output shaft).
- **Not carried round by a shaft that has to turn about the part's own axis:** such a part is held against the frame instead (an assembly hanging on a tractor's driven rear axle stays level). Or rather, against what the shaft turns in: the first body up the tree from it that doesn't turn on the same line, which is usually the frame. On the 42111 Dodge Charger, whose rear axle hangs on a ball joint, the differential on its half shafts is held against the axle, so one rear wheel turns the other the opposite way. (Held against the car, it left a rear wheel turning only by swinging the whole axle on its ball.) On the 8110 Unimog, whose frame (the body with the most structure parts) is its cab, which tilts, each differential is held against its axle: held against the cab, a differential left a wheel turning only by tipping the cab with it, and the truck couldn't roll.
- **Not parts in a closed loop**, since whether one is needed can't be told from the starting instant alone (a steering tie rod doesn't turn at straight ahead, but must as soon as the wheels do). What turns in a motor is held all the same: its axis stays put in the motor (the 42129 Mercedes-Benz Zetros's two motors, their axles through one beam, drive its centre differential's housing, which turns the rear axles against the front ones only with the motors held).
- **Not wheels on the ground**, since rolling is their job, nor a string's pulleys, which turn as it runs round them.
- **Not resting parts**, which move as what they rest on does, and whether one has to can't be told from the starting instant alone (a push rod stands still on a camshaft until a pin comes round under it).
- **Worms lock:** a worm is held still during any drag that would drive it from its gear's side.
- **So do linear actuators:** an actuator's input is held still during any drag that doesn't turn it, through gears, universal joints or chains.

**Keeping to the plain motion.** A drag that turns its joint without the car moving on its suspension keeps to that while its holds are chosen: a hold that would leave it only a lurch of the car on its suspension is let go. (An official Ferrari 488 GTE's driveshaft, which its front wheels drive through constant velocity joints: held, turning one front wheel turned the other back and pitched the car, and stopped a step on.)

**Choosing fast.** Asking afresh whether the drag can still happen for each part tried would take seconds on a big model. So a turn tries them with a quick stand-in instead:

- the free motions, tyres' scrub aside, are worked out once, and each try only adds what's been held since;
- the holds it settles on are then checked properly;
- if they leave the turn impossible after all (scrub can rule out motions the stand-in allows), as many of them are kept as the turn allows, in the order they were chosen (those held against the frame among the rest).

**Scrub while choosing.** While the holds are chosen, the tyres may scrub only as much as the drag needs with nothing held but the car's steering (or 2%, if that's more). Else a hold that only makes the tyres scrub more would be kept: the Ackermann car's differential, its tyres scrubbing round a bend at 8% rather than its rear wheels turning at different speeds at under 1%.

**Choosing again.**

- **When the holds make a turn turn too much:** holds that leave a turn turning things more than 10 times as much as it would with nothing held are chosen again, with what the turned part drives through its gears tried last. They've shut off what turning it is for. (The 855 Mobile Crane's boom extension knob: holding the pinion on the extension rack, deep in the boom, left the knob turning only by luffing the boom, its gear rolling round the crown gear it drives and the luffing knob spinning 80 times as far.)
- **When a turn gets stuck:** holds that suited where a turn started may not suit it further on (as a steered car's wheels turn, they turn by more and more different angles, and its differential has to turn a little too), so it chooses them afresh where it is.

### Ends of travel

A sliding joint that reaches either end of its travel, or a gear that reaches the end of a rack's teeth, stops a drag like a collision does, and the two parts flash red. (Collisions can't do it: the two parts are connected, so they may touch.)

So does a dead point (see [the solver](#7-small-steps)), though nothing flashes.

### Shift

The mechanism is worked out afresh at each click of:

- a driving ring;
- a gear lever: the lever turned about its ball to stand up through that place in its gate, and the ring its foot moves slid with it;
- a shaft a model says slides: its `SLIDE` line (the 956 Auto Chassis's input shaft, with the gear lever that rides on it).

Every part's current placement becomes its new starting placement, and the mechanism is worked out afresh: new bodies, joints, collisions to watch, and readout. Frozen parts are unfrozen, since the bodies they refer to are gone. The readout counts from zero again.

### Meshes afresh

Gears mesh where the model is built, but a drag can bring gears together or draw them apart. (The 952 Tractor's lever lowers its thresher until its 40 tooth gear meets a crown gear the rear axle drives, a power take-off.)

So when a drag ends, and after each part the address turns (`turn=`), Kinebrick looks for meshes with every gear where its body now is. If they're not the mechanism's, it's worked out afresh from where everything now is, as after a shift.

### Motor

A part kept turning (Ctrl-click) is driven every frame like a turn drag, but in steps of up to 15 degrees rather than 2: one step a frame, up to 150 rpm.

**Which way.**

- It starts counter-clockwise as seen from where the camera is when it's Ctrl-clicked: turning about its axle's axis pointing towards the camera (seen side-on, either way).
- The address keeps it as `autospin=`, with its direction as seen from where the camera starts, with the model as loaded. So opening the address turns it the same way, whatever the camera did before the Ctrl-click.

**Big steps.** Bigger steps are just as exact (loops close after each, and a steadily turning car follows its circle exactly), except:

- where they run into something: a step that would is undone, and the motor creeps up to it in 2 degree steps, getting as far as a drag would;
- a step too big for the loops to follow in one go is taken again in 2 degree steps too, and only those can tell a dead point.

**At the end of its travel** it turns back, and runs the other way until it gets as far as it can go again, and so on: a crane's hook goes up to the boom and down to the ground, over and over. If it can't get anywhere either way, it stops.

**Its holds** are worked out once when it starts and kept while it runs (on the V8, working them out takes longer than a step). They're worked out again after a drag, a freeze or a shift, or if a step fails with them.

**The camera** moves by however far the frame moved, and the floor grid follows in whole squares, so it seems endless while its lines still slide past.

**Pausing.** It pauses while the user drags something else, and keeps going through a shift.

**A part that doesn't spin on an axle** (a frame, a rack, a piston) is kept moving instead, as a push drag would move its middle:

- it starts the way, of those it can go, nearest straight away from the camera;
- at a tenth of the model's size that way each second, in steps of up to 1 LDU;
- each step the mix of the ways it can go nearest the way it was going, so a steered car rolls round its circle;
- where it can go no further that way, it turns back, as a part kept turning does;
- `autospin=` keeps it too, with `,cw` if it's going the other way from how it started.

## Per-set data

What Kinebrick knows about each real LEGO set comes from three kinds of source, kept apart so that it's always clear where a fact came from and what may change it:

- **Imported**: copied from outside sources by scripts: BrickLink's catalogue, the LDraw Official Model Repository, LEGO's building instructions. Running the script again refreshes it.
- **Curated**: judgements drawn from a set's books, its model and the people who know it: what each control does, what's wrong with a model. Agents draft it and people review it; it changes only in a commit someone has read, never by a script.
- **Generated**: Kinebrick's own measurements, which change whenever its code does: what each of a set's functions does today, how far each control turns. Only scripts write it, afresh each time, with the commit and date it was measured on.

Two places hold it:

| | `models/technic-sets.csv` | `data/sets/<set>.json` |
|---|---|---|
| What | One row per set: what fits in a column, to sort and filter every set by | One file per set: everything nested or long, in three sections, `imported`, `curated` and `generated` |
| Imported | Set number, name, year, part counts, BrickLink and OMR links, the pinned OMR file | `instructions`: its instruction books as downloaded, each LEGO PDF or a folder of scans |
| Curated | `errors` (the model's mistakes, in plain English) and `corrected_model` (the repo file of a model put right) | `model` (the file its parts are counted in), `instructions` (which books build the main model, where its functions are drawn), `functions` (what each control does, and which parts it moves), `questions` and their answers, and `settings` (Kinebrick's own lines for a set in `models/`); see [data/sets/README.md](data/sets/README.md) |
| Generated | Summary columns at the end, such as `functions_working` (none yet) | `generated`: each function's result, loose parts, and the commit and date, written by `npm run functions` (see [The function check](#the-function-check)) |

The rules that keep them tidy:

- **Each fact in one place.** A set's JSON refers to it by its number, and doesn't repeat the name, year or model path the CSV has. A summary column in the CSV is generated from the JSON's `generated`, never typed.
- **A script owns its fields.** Each script rewrites only the columns or keys it owns, by name, and leaves the rest as they were, as `npm run omr` does the `omr_file` column.
- **No script writes curated data.**

Where the earlier files went:

| Was | Now |
|---|---|
| `data/functions/<set>.json`, the function lists | Each `data/sets/<set>.json`'s `curated` `model`, `instructions` and `functions` |
| `models/sets.json`, Kinebrick's lines for the sets in `models/` | Each set's `curated.settings`, only where it has lines |
| `omr/instructions/index.txt` and the scan folders, which file holds which book | Each set's `imported.instructions`, written by `npm run instructions` |
| `data/functions/REVIEW.md`, the first review of the function lists | [data/sets/REVIEW.md](data/sets/REVIEW.md). Its questions are each set's `curated.questions`; its results are replaced by `generated`. |
| `tests/joints/`, the joints probe's baselines | Stays where it is: the tests' own |

## Testing

`npm test` runs the tests, which are in `tests/`. They check the mechanism logic: given a test model, Kinebrick finds the right bodies, joints and gear meshes, and moves them correctly.

They run in Node with no browser. Each loads a real model from `models/`, works out its mechanism, moves it, and checks the numbers.

### Reading models

| File | What it checks |
|---|---|
| `ldr.test.ts` | Reading model files: submodels flattened in order, each part placed where its submodels put it, colour 16 inherited through every level, parts the file brings with it, shapes drawn without parts, a part read as the pieces it's made of, Kinebrick's own settings from `0 !KINEBRICK` lines, and a part written back as one line. |
| `import.test.ts` | Bringing in real LEGO sets. Every set in `models/` already has its own lines from its file in `data/sets/`, so importing it again changes nothing. A fresh set's files are renamed wherever they're named (`956 - main.ldr` to `956-main.ldr`), its lines go after its main file's license, its line endings are kept, and importing twice gives the same file. |
| `attachment.test.ts` | Every test model is fully attached, and a misplaced brick is caught, sitting between the studs or floating above the plate. Real sets Kinebrick can't fully read yet are listed, with what each needs. |
| `not-moving-yet.test.ts` | A part Kinebrick has learned to move comes off the list of those it can't. |
| `paths.test.ts` | A path LDCad drew is read with its circles where its submodel puts them, and its links known; its loop goes round the circles and along the straight runs between them; and its links move along it, half way round swapping places. Links LDCad put in a subpart of the path are its links too. A path's caps are parts of their own. A rubber band round two axles turns them together, at speeds in the inverse ratio of its circles, and crossed, the other way. A run of LSynth segments is a path: a rope wound on a drum is read with the drum's circle, a hose with none; and a winch wound with such a rope raises the hook tied to its end as far as the drum's rim turns, straight up. Chain links placed one by one, out of order, are a looped chain round a circle at each gear, as far round as the chain goes in a turn, and turn the gears together; one a link short is closed, one left open further isn't a chain. The 8835 Forklift's chain turns its top sprocket with the bottom one, and the 8844 Helicopter's is found on its front axle. |

### Mechanisms built for the tests

| File | What it checks |
|---|---|
| `mechanism.test.ts` | The simple car splits into a frame and two wheel-and-axle bodies, with one turning joint per axle. A constant velocity joint's nudged ball in a portal axle's steering hub drives the hub, about the hub's axis, and stays in its socket. |
| `kinematics.test.ts` | The simple car stands on four tyres and can move exactly one way; its wheels turn by distance ÷ tyre radius, it stays on the ground, and it rolls back to where it started. With no tyres, the frame stays put and only the axles turn. |
| `gears.test.ts` | The 8, 24 and 40 tooth gear train turns at the right ratios, both ways. Rolling the geared car spins its extra axle the other way. Turning a wheel rolls the car one tyre circumference per turn. Every gear in the library's table has LEGO's tooth size, 1.25 LDU of pitch radius per tooth. |
| `bevel.test.ts` | The right-angle drive turns 1:1. The differential has two free motions; the input drives the housing at a third; with the input frozen the outputs turn opposite ways; with one output frozen the housing turns half as far; a drag on the input keeps the outputs together; and freezing the input and one output jams it. The 8865 Test Car's old differential (73071) is named one, its crown wheel meshing with the pinion and its planet with both side gears; with the engine held, a rear wheel turns the other the opposite way, on the ground. |
| `worm.test.ts` | The worm meshes with its gear, turns it one tooth per turn, can be driven from the worm, and locks when driven from the gear. The 8849 Tractor's worm meshes with the 24 tooth gear on its long shaft, and turns it one tooth per turn. |
| `actuator.test.ts` | A large linear actuator raising an arm: its input turns in its body and its piston slides in it, leaving one way to move. A turn of the input slides the piston out one lead and swings the arm up. It stops at the end of its stroke going out, and coming in where the arm comes into line between its pins (a dead point). It can be worked from its input but not from the arm. The library's shortcuts read as their three parts, under their old names too. |
| `motor.test.ts` | A motor's output turns in it: an axle in a Power Functions Medium Motor's, and the gear on that axle, turn together in the motor; so does an axle in a Control+ L Motor embedded under its set's name; and a gear on a 9V Mini-Motor's axle stub turns on it. The output turns stiffly, so a drag holds it unless nothing else can move. |
| `gearbox.test.ts` | The driving ring sits centred on its joiner with three places to click into. Neutral leaves the output still, first gear turns it a third as far as the input, second as far. The gearbox is fully attached in every position. Its gear lever finds the ring: the two slots of its gate on the input axle's side put it in first and second, and the middle and the other two slots leave it in neutral. |
| `rack.test.ts` | The plate and its racks slide along the tiles and mesh with the gear, leaving one way to move. A quarter turn of the gear slides the rack 2 teeth, and the rack can be pushed along its length, turning the gear. The plate may overhang the tiles down to a stud of overlap, and the rack stops where the gear reaches the end of the teeth, 80 LDU either way. Started over one rack, the gear meshes with both and rolls from one onto the other. |
| `linkages.test.ts` | The engine has a frame (the cylinder head pinned on), crankshaft, connecting rod and piston, and moves one way. A turn of the crank moves the piston down its 20 LDU stroke and back, a quarter turn as far as crank-and-rod geometry says. Pushing the piston works mid-stroke but not at the top. The four-bar's pins are each locked to a beam, its crank turns all the way round and its rocker swings about 63 degrees. After 10 turns no joint of either has drifted apart, and each turns its cranks like knobs and pushes its connecting rod or coupler. |
| `play.test.ts` | A parallelogram with a second link between its arms a little longer than there's room for, so it fits only as built, turns a quarter radian on its play, stops by half a radian, where the misfit outgrows it, and turns back. A beam on two pins doesn't turn, and a four-bar turned by its rocker stops at its dead point. |
| `balls.test.ts` | A ball set 0.23 LDU off the axis of the part it sits in, as a model built by hand may have it, or 2.2 LDU off, as the Land Rover's are, is put on that axis; one where two axes cross is put where they cross; one well off it (a crank's), or far along it past the part, is left where it is. |
| `couplers.test.ts` | The 8841 Dune Buggy's steering, built by hand: a rack pinned to both steering arms jams a step on if it also slides straight on tiles, and steers once that slide is left out. A rack on tie rods keeps its slide, and so does a frame with two arms hinged on it. A half shaft on a ball in a steered wheel's hub, driven by a universal joint, isn't held against the wheel as a gear lever would be, so turning the wheel doesn't steer it. |
| `v8.test.ts` | The V8 from LEGO 8448 is fully attached (lipped axle holes, axle stubs on parts, tiles on hollow studs). Its friction-pinned block, banks, stands and intake are one frame; it has one crankshaft, eight connecting rods and eight pistons; and one turn of the crankshaft takes every piston through its 20 LDU stroke and back. Rebuilt with the newer cylinder heads (2850b) and read with the whole library's table, it still runs, each piston sliding in its own cylinder. A four-bar rebuilt with friction pins still turns, its pins stiff joints; rebuilt with the Type 2 friction pins studless sets use, it's still four bodies. |
| `steering.test.ts` | The steering car can move two ways, steer and roll. The steering wheel turns the front axle a third as far without moving the car. Going straight, the rear wheels turn the same; round a curve, the outer one rolls further. Pushing the car, or turning a rear wheel, leaves the steering alone. With a solid rear axle it still rolls round a bend once steered, its rear tyres skidding: the axle turns them alike, the outer one travels further, and on average they roll as far as the axle turns. |
| `ackermann.test.ts` | The Ackermann car is fully attached, its steering links on towballs, and moves two ways, steer and roll: the links don't spin about their length. The rack stops after 30 LDU, where its plate would overhang its tile, with the inside wheel at 30 degrees and the outside one at 20, and the car hasn't moved. Steered, it rolls round a centre on the rear axle line, each front wheel within 1.5 degrees of the angle that centre needs, its tyres scrubbing under 1% of how far they roll. With the rear axle moved forward to half the wheelbase, it rolls when steered a little, scrubbing under 2%; at full lock it rolls scrubbing between 2% and the usual 10%, and allowed only 2%, it doesn't. |
| `suspension.test.ts` | A car built by hand whose front wheels hang on swing arms, level as built: turning one arm a quarter radian either way raises or lowers the front of the car, every tyre staying on the ground as the arms swing the wheels out and in. With its arms held, it only rolls. |

### The viewer's pieces

| File | What it checks |
|---|---|
| `collisions.test.ts` | On simple boxes: parts apart move freely and are caught when they start to overlap; parts on the same body, connected parts, and parts touching at the start aren't watched. |
| `turn.test.ts` | The knob: it turns by the angle the pointer sweeps around the axle and keeps in step over full turns; it doesn't turn when the pointer is still; a short drag next to the axle gives a short turn; it turns the right way; and it gives up when the plane of turning is seen edge-on. |

### Real LEGO sets

`tests/sets/*.test.ts`, one file per set, loaded by `sets/load.ts`.

**852 Helicopter**
- Fully attached, its rotors Technic plates gripped by bushes, and its swashplate's two halves turning and sliding on the rotor shaft.
- A turn of its crank turns the tail rotor once and the main rotor a third of a turn, through a crown gear, the blades keeping their pitch.
- A pilot's lever slides the swashplate along the shaft, both halves together, pitching both blades alike, until it meets the bush above or the frame below.

**854 Go-Kart**
- Fully attached.
- Its steering wheel turns both front wheels the same way through its universal joint, without moving the kart.
- A turn of a rear wheel rolls it one tyre round, and runs its piston through its 28 LDU stroke.
- At full lock either way, about 33 degrees where a knuckle meets its chassis, a turn of a rear wheel still takes it round, its file allowing 16% scrub, which 15% wouldn't.
- Allowed only 8%, steered 22 degrees, it says how much more its tyres would have to scrub.

**855 Mobile Crane**
- Fully attached, its hook hanging on its string over three pulleys, its cab on a 4x4 turntable read as base and top.
- A turn of its winch pays out 7.5 LDU of string per radian, and the hook drops half that, straight down.
- The hook stays beneath the boom tip, upright, as the cab slews and the boom luffs.
- The cab slews on its turntable, and the crane stays where it is.
- Each of its four outriggers slides 160 LDU along its tiles, and stops at either end.
- Its boom extension knob slides the boom's inner section out and in, leaving the boom's angle and its luffing knob where they were.

**856 Bulldozer**
- Fully attached, its bucket's plates in its tipper ends' grooves and two connectors wedged between its studs.
- Runs on two tracks of 50 links, each round two 40 tooth gears, and stands on its tracks, 8 LDU below their path.
- A turn of one track's gear moves that track 51.2 LDU round per radian, turning its other gear alike, and the bulldozer turns.
- Moved one link along, each link lands where its neighbour was.
- Driven round and round, it keeps going, nothing else moving.

**950 Fork-Lift Truck**
- Fully attached, its forks sliding on the mast and its steering driving a crown gear.
- The lift shaft raises the forks 10 LDU per radian, until the gears reach the end of the racks.
- Its steering wheel turns both front wheels the same way.

**952 Tractor**
- Fully attached, its big rear wheels tyres.
- Its lever raises and lowers the hitch hung on both rear half axles, without moving the tractor.
- Its steering column turns both front wheels the same way.
- A turn of its rear wheels rolls it one tyre round, the assembly on its rear axle staying level.
- Steered 40 degrees either way, a turn of its rear wheels still takes it round, within the usual 10% scrub.
- Steered a little, a rear wheel kept turning by the motor for 150 steps takes it round a corner, its steering left where it was. (Further on, its hitch, which rolling nudges round, creeps down until the thresher's wheels touch the ground, and the tractor lurches over.)
- Lowered all the way by its lever, its thresher's 40 tooth gear meshes with the crown gear its rear axle drives; worked out afresh there, a turn of its rear wheels spins the thresher's gears.

**956 Auto Chassis**
- Fully attached, with a double universal joint and a guided steering rack.
- Its steering wheel turns both front wheels the same way. Turned 3 radians, it slides its rack 10 LDU per radian of its gear, without slipping.
- At full lock either way, where its tyres meet its chassis, a turn of its rear axle still takes it round, its tyres scrubbing more than 2%.
- Turned on past that, its steering stops short of its linkage's dead point, in the same place however it gets there, and turns back with its rack unslipped.
- Driven round in circles, it stays level.
- A turn of a front wheel rolls it one tyre round, and runs each of its four pistons through its 32 LDU stroke.
- Steered, a turn of its rear axle, which has no differential, takes it round a bend.
- At full lock either way, its rear axle kept turning by the motor for 200 steps takes it round and round, its fast-swinging connecting rods no dead point. And there, its gear lever, which sits on the drive shaft, stands where it was, rather than swinging round with the shaft into the engine.
- Its gear lever slides that shaft between two speeds: the engine turns 9 times for each turn of the rear axle as built, and 3 times slid back 20 LDU, its gear meshing straight with the crankshaft's.

**1972 Go-Kart**
- Its steering wheel, on its slanted column, steers both front wheels alike, its 16 tooth gear meeting the rack at 26 degrees and sliding it 20 LDU per radian.

**8024 Universal Set and 8832 Roadster**
- The 8024's deck knob and the 8832's steering wheel steer through the 1980s steering rack, whose teeth are rings round a bar, about 10 LDU per radian. The Roadster's gear meets it from a column slanted 30 degrees.

**8448 Super Street Sensation**
- Its rear cross shaft turns its propeller shaft as far, through a pair of the old 20 tooth bevel gears.

**8835 Forklift**
- Its chain, placed link by link, turns the mast's top sprocket as far as the bottom one.

**8844 Helicopter**
- Its landing gear chain, placed link by link, is found on the front axle's sprocket.

**8849 Tractor**
- Fully attached, its hitch's 24 tooth gear corrected onto its shaft.
- Its steering wheel slides its rack 10 LDU per radian, its front axle, which rocks on the steering shaft, staying level.
- Its worm turns the long shaft under it one tooth per turn.

**8859 Tractor**
- Its 24 tooth steering gear, 4 LDU further from its rack than its pitch radius, slides it 30 LDU per radian.
- Its prop shaft turns the old differential's 28 tooth crown wheel half as far, through the 14 tooth bevel pinion on its end, and the tractor rolls.

**8865 Test Car**
- Its old differential (73071), with the engine held, turns one rear wheel the opposite way to the other, the car standing on the ground.

**8880 Super Car**
- Fully attached, two universal joints in its steering and four grooved balls in its hubs, and a chain from its gearbox to its engine.
- A turn of a wheel rolls it one tyre round, through its three differentials, its V8 staying still in neutral.
- Its steering wheel turns the front wheels one way and the rear ones the other, about half as far, without moving it.
- Steered near full lock, a front wheel kept turning by the motor takes it round a corner, its steering left where it was, within the usual 10% scrub.
- Each of its two driving rings, shifted either way, puts the engine in a gear: 2.25, 1.5, 0.75 and 0.5 turns per turn of the wheels.
- Its gear lever clicks into its gate's five places, neutral in the middle and each slot's end sliding one ring, so the engine is in each of those four gears.

### The joints probe

Every model's controls are tried by `npm run joints` (`scripts/probe-joints.ts`), too slow to run with the tests: about three minutes for the models in `models/`.

**What it does.** For each part a drag turns like a knob, it:

- turns the joint a drag would, both ways, as far as 1.5 radians, holding what a drag would hold;
- writes down how far it went, and which bodies it moved, and how far;
- tries the mechanism alone, without the collision checks the viewer adds.

**Baselines.** `tests/joints/<model>.json` keeps what it found, one line per knob, as a baseline.

- A run compares against it, and fails if a knob turns much less than it did, or no longer moves a body it moved. That's how a change that seizes a model's linkage (the 856 Bulldozer's bucket, once) gets caught.
- When a change is meant, the baselines are written afresh (`npm run joints -- --update`), and the diff shows what changed.
- `npm run joints -- --report` lists, from the baselines, each model's knobs that stop after a little, turn only one way, or can't move at all.

**Surveying the OMR's sets.** `npm run joints -- --omr` surveys the OMR's sets in `omr/` the same way, its baselines in `omr/controls/` (not committed). It tries only the controls a person would use:

- wheels with tyres;
- steering wheels;
- gears of 20 teeth or more that can be reached from outside the model: one of its parts with nothing of another body within 30 LDU of a line out from it, along one of the six axis directions.

Not the pins, axles and small gears inside, nor each link of a track: in seven of the biggest sets, 109 controls out of 3,185 knobs. Each finding says what kind of control it is.

| Option | What it does |
|---|---|
| `--all` | Tries every knob (baselines in `omr/joints/`) |
| `--reach 0.25` | Turns each only a quarter radian each way: enough to tell which are stuck |
| `--resume` | Carries on where a run stopped, within a model too |
| `--limit` | Stops a model that takes longer (4 hours by default), and writes it down as timed out, to be looked into |
| `--commit` | Commits each set's findings to the `omr-survey` branch and pushes them as they're written (`scripts/survey-branch.ts`), without checking that branch out, so a survey that takes days can be looked at while it runs, from another machine or session |

**How a survey runs.**

- The smallest models go first.
- Each is probed in batches of 20 knobs, a process to each batch. Each batch's findings are kept as it finishes, so a run says how far a big model has got.
- Every five minutes, a run says, for each process that has been going that long, where it has got to and how long since that changed, so a process stuck in one step shows.
- Once a minute, it says how many models are done and to go.

[docs/omr-survey.md](docs/omr-survey.md) gives the steps for a survey on a spare machine.

### The function check

The joints probe can tell that a control moved, but not whether it moved the right thing. `npm run functions` (`scripts/check-functions.ts`) checks each set's functions, what its controls are supposed to do (`curated.functions` in `data/sets/<set>.json`), against what Kinebrick does with its model, and writes what it found into the set's `generated`, afresh each time.

**What it does.** For each function with a control, from where the model was loaded:

- works the function's `first` controls, in order;
- works its control both ways, as a drag would, holding what a drag would hold: a turn of 1.5 radians, or a push of 20 LDU for a slide;
- checks that every part in `moves` moved and every part in `stays` didn't, each against the frame or the part it names (a part moved if it went 1 LDU or turned 1°).

**Results.**

| Result | |
|---|---|
| `works` | For each of its controls, one way went at least half as far as it was worked, with every part doing what it should |
| `partly` | Something moved, but not all it should, or something that should have stayed moved |
| `no` | Nothing moved: the control is part of the frame, or has no joint to work |
| `skipped` | Marked `skip`: it only matters under gravity or force |
| `not checked` | Nothing is worked by hand |
| `error` | The check couldn't be made: a part its list names isn't in the model |

**What it writes.**

- The commit it ran at, and `"uncommitted": true` if `src/` or `data/` had changes not yet committed.
- The date, how many functions came out each way, and the model's loose parts.
- One entry per function, in the same order as `curated.functions`: its result, how far each control went each way (`turned`), the parts in `moves` that didn't move (`still`), those in `stays` that did (`moved`), and `why`, where it couldn't work a control.

**How it runs.** Each set is checked in a process of its own, half the cores' worth at once, smallest model first. A set that takes longer than 30 minutes (`--limit`) is stopped and written down as timed out. `npm run functions -- 855 8880` checks only those sets. Once a minute it says how far it's got: how many sets are done and left, their functions' results so far (works, partly, no, and skipped or not checked, each with its share), and which sets it's checking, with how long each has taken so far.

**What it can't do yet.** It doesn't click a slide between positions set by a `SLIDE` line, as the viewer does (the 956's gear lever), shift a gearbox's rings, or run a motor, so those functions come out `partly` or `no` here even where the viewer works them.

### What the tests don't cover

Checked by hand in the browser instead:

- **Anything on screen:** hover, arrows and arcs, push drags, the motor and its address (`autospin=`), parts turned from the address (`turn=`), shifting, freeze outlines and badges, and the options.
- **Re-reading the model in the viewer after a shift.** The gearbox tests rebuild the mechanism with the ring moved, but not through `src/main.ts`.
- **Collisions between the test models' real part shapes.** Those need the parts' meshes, which only load in the browser, so clashes in the test models have been found by checking there.
- **The script that builds the connection table**, beyond what the model tests use of the table it builds.

Browser-level tests for these paths can come later.

## Conventions

- **Units.** LDraw units (LDU). 1 stud = 20 LDU, a brick is 24 LDU tall, a plate is 8 LDU.
- **Axes.** LDraw's own axes: −Y is up. The viewer flips the model when it displays it. A vehicle's front is usually at −Z, so its left is at +X.
- **Spelling.** Part names follow LDraw, so `tyre`, not `tire`.

## Code map

### The viewer

| Path | What's in it |
|---|---|
| `src/main.ts` | The viewer: model picker, opening your own model, loading, camera, readout, re-reading after a shift |
| `src/pack.ts` | Packs a model with every LDraw file it uses into one file the loader reads, for `npm run pack` and for a model opened from your own computer |
| `src/studio.ts` | Reads the LDraw model out of a BrickLink Studio file (`.io`): a ZIP archive, encrypted with Studio's password |
| `src/library.ts` | For a model opened from your own computer: fetches its parts from an LDraw library online (erik-larsen.github.io/ldraw, or another given with `?library=`, such as `?library=/ldraw/` for the one in `ldraw/` under `npm run dev`), and keeps the file and the parts in the browser |
| `src/ldr.ts` | Reads the parts of an LDraw model file, .ldr or .mpd, flattening submodels, the paths LDCad and LSynth drew, and Kinebrick's own settings in it; brings a real LEGO set's file into the shape Kinebrick keeps it in |
| `src/mechanism.ts` | Works out bodies and joints from the connection table ([How it works](#how-it-works), steps 2 to 6) |
| `src/kinematics.ts` | Works out the allowed motions and moves the bodies (step 7), and the holds of a drag |
| `src/shift.ts` | Finds the parts that slide into set positions (driving rings) and the gear levers that move them, and moves them |
| `src/paths.ts` | Where a chain's or track's links go as it moves round its wheels, and a string's layout round its drum and pulleys |
| `src/collisions.ts` | Stops parts passing through each other |
| `src/interaction.ts` | Hover, press, drag, freeze, keep turning (see [Drags](#drags)) |
| `src/turn.ts` | How far to turn a part when the pointer moves, like a knob |
| `src/appearance.ts` | How parts look: fill colour (LEGO colours, or one per body), yellow glow for hover, outlines and badges for status, and see-through for what drivetrain focus leaves out |
| `src/outlines.ts` | Outlines drawn around parts after the scene renders |
| `src/thumbnail.ts` | A picture of the model for its card in the README, taken when the page is opened with `?thumb` |
| `src/jointAxes.ts` | Draws joint axes |
| `src/connections.ts` | What a connection point looks like in the table |

### Data

| Path | What's in it |
|---|---|
| `models/` | Test models |
| `models/technic-sets.csv` | Every LEGO Technic set, one row each (see [Per-set data](#per-set-data)) |
| `data/sets/` | Everything known about each real LEGO set, one file per set, in `imported`, `curated` and `generated` sections (see [Per-set data](#per-set-data)): its instruction books, what its controls should do, and Kinebrick's own lines for a set in `models/` (settings such as tyre scrub), which `npm run import` puts into its file |
| `data/corrections.ldr` | Kinebrick's own additions to the connection table |
| `data/roles.json` | Each part's role; parts not listed are `structure` |
| `data/not-moving-yet.json` | The moving parts Kinebrick can't move yet, each with what it doesn't do, which the viewer lists |
| `data/connections.json` | The connection table (generated, don't edit) |
| `data/library-connections.json` | The connection table for the whole LDraw library, for models opened from your own computer (generated, don't edit) |
| `packed/` | The packed models and part titles the viewer loads; the LDraw library's primitives and colours; and `pieces.json`, the pieces of every part read as its pieces, for the scripts that read sets from the OMR (generated, don't edit) |

### Tests and scripts

| Path | What's in it |
|---|---|
| `tests/` | The tests (see [Testing](#testing)) |
| `tests/setup.ts` | Runs before every test file: after each test, lets vitest's worker read its messages, so long synchronous tests one after another don't time it out on GitHub's machines |
| `scripts/build-connections.ts` | Builds the connection table (`npm run connections`) |
| `scripts/import-sets.ts` | Brings real LEGO sets downloaded from the OMR into `models/`, renamed, with their lines from `data/sets/` (`npm run import`, run first by `npm run data`) |
| `scripts/pack-models.ts` | Packs each test model, flattened, with the LDraw parts it uses (`npm run pack`), and lists the library's primitives and colours for models opened from your own computer |
| `scripts/thumbs.ts` | Makes the README cards' pictures, opening each model in headless Chrome with `?thumb` (`npm run thumbs`) |
| `scripts/download-omr.ts` | Downloads the OMR's Technic sets into `omr/` for the scan (`npm run omr`), each the version pinned in `models/technic-sets.csv`'s `omr_file` column, pinning new sets |
| `scripts/download-instructions.ts` | Downloads each set's building instructions into `omr/instructions/`, LEGO's PDFs or else brickinstructions.com's scans, and writes which are which into its `imported.instructions` (`npm run instructions`) |
| `scripts/probe-joints.ts` | Tries every knob of every model both ways and compares what each moves with `tests/joints/` (`npm run joints`; see [The joints probe](#the-joints-probe)) |
| `scripts/check-functions.ts` | Works each set's functions and writes what happened into its `generated` (`npm run functions`; see [The function check](#the-function-check)) |
| `scripts/load-model.ts` | Reads a model as the viewer does, from `models/` or `omr/`, for the probe and the function check |
| `scripts/survey-branch.ts` | Commits each OMR set's findings from `npm run joints -- --omr --commit` to the `omr-survey` branch, one commit per set per run, and pushes it |
| `scripts/scan-omr.ts` | Reads every set in `omr/` as the viewer would and reports what Kinebrick connects and what it's missing, in `omr/coverage.md` (`npm run scan`) |
| `scripts/mpdflatten.py` | Flattens an LDraw multi-part model (.mpd) into one parts-only .ldr. No longer needed for test models, which may be MPDs |
