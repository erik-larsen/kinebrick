# MuJoCo spike: every friction pin a real hinge

A measurement, made on 2026-11-13, not a product. Nothing under `src/` changed. The question: can MuJoCo move a Kinebrick mechanism with every friction pin a hinge with dry friction, so that forces decide which pin turns, quickly and stably enough to be worth planning for?

## The answer

**Yes, it runs, but it does not remove the complexity; it moves it.** All three sets ran 10 simulated seconds without blowing up, stood on their wheels, kept a plain gear train's ratios to within 1%, and a push on the 8880's seat back tilted it while the car's other 67 friction pins held. But under gravity much of each model falls: lids swing through the body, a crane's boom drops onto its end stops and its extension runs out. Nothing holds them because Kinebrick does not infer what holds them in a real model: parts resting on parts, end stops, springs, and worms and screws that cannot be driven backwards. The largest set runs at 0.3 times real time natively, so about 0.1 in a browser (an estimate). And where a mechanism has a free choice (an open differential), dynamics answers by load, not by the rates the function lists store.

Recommendation: keep MuJoCo where the plan has it, as phase 5's backend for springs and forces, behind the kinematic solver, not in place of it. Before it can hold a pose, inference must supply four new things (see [What inference would still have to supply](#what-inference-would-still-have-to-supply)). The friction-pins-on-demand rule of decision 12 stays.

## What was built

- `scripts/export-mjcf.ts` reads a set as the check does (`loadModel`, run with `KINEBRICK_FRICTION_RIGID=0`) and writes `mjcf-out/<set>.xml` (the MuJoCo model) and `mjcf-out/<set>.json` (part to body, controls, stored rates). `mjcf-out/` is not committed. The OMR sets are read from `omr/`, which is not committed either; in a worktree, a link to the main checkout's `omr/` works.
- `scripts/mujoco-spike.py` runs the measurements in native MuJoCo 4.0.1 from Python.

```bash
KINEBRICK_FRICTION_RIGID=0 npx tsx scripts/export-mjcf.ts 8880
```

```bash
python3 -m venv .venv-mujoco && .venv-mujoco/bin/pip install mujoco numpy
```

```bash
.venv-mujoco/bin/python scripts/mujoco-spike.py stand 8880 --seconds 10
```

```bash
.venv-mujoco/bin/python scripts/mujoco-spike.py gear 42049 --fn 2 --torque 0.02
```

```bash
.venv-mujoco/bin/python scripts/mujoco-spike.py seat 8880 --held --force 0.5 --frictions 0.005,0.01,0.015,0.02
```

How the Mechanism becomes a MuJoCo model:

| In the Mechanism | In MuJoCo |
|---|---|
| Rigid body | A body. Mass 2.5 g a part; inertia of a solid box round its parts' origins, 10 LDU wider each way. |
| The frame | The tree's root, with a free joint, so the model can stand and roll. |
| Joints | A spanning tree from the frame. A joint in the tree is a hinge, slide or ball in its child body. A joint that closes a loop is a small "ghost" body (0.1 g) hung on one side by the same joint and welded to the other side, so a friction pin that closes a loop keeps its friction. A ball that closes a loop is a `connect`. |
| Friction pin (`stiff`) | A hinge with `frictionloss` (0.005 N m unless stated). A motor's joint too. |
| Gear mesh (spur, bevel, crown, rack, worm) | A tie: each gear's pitch point moves at the same speed along the way the teeth push. Written over the joints between the two gears in the tree: a joint equality with the ratio where two joints are involved, else a fixed tendon held at its length (a differential, a gear on a turning carrier). A worm's push leans with its thread. |
| Universal joint | A ghost cross on two hinges, welded to the far shaft (or, where the shaft hangs on nothing else, in the tree). Where only the turning is tied (`turningOnly`), the cross may also slide every way. |
| Chain or belt round wheels | A tie: each wheel's rim moves at the same speed. |
| Linear actuator's screw | A tie: the piston slides `lead` per turn of the input. |
| Tyre tread | A cylinder, the only shape that collides, against a ground plane. Gravity on. |

