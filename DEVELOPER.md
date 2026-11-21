# Developing Kinebrick

What Kinebrick sets out to do, how to run and build it, and how far it has got. What it does, and how to use it, is in the [README](README.md); how it works inside is in [ARCHITECTURE.md](ARCHITECTURE.md).

## Scope

- **It is** a mechanism inferrer. Each LEGO part gets a description of what it can do (an axle turns in a round hole, a tyre rolls on the ground). Kinebrick reads where the parts sit in the model, decides how they connect, and solves how they move together.
- **It is** iterative. Part types are added one at a time, starting with the ones that move. A brick that only holds things together needs no special treatment: it moves with whatever it's attached to.
- **It isn't** a new 3D viewer. Rendering comes from [three.js](https://threejs.org) and its `LDrawLoader`.
- **It isn't** a general physics engine. Movement comes from the mechanism's geometry (kinematics). Forces, springs and mass come in version 2.0, through an existing physics engine rather than our own.

## Getting started

To only look at Kinebrick, nothing needs installing: each of its three branches is published as a site (the links are in the table under [The three branches](#the-three-branches)). The sites open the models packed into this repository. A local build is for changing the code, and for opening any real set's file from the [LDraw Official Model Repository](https://library.ldraw.org/omr) (OMR), which this repository doesn't hold.

### What you need

[git](https://git-scm.com) and [Node.js](https://nodejs.org) 22 or newer (which comes with `npm`), and a terminal to type the commands into.

**macOS.** Use the Terminal app. git comes with Apple's command line tools, and Node.js with [Homebrew](https://brew.sh) (or with the installer from [nodejs.org](https://nodejs.org/en/download)):

```bash
xcode-select --install
brew install node
```

**Windows.** Install both from PowerShell with `winget`, which Windows 10 and 11 have (or with the installers from [git-scm.com](https://git-scm.com/download/win) and [nodejs.org](https://nodejs.org/en/download)):

```powershell
winget install Git.Git
winget install OpenJS.NodeJS.LTS
```

Then type the commands below into **Git Bash**, which comes with git. They are written for a Unix shell, and Git Bash runs them as they stand. PowerShell runs them too, but it can swallow the lone `--` in the `npm` commands, which then has to be written `'--'`.

**Linux.** git comes from your distribution's packages. Its Node.js is often older than 22, so take Node.js from [nvm](https://github.com/nvm-sh/nvm#installing-and-updating) (or as [nodejs.org](https://nodejs.org/en/download) says for your distribution). On Debian or Ubuntu, with nvm installed:

```bash
sudo apt install git
nvm install 22
```

To check what you have, on any of the three:

```bash
git --version
node --version
```

### The three branches

| Branch | What it is | Published at | Port below |
|---|---|---|---|
| `main` | The released viewer. | [erik-larsen.github.io/kinebrick/](https://erik-larsen.github.io/kinebrick/) | 5173 |
| `preview` | Work on the Technic sets that has not reached `main` yet. | [/preview/](https://erik-larsen.github.io/kinebrick/preview/) | 5174 |
| `preview-train` | Work on the train sets, on top of `preview`. | [/preview-train/](https://erik-larsen.github.io/kinebrick/preview-train/) | 5183 |

Each branch gets a folder of its own, side by side, so all three can run at once; `preview` and `preview-train` are added to the clone made for `main`, so do `main`'s first step even if you only want one of the others. Run every command from the folder that holds those folders, and leave each viewer running in a terminal window of its own.

### main

```bash
git clone https://github.com/erik-larsen/kinebrick.git
npm --prefix kinebrick install
npm --prefix kinebrick run dev -- --port 5173 --strictPort
```

Then open [http://localhost:5173/](http://localhost:5173/). Pick a test model from the menu at the top left, or [open your own](README.md#your-own-model).

### preview

```bash
git -C kinebrick worktree add ../kinebrick-preview preview
npm --prefix kinebrick-preview install
npm --prefix kinebrick-preview run dev -- --port 5174 --strictPort
```

Then open [http://localhost:5174/](http://localhost:5174/).

### preview-train

```bash
git -C kinebrick worktree add ../kinebrick-train preview-train
npm --prefix kinebrick-train install
npm --prefix kinebrick-train run dev -- --port 5183 --strictPort
```

Then open [http://localhost:5183/](http://localhost:5183/).

With `--strictPort` a viewer stops with an error if its port is taken, rather than starting on another one. Any free port will do.

### The real sets

This repository holds only the models in the viewer's menu. The OMR's own files of real LEGO sets are downloaded, once for each folder, into its `omr/` folder:

```bash
npm --prefix kinebrick run omr
npm --prefix kinebrick-preview run omr
npm --prefix kinebrick-train run omr -- --trains
```

The first two download every Technic set the OMR has; the third downloads the train sets into `omr/trains/`. A running viewer then opens a set by its file's name, with `+` for each space:

- `http://localhost:5173/?file=omr/9397-1+Logging+Truck.mpd` (the same on port 5174)
- `http://localhost:5183/?file=omr/trains/10277-1+Crocodile+Locomotive.mpd`

### Newer work

```bash
git -C kinebrick pull
git -C kinebrick-preview pull
git -C kinebrick-train pull
```

A running viewer reloads by itself when its files change. Run `npm install` in a folder again if its `package.json` changed.

### Development

The viewer doesn't need the LDraw parts library: each test model is packed, with every part it uses, into one file in `packed/`. A model you open yourself is packed the same way in your browser, its parts fetched from [Kinebrick's copy of the library](https://github.com/erik-larsen/ldraw). The libraries are only needed to rebuild the data after changing a test model (see below).

The project uses plain TypeScript, and [Vite](https://vite.dev) as its development server: Vite serves the code to the browser, converts TypeScript to JavaScript as it goes, and reloads the page whenever a file is saved.

The commands:

- `npm test` runs the tests.
- `npm run omr` downloads every Technic set in `models/technic-sets.csv` that the LDraw Official Model Repository has into `omr/` (not committed): the exact version its `omr_file` column pins, so every scan reads the same files. A set new to the list gets pinned to the repository's current version; to take a newer one, empty its `omr_file` and run it again. Then `npm run scan` reads them all as the viewer reads a model you open yourself and writes `omr/coverage.md`: how much of each set Kinebrick connects, and the parts most worth teaching it next. The scan needs the LDraw parts library in `ldraw/`.
- `npm run joints` tries every control of every model: it turns each part that turns like a knob both ways, as a drag does, and compares how far it turns and what it moves with what it did last time (kept in `tests/joints/`), failing if any got worse. It takes a few minutes, so it isn't part of `npm test`; run it after changing how mechanisms are worked out or moved. `npm run joints -- --update` writes down what it finds as the new normal, and `npm run joints -- --report` lists the knobs that stop after a little or turn only one way. `npm run joints -- --omr` runs it over the OMR's sets in `omr/` (from `npm run omr`), trying only the controls a person would use (wheels, steering wheels, and big gears within reach), and `--omr --all` tries every knob, which takes days; `--resume` carries on where a run stopped. The options are listed at the top of `scripts/probe-joints.ts`.
- `npm run functions` checks each real set's functions, what [its controls are supposed to do](data/sets/README.md), against what Kinebrick does with its model, and writes what it found into the set's file in `data/sets/` (see [The function check](ARCHITECTURE.md#the-function-check)). `npm run instructions` downloads each set's building instructions into `omr/instructions/` (not committed) and writes down which file is which book.
- `npm run invariance` checks whether the function check's results stay the same when a model is moved, turned or has its parts nudged a hair (see [Invariance and jitter](ARCHITECTURE.md#the-function-check)). `npm run nudge` says what such a nudge changes in the mechanism worked out. `npm run digest` writes a fingerprint of the mechanism worked out for every set, to compare before and after a change that must not alter any (`-- --write before.txt`, then `-- --compare before.txt`).
- `npm run functions -- --causes` works out afresh why each function that doesn't work doesn't, from a [fixed list of causes](ARCHITECTURE.md#causes), and `npm run probe -- 8880 2` works one function's control piece by piece and says what moved and what stopped it.
- `npm run status` writes the status page, `dist/status.html`: every set as a box, sized by its number of pieces and coloured by the share of its checked functions that work, from each set's results in `data/sets/`.
- `npm run mechanisms` writes the [mechanism catalog](docs/mechanisms/README.md) into `docs/mechanisms/` from the kinds in `data/mechanisms.json` and the `mechanisms` each set's functions list in `data/sets/`. Run it after tagging a set's functions; `npm run functions` runs it itself, as the catalog quotes each function's result, and a test fails if the catalog is out of date.
- `npm run build` builds the site into `dist/`. Every push to `main` runs the tests, then builds and publishes it to GitHub Pages (see `.github/workflows/pages.yml`). If a test fails, the live site stays as it was. A preview of work that has not reached `main` goes up beside it: the `preview` branch at [erik-larsen.github.io/kinebrick/preview/](https://erik-larsen.github.io/kinebrick/preview/), `preview-train` at [/preview-train/](https://erik-larsen.github.io/kinebrick/preview-train/), and so on for any branch named `preview` or `preview-<something>`. Every push to `main` or to one of those branches publishes them all afresh. A preview's tests don't hold up the site: each push to a preview branch runs them on their own instead (see `.github/workflows/test.yml`), with a type check, and a failure shows as a red mark on the commit. A preview's heading says which branch, commit and date it was built from.
- `npm run data` rebuilds the [connection table](ARCHITECTURE.md#the-connection-table) (and the one for the whole LDraw library, for models you open yourself) and the packed models, after adding or changing a test model (an `.ldr`, or an `.mpd` with submodels, in `models/`). First it brings in any real LEGO set newly downloaded from the [LDraw Official Model Repository](https://library.ldraw.org/omr) into `models/`: `956 - Auto Chassis.mpd` becomes `956-Auto Chassis.mpd`, replacing an older copy, and so do the names of the files inside it; and it gives every set Kinebrick's own lines for it from `data/sets/` (see [Settings in a model file](README.md#settings-in-a-model-file)). It needs both libraries in the project folder (neither is committed):
  - the LDraw parts library: download [complete.zip](https://library.ldraw.org/library/updates/complete.zip) and unzip it, so you have `ldraw/parts`, `ldraw/p` and `ldraw/LDConfig.ldr`;
  - the LDCad shadow library: `git clone --depth 1 https://github.com/RolandMelkert/LDCadShadowLibrary.git ldcad-shadow`.
- `npm run thumbs` makes the pictures on the [Models](README.md#models) cards, `media/thumbs/<model>.webp`, for every model in `models/` (or only those named: `npm run thumbs -- "956-Auto Chassis"`). It opens each one in Google Chrome, out of sight, and crops the view as the viewer first shows it to the model. Set `CHROME` to the program's path if Chrome isn't in `/Applications`, or to use Chromium.

## Status

Every [milestone](#milestones) of version 1.0, the kinematics, is done but M7.

**Under way: [the solver phase](docs/solver-phase.md).** Since release 0.850, rather than fixing sets one at a time, the work is on the solver itself: one general way to choose how a mechanism moves in place of special cases, and a quicker check that says how far each part should move. Every set under [Models](README.md#models) works in full, except the 8448 Super Street Sensation, whose V8 engine works on its own. The plan to get every set's every function working is in [docs/plan.md](docs/plan.md).

**[Function check](ARCHITECTURE.md#the-function-check) on all 186 sets.** Each set's functions, from its instruction book, tried on its model.

| Result | Functions | Share |
|---|---|---|
| Works | 701 | 57% |
| Partly | 239 | 19% |
| Doesn't work | 107 | 9% |
| Skipped or not checked | 179 | 15% |

Of the functions checked, 67% work in full. Only 25 of the 186 sets have every function working.

**Major things left:**

1. **Checks that say how much.** Gear ratios from tooth counts, rules for each kind of mechanism, and a quick set of about 20 sets to run on every change.
2. **A general solver.** Each step solved as one problem, with [MuJoCo](https://mujoco.org) as a second opinion to check it against.
3. **Connections for every part in the official sets.** Grouped by cause, a drag choosing the wrong way for a mechanism to move affects about 130 sets, and parts Kinebrick doesn't connect or mesh yet about 90.
4. **Version 2.0, forces through MuJoCo.** Springs and shocks, clutches that slip under load, and momentum.
5. **[Later](#later):** people's own models and BrickLink Studio's parts, other LEGO lines (Creator, trains), marching ants on loose parts, and suggested fixes for loose parts.

**Done:**

- Rolling on tyres, gear trains, bevel gears and differentials (M1–M3)
- Steering: a pivoting axle, rack and pinion, and Ackermann steering, the inside wheel turning further (M4, M6.2, M6.3)
- Collisions: parts can't pass through each other (M4.5)
- [Least motion](docs/least-motion.md): a turned part moves the rest of the model as little as it can, judged in tiers of least squares, rather than by a list of what to hold still
- Worms, clutches and gearboxes (M5)
- Closed loops of parts, such as an engine's crank, connecting rod and piston, that stay together however long they run (M6.1)
- Chains and tracks, on which the bulldozer runs (M8)
- Strings and rubber bands: the crane's winch raises and lowers its hook (M9)
- Parts resting on others, kept on whatever is highest under them, as gravity would: an engine's push rods on its camshaft's pins, and its valves' rockers on the rods
- [Your own models](README.md#your-own-model): open any LDraw file; Kinebrick lists what it can't connect or move yet

The models' files are in [`models/`](models/).

## Milestones

Each milestone ends with a model that moves correctly and a test that checks it.

| # | Milestone | Done when |
|---|---|---|
| M0 | Viewer and connection debug view | The test car loads. Each body is drawn in its own colour and each joint shows its axis. Hovering a part highlights it, tints its body, and labels it with its number, name, role and body. |
| M1 | Rolling car | Pressing a frame part of the test car shows an arrow along the car's length. Dragging either 1x4 brick rolls the car in the direction of the drag, and all four wheels turn by the right amount (distance ÷ tyre radius), shown in the readout. Straight line only. |
| M2 | Spur gears | Gear trains on parallel axles turn at the right ratios. Pushing the car can drive a gear train. Dragging any spinning part (a gear, a crank, a tyre) turns it along an arc about its axle, and the rest of the mechanism follows. |
| M3 | Bevel gears and differential | Right-angle drives work. A differential lets the two wheels on one axle turn at different speeds. |
| M4 | Steering | The front axle pivots in the middle, like a wagon's, turned by a gear on a steering column. Pushing the steered car makes it follow a curve, each wheel turning at its own speed; the rear wheels are on a differential. The same car with a solid rear axle rolls round bends too, its rear tyres skidding. |
| M4.5 | Collisions | Parts stop when they'd run into each other: the steering car's front wheels stop at the chassis, about 20 degrees either way. No part of any test model passes through another. |
| M5 | Worm gears, clutches, gearboxes | A worm turns its gear one tooth per turn and locks when driven from the gear. A two-speed gearbox shifts by sliding its driving ring: first gear turns the output a third as far as the input, second as far, and in neutral the output stays put. Clutches that slip under load wait for forces in 2.0. |
| M6 | Linkages | In three parts, below. These need sliding joints, ball joints, and closed loops of parts kept together. |
| M6.1 | Loops | A single-cylinder engine runs: turning its crank all the way round moves the piston up and down its cylinder, and pushing the piston turns the crank until dead centre. A four-bar linkage of beams on pins (a crank that turns all the way round, rocking a beam to and fro) moves through its full range. After many turns, no joint has drifted apart. |
| M6.2 | Rack and pinion | Turning a gear slides a rack along: a quarter turn of an 8 tooth gear moves the rack 2 teeth. Pushing the rack turns the gear. The racks ride on a plate sliding along tiles between rails, which may overhang them, and stop when the gear reaches the end of the teeth. |
| M6.3 | Ackermann steering | Rack and pinion steering, with steering links on ball joints to a steering arm at each front wheel. Each front wheel pivots on its own, the inside one turning further, so pushing the steered car makes every wheel roll round about the same centre. Tyres may scrub sideways a little, as real ones do. |
| M7 | Real models, oldest first | LEGO Technic sets from the LDraw Official Model Repository load and move as they should, taken in the order they came out, starting with the first Technic sets of 1977, so the basic parts are covered before later ones. Models load straight from multi-part files (MPD), with their submodels and the parts they bring with them. Each set that works joins the tests. |
| M8 | Chains and tracks | A chain or track couples its sprockets like gears that turn the same way, its links moving round the loop. A tracked vehicle turns by skidding its tracks sideways. |
| M9 | Belts, pulleys and strings | A rubber band couples its pulleys by their sizes, and a crossed one reverses them. A string wound on a winch drum and run over pulleys raises a hook as the drum turns, by less through a block and tackle. The hook hangs straight down. |

With M9 the kinematics is complete: version 1.0. Version 2.0 adds forces, through the [MuJoCo](https://mujoco.org) physics engine: momentum, springs that spring, clutches that slip under load.

A car with two fixed axles can't turn without its tyres sliding sideways, which is why M1 is straight-line only and turning waits for steering in M4. Steering alone isn't enough either: in a turn the inside wheels travel a shorter path than the outside ones, so two wheels on one solid axle can't both roll without slipping. Real LEGO cars just scrub their tyres. A tyre on its own axle never slips along the way it rolls in Kinebrick, so the M4 car has a differential at the back and each front wheel spinning on its own stub axle; tyres sharing a solid axle may skid that way, as on a real car, one back and the other forward, rolling without slipping only on average. Sideways, a tyre may scrub by up to 2% of how far it rolls, since real steering only gets close to every wheel rolling round one centre (Ackermann steering, M6.3); and rolling the way that scrubs least, up to 10%, so a car whose front wheels turn alike can roll with its steering turned. A car whose tyres would scrub more than that won't roll, unless its model allows more, or the viewer raises its allowance to what it needs, up to 30% ([Tyre scrub](README.md#options)).

### Later

- **Beyond Technic.** Other LEGO lines with moving parts, such as Creator sets (hinges, turntables, wheels on plain bricks) and trains (bogies that swivel, wheels on rails).
- **Marching ants for loose parts.** A loose part's own edge lines drawn dashed and crawling, on top of its red outline. Motion draws the eye, and it would only appear when something's wrong.
- **Suggest a fix for a loose part.** For a part that isn't attached, find the nearest position where its anti-studs would land on studs, and suggest moving it there ("move 10 LDU along z to sit on the plate"). Suggest only; Kinebrick doesn't edit models.
