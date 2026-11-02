# Kinebrick: the plan and where it stands

A snapshot on 2026-11-02, at solver 8c10691, to assess the plan from: its main steps, what's done, what's under way, and what's open. The plan itself lives in three places: the project brief (CLAUDE.md), the milestones in the README, and the solver phase ([solver-phase.md](solver-phase.md)).

## In one paragraph

Version 1.0, the kinematics, is done but for M7 (real sets, oldest first). Since release 0.850 (2026-10-29) the work has been on the solver itself, on the `solver` branch, 79 commits ahead of `main`: a check that says how much, least motion (adopted), and one problem for each step (its first round adopted). On the function check over all 186 official sets, 532 of 1,224 functions work, 319 partly and 196 don't; 13 sets work in full. MuJoCo (as a second opinion, then as 2.0's forces) and connections from data haven't started.

## The project brief's plan

| # | Step | Status |
|---|---|---|
| 1 | A web LDraw viewer and the full parts library | Done: three.js's LDraw loader, the LDraw library, models packed for the web (Kinebrick Play) |
| 2 | Connections from the LDCad shadow library → rigid bodies and joints | Done, with corrections in data/connections.json; about 90 sets still have parts it doesn't connect or mesh (solver phase line 5) |
| 3 | A gear-graph kinematic solver; drag an input to spin a gearbox | Done (M2) |
| 4 | Differentials, rack and pinion, worms, clutches, gearbox selectors | Done (M3, M5, M6.2); clutches that slip wait for forces |
| 5 | Linkages (a position solve) | Done (M6.1, M6.3): loops closed after each step; being folded into one problem per step (solver phase line 3) |
| 6 | Dynamics through MuJoCo (WASM): springs, shocks, forces | Not started; version 2.0. Shocks stay rigid until then |
| 7 | Walk the parts catalogue, tagging mechanical roles | Partly: roles in data/roles.json grow as sets need them; no systematic walk |

## The milestones (README)

M0 to M9 are done but M7. M7, real sets from the LDraw Official Model Repository taken oldest first, went set by set to 1980 (the next sets start in 1981). The function check now tries every set's functions at once, so M7's oldest-first walk has been overtaken by the check rather than finished.

## The solver phase, line by line

Why: set-by-set fixes each made one mechanism work but hardly moved the totals, and about 30 sets are named in the solver's comments, most in how a drag chooses its holds. The aim is one general solver, a fast check that says how much, official sets only.

### 1. Checks that say how much: mostly done

- Done: gear ratios from tooth counts, differentials (`scripts/gear-rates.ts`), pistons from slider-crank geometry (`scripts/slider-cranks.ts`), there and back, a quick set of about 20 sets, `npm run bench`.
- Done, reported only: steering's stops (`--lock`): 106 of the 115 measured ways of working steering stop between 15° and 50° ([steering-stops.md](steering-stops.md)).
- 164 of the 1,224 functions have an expected amount.
- Left: a pass or fail on steering's stops; speed (the 8110 Unimog takes about three hours; the full check runs overnight).

### 2. Least motion: done

A drag's motion chosen by tiers of least squares instead of holds ([least-motion.md](least-motion.md)). Adopted at 508 functions working against holds' 506; holds remain for pushes and behind `?holds`.

### 3. One problem for each step: first round adopted, the rest on hold

The plan ([one-problem.md](one-problem.md)): choosing the motion, taking the step and closing the loops become one problem, solved by Newton's method, with the tiers as the cost.

- Done: the first round, closing a step's loops by the tiers. Adopted on autopilot (2026-11-01) at 532 functions working against 531; `?passes` and `KINEBRICK_ONE=0` turn it off, and it can be reverted.
- Done since: a correction keeps still first what the step left still (a838eff): the 42021 Snowmobile's steering comes back 0.08 LDU off (was 2.5).
- On hold, at the user's word: the Newton step proper (stage 2). Then tyres and play as rows (stage 4), which would retire `settle` and `playMotion`.
- Still to retire: `CLOSE_STILL`'s other uses, `mountsHeld`, `parked`, most of the dead-point machinery.

### 4. MuJoCo as a second opinion: not started

The mechanism written out as a MuJoCo model, dragged with friction, compared with Kinebrick. [LegoTechnicSimulation](https://github.com/yoff/LegoTechnicSimulation) is to be read first.

### 5. Connections from data, not rules: not started

About 90 sets have parts Kinebrick doesn't connect or mesh. First, connection data for every part in an official set; later, connections inferred from parts' shapes.

## How progress is measured

| When | Works | Partly | No | Sets in full |
|---|---|---|---|---|
| Holds, before least motion | 506 | | | |
| Least motion adopted | 508 | | | |
| Least motion, last full check | 531 | 318 | 198 | 13 |
| One problem, full check (1a29958) | 534 | 319 | 194 | |
| Now (8c10691) | 532 | 319 | 196 | 13 |

The 2 lost since 1a29958 are the 42113 Osprey's flaps (function 8) and the 42125 Ferrari 488's front suspension (function 4), works to no at a838eff, outside the 46 iteration sets it was checked on; being looked into. The README's table still shows least motion's 531, 318 and 198.

The other measure, the solver getting smaller (its lines, its rules and tiers, the sets its code names, about 30 at 0.850), hasn't been counted since.

## Branches

- `main`: c97d0cf. The user fast-forwards it from `solver` (`git merge --ff-only solver`) and pushes it.
- `solver`: all the solver phase's work, and since 8c10691 also `solver-train`'s.
- `solver-train`, merged into `solver` at 8c10691: the 10001 Metroliner runs round its track; sticker shapes no longer z-fight; subparts placed directly (the OMR's flexible axles) are drawn rather than loaded as parts, which renumbered 8 sets' parts (their curated references renumbered to match, every result as before).

## Questions for the assessment

- Is the Newton step still the right next step for line 3, or do MuJoCo (line 4) or connections (line 5) now move the totals more? Grouped by cause, a wrong choice of motion affects about 130 sets and missing connections about 90 (README).
- Should `main` be brought up to `solver` now: least motion and the first round of one problem are both adopted.
- Is the function check fast enough to iterate on: a full check overnight, 46 iteration sets in about half an hour, and the iteration sets didn't cover the two latest losses.
- M7's oldest-first walk: carry on from 1981, or let the function check over all 186 sets replace it.
