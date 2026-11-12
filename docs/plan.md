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

The function check on all 186 sets, run in full on this Mac on 2026-11-11 (at e31ee32; 5 hours, of which the 8110 alone took all 5):

| Result | Functions |
|---|---|
| Works | 533 |
| Partly | 318 |
| Doesn't work | 196 |
| Skipped (needs force) | 119 |
| Not checked (nothing worked by hand) | 58 |

In 28 sets, every checked function works. In 13 of those, no function is skipped or unchecked either. 71 more sets are one or two checked functions short.

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
| Which of its holes a free pin is fixed in | The inference: `fixPins` in `src/mechanism.ts` picks the hole the pin goes furthest into, and two equal overlaps of 18 LDU become 18.00 and 17.96 | 406 parts change body, in 18 sets | None. A trial that counted overlaps within 0.5 LDU as equal left all 24 as they were, and changed no result of the models as built |
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
| First: gravity as a tier. A part's centre of mass is kept from rising or falling | The balanced-part rule, the two-tyre tipping tier |
| Second: springs as a soft cost. A shock absorber may change length, at a cost | Rigid shocks, and suspension that moves only by play |
| Play as weighted rows: every loop-closing connection may give a little | `playMotion`, and the rules that line axles and balls up |
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
| Owner | Erik | Decides scope and order. Signs off function lists and errata. Reads the status page. Moves `main`. | Nothing he doesn't choose to |
| Orchestrator | One Claude Fable 5.2 session, medium effort | Keeps this plan, the backlog and the gate. Briefs workers and merges their branches into `preview`. Publishes the status page. | `scripts/`, `.github/`, `docs/plan.md`, `results/` |
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
3. The full check loses nothing (`npm run functions`, then `npm run ratchet -- preview`): no function goes from works to partly or no, and no more functions move by the wrong amount or fail to come back. The worker runs it on its own branch before it hands the work in.
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

## First steps

1. The triage and the stop-reason probe (phase 1), on a branch of their own.
2. Slowest sets first, and results in a folder of their own.
3. The ratchet, and a full check quick enough to run on demand (done 2026-11-11).
4. The status page: its first version, the grid of sets, was published on 2026-11-10 from that day's results. Causes joined it on 2026-11-11.
