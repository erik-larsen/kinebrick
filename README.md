# [KineBrick](https://erik-larsen.github.io/kinebrick/)

A web viewer that makes LEGO Technic models move. Load an LDraw model and drag its parts: push a car and it rolls, its tyres turning against the ground; turn its steering wheel and the front wheels turn, the inside one further, and the car drives round a curve, a differential letting each rear wheel turn at its own speed. Gear trains turn at the right ratios, a worm drive locks when driven from its gear, a gearbox shifts when you slide its driving ring, and parts stop where they'd run into each other. Real LEGO sets from the late 1970s to the 1990s, read straight from their LDraw files, drive, steer, crank their forks up and run their engines. Ctrl-click a part to keep it spinning like a motor, or Alt-click it to freeze it. KineBrick works all this out from the parts themselves, with no hand-made animation.

![LEGO set 956, Auto Chassis, from 1978, steered halfway to full lock with its rear axle kept turning at 10 rpm: the red, yellow and blue chassis drives round in a circle, its front wheels turned, its four-cylinder engine's pistons running and its rear tyres skidding round the bend](media/auto-chassis.webp)

## Models

Click a model to open it in the viewer; each opens ready to drag, and some with a part already turning. Models marked WIP load, but don't yet move as they should. Open Details on a card to read what it does, and what to try.

### Official Models

Read straight from their files in the [LDraw Official Model Repository](https://library.ldraw.org/omr), oldest first.

<table>
<tr>
<td align="center" valign="top" width="33%"><a href="https://erik-larsen.github.io/kinebrick/?model=852-Helicopter&autospin=143"><img src="media/thumbs/852-helicopter.webp" width="260" alt="852 Helicopter"></a><h3><a href="https://erik-larsen.github.io/kinebrick/?model=852-Helicopter&autospin=143">852 Helicopter</a><br><sub><i>1977</i></sub></h3>A crank drives both rotors; the pilots’ levers slide the swashplate up and down, pitching the blades.<details><summary>Details</summary><div align="left"><sub>Turn the crank at its side, or Ctrl-click it as the card does, and its gears turn the tail rotor and, through a crown gear, the main rotor, a third as fast; each rotor is a Technic plate gripped by bushes on its shaft. Pull either pilot's lever and the swashplate slides up or down the rotor shaft, its two halves together (the top one turns with the rotor, the bottom one doesn't), and its pitch links tilt both blades alike: collective pitch, as on a real helicopter.</sub></div></details><br></td>
<td align="center" valign="top" width="33%"><a href="https://erik-larsen.github.io/kinebrick/?model=854-Go%20Kart"><img src="media/thumbs/854-go-kart.webp" width="260" alt="854 Go-Kart"></a><h3><a href="https://erik-larsen.github.io/kinebrick/?model=854-Go%20Kart">854 Go-Kart</a><br><sub><i>1978</i></sub></h3>Steers on turntables through a universal joint; rolling it runs its one-cylinder engine.<details><summary>Details</summary><div align="left"><sub>One of the first Technic sets. Its steering wheel turns the front wheels on 2x2 turntables, through a universal joint and a rack, and as it rolls, its rear wheel turns a crank that runs a piston up and down in a block of bricks. Its seat sits on a hinge; its hoses are decoration. Its front wheels turn alike, and its rear wheels share a solid axle, so steered, its tyres scrub; its file allows it 8% (<a href="#options">Tyre scrub</a>), enough to roll with its front wheels turned 15 degrees.</sub></div></details><br></td>
<td align="center" valign="top" width="33%"><a href="https://erik-larsen.github.io/kinebrick/?model=855-Mobile%20Crane&autospin=313,cw"><img src="media/thumbs/855-mobile-crane.webp" width="260" alt="855 Mobile Crane"></a><h3><a href="https://erik-larsen.github.io/kinebrick/?model=855-Mobile%20Crane&autospin=313,cw">855 Mobile Crane</a><br><sub><i>1978</i></sub></h3>The cab slews, the boom luffs, the outriggers slide out, and the winch winds the hook up on its string.<details><summary>Details</summary><div align="left"><sub>Its cab slews on a turntable, and a crank on the cab raises and lowers the boom; its four outriggers slide out on tiles; its cab's shutters swing on finger hinges. Its winch, the crank at the back of the cab, winds its string in or out, which runs over a pulley at the boom tip, down round a pulley on the hook, and back up: so the hook rises or falls half as far as the string winds, straight down beneath the boom tip as the boom slews and luffs. The card opens it winding the hook up.</sub></div></details><br></td>
</tr>
<tr>
<td align="center" valign="top" width="33%"><a href="https://erik-larsen.github.io/kinebrick/?model=952-Tractor"><img src="media/thumbs/952-tractor.webp" width="260" alt="952 Tractor"></a><h3><a href="https://erik-larsen.github.io/kinebrick/?model=952-Tractor">952 Tractor</a><br><sub><i>1978</i></sub></h3>Big driving rear wheels, steering through a universal joint, and a hitch raised by a lever.<details><summary>Details</summary><div align="left"><sub>Its big rear wheels drive it; its steering column turns the front wheels on turntables through a universal joint and a rack, and the thresher attachment pivots on its frame. A lever beside the seat raises and lowers the hitch, which hangs on both rear half axles. Its front wheels turn alike, so steered, its tyres scrub; its file allows it 7% (<a href="#options">Tyre scrub</a>), enough to roll with its front wheels turned 40 degrees.</sub></div></details><br></td>
<td align="center" valign="top" width="33%"><a href="https://erik-larsen.github.io/kinebrick/?model=956-Auto%20Chassis"><img src="media/thumbs/956-auto-chassis.webp" width="260" alt="956 Auto Chassis"></a><h3><a href="https://erik-larsen.github.io/kinebrick/?model=956-Auto%20Chassis">956 Auto Chassis</a><br><sub><i>1978</i></sub></h3>Rolling it runs a four-cylinder engine; rack and tie-rod steering.<details><summary>Details</summary><div align="left"><sub>As it rolls, its drive shaft turns a four-cylinder engine, the pistons running up and down; its steering wheel turns the front wheels through a double universal joint, a guided rack and tie rods; its seats slide on racks. Its rear axle has no differential, so steered, its rear tyres skid round the bend. Its front wheels turn alike, rather than the inner one further, so at full lock, about 33 degrees, where its front tyres meet its chassis, its tyres scrub sideways by about a twentieth of how far they roll; its file allows it 6% (<a href="#options">Tyre scrub</a>), where most models get 2%.</sub></div></details><br></td>
<td align="center" valign="top" width="33%"><a href="https://erik-larsen.github.io/kinebrick/?model=856-Bulldozer&autospin=12"><img src="media/thumbs/856-bulldozer.webp" width="260" alt="856 Bulldozer"></a><h3><a href="https://erik-larsen.github.io/kinebrick/?model=856-Bulldozer&autospin=12">856 Bulldozer</a><br><sub><i>1979</i></sub></h3>Runs on two chain tracks, and turns by skidding them.<details><summary>Details</summary><div align="left"><sub>It runs on two tracks of chain tread links, each round two 40 tooth gears. Turn a track's gear, or Ctrl-click it as the card does, and the track runs round, its links going round with it, and the bulldozer turns, skidding its tracks as a real one does. Its bucket's plates slot into grooves in its tipper ends.</sub></div></details><br></td>
</tr>
<tr>
<td align="center" valign="top" width="33%"><a href="https://erik-larsen.github.io/kinebrick/?model=950-Fork%20Lift"><img src="media/thumbs/950-fork-lift.webp" width="260" alt="950 Fork-Lift Truck"></a><h3><a href="https://erik-larsen.github.io/kinebrick/?model=950-Fork%20Lift">950 Fork-Lift Truck</a><br><sub><i>1979</i></sub></h3>A crank runs the forks up the mast on racks; it steers through a crown gear.<details><summary>Details</summary><div align="left"><sub>Its steering wheel turns a crown gear, which steers the wheels on turntables through a rack. A crank raises the forks, which ride up the mast on racks, 10 LDU per radian, until the gears reach the end of the teeth.</sub></div></details><br></td>
<td align="center" valign="top" width="33%"><a href="https://erik-larsen.github.io/kinebrick/?model=8880-Super%20Car&autospin=1401"><img src="media/thumbs/8880-super-car.webp" width="260" alt="8880 Super Car"></a><h3><a href="https://erik-larsen.github.io/kinebrick/?model=8880-Super%20Car&autospin=1401">8880 Super Car</a><br><sub><i>1994</i></sub></h3>Four-wheel drive through three differentials, four-wheel steering, a four-speed gearbox and a V8.<details><summary>Details</summary><div align="left"><sub>1411 parts. Push it, or turn a wheel, and all four wheels drive it, through grooved balls in their hubs and three differentials. Its four-speed gearbox: slide either of its two driving rings to one side or the other, and as the car rolls its V8 turns 2.25, 1.5, 0.75 or 0.5 times per turn of the wheels; with both in the middle, the engine stays still. Its steering wheel turns the front wheels one way and the rear ones the other, about half as far; each pair turns alike, so steered, its tyres scrub, and its file allows it 4% (<a href="#options">Tyre scrub</a>), enough to roll at full lock. Its bodywork is set at angles on swivel and finger hinges, its seats tip on hinge plates, and its headlights pop up on a knob. Its file in the OMR has four mistakes, which KineBrick found because parts wouldn't attach or wouldn't mesh: an axle, a pin and a bracket out of place, and a plate missing under the rear steering rack. They're put right in <code>models/</code>, each with a comment saying how (the rear steering rack as the <a href="https://bricksafe.com">Bricksafe</a> reconstruction of the set builds it). The card opens it driving along.</sub></div></details><br></td>
<td align="center" valign="top" width="33%"><a href="https://erik-larsen.github.io/kinebrick/?model=8448-Super%20Car-V8%20engine"><img src="media/thumbs/8448-super-car-v8-engine.webp" width="260" alt="8448 V8 engine"></a><h3><a href="https://erik-larsen.github.io/kinebrick/?model=8448-Super%20Car-V8%20engine">8448 V8 engine</a><br><sub><i>1999</i></sub></h3>Eight pistons in two banks on a flat-plane crankshaft.<details><summary>Details</summary><div align="left"><sub>The engine from LEGO set 8448, Super Street Sensation, as built in the LDraw Official Model Repository. Eight pistons in two banks run on a flat-plane crankshaft; turning the crankshaft, by its 24 tooth gear or its fan, takes all eight through their strokes.</sub></div></details><br></td>
</tr>
<tr>
<td align="center" valign="top" width="33%"><a href="https://erik-larsen.github.io/kinebrick/?model=8448-Super%20Car"><img src="media/thumbs/8448-super-car.webp" width="260" alt="8448 Super Street Sensation"></a><h3><a href="https://erik-larsen.github.io/kinebrick/?model=8448-Super%20Car">8448 Super Street Sensation</a><br><sub><i>1999</i> · WIP</sub></h3>1290 parts. It loads, but doesn’t move as it should yet.<details><summary>Details</summary><div align="left"><sub>WIP. the whole car from the same set, 1290 parts, its hoses and shock absorber springs included. It loads, but KineBrick doesn't understand it yet: 82 parts it can't attach (long pins with stop bushes, friction pins, bent liftarms, cross blocks and universal joints among them), and its racing tyres. Being from 1999, it comes late in M7.</sub></div></details><br></td>
</tr>
</table>

### Test models

Built for KineBrick, each to try one kind of mechanism.

<table>
<tr>
<td align="center" valign="top" width="33%"><a href="https://erik-larsen.github.io/kinebrick/?model=simple-car"><img src="media/thumbs/simple-car.webp" width="260" alt="Simple car"></a><h3><a href="https://erik-larsen.github.io/kinebrick/?model=simple-car">Simple car</a></h3>Push it and it rolls, its wheels turning against the ground.<details><summary>Details</summary><div align="left"><sub>Drag the frame and it rolls along its length, its wheels turning by distance ÷ tyre radius; turn a tyre and the car rolls with it.</sub></div></details><br></td>
<td align="center" valign="top" width="33%"><a href="https://erik-larsen.github.io/kinebrick/?model=geared-car"><img src="media/thumbs/geared-car.webp" width="260" alt="Geared car"></a><h3><a href="https://erik-larsen.github.io/kinebrick/?model=geared-car">Geared car</a></h3>Rolling it spins a second axle the other way through two gears.<details><summary>Details</summary><div align="left"><sub>The same car with two 8 tooth gears inside, so rolling the car spins a second axle the other way.</sub></div></details><br></td>
<td align="center" valign="top" width="33%"><a href="https://erik-larsen.github.io/kinebrick/?model=gear-train"><img src="media/thumbs/gear-train.webp" width="260" alt="Gear train"></a><h3><a href="https://erik-larsen.github.io/kinebrick/?model=gear-train">Gear train</a></h3>8, 24 and 40 tooth gears, turning at the right ratios.<details><summary>Details</summary><div align="left"><sub>8, 24 and 40 tooth gears on a Technic brick. Turning any gear turns the others at the right ratios (the 40 tooth gear turns 1/5 as far as the 8 tooth gear).</sub></div></details><br></td>
</tr>
<tr>
<td align="center" valign="top" width="33%"><a href="https://erik-larsen.github.io/kinebrick/?model=right-angle"><img src="media/thumbs/right-angle.webp" width="260" alt="Right-angle drive"></a><h3><a href="https://erik-larsen.github.io/kinebrick/?model=right-angle">Right-angle drive</a></h3>Two bevel gears meshing at a right angle.<details><summary>Details</summary><div align="left"><sub>Two 12 tooth double bevel gears meshing at a right angle, one on a horizontal axle and one on a vertical axle.</sub></div></details><br></td>
<td align="center" valign="top" width="33%"><a href="https://erik-larsen.github.io/kinebrick/?model=differential"><img src="media/thumbs/differential.webp" width="260" alt="Differential"></a><h3><a href="https://erik-larsen.github.io/kinebrick/?model=differential">Differential</a></h3>Freeze the input, and one output turns the other backwards.<details><summary>Details</summary><div align="left"><sub>A differential on a stand, driven by an 8 tooth gear. Turning the input turns both outputs together. Freeze the input (Alt-click it) and turning one output turns the other the opposite way.</sub></div></details><br></td>
<td align="center" valign="top" width="33%"><a href="https://erik-larsen.github.io/kinebrick/?model=steering-car"><img src="media/thumbs/steering-car.webp" width="260" alt="Steering car"></a><h3><a href="https://erik-larsen.github.io/kinebrick/?model=steering-car">Steering car</a></h3>Steer it, push it, and it drives round a circle on its differential.<details><summary>Details</summary><div align="left"><sub>A car whose front axle pivots in the middle, turned by a steering wheel through 8 and 24 tooth gears, with big tyres and the differential at the back. Turn the steering wheel, then push the car: it drives round a circle, every wheel at its own speed. The steering stops at about 20 degrees either way, where the front tyres meet the chassis.</sub></div></details><br></td>
</tr>
<tr>
<td align="center" valign="top" width="33%"><a href="https://erik-larsen.github.io/kinebrick/?model=steering-car-solid"><img src="media/thumbs/steering-car-solid.webp" width="260" alt="Steering car, solid rear axle"></a><h3><a href="https://erik-larsen.github.io/kinebrick/?model=steering-car-solid">Steering car, solid rear axle</a></h3>No differential: steered, its rear tyres skid round the bend.<details><summary>Details</summary><div align="left"><sub>The same car with one solid axle at the back, and no differential. Steered, it still rolls round the bend, but its rear tyres skid: the axle turns them alike, though the outer one travels further than the inner one.</sub></div></details><br></td>
<td align="center" valign="top" width="33%"><a href="https://erik-larsen.github.io/kinebrick/?model=ackermann-car"><img src="media/thumbs/ackermann-car.webp" width="260" alt="Ackermann car"></a><h3><a href="https://erik-larsen.github.io/kinebrick/?model=ackermann-car">Ackermann car</a></h3>Rack and pinion steering; the inside wheel turns further.<details><summary>Details</summary><div align="left"><sub>A wide car whose front wheels each turn on their own kingpin. The steering wheel's 8 tooth gear slides a rack, and a steering link on ball joints at each end of the rack pulls a steering arm that points back and in, at the middle of the rear axle. At full lock, 30 LDU of rack travel, the inside wheel turns 30 degrees and the outside one 20, and pushed, the car drives round a circle with every tyre scrubbing sideways by under 1% of how far it rolls.</sub></div></details><br></td>
<td align="center" valign="top" width="33%"><a href="https://erik-larsen.github.io/kinebrick/?model=worm-drive"><img src="media/thumbs/worm-drive.webp" width="260" alt="Worm drive"></a><h3><a href="https://erik-larsen.github.io/kinebrick/?model=worm-drive">Worm drive</a></h3>The worm turns the gear, but the gear can’t turn the worm.<details><summary>Details</summary><div align="left"><sub>A worm driving a 24 tooth gear, one tooth per turn of the worm. Turning the gear does nothing: a worm can't be driven from its gear.</sub></div></details><br></td>
</tr>
<tr>
<td align="center" valign="top" width="33%"><a href="https://erik-larsen.github.io/kinebrick/?model=gearbox"><img src="media/thumbs/gearbox.webp" width="260" alt="Two-speed gearbox"></a><h3><a href="https://erik-larsen.github.io/kinebrick/?model=gearbox">Two-speed gearbox</a></h3>Slide the driving ring to change gear.<details><summary>Details</summary><div align="left"><sub>An input axle with 8 and 16 tooth gears, driving a 24 and a 16 tooth clutch gear that freewheel on the output shaft, with a driving ring between them. Slide the ring towards the 24 tooth gear for first gear (the output turns a third as far as the input), towards the 16 tooth gear for second (as far as the input), or to the middle for neutral (the output stays put).</sub></div></details><br></td>
<td align="center" valign="top" width="33%"><a href="https://erik-larsen.github.io/kinebrick/?model=single-piston-engine"><img src="media/thumbs/single-piston-engine.webp" width="260" alt="Single-cylinder engine"></a><h3><a href="https://erik-larsen.github.io/kinebrick/?model=single-piston-engine">Single-cylinder engine</a></h3>A crank, connecting rod and piston.<details><summary>Details</summary><div align="left"><sub>A crank on an axle drives a piston up and down its cylinder through a connecting rod. Turning the crank once moves the piston down its one-stud stroke and back; pushing the piston turns the crank, except at the top and bottom of its stroke.</sub></div></details><br></td>
<td align="center" valign="top" width="33%"><a href="https://erik-larsen.github.io/kinebrick/?model=four-bar"><img src="media/thumbs/four-bar.webp" width="260" alt="Four-bar linkage"></a><h3><a href="https://erik-larsen.github.io/kinebrick/?model=four-bar">Four-bar linkage</a></h3>The crank turns all the way round; the far beam rocks.<details><summary>Details</summary><div align="left"><sub>Four beams pinned in a loop on a Technic brick. The short crank turns all the way round, rocking the far beam to and fro through about 63 degrees.</sub></div></details><br></td>
</tr>
<tr>
<td align="center" valign="top" width="33%"><a href="https://erik-larsen.github.io/kinebrick/?model=rack-and-pinion"><img src="media/thumbs/rack-and-pinion.webp" width="260" alt="Rack and pinion"></a><h3><a href="https://erik-larsen.github.io/kinebrick/?model=rack-and-pinion">Rack and pinion</a></h3>The gear slides the rack until it runs out of teeth.<details><summary>Details</summary><div align="left"><sub>An 8 tooth gear on two 1x4 racks, which ride on a plate that slides along a row of tiles between rails. A quarter turn of the gear moves the rack 2 teeth; pushing the rack turns the gear. The rack travels 80 LDU either way, until the gear reaches the end of the teeth, its plate overhanging the tiles.</sub></div></details><br></td>
</tr>
</table>

## Status

Every [milestone](#milestones) of version 1.0, the kinematics, is done but M7.

**Under way: M7, real LEGO sets, oldest first.** Every set under [Models](#models) works in full, except the 8448 Super Street Sensation (WIP); its V8 engine works on its own. Next: more sets.

**Done:**

- Rolling on tyres, gear trains, bevel gears and differentials (M1–M3)
- Steering: a pivoting axle, rack and pinion, and Ackermann steering, the inside wheel turning further (M4, M6.2, M6.3)
- Collisions: parts can't pass through each other (M4.5)
- Worms, clutches and gearboxes (M5)
- Closed loops of parts, such as an engine's crank, connecting rod and piston, that stay together however long they run (M6.1)
- Chains and tracks, on which the bulldozer runs (M8)
- Strings and rubber bands: the crane's winch raises and lowers its hook (M9)

The models' files are in [`models/`](models/).

## What KineBrick is, and isn't

- **It is** a mechanism inferrer. Each LEGO part gets a description of what it can do (an axle turns in a round hole, a tyre rolls on the ground). KineBrick reads where the parts sit in the model, decides how they connect, and solves how they move together.
- **It is** iterative. Part types are added one at a time, starting with the ones that move. A brick that only holds things together needs no special treatment: it moves with whatever it's attached to.
- **It isn't** a new 3D viewer. Rendering comes from [three.js](https://threejs.org) and its `LDrawLoader`.
- **It isn't** a general physics engine. Movement comes from the mechanism's geometry (kinematics). Forces, springs and mass come in version 2.0, through an existing physics engine rather than our own.

## How it works

KineBrick looks up each part's connection points (where its holes, axles, pins and studs are), finds the ones that line up, and groups parts that move together into bodies. Bodies are joined by joints: an axle turning in a hole, a beam turning on a pin, a piston sliding in its cylinder. Each joint, each pair of meshing gears and each tyre on the ground gives equations between the bodies' speeds, and whatever motion the equations leave free is what you can drive. When you drag a part, KineBrick moves the mechanism along that motion in small steps, and stops where two parts would run into each other.

The details, from the connection table and part roles to how a drag decides what to move, are in [ARCHITECTURE.md](ARCHITECTURE.md).

## Interaction

Everything happens in the 3D view: drag parts with the mouse or a finger. A part only moves the ways its mechanism allows, and everything connected follows. Pressing a part shows how it can move, with an arc for turning or an arrow for pushing. Dragging empty space turns the camera.

| Do this | And |
|---|---|
| Hover over a part | It glows yellow, the rest of its body faintly, and a label gives its number, name, role and body. |
| Drag a part that spins on an axle (a gear, a crank, a wheel) | It turns like a knob, following the pointer round its axle. |
| Drag any other part (a frame, a piston, a rack, a linkage's middle beam) | It's pushed along the way it can move: a car rolls, a piston turns its crank (except at dead centre, top and bottom of its stroke). |
| Drag a gearbox's driving ring | It clicks into the nearest gear. |
| Ctrl-click a part that spins on an axle | It keeps turning on its own, like a motor, counter-clockwise as you look at it, at the **Spin speed** set in the Options panel (whole rpm, 15 unless set). When it gets as far as it can go (it runs into something, or a slide or rack reaches its end), it turns back, so a crane's hook goes up and down for as long as you leave it. Ctrl-click it again to reverse, a third time to stop, or use **Reverse** and **Stop**, which show in the Options panel while it turns. One part turns at a time, and the camera follows the model while it turns. The address keeps it too ([Auto spin](#options)), so a link to the page shares the animation. |
| Alt-click (Option-click on a Mac) a part | Its body is frozen until you Alt-click it again, or click **Unfreeze all** in the Options panel. Useful where a mechanism can move more than one way: freeze a differential's input, and turning one output turns the other the opposite way. |
| Click **Reset** in the Options panel | The model goes back as it was loaded, any motor stops, and the camera goes back to where it started. |

Parts a drag doesn't need stay put: pushing a car leaves its steering alone, and turning its steering wheel leaves the car where it is. Motion stops where two parts would run into each other, or at the end of a slide's travel or a rack's teeth, and those two parts flash red; it stops too where a part would go below the ground (a crane's hook let down too far), and that part flashes red. A part that can't move at all says why: the mechanism is jammed, a worm can't be driven from its gear, or the model has no wheels to roll on. Let go, and the model stays where it is; momentum waits for forces in 2.0.

The **Readout**, which opens under the model's summary, shows how far the frame has moved and each body has turned or slid, so the motion can be checked by eye. A wheel on the ground also shows how far it rolled ÷ its radius, which its turn should match.

Each kind of information has its own channel: fill colour shows the parts' LEGO colours, a yellow glow what the pointer is on, and an outline their status (cyan frozen, green kept turning, red loose), with a 📌 or ⚠ badge pinned to frozen and loose parts. Outlines show through other parts in a darker shade.

### Options

These are off, or at their usual values, unless you set them, in the Options panel at the top right or in the address, so the published viewer shows the plain model. Switching model keeps them, except Auto spin and Tyre scrub, which belong to a model.

- **Body colours** (`option=bodycolours`): each body in its own colour instead of the parts' LEGO colours, the frame grey.
- **Joint axes** (`option=axes`): each joint's axis as a thin pink rod.
- **Gear contacts** (`option=contacts`): a pink dot where each pair of gears' teeth meet.
- **Spin speed** (`rpm=60`): how fast Ctrl-click turns a part, in whole revolutions per minute.
- **Auto spin** (`autospin=271`, or `autospin=271,cw`): a part kept turning from the moment the page opens, as if Ctrl-clicked, by its place in the model file: the number the hover label gives it (counting from 0, submodels flattened). It turns counter-clockwise as seen from where the camera starts, or with `,cw` clockwise. Ctrl-click, Reverse and Stop keep it up to date, so copying the address shares the animation. Switching model drops it.
- **Tyre scrub** (`scrub=10`): how far tyres may slide sideways, as a percentage of how far they roll. It's 2% unless the model says otherwise (see below), and switching model goes back to the new model's own. More lets a car whose steering is far from every wheel turning round one centre roll at bigger steering angles; too much would let a car with no steering at all turn.

A model file can carry KineBrick's own settings as LDraw meta-commands, which other LDraw programs skip. `0 !KINEBRICK SCRUB [percent=6]` in its main file sets its tyre scrub (the 956 Auto Chassis has it, the 952 Tractor 7%, the 8880 Super Car 4% and the 854 Go-Kart 8%, their front wheels turning alike). A real LEGO set's lines are kept in `models/sets.json`, by its name in `models/`, rather than edited into its file: `npm run data` puts them there, so a fresh copy from the OMR gets them too.

For example, `?model=8448-Super%20Car-V8%20engine&option=bodycolours,axes&rpm=60` opens the V8 with body colours and joint axes on, spinning at 60 rpm.

## Milestones

Each milestone ends with a model that moves correctly and a test that checks it.

| # | Milestone | Done when |
|---|---|---|
| M0 | Viewer and connection debug view | The test car loads. Each body is drawn in its own colour and each joint shows its axis. Hovering a part highlights it, tints its body, and labels it with its number, name, role and body. |
| M1 | Rolling car | Pressing a frame part of the test car shows an arrow along the car's length. Dragging either 1x4 brick rolls the car in the direction of the drag, and all four wheels turn by the right amount (distance ÷ tyre radius), shown in the readout. Straight line only. |
| M2 | Spur gears | Gear trains on parallel axles turn at the right ratios. Pushing the car can drive a gear train. Dragging any spinning part (a gear, a crank, a tyre) turns it along an arc about its axle, and the rest of the mechanism follows. |
| M3 | Bevel gears and differential | Right-angle drives work. A differential lets the two wheels on one axle turn at different speeds. |
| M4 | Steering | The front axle pivots in the middle, like a wagon's, turned by a gear on a steering column. Pushing the steered car makes it follow a curve, each wheel turning at its own speed; the rear wheels are on a differential. The same car with a solid rear axle rolls round bends too, its rear tyres skidding. |
| M4.5 | Collisions | Parts stop when they'd run into each other: the steering car's front wheels stop at the chassis, about 20 degrees either way. No part of any test model passes through another. |
| M5 | Worm gears, clutches, gearboxes | A worm turns its gear one tooth per turn and locks when driven from the gear. A two-speed gearbox shifts by sliding its driving ring: first gear turns the output a third as far as the input, second as far, and in neutral the output stays put. Clutches that slip under load wait for forces in 2.0. |
| M6 | Linkages | In three parts, below. These need sliding joints, ball joints, and closed loops of parts kept together. |
| M6.1 | Loops | A single-cylinder engine runs: turning its crank all the way round moves the piston up and down its cylinder, and pushing the piston turns the crank until dead centre. A four-bar linkage of beams on pins (a crank that turns all the way round, rocking a beam to and fro) moves through its full range. After many turns, no joint has drifted apart. |
| M6.2 | Rack and pinion | Turning a gear slides a rack along: a quarter turn of an 8 tooth gear moves the rack 2 teeth. Pushing the rack turns the gear. The racks ride on a plate sliding along tiles between rails, which may overhang them, and stop when the gear reaches the end of the teeth. |
| M6.3 | Ackermann steering | Rack and pinion steering, with steering links on ball joints to a steering arm at each front wheel. Each front wheel pivots on its own, the inside one turning further, so pushing the steered car makes every wheel roll round about the same centre. Tyres may scrub sideways a little, as real ones do. |
| M7 | Real models, oldest first | LEGO Technic sets from the LDraw Official Model Repository load and move as they should, taken in the order they came out, starting with the first Technic sets of 1977, so the basic parts are covered before later ones. Models load straight from multi-part files (MPD), with their submodels and the parts they bring with them. Each set that works joins the tests. |
| M8 | Chains and tracks | A chain or track couples its sprockets like gears that turn the same way, its links moving round the loop. A tracked vehicle turns by skidding its tracks sideways. |
| M9 | Belts, pulleys and strings | A rubber band couples its pulleys by their sizes, and a crossed one reverses them. A string wound on a winch drum and run over pulleys raises a hook as the drum turns, by less through a block and tackle. The hook hangs straight down. |

With M9 the kinematics is complete: version 1.0. Version 2.0 adds forces, through the [MuJoCo](https://mujoco.org) physics engine: momentum, springs that spring, clutches that slip under load.

A car with two fixed axles can't turn without its tyres sliding sideways, which is why M1 is straight-line only and turning waits for steering in M4. Steering alone isn't enough either: in a turn the inside wheels travel a shorter path than the outside ones, so two wheels on one solid axle can't both roll without slipping. Real LEGO cars just scrub their tyres. A tyre on its own axle never slips along the way it rolls in KineBrick, so the M4 car has a differential at the back and each front wheel spinning on its own stub axle; tyres sharing a solid axle may skid that way, as on a real car, one back and the other forward, rolling without slipping only on average. Sideways, a tyre may scrub by up to 2% of how far it rolls, since real steering only gets close to every wheel rolling round one centre (Ackermann steering, M6.3); a car whose tyres would scrub more than that won't roll, unless its model allows more ([Tyre scrub](#options)).

### Later

- **Marching ants for loose parts.** A loose part's own edge lines drawn dashed and crawling, on top of its red outline. Motion draws the eye, and it would only appear when something's wrong.
- **Suggest a fix for a loose part.** For a part that isn't attached, find the nearest position where its anti-studs would land on studs, and suggest moving it there ("move 10 LDU along z to sit on the plate"). Suggest only; KineBrick doesn't edit models.

## Getting started

You need [Node.js](https://nodejs.org) (which comes with `npm`).

1. Install the dependencies: `npm install`
2. Start the viewer: `npm run dev`, then open the address it prints. Pick a test model from the menu at the top left.

The viewer doesn't need the LDraw parts library: each test model is packed, with every part it uses, into one file in `packed/`. The libraries are only needed to rebuild the data after changing a test model (see below).

The project uses plain TypeScript, and [Vite](https://vite.dev) as its development server: Vite serves the code to the browser, converts TypeScript to JavaScript as it goes, and reloads the page whenever a file is saved.

Other commands:

- `npm test` runs the tests.
- `npm run build` builds the site into `dist/`. Every push to `main` runs the tests, then builds and publishes it to GitHub Pages (see `.github/workflows/pages.yml`). If a test fails, the live site stays as it was.
- `npm run data` rebuilds the [connection table](ARCHITECTURE.md#the-connection-table) and the packed models, after adding or changing a test model (an `.ldr`, or an `.mpd` with submodels, in `models/`). First it brings in any real LEGO set newly downloaded from the [LDraw Official Model Repository](https://library.ldraw.org/omr) into `models/`: `956 - Auto Chassis.mpd` becomes `956-Auto Chassis.mpd`, replacing an older copy, and so do the names of the files inside it; and it gives every set KineBrick's own lines for it from `models/sets.json` (see [Options](#options)). It needs both libraries in the project folder (neither is committed):
  - the LDraw parts library: download [complete.zip](https://library.ldraw.org/library/updates/complete.zip) and unzip it, so you have `ldraw/parts`, `ldraw/p` and `ldraw/LDConfig.ldr`;
  - the LDCad shadow library: `git clone --depth 1 https://github.com/RolandMelkert/LDCadShadowLibrary.git ldcad-shadow`.

## Data sources and licenses

| Source | Used for | License |
|---|---|---|
| [LDraw parts library](https://library.ldraw.org) | Part shapes and connection primitives; the packed models in `packed/` include the parts they use | CC BY 4.0 |
| [three.js](https://threejs.org) | Rendering and LDraw loading | MIT |
| [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) | Fast tests of whether two parts' shapes overlap | MIT |
| [LDCad shadow library](https://github.com/RolandMelkert/LDCadShadowLibrary) | Connection points in the [connection table](ARCHITECTURE.md#the-connection-table) | CC BY-SA 4.0 |
| [LDraw Official Model Repository](https://library.ldraw.org/omr) | The real LEGO sets in `models/`: 852 Helicopter by Allard van Efferen; 854 Go-Kart by Stefan Frenz; 855 Mobile Crane and 856 Bulldozer by Marc Giraudet; 950 Fork-Lift Truck by Merlijn Wissink; 952 Tractor by Nathan Perry; 956 Auto Chassis by N. W. Perry; 8880 Super Car, and 8448 Super Street Sensation and its V8 engine, by Orion Pobursky | CC BY 2.0 (CCAL 2.0) |

## Prior art

- **[SR 3D Builder](https://wiki.ldraw.org/wiki/Sr3d).** Windows LEGO CAD that could animate gears, hinges and pistons. Discontinued, and its own website is gone, so this links to the LDraw wiki.
- **[LDCad](https://www.melkert.net/LDCad).** LEGO CAD whose animations are written by hand in Lua for each model.
- **[TechnicBrickPower gear calculator](https://www.eurobricks.com/forum/forums/topic/186656-new-technic-gear-ratio-calculator-tool).** Web tool that finds the gear trains in an LDraw file and shows their ratios. Gears only, and no live animation.
- **[yoff/LegoTechnicSimulation](https://github.com/yoff/LegoTechnicSimulation).** Python tool that finds bodies, joints and gear meshes in an LDraw file and exports them to Blender or MuJoCo. Like KineBrick's connection table, it gets connection points from LDraw primitives. Its code can't be reused directly: it's Python, and it has no license.

## License

The code is [MIT](LICENSE). The connection table is derived from the LDCad shadow library, so it is shared under the same license, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). The real LEGO set models are from the LDraw Official Model Repository, by the authors listed above, under [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/).
