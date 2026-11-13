# The road to 100%: technical and management plan

Written 2026-11-10, at `main` = `solver` = 67370ba. Erik accepted it on 2026-11-10, with the branches, models, early physics and status page written in below. It builds on two reviews of the solver branch made the same week. The solver's own line of work stays in [solver-phase.md](solver-phase.md) and [one-problem.md](one-problem.md).

## The goal

Every function of every Technic set in the LDraw Official Model Repository works correctly in Kinebrick.

"Works correctly" has four parts. All four must be true for a function to count.

1. Every part the function should move does move, and every part that should stay does stay.
2. Each part moves by the right amount, where gears or geometry say what the amount is.
3. A drag there and back returns every part to where it started.
4. No part the function uses is loose.

The goal has two milestones, because some functions need forces.

| Milestone | Functions | What it needs |
|---|---|---|
| A. Kinematic 100% | 1,105 of 1,224: the 1,047 checked today, and the 58 not checked | Kinematics only. No forces. |
| B. Full 100% | All 1,224: the 119 skipped today too | Gravity, springs, air pressure, ratchets, brakes. |

## Where we stand

The function check on all 186 sets, run in full on this Mac on 2026-11-12 (the 8110 is checked apart, the same day). Since 2026-11-12 the check pushes the controls a user would push, which took 12 functions out of "works" (decision 9 of that day):

| Result | Functions |
|---|---|
| Works | 522 |
| Partly | 332 |
| Doesn't work | 193 |
| Skipped (needs force) | 119 |
| Not checked (nothing worked by hand) | 58 |

In 27 sets, every checked function works. In 13 of those, no function is skipped or unchecked either. 69 more sets are one or two checked functions short.

What we know about the 514 failures:

- 142 use a mechanism the check cannot operate: a selector, a motor, a gearbox shift, a pneumatic cylinder, a slip clutch. Some of these are failures of the check, not of Kinebrick.
- 99 part types connect but do not move as they should (`data/not-moving-yet.json`): shock absorbers, the 28 and 60 tooth turntables, constant velocity joints, clutch gears, 39 tyres and wheels that don't roll.
- About 250 part types are loose in small groups. The other 76% of loose parts are whole second models that share a file with the main model, which is a counting problem and not missing data.
- 144 questions about the function lists are open, and 148 functions are inferred from the model, not from the book. A wrong function list makes a correct model fail.
- The rest are the solver's: it chooses the wrong motion, stops early, or does not come back.

When this plan was written we did not know the size of each group: the check recorded a result, not a cause. Measuring the causes was the first job.

### The causes, first measured 2026-11-11

