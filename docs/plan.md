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

The function check at 67370ba, on all 186 sets:

| Result | Functions |
|---|---|
| Works | 532 |
| Partly | 319 |
| Doesn't work | 196 |
| Skipped (needs force) | 119 |
| Not checked (nothing worked by hand) | 58 |

In 28 sets, every checked function works. In 13 of those, no function is skipped or unchecked either. 70 more sets are one or two checked functions short.

What we know about the 515 failures:

- 142 use a mechanism the check cannot operate: a selector, a motor, a gearbox shift, a pneumatic cylinder, a slip clutch. Some of these are failures of the check, not of Kinebrick.
- 99 part types connect but do not move as they should (`data/not-moving-yet.json`): shock absorbers, the 28 and 60 tooth turntables, constant velocity joints, clutch gears, 39 tyres and wheels that don't roll.
- About 250 part types are loose in small groups. The other 76% of loose parts are whole second models that share a file with the main model, which is a counting problem and not missing data.
- 144 questions about the function lists are open, and 148 functions are inferred from the model, not from the book. A wrong function list makes a correct model fail.
- The rest are the solver's: it chooses the wrong motion, stops early, or does not come back.

We do not know the size of each group. The check records a result, not a cause. Measuring the causes is the first job.

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
| A stop-reason probe: for one drag, each step's tier costs, held bodies, strayed joints and loop gap, as text and as JSON | `scripts/probe-drag.ts` (new) | Its output for two known drags |
| The check shifts gearboxes, clicks slides and runs motors, as the viewer does | `scripts/check-functions.ts` | The 956's gear lever and the 8880's gearbox, through the check |
| Results leave `data/sets/` for a folder of their own, all from one commit | `scripts/check-functions.ts`, `results/` (new) | The curated files no longer change when the check runs |
| Slowest sets first, by the last run's times | `scripts/check-functions.ts` | None needed |
| The full check runs every night away from the Mac, and a ratchet compares it with the night before | `.github/workflows/check.yml` (new), `scripts/ratchet.ts` (new) | The ratchet on two saved result folders |
| The scan counts each large separate group in a file as a model of its own | `scripts/scan-omr.ts` | A two-model file |
| Invariance: a model moved and turned about the upright gives the same results. Jitter: parts moved by 0.05 LDU give the same results | `tests/invariance.test.ts` (new) | Itself |
| Skip reasons from a fixed list: needs gravity, needs force, model error, check limit | `data/sets/*.json` (`skip`), `data/sets/README.md` | A test that each reason is on the list |

**Done when:** every failing function has a cause; the full check runs unattended each night; one command says what a change gained and lost.

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

## Management plan

### Who does what

| Role | Who | Does | Writes |
|---|---|---|---|
| Owner | Erik | Decides scope and order. Signs off function lists and errata. Reads the status page. Moves `main`. | Nothing he doesn't choose to |
| Orchestrator | One Claude Fable 5.2 session, medium effort | Keeps this plan, the backlog and the gate. Briefs workers and merges their branches into `preview`. Publishes the status page. | `scripts/`, `.github/`, `docs/plan.md`, `results/` |
| Solver owner | One Claude Opus 5.5 session, high effort | Phase 4, and phase 2's work in the solver core | `src/kinematics.ts`, later `src/constraints/` and `src/linalg.ts` |
| Workers | Claude Opus 5.5 agents, medium effort, one task each, each in a worktree of its own | Phase 3's lanes | Only the files their lane names |
| CI | GitHub Actions | Tests on each push. The full check and the ratchet each night. | `results/` |

These models are where we start, to keep the cost down. The gate's log shows how often each role's work is kept or reverted; if the solver owner's work is reverted often, that role is the first to move to a stronger model.

### Branches

| Branch | Owner | Rule |
|---|---|---|
| `main` | Erik | Only Erik commits and pushes. It moves when he merges `preview` into it. The site publishes from it. |
| `preview` | The orchestrator | Commits and pushes at will. Holds only work that passed the gate. The pre-release site publishes from it, and every push runs the tests. |
| Any other, named `<lane>/<task>` (`solver/gravity-tier`, `parts/turntables`) | The session or worker that made it | Made from `preview`. Its owner commits and pushes at will. The orchestrator merges it into `preview` when it passes the gate, and deletes it then, or when the task is dropped. |

Work that is retired but worth keeping gets a tag under `archive/`, not a branch.

Erik moves `main` when he chooses, after a look at the pre-release site and the log:

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

### The gate

A worker's change is kept only if all of these are true.

1. The tests and the type check pass.
2. The quick check loses nothing.
3. The night's full check loses nothing: no function goes from works to partly or no, and no more functions move by the wrong amount or fail to come back.
4. The change does not touch `curated` data, unless its lane drafts curated data for Erik.
5. A fix in the solver or the inference comes with a fixture that fails without it.
6. No new tolerance or weight comes without a test that shows what it is for.

A branch is merged into `preview` only when all are true. If the night's check then fails on `preview`, the orchestrator reverts the merge and logs why. A worker that fails the gate twice on one task stops, and the task goes back to the backlog with its notes.

### What Erik sees

- **A status page**, refreshed after each night's check (`npm run status`). First, a grid of boxes, one for each OMR set, each sized by the set's number of pieces and coloured by the share of its checked functions that work: green for all, yellow for 75% to 99%, orange for 50% to 74%, red for 1% to 49%, black for none. Then the count of failing functions by cause over time, each lane's queue, and what waits for him.
- **A sign-off queue**: function-list answers and errata, in batches, each with the book page that supports it.
- **A log**: one line for each change kept or reverted, with the score before and after.

### Cost

- Workers run only in lanes with a gate a script can check.
- A fleet starts only when Erik says so, with a stated number of workers.
- The nightly check runs on GitHub's machines or on the Windows PC (which ran all 186 sets, 15 at a time, for the survey), not on a Claude session.
- The models in [Who does what](#who-does-what) are the cheapest that we expect to do each job.

## Decisions, made 2026-11-10

1. **Who commits.** `main` is Erik's alone. The orchestrator commits and pushes to `preview` at will, and each other branch's owner to that branch (see [Branches](#branches)).
2. **Branches.** `main` and `preview`. `solver` is removed.
3. **Milestone A first, with a touch of physics early.** Gravity and springs come in at the start of phase 4, as costs in the tiers. Forces proper wait for phase 5.
4. **Old branches.** The retired survey and the least-motion prototype are kept as the tags `archive/omr-survey` and `archive/least-motion-prototype`. Neither needs a branch.

## First steps

1. The triage and the stop-reason probe (phase 1), on a branch of their own.
2. Slowest sets first, and results in a folder of their own.
3. The nightly check and the ratchet.
4. The status page: its first version, the grid of sets, was published on 2026-11-10 from that day's results. Causes join it from the first night that has them.
