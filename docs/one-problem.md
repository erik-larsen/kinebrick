# One problem for each step: a plan

A design note for line 3 of the [solver phase](solver-phase.md): taking a drag's step as one problem, rather than choosing a motion, moving along it and then closing the loops as separate passes. Nothing here is built yet; this is the plan the prototype will follow, as [least motion](least-motion.md) did.

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

As least motion was: behind a switch, `KINEBRICK_ONE=1` for tests and scripts and `?one` in the viewer, with today's passes left as they are until it's adopted.

1. **Affine tiers.** `leastTurning` takes an offset, the particular solution's costs, so a tier minimises the cost of `δ₀` plus the mix, and a target rate other than 1. With no offset and a target of 1, its answer is as now, to the last bit; a test says so.
2. **The Newton step.** A `stepOnce` that does the rounds above, reusing the tree's basis and the free motions from round to round while the gaps at least halve (as `closeLoops` reuses the basis now), and falling back to working them out afresh where they don't.
3. **The patches off.** With the switch on, `closingStill`, `mountsHeld`, `parked` and the stray check are skipped. The function check on the 46 iteration sets, and then the full check, say what that costs or gains.
4. **Tyres and play as rows.** Then `settle` and `playMotion`.

Adopted, as least motion was, when all the tests pass both ways and at least as many functions work on the full check, now that the check also says how much (line 1).

## Risks

- **Speed.** A step on the 8110 Unimog already takes about 11 s, most of it in the tiers. Solving the tiers in every round, rather than once a step, could make it several times slower. Later rounds have `Δ = 0` and small gaps, so they may need only the tiers that the gaps touch; or the free motions and the tiers' products can be kept across rounds, as the basis is.
- **Convergence.** Newton's method needs a starting point near the answer. Small steps give one, but a linkage near a dead point (the 8865's pistons at the top of their stroke) has rows that nearly repeat each other, where the rounds may not converge. Damping, as `closeLoops` has, and a smaller step there, are the usual cures.
- **Branches.** The tiers might prefer, round by round, a correction that walks the linkage onto its other branch (the 42062's spreader). A cap on how far a round may move a joint, relative to the step, would keep it on its branch.