`npm run functions -- --causes` now gives every failing function one cause from a fixed list (see [Causes](../ARCHITECTURE.md#causes)), told from the motions the mechanism allows where the control starts. On the full check of 2026-11-11:

| Cause | Functions | For |
|---|---|---|
| A part that should move can move, but nothing ties it to the control | 182 | Inference |
| The control has a joint, but nothing lets it move | 75 | Inference |
| The control, or a part it should move, is loose | 69 | Inference |
| A part that should move can't move at all | 62 | Inference |
| The control is part of the frame, or has no joint | 56 | Inference |
| The mechanism is right, but the drag stopped before half way | 29 | Solver |
| A part that should stay moved, though the control can move without it | 22 | Solver |
| The control went far enough, but a part hardly moved | 6 | Solver |
| A part that should stay has to move with the control | 9 | Function lists |
| A control to be worked first didn't go | 4 | Check |

What this says, and what it doesn't:

- **444 of the 514 point at the mechanism Kinebrick infers, and 57 at how the solver moves it.** So phase 3 (connections and parts' behaviour) is where most of the functions are, not phase 4.
- **75 of the 182 "nothing ties it" are functions with a selector, a motor or a gearbox.** The check already shifts: it slides a driving ring or turns a lever that a function lists as worked `first`, and it turns a motor's output. 28 of the 75 list a control worked first and still fail, so those are the inference's. The other 47 list none: for each, either the function list lacks its `first`, or the model is built in gear and the fault is the inference's. Telling the two apart is a lane's first task. What the check can't work yet is a gear stick with a gate (the 956, the 8880).
- **"Nothing lets it move" is partly the solver's.** A linkage that fits only as built, or a hinge held by a friction pin, has no exact motion. Play as weighted rows (phase 4) would free some of the 75.
- **The causes are a first cut.** They are told at the start of the drag only, on the first control that fails. "Nothing ties it" can't yet tell a missing connection from a linkage with a second way to move.
- **The total hides losses.** Against release 0.850, 533 functions work where 522 did, but 38 functions' results got worse (`npm run ratchet -- 0.850`).
- **Two runs of the same code do not agree in full.** Against the results stored before it, this run has 9 functions better and 2 worse (42111 function 4 and 8110 function 14, each with one more part that did not come back), with no change to the solver between them. These results are kept as the new base all the same, as the code is the same. The jitter test of phase 1 has to say how much a result moves from run to run, so the ratchet can tell a real loss from this. A second run the same day, of every set but the 8110, agreed with this one in full: so the 11 differences may come from the stored results' older commits and not from chance.
- **One set took most of the time.** The 8110 took 5 hours in one process; the next slowest, the 42082, took under 1. Since then (2026-11-11) a slow set is checked a function to a process, with the same results, and the 8110 is checked apart from the rest, before a merge to `main`: even side by side, it takes 1 hour 55 minutes, as long as its slowest function. The daily check of the other 185 sets then took 51 minutes, and came out the same as the run before it, function for function. See [Where the 8110's time goes](#where-the-8110s-time-goes).

### Results that hang on where the model sits

`npm run invariance` checks each set's functions on changed copies of its model, and compares each with a plain copy. None of the changes alters the mechanism, so every function should come out the same. On the 33 quick sets (209 functions), 2026-11-11:

| The model is | Same | A control went a different distance | Other parts listed | Another result |
|---|---|---|---|---|
| copied as it is | 209 | 0 | 0 | 0 |
| moved 1,000 LDU along and 600 back | 195 | 1 | 12 | 1 |
| turned a quarter turn about the upright | 204 | 1 | 4 | 0 |
| turned 37 degrees about the upright | 203 | 1 | 4 | 1 |
| nudged: every part by up to 0.05 LDU each way | 171 | 2 | 12 | 24 |

- **The plain copy agrees in full**, with the stored results too. So the check is repeatable, and the differences below are real.
- **Moving the model changes 14 functions.** The solver's answer hangs on how far the model is from the origin. That is the solver's to fix (phase 4): a model's place should not matter.
- **Turning it changes 5 or 6.** Fewer than moving it, and about as many at 37 degrees as at a quarter turn, so little hangs on parts being square to the axes.
- **A nudge of 0.05 LDU changes 38, and the result of 24 (11%).** 20 of the 24 get worse, 8 of them from works to no; 4 get better. A stud is 20 LDU, so the nudge is a quarter of a percent of a stud.

**What the nudge trips** (2026-11-11, from the causes the check gives and from `npm run nudge`, which compares the mechanism worked out from a nudged model with the model's own):

| What changes | Where | How much, on the 33 quick sets | Results it changes |
|---|---|---|---|
| The mechanism jams: the control has a joint, but nothing lets it move | The solver. A motion is free only if it keeps every equation exactly (`RANK_TOLERANCE`, 1e-6, in `src/linalg.ts`), so a shaft in two holes that are 0.05 LDU out of line can't turn | 18 functions | 18 of the 24, 16 of them to no |
| Which of its holes a free pin is fixed in | The inference: `fixPins` in `src/inference/pins.ts` picks the hole the pin goes furthest into, and two equal overlaps of 18 LDU become 18.00 and 17.96 | 406 parts change body, in 18 sets | None. A trial that counted overlaps within 0.5 LDU as equal left all 24 as they were, and changed no result of the models as built |
| Which of two parts a piece is counted as fixed to: mostly hose and cable segments and chain links | The inference. The rule that chooses is not traced yet | 757 attachments, in 15 sets; 251 parts change body | Not measured |
| A connection found or lost | The inference: `ALIGN_TOLERANCE`, 1 LDU. Some parts are built that far off their hole (an axle of the 8851 through two plates), and the nudge takes them either side of it | 6 connections in 3 sets; 2 parts come loose in 2 sets | At most the 6 that don't jam |
| Gear meshes | | None | None |

- **The nudge trips the solver, not the inference's tolerances.** Those are 0.5 LDU and more, ten times the nudge. What it trips is the solver's exactness: it allows no play at all.
- **This is a second reading of "nothing lets it move".** That cause has 73 functions in the full check. A model in the OMR is not exact either: its parts are placed to three decimals, through sub-models turned by rounded matrices. Some of those 73, and some drags that stop early, are likely the same jam. Play as weighted rows (phase 4) is the fix, and this measure is its test: it should bring the 18 back.
- **The inference's ties move parts between bodies.** The pin tie changes no result; the other is not measured. Both can be made steady by counting near-equal amounts as equal. That is a small task for an inference lane.

The measure fails while any result changes. It joins the gate once it passes on the quick sets.

## Principles

1. **Measure before you fix.** Every failing function has a recorded cause. Work is chosen by cause, largest first.
2. **Fix causes, not sets.** Set-by-set fixes did not move the totals (see [solver-phase.md](solver-phase.md)). A fix must name the general fault and come with a small test model that shows it.
3. **One writer for each file.** Parallel work is safe only where two workers never edit the same file. The solver core has one owner.
4. **A gate replaces review.** A change is kept when the tests and the function check say so. Erik reviews afterwards, not before.
5. **The check must stay honest.** No worker may change the function lists to raise the score.

## Technical plan

### Phase 0. A clean base (done 2026-11-10)

- `main` fast-forwarded to `solver`.
- Stale branches, worktrees and planning notes removed.
- `solver` removed and `preview` made (see [Branches](#branches)).

### Phase 1. Measure

Make the function check say why, make it complete, and make it fast.

| Work | Code | Tests |
|---|---|---|
| A `cause` for each failing function, from a fixed list: control fused to the frame; loose part; jammed with nothing held; moves, but the solver chose another motion; stops early; wrong amount; not back; the check cannot operate it | `scripts/triage.ts` (new), reading each set's results and re-running the failing drag with a trace | One fixture for each cause |
| A stop-reason probe: for one drag, piece by piece, which bodies moved most, how far each listed part went, and what stopped it, as text and as JSON. Later, from inside the solver: each step's tier costs, held bodies, strayed joints and loop gap | `scripts/probe-drag.ts` (new) | Its output for two known drags |
| The check shifts gearboxes, clicks slides and runs motors, as the viewer does | `scripts/check-functions.ts` | The 956's gear lever and the 8880's gearbox, through the check |
| Results leave `data/sets/` for a folder of their own, all from one commit | `scripts/check-functions.ts`, `results/` (new) | The curated files no longer change when the check runs |
| Slowest sets first, by the last run's times | `scripts/check-functions.ts` | None needed |
| The full check runs on demand, with no schedule on any machine, and a ratchet compares it with any commit. The slowest sets (for now the 8110) are left out of it, and checked before `main` moves | `scripts/check-functions.ts` (`--slow`), `scripts/ratchet.ts` (new) | The ratchet against a known commit |
| The scan counts each large separate group in a file as a model of its own | `scripts/scan-omr.ts` | A two-model file |
| Invariance: a model moved and turned about the upright gives the same results. Jitter: parts moved by 0.05 LDU give the same results | `scripts/invariance.ts` (`npm run invariance`): a measure for now, a gate once it passes | Its plain copy matches the stored results |
| Skip reasons from a fixed list: needs gravity, needs force, model error, check limit | `data/sets/*.json` (`skip`), `data/sets/README.md` | A test that each reason is on the list |

**Done when:** every failing function has a cause; the full check takes under an hour, so it can run whenever it is wanted; one command says what a change gained and lost.

**Where it stands, 2026-11-11.** Done: the causes, what stopped each drag (`stop`), the drag probe (`npm run probe`), slowest sets first, a slow set checked a function to a process, the 8110 checked apart (`npm run functions -- --slow`), the full check at 51 minutes, the ratchet (`npm run ratchet`, against any commit), and the status page with causes. Left: the check shifting, clicking and running motors; results in a folder of their own; the scan's count of second models; skip reasons from a fixed list; the gear stick with a gate. The invariance and jitter measure is written, and does not pass: see [Results that hang on where the model sits](#results-that-hang-on-where-the-model-sits).

### Phase 2. Structure

Make the code safe for more than one writer, and make the check fast enough to use all day.

| Work | Code | Tests |
|---|---|---|
| Each kind of connection in a file of its own, behind one interface: its rows, its gap, its weight | `src/constraints/` (new), out of `buildEquations` in `src/kinematics.ts` | Every test passes, results bit for bit as before |
| Each inference rule in a file of its own, run in a named order | `src/inference/` (new), out of `buildMechanism` in `src/mechanism.ts` | The same |
| The linear algebra in a file of its own | `src/linalg.ts` (new) | Unit tests for null space, tiers and the eigen-solve |
| One object for a drag's state, made when the drag starts and dropped when it ends | `src/kinematics.ts` | The there-and-back tests |
| Switches as options on the solver, not constants read at start-up | `src/kinematics.ts` | Two settings compared on one loaded model |
| Part tables out of the code and into data: actuators, rails, catches, the chain link | `data/roles.json`, `src/mechanism.ts`, `src/shift.ts`, `src/ldr.ts` | The existing tests |
| A drag solved only over the parts it can reach, with the frame held | `src/kinematics.ts` | The bench, and results as before |
| Pushes chosen by least motion, and holds removed | `src/kinematics.ts`, `src/interaction.ts` | Push functions added to the check first |
| A small test model for each set a comment names (27 in `kinematics.ts`, 13 in `mechanism.ts`) | `tests/fixtures/` | Each fails without its fix |

**Done when:** `kinematics.ts` and `mechanism.ts` are each a short file that calls others; the full check takes under an hour; `KINEBRICK_LEAST` and `KINEBRICK_ONE` are gone.

**Where it stands, 2026-11-11.** The solver owner's first five steps are merged into `preview`, each with results the same to the last bit: the linear algebra in `src/linalg.ts`, each kind of connection's equations in `src/constraints/`, a `Drag` object for a drag's state, the switches as options on each solver, and a drag solved only over the parts it can reach. `src/kinematics.ts` is 2,641 lines, from 3,862. The inference split was done by one worker on 2026-11-12: `src/mechanism.ts` is 396 lines, from 2,720, and holds the types and the ordered list of calls; 24 files in `src/inference/` hold the rules, one rule or group to a file, and no fingerprint of the 190 models changed. Left: the part tables into data, pushes by least motion (which waits for push functions in the check), and the test models for the sets that comments name.

**Reach is on by default since 2026-11-12** (`KINEBRICK_REACH=0` turns it off). It was merged switched off on 2026-11-11, for this reason. On, the full check takes 30 minutes where it took 51 (5.0 hours of work where it was 8.3), and the same 533 functions work, but not the same ones: 8 get better and 5 worse, so it does not pass the ratchet. The 5 are all drags that roll a model on its wheels or leave a part not back: 42079 function 4 and 8273 function 11 (works to partly), and 855 function 6, 42110 function 3 and 9394 function 3 (more parts not back). It is turned on when those 5 are fixed. On 2026-11-12 the solver owner's fixes (a drag leaves out the rows on nothing but what it holds, and holds what it can't reach whole on the frame) took the 5 to 3: 9394 function 3, 42079 function 2 and 42110 function 3, each with one more part named as not back. Those three were the ratchet's fault, not reach's: the check names the one part left furthest each way a control is worked, and where two parts are left as far as each other (the 9394's p56 and p57, to the eighth decimal) rounding picks the name. The ratchet now counts the ways that leave a part not back, from `back`, and not the names. By that count the three are no worse. What is left with reach on is in the 8859: rolling it by a rear wheel stops at a dead point after 0.1 of 1.5, and function 5 has 4 ways not back where it had 3. The solver owner traced the stop to a fault that is there with reach off too (whether function 5's fourth way has the same cause is not checked): the differential's bevel gears are built with their axes exactly 0.5 LDU apart, which is `AXIS_TOLERANCE`, and after one step rounding puts them a hair over, so the spider gear's two meshes drop out of the equations. That fix, and the 42110's car sliding sideways as it rolls, change results with reach off, so each goes in as a commit of its own with its own full check. The bevel fix went in on 2026-11-12 (the 8859's three functions that roll it come back exactly, and nothing else changed). The first fix tried for the 42110's slide did not, and the second did: see decision 7 of 2026-11-12. With both fixes in, the full check with reach on passed the ratchet on 2026-11-12: 522 functions work, as with it off, 1 better (the 8274's function 6 has 1 way not back where it had 2) and 0 worse. 1,543 numbers changed, 1,215 of them under a millionth both times. Reach acts only on a drag that turns a joint, so none of the 83 functions with a pushed control changed. So reach is on by default, in the viewer too, and the stored results are those of the run with it on.

#### Where the 8110's time goes

Measured on 2026-11-11, for the line "A drag solved only over the parts it can reach". The 8110 has 663 bodies, 1,093 joints, 713 tree coordinates and about 320 free motions. Every step of every drag is solved over all 320, wherever the control is.

| What | Time | Where it goes |
|---|---|---|
| One step of a drag | 2.7 s | Finding the free motions 0.7 s; choosing among them 1.9 s, in two rounds of tiers at 0.8 s each (about 6 eigen-solves of a 312 by 312 matrix, 51 ms each) |
| Closing the loops after a step, when the step opened them | 7.4 s | 7 rounds, about 1 s each. Each round finds the free motions afresh (0.2 s) and chooses a mix of them by 9 tiers (0.5 s) |
| Function 2 (steering wheel), 1 control | 9 minutes | Choosing the motion 68%, finding the free motions 28% |
| Function 3 (rolling the truck), 4 controls | 1 hour 55 minutes | Closing the loops 76% |

There is no one slow routine to fix: the time is spread over the null space, the Gram matrices, the eigen-solves and the tiers, and each is as large as the whole model. Two changes would cut it, both the solver owner's:

- **Solve over what the drag can reach.** A drag at the steering wheel can't reach the crane, the winch or the stabiliser legs, but their motions are solved with it all the same. The cost of each routine above grows with the square or the cube of the number of motions. How many each control reaches is not measured yet.
- **Fewer or cheaper rounds to close the loops.** 7 rounds a step is many for a method that should about square its error each round. The free motions are found afresh each round for a reason (the 42062 Container Yard's spreader), so this needs its own test before it changes.

Splitting the check further, a control to a process, would bring the 8110 to about half an hour beside the other sets. It is not done: it would not cut the 6 hours of work, which the changes above would. None of this is pressing: the 8110 is not a focus until the work on the other sets is done.

### Phase 3. Burn down by cause

This phase runs in lanes, at the same time as phase 4. Each lane takes its work from the triage.

| Lane | Work | Gate |
|---|---|---|
| Part behaviours | The 99 part types that don't move yet, most common first: turntables, constant velocity joints, clutch gears, wheels that don't roll | The part comes off the not-moving list; a fixture moves it; the check doesn't get worse |
| Connection data | The 250 loose part types, most common first: round 1 x 1 parts, chain links, the 3L driving ring | Loose count down; joints baselines unchanged; the check doesn't get worse |
| Model errata | Parts out of place in the OMR's files | Erik signs off each correction |
| Function lists | The 144 open questions and 148 inferred functions, answered from the instruction books | Erik signs off each batch |
| Fixtures | Each solver failure cut down to a small model that still fails, grouped by fault | The fixture fails for the same cause |

**Done when:** no failing function has a cause other than the solver's or a need for force.

### Phase 4. A general solver

One owner. This phase starts as soon as phase 1's triage exists, beside phase 2. It does not wait for phase 3.

**A touch of physics, early.** Gravity and springs come first, as costs in the tiers the solver already has. They are not a physics engine: nothing has mass that accelerates, and nothing balances a weight against a spring. The reasons to bring them forward:

- They replace code. The balanced-part rule, the tipping tier and the rigid shocks are stand-ins for gravity and springs. It is cheaper to remove them now than to restructure them in phase 2 and remove them later.
- They reach many functions. 51 failing functions are suspension, and 99 are hinges, hooks and other parts that hang. Of the 119 skipped functions, most give a spring or gravity as the reason. These are upper limits: the triage will say how many each one fixes.
- They are cheap to try. Each goes in behind a switch, and is kept only if the full check gains by it, as least motion was.

Forces proper (a weight against a spring, friction under load, air pressure, momentum) still wait for phase 5.

The order of the rest may change as the triage shows which faults are most common.

| Work | What it replaces |
|---|---|
| First (moved up on 2026-11-12): play as weighted rows. Every loop-closing connection may give a little | `playMotion`, and the rules that line axles and balls up |
| Second: gravity as a tier. A part's centre of mass is kept from rising or falling | The balanced-part rule, the two-tyre tipping tier |
| Third: springs as a soft cost. A shock absorber may change length, at a cost | Rigid shocks, and suspension that moves only by play |
| A continuity tier: prefer the motion nearest the last step's | `STILLNESS`'s threshold, `dragGrip`, `dragSuspension`, strayed-joint holds |
| The Newton step (stage 2 of [one-problem.md](one-problem.md)), then tyres as rows | `settle`, `parked`, most of the dead-point code |
| Lengths in studs, and one relative tolerance | About 30 separate tolerances |

**Done when:** milestone A. Every checked function works, by the four-part definition.

### Phase 5. Forces

The skipped functions that phase 4's gravity and springs do not reach: a weight against a spring, air pressure, ratchets, brakes, clutches that slip. This is version 2.0, through MuJoCo. It starts when phase 4 shows how far costs in the tiers can go.

**Done when:** milestone B.

## The train track: a second line of work

Started 2026-11-11, to get more work going in parallel. It is separate from the milestones above: it does not count toward them, and it does not wait for them.

**The goal.** Very basic train motion on every OMR train set that comes with track: a train moves along straights, curves, switches and crossings, and each switch can be flipped to change the route. As everywhere else in Kinebrick, the user moves the train by turning one of its wheels.

**Not yet.** Electrics, control boxes, motors, signals. No real wheel-on-rail contact.

### Steps

1. **Gather the sets.** Every OMR set that includes track (10001 Metroliner is one), in a list like `models/technic-sets.csv`. The first report is three numbers: train sets in the OMR, those that include track, and those whose file lays the track out as a layout a train can run on.
2. **Layouts.** OMR files follow the building instructions, so the track is often a pile of pieces, not a layout. For those sets, a layout is generated from the set's own track pieces: a loop, with the set's switches and crossings in it.
3. **Track as a path.** The track pieces' ends are joined into a graph. Each piece gives a centre line (a straight, an arc, two crossing lines, or for a switch, two lines that share an end). A switch is a control with two states, and its state picks the branch.
4. **Trains on the path.** Each wheelset is held to the centre line of the piece it is on. Bogies pivot, cars are coupled, wheels roll: their turning is tied to the distance gone. A train is then close to one freedom, the distance along the track.
5. **The viewer.** A Trains group in the model menu, beside Working sets, Work in progress sets and Test models.
6. **The check and the status page.** Each train set gets a function list a machine can check: the train goes the full length of the track (on a loop, a full lap, back to its start), every wheelset stays on the path, the cars stay coupled, and each switch flips and changes the route. The same function check and ratchet run on them. A status page of the train sets follows, as for Technic: one box for each set, sized by its pieces, green to black by the share of its functions that work.

### Order

The 9 V track and the plastic track that followed it (RC, Power Functions) share one geometry, so they come first. The older 4.5 V and 12 V track, with separate rails and sleepers, comes after.

### Keeping the two lines apart

- The train code lives in files of its own, with small hooks into the solver, the inference and the viewer.
- `preview-train` takes `preview` in each day. Nothing goes the other way yet.
- The train check runs four sets at a time, so the Technic work keeps its share of the Mac's 12 cores.

## Management plan

### Who does what

| Role | Who | Does | Writes |
|---|---|---|---|
| Owner | Erik | Sets the goal. Signs off function lists and errata. Reads the status page. Moves `main`. | Nothing he doesn't choose to |
| Orchestrator | One Claude Fable 5.2 session, medium effort | Owns the design of the code and decides the order of the work (since 2026-11-12, see the decisions below). Keeps this plan, the backlog and the gate. Briefs workers and merges their branches into `preview`. Publishes the status page. | `scripts/`, `.github/`, `docs/plan.md`, `results/` |
| Solver owner | One Claude Opus 5.5 session, high effort | Phase 4, and phase 2's work in the solver core | `src/kinematics.ts`, later `src/constraints/` and `src/linalg.ts` |
| Workers | Claude Opus 5.5 agents, medium effort, one task each, each in a worktree of its own | Phase 3's lanes | Only the files their lane names |
| Train owner | One Claude Opus 5.5 session, high effort, in a worktree of its own on `preview-train` | [The train track](#the-train-track-a-second-line-of-work), all of it | New files of its own for track and trains, and small hooks into the files of others |
| CI | GitHub Actions, and this Mac | GitHub runs the tests on each push. The full check and the ratchet run on this Mac on demand, with no schedule: the orchestrator starts them when it chooses, and each worker runs them before it hands its work in. | `results/` |

These models are where we start, to keep the cost down. The gate's log shows how often each role's work is kept or reverted; if the solver owner's work is reverted often, that role is the first to move to a stronger model.

### Branches

| Branch | Owner | Rule |
|---|---|---|
| `main` | Erik | Only Erik commits and pushes. It moves when he merges `preview` into it, after the slow check (see [The gate](#the-gate)). The site publishes from it. |
| `preview` | The orchestrator | Commits and pushes at will. Holds only work that passed the gate. The preview site, [/preview/](https://erik-larsen.github.io/kinebrick/preview/), publishes from it, and every push runs the tests. |
| `preview-train` | The train owner | Downstream of `preview`: made from it, and each day the orchestrator merges `preview` into it (a merge, never a rebase) and runs the tests. Its owner commits and pushes at will. Its site is [/preview-train/](https://erik-larsen.github.io/kinebrick/preview-train/). Nothing flows back to `preview` until Erik decides how. |
| Any other, named `<lane>/<task>` (`solver/gravity-tier`, `parts/turntables`) | The session or worker that made it | Made from `preview`. Its owner commits and pushes at will. The orchestrator merges it into `preview` when it passes the gate, and deletes it then, or when the task is dropped. |

Work that is retired but worth keeping gets a tag under `archive/`, not a branch.

Any branch named `preview` or `preview-<something>` is built onto the site under its own name, and its tests run on each push. The site is built by `main`'s copy of the workflow, so a change to how the site is built takes effect when Erik moves `main`.

Erik moves `main` when he chooses, after a look at the preview site, the log and the slow check's results:

```bash
git merge --ff-only origin/preview
```

### Who may write which file

| Files | Writer |
|---|---|
| `src/kinematics.ts`, `src/constraints/`, `src/linalg.ts` | The solver owner only |
| `src/mechanism.ts` | One worker at a time, until phase 2 splits it. Then one worker for each file in `src/inference/` |
| `data/corrections.ldr`, `data/roles.json` | Connection and part-behaviour workers, one part type each |
| `data/sets/*.json` `curated` | Function-list and errata workers draft. Erik signs off. No other worker edits it. |
| `results/` | The check only |
| Track and train files (new: the track graph, the path constraint, the train sets' list, results and status page) | The train owner only, on `preview-train` |

The train owner keeps its edits to files in this table small: a call into its own files, not logic. Each day's merge from `preview` then stays easy, even while phase 2 reshapes the solver.

### The gate

A worker's change is kept only if all of these are true.

1. The tests and the type check pass.
2. The quick check loses nothing.
3. The full check loses nothing (`npm run functions`, then `npm run ratchet -- preview`): no function goes from works to partly or no, has more parts move by the wrong amount, or has more of the ways its controls are worked leave a part not back. The worker runs it on its own branch before it hands the work in.
4. The change does not touch `curated` data, unless its lane drafts curated data for Erik.
5. A fix in the solver or the inference comes with a fixture that fails without it.
6. No new tolerance or weight comes without a test that shows what it is for.

A branch is merged into `preview` only when all are true. The orchestrator runs the full check on `preview` whenever it chooses; if it fails there, the orchestrator reverts the merge and logs why. A worker that fails the gate twice on one task stops, and the task goes back to the backlog with its notes.

**The full check** is `npm run functions`: every set but the slowest, 185 sets in 51 minutes on this Mac (2026-11-11). It runs on demand. Nothing is scheduled on any machine. One runs at a time: two at once take about twice as long, so the orchestrator gives workers their turns.

**The slow check** is `npm run functions -- --slow`: the sets the full check leaves out, for now only the 8110 (about 2 hours). The orchestrator runs it on `preview`, with the ratchet, before it offers `main` to Erik, and reports what it found with the offer. That is about once a week. The 8110 is not a focus until the work on the other sets is done: between merges to `main`, its results stay as the last slow check left them.

### What Erik sees

- **A status page**, refreshed after each full check on `preview` (`npm run status`). First, a grid of boxes, one for each OMR set, each sized by the set's number of pieces and coloured by the share of its checked functions that work: green for all, yellow for 75% to 99%, orange for 50% to 74%, red for 1% to 49%, black for none. Then the count of failing functions by cause over time, each lane's queue, and what waits for him.
- **A sign-off queue**: function-list answers and errata, in batches, each with the book page that supports it.
- **A log**: one line for each change kept or reverted, with the score before and after.

### Cost

- Workers run only in lanes with a gate a script can check.
- A fleet starts only when Erik says so, with a stated number of workers.
- The checks run on this Mac (a Mac mini, 12 cores) as plain commands, on demand. No schedule is installed on any machine.
- The models in [Who does what](#who-does-what) are the cheapest that we expect to do each job.

## Decisions, made 2026-11-10

1. **Who commits.** `main` is Erik's alone. The orchestrator commits and pushes to `preview` at will, and each other branch's owner to that branch (see [Branches](#branches)).
2. **Branches.** `main` and `preview`. `solver` is removed.
3. **Milestone A first, with a touch of physics early.** Gravity and springs come in at the start of phase 4, as costs in the tiers. Forces proper wait for phase 5.
4. **Old branches.** The retired survey and the least-motion prototype are kept as the tags `archive/omr-survey` and `archive/least-motion-prototype`. Neither needs a branch.

## Decisions, made 2026-11-11

1. **A train track beside the Technic work**, on `preview-train`, by its own Opus 5.5 high session (see [The train track](#the-train-track-a-second-line-of-work)).
2. **Generated layouts.** Where a set's OMR file doesn't lay its track out, a layout is generated from the set's own track pieces.
3. **The site.** The pre-release site, `/prerelease/`, is now `/preview/`, and `preview-train` has a site of its own, `/preview-train/`. The old address sends visitors on.
4. **How train work comes back upstream to `preview`** is decided later.
5. **The full check runs on demand**, when the orchestrator decides, now that it takes 51 minutes. No check is scheduled on any machine.
6. **Each worker runs the full check before it hands its work to the orchestrator**, once workers are in use. Open, for when a fleet starts: a full check uses ten of the Mac's twelve cores, so six workers taking turns need about five hours a round. The orchestrator's suggestion is that a worker runs the quick check and the sets its change touches, and the orchestrator runs one full check on each batch it merges.
7. **The 8110 is checked before a merge to `main`**, not on a schedule. It is not a focus until the work on the other sets is done.

## Decisions, made 2026-11-12

1. **The orchestrator owns the design.** Erik's words: "You are the owner and long-term maintainer of this codebase, and its design is up to you." The orchestrator decides design questions and the order of the work, records each decision here with its reason, and directs the other sessions. `main` is still Erik's alone, and he still signs off function lists and errata, which are facts about the real sets.
2. **Play comes first in phase 4**, before gravity and springs. The reason is measured: of the 24 results that a nudge of 0.05 LDU changes on the quick sets, 18 jam because the solver allows no play, and 73 functions in the full check fail as jammed. Results that turn on rounding also make every later gain hard to measure. Gravity and springs keep their order after it. The solver owner starts it when reach is on by default.
3. **The inference split goes to one worker now** (Claude Opus 5.5, medium effort, branch `claude/inference-split-c4f405`; done the same day): `src/mechanism.ts`, 2,720 lines, becomes a short file that calls one file for each rule in `src/inference/`. It is the last thing that keeps phase 3's lanes from having more than one writer. Its gate is the fingerprint of every set's mechanism (`npm run digest`, 47 seconds for 190 models): no fingerprint may change.
4. **A worker's gate** (this settles the open point in decision 6 of 2026-11-11). A worker runs the type check, the tests, the quick check with the ratchet, the sets its change touches, and, where its change must not alter what is inferred, the fingerprints. The orchestrator runs one full check on each batch it merges. The solver owner still runs the full check itself, since its changes reach every set.
5. **The ratchet counts ways, not names.** Coming back is counted by the ways a function's controls are worked that leave a part out of place, not by the parts the check names, which turned on rounding where two parts were left equally far.
6. **Workers and cost.** One worker for a task in phase 2 is the orchestrator's call. A fleet, several workers at once on phase 3's lanes, still starts only on Erik's word, with a stated number.
7. **The 42110's sideways slide is not fixed by what a correction costs.** Rolled by a wheel, the 42110 Land Rover Defender slides tens of LDU sideways while the solver closes gaps of 0.00001 LDU: the correction is a million times the gap. The first fix counted tyre scrub in the step of the correction that keeps the steering still. It cured the slide and failed its full check: 530 functions work where 533 did, 1 better and 6 worse, and 799 numbers changed in 16 sets, since it changes what every correction costs on every car with tyres and steering. It is dropped. A fix must act only on a correction that is out of proportion to the gap it closes, and leave every other correction the same to the last bit. The solver owner makes one attempt of that kind. If that has any function worse in the full check, the slide is recorded as a known fault and left, since play is worth more (73 functions with a jammed control against 1). **That attempt passed, the same day.** The cause was a floor that was too low. When the solver closes a loop it keeps some things still in turn (what is mounted, the steering, and so on), and it leaves a thing out when the free motions move it by no more than rounding error. The 42110's free motions turn its steering by a billionth of a radian for each unit of motion, which is rounding error, but the floor was a ten-billionth, so the solver kept the steering still, and to cancel a turn of 0.0002 with motions that small it mixed in 13 million times the correction, which slid the car. The floor (`NOISE` in `src/linalg.ts`) is now a hundred-millionth. With reach off the full check has the same 522 functions working, 0 better and 0 worse, and 98 numbers changed, 41 of them by more than a millionth, in 5 sets (42043, 42082, 8844, 42110, 42096). The 42110's function 3 came back 1,216 LDU out of place and now comes back 5.2 out, and the 42043's functions 10 and 11 came back up to 161 out and now 8.4 or less. The floor leaves a thing out in 12 sets. What is left of the 42110's function 3 (5.2 LDU, still over the 0.5 that counts as back) is not looked at before play is in.
8. **How play is built** (the solver owner's design, approved with conditions). Only the rows of a joint that closes a loop give: a pin or axle in its hole, a ball in its socket, a slide across its axis. Rules about speeds (gear meshes, universal joints, chains, strings, tyres, holds) give nothing, since a slip in them is never undone. A connection may sit up to 0.1 LDU off (a real pin has about 0.25 LDU of clearance in its hole), and a loop may open at most 1 LDU for each radian the control turns. Free motions are found from the other rows only, and the loop rows are the first thing a step keeps small, so a loop that fits exactly still moves exactly. The conditions: it is a solver option, `play`, off by default, and with it off every result is the same to the last bit; which motions open the loops alike is said by a figure in LDU per radian, not by a relative tolerance, so that no result turns on rounding; closing the loops still closes them wherever it can; a step may take no more than 1.5 times as long. It is measured by the nudge of 0.05 LDU on the quick sets (24 results change today), by the ratchet (none worse), and by how many of the 73 functions with a jammed control then turn the whole way. It is built after the full checks that decide reach.
9. **The check pushes what the viewer pushes.** In the viewer, a part that hangs on a hinge but does not spin on it like a knob (a door, a bonnet, a swing arm, an arm of a linkage) is pushed: the point grabbed follows the pointer. The check turned every control on its joint, which no drag in the viewer does, so for these parts it measured a motion no user gets. It now grabs such a part by a point on it and pushes it the way its hinge carries that point, with the viewer's own steps and holds, and pushes it back the same length. 83 functions have such a control. Turned, 26 of them worked, 12 partly and 45 not; pushed, 15 work, 23 partly and 45 not, and 31 have more ways that leave a part out of place. So the count of working functions is 522, where it was 533. The solver did not get worse: no function without a pushed control changed in any figure, and that same full check is the one for the inference split (decision 3), which it passes. The new results are the stored ones the ratchet compares with. They are the measure for the solver owner's step "pushes chosen by least motion, and holds removed": the viewer's push takes the least-squares mix of the free motions, not the one the solver's tiers would choose, and that is what these 68 functions wait for. The 8110 is checked apart, so its functions keep their turned results until the slow check before the next merge to `main`. The 8110 was checked so later the same day, in the slow check before a merge to `main` (2 hours 19 minutes on 4 processes, with other work beside it). 5 of its 16 functions have a pushed control. Two came out worse, both of those: function 5 (the portal axles swing about the frame) goes from works to partly, with 2 ways not back where it had none, and function 14 has 4 ways not back where it had 1. Its 11 functions without a pushed control have the same results, and every part back. So the totals are 521 work and 330 partly, and 88 functions have a pushed control: 16 work, 24 partly, 48 don't.
10. **Play is built as approved, and gear and tyre centres on their axes is a change of its own.** Before building play the solver owner traced the 17 functions that jam when a model's parts are nudged 0.05 LDU. Play as decision 8 has it can reach at most 5 of them (8448 functions 4, 5 and 9, 8849 function 3, 42074 function 2). 12 are stopped by rules about speeds, which play keeps firm: in 8, gears or tyres leave no motion that turns the control (42112 functions 2, 3 and 5, 858 functions 4 to 7, 8851 function 6), and in 4 the only motions open the loops 12 to 26,000 LDU for each radian (42000 function 5, 42112 function 1, 8416 function 3, 8049 function 1). The cause in the 8: a gear mesh's speed is taken at a point between the two gears' own centres, and a tyre's contact point from its hub, but a joint's axis comes from the axle and hole, so a nudge puts a gear's centre up to 0.09 LDU off the axis it turns on, the speeds no longer keep the ratio of the teeth, and a gear train that closes on itself jams. An experiment that takes each gear's and tyre's centre on its joint's axis brings 4 of the 8 back, but with no nudge the 9394's function 4 goes from works to partly. So: play is built now as approved, and judged by the nudge on the 5 it can reach. Centres on axes goes on the solver owner's branch behind an option of its own, off by default, and gets one full check with it on, which says how many of the real jams (73 functions in the full check) it cures. It is on by default only with 0 worse; whether the 9394's function 4 is traced before or after play's first measures goes by that yield. The reason for two changes and not one: each changes results, so each must have its own full check, or a function that gets worse cannot be laid to either.
11. **Play as decision 8 has it is stopped, and the real jams are measured before anything else is built for them.** The solver owner built it behind its option (commit d6bb432 on its branch; off, every result the same). On, it failed two of its conditions and cured nothing. Time: a step took 1.25 times as long on the 42082's function 2 and 1.3 to 1.5 times on the 8416 and 8849, but 7.1 times on the 8448 (14 free motions became 99, and closing the loops took 16 times as long, since a step that takes up play leaves a gap that closing can't close). Quick check: 517 functions work where 522 did, 2 better and 33 worse, most by leaving parts out of place there and back. Of the 5 nudged jams it could reach, none turned the whole way. The cause is in the design: with the free motions taken from the firm rows alone, every step of every drag takes up play, also where the loops fit and an exact motion turns the control. The solver owner proposed a second form, play only where no exact motion turns the control, chosen by the tiers. It is not built now: in the 5 jams it takes up play in the same cases as the first form did, and there the first form cured none, so no measured case says it would cure one. The commit is reverted on the branch. Next the solver owner's trace is run as a script over the 73 functions whose control jams or stops short on the real models, with no nudge, and gives for each what stops it. That table, with the full check of centres on axes (decision 10), says what is built next. Decision 2's reason for play first (18 of 24 nudged results jam for want of play) did not hold up: 12 of the 17 jams are rules about speeds.
12. **The jams are phase 3's, not play's, and the solver owner's next work is the push.** The solver owner's script traced the 104 functions whose control jams or stops short on the real models (the stored causes "the control has a joint, but nothing lets it move" and "the drag stopped before half way", the 8110 left out). What stops them: in 48, the rules let the control turn only by opening the loops more than 1 LDU for each radian, most by tens of LDU; in 15, the rules leave no motion that turns it at all; in 23, the control is pushed, and the push finds no motion or gets stuck; in 9, a step leaves a gap that closing can't close (in 5 of them a gap of 0.003 to 0.044 LDU); 9 are other things. So 63 are locked by tens of LDU, which no slack takes up: a part in the loop that should give is fixed, or a rule is wrong. That is the work of phase 3's lanes, and it agrees with the causes of 2026-11-11 (444 of 514 failures point at the inferred mechanism). The full check of centres on axes (decision 10) had 523 functions working where 521 did, 8 better and 1 worse (the 42066's function 2, which its worm mesh now blocks), and none of the 104 turned the whole way; it stays off by default. What follows, in this order. The solver owner's script names, for each of the 63, the one joint or mesh that locks it, by part number, and counts the functions each part number locks: that list is the first work of phase 3's part-behaviour lane. Centres is tried once more on every kind of mesh, since only spur gears and tyres have it now. Then the solver owner works on the push (pushes chosen by least motion, with the holds removed): 88 functions have a pushed control and 48 of them don't work, the largest group that is the solver's. Play, and phase 4's order after it, wait for a measured case.

## Decisions, made 2026-11-13

1. **Centres on axes gets one last attempt, with the axis chosen rightly.** On every kind of mesh (worm, bevel, rack and crown as well as spur) its full check had 521 functions working, 3 better and 2 worse. Both worse have one cause, which the solver owner found: the centre was moved onto the axis of the joint the gear's body turns on, but a body may turn on one axle and carry a gear on another (a gear on an arm). Of 2,623 meshed gears in the 186 sets, 99 are moved by the hair the change is for (a millionth of an LDU to 1 LDU) and 11 by 1 to 148 LDU, onto the wrong axle. The last attempt takes the joint of the body whose axis runs nearest the gear's own centre, and moves the centre only if that is within 1 LDU. With 0 worse in a full check it is on by default; with any worse, work on it stops for good.
2. **The 5 small gaps are dropped.** In 5 functions a step left a gap of 0.003 to 0.044 LDU that closing could not close. The gap is not there in the model as built: it comes with the step and goes as the square of the step's size, so each of those controls can move to first order and not by any real amount. That is a fault of each model or its rules, not of closing the loops.
3. **The push is built in two parts** (the solver owner's design, approved). The trace of the 23 pushes that find no motion or get stuck: in 10 the control's joint can't turn (jams, like the 63); in 8 the push stops before its first step, since the joint turns only by turning the axle or pin the control hangs on, the control itself still (first laid to the check taking the way to push from the wrong motion; the solver owner then built the motion that turns the control with what it hangs on held still, and in all 8 there is none, so these 8 are locked too and go with the 10); in 4 the push goes its whole way but mostly by moving what the control turns in; 1 moves only by moving the frame. Part 1 is in the check: the way to push is the way the control's point goes when its joint turns with what it hangs on held still, as a hand holds a model and pushes its door. It reaches none of the 8, so a quick check decides whether it is kept: it goes in, as a commit of its own with its own full check, only if it changes a function with a pushed control and makes none worse. Part 2 is in the solver, behind an option, `leastPush`, off by default: a push's step is chosen by the tiers, as a joint's turn is, with how fast the point goes along the way as the rate, a first tier for the point going sideways of the way, and the holds a joint drag has. Its limits: with it off every figure the same, one step at most 1.5 times as long, the ratchet with 0 worse, no more ways not back. Its measure is the tally of the 88 functions with a pushed control (16 work, 24 partly, 48 don't).
4. **The locked functions go to one phase 3 worker, by kind of rule.** The solver owner's script names, for each of the 63 locked functions and the 10 locked pushes, the joint or mesh which, left out alone, frees the control (`locked-by-part.md` in the sessions' notes). No part number locks more than 4 functions, so the work is not one part at a time. By kind of rule: gear meshes (bevel, worm, rack, spur) and universal joints lock about 25, and a single joint of a loop locks the rest, each in its own model. The first package is the gear meshes and universal joints that lock, since one cause there may cure several.
5. **The trace is to move out of `src/kinematics.ts`.** It is about 230 lines there now, behind its switch. It stays until the push is built, then the solver owner moves it to a file of its own, with every figure the same.
6. **Friction pins held rigid are the first cause found that reaches many locked functions.** The phase 3 worker diagnosed the 25 functions locked at a gear mesh or universal joint: all but one mesh are inferred rightly, and the gear is only the link to something locked further on. The causes are many and small (a turntable read whole, an embedded actuator not split, seats that can't slide, bevels meshed at an angle their teeth can't, rubber bands read as belts, 5 that are the solver's), but one is general. Kinebrick builds a model with every friction pin's second and later turning connection rigid, and keeps that build whenever the model has any free motion at all: all or nothing for the whole model. With the rule off (`KINEBRICK_FRICTION_RIGID=0`, an experiment on the worker's branch), 24 of the 81 locked functions get better, 15 of them to works, and 1 worse; 172 of the 190 models change; the quick check has 526 functions working where 521 did, 5 better and 6 worse, all 6 by parts not back. Next: one full check with the rule off, to size the gain and the loss, and then a finer rule is decided. The worker also fixes the turntable, the embedded split part and the bevel angle, each for every set that has the case. Those three went in on 2026-11-13: bevels mesh only at right angles (of 518 bevel meshes only the 42114's was off, at 53 degrees), the 2 x 2 turntables 3680c01 and c02 are read as top and base (only the 851 has one whole), and a part embedded in an OMR file is read as its pieces where the library's part is, in the check's loader and the viewer's (only the 42108 has one). Only those three models' fingerprints changed; the 851's function 1 now works, and the 42114's function 4 and the 42108's function 5 go from no to partly.
7. **A renumbering of a function list needs no sign-off.** The function lists name parts by their place in the model file. Where a fix adds parts (a part read whole is now split in two), the numbers after it shift. Renumbering changes no fact about the real set, so the worker commits it with the fix, with a check that each reference names the same part (number, colour and place) before and after. Erik still signs off any change to what a function is or which part works it.
8. **Centres on axes is closed, the new way to push is dropped, and the push's step goes to its full check with its time limit waived.** Centres, last attempt (the axis of the joint the gear sits on, within 1 LDU): no gear is moved onto a wrong axle any more, and the full check had 1 better and 4 worse, all in the 8850, whose rolling ends 1 LDU out of place for a change of 1e-14 LDU in its gears' centres. A change that helps 1 and is undone by rounding in another set is not worth more work, so the option stays off and work on it stops. The way to push with what the control hangs on held still changed no figure in the quick check, so it is dropped. The push's step chosen by the tiers (`leastPush`) is built, off by default, every figure the same when off. On, the quick check has 4 better and 0 worse. One step takes 2.7 times as long on the 8272 (3.6 to 9.9 ms), over the limit of 1.5, but the limit was there to keep the viewer quick, and a whole push is quicker: finding the holds at the grab falls from 41 to 1 ms there, and from 4.6 seconds to 65 ms on the 42056. So the limit is waived, and the full check decides: 0 worse, but for a function the old push scored better only by pulling the loops apart (the 42080's function 6, 61 LDU), each such case shown.9. **Friction pins are freed on demand, not for the whole model.** The full check with the rule of decision 6 off (every friction pin free, on 9edd2dc) had 551 functions working where 522 did, 53 better and 50 worse. Of the 50, 33 are only parts not back and 3 are fixes that run did not have; 16 are worse by result, 6 of them from works to no (42039 fn 1, 42062 fn 8, 42080 fn 1, 42083 fn 7, 8815 fn 1, 8832 fn 1). By result 63 are better, 43 of them to works, and 47 of the 63 are functions whose control is fixed or jams. The check took 3 hours 4 minutes where it takes about 30 minutes: the large sets are 4 to 6 times slower (42078, 42115, 42110), and the 42082 hit its limit of 60 minutes, since every friction-pin linkage becomes joints. So dropping the rule costs too much time and 16 functions, and keeping it costs 63. The rule now: a model is built as before, pins rigid. When a control, or a part the user grabs, has no motion in that build, Kinebrick looks at a second build with every pin free (made once for a model, and only then), finds the motion that moves that control there, frees the friction pins that turn in that motion, and builds again with those free. The pins stay free until Reset. A function whose control moves today is not touched, so none of the 16 can get worse by it. It covers the control that is fixed at the start; the control that turns a little and then jams is measured after, as a second step. The phase 3 worker builds it behind a switch, off by default with every fingerprint the same, first in the check and then in the viewer through the same function. Its gate with the switch on: the quick check and then a full check with 0 worse by result, every function worse by parts not back shown, and a full check no more than 1.3 times as long as today's.
10. **The push's step goes on by default once its fault in the 42096 is mended.** The full check with `leastPush` on (2a35b48) had 528 functions working where 522 did, 20 better and 4 worse, and of the 88 functions with a pushed control the ways that parts do not come back fell from 88 to 45 (works 16 to 22, partly 24 to 14, no 48 to 52). The rule of decision 8 was 0 worse but for a function the old push scored by pulling the loops apart. None of the 4 is that: the solver owner measured the old push's gaps and they are 0 (the 42080's 61 LDU is how far a part is left after there and back, not a gap). The rule is widened, because its purpose was to lose no real function: a result that leaves parts 18 to 61 LDU out of place after there and back is not one. So three are accepted as rightly refused: the 42062's function 9 and the 42080's function 6, locked to second order, and the 42099's function 6, where 21 joints stray. The fourth is a fault of the new step: in the 42096's function 4 (works to no) closing by the tiers leaves a gap of 253 LDU at any step size. The solver owner mends that, one attempt, then runs the full check again against this run's results with 0 worse, turns `leastPush` on by default and commits the results. Later the same day the solver owner found that the 42096 has no fault in closing: lifting the front arm 1 LDU drives the steering rack 249 LDU, so a whole step opens the loops 253 LDU and is rightly left to be taken in pieces, each piece closes to 1e-12, and after 0.1 LDU the steering pinion has run off its rack, which is the model's own limit. So this fourth function is accepted as refused too, nothing was mended, and the full check alone decides. Why a lift of the arm needs so large a turn of the steering (the tie rods must sit almost in line with something as built) is not known and is left with the set.
11. **Three of the solver's locked functions get a fix; one goes to inference later.** The solver owner traced the functions that decision 4 left to it. The 42049's function 2: a knob that turns a worm through universal joints or chains was held as if on the far side of the worm; it now counts as on the worm's side (9 models can change; built, with its own check of those sets). The 42122's functions 2 and 3: the two ends of a universal joint were each taken where the part's centre falls on its own shaft, 0.044 LDU apart, though the shafts' axes cross exactly; both ends are now taken where the axes cross, or at the middle of the shortest line between them where they miss by under 0.05 LDU (37 joints in 29 sets have their ends apart). The 42066's function 5: when no exact motion is found and play is allowed, tyres were held to no scrub at all, while the search for exact motions lets a tyre scrub when the frame stays still; the two now use the same rule. Each of the last two is behind a switch, checked alone in the quick check, then both on in one full check, with any worse function run again with each switch alone. The 8848's function 4 is inference's: its tipping racks lie on a brick, held down only by their pinions, and tilt as the body rises, but are read as slides that cannot tilt. It waits behind the friction pins, since it is one set. Also found: a gearbox in neutral turns its output when its input joint is dragged, because the least motion shares the turn between the free gear and its shaft; the solver owner mends that after these.
12. **Which pins are freed, and how the viewer does it without freezing.** The first full check of decision 9's rule had 45 functions better by result and 0 worse, but freed up to 76 pins in a function and ran the 42004 into its one-hour limit. So the choice is narrowed: of the pins that turn in the control's motion, each is held again, the one farthest from the control first, while the control can still move. That frees at most 5 pins in any function, and the 42004 takes 6 seconds. The build with every pin free took 9 to 181 seconds in the browser on the seven largest sets, 91% of it in one loop of `groupIntoBodies` that compared every turning connection with every other after each merge; merged in rounds it takes 2 to 21 seconds, every fingerprint the same, and the build as made is quicker too (the 42082 from 31 to 10 seconds). In the viewer the build with every pin free is made in a Web Worker, started after the model shows, so the page stays live; a grab of a part with no motion asks the worker which pins to free, shows a message while it waits, and then builds again on the main thread as a gear shift does. A browser that cannot start the worker leaves the part held, with no error. The viewer is wired after the second full check passes and the check's side is merged.


## First steps

1. The triage and the stop-reason probe (phase 1), on a branch of their own.
2. Slowest sets first, and results in a folder of their own.
3. The ratchet, and a full check quick enough to run on demand (done 2026-11-11).
4. The status page: its first version, the grid of sets, was published on 2026-11-10 from that day's results. Causes joined it on 2026-11-11.