## The sets

Every friction pin free (`KINEBRICK_FRICTION_RIGID=0`). The 8880 is Kinebrick's own `models/8880-Super Car.mpd`, as the check reads it; the others are OMR files.

| | 8880 | 42049 | 42082 |
|---|---|---|---|
| Mechanism bodies | 178 | 88 | 673 |
| Mechanism joints (revolute / slide / ball) | 233 (198 / 10 / 25) | 132 (122 / 4 / 6) | 1,062 (1,030 / 23 / 9) |
| Friction-pin joints | 68 | 20 | 165 (and 1 motor) |
| Gears / meshes | 60 / 33 | 14 / 6 | 139 / 78 |
| Universal joints / chains / screws | 6 / 1 / 0 | 2 / 0 / 0 | 7 / 2 (no tie) / 6 |
| MuJoCo bodies (with ghosts) | 230 | 133 | 1,069 |
| MuJoCo joints / degrees of freedom | 242 / 265 | 135 / 144 | 1,081 / 1,088 |
| Equality constraints | 97 | 53 | 481 |
| of which weld / connect / joint / tendon | 46 / 16 / 21 / 14 | 43 / 4 / 5 / 1 | 389 / 8 / 31 / 53 |
| Constraint rows at rest | about 430 | about 300 | about 2,600 |
| Time to read the set and write the file (Node) | 14 s | 1 s | 157 s |
| Time for MuJoCo to compile it | 0.01 s | under 0.01 s | 0.07 s |

Most of the 42082's 157 s is building the mechanism with every friction pin free, which decision 12 makes quicker on another branch.

## Speed and the time step

One step, native, on this Mac (Apple M6), one thread, while a full function check used 10 of its 12 cores (load average 11 to 14): the figures are slower than on an idle machine. The step time hardly changes with the time step; how far the time step can grow decides the speed.

| Set | Step | 0.5 ms | 1 ms | 2 ms | 4 ms |
|---|---|---|---|---|---|
| 8880 | 0.24 ms | 2.1 × real time, loops within 1.2 LDU | 4.2 ×, loops 2.6 LDU | 8.2 ×, loops 52 LDU (comes apart) | blew up at 0.2 s |
| 42049 | 0.17 ms | 2.9 ×, 0.03 LDU | 5.9 ×, 0.02 LDU | 12 ×, 0.06 LDU | 24 ×, 0.13 LDU |
| 42082 | 1.64 ms | 0.30 ×, 8 LDU | 0.60 ×, 35 LDU (comes apart while the boom falls) | blew up at 6.1 s | blew up at 0.8 s |

