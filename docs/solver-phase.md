# The solver phase

After release 0.850 (named after the 850 Fork Lift, the first Technic set), work moved from fixing sets one at a time to making the solver itself general. This page is the plan, on the `solver` branch, which goes back to `main` once it's better there.

## Why

Set by set, each fix made one mechanism in one set work: the 8849 Tractor's hitch, the 8835 Forklift's forks, the 8865 Test Car's V4. Each was real, but together they hardly moved the totals: of the functions checked, half work, and 13 of 186 sets work in full. Many of those fixes were special cases, and about 30 sets are named in the solver's comments, most of them in how a drag chooses its holds.

## Guiding lights

- **The best solver we can make**: capable, fast, and as simply coded as we can, rather than special cases stacked on each other.
- **A fast check that says how much**: not only whether a part moved or stuck, but whether it moved as far as it should.
- **Official sets only.** Their models are more likely to be right. People's own models, and the thousands of parts only BrickLink Studio has, wait until later.

## Where the special cases come from

The solver works in three layers:

1. **Which motions are possible.** Each connection becomes an equation. This is physics: a new kind of part adds a rule, which is catalogue work rather than a special case.
2. **Which motion to take, when several are possible.** These are the [holds](../ARCHITECTURE.md#holds): an order of what to keep still, with fixes on top (choosing again, what's driven tried last, held against the frame instead). Most of the special cases are here.
3. **How a step is taken.** A step's motion is chosen as speeds, and the loops are closed afterwards, as a separate pass. Several fixes live in the gap between the two: closing the loops moving what should have stayed still, play, dead points, and setting the car back on its tyres.

## Lines of work, in order

### 1. Checks that say how much: mostly done

Gear ratios, differentials, pistons, there and back, the quick set and a benchmark are in. Steering's stops are measured (`npm run functions -- --lock`): a steering control turned each way until it stops, where parts meet as in the viewer, and how far its wheels steered; for now only reported. A survey over the 119 steering sets ([steering-stops.md](steering-stops.md)) has 106 of the 115 ways of working functions stopping between 15° and 50°, the believable range, and lists the outliers. 164 of the 1,224 functions have an expected amount (108 at 0.850), and only one part moves by the wrong amount: the 8020 Building Set's steering, its 8 tooth gear tilted 15° on its crown gear.

Expected amounts worked out without the solver:

- **Gear ratios from tooth counts**, along the train from a control to what it drives, so a drag can be checked against the ratio rather than only for moving.
- **Rules for each kind of mechanism**, from the [mechanism catalog](mechanisms/README.md): a differential's carrier turns at the average of its wheels (done, `scripts/gear-rates.ts`: with a vehicle's wheels pushed together, it gives the carrier, and the engine behind it, their speed), a rack moves a set distance for each turn (done, with the gear ratios), a piston slides as far as its crank's turn says (done, `scripts/slider-cranks.ts`, from the slider-crank's geometry, whatever turned the crank), steering stops at a believable angle (to come).
- **There and back**: a drag out and back returns everything to where it started, with no joint left apart.

And faster:

- **A quick set** of about 20 sets, chosen so that each kind of mechanism comes up at least once, run on every change in a few minutes. The full check runs overnight, on this Mac.
- **The OMR control survey retires.** The function check replaced it, and the `omr-survey` branch is no longer added to.
- **The slowest sets profiled.** Three take more than 30 minutes; the 8110 Unimog, the slowest, takes three hours with least motion.
- **A benchmark of the solver itself**, `npm run bench`: six drags, from the 956 Auto Chassis to the 8110 Unimog, timed stage by stage.

### 2. Least motion, adopted when it beats holds: done

[Least motion](least-motion.md) chooses a drag's motion by tiers of least squares instead of holds. It's adopted when all the tests pass and at least as many functions work as with holds on the full check. Its third and fourth rounds fixed what it did worse, each time a general flaw, and made the function check fair (a control counts as turned only as far as it turns against what its shaft turns in). Its fifth round ran the full check both ways: 508 functions work with least motion, against 506 with holds, and every test passes, so it was adopted. Holds remain for pushes, and behind `?holds`.

### 3. One problem for each step

Choosing the motion, taking the step and closing the loops become one problem: of the positions that keep every connection and turn the dragged joint as far as asked, the one that costs least, least motion's tiers being the cost. Ends of travel and contacts are limits it may not pass. That's how robots' inverse kinematics and position-based physics engines work. Closing the loops as a separate pass goes, a dead point is just a step with no answer, play is a soft weight, and the car standing on its tyres is one more connection. The plan for it, and what it should retire, is in [One problem for each step](one-problem.md).

Its first round, closing a step's loops by the tiers rather than by size alone, met the adoption test (all the tests pass both ways, and on the full check 532 functions work against 531) and was adopted; `?passes` and `KINEBRICK_ONE=0` turn it off. The function check's results are now its: 534 functions work, 319 partly and 194 no, against least motion's 531, 318 and 198. Next: choosing the step's motion in the same rounds (the Newton step), then tyres and play as rows.

### 4. MuJoCo as a second opinion

Which way a real mechanism goes is settled by friction, mass and springs, and holds and tiers both stand in for them. [MuJoCo](https://mujoco.org) has those. The mechanism Kinebrick infers is written out as a MuJoCo model (gears and differentials as linear ties between joints, loops as connections it keeps), dragged with friction on each joint, and compared with Kinebrick: where they disagree, one of them is wrong. It runs in Node, through MuJoCo's WebAssembly build, for checking only. [LegoTechnicSimulation](https://github.com/yoff/LegoTechnicSimulation) went this way, and is read first.

MuJoCo infers nothing: the connections and meshes are still Kinebrick's to find. Its connections are soft, so gears slip and loops sag a little, which is why it isn't the viewer's solver. Whether its answers can settle the costs in line 3, or whether it should become the solver, is what this line finds out.

### 5. Connections from data, not rules

About 90 sets have parts Kinebrick doesn't connect or mesh yet. First, no part in an official set without connection data. Later, connections inferred from parts' shapes (round holes, axle holes and studs in their geometry), which would cover any part from any source, Studio's among them.

## How progress is measured

- The function check: how many functions work, and with line 1, how many move by the right amount.
- The solver getting smaller: its lines, the rules and tiers it has, and the sets its code names (about 30 at 0.850).
