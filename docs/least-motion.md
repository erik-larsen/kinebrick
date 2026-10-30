# Least motion: choosing a drag's motion without holds

A design note and prototype report. The prototype is on the `claude/least-motion` branch, off by default: `?least` in the viewer, `KINEBRICK_LEAST=1` for the tests and scripts.

## The problem

When a drag turns a joint, the mechanism's equations usually leave more than one way for the rest of the model to follow: turning a car's wheel could roll the car, or steer the wheel round its tyre; turning a gear that freewheels on a shaft could turn the gear on the shaft, or the shaft with the gear on it. The solver has to pick one.

Today it picks in two layers:

1. **Holds** (`chooseDragHolds`, `chooseHolds`, about 250 lines). Before the drag, it tries holding each body still, in a fixed order (the frame, what slides or swivels on the car, what steers it, friction pins, then the deepest bodies first), and keeps each hold the drag survives. On top of that order sit about a dozen exceptions, each written for a model that went wrong (see [Holds](../ARCHITECTURE.md#holds)): don't hold what carries a shaft along, hold against the frame what a turning shaft would carry round, don't hold loop parts, try again with what the part drives held last when the holds make it turn too much, choose again when stuck, cap the scrub while choosing, keep to the plain motion, a binary search when the quick test was wrong, and a quick test to make all of this fast enough.
2. **Smallest motion** (`jointMotion`, `smallestTurning`). Among what the holds leave, the motion that turns the joints least, by least squares.

The holds are where most regressions come from: each exception is right for its model, but they interact, and the order they're tried in decides the outcome.

## The idea

What the holds express is a priority: keep the car where it is if you can; then what slides on it; then its steering; then friction pins; then everything else as still as possible. That's a **lexicographic least squares** problem (also called prioritised or hierarchical least squares, as used for robots' redundant joints):

1. Of the motions that turn the dragged joint at rate 1, take those that move tier 1 as little as possible (least squares).
2. Of those, the ones that move tier 2 as little as possible.
3. And so on, down to the last tier, every joint's turning (today's `size`), which settles what's left.

When a tier can be kept exactly still, this gives exactly what holding it would. When it can't, it moves as little as it must, rather than letting it go entirely.

What this gets rid of, by construction:

- **Order within a tier doesn't matter.** All of a tier is minimised at once, so there's no "which body first", and no binary search over an order.
- **Nothing to choose again.** It's solved afresh at every step, from where the model is, so a steered car's differential turns a little when it has to, and no hold is ever stale.
- **No detours.** A motion that turns the luffing knob 80 times as far to spare one pinion costs 80 times as much in the last tiers, so it isn't taken (the 855's "choose again with the driven parts last"), though a hair of it is (see Results).
- **No carry-along rules.** The "turning" tier measures each body's turning against the frame, not against its parent: a freewheeling gear turning on its shaft costs less than the shaft turning with it, and an assembly on a turning axle stays level, with no special case.

What it keeps, because those are physics rather than preference:

- **Worms and linear actuators lock**, held as today.
- **Frozen parts** stay frozen.
- **A tyre on the ground rolls the car** rather than steering round itself.
- The scrub, suspension and play rules in `jointMotion`, which are about which motions exist, not which to prefer.

## The tiers, as prototyped

| Tier | What it keeps still | Replaces |
|---|---|---|
| 0 | the frame, if it can stay exactly still (else it's free) | holding the frame first |
| 1 | what slides or swivels on the car | holding mounts |
| 2 | on a car on the ground, what steers it | holding steering first |
| 3 | joints on friction pins, and motors' outputs (their gearboxes hold them) | holding friction pins before the rest, and motors' outputs in loops |
| 4 | every body's turning against the frame, plus tyres scrubbing or lifting ×100 | deepest-first, carry-along, against-the-frame, detours |
| 5 | every joint's turning (today's `size`) | smallest motion |

