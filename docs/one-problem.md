# One problem for each step: a plan

A design note and prototype report for line 3 of the [solver phase](solver-phase.md): taking a drag's step as one problem, rather than choosing a motion, moving along it and then closing the loops as separate passes, built as [least motion](least-motion.md) was. Its first round, closing the loops by the tiers (see First round, below), met the adoption test on the full check and was adopted: it's on by default, with `?passes` in the viewer, or `KINEBRICK_ONE=0` for the tests and scripts, closing them as before.

## How a step is taken now

A drag turns a joint by small steps (`turnJoint`, at most `MAX_TURN_STEP`, 2°, at a time). Each step has three passes:

1. **Choose a motion** (`jointMotion`): the speeds, one 6-number twist per body, that turn the dragged joint at rate 1 and keep every equation (joints, gears, tyres rolling), chosen by least motion's tiers. This is a linear problem, exact only for an infinitely small step.
2. **Move along it** (`advance`, `move`): every body moves by its twist times the step.
3. **Close the loops** (`closeLoops`): a loop's joints drift apart in a finite step, since the motion was only right to first order. Up to 12 rounds of a damped least-squares solve pull them back together, with the dragged joint kept where the step put it; then `settle` sets the car back down on its tyres.

The third pass chooses its own motion, and not by the tiers: the least motion (by size) that closes the gaps. Where that disagrees with what the tiers would choose, patches keep it in line:

- **Kept still while closing** (`closingStill`, `CLOSE_STILL`): bodies the step left still are weighted to stay so, since otherwise closing the gaps nudged them (the 858 Auto Engines' push rods, the 8063 Tractor's pistons).
- **Mounts held while closing** (`mountsHeld`): what slides on the car stays where it is (the 8865 Test Car's top axle, slipping past its end stop).
- **The car kept parked** (`parked`) when the step doesn't move it.
- **Dead points** (`DEAD_POINT`, `DEAD_POINT_GAP`, `DEAD_POINT_RATE`, `DEAD_POINT_SAMPLE`, `lastStep`, `deadPoint`): a step after which a joint has strayed from where the motion had it going, or a loop is left open, is undone, and the drag stops, since closing the loops can jump to another branch of a linkage.
- **Strayed joints held** for the rest of the drag (the 42062 Container Yard's spreader), and the tyre grip dropped (the 42037's front tyre), when a step strays.
- **Play** (`playMotion`, `PLAY`, `PLAY_RATE`): a motion that opens the loops a little, taken only where nothing exact turns the joint.
- **Settling** (`settle`): the car set back on its tyres, as a pass of its own after each step.

About 25 places in the solver deal with these, and several of them name the set they were written for.

## The idea

Make the step one problem: of the positions that keep every connection and turn the dragged joint by the step, the one the tiers prefer. Solved by Newton's method, each round is a linearised problem of the same kind least motion already solves:

- Each round starts where the bodies are, with the gaps `g` the loops are open by (the rows `closeLoops` builds) and `Δ`, how much of the step the dragged joint still has to turn.
- The correction `δ`, in the tree's coordinates (joint angles), must close the gaps and turn the joint the rest of the way: `L δ = -g`, `d · δ = Δ`.
- Of the `δ` that do, the one the tiers prefer: a particular solution `δ₀`, plus a mix of the free motions (the null space of `L`), chosen tier by tier as `leastTurning` chooses one now, but with each tier's cost being that of `δ₀` plus the mix, rather than the mix alone.

The first round, with the loops closed and all the step to go, is today's first pass: `g = 0`, and the tiers choose the motion. Later rounds, with only small gaps and `Δ = 0`, close the loops as the tiers would, which is what the patches above approximate: a body the tiers keep still isn't nudged by closing a loop, because nudging it costs in its tier. And the dragged joint is exactly where it's asked to be, as `keep` has it now.

What it should retire:

- `closingStill`, `CLOSE_STILL`, `mountsHeld` and `parked`: the tiers already say what to keep still.
- The separate `settle` pass: a tyre's height on the ground becomes one more row of `L`, so a step keeps the car on its tyres.
- Most of the dead point machinery: a step has no answer at a dead point (the rows can't be met), or its answer is on another branch, which Newton's method from the near side won't reach in a small step. What's left is telling the user why the drag stopped.
- Play as a separate motion: a joint with play becomes a row with a small weight, so its loop may open a little where nothing else can move, and no more.

## How it will be built

As least motion was: behind a switch, `KINEBRICK_ONE=1` for tests and scripts, with today's passes left as they are until it's adopted.

1. **Affine tiers.** `leastTurning` takes an offset, the particular solution's costs, so a tier minimises the cost of `δ₀` plus the mix, and a target rate other than 1. With no offset and a target of 1, its answer is as now, to the last bit; a test says so.
2. **The Newton step.** A `stepOnce` that does the rounds above, reusing the tree's basis and the free motions from round to round while the gaps at least halve (as `closeLoops` reuses the basis now), and falling back to working them out afresh where they don't.
3. **The patches off.** With the switch on, `closingStill`, `mountsHeld`, `parked` and the stray check are skipped. The function check on the 46 iteration sets, and then the full check, say what that costs or gains.
4. **Tyres and play as rows.** Then `settle` and `playMotion`.

Adopted, as least motion was, when all the tests pass both ways and at least as many functions work on the full check, now that the check also says how much (line 1).

## First round

Stages 1 and 3, for closing the loops: `leastTurning` takes an offset and a target rate (with neither, its answer is as before, and every test passes so), and with `KINEBRICK_ONE=1`, `closeLoops` closes a tier-chosen step's loops by the damped least-squares closing plus the mix of free motions the tiers choose, taking the place of `closingStill` and `mountsHeld`. The first round of the Newton step, choosing the step's motion, is still `jointMotion`'s, as it was; so is `settle`.

Three things had to be right before it passed every test:

- **The free motions where the bodies are now**, the null space of the rows `closeLoops` builds, with the dragged joint's: the step's own free motions, from where it started, are free only to first order once the bodies have moved, and a mix of them opened the gaps the closing had shut. The 42062 Container Yard's spreader, whose linkage fits only as it lies, couldn't take a step.
- **Tyres free to scrub and lift a hair** in that null space, as in choosing the step: on the ground exactly, a steered wheel on a slanting kingpin can't turn back, and the 956 Auto Chassis, driven round a circle, crept off it as its steering turned.
- **A mix that doesn't turn the dragged joint.** Every motion in that null space keeps the joint where it is, so `leastTurning`, finding none that turns it, gave up, and the tiers were never applied: a target of 0 with an offset now takes the mix from all of them.

`parked` stays: nothing in the tiers costs the car moving, and without it a car being steered crept.

With it on, all 329 tests pass, and on the 46 iteration sets (against the same code with it off) as many functions work, 132, and one more partly works (the 8081 Extreme Cruiser's front suspension, which didn't move). It took 3,145 s of the machine's time against 3,335 s. There and back, 15 functions bring back more of what they moved (the 858 Auto Engines' four engines, the 8466 4 x 4 Off-Roader's doors, the 8865 Test Car's engine, the 956's steering, among them), and 8 bring back less, the 42041 Race Truck's worst: its parts were back within 0.1 LDU, and are now hundreds of LDU off.

### What flings the 42041

Its rear wheel turned 1.5 radians and back, the truck rolls 107 LDU and should roll back; with the switch on, in the first steps back, one round of closing the loops moves it 750 LDU at once, and it doesn't move again. Logged round by round: once the gaps are next to shut (2 × 10⁻¹⁰), the closing itself is 5 × 10⁻⁸, but the mix the steering tier chooses to go with it is 2,370, mostly the whole model moving. It's ill-conditioning: a direction that turns the steering by a hair still counts as one that moves the tier (above TIER_TOLERANCE), and taking out the closing's even smaller hair of steering along it takes a great deal of it. Choosing the step can't do this, since the motion turns the dragged joint at rate 1, which keeps it to a size; a correction has nothing of the kind.

Tried, and not kept:

- **A last tier for the tyres' scrubbing and lifting**, so that moving the whole model costs something: no change.
- **A cap on the mix**, against the closing (10 times it), or against how far the step turned the joint: the 8865's engine needs a mix 1,000 times the closing near the end of a step, when the closing is tiny; and the mix's size mixes units (a joint's radians with the model's LDU), so a cap the 956 lets through, the 42041 slips past.
- **Damping the tier solve** (Tikhonov, the directions that move a tier by under a share of the most a free motion does taken out only partly): at 10⁻⁶ of it, the 42041 still flies off; at 10⁻⁴ it comes back as with the switch off, but the 956 fails its tests of driving round a circle and of its gear lever, which need the tiers' cancelling to be exact over many turns.

So the 956 needs a direction that barely moves a tier followed exactly, and the 42041 is flung by following one. The next round looked for what tells them apart.

### What it was

Not the tiers' order. Weighing the tiers softly instead, each counting 10 times the next in one least-squares solve, brought the 42041 back and passed the 956's tests, but let later tiers bleed into earlier ones: the 8880 Super Car's gearbox ratios came out 2.237 for 2.25, and the 858 Auto Engines' push rods and the 854 Go-Kart's tyres failed. Ranking the tiers strictly again, but damping each tier's solve by what its directions move in the tiers after it, also brought the 42041 back, at any damping down to 10⁻³⁰: so it wasn't the damping, and logging the steering tier in the 42041's flinging corrections showed what it was.

Its scale, the most any free motion turns the steering, was 9 × 10⁻²⁶: nothing free steers at all, and what the tier measured was rounding. A tier like that is meant to be passed over (`NOISE`), judged against how much the motions turn the joints. But a correction's free motions are mostly the truck sliding on its tyres, which may scrub, and turn the joints next to nothing: 4 × 10⁻⁶ at most, so the rounding passed for a cost, and its direction, at 5 × 10⁻¹⁰ of it, just above `TIER_TOLERANCE`, was followed thousands of times the correction's size to take a hair out of it.

The fix: a correction's tiers are judged against at least a motion of unit size, since its free motions are orthonormal. With it, the 42041's parts come back within 0.14 LDU, as with the switch off, and all 329 tests pass. On the 46 iteration sets, as many functions work as with it off, and one more partly works, as before; there and back, against the switch off, 12 functions bring back more of what they moved and 8 less (none of them the 42041's). It took 2,594 s of the machine's time, against 3,335 s with it off.

### A correction's own turning tier

With the 42041 fixed, the 42029 Customized Pick up Truck, pushed along by a rear wheel, went 127 LDU for each radian the wheel turned, a quarter further than its tyre rolls. Its corrections slid it 12.7 LDU in 5 steps, where with the switch off they move it 0.08. Logged tier by tier, the turning tier did it: keeping the bodies from turning, it slid the whole model on its tyres, which may scrub and lift in a correction's free motions, and which nothing after it costs. Two changes, for corrections only:

- **Scrubbing counts in the turning tier**, each LDU a tyre scrubs or lifts as much as a radian a body turns. A last tier for it, as tried for the 42041, comes too late: the turning tier has already bought its hair with the slide.
- **No stillness rounds** (`STILLNESS`): in a correction every body turns only a little, and the bodies held still first, solved on their own, slid the model all the same.

The 42029 then goes 102 LDU a radian, as with the switch off, and all 329 tests pass both ways. On the 46 iteration sets, 133 functions work (one more than with it off: the 42056 Porsche 911 GT3 RS's front suspension), and one more partly works (the 8081 Extreme Cruiser's front suspension, as before). There and back, against the switch off, 14 bring back more of what they moved and 6 less. It took 2,378 s of the machine's time, against 3,335 s with it off.

Tried, and not kept: keeping the stillness rounds in a correction, with the scrubbing held along with the held bodies so that holding them can't buy the slide. The 42021 Snowmobile's steering comes back within 0.5 LDU again, and there and back 16 bring back more and 4 less. But the 42056 Porsche 911 GT3 RS's suspension, two more of its joints straying, stops after 0.1 radians, and only 131 functions work.

### The full check

On all 186 sets (at c0fb208), 524 functions work with the switch on, against 523 with it off: 7 do better and 4 worse. The 8110 Unimog ran past the 200-minute limit, so its functions aren't in either count. Rerun alone with a 7-hour limit, it comes out as with the switch off (8 work, 4 partly, 4 no, 1 not back), but takes 292 minutes against 174. So with the 8110, 532 work against 531. The 4 that do worse:

- **The 8002 Destroyer Droid's back leg** (works → no) never moved: each correction's mix of free motions opened the loops again, round after round, so the step was refused. Fixed in cbfeb45: a closing whose mix is undone even on a fresh basis, and which would leave the step refused, finishes its rounds without the mix. Only for a step that opened the loops only a little, else the 42037 Formula Off-Roader's wild first step back (2,948 LDU of slide) went too. The leg works again, and the 46 iteration sets are unchanged.
- **The 9392 Quad Bike's steering** (partly → no) isn't a real loss. Its linkage fits only at a tangency: closing its loops gains about half a gap a round, as Newton's method does at a double root, so 12 rounds end 0.003 LDU apart and the step is refused. With the switch off it goes on by holding a strayed joint, but each 0.1 radian of steering slides the whole bike about 10 LDU.
- **The 8859 Tractor's engine** (works → partly) isn't the switch's doing. Pushed along by one rear wheel, the tractor may roll straight, turning the differential and the engine, or pivot on the spot, its rear wheels turning opposite ways. Rolled forward, it pivots with the switch on and off alike. Rolled back, the drag with the switch off happens to keep rolling straight, and one correction with it on tips it into pivoting, which the next step's jump back reads as a dead point. Making a pushed wheel roll the car straight is a question of its own.
- **The 42043 Mercedes-Benz Arocs 3245's rear differentials** (works → partly) stopped at 0.63 radians the same way, but its steps open the loops 0.11 LDU, just over `PLAY`. Fixed in 00f3c10: the limit is how far a step moves a point a stud from a joint (`STUD × MAX_TURN_STEP`, 0.7 LDU), still far short of the 42037's. Its wheel turns 1.2 radians, and all 15 of its functions come out as with the switch off. Further on, the drag stops on strayed joints: a correction's mix turns the whole drive train back against the step.

### What's left

The 6 that bring back less, against the switch off: the 42021 Snowmobile's f1 and f2 (2.5 and 4.3 LDU off, from next to nothing), the 42096 Porsche 911 RSR's rear suspension (35 to 169), the 8081's front suspension (which moves now, and doesn't all come back), the 8448 Super Street Sensation's front suspension (10 to 58) and the 9394 Jet Plane's f4 (0.3 to 2.2). Then the Newton step proper (stage 2), and tyres and play as rows (stage 4).

- **The 9394 Jet Plane's control stick** turns on a long pin free to spin in its holes. Choosing a step's motion already measures the stick against what the pin turns in (see `housing`), but closing the loops kept only the stick's joint on the pin, so a correction could turn the pin, and the stick and the tailplanes with it: back from a drag, the tailplanes were 0.05 radians off. With the switch on, closing now keeps the grabbed part against its housing instead.
- **The 42021 Snowmobile's steering** has a free motion: its steering arm is pinned to a lever on the column, with a tie rod to each ski, so the arm can swivel as the skis toe in or out. What's chosen for it depends on stillness (see `STILLNESS`), which holds still whatever turns less than a fifth as much as the most, a threshold the drag crosses one way going and another coming back. With the switch on and off alike, the way back follows another path from the way there (up to 0.04 radians apart). With it off, the path happens to end at the start, and with it on, 0.06 radians off. With stillness off, both come back within 0.01. Its suspension (f2) stirs the same free motions, and with the switch off `closingStill` holds them. With it on, a correction's mix is chosen for the correction alone, so stillness doesn't see what the step held still. Choosing it for the whole step, the step and its correction together, is the Newton step's to do.
- **The 8448 Super Street Sensation's and the 8081's front suspension**, their shocks rigid, move only by play, and on a step as they take it up, the motion opens the loops 1,200 LDU. Closed plainly, the gap stays, and the step is refused. The tiers' mix closes it, but the front wheels are left spun 3.5 radians on their hubs (the 8081's suspension then counted as partly working, 79 LDU off there and back). With the switch on, a step that opens the loops more than a stud is now refused before they're closed, and both come out as with the switch off.

Tried, and not kept: a correction's mix chosen for the whole step, the tiers judging the step and the corrections so far together. The 42021's steering and suspension then come back within 0.01 radians, and with stillness judged on the whole step too, both. But 10 tests fail (12 with stillness): the 854 Go-Kart's and the 956 Auto Chassis's tyres scrubbing, the 8880 Super Car's gearbox, the 8865 Test Car's V4. Re-choosing the step's own free motions in a correction meets what only choosing the step handles now (how far tyres may scrub, driving rings), which is the Newton step's work.

## Risks

- **Speed.** A step on the 8110 Unimog already takes about 11 s, most of it in the tiers. Solving the tiers in every round, rather than once a step, could make it several times slower. Later rounds have `Δ = 0` and small gaps, so they may need only the tiers that the gaps touch; or the free motions and the tiers' products can be kept across rounds, as the basis is.
- **Convergence.** Newton's method needs a starting point near the answer. Small steps give one, but a linkage near a dead point (the 8865's pistons at the top of their stroke) has rows that nearly repeat each other, where the rounds may not converge. Damping, as `closeLoops` has, and a smaller step there, are the usual cures.
- **Branches.** The tiers might prefer, round by round, a correction that walks the linkage onto its other branch (the 42062's spreader). A cap on how far a round may move a joint, relative to the step, would keep it on its branch.
