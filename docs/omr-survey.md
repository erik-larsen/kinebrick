# Surveying the controls of the OMR's Technic sets

How to try the controls of all 183 Technic sets from the LDraw Official Model Repository (OMR) with `npm run joints`, on a spare machine. Written so a fresh Claude Code session (or a person) can follow it from a fresh clone.

## What it does

`npm run joints` (`scripts/probe-joints.ts`; see its opening comment, and "Testing" in [ARCHITECTURE.md](../ARCHITECTURE.md)) tries the controls of a model. For each part a drag turns like a knob, it turns the joint a drag would turn, both ways, holding what a drag would hold, and writes down how far the part turned and which other parts it moved, and how far. For KineBrick's own models it tries every knob, and the results are kept in `tests/joints/`, as a baseline later runs are checked against.

For the OMR's sets, downloaded into `omr/` (not committed), it tries only the controls a person would use: wheels with tyres, steering wheels, and gears of 20 teeth or more that can be reached from outside the model. Not the pins, axles and small gears inside, nor each link of a track, which make up most of the knobs (in seven of the biggest sets, 109 controls out of 3,185 knobs). The results go in `omr/controls/` (and `omr/controls-0.25/` for the quick survey): which controls in other people's models work, and which don't yet. `--all` tries every knob instead, with results in `omr/joints/` (and `omr/joints-0.25/`); that takes days.

The smallest sets go first. Each set is probed in batches of 20 controls, and each batch is kept as it finishes, so a big set prints how far it has got (a line like "<set>: 20 of 60 knobs" after each batch), and a run that stops can carry on within a set.

## Steps

1. **Get the code and install it.** Node 22 or newer.

   ```bash
   git clone https://github.com/erik-larsen/kinebrick.git
   cd kinebrick
   npm ci
   ```

   With a clone already there, `git pull` instead (and `npm ci` again if `package-lock.json` changed). No LDraw parts library is needed: everything the probe reads is in the repository.

2. **Check it works**, on KineBrick's own models (a few minutes):

   ```bash
   npm run joints
   ```

   Every model should say "none worse", and it should exit 0. If any says worse, stop and report it: the probe should give the same results on any machine.

3. **Download the OMR's sets**: 183 files, about 140 MB, each the version pinned in `models/technic-sets.csv`.

   ```bash
   npm run omr
   ```

4. **The quick survey**: each control turned a quarter radian each way, enough to tell which are stuck. Use most of the cores (here 8; `sysctl -n hw.ncpu` says how many there are, and the default is half), and keep the Mac awake:

   ```bash
   caffeinate -i npm run joints -- --omr --reach 0.25 --resume --jobs 8
   npm run joints -- --omr --reach 0.25 --report > omr/report-0.25.txt
   ```

5. **The full run**: each control turned 1.5 radians each way, as for KineBrick's own models. If it stops, from a restart or a crash, run the same command again: `--resume` carries on where it left off, within a set too.

   ```bash
   caffeinate -i npm run joints -- --omr --resume --jobs 8
   npm run joints -- --omr --report > omr/report-full.txt
   ```

   Each run prints a line per set as it finishes, and for a big set a line per batch. A set that fails prints an error, and the run carries on; note which, and why.

6. **Bring the results back**, packed for Erik to copy into `omr/` on the main Mac:

   ```bash
   tar -czf omr-controls-results.tgz -C omr controls controls-0.25 report-0.25.txt report-full.txt
   ```

   Then write Erik a short summary: how many sets failed (and why), and the sets and kinds of control that most often stop or can't move.

7. **Every knob, if there's time** (optional, days): the same two runs with `--all` added, results in `omr/joints/` and `omr/joints-0.25/`. Erik may have an archive of these already worked out elsewhere (`omr-joints-so-far.tgz`: some of the biggest sets); unpacked into `omr/` (`tar -xzf path/to/omr-joints-so-far.tgz -C omr`), the runs skip those sets.

## Reading the results

`--report` lists each set's controls that **stop** after a little (under 0.2 radians either way), turn only **one way**, or **can't move at all**, each with what kind of control it is (a wheel, a steering wheel, a 40 tooth gear). A wheel or steering wheel that can't move is worth a look; so is a set with no controls at all, which usually means KineBrick doesn't know its tyres yet. One-way controls are often at the end of their travel (a bucket at its lowest). Controls that stop after a little are the ones to look at first: that's how the 8880 Super Car's rear steering knob was found, held back by a false dead point.

The probe tries the mechanism alone, without the collision checks the viewer adds, so a control can turn further here than in the viewer.

## Rules

- KineBrick's rules are in [CLAUDE.md](../CLAUDE.md): don't commit or push without asking Erik first. `omr/` is ignored by git: the results go back as the archive in step 6, or wherever Erik says (such as an `omr-survey` branch), never onto `main`.
- Use the `erik-larsen` GitHub account for anything on GitHub.
- No hard-wrapped lines in `.md` files: one line per paragraph or list item.