Tier 0 is all-or-nothing (it's today's "parked" choice in `chooseMotion`); the others are least squares. While a step leaves the frame still, loop closing keeps it still too, as a held frame was. A tyre on the ground skips tier 0: its turning rolls the car, and tier 2 keeps the steering still.

The code: `leastTiers` and `leastTurning` in `src/kinematics.ts`, about 100 lines, against about 250 for the holds (`chooseDragHolds`, `chooseHolds`, `quickTest` and their helpers), which stay for pushes and while the switch is off.

## Results

**Tests** (`npm test`): with the switch off, all 271 pass, as before. With it on, 268 pass. The three that don't:

- **A car on swing arms**, raised on one arm: the frame rises 1.5 LDU at the front rather than more than 10. Holds kept the other arms still and the frame went up; least squares shares the motion between the frame tilting and the other arms swinging. Without springs (version 2.0) neither is wrong, but the test expects the first.
- **855 Mobile Crane, boom extension knob**: the luffing knob turns 0.03 radians, where the test wants none. Spreading again: a hair of luffing makes everything else turn a hair less.
- **8849 Tractor, steering**: the front wheels steer 0.243 radians rather than 0.2525, the rest going into the front axle rocking a little on the steering shaft. Spreading once more.

**Function check** on the 100 smallest sets (by model file), the same code with the switch off and on, run side by side:

| | Holds | Least motion |
|---|---|---|
| Functions that work | 226 | 228 |
| Partly | 140 | 137 |
| Don't | 83 | 84 |
| Time (99 sets that finished both ways) | 1203 s | 1092 s (9% less) |

The 9397 timed out at 20 minutes both ways; the 9396 timed out with holds, and finished with least motion just inside the limit (1192 s). On the rest, that's 11 functions better and 9 worse:

