# Surveying every control of the OMR's Technic sets

How to try every control of all 183 Technic sets from the LDraw Official Model Repository (OMR) with `npm run joints`, on a spare machine, Mac or Windows: it takes many hours, the full run days. Written so a fresh Claude Code session (or a person) can follow it from a fresh clone.

## What it does

`npm run joints` (`scripts/probe-joints.ts`; see its opening comment, and "Testing" in [ARCHITECTURE.md](../ARCHITECTURE.md)) tries every control of a model. For each part a drag turns like a knob (a gear, a wheel, a crank, an axle), it turns the joint a drag would turn, both ways, holding what a drag would hold, and writes down how far the part turned and which other parts it moved, and how far. For KineBrick's own models the results are kept in `tests/joints/`, as a baseline later runs are checked against. For the OMR's sets, downloaded into `omr/` (not committed), they go in `omr/joints/` (and `omr/joints-0.25/` for the quick survey): which controls in other people's models work, and which don't yet.

## Steps

1. **Get the code and install it.** Node 22 or newer, and Git. On Windows, run every command here in Git Bash (it comes with Git for Windows, and Claude Code on Windows uses it too), not PowerShell, which drops the `--` that passes options on to `npm run joints`. Clone with line endings left as they are, so every file is the same as on a Mac:

   ```bash
   git clone -c core.autocrlf=false https://github.com/erik-larsen/kinebrick.git
   cd kinebrick
   npm ci
   ```

   No LDraw parts library is needed: everything the probe reads is in the repository.

2. **Check it works**, on KineBrick's own models (a minute or two on 10 cores):

   ```bash
   npm run joints
   ```

   Every model should say "none worse", and it should exit 0. If any says worse, stop and report it: the probe should give the same results on any machine.

3. **Download the OMR's sets**: 183 files, about 140 MB, each the version pinned in `models/technic-sets.csv`.

   ```bash
   npm run omr
   ```

4. **Results from an earlier run, if there are any.** Erik may have an archive of results already worked out elsewhere (`omr-joints-so-far.tgz`: some of the biggest sets, at full reach). Unpack it into `omr/` and the runs below skip those sets:

   ```bash
   tar -xzf path/to/omr-joints-so-far.tgz -C omr
   ```

5. **The quick survey**: each knob turned a quarter radian each way, enough to tell which are stuck. A machine may do only this, or only the full run (step 6): the two keep their results apart.

   How many jobs at once (`--jobs`; the default is half the processor threads): most of the threads (`sysctl -n hw.ncpu` on a Mac, `nproc` in Git Bash says how many), but each job takes up to about 2 GB of memory on the biggest sets, so no more jobs than half the memory in GB. Here 8.

   Keep the machine awake: on a Mac, `caffeinate -i` in front of the command, as below; on Windows, leave `caffeinate -i` out and set the PC never to sleep while plugged in (Settings, System, Power, Screen and sleep) for as long as it runs.

   ```bash
   caffeinate -i npm run joints -- --omr --reach 0.25 --resume --jobs 8
   npm run joints -- --omr --reach 0.25 --report > omr/report-0.25.txt
   ```

6. **The full run**: each knob turned 1.5 radians each way, as for KineBrick's own models. Expect it to take days: the biggest sets have hundreds of knobs, and every step of a turn solves a mechanism of hundreds of parts. The quick survey, a sixth of the turn, takes most of a day on a 12-core M6 Mac mini, its Rough Terrain Crane alone over two hours. If it stops, from a restart or a crash, run the same command again: `--resume` carries on where it left off.

   ```bash
   caffeinate -i npm run joints -- --omr --resume --jobs 8
   npm run joints -- --omr --report > omr/report-full.txt
   ```

   Each run prints a line per set as it finishes. A set that fails prints an error, and the run carries on; note which, and why.

7. **Bring the results back**, packed for Erik to copy into `omr/` on the main Mac (leaving out what this machine didn't run):

   ```bash
   tar -czf omr-joints-results.tgz -C omr joints joints-0.25 report-0.25.txt report-full.txt
   ```

   Then write Erik a short summary: how many sets failed (and why), and the sets and kinds of part that most often stop or can't move.

## Reading the results

`--report` lists each set's knobs that **stop** after a little (under 0.2 radians either way), turn only **one way**, or **can't move at all**. Most that can't move at all are structure hinged on one pin but held by another, or parts not meant to turn (a worm's gear, a differential's pinion with the car on its wheels). One-way knobs are often at the end of their travel (a bucket at its lowest). Knobs that stop after a little are the ones to look at: that's how the 8880 Super Car's rear steering knob was found, held back by a false dead point.

The probe tries the mechanism alone, without the collision checks the viewer adds, so a knob can turn further here than in the viewer.

## Rules

- KineBrick's rules are in [CLAUDE.md](../CLAUDE.md): don't commit or push without asking Erik first. `omr/` is ignored by git; the results aren't meant to be committed.
- Use the `erik-larsen` GitHub account for anything on GitHub.
- No hard-wrapped lines in `.md` files: one line per paragraph or list item.