A larger time step also makes dry friction softer (see [What broke](#what-broke-and-what-was-tuned)): at 1 ms on the 8880, 21 friction pins turned more than 1 degree where 14 did at 0.5 ms. So 0.5 ms is the step used for every other figure here. It is the largest that keeps the 42082 together; the 8880 holds at 1 ms and the 42049 at 4 ms.

## Standing for 10 seconds

On its wheels under gravity, 0.5 ms steps, frictionloss 0.005 N m on every friction pin.

| | 8880 | 42049 | 42082 |
|---|---|---|---|
| Stayed stable | yes | yes | yes |
| Frame sank / tilted | 17 LDU / 0.03° | 1 LDU / 0.06° | 2 LDU / 0.01° |
| Wheel contacts at the end | 8 | 8 | 12 |
| Largest gap in any loop, at any time | 1.2 LDU (weld turned 0.9°) | 0.03 LDU | 8 LDU (weld turned 1.2°) |
| Largest error of any tie | 0.0004 | 0.00003 | 0.027 |
| Bodies that moved more than 5 LDU in the frame | 49 of 178 | 2 of 88 | 131 of 673 |
| Furthest a body moved in the frame | 405 LDU | 24 LDU | 6,419 LDU |
| Friction pins that turned more than 1° | 14 of 68 | 0 of 20 | 1 of 165 |

So all three stand on their wheels and their loops hold together, but what moves is not what should:

- **8880**: the rear body and its covers, on hinge plates (2429, 2430) and friction pins, swing about 400 LDU, through the car; the suspension, with no springs, lets the car sink 17 LDU; the seat back falls flat under its own weight. In the real car the covers rest on the body and the suspension is sprung. With 3 times the friction (0.015 N m) the seat back holds, but the rear body still swings and 13 pins still turn, dragged by it.
- **42049**: holds well. Two small parts on free joints swing 24 LDU.
- **42082**: the boom (143 parts) drops 45° in 0.4 s and stops on its linear actuators' end stops; the boom's extension slides out without end (6,400 LDU by 10 s: its slide has no range in the Mechanism); the hook swings at its tip. The linear actuators and the extension's rack are driven backwards by the boom's weight: a MuJoCo tie works both ways with no loss, where a real screw or worm locks.

## The 8880's seat back

The seat back (the body that holds part p1094, 14 parts; its 4 friction pins are one joint in the Mechanism) was pushed for 1 second, sideways to its hinge, with 0.5 N at its centre of mass: 0.018 N m about the hinge. Then released for 0.5 s. Every friction pin had the same frictionloss.

| Frictionloss (N m) | Seat back turned, frame held | Largest turn of any other friction pin, frame held | Seat back turned, car on its wheels | Largest other friction pin, on its wheels |
|---|---|---|---|---|
| 0.002 | 162° | 42° | | |
| 0.005 | 176° (fell flat under its own weight) | 18° | 163° | 0.2° |
| 0.01 | 136° | 0.6° | 134° | 0.5° |
| 0.015 | 130° | 0.6° | 126° | 0.6° |
| 0.02 | 0.1° | 0.6° | 0.1° | 0.6° |
| 0.05 | 0.1° | 0.6° | | |

So yes: at frictionloss 0.01 to 0.015 N m the push tilts the seat back and no other friction pin turns more than 0.6° (the 0.6° is one pin settling, the same with or without the push). The window is narrow: below 0.01 parts fall under their own weight, at 0.02 or more this push is too weak. On its wheels, the same push also rolls the whole car 330 LDU in the second, as a real car with free wheels would; a hand holding the model is what the "frame held" columns stand for. A real friction pin's torque was not measured; 0.01 N m is a guess that fits the model's guessed masses.

## Gear ratios

The frame held still, gravity on, 0.5 s to settle, then a constant torque on the control. A rate is how far a part turned (any axis, against the frame) for each radian the control turned, as the check's `rates` are. Controls turned together get the same torque the same way, as a push along the ground would, and the rate is per radian of their mean.

| Set, function | Torque, time | Part | Stored rate | MuJoCo |
|---|---|---|---|---|
| 42049 fn 2, knob turns the claw through a worm | 0.02 N m, 2 s (control turned 23 rad) | p66 32269 | 0.6 | 0.600 |
| | | p61 94925 | 0.75 | 0.749 |
| | | p286 4716 | 0.75 | 0.748 |
| | | p291 3648b, after the worm | 0.0313 | 0.0312 |
| | | p314 32348, claw jaw | 0.0237 | 0.151 |
| | | p320 32348, claw jaw | 0.0237 | 0.175 |
| 8880 fn 1, four wheels drive three differentials | 0.005 N m, 0.5 s (38 rad) | p302 6573, axle differential | 1 | 1.03 |
| | | p320 6573, axle differential | 1 | 1.03 |
| | | p14 6573, centre differential | 1.5 | 1.59 |
| | | p750 2853, V8 crank, gearbox in neutral | 0 | 0.034 |
| 8880 fn 5, knob steers through gears and universal joints | 0.005 N m, 0.5 s (6.5 rad) | p894 2741, steering wheel | 1 | 0.93 |
| | | p438 6540b, right steering arm | 0.139 | 0.138 |
| | | p429 6540b, left steering arm | 0.152 | 0.53 |
| 42082 fn 2, four wheels drive the V8 | 0.005 N m, 0.5 s (1.4 rad) | p1223 2854, crank | 7 | 6.18 |
| 42082 fn 3, one wheel through a differential | 0.005 N m, 0.5 s (4 rad) | p2284 92912, the other wheel | 1 | 0.82 |
| | | p1223 2854, crank | 7 | 0.54 |

What this says:

- A plain train, worm included, is right to within 1% (42049). The ties held to 0.001 or better.
- The 42049's claw jaws turn 6 to 7 times the stored rate: they hang on free joints, and as the worm moves the arm they swing. Kinebrick's least motion keeps them still; dynamics does not.
- The 8880's differentials are within 3 to 6%. The cause was not found: the gear radii are exactly in proportion to tooth counts. Likely candidates are the four wheels turning at different speeds through open differentials, and the suspension moving under the torque. The V8 turns a little in neutral, through the joints' small damping.
- The 8880's steering: the right arm is right; the left arm turns 3.5 times too far. Not explained.
- The 42082: where the crane's other wheels share the differentials, a torque on four wheels does not turn them all together as the check does, so 6.18 is not comparable with 7. Function 3 shows the deeper point: through an open differential, dynamics sends the turn where the load is least (the other wheel 0.82, the engine 0.54); the kinematic check, with nothing to say which way, stored 1 and 7. The stored rates of a free choice are not facts a dynamics run should reproduce.

## What broke, and what was tuned

One attempt for each set; these are the changes that one attempt needed, and they apply to all three.

1. **The 8880 blew up at 0.2 s.** Light bodies (a single gear's inertia is about 3e-8 kg m², a ghost's 1e-10) on joints with dry friction went unstable. A rotor inertia (`armature`) of 1e-7 kg m² on every joint cured it. Smaller time steps alone did not.
2. **Ties slipped.** MuJoCo's constraints are soft by default (time constant 20 ms, impedance 0.9 to 0.95), and gears slipped by up to a radian under load. Equality constraints now have a time constant of 2 ms and an impedance of 0.99 to 0.999.
3. **Dry friction creeps.** Under a load below its friction, a MuJoCo friction pin does not stay still: it turns slowly, because dry friction is a soft constraint too. With the default, one 8880 pin turned 26° a second at frictionloss 0.05 under its own weight. The stiffest setting MuJoCo allows is a time constant of 2 time steps (1 ms at 0.5 ms steps), which cuts the creep 25 times (0.6° a second for that pin, 0.02° a second for the seat back). It cannot be removed, and it grows with the time step. A pose held by friction alone drifts over minutes.
4. **A shaft that hangs only on its universal joints** (the 42049's) could not be reached by joints alone, so the tree now passes through a universal joint's cross where it must.
5. **A tie written over the wrong joints.** A tie is a linear sum over the joints between its two ends in the tree, worked out as built. If the tree reaches a gear or piston through some other path (a crane's boom pivot), the tie is right only at the start. The tree now takes a gear's axle, a rack's or piston's slide, a screw's input and a chain wheel's axle first: 47 of 50 such joints in the 8880, 20 of 24 in the 42049, 164 of 199 in the 42082. The rest still make ties that drift as the model moves.
6. **Gear ratios off by the gap between gears.** Measured at one shared contact point, a pair's ratio followed how far apart LDraw placed them. Each gear is now measured at its own pitch circle, so the ratio is the tooth counts'.
7. **Two faults in the test itself**, not in MuJoCo: wheels turned together were first given torques about their own axes, which point outwards, so left and right wheels turned against each other through the open differentials; and the rate was first taken against one wheel, not the mean.

## What was left out, and what it would need

| Left out | In these sets | What it would need |
|---|---|---|
| Collision between parts | everywhere | Contact shapes for parts that rest on others (a closed lid, a boom on its rest). MuJoCo could collide every part's shape, but at a large cost in speed; a few chosen contacts or joint end stops are cheaper. Inference would have to say which. |
| End stops on hinges; a range on every slide | 42082's boom extension, every hinge | Ranges for revolute joints and for slides that have none (decision work on steering stops already exists, see [steering-stops.md](steering-stops.md)). MuJoCo has joint limits. |
| Springs and shock absorbers | 8880 suspension | A stiffness and rest position per joint: MuJoCo has joint springs. The plan's phase 5. |
| Worms and screws that lock | 42049 worm, 42082 actuators and boom rack | A tie that works one way only. MuJoCo has no such constraint; a frictionloss on the worm's or screw's own joint, large enough, comes close. |
| Strings (winches, pulleys) | none found in these three | A tendon over sites and wrapping geoms: MuJoCo has spatial tendons with pulleys. The drum's winding would need its own tie. |
| Chains, tracks, rubber bands | 8880's chain tied (2 ties); 42082's 2 loops not tied (no wheel turning on a joint) | Rim ties as here; a track's links touching the ground would need contacts along it. A rubber band also stretches. |
| Universal joints | included (cross on two hinges) | A grooved ball's (turning only) was given a cross that may slide every way; whether that is right for every case is unchecked. |
| Racks | included as ties | A rack that runs off its pinion is not noticed: the tie holds on past the teeth. |
| Clutches, driving rings, gear shifts | 8880 gearbox, 42082 function selector | The tie set changes with the shift. MuJoCo can switch equality constraints on and off while running (`eq_active`), so a shift is a switch, not a new model. Slip clutches would need a tie with a torque limit, which MuJoCo does not have. |
| Rests (push rods on a camshaft) | none in these sets | Contacts. |
| Rails and train wheels | none in these sets | Contacts with the rail heads, or a tie to the track's path. |
| Kinebrick's holds (which joints a drag keeps still) | all | Not needed: friction and gravity stand in for them. But a drag then needs an actuator: a position or velocity servo on the grabbed part, or a weld to a moving target, and its strength decides what else moves. |
| Masses | all | Each part's real mass and shape; 2.5 g a part and a box round the parts' origins are guesses. |

## The judgement

**What MuJoCo would take over.** The tiers that stand in for friction and weight: keeping stiff joints still (dry friction does it, and a strong enough force overcomes it, as the seat back shows), keeping hanging parts level (gravity), tyres not scrubbing (tyre contact with friction). Which friction pin turns would follow from forces, not from a rule. Closing loops, and later springs, shocks and pushing a car along the ground.

**What it would not.** The kinematic answers the function lists check: where a mechanism has a free choice, dynamics answers by load, so the check would need rates that say "under this load", or the kinematic solver would stay as the reference. Exactness: soft constraints let ties slip about 0.001 to 0.02 rad and loops open 0.03 to 8 LDU under load, and friction creeps, so a pose held for minutes drifts. Speed on large sets (below). Changing the mechanism while running: shifts become switched ties, but rebuilding after a part is moved stays Kinebrick's.

**What would still be needed from inference.** Everything the export uses today: bodies, joints, which joints are friction pins, gear meshes and their kinds, couplings, screws, loops. And four things it does not supply yet, without which a dynamics model falls apart under gravity: end stops (hinge ranges, and ranges for every slide), the few contacts that hold a model's pose (lids, booms on their rests), springs, and which worms and screws lock. Plus a mass for each part and a friction torque for each kind of pin, to be measured.

**Speed in a browser.** An estimate, not measured: MuJoCo built for WASM runs about 3 times slower than native on one thread (a factor of 2 to 5 is the usual range for numerical code without SIMD and threads), and a user's machine may be slower than this M6. At 60 frames a second a frame has 16.7 ms.

| Set | Native step | Browser step (native × 3, estimate) | Steps for one frame of real time | Browser time per frame | Real time? |
|---|---|---|---|---|---|
| 42049 | 0.17 ms | 0.5 ms | 4 at 4 ms | 2 ms | yes, easily |
| 8880 | 0.24 ms | 0.7 ms | 17 at 1 ms | 12 ms | just |
| 42082 | 1.64 ms | 4.9 ms | 33 at 0.5 ms | 160 ms | no: about 0.1 × real time |

So the small and middle sets could run live in a browser; the largest could not without a Web Worker and slow motion, or a coarser model (fewer ghosts, fewer friction pins as joints).