- **Better:** three of the 8859 Tractor's (steering, and what it drives), and one or two each of the 42065, 42120, 8202, 8245, 8281, 8862 and 952.
- **Worse:** five where a part that should stay still moves a little (a degree or an LDU, the check's threshold), the same spreading as in the tests: 42062, 8837, 8849, 8862 and 956. Two where a part that should move doesn't, the drag having found another way (42106, 8094). Two where the control stops early (42062, 8856).

## A second try: sparse friction

`SPARSE_FRICTION` (off) tries to cure the spreading. Tier 4 becomes friction: every joint's turning, plus bodies' turning weighted by how many parts they have, minimised by the sum of sizes (L1, by iteratively reweighted least squares) rather than of squares. That favours answers where as few joints move as possible, as static friction does. It passes 270 of the 271 tests (all but the swing arms), but in the function check it does worse than holds (221 work against 226, 10 better and 14 worse), and it's 13% slower than holds. It cured the spreading, but now picks a way of moving the fewest joints that isn't the one the set does: pneumatic cylinders left still while the linkage round them moves, for example.

## What it shows

- **The structure works.** A dozen ordered rules collapse into five tiers and one solver, the tests and function check come out about level with holds, and it's a little faster: one solve per step rather than a probe per body tried.
- **The difference is spreading.** Where something must give, holds let one thing go entirely; least squares lets several give a little. Most of what's worse is a part that should stay still moving a degree.
- **The real question is physical.** Which of two ways a mechanism goes, when its geometry allows both, is settled in a real model by friction, weight and springs, none of which KineBrick knows yet. Holds and tiers are both stand-ins for those. The tiers make the stand-in one explicit place (a list of what costs what) instead of an order of tries, which is what would let version 2.0's forces replace it: Kelvin's theorem says a mechanism set moving from rest moves with the least kinetic energy its constraints allow, so with masses (and friction as tiers above them), tier 4 becomes the physics rather than a guess.

## The full function check, on the Windows PC

To compare with holds on every set, as the last full check (6da8518) was run: in Git Bash, in the PC's clone, with the PC set never to sleep while it runs. The same limits as that check: 15 sets at a time, 150 minutes a set. The sets' models are read from `omr/` (not committed), so `npm run omr` downloads any that clone doesn't have yet.

```bash
git fetch origin
git switch claude/least-motion
git pull
npm ci
npm run omr
KINEBRICK_LEAST=1 npm run functions -- --jobs 15 --limit 150
```

Each set's results then say `"least": true` beside the commit they were checked at. Commit them to the branch and push:

```bash
git add data/sets
git commit -m "Check the functions of every set with least-motion drags"
git push origin claude/least-motion
```

Then they're compared set by set and function by function with 6da8518's (and the 858's with 516e176's, which added it).

## Second round, on main as of 1f1e1cb

The prototype was carried onto main at 1f1e1cb, on the `claude/least-motion-2` branch, still off by default. With the switch off, all 329 tests pass.

### The full function check

It was run on every set on the Mac rather than the PC, at a16c825, with the same 150-minute limit. Compared function by function with 6da8518's holds:

| | Holds | Least motion |
|---|---|---|
| Functions that work | 455 | 441 |
| Partly | 383 | 387 |
| Don't | 202 | 212 |

16 functions are better and 35 worse; the 858 comes out the same. The other 153 sets are the same function for function. The 35 worse ones are in 33 sets, which the rest of this section checks again, holds and each change side by side on the same code (with a 30-minute limit).

### What was wrong, and what changed

- **Noise tiers.** A tier with nothing in it to keep still (the steering of the 42055's mine truck, which nothing steers) has costs of only rounding, about 1e-21. Scaled up to its own size, that rounding chose the motion, and the truck's wheels swung round 20 million times too far, so no step could be taken. A tier whose costs are only rounding next to how much the motions turn the joints (`NOISE`) is now skipped.
- **Small tiers.** `symmetricEigen` stops at absolute cut-offs, so a tier whose costs are small (1e-6) was taken as solved before it was. Each tier's matrix is now scaled to its largest entry first. Holds use `symmetricEigen` too, and are left as they were.
- **Spreading: stillness.** A body the turning tier leaves turning less than a tenth as much as the one it turns most is held still, if it can be, and the tier solved again (`KINEBRICK_STILLNESS=0.1`), as static friction stops what would only creep.
- **Steering that keeps a car from rolling.** With its steering free, the scrub rule (which motions exist, before any tier) rules out every way the 8245's buggy can roll on its caster fork. A car that can't roll so has its steering held, as holds would, and as tier 2 would keep it still anyway.
- **Closing loops (experimental).** A step's motion follows the tiers, but closing the loops after it moves everything a little, by plain least squares, which let the 8865's top axle slide a hair past its stop. With `KINEBRICK_CLOSE_STILL=1e-3`, closing the loops also keeps still, softly, what the step left still.

### Tests

With least motion alone, the same six fail as before (the swing arms, 855, 8849, 8865 and two of the 956's). With stillness on, all 329 pass, with or without closing loops kept still: holding the steering when the car couldn't otherwise roll is what fixed the 8865, the 956 and the swing arms, whose steering had been giving a little in every drag.

### Function check on the 33 sets

| | Holds | Least motion | + stillness | + steering held, tiers scaled | + closing loops kept still |
|---|---|---|---|---|---|
| Work | 123 | 113 | 116 | 117 | 117 |
| Partly | 88 | 89 | 88 | 88 | 90 |
| Don't | 29 | 38 | 36 | 35 | 33 |
| Better than holds | | 15 | 14 | 14 | 14 |
| Worse than holds | | 29 | 25 | 24 | 23 |

The least motion column has the noise fix already. The 14 better: three of the 8859 Tractor's, two of the 42120's, and one each of the 42042, 42092, 42114, 8202, 8257, 8281, 8285, 8862 and 952. The 24 worse, with stillness and the steering held:

- **The drag stops short (13):** the 8466 Off-Roader's drive and differentials (four functions; no way to turn its rear wheel at all), the 42039's V8 and differential (0.1 radians of 1.5), three of the 42029's, and one each of the 42037, 42056, 42062 (the spreader) and 42096.
- **A part that should stay still moves (6):** 855, 8257, 8837, 8838, 8849 and 956, each a degree or an LDU: spreading, still.
- **A part that should move stays still (5):** 42106, 8094, 8862 and two of the 42111's.

So least motion now matches holds on the tests and is 6 functions behind on these sets. Most of what's behind is a drag that stops short, which, as with the 42055 and the 8245, is likely a bug of its own each time rather than the idea.

## Third round, on the solver branch

The drags that stopped short, chased one at a time with a probe that steps a drag and says why it stopped (no motion left, a limit, or a dead point and which joints strayed from where the step had them going). Each turned out to be a general flaw rather than something about its set.

### What was wrong, and what changed

- **Standing alone, but joined.** A body counts as standing alone, and is held without asking, if nothing but its own joint joins it to the rest. Only its joint in the tree was checked, not joints outside the tree: the 8466 Off-Roader's steering arm, a bridge in the tree, is joined to its tie rods by three ball joints, and the whole front axle hangs on it. Held, the axle couldn't turn, so the car couldn't roll: four of its functions. Joints outside the tree now count as ties. Holds use the same rule, though only for a body on something still, and all 329 tests still pass with them.
- **Moving that costs nothing.** The tiers count joints' turning and bodies' turning, but not sliding. The 42039 race car's pistons and connecting rods reach no crank (a connection Kinebrick doesn't make yet), so sliding them in their cylinders cost nothing in any tier, and the drag slid one at whatever rate the free motions happened to mix in, 133 LDU per radian, until it ran out of its cylinder. A last tier now keeps every body as still as it can be against the frame, at a point in the middle of its joints, once the joints' turning is settled. Holds leave it to chance too, which is why the race car's V8 "worked" with holds: its pistons moved because they drifted.
- **A linkage that moves only to first order.** On the 42062 Container Yard's spreader, the turning tier turns a small linkage back against the spreader's turning, to keep it level. But it lies flat, where it moves only to first order, so closing the loops after the step pulls it back and the step fails as at a dead point. Now, when a step's joints stray from where the step had them going, those joints are held for the rest of the drag and the step is tried again. If the drag can't turn then, they're let go, and it is a dead point after all.
- **Scrubbing weighed twice.** The turning tier also counted tyres scrubbing sideways, 100 times as much as turning. But the scrub rule already keeps scrub within what's allowed before any tier chooses, and weighing it again made the 42037 Formula Off-Roader roll 41 LDU and swing round for each radian a suspension arm was raised, rather than let a tyre scrub a little. It's no longer weighed in the turning tier, and the tests come out the same at 0, 1 or 100.
- **A grabbed part turned against its shaft.** A drag turns the grabbed part's joint, against what the part turns on. Where that is a pin free to spin in its holes, the turn was taken by the pin spinning back under the part, which stayed where it was: the 9394 Airliner's control stick turned 1.5 radians and its tailplanes didn't move. Least motion now turns a grabbed part against what its shaft turns in (`housing`, the first body up the tree not on the same line).

Then two more, after the 40 sets below were first checked:

- **Standing alone on something that turns.** Least motion held everything standing alone, on its own joint, to save work; holds only hold what stands alone on something still. Held on its joint, the 956 Auto Chassis's gear lever, which sits on the drive shaft, was carried round with the shaft. Least motion now holds the same as holds.
- **Steering a car that's meant to steer.** On a car on its tyres, tier 2 keeps the steering still, so that turning a wheel rolls the car rather than steering it. But the 8837 Pneumatic Excavator's steering knob is on its upper body, whose gear crosses the turntable to the steering below, and with the steering kept still the drag slewed the excavator round instead. A drag that drives any of the steering through its gears now has tier 2 left out.
- **Stillness at 0.2** rather than 0.1: with these two, 0.1 loses two functions (the 42062's boom extension and the 42056's rear suspension) that 0.2 keeps, and 0.2 brings back the 42062's spreader. 0.3 fails one more test (the 8849's steering, 0.243 radians rather than 0.2525).

The housing change turns seven results to "no" that weren't before. In each, the part can't turn against what its shaft turns in, as the model is built: with holds or before the change, the drag only spun the shaft or pin under it, and counted as working or partly working because the control turned. The 8081's doors are both in one body, so neither can swing on its hinge; the 42107's swing arm is locked by a shock absorber that doesn't slide; the 42096's and 42037's suspension uprights, the 42063's front fork, the 42065's tilting body and the 42112's selector lever likewise. These are connection problems the check now shows rather than hides.

### Tests

All 329 pass with holds. With least motion and stillness (0.1 or 0.2), 4 fail, the same 4 as on the code before this round (which the second round's note had wrong): the swing arms (spreading, as before), two of the 956's (a hair outside their tolerances: 1.09 LDU off a 1755 LDU circle, against 0.5) and the 8865's V4. The 8865's front tyres are built 9.4 LDU above the ground, so only its rear tyres touch it; turning a rear wheel, least motion swings the car round the other rear wheel, which turns the engine half as much, and tips it forward 38° until the drag stops. Holds roll it straight on.

### Function check on 40 sets

The quick sets and the 7 with drags that stopped short:

| | Holds | Least motion, first five changes | All seven, stillness 0.1 | All seven, stillness 0.2 |
|---|---|---|---|---|
| Work | 111 | 109 | 107 | 109 |
| Partly | 94 | 89 | 91 | 88 |
| Don't | 30 | 37 | 37 | 38 |

With all seven at stillness 0.2, of the 13 drags that stopped short, 10 come out as with holds. The other three: the race car's V8 (its pistons, above), the 42056's rear suspension (stopped at a dead point, a third of the way) and the 42096's suspension (one of the seven). Better than holds: the 42074's helm, the 42063's rear suspension and the 8001's knees. Worse, apart from the seven and the race car's V8: the 8837's steering knob, which still slews the excavator a little as it steers (0.17 radians for each radian of the knob, shared by least squares), and the 42056's rear suspension. Taking out the three results holds get by a part turning that shouldn't (the 8081's doors, the 42096's suspension, the race car's V8), least motion is a function ahead.

## Fourth round: a fair check, and what was worse

### The check counted turns that didn't happen

A part on an axle free in its holes can have its joint turned with the part itself standing still, the axle spinning back under it. The function check took the joint's angle as how far the control turned, so that counted as working: with holds, the 8865 Test Car's suspension arms and seat backrests "worked" though nothing moved. The check now counts how far the control turns against what its shaft turns in. That's what least motion's drag does since the third round, so the comparison had been tilted toward holds.

The sets least motion is iterated on are now 46: the 40, and six where a full check stopped partway found it worse (the 8865, 8862, 8094, 8830, 42021 and 42041). With the fair check, holds have 128 of their functions working.

### What was wrong, and what changed

Each function least motion did worse on was looked into separately, by agents running probes in parallel, and each fix made in general:

- **What a grabbed part turns against stays still.** Dragging the 8862 Backhoe's dipper cylinder swung the boom the other way and carried the dipper round level, since the turning tier counts every body on the dipper as turning if the dipper turns. A tier just before it now keeps the grabbed part's housing still against the frame, as a hand holding the model by its frame would.
- **A car on fewer than three tyres keeps its own turning still.** Nothing in the tiers cost the frame's own motion, all of them being measured against it. The 8865, its front tyres built 9.4 LDU clear of the ground, spun round a rear wheel and tipped forward. A tier for the frame's turning, only where the tyres on the ground don't stand the car up, stands in for its weight. On four tyres the scrub rule already rules that out.
- **Mounts stay held while the loops close**, as tier 1 kept them in the step. The 8865's top axle, built at its end stop, slid a hair past it. A slide also counts as past its end only 1e-6 LDU beyond it, not 1e-9.
- **A drag keeps its choice of suspension.** Whether a drag's motion uses the suspension is chosen at its first step and kept: the 42056's rear suspension switched to rolling the car a third of the way and stopped as at a dead point. But a drag that chose the plain motion takes the suspension once plain turns the joints four times as much, where it held only to first order (the 42096's rear suspension).
- **The tyres grip when the frame stays still.** A motion that keeps the frame where it is can still drag the tyres across the ground, and with scrub no longer weighed in the turning tier, nothing cost that: the 8837 Pneumatic Excavator, whose frame is its upper body, slewed its chassis round under it rather than steer. Of the motions that leave the frame still, those in which no tyre scrubs are taken, if any turns the joint; a step taken so that holds only to first order drops the preference for the rest of the drag.
- **Closing the loops keeps still what the step left still**, now by default (`CLOSE_STILL`, 1e-3). Closing them by plain least squares undid what the tiers kept still a hair a step: the 956 Auto Chassis, driven round a circle, drifted 1.1 LDU off it, and its gear lever was carried round with the drive shaft.

### What's still worse, and why it isn't the solver

Six functions worked with holds and not with least motion. In each, holds' result came from something that shouldn't happen:

- **The 42039 and 42041 V8s.** Their connecting rods are built 1.005 LDU off the crank pins, just outside the 1 LDU tolerance, so the pistons reached no crank. With holds they slid only by drifting, all eight together. Fixed in the connections: parts held to the rest only by slides and balls now get the second chance at fitting that loose parts get, 2 LDU. Across all 186 sets that adds 27 connections in 8 models, all real ones, and both V8s now work, with either solver.
- **The 42107's swing arm and the 8466's suspension.** Their shock absorbers are rigid until springs come in version 2.0, so the arms can't move. With holds the 42107's "partly" was its gearbox shaft spinning under the arm and rolling the bike.
- **The 42021's handlebars.** The bar hangs on a frictionless pin off the steering column, and spinning it on the pin cancels the steering. Holds steer only because least squares happens to split the motion. A contact or connection fix, not a tier.
- **The 8094's arm motor.** The function assumes the claws are shut on something; holds raise the arm only by holding the whole claw train to it.

### Tests and function check

All 329 tests pass with least motion (stillness 0.2) as with holds, for the first time. On the 46 sets:

| | Holds | Least motion | Both, with the V8s connected |
|---|---|---|---|
| Work | 128 | 129 | 128 and 131 |
| Partly | 99 | 97 | 99 and 95 |
| Don't | 44 | 45 | 44 and 45 |

Better than holds: the 42063's rear suspension, the 42074's helm, two of the 8862's (its handwheel and its bucket cylinder) and the 9394's control stick.

## Open questions

- **The full check**, both ways with the fair check, at a592961: holds' results on every set were measured counting a control's joint angle, and need measuring again before least motion is compared with them. Least motion now passes every test and is ahead on the 46 sets; the full check settles the other half of the adoption test.
- **Shock absorbers rigid until springs**, behind two of the four functions still worse (the 42107's and 8466's suspension): they hurt holds as much, but hide behind results holds get by something spinning.
- **Holds creeping back.** Holding a car's steering when it otherwise can't roll is a hold, if only a fallback; so is the tier for a car's own turning on two tyres. Gravity and mass would replace both.
- **Mass.** Tier 4 counts every body alike. Weighting by how many parts a body has cured the 8837's slewing but failed the 8849's and the 855's tests; the slewing turned out to be scrub, so mass may not be needed.
- **Pushes.** The prototype only covers drags that turn a joint (the function check uses only those). Pushes still choose holds.
