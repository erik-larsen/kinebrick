// Checks each real LEGO set's functions (curated.functions in data/sets/<set>.json, what each
// control is supposed to do) against what Kinebrick does with the set's model, and writes what it
// found into the set's generated section, afresh each time. Each function's control is worked
// both ways from where the model was loaded (after its `first` controls), as a drag on it would
// (holding what a drag holds): a turn of REACH radians, or a push of PUSH LDU for a slide. A way
// works if the control goes at least half that far (turning against what its shaft turns
// in, not just on its joint, which a shaft spinning back under it could make up), every part in `moves` moves and no part in
// `stays` does, each against the frame or the part it names. A function works if one way works
// for each of its controls; it partly works if something moves; otherwise it doesn't. Controls
// marked `together` are worked as one instead, all turning at once, as pushing a vehicle along
// turns its wheels: the first is worked, and the others turn with it (see turnTogether).
// Several controls not worked together each drive their own share of the parts (the 42070's
// four motors, each driving one wheel): such a function works if each control, worked by
// itself, goes far enough, moves at least one part in `moves` and none in `stays`, and every
// part in `moves` is moved by at least one of them. `movedBy` says which control moved which
// parts.
//
// A control the viewer would push, not turn, is pushed (see isPushed and pushMeasuring; `pushed`
// in its results says so): a part that hangs on a hinge but doesn't spin on it like a knob (a
// door, an arm of a linkage, a gear on a shaft that also slides). It is grabbed by a point on it
// and pushed the way its hinge carries that point, by the viewer's own steps (src/push.ts),
// until it has turned REACH or can go no further, and pushed back the same length. Until
// 2026-11-12 such a control was turned on its joint, as no drag in the viewer does.
//
// How much, too. For each part in `moves` and `stays`, it writes how far the part turned
// (radians) and slid (LDU) for each radian the control turned, adding up every step of the way
// it went (`rates`). Where tooth counts alone say how fast a part should turn (see gearRates:
// through differentials too, where controls turned together give both sides), it writes that
// (`expected`), and lists the parts more than RATE_OFF off it (`wrong`). A piston in `moves`
// should slide in its cylinder as far as its crank's turn says, whatever turned the crank (see
// sliderCranks): its `expected` is that, for each radian the control turned, and it's `wrong` if
// it slid more than RATE_OFF and STROKE_OFF off it (its `rates` are against the frame, as for any
// other part). And each
// way is worked back again, as a new drag: everything should come back to where it started
// (`back`: the furthest any part is left from it, LDU and degrees, but for a turn about a line
// it is free on, see furthest; `strayed`: parts left more than BACK away). Beside it, `torn`: the furthest any part is left against its frame. A model
// that comes back whole but stands somewhere else (rolled away, or tipped over) is far out by
// `back`, but not by `torn`.
//
//   npm run functions                 every set with functions, but for the slowest (SLOW_OVER)
//   npm run functions -- --slow       only the slowest sets, left out of the plain run: hours,
//                                     before a merge to main
//   npm run functions -- 855 8880-1   only these sets: a name with a "-" is a set's whole name
//                                     (855-1, not 8855-1), one without is a set's number in full
//                                     (855: 855-1, 855-2, …)
//   npm run functions -- --jobs 4     how many sets to check at once (default: half the cores)
//   npm run functions -- --limit 20   stop a process (a set, or one function of a slow set) that
//                                     takes more than this many minutes (default 60), marking
//                                     the set as timed out
//   npm run functions -- --lock       steering's stops too (see LOCK), for now only reported
//   npm run functions -- --stops      where the viewer's collision stop would end each way (see
//                                     stopsReport), only reported
//   npm run functions -- --causes     no drags: only works out afresh why each function that
//                                     doesn't work doesn't (see causes.ts), from the results
//                                     already written, and writes each one's `cause`
//   npm run functions -- --quick      only the quick sets (QUICK): a couple of minutes, for every
//                                     change; the whole check takes about an hour
//
// A set whose process fails (it runs out of memory, say) keeps its file as it was, and the run
// names it at the end and exits with 1: a file with no results must not be committed.
//
// Each set's results are compared with what it had before, and each function that comes out
// better or worse is listed as the run goes.
//
// Each set is checked in a process of its own, and a set that took more than SPLIT_OVER seconds
// the last time, a function to a process (see main): the whole check then takes about as long as
// its work shared out over the jobs, not as long as its slowest set. generated has the commit it was checked at (and
// "uncommitted": true if src/ or data/ had changes not yet committed, and "holds": true if checked
// with KINEBRICK_LEAST=0), the date, how many functions came out each way, the model's loose
// parts, and one entry per function, in the same order as curated.functions: its result, how long
// it took (`seconds`), how far
// each control went each way, and the parts that didn't do what they should ("still": in `moves`
// but didn't move; "moved": in `stays` but did).

import { execFileSync, execSync, spawn } from 'node:child_process';
import { closeSync, existsSync, mkdtempSync, openSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { availableParallelism, tmpdir } from 'node:os';
import { join } from 'node:path';
import { Matrix4, Quaternion, Vector3 } from 'three';
import { experiments, Kinematics } from '../src/kinematics.ts';
import { PlacedPart } from '../src/ldr.ts';
import { Joint, Mechanism, meshesChanged, motorOutput } from '../src/mechanism.ts';
import { heldInBodyByPins, pinsForShift } from '../src/pinSearch.ts';
import { pointDirections, pushStep, wayOnJoint } from '../src/push.ts';
import { slidePart } from '../src/slide.ts';
import { collisionKey, Collisions, connectedPairs, keptFileName, pairNumber, PartMesh } from '../src/collisions.ts';
import { Cause, causeOf, CAUSES, Explained, Listed, onALoop } from './causes.ts';
import { Catch, catchShifts, findCatches, findSliders, nearestPosition, Slider, sliderMovedTo, sliderPosition } from '../src/shift.ts';
import { gearRates, line } from './gear-rates.ts';
import { turnOffAxis } from './back.ts';
import { loadModel, readParts } from './load-model.ts';
import { modelsOf, unreadTracks } from './unread-tracks.ts';
import { applyHolds, foundOf, readHolds } from './holds.ts';
import { endlessKinds, endlessPart } from './endless.ts';
import { normalizePartName } from '../src/connections.ts';
import { BUDGET_MB, estimateMb, partCounts, peakMb, Pool, poolDir } from './check-pool.ts';
import { combine, solveSymmetric } from '../src/linalg.ts';
import { FREE_PINS, freeWithEveryPin, heldPins, pinsByTrial, pinsToFree } from '../src/inference/friction.ts';
import { partShapes } from './part-shapes.ts';
import { pistonAt, sliderCranks } from './slider-cranks.ts';

const SETS_DIR = join('data', 'sets');
// How far a control is turned each way (radians), or pushed (LDU) if it slides.
const REACH = 1.5;
// How far a control is turned each way, at most, when its parts would move too little at REACH:
// three turns, enough for a part beyond a worm or a linear actuator (the 42100 Liebherr R 9800's
// boom, through its actuators, goes 0.25 LDU at REACH and 3 at this).
const LONG_REACH = 6 * Math.PI;
const PUSH = 20;
// A part counts as moved if it went at least this far (LDU) or turned at least this much (degrees).
const MOVED = 1;
// A part counts as moving at all if it went at least this far (LDU) or turned this much (degrees).
const STIRRED = 0.01;
const LIMIT_MINUTES = 60;
// A drag is measured in pieces of this many radians (or LDU, for a slide), adding up how far each
// part went in each: a part geared up turns further than half a turn, which its pose alone can't
// tell.
const PIECE = 0.1;
// A control the viewer would push, not turn (see pushMeasuring), is pushed in steps of up to this
// many LDU, as the viewer's are (MAX_STEP in src/interaction.ts).
const PUSH_STEP = 1;
// Pushed back, a control stops within BACK_ANGLE (radians) of where its joint began, and the
// last steps that shorten to get there are at least PUSH_LEAST (LDU).
const BACK_ANGLE = 1e-4;
const PUSH_LEAST = 1e-3;
// Such a control is grabbed by its part's middle, or a point this many LDU from it (see grabOf).
const GRAB = 10;
// And pushed this many LDU at most, each way: more than a turn of REACH takes on any Technic lever.
const PUSH_FAR = 200;
// A part counts as moving by the wrong amount if its rate is more than this share off what its
// gears say.
const RATE_OFF = 0.03;
// A piston counts as sliding by the wrong amount if it's this far (LDU) off what its crank's turn
// says, besides RATE_OFF of it.
const STROKE_OFF = 0.1;
// After there and back, a part counts as having strayed if it's this far (LDU) or this much
// (degrees) from where it started.
const BACK = 0.5;
// Putting a torn model back by hand (see freeBack): at most this many steps, each moving no part
// more than FREE_BACK_STEP LDU against its frame, each step's loops closed within FREE_BACK_GAP
// (Kinematics' DEAD_POINT_GAP).
const FREE_BACK_STEPS = 40;
const FREE_BACK_STEP = 5;
const FREE_BACK_GAP = 1e-3;
// Steering's stops: with --lock, a steering function's control is also turned each way until it
// stops, or as far as this (radians: a steering wheel geared down may take turns from lock to
// lock), and how far it steered is written (`lock`: for each control, each way, the most any
// steered part turned, in degrees; how far the control turned; and whether a limit stopped it,
// it stuck, or it went the whole way). The steered parts are those in `moves` (not on the
// control's body): a wheel, turning on an axle within LEVEL of level, by how far its axle's
// heading turned against the frame, seen from above; and a knuckle, turning on a joint within
// LEVEL of upright on something that doesn't (the frame, a suspension arm), by how far it turned
// against the frame. The turn stops, as in the viewer, where parts meet (see collisions.ts) or at
// a limit.
const LOCK = 4 * Math.PI;
const LEVEL = Math.PI / 6;
// A track's links (LDraw's Technic Chain Tread parts), by a path's skin (see trackRead), placed in
// a set's file as their own part ("42069 - 88323.dat") too.
const TRACK_SKIN = /(^|[ \/])(3873|15379|57518(c\d+)?|88323(c\d+)?|69900|69910)\.dat$/;
const STEERING = ['rack-steering', 'linkage-steering', 'multi-axle-steering', 'fork-steering', 'articulated-steering', 'swivel-axle-steering'];
const locks = process.env.KINEBRICK_CHECK_LOCK === '1';
// With --stops, each way of each control also notes where the viewer's collision stop would first
// have ended it (see Collisions.check): the pair of parts that met, and how far the control had
// turned then (radians, or LDU for a slide), against how far the check turned it. Only reported:
// it changes no result (decision 166 of 2026-11-17, to measure whether the check should stop
// where the viewer does).
const stopsReport = process.env.KINEBRICK_CHECK_STOPS === '1';
// The check stops where the viewer stops: a turn or push that would bring two parts to push into
// each other is stopped there (see Collisions.check), and the way is judged as one stopped at a
// limit (decision 186 of 2026-11-18): far enough once the control turned more than 0.001, working
// if every listed part moved MOVED and no part to stay did. On by default; KINEBRICK_COLLIDE=0
// turns it off, for comparing. Each stop is noted in `collisionStops`, as with --stops.
const collide = process.env.KINEBRICK_COLLIDE !== '0';
// Where the friction pins pinsToFree names (from the build with every pin free) don't let a
// control move, or a listed part held fast come loose, the pins are found by trying them in the
// build as read (see pinsByTrial; decision 126 of 2026-11-16). On by default;
// KINEBRICK_PIN_TRIAL=0 turns it off.
const pinTrial = process.env.KINEBRICK_PIN_TRIAL !== '0';
// A way counts toward a result only if its control moved: turned at least 0.01 (radians, or LDU
// for a slide), or, pushed, went 0.01 LDU. A listed part's motion with the control at rest counts
// for nothing (decision 121 of 2026-11-16: the 8272 Snowmobile's ski came out partly on parts
// that moved while its control stood still). On by default; KINEBRICK_CONTROL_MOVED=0 turns it off.
const controlMovedRule = process.env.KINEBRICK_CONTROL_MOVED !== '0';
// A part left still that the control does move, at a rate that isn't zero (more than SLOW_RATE:
// below it, a rate is rounding), has moved too little, not been held fast: its cause is too-little, not part-fixed,
// and the longer turn is tried (decision 121 of 2026-11-16: the 42052 Heavy Lift Helicopter's
// doors, which a worm and a toggle move 0.001 radians for each radian of the control, read as
// fixed). So too where its cause is not-driven: a part the control moves at a rate is driven,
// however slowly (the 8258 Crane Truck's function 5, whose linear actuator's piston slides 0.2 LDU
// for each radian of the control). And for a function whose controls share out its parts, the
// longer turn is tried when the cause the controls come to together is too-little (the 42081
// Volvo Concept Wheel Loader's function 2, whose piston slides 0.6 LDU for each radian). On by
// default; KINEBRICK_SLOW_PARTS=0 turns it off.
const slowPartsRule = process.env.KINEBRICK_SLOW_PARTS !== '0';
const SLOW_RATE = 1e-6;
// With --lock, each model's part shapes (see partShapes), read before it's checked.
const shapesOf = new Map<string, { name: string; shape: PartMesh[]; empty?: string }[]>();
// With --stops, the pairs of each model's parts that touch as built, from its kept file (see
// collision-pairs.ts), as the viewer takes them; null where the kept file's key doesn't match.
const keptNearOf = new Map<string, [number, number][] | null>();
// The quick sets: between them, every kind of mechanism the check can work (in the mechanism
// catalog), but two only the slow 42054 and 42055 have, chosen for the least time the check
// takes: about 6 minutes of one core's time in all, at 0.850.
// A set that took more than this many seconds the last time is checked a function to a process.
const SPLIT_OVER = 300;
// A set that took more than this many seconds of work the last time is left out of the plain run,
// which is run whenever it's wanted, and checked by `--slow` (or when named), before a merge to
// main: 2 hours. Only the 8110 Unimog does (5 to 6 hours of work; 2 hours side by side, as long
// as its slowest function). Its results stay as its last check left them, with their commit and
// date.
const SLOW_OVER = 7200;
// How long a process may take in the slow check, in minutes, where --limit doesn't say.
const SLOW_LIMIT_MINUTES = 240;
const QUICK = ['8270', '42107', '8849', '42061', '42109', '8001', '8204', '8245', '8851', '8856', '8208', '8448', '8824', '8202', '42084', '42074', '42071', '8845', '8837', '858', '8074', '42063', '42057', '42065', '956', '8081', '8049', '8416', '42112', '42129', '9394', '42000', '42114'];

type Stop = 'meets' | 'limit' | 'stuck' | 'free';
// What stopped a drag short of its reach: the end of a slide's or rack's travel, a dead point,
// no motion left that turns the joint, or a step that couldn't be taken. Or the end of a
// linkage's travel: a dead point reached once a part the function lists to move has turned far
// enough (see farEnough).
type Halt = 'limit' | 'dead point' | 'end of travel' | 'no motion' | 'stuck';
// With --causes, nothing is dragged: each failing function's cause is worked out afresh.
const causesOnly = process.env.KINEBRICK_CAUSES === '1';
// Whether a turn that stops at a dead point can be at its end of travel (see farEnough; decisions
// 104, 106 and 115). On; off with KINEBRICK_DEAD_POINT_TRAVEL=0, for measuring.
const DEAD_POINT_TRAVEL = process.env.KINEBRICK_DEAD_POINT_TRAVEL !== '0';
// Whether a part the function lists to move counts as moved if it got MOVED or more from where
// it started at any step on the way, not only by where it ends (decision 116): a piston, a crank
// pin or a rocker that goes round ends near its start when the turn happens to end near a whole
// turn (the 42075's pistons, their crank turned 5.8 radians). The farthest it got, not the path
// it went, so that small jitter over many steps can't add up. On; off with
// KINEBRICK_MOVED_ON_THE_WAY=0, for measuring.
const ON_THE_WAY = process.env.KINEBRICK_MOVED_ON_THE_WAY !== '0';
type Result = 'works' | 'partly' | 'no' | 'skipped' | 'not checked' | 'error';
interface Checked {
  result: Result;
  seconds?: number; // how long the function took to check
  peak?: number; // for a set checked a function to a process: the most memory its process took, in MB (see check-pool.ts)
  turned?: [number, number][]; // each control's turn against what its shaft turns in (or push), each way
  still?: string[];
  moved?: string[];
  rates?: Record<string, [number, number]>[]; // for each control, in the way taken, each listed part's turning and sliding for each radian it turned
  expected?: Record<string, number>[]; // for each control, what its gears say for the parts that have a say
  wrong?: string[];
  back?: [number, number][][]; // for each control, each way: the furthest a part is left after there and back (LDU, degrees)
  torn?: [number, number][][]; // the same, against the part's frame: how far the model came back torn, wherever it stands
  freeTurned?: boolean; // torn, but only where the model moves freely with the control held: put back by hand, every part is back (see freeBack)
  lock?: [number, number, Stop][][]; // for each steering control, each way: its steered parts' most turn (degrees), its own turn (radians), and what stopped it (see LOCK)
  strayed?: string[];
  why?: string[];
  stop?: (Halt | null)[][]; // for each control, each way: what stopped it short of its reach, if anything did
  pushed?: boolean[]; // for each control: whether it was worked by a push, as the viewer would, not a turn (see isPushed)
  movedBy?: string[][]; // for a function with several controls not worked together: for each control, the parts in `moves` it moved
  collisionStops?: [number, number, number, number, number, number][]; // with --stops: for each way a collision would have stopped, its control (by place), way (1 or -1), the two parts that met, how far the control had turned then, and how far in all (see stopsReport)
  shiftPressed?: number[]; // the friction pins a press with Shift freed for the control, where the function came out better so than as read (see pinsForShift)
  wrongBy?: string[][]; // for a function with several controls not worked together, if any moved a part in `stays`: for each control, those it moved
  judged?: number[]; // for a function that doesn't work: for each control, which way (0 or 1, as in `turned`) its cause was judged from, so that --causes judges it so too
  freed?: number; // how many friction pins were freed for its control, which had no motion (see pinsToFree)
  freedFor?: { pin: string; for: string }[]; // each pin freed, and the part it was freed for: the control, a part in `moves`, or the control after its first steps (decision 304)
  onPlay?: number; // how far its drags went on play, all ways together (radians, or LDU for a push; see Kinematics.onPlay): a record, read beside `turned`
  pivoted?: { slide: number; rise: number; tyre: string }; // a steered tyre on the ground pivoted about its steering axis, sliding and rising this much at most (LDU for each radian of the control; see Kinematics.pivoted): used, not needed, so read beside the result
  cause?: Cause; // for a function that doesn't work: why (see causes.ts)
  detail?: string; // the part the cause is about
  way?: WayShare & { why: string[]; freed: number }; // (internal) with --way: that control's share, its notes and freed pins, for the process that put it to work (see combineWays)
}
interface Fn {
  control?: string | string[];
  mechanisms?: string[];
  moves?: string[];
  stays?: string[];
  // Worked before the control, in order: a driving ring slid `by` LDU to its nearest click-in
  // place; with `slide`, a part slid along its axle `by` LDU, the sign along the part's own axis
  // that runs that way, as far as it goes before something stops it (see slideFirst); else the
  // control's joint turned `by`.
  first?: { control: string; by: number; slide?: boolean }[];
  together?: boolean; // the controls are worked as one, turning together (see turnTogether)
  // Parts whose bodies are frozen while the control is worked, as the viewer's Alt-click freezes
  // them: what the function's text says is held (the 8464's drive, for its differentials). Or,
  // by control, the parts each one's working holds (the 42000's "turning one rear wheel with the
  // other held": each rear wheel holds the other).
  held?: string[] | Record<string, string[]>;
  // The model lifted off the ground while the control is worked, as the viewer's "Lift off the
  // ground" option has it (see Options.lifted in kinematics.ts): what the function's text says is
  // done with the model in the hand (a differential worked with its drive held).
  lifted?: boolean;
  skip?: string;
  model?: string; // its own model, for a set with several (the 858's four engines)
}

// Checks one set's functions on its model, or each on its own; what goes in its generated
// section, but for the commit and date.
// Given `only`, just that function (by its place in the list) is checked, and only its model is
// loaded: the others' entries are left out (null), for a set checked a function to a process
// (see SPLIT_OVER).
async function check(set: { curated: { model: string; functions: Fn[] }; generated?: { functions?: Checked[] } }, only: number | null = null) {
  const { model, functions } = set.curated;
  // What each function came to the last time, for --causes: for a held one, what was found (see holds.ts).
  const priors = (set.generated?.functions ?? []).map(foundOf);
  const modelOf = (fn: Fn) => fn.model ?? model;
  const checked: Checked[] = [];
  const loose: string[] = [];
  // The errata applied to its models, and those refused (see src/errata.ts).
  const errata = { applied: [] as string[], refused: [] as string[] };
  const wanted = (i: number) => only === null || i === only;
  for (const m of new Set(functions.map(modelOf))) {
    const mine = functions.flatMap((fn, i) => (modelOf(fn) === m && wanted(i) ? [i] : []));
    if (mine.length === 0) continue;
    const found = await checkModel(m, mine.map((i) => functions[i]), mine.map((i) => priors[i]));
    mine.forEach((i, at) => (checked[i] = found.checked[at]));
    loose.push(...found.loose.map((p) => (m === model ? p : `${p} in ${m}`)));
    errata.applied.push(...found.errata.applied);
    errata.refused.push(...found.errata.refused);
  }
  return { counts: countsOf(checked), loose, ...(errata.applied.length || errata.refused.length ? { errata } : {}), functions: checked };
}

// Whether a function that left a part not back came back torn (a part left more than BACK LDU
// away against its frame), or whole but somewhere else (rolled away, or tipped over). By LDU
// only: a free wheel, its car rolled away, is left turned on its axle, which isn't torn. Null if
// every part came back, or for a result stored before `torn` was.
// A torn function whose every torn way goes back with the control held, along what moves freely
// without it (see freeBack), is "free-turned": not back, but nothing a user would call torn.
function notBackAs(c: Checked): 'torn' | 'free-turned' | 'moved whole' | null {
  if (!c.strayed || !c.torn) return null;
  if (!c.torn.flat().some(([ldu]) => ldu > BACK)) return 'moved whole';
  return c.freeTurned ? 'free-turned' : 'torn';
}

// How many functions came out each way, and how many moved a part by the wrong amount or left
// one not back, and of those, how many came back torn or whole but somewhere else.
function countsOf(checked: Checked[]) {
  const counts: Partial<Record<Result | 'wrong amount' | 'not back' | 'torn' | 'free-turned' | 'moved whole' | 'pivoted', number>> = {};
  const count = (what: keyof typeof counts) => (counts[what] = (counts[what] ?? 0) + 1);
  for (const c of checked) {
    if (!c) continue; // left out (see check's `only`)
    count(c.result);
    if (c.wrong) count('wrong amount');
    if (c.strayed) count('not back');
    const as = notBackAs(c);
    if (as) count(as);
    if (c.pivoted) count('pivoted');
  }
  return counts;
}

// What a function comes to without its model: skipped, or with no control, not checked. Null if
// it has to be checked.
function withoutChecking(fn: Fn): Checked | null {
  if (fn.skip) return { result: 'skipped' };
  if (!fn.control) return { result: 'not checked' };
  return null;
}

// Checks functions on one model: each one's result, and the model's loose parts.
async function checkModel(model: string, functions: Fn[], priors: (Checked | undefined)[]) {
  // A model from the OMR, or a changed copy of one (see invariance.ts), is read with the library's
  // connections.
  const loaded = await loadModel(model, model.startsWith('omr/') || process.env.KINEBRICK_AS_OMR === '1', undefined, shapesOf.get(model));
  const { table, slides } = loaded;
  // The model as it's being worked: as loaded, or worked out afresh after a shift (see shiftTo).
  let { parts, mech, kin } = loaded;
  let sliders: Slider[] = [];
  let catches: Catch[] = [];
  let at: Vector3[] = [];
  // Whether the function being checked has the model lifted off the ground (see Fn.lifted).
  let lifted = false;
  const use = (now: { parts: PlacedPart[]; mech: Mechanism; kin: Kinematics }) => {
    ({ parts, mech, kin } = now);
    // The model lifted, or set down again: a solver made so, as the viewer's option makes one.
    if (kin.options.lifted !== lifted) {
      const scrub = kin.scrub;
      kin = new Kinematics(mech, { lifted });
      kin.scrub = scrub;
    }
    sliders = findSliders(parts, mech, table, slides);
    catches = findCatches(parts, sliders, mech.roles, catches);
    at = parts.map((p) => new Vector3().setFromMatrixPosition(p.matrix));
  };
  const asLoaded = { parts, mech, kin };
  use(asLoaded);
  // The friction pins freed for the control being checked (see pinsToFree), and the model with
  // every pin free, worked out the first time a control needs it.
  let freed = new Set<number>();
  // The parts a function's first steps ask to slide on their axles (see slidesAsked).
  let slid = new Set<number>();
  let allFree: Mechanism | null = null;
  // Where everything is now, as parts placed in the model.
  const placedNow = () => parts.map((p, i) => ({ ...p, matrix: kin.poses[mech.bodyOf[i]].clone().multiply(p.matrix) }));
  // With --stops, the viewer's collision test (see stopsReport), made once for the model and told
  // of the mechanism as it now is, placed as it now is (as the viewer does after a rebuild): pairs
  // that touch there aren't watched. Null if the model's part shapes aren't known.
  let stopWatch: Collisions | null = null;
  // The collision test for the way being worked (see collide), and the first pair it stopped there
  // with how far the control had turned (set by mayGo, read by the way).
  let stopping: Collisions | null = null;
  let stoppedBy: [number, number] | null = null;
  // Whether a step may stand: no limit met, and (see collide) no two parts pushing into each other.
  const mayGo = () => {
    if (kin.atLimit() !== null) return false;
    if (!stopping) return true;
    const hit = stopping.check(placedNow().map((p) => p.matrix));
    if (hit && !stoppedBy) stoppedBy = hit;
    return hit === null;
  };
  // The parts' shapes, read with the model (see partShapes), one for each part: if they don't
  // match the parts one for one, by name, the function fails rather than going on without its
  // collision stop, or with another part's shape (decision 242 of 2026-11-20: the 4558 Metroliner's
  // shapes, shifted by one from its part 200 on). Nor does it go on where a part has no shape but
  // the reading gives no reason (see partShapes' `empty`): that part would have no collision test
  // (decision 248: the 42093's 569 parts of 576).
  const shapesHere = () => {
    const known = shapesOf.get(model);
    if (!known) return null;
    const wrong = parts.findIndex((p, i) => !known[i] || known[i].name !== normalizePartName(p.name));
    if (wrong >= 0) throw new Error(`the parts' shapes don't match the model's parts: part ${wrong} is ${parts[wrong].name}, its shape ${known[wrong]?.name ?? 'missing'}`);
    const bare = parts.findIndex((p, i) => !known[i].shape.length && !known[i].empty);
    if (bare >= 0) throw new Error(`part ${bare} (${parts[bare].name}) has no shape, and no reason is given`);
    return known;
  };
  const collisionsNow = () => {
    const known = shapesHere();
    if (!known) return null;
    const matrices = placedNow().map((p) => p.matrix);
    // As the viewer: parts connected aren't tested, nor a changeover catch and the driving ring its
    // fork sits in (see main.ts).
    const connected = connectedPairs(mech);
    for (const c of catches) for (const ring of c.ring.riders ?? [c.ring.part]) connected.add(c.part < ring ? `${c.part},${ring}` : `${ring},${c.part}`);
    const near = keptNearOf.get(model);
    if (!stopWatch && near) {
      // The pairs that touch as built, from the kept file, as the viewer has them.
      const built = loaded.parts.map((p) => p.matrix);
      stopWatch = new Collisions(parts.map((p, i) => (p.path ? [] : known[i].shape)), mech.bodyOf, connected, built, true);
      const n = parts.length;
      stopWatch.setNear(stopWatch.candidates(mech.bodyOf, connected, built), new Set(near.map(([a, b]) => pairNumber(a, b, n))), built, matrices);
    } else if (!stopWatch) stopWatch = new Collisions(parts.map((p, i) => (p.path ? [] : known[i].shape)), mech.bodyOf, connected, matrices);
    else stopWatch.watch(mech.bodyOf, connected, matrices);
    // A loose part never stops a motion, here as in the viewer (see Collisions.ignored).
    stopWatch.ignored = new Set(mech.loose);
    return stopWatch;
  };
  // Slides driving rings to the click-in positions given (by each ring's part), and works the
  // mechanism out afresh from where everything now is, as the viewer does after a shift.
  const shiftTo = (shifts: Map<number, number>) => {
    const now = placedNow();
    for (const [ring, to] of shifts) {
      const slider = sliders.find((s) => s.part === ring)!;
      const by = sliderMovedTo(now, table, slider, to).multiply(now[ring].matrix.clone().invert());
      for (const i of slider.riders ?? [ring]) now[i] = { ...now[i], matrix: by.clone().multiply(now[i].matrix) };
    }
    use(loaded.read(now, freed, slid));
  };
  // A function's first step that slides a part on its axle (decision 206 of 2026-11-18): the
  // mechanism is worked out afresh from where everything now is, with the part asked to slide (see
  // slidesAsked), and the part is pushed along its slide `by` LDU as the viewer pushes it (see
  // slidePart), until it has gone that far or the viewer's collision test stops it; then the
  // mechanism is worked out afresh again, from where it now is (a pin it lifted out of a hole no
  // longer holds what it held). What went short or wrong, if anything, else ''.
  const slideFirst = (p: number, by: number): string => {
    slid.add(p);
    const reread = () => {
      use(loaded.read(placedNow(), freed, slid));
      [stopping, stoppedBy] = [collide ? collisionsNow() : null, null];
    };
    reread();
    if (!mech.slid?.includes(p)) {
      stopping = null;
      return `can't slide: ${mech.slideWhy?.[p] ?? 'no slide'}`;
    }
    const place = (i: number) => {
      const m = kin.poses[mech.bodyOf[i]].clone().multiply(parts[i].matrix);
      return { position: new Vector3().setFromMatrixPosition(m), axes: [0, 1, 2].map((k) => new Vector3().setFromMatrixColumn(m, k).normalize()) };
    };
    const { went, halt } = slidePart(() => ({ kin, mech, place }), reread, p, by, mayGo);
    const met = stoppedBy;
    stopping = null;
    use(loaded.read(placedNow(), freed, slid));
    if (went >= 0.9 * Math.abs(by)) return '';
    return `went ${round(went)} of ${Math.abs(by)} LDU, ${halt === 'met' && met ? `stopped where p${met[0]} meets p${met[1]}` : halt || 'stuck'}`;
  };
  // A part named as the joints probe names it: "p483 3736".
  const part = (ref: string) => {
    const n = Number(/^p(\d+)\b/.exec(ref.trim())?.[1]);
    if (!(n >= 0 && n < parts.length)) throw new Error(`no part ${ref}`);
    return n;
  };
  const name = (p: number) => `p${p} ${parts[p].name.replace(/\.dat$/, '')}`;
  // "p402 3703 against p315 3029": the part, and the body it's measured against (if none, the
  // frame of the model it is in: a set's second vehicle's own, see Kinematics.frames).
  const against = (ref: string) => {
    const [a, b] = ref.split(' against ');
    return { ref, part: part(a), body: b ? mech.bodyOf[part(b)] : kin.frameOf[mech.bodyOf[part(a)]] };
  };
  // Whether a part moved against its body, from the poses at `start` to now, or is a driving
  // ring a catch has shifted (`shifted`).
  const moved = ({ part, body }: { part: number; body: number }, start: Matrix4[], shifted: Map<number, number>, least = MOVED) => {
    if (shifted.has(part)) return true;
    const rel = (poses: Matrix4[]) => poses[body].clone().invert().multiply(poses[mech.bodyOf[part]]);
    const was = rel(start);
    const is = rel(kin.poses);
    const went = at[part].clone().applyMatrix4(is).distanceTo(at[part].clone().applyMatrix4(was));
    const q = new Quaternion().setFromRotationMatrix(was.clone().invert().multiply(is));
    return went >= least || (2 * Math.acos(Math.min(1, Math.abs(q.w))) * 180) / Math.PI >= least;
  };
  // The body a control works: its own, or for a motor named as the control, what turns in it
  // (its output's axle), as the motor would turn it.
  const worked = (control: number) => {
    const b = mech.bodyOf[control];
    return mech.roles[control] === 'motor' ? motorOutput(mech, control) : b;
  };
  // Whether a drag of the control, with its holds chosen as the viewer's are, has a motion: an
  // exact one, or with `play`, one on play too (see Kinematics.loopPlay). The check's first test of
  // a control holds nothing and asks for an exact motion; the trial search frees pins only for a
  // part that can't move even on play (decision 139 of 2026-11-17: the 42062 Container Yard's
  // wheels, which roll on play as a drag holds them, had a friction pin freed by it, and a part
  // that hangs on the pin swung 157 LDU away).
  const dragGoes = (control: number, play = false) => {
    const before = kin.snapshot();
    const goes = kin.dragMoves(worked(control), play);
    kin.restore(before);
    return goes;
  };
  // The bodies turned with the one worked, for a function whose controls are worked together.
  let together: number[] = [];
  // Works a body's joint as a drag does, as far as it goes up to `amount`; how far it went.
  const turn = (body: number, amount: number) => {
    const joint = kin.parentLink(body)!.joint;
    if (together.length) kin.turnTogether(body, together);
    kin.holdWhatTheDragDoesntNeed(body, () => kin.jointMotion(joint) !== null, joint);
    const turned = kin.turnJoint(joint, amount, mayGo);
    kin.letGoAfterDrag();
    return turned;
  };
  const round = (x: number) => Math.round(x * 100) / 100;
  // To 3 significant figures.
  const sig = (x: number) => Number(x.toPrecision(3));
  // Where a part is against a body (its place and pose).
  const relative = (part: number, body: number, poses: Matrix4[]) => poses[body].clone().invert().multiply(poses[mech.bodyOf[part]]);
  const angle = (a: Matrix4, b: Matrix4) => {
    const q = new Quaternion().setFromRotationMatrix(a.clone().invert().multiply(b));
    return 2 * Math.acos(Math.min(1, Math.abs(q.w)));
  };
  // turn, in pieces (see PIECE), adding up how far each of `parts` turns (radians) and slides
  // (LDU) against its body on the way, and calling `each` after each piece. With `enough`, the
  // turn also ends, short of `amount`, after the first piece that leaves it true.
  const turnMeasuring = (body: number, amount: number, parts: { part: number; body: number }[], each = () => {}, enough = (_turned: number) => false) => {
    const joint = kin.parentLink(body)!.joint;
    if (together.length) kin.turnTogether(body, together);
    kin.holdWhatTheDragDoesntNeed(body, () => kin.jointMotion(joint) !== null, joint);
    const went = parts.map(() => [0, 0]);
    let was = parts.map((p) => relative(p.part, p.body, kin.poses));
    let turned = 0;
    // What stops it short, if anything does: a limit is told as the step that reached it is undone.
    let limited = false;
    let halt: Halt | null = null;
    const allowed = () => {
      if (mayGo()) return true;
      limited = true;
      return false;
    };
    while (Math.abs(turned) < Math.abs(amount) - 1e-9) {
      const piece = Math.sign(amount) * Math.min(PIECE, Math.abs(amount) - Math.abs(turned));
      const step = kin.turnJoint(joint, piece, allowed);
      turned += step;
      each();
      const is = parts.map((p) => relative(p.part, p.body, kin.poses));
      parts.forEach((p, k) => {
        went[k][0] += angle(was[k], is[k]);
        went[k][1] += at[p.part].clone().applyMatrix4(is[k]).distanceTo(at[p.part].clone().applyMatrix4(was[k]));
      });
      was = is;
      if (Math.abs(step) < Math.abs(piece) - 1e-9) {
        // An end of travel the slides held at their ends found (see Kinematics.endReached) is a
        // limit as one atLimit found is.
        halt = limited || kin.endReached ? 'limit' : kin.atDeadPoint(joint) ? 'dead point' : kin.jointMotion(joint, false) === null ? 'no motion' : 'stuck';
        break;
      }
      if (enough(turned)) break;
    }
    kin.letGoAfterDrag();
    return { turned, went, halt };
  };
  // Whether the viewer would push a control's body, not turn it: it hangs on a hinge, but doesn't
  // spin on it like a knob (see Kinematics.turnsLikeAKnob: a door, an arm in a linkage, a gear
  // on a shaft that also slides). Not controls worked together, which turn as one (see
  // turnTogether).
  const isPushed = (body: number) => {
    const link = kin.parentLink(body);
    return link !== null && !together.length && mech.joints[link.joint].kind === 'revolute' && !kin.turnsLikeAKnob(body);
  };
  // Where a pushed control is grabbed, as built, and the way it is pushed from there. Of its
  // part's middle and the six points GRAB from it along the part's own axes (a point on a gear's
  // face, or along a beam), the one that goes fastest as the control turns on its joint, since a
  // part's middle may be on the axle it spins on, where no push turns it. The way: the way that
  // point goes as the joint turns, as someone opening a door pushes it round its hinge, not along
  // the car (which would roll it). Null if the joint can't turn, or moves none of the points.
  const grabOf = (body: number, control: number) => {
    const m = parts[control].matrix;
    const points = [at[control].clone()];
    for (const k of [0, 1, 2]) for (const way of [1, -1]) points.push(at[control].clone().addScaledVector(new Vector3().setFromMatrixColumn(m, k).normalize(), way * GRAB));
    if (kin.hingeStuck(body, points)) return null;
    const motion = kin.jointMotion(kin.parentLink(body)!.joint, false)!;
    const speeds = points.map((point) => kin.pointVelocity(motion, body, point.clone().applyMatrix4(kin.poses[body])));
    const fastest = Math.max(...speeds.map((v) => v.length()));
    if (fastest < 1e-6) return null;
    const best = speeds.findIndex((v) => v.length() >= fastest - 1e-9);
    return { grab: points[best], dir: speeds[best].clone().normalize() };
  };
  // As turnMeasuring, for a control the viewer would push: the control is pushed by the point it
  // is grabbed by (see grabOf), by the viewer's own steps (see pushStep), holding what a push
  // holds. `to` says how far. `reach`: the way that point goes as the control's joint turns (or
  // the other way, if negative), until the control has turned that far against what its shaft
  // turns in, or the push can go no further. `back`: back the way an earlier push went, until
  // the control's joint is where that push began (`from`): pushed back as far as it went, it
  // ended up to a fortieth of a radian off (the 42056's rear wing, 2.4 LDU out of place;
  // decision 84 of 2026-11-15). It follows the way the point goes, round a curve. Also returns
  // how the push went, to push it back.
  type Pushed = { grab: Vector3; dir: Vector3; length: number; from: number };
  // The slide a control with no turning joint of its own slides on: a body that is the root of a
  // tree of its own, held to the rest by a slide (see buildTree), as an outrigger's beam slides in
  // a chassis. -1 if it has none.
  // A slide control, so: a body with one slide among its joints, and no other joint but hinges
  // (revolutes), such as what hangs from it turning on its pins (a telescopic fork's shock rod,
  // with the wheel's axle holder on it: the 8838's and the 42036's). A body that also hangs on
  // something else in another way (the 42063's handlebars, on a fork top that rides the legs and
  // hangs on a ball), or slides two ways, is pushed at a point, as any other.
  const slideOf = (body: number) => {
    if (kin.frames.includes(body) || kin.parentLink(body)) return -1;
    const own = mech.joints.flatMap((j, k) => (j.bodyA === body || j.bodyB === body ? [k] : []));
    const slides = own.filter((k) => mech.joints[k].kind === 'slide');
    return slides.length === 1 && own.every((k) => k === slides[0] || mech.joints[k].kind === 'revolute') ? slides[0] : -1;
  };
  // A control that slides (see slideOf) pushed along its slide by `amount` LDU, as a drag of it in
  // the viewer pushes it, each step the way the slide now points: how far it slid along it
  // (signed), how far each of `parts` went, and what stopped it, if anything did.
  const slideMeasuring = (body: number, amount: number, parts: { part: number; body: number }[], each = () => {}) => {
    const j = mech.joints[slideOf(body)];
    const other = j.bodyA === body ? j.bodyB : j.bodyA;
    const axis = j.to.clone().sub(j.from).normalize(); // as built, on the body it slides on
    const grab = at[mech.bodies[body].parts[0]].clone();
    // How far the grab point is along the slide, on the body it slides on.
    const along = () => grab.clone().applyMatrix4(kin.poses[other].clone().invert().multiply(kin.poses[body])).dot(axis);
    const start = along();
    const grabNow = () => grab.clone().applyMatrix4(kin.poses[body]);
    const directions = pointDirections(kin, body, grabNow());
    if (directions > 0) kin.holdWhatTheDragDoesntNeed(body, () => pointDirections(kin, body, grabNow()) === directions);
    const went = parts.map(() => [0, 0]);
    let was = parts.map((p) => relative(p.part, p.body, kin.poses));
    let halt: Halt | null = null;
    while (Math.abs(along() - start) < Math.abs(amount) - 1e-9) {
      const dir = axis.clone().transformDirection(kin.poses[other]).multiplyScalar(Math.sign(amount));
      const step = Math.min(PUSH_STEP, Math.abs(amount) - Math.abs(along() - start));
      const before = along();
      const how = pushStep(kin, body, grab, dir, step, mayGo);
      if (how !== 'moved') {
        halt = how === 'blocked' ? 'limit' : 'stuck';
        break;
      }
      each();
      const is = parts.map((p) => relative(p.part, p.body, kin.poses));
      parts.forEach((p, k) => {
        went[k][0] += angle(was[k], is[k]);
        went[k][1] += at[p.part].clone().applyMatrix4(is[k]).distanceTo(at[p.part].clone().applyMatrix4(was[k]));
      });
      was = is;
      // A step that moved, but hardly along the slide (the push carries the body and what it
      // slides on along together), would go on for ever: it is stuck.
      if (Math.abs(along() - before) < 0.01 * step) {
        halt = 'stuck';
        break;
      }
    }
    kin.letGoAfterDrag();
    return { turned: along() - start, went, halt, pushed: null };
  };
  // The ball a control with no turning joint of its own and no slide turns on: a body that is the
  // root of a tree of its own, held to the rest by a ball (see buildTree), as a pendular axle
  // swings on its ball pivot under a chassis (the 42038 Arctic Truck). -1 if it has none.
  const ballOf = (body: number) => (kin.frames.includes(body) || kin.parentLink(body) || slideOf(body) >= 0 ? -1 : mech.joints.findIndex((j) => j.kind === 'ball' && (j.bodyA === body || j.bodyB === body)));
  // The line a control on a ball (see ballOf) turns about, through the ball's middle, on the body
  // it turns against: the way the free motions turn it most against that body, as a pendular
  // axle turns on its ball only about the drive shaft through it. Kept for the way back. Null if
  // the free motions don't turn it.
  let ballAxis: Vector3 | null = null;
  // A control on a ball (see ballOf) turned about the ball's middle by `amount` radians, by
  // pushes of the point it is grabbed by (its part's middle), each step the way that point now
  // goes about the line (see ballAxis): how far it turned about the line (signed), how far each
  // of `parts` went, and what stopped it, if anything did. `again` turns it about the line found
  // the last time (for the way back).
  const ballMeasuring = (body: number, control: number, amount: number, parts: { part: number; body: number }[], each = () => {}, again = false) => {
    const j = mech.joints[ballOf(body)];
    const other = j.bodyA === body ? j.bodyB : j.bodyA;
    const grab = at[control].clone();
    const grabNow = () => grab.clone().applyMatrix4(kin.poses[body]);
    const middle = () => j.from.clone().applyMatrix4(kin.poses[other]);
    const against = () => kin.poses[other].clone().invert().multiply(kin.poses[body]);
    if (!again) {
      // How each free motion turns it against the other body, from how points one LDU from the
      // ball's middle go; the main way, from all the free motions together (the same whichever
      // way they are written down).
      const c = middle();
      const at1 = (x: number, y: number, z: number) => new Vector3(x, y, z).add(c);
      const turns = kin.freeMotions().map((m) => {
        const go = (p: Vector3) => kin.pointVelocity(m, body, p).sub(kin.pointVelocity(m, other, p));
        const y = go(at1(0, 1, 0));
        const z = go(at1(0, 0, 1));
        return new Vector3(y.z, z.x, -y.x);
      });
      let main = turns.reduce((best, w) => (w.length() > best.length() ? w : best), new Vector3());
      for (let k = 0; k < 50 && main.length() > 1e-6; k++) main = turns.reduce((sum, w) => sum.addScaledVector(w, w.dot(main)), new Vector3()).normalize();
      ballAxis = main.length() > 1e-6 ? main.clone().transformDirection(kin.poses[other].clone().invert()) : null;
    }
    const went = parts.map(() => [0, 0]);
    if (!ballAxis) return { turned: 0, went, halt: 'no motion' as Halt, pushed: null };
    const axis = ballAxis.clone();
    const from = against();
    // How far it has turned about the line, against the other body, since it started.
    const turnedNow = () => {
      const q = new Quaternion().setFromRotationMatrix(from.clone().invert().multiply(against()));
      return 2 * Math.atan2(new Vector3(q.x, q.y, q.z).dot(axis), q.w);
    };
    const directions = pointDirections(kin, body, grabNow());
    if (directions > 0) kin.holdWhatTheDragDoesntNeed(body, () => pointDirections(kin, body, grabNow()) === directions);
    let was = parts.map((p) => relative(p.part, p.body, kin.poses));
    let halt: Halt | null = null;
    let length = 0;
    while (Math.abs(turnedNow()) < Math.abs(amount) - 1e-9 && length < PUSH_FAR - 1e-9) {
      const dir = axis.clone().transformDirection(kin.poses[other]).cross(grabNow().sub(middle()));
      if (dir.length() < 1e-6) {
        halt = 'no motion';
        break;
      }
      dir.normalize().multiplyScalar(Math.sign(amount));
      const how = pushStep(kin, body, grab, dir, PUSH_STEP, mayGo);
      if (how !== 'moved') {
        halt = how === 'blocked' ? 'limit' : 'stuck';
        break;
      }
      length += PUSH_STEP;
      each();
      const is = parts.map((p) => relative(p.part, p.body, kin.poses));
      parts.forEach((p, k) => {
        went[k][0] += angle(was[k], is[k]);
        went[k][1] += at[p.part].clone().applyMatrix4(is[k]).distanceTo(at[p.part].clone().applyMatrix4(was[k]));
      });
      was = is;
    }
    kin.letGoAfterDrag();
    return { turned: turnedNow(), went, halt, pushed: null };
  };
  const pushMeasuring = (body: number, control: number, to: { reach: number } | { back: Pushed }, parts: { part: number; body: number }[], each = () => {}) => {
    const joint = kin.parentLink(body)!.joint;
    const start = 'back' in to ? null : grabOf(body, control);
    const grab = 'back' in to ? to.back.grab : (start?.grab ?? at[control]);
    const grabNow = () => grab.clone().applyMatrix4(kin.poses[body]);
    const directions = pointDirections(kin, body, grabNow());
    if (directions > 0) kin.holdWhatTheDragDoesntNeed(body, () => pointDirections(kin, body, grabNow()) === directions);
    // The way it goes: back along the earlier push, or the way its joint carries the point.
    const dir = new Vector3();
    if ('back' in to) dir.copy(to.back.dir).negate();
    else if (start) dir.copy(start.dir).multiplyScalar(Math.sign(to.reach));
    const went = parts.map(() => [0, 0]);
    let was = parts.map((p) => relative(p.part, p.body, kin.poses));
    // The control against what its shaft turns in.
    const own = { part: mech.bodies[body].parts[0], body: kin.housing(body) };
    let ownWas = relative(own.part, own.body, kin.poses);
    let ownTurned = 0;
    const from = kin.jointAngles[joint];
    let halt: Halt | null = null;
    let length = 0;
    // Pushed back: first as far as the push out went, then on, or back, to where the joint began,
    // the last steps shortened by how fast it turns for each LDU pushed (from the push out at
    // first, then from each step). Pushed back only as far as it went, it ended up to a fortieth of
    // a radian off; pushed back only to the joint's angle, a push that carried a part away hardly
    // turning the joint (the 42062's spreader, 200 LDU) brought it nowhere back.
    const left = () => ('back' in to ? to.back.from - kin.jointAngles[joint] : 0);
    const backWay = Math.sign(left());
    let rate = 'back' in to && to.back.length > 0 ? Math.abs(left()) / to.back.length : 0;
    const far = 'back' in to ? to.back.length : PUSH_FAR;
    let mending = false;
    let mendWay = 0;
    let mended = 0;
    const going = () => {
      if (!('back' in to)) return length < far - 1e-9 && ownTurned < Math.abs(to.reach) - 1e-9;
      if (!mending) {
        if (length < far - 1e-9) return true;
        mending = true;
        mendWay = Math.sign(left());
        if (backWay === 0 || mendWay === 0 || Math.abs(left()) <= BACK_ANGLE) return false;
        // Gone past where it began: turned round.
        if (mendWay !== backWay) dir.negate();
        return true;
      }
      return mended < to.back.length + PUSH_STEP && Math.sign(left()) === mendWay && Math.abs(left()) > BACK_ANGLE;
    };
    // A control whose joint can't turn, with what the push holds held, could only be carried by
    // what it turns in (the whole 42055 Bucket Wheel Excavator rolling, pushed by its battery
    // switch), step after step until it ran into something: it goes nowhere.
    if (!('back' in to) && kin.jointMotion(joint, false) === null) halt = 'no motion';
    while (!halt && going()) {
      if (dir.length() < 0.5) {
        halt = 'no motion';
        break;
      }
      // Each step is aimed along the way the grab point now goes on the control's joint (see
      // wayOnJoint), as a hand follows a door round, and not along the line it first went.
      const way = wayOnJoint(kin, body, grabNow());
      if (way) dir.copy(way.dot(dir) >= 0 ? way : way.negate());
      const step = mending ? Math.min(PUSH_STEP, rate > 1e-9 ? Math.max(PUSH_LEAST, Math.abs(left()) / rate) : PUSH_STEP) : Math.min(PUSH_STEP, far - length);
      const angleWas = kin.jointAngles[joint];
      const how = pushStep(kin, body, grab, dir, step, mayGo);
      if (how !== 'moved') {
        halt = how === 'blocked' ? 'limit' : kin.jointMotion(joint, false) === null ? 'no motion' : 'stuck';
        break;
      }
      length += step;
      if (mending) mended += step;
      if (Math.abs(kin.jointAngles[joint] - angleWas) > 1e-9) rate = Math.abs(kin.jointAngles[joint] - angleWas) / step;
      each();
      const is = parts.map((p) => relative(p.part, p.body, kin.poses));
      parts.forEach((p, k) => {
        went[k][0] += angle(was[k], is[k]);
        went[k][1] += at[p.part].clone().applyMatrix4(is[k]).distanceTo(at[p.part].clone().applyMatrix4(was[k]));
      });
      was = is;
      const ownIs = relative(own.part, own.body, kin.poses);
      ownTurned += angle(ownWas, ownIs);
      ownWas = ownIs;
    }
    // The whole length was pushed, and the control didn't turn as far as it should.
    if (!halt && !('back' in to) && ownTurned < Math.abs(to.reach) - 1e-9) halt = 'stuck';
    kin.letGoAfterDrag();
    return { turned: kin.jointAngles[joint] - from, went, halt, pushed: { grab, dir: dir.clone(), length, from } };
  };
  // The furthest any part is from where it was in `poses` (LDU, degrees), and the part that's
  // furthest (by LDU, or degrees for a part that only turns). With `onFrame`, where each part
  // is against its frame (see Kinematics.frameOf), not in the world.
  // A part back within BACK LDU, but left turned about the axis of a joint it is free on (a pin
  // in its holes, a free wheel on its axle), is back, as a user sees it: only its turn off that
  // axis counts. Not a gear's: whatever it meshes with would be left turned too (decision of
  // 2026-11-15).
  const furthest = (poses: Matrix4[], onFrame = false) => {
    let most = { ldu: 0, degrees: 0, part: -1, by: 0 };
    // From the mechanism as it is now: freeing friction pins reads it afresh.
    const geared = new Set(mech.gears.map((g) => g.body));
    const freeOn = new Map<number, Joint[]>();
    for (const j of mech.joints) if (j.kind === 'revolute' || (j.kind === 'slide' && j.turns)) for (const b of [j.bodyA, j.bodyB]) freeOn.set(b, [...(freeOn.get(b) ?? []), j]);
    const placed = (all: Matrix4[], b: number) => (onFrame ? all[kin.frameOf[b]].clone().invert().multiply(all[b]) : all[b]);
    parts.forEach((_, i) => {
      const b = mech.bodyOf[i];
      const [now, then] = [placed(kin.poses, b), placed(poses, b)];
      const ldu = at[i].clone().applyMatrix4(now).distanceTo(at[i].clone().applyMatrix4(then));
      let turned = angle(then, now);
      if (ldu <= BACK && turned > 0 && !geared.has(b)) {
        for (const j of freeOn.get(b) ?? []) {
          turned = Math.min(turned, turnOffAxis(then, now, j.to.clone().sub(j.from).normalize().transformDirection(placed(poses, j.bodyA))));
        }
      }
      const degrees = (turned * 180) / Math.PI;
      const by = Math.max(ldu, degrees);
      most = { ldu: Math.max(most.ldu, ldu), degrees: Math.max(most.degrees, degrees), part: by > most.by ? i : most.part, by: Math.max(by, most.by) };
    });
    return most;
  };

  // Whether every part left torn after there and back (more than BACK LDU from where it was in
  // `poses`, against its frame) goes back within BACK with the control (`body`) held: moved along
  // what the model can do with the control still (a branch or shaft the drag left turned, free of
  // the control), in steps of at most FREE_BACK_STEP LDU, each the motion that brings every part
  // nearest where it was (least squares over the free motions). A user would put such parts back
  // by hand; a part the control has to move to go back is torn. The model is left as it was.
  const freeBack = (poses: Matrix4[], body: number): boolean => {
    const was = kin.snapshot();
    const frozen = kin.isFrozen(body);
    if (!frozen) kin.toggleFreeze(body);
    try {
      let last = Infinity;
      for (let step = 0; step < FREE_BACK_STEPS; step++) {
        const apart = furthest(poses, true).ldu;
        if (apart <= BACK) return true;
        if (apart > last - 1e-3) return false;
        last = apart;
        const free = kin.freeMotions();
        if (!free.length) return false;
        // For each part, how far it has to go (against its frame), and how fast each free
        // motion takes it there: the normal equations of the least squares fit.
        const gram = free.map(() => new Array(free.length).fill(0));
        const toward = new Array(free.length).fill(0);
        parts.forEach((_, i) => {
          const b = mech.bodyOf[i];
          const f = kin.frameOf[b];
          const now = at[i].clone().applyMatrix4(kin.poses[b]);
          const there = at[i].clone().applyMatrix4(poses[f].clone().invert().multiply(poses[b])).applyMatrix4(kin.poses[f]);
          const go = there.sub(now);
          const speeds = free.map((m) => kin.pointVelocity(m, b, now).sub(kin.pointVelocity(m, f, now)));
          speeds.forEach((u, k) => {
            toward[k] += u.dot(go);
            speeds.forEach((v, l) => (gram[k][l] += u.dot(v)));
          });
        });
        const amounts = solveSymmetric(gram, toward, 1e-9);
        const motion = combine(free, amounts);
        // The furthest any part goes in this motion, to keep the step short.
        let fastest = 0;
        parts.forEach((_, i) => {
          const b = mech.bodyOf[i];
          const now = at[i].clone().applyMatrix4(kin.poses[b]);
          fastest = Math.max(fastest, kin.pointVelocity(motion, b, now).sub(kin.pointVelocity(motion, kin.frameOf[b], now)).length());
        });
        if (fastest < 1e-9) return false;
        const gap = kin.advance(motion, Math.min(1, FREE_BACK_STEP / fastest));
        if (gap > FREE_BACK_GAP) return false;
      }
      return furthest(poses, true).ldu <= BACK;
    } finally {
      if (!frozen) kin.toggleFreeze(body);
      kin.restore(was);
    }
  };

  // The pins a press with Shift frees for the controls of the function being checked again (see
  // pinsForShift, and shiftPressed in checkOne): freed for each way, besides any it frees itself.
  let shiftFreed = new Set<number>();
  const checkOne = (fn: Fn, prior?: Checked): Checked => {
    const known = withoutChecking(fn);
    if (known) return known;
    lifted = fn.lifted === true;
    // With --causes, only a function that didn't work is looked at, and nothing is dragged.
    if (causesOnly && !(prior && (prior.result === 'partly' || prior.result === 'no'))) return prior ?? { result: 'not checked' };
    const why: string[] = [];
    let freedPins = 0;
    // For each friction pin freed, the part it was freed for (decision 304): the control, a part the
    // function lists to move, or the control after its first steps; the first reason kept.
    const freedFor = new Map<number, string>();
    const noteFreed = (pins: Iterable<number>, forRef: string) => {
      for (const pin of pins) if (!freedFor.has(pin)) freedFor.set(pin, forRef);
    };
    const collisionStops: [number, number, number, number, number, number][] = [];
    // Controls worked together are worked as one, by the first, the others turning with it.
    const controls = [fn.control!].flat();
    // Several controls not worked together: each drives its own share of the parts.
    const shared = controls.length > 1 && !fn.together;
    // Whether each control is worked the longer turn from the start (see slowPartsRule): for a
    // function whose controls share out its parts, their cause together too-little.
    let longShared = false;
    const workWay = (ref: string, wi: number) => {
      // The collision test is set for each way (see mayGo): none before, as the mechanism may be
      // worked out afresh (pins freed, a shift) before the way starts.
      stopping = null;
      together = [];
      use(asLoaded);
      kin.reset();
      freed = new Set(shiftFreed);
      slid = new Set();
      // A control with no exact motion at the start (play is the last resort: see
      // Kinematics.jointMotion), held by friction pins: those pins are freed, and
      // the model worked out again, for this control only (see pinsToFree). So too a control
      // the viewer would push whose joint turns only by swinging the rest of the model round it,
      // so that no point of it moves and the push couldn't start (see grabOf): the 8865's seat
      // back, on friction hinge plates.
      if (FREE_PINS) {
        const c = part(ref);
        const l = kin.parentLink(worked(c));
        const noGrab = () => !fn.together && isPushed(worked(c)) && grabOf(worked(c), c) === null;
        // Whether the control can move, in the model as it's now worked out.
        const controlGoes = () => {
          const link = kin.parentLink(worked(c));
          return !(kin.frames.includes(worked(c)) || !link || kin.jointMotion(link.joint, false) === null || noGrab());
        };
        // Whether `ok` holds with `pins` freed too: the model worked out again so, then as it was.
        const withFreed = (pins: Set<number>, ok: () => boolean) => {
          use(loaded.read(asLoaded.parts, new Set([...freed, ...pins]), slid));
          const holds = ok();
          use(asLoaded);
          return holds;
        };
        // The pins to free besides those freed already, found by trying them (see pinTrial).
        const byTrial = (forPart: number, ok: () => boolean) => pinsByTrial(heldPins(asLoaded.mech, forPart, freed), (pins) => withFreed(pins, ok));
        if (!controlGoes()) {
          allFree ??= loaded.allFree(asLoaded.parts);
          const forControl = pinsToFree(allFree, c);
          noteFreed(forControl, ref);
          freed = new Set([...shiftFreed, ...forControl]);
          // A push with no point to push can't start, on play or not (see grabOf). No pins are
          // tried for a control that sits in the frame even with every pin free (see
          // freeWithEveryPin), as the viewer tries none.
          if (pinTrial && freeWithEveryPin(allFree, c) && !(freed.size && withFreed(new Set(), controlGoes)) && (noGrab() || !dragGoes(c, true))) for (const pin of byTrial(c, controlGoes)) {
            freed.add(pin);
            noteFreed([pin], ref);
          }
        }
        // So too a part the function lists to move that friction pins hold fast to what it's
        // measured against, but only where the control doesn't go (it jams, or a push has no
        // point to push): there a user's drag of it asks the viewer for pins, and the viewer
        // frees the same ones (the 8418's bucket, the 42032's levers). Where the control turns
        // its reach and the part stays fast, the viewer shows nothing, so neither does the
        // check: the part is noted as held by pins the control doesn't reach.
        const held = (fn.moves ?? []).map(against).filter((m) => mech.bodyOf[m.part] === m.body);
        if (held.length) {
          // Whether the control goes a hair, holding what a drag of it holds.
          const goes = () => {
            if (kin.frames.includes(worked(c)) || !l || kin.jointMotion(l.joint, false) === null || noGrab()) return false;
            const before = kin.snapshot();
            kin.holdWhatTheDragDoesntNeed(worked(c), () => kin.jointMotion(l.joint) !== null, l.joint);
            const went = kin.turnJoint(l.joint, 0.01, () => true);
            kin.letGoAfterDrag();
            kin.restore(before);
            return Math.abs(went) > 1e-6;
          };
          // Where the control goes only on play (no exact motion as its drag holds it), a part held
          // fast gets its pins all the same (decision 139: the 41999 Crawler's and the 42040 Fire
          // Plane's, whose controls go on play while the parts they should move stay fast).
          if (goes() && !(pinTrial && !dragGoes(c))) for (const m of held) why.push(`${m.ref} is held by friction pins the control doesn't reach`);
          else {
            allFree ??= loaded.allFree(asLoaded.parts);
            for (const m of held) for (const pin of pinsToFree(allFree, m.part)) {
              freed.add(pin);
              noteFreed([pin], m.ref);
            }
            // Whether the part has come loose from what it's measured against.
            for (const m of held) {
              const loose = () => {
                const a = against(m.ref);
                return mech.bodyOf[a.part] !== a.body;
              };
              if (pinTrial && !withFreed(new Set(), loose)) for (const pin of byTrial(m.part, loose)) {
                freed.add(pin);
                noteFreed([pin], m.ref);
              }
            }
          }
        }
        if (freed.size) {
          use(loaded.read(asLoaded.parts, freed, slid));
          freedPins = Math.max(freedPins, freed.size);
        }
      }
      const whyBefore = why.length;
      for (const first of fn.first ?? []) {
        const p = part(first.control);
        if (first.slide) {
          const how = slideFirst(p, first.by);
          if (how) why.push(`${first.control}, slid first, ${how}`);
          continue;
        }
        // A driving ring is slid by hand, `by` LDU, to the click-in position nearest that.
        const slider = sliders.find((s) => s.part === p);
        if (slider) {
          const from = sliderPosition(placedNow(), table, slider);
          const to = nearestPosition(slider, from + first.by);
          if (to !== nearestPosition(slider, from)) shiftTo(new Map([[p, to]]));
          else why.push(`${first.control}, worked first, didn't shift`);
          continue;
        }
        const b = worked(p);
        const went = kin.parentLink(b) ? turn(b, first.by) : 0;
        if (Math.abs(went) < 0.9 * Math.abs(first.by)) why.push(`${first.control}, worked first, went ${round(went)} of ${first.by}`);
        // A catch it turned shifts its ring.
        const shifts = catchShifts(placedNow(), table, catches);
        if (shifts.size) shiftTo(shifts);
        // Otherwise, if it brought gears together or apart (the 952's harrow lowered onto its
        // power take-off), the mechanism is worked out afresh from where everything now is.
        else if (meshesChanged(mech, kin.poses)) use(loaded.read(placedNow(), freed, slid));
      }
      // A control the controls worked first left with no motion (a gearbox's lever shifted, so
      // that the control now drives what friction pins hold: the 42039 Race Car's engine cover):
      // its pins are found by trying them in the model as it now is (see pinTrial).
      if (FREE_PINS && pinTrial && (fn.first ?? []).length) {
        const c = part(ref);
        const goes = () => {
          const link = kin.parentLink(worked(c));
          return !(kin.frames.includes(worked(c)) || !link || kin.jointMotion(link.joint, false) === null);
        };
        if (!goes() && !dragGoes(c, true)) {
          const now = placedNow();
          const current = { parts, mech, kin };
          const pins = pinsByTrial(heldPins(mech, c, freed), (more) => {
            use(loaded.read(now, new Set([...freed, ...more]), slid));
            const went = goes();
            use(current);
            return went;
          });
          if (pins.length) {
            for (const pin of pins) freed.add(pin);
            noteFreed(pins, `${ref}, after its first steps`);
            use(loaded.read(now, freed, slid));
            freedPins = Math.max(freedPins, freed.size);
          }
        }
      }
      // Measured on the model as it is now, after any shift.
      const moves = (fn.moves ?? []).map(against);
      const stays = (fn.stays ?? []).map(against);
      const control = part(ref);
      const b = worked(control);
      // Its joint: the one it turns on, or else the slide it slides on (see slideOf), or else the
      // ball it turns on (see ballOf).
      const link = kin.parentLink(b) ?? (slideOf(b) >= 0 ? { parent: -1, joint: slideOf(b) } : ballOf(b) >= 0 ? { parent: -1, joint: ballOf(b) } : null);
      // Why it doesn't work, if it doesn't (see causes.ts). Told before anything else: a loose
      // part (the control, or one it should move or keep still), or a control worked first that
      // didn't go. A loose part rides along with its nearest neighbour, attached to nothing, so a
      // function that names one can't work, whatever the drag does: at most partly (the 8285's
      // wheels "rolling freely" on rims that sit on nothing).
      const loosePart = [control, ...moves.map((m) => m.part), ...stays.map((m) => m.part)].find((p) => mech.loose.includes(p));
      // A function that runs tracks must have them: looped paths of track links (see TRACK_SKIN),
      // one with a wheel that is a control of the function or a part it lists to move, and none
      // with no wheel at all. Read so, the links run round with the wheel, as the solver turns the
      // loop with it; without it they ride with whatever they touch, and the wheel turns alone
      // (decision 185: the 9391 Crawler Crane's tracks, placed link by link, were read as no
      // track, and its function passed), and a track with no wheel stays where it is.
      const runsTrack = (fn.mechanisms ?? []).some((m) => m.split(':')[0] === 'crawler-tracks');
      const tracks = mech.loops.filter((l) => TRACK_SKIN.test(l.path.skin));
      const wheelsHere = new Set([...controls.map((r) => mech.bodyOf[part(r)]), ...moves.map((m) => mech.bodyOf[m.part])]);
      const trackRead = !runsTrack || (tracks.some((l) => l.wheels.some((w) => wheelsHere.has(w.body))) && tracks.every((l) => l.wheels.length > 0));
      // A control worked first that didn't go its distance: turned less than 0.9 of `by`, slid
      // less than 0.9 of it, or a driving ring left at its click-in place (each says why above).
      // The function can't work then, whatever the drag does: before, the 9395 Pick-Up Tow Truck's
      // winch passed with its selector lever turned 0.07 rad of 0.3, the winch's parts moving
      // without it (2026-11-20).
      const firstShort = why.length > whyBefore;
      const early: Explained | null = loosePart !== undefined ? { cause: 'loose-part', detail: name(loosePart) } : firstShort ? { cause: 'first-failed' } : !trackRead ? { cause: 'track-not-read' } : null;
      if (!trackRead) why.push(tracks.length && tracks.every((l) => l.wheels.length > 0) ? 'no track is read round a control or a part the function lists' : tracks.length ? `${tracks.filter((l) => !l.wheels.length).length} of the ${tracks.length} tracks run round no wheel` : 'no track is read');
      const nothing = (explained: Explained) => ({ works: false, pushed: false, judged: 0, turned: [0, 0] as [number, number], still: moves.map((m) => m.ref), moved: [] as string[], something: false, rates: {}, expected: {}, off: [] as string[], back: [] as [number, number][], torn: [] as [number, number][], free: [] as boolean[], strayed: [] as string[], lock: null as [number, number, Stop][] | null, stop: [null, null] as (Halt | null)[], explained: explained as Explained | null, movedParts: [] as string[], explainStill: (() => explained) as (still: string[]) => Explained | null });
      if (kin.frames.includes(b) || !link) {
        why.push(`${ref} ${kin.frames.includes(b) ? 'is part of the frame' : 'has no joint to work'}`);
        return nothing(early ?? { cause: 'control-fixed' });
      }
      // How far the control is worked each way. A function whose parts would move too little
      // (the cause too-little) is worked again, further (see LONG_REACH), and judged then; it
      // still counts as having gone far enough at half its usual reach.
      let reach = mech.joints[link.joint].kind === 'slide' ? PUSH : REACH;
      const half = reach / 2;
      if (longShared && mech.joints[link.joint].kind !== 'slide') reach = LONG_REACH;
      if (fn.together) together = controls.map((r) => worked(part(r)));
      // What the function's text says is held is frozen, as a user would freeze it in the viewer
      // (Alt-click) before working the control.
      const heldNow = Array.isArray(fn.held) ? fn.held : (fn.held?.[ref] ?? []);
      kin.frozen = new Set(heldNow.map((r) => mech.bodyOf[part(r)]));
      const start = kin.snapshot();
      const startPoses = kin.poses.map((m) => m.clone());
      // Worked by a push, as the viewer would (see isPushed), or by a turn on its joint.
      const pushed = isPushed(b);
      const listed = [...moves, ...stays];
      // What the gears say, for listed parts measured against the frame (not those on the
      // control's own body, which turn with it whatever the gears do).
      const geared = gearRates(mech, (x) => kin.parentLink(x), b, together);
      const expected: Record<string, number> = {};
      for (const m of listed) if (m.body === kin.frameOf[mech.bodyOf[m.part]] && mech.bodyOf[m.part] !== b && geared.has(mech.bodyOf[m.part])) expected[m.ref] = sig(geared.get(mech.bodyOf[m.part])!);
      // The cause, from where the control starts: given the parts that didn't move and should
      // have, those that moved and shouldn't have, and how far the control went.
      const listedAs = (m: { ref: string; part: number; body: number }): Listed => ({ ref: m.ref, body: mech.bodyOf[m.part], against: m.body });
      // How the drag turns the control, for telling whether a part that should stay could have
      // (see causeOf): against what its shaft turns in (see housing), about its joint's axis.
      const dragOf = (body: number) => {
        const j = mech.joints[link.joint];
        if (j.kind !== 'revolute' || slideOf(body) >= 0 || ballOf(body) >= 0 || (j.bodyA !== body && j.bodyB !== body)) return undefined;
        return { against: kin.housing(body), axis: j.to.clone().sub(j.from).normalize().transformDirection(kin.poses[j.bodyA]) };
      };
      // A control on a slide or a ball, which has no parent in the tree, against what it slides
      // or turns on: against none, its motion read as nothing, and every such control as jammed.
      const otherEnd = (joint: number, body: number) => (mech.joints[joint].bodyA === body ? mech.joints[joint].bodyB : mech.joints[joint].bodyA);
      const explain = (still: string[], wrong: string[], turned: number): Explained =>
        early ?? causeOf(kin, { body: b, parent: link.parent >= 0 ? link.parent : otherEnd(link.joint, b), drag: dragOf(b) }, moves.filter((m) => still.includes(m.ref)).map(listedAs), stays.filter((x) => wrong.includes(x.ref)).map(listedAs), new Set(geared.keys()), Math.abs(turned) >= half, !pushed);
      if (causesOnly) {
        // As the check would have it: from the way its cause was judged from (see judged), and
        // of controls that share out the parts, only those whose way didn't work, each from the
        // parts it left still and moved (see movedBy, wrongBy): else the first control's cause
        // would stand for the function, whether it worked or not.
        const turnedBoth = prior!.turned?.[wi] ?? [];
        const judgedHere = prior!.judged?.[wi];
        const turnedHere = judgedHere === undefined ? Math.max(0, ...turnedBoth.map(Math.abs)) : Math.abs(turnedBoth[judgedHere] ?? 0);
        const wrongHere = prior!.wrongBy?.[wi] ?? prior!.moved ?? [];
        if (shared && prior!.movedBy) {
          const movedHere = prior!.movedBy[wi] ?? [];
          const farHere = turnedHere >= half || ((prior!.stop?.[wi] ?? [])[judgedHere ?? 0] === 'limit' && turnedHere > 1e-3);
          if (farHere && !wrongHere.length && (!(fn.moves ?? []).length || movedHere.length)) return { ...nothing(early ?? { cause: 'unknown' }), explained: null, explainStill: (left: string[]) => explain(left, [], turnedHere) };
          return nothing(explain((fn.moves ?? []).filter((m) => !movedHere.includes(m)), wrongHere, turnedHere));
        }
        return nothing(explain(prior!.still ?? [], wrongHere, turnedHere));
      }
      // How far the control really turns: against what its shaft turns in (see housing), not
      // just its joint's angle, which a shaft spinning back under it makes up without the
      // control turning at all (the 8865 Test Car's seats, on axles free in their holes).
      const slides = mech.joints[link.joint].kind === 'slide';
      // (A control that slides, against what it slides on: see slideOf; one on a ball, against
      // what it turns on: see ballOf.)
      const slidOn = slideOf(b) >= 0 ? mech.joints[slideOf(b)] : ballOf(b) >= 0 ? mech.joints[ballOf(b)] : null;
      const itself = { part: mech.bodies[b].parts[0], body: slidOn ? (slidOn.bodyA === b ? slidOn.bodyB : slidOn.bodyA) : kin.housing(b) };
      // The pistons in `moves`, each with its slider-crank (see sliderCranks): how far it should
      // slide in its cylinder is set by how far its crank turns, whatever turned the crank.
      const cranks = sliderCranks(mech, (x) => kin.parentLink(x));
      const pistons = moves.flatMap((m) => cranks.filter((sc) => sc.piston === mech.bodyOf[m.part]).slice(0, 1).map((sc) => ({ m, sc, in: { part: m.part, body: sc.cylinder } })));
      // A crank's angle against its housing (see line), from where it was built.
      const crankAngle = (c: number) => {
        const l = line(mech, (x) => kin.parentLink(x), c)!.joints;
        return l.reduce((sum, j) => sum + kin.jointAngles[j.joint] * Math.sign(j.axis.dot(l[0].axis)), 0);
      };
      // The listed rings a rotary catch (35188) holds. A ring moves only by a shift, after a turn,
      // so it has no rate of its own; turned at a rate, its catch moves it slowly all the same: the
      // 42129 Mercedes-Benz Zetros's catches turn 0.27 radians for each radian of the motor, and
      // must turn 0.91 to shift their rings. Such a ring left still is a slow part (see
      // slowPartsRule), and the longer turn counts it as moved once its catch would shift it.
      const rotaryRings = new Set(catches.filter((c) => c.rotary && moves.some((m) => m.part === c.ring.part)).map((c) => c.ring.part));
      // How fast, for each radian of the control, a rotary catch that holds the ring turned
      // against it, from the start to now (the fastest, if several hold it): 0 for any other part.
      const catchRate = (ring: number, turned: number) => {
        if (!rotaryRings.has(ring) || turned < 1e-6) return 0;
        const against = mech.bodyOf[ring];
        return Math.max(0, ...catches.filter((c) => c.rotary && c.ring.part === ring).map((c) => angle(relative(c.part, against, startPoses), relative(c.part, against, kin.poses)) / turned));
      };
      const bothWays = () => [1, -1].map((way) => {
        kin.restore(start);
        // How far each piston should slide, piece by piece, as its crank turns.
        let was = pistons.map((p) => pistonAt(p.sc, crankAngle(p.sc.crank)));
        // How far each went in the last piece: where it's heading is where it was and that again.
        const last = pistons.map(() => 0);
        const should = pistons.map(() => 0);
        // The longer turn (see LONG_REACH) goes only as far as it needs: past the usual reach,
        // it ends once the parts to move have moved. For a function whose controls share out the
        // parts, the parts this control moves at all (by more than STIRRED) must have moved, and
        // at least one must. Turned the whole three turns each way, the 42100 Liebherr R 9800's
        // function 6 took over an hour.
        const enough = (turned: number) => {
          if (reach !== LONG_REACH || Math.abs(turned) < REACH) return false;
          // A ring a rotary catch holds counts as moved once the catch has turned far enough to
          // shift it (see rotaryRings).
          const shiftedNow = rotaryRings.size ? new Map([...catchShifts(placedNow(), table, catches)].filter(([ring]) => rotaryRings.has(ring))) : new Map<number, number>();
          const done = moves.filter((m) => moved(m, startPoses, shiftedNow)).length;
          if (!shared) return done === moves.length;
          const stirred = moves.filter((m) => moved(m, startPoses, shiftedNow, STIRRED)).length;
          return done > 0 && done === stirred;
        };
        const measure = (amount: number, parts: { part: number; body: number }[], after = () => {}) => (pushed ? pushMeasuring(b, control, { reach: amount }, parts, after) : slideOf(b) >= 0 ? slideMeasuring(b, amount, parts, after) : ballOf(b) >= 0 ? ballMeasuring(b, control, amount, parts, after) : { ...turnMeasuring(b, amount, parts, after, enough), pushed: null });
        // Which parts to move got MOVED or more from their start at some step (see ON_THE_WAY).
        const gotThere = moves.map(() => false);
        // With --stops: the first pair of parts the viewer's collision test finds meeting, and how
        // far the control had turned then, against what its shaft turns in (or slid).
        const watching = stopsReport || collide ? collisionsNow() : null;
        stopping = collide ? watching : null;
        stoppedBy = null;
        const stop: { met: { pair: [number, number]; at: number } | null } = { met: null };
        const controlNow = () => {
          const [from, to] = [relative(itself.part, itself.body, startPoses), relative(itself.part, itself.body, kin.poses)];
          return slides ? at[itself.part].clone().applyMatrix4(to).distanceTo(at[itself.part].clone().applyMatrix4(from)) : angle(from, to);
        };
        const measured = measure(way * reach, [...listed, itself, ...pistons.map((p) => p.in)], () => {
          // With the stop on, a step that met parts was undone: the pair is noted where the control
          // then stands. Without it (--stops alone), the first overlap is noted as it comes.
          if (collide && stoppedBy && !stop.met) stop.met = { pair: stoppedBy, at: controlNow() };
          else if (!collide && watching && !stop.met) {
            const hit = watching.check(placedNow().map((p) => p.matrix));
            if (hit) stop.met = { pair: hit, at: controlNow() };
          }
          if (ON_THE_WAY) moves.forEach((m, k) => (gotThere[k] ||= moved(m, startPoses, new Map())));
          const now = pistons.map((p, k) => pistonAt(p.sc, crankAngle(p.sc.crank), was[k] === null ? undefined : was[k]! + last[k]));
          now.forEach((x, k) => {
            should[k] += x === null || was[k] === null ? NaN : Math.abs(x - was[k]!);
            last[k] = x === null || was[k] === null ? 0 : x - was[k]!;
          });
          was = now;
        });
        const went = measured.went;
        // A stop on the first step, which no step after it notes: where the control stands.
        if (collide && stoppedBy && !stop.met) stop.met = { pair: stoppedBy, at: controlNow() };
        // A guard: a held part doesn't turn against what its shaft turns in, as a frozen part is
        // held (see holds in constraints/holds.ts). It should never be noted.
        for (const r of heldNow) {
          const held = mech.bodyOf[part(r)];
          if (!kin.parentLink(held)) continue;
          const h = kin.housing(held);
          const against = (poses: Matrix4[]) => poses[h].clone().invert().multiply(poses[held]);
          const note = `${r} is held, but turned against what its shaft turns in`;
          if (angle(against(startPoses), against(kin.poses)) > 1e-3 && !why.includes(note)) why.push(note);
        }
        // The joint's own turn, to work it back again.
        const joint = measured.turned;
        const turned = slides ? joint : Math.sign(joint) * went[listed.length][0];
        if (stop.met) collisionStops.push([wi, way, stop.met.pair[0], stop.met.pair[1], round(stop.met.at), round(Math.abs(turned))]);
        const shifted = catchShifts(placedNow(), table, catches);
        const rates: Record<string, [number, number]> = {};
        listed.forEach((m, k) => (rates[m.ref] = Math.abs(turned) > 1e-6 ? [sig(went[k][0] / Math.abs(turned)), sig(went[k][1] / Math.abs(turned))] : [0, 0]));
        // A rate is the part's turning, or its sliding if it slides on its joint.
        const slidesOn = (m: (typeof listed)[number]) => kin.parentLink(mech.bodyOf[m.part]) !== null && mech.joints[kin.parentLink(mech.bodyOf[m.part])!.joint].kind === 'slide';
        const rateOf = (m: (typeof listed)[number]) => rates[m.ref][slidesOn(m) ? 1 : 0];
        // A part geared so far down that, as far as the control turned, its gears move it less
        // than MOVED, is judged by its rate instead: it moved if it went at the rate its gears give
        // it (within RATE_OFF). Only a part whose gears give it a rate (`expected`); the rest are
        // judged by how far they went.
        const slowGeared = (m: (typeof listed)[number]) => {
          const rate = expected[m.ref];
          if (!(rate > 0) || Math.abs(turned) < 0.01) return false;
          const least = slidesOn(m) ? MOVED : (MOVED * Math.PI) / 180;
          return rate * Math.abs(turned) < least && Math.abs(rateOf(m) - rate) <= RATE_OFF * rate;
        };
        const still = moves.filter((m, k) => !moved(m, startPoses, shifted) && !slowGeared(m) && !gotThere[k]).map((m) => m.ref);
        // Whether every part left still moves with the control, slowly (see slowPartsRule).
        const slow = still.length > 0 && still.every((ref) => {
          const m = listed.find((l) => l.ref === ref);
          // Turning or sliding, whichever it does: a piston against its cylinder slides, whatever
          // its own joint in the tree (the 8258's p2167, 0.2 LDU for each radian).
          return m !== undefined && (Math.max(...rates[ref].map(Math.abs)) > SLOW_RATE || catchRate(m.part, Math.abs(turned)) > SLOW_RATE);
        });
        // Whether the control itself moved (see controlMovedRule).
        const controlMoved = Math.abs(turned) >= 0.01 || (measured.pushed !== null && Math.abs(went[listed.length][1]) >= 0.01);
        const wrong = stays.filter((s) => moved(s, startPoses, shifted)).map((s) => s.ref);
        const off = listed.filter((m) => m.ref in expected && Math.abs(turned) >= 0.01 && Math.abs(rateOf(m) - expected[m.ref]) > RATE_OFF * expected[m.ref]).map((m) => m.ref);
        // Each piston's slide in its cylinder, against what its crank's turn says, both for
        // each radian the control turned.
        const strokes: Record<string, number> = {};
        pistons.forEach((p, k) => {
          if (!Number.isFinite(should[k]) || Math.abs(turned) < 0.01) return;
          strokes[p.m.ref] = sig(should[k] / Math.abs(turned));
          const slid = went[listed.length + 1 + k][1];
          if (Math.abs(slid - should[k]) > RATE_OFF * should[k] + STROKE_OFF) off.push(p.m.ref);
        });
        // There and back: worked back as far as it went, as a new drag.
        const there = kin.snapshot();
        if (measured.pushed) {
          if (measured.pushed.length > 0) pushMeasuring(b, control, { back: measured.pushed }, []);
        } else if (slideOf(b) >= 0) {
          if (Math.abs(joint) >= 0.01) slideMeasuring(b, -joint, []);
        } else if (ballOf(b) >= 0) {
          if (Math.abs(joint) >= 0.01) ballMeasuring(b, control, -joint, [], () => {}, true);
        } else if (Math.abs(joint) >= 0.01) turn(b, -joint);
        const most = furthest(startPoses);
        const apart = furthest(startPoses, true);
        const free = apart.ldu > BACK && freeBack(startPoses, b);
        kin.restore(there);
        const back: [number, number] = [round(most.ldu), round(most.degrees)];
        const torn: [number, number] = [round(apart.ldu), round(apart.degrees)];
        const strayed = most.ldu > BACK || most.degrees > BACK ? [name(most.part)] : [];
        // For a function whose controls share out the parts, a way does its share if it moves
        // at least one of them (if it lists any).
        // Far enough: half the reach, or as far as it can go, to an end stop from part data (a
        // slide's travel, such as a shock absorber's, or the end of a rack's teeth), however short
        // that is: an arm built at one end of its shock's travel moves one way only, and that counts.
        // Or to the end of a linkage's travel (decisions 104 and 106, and the orchestrator's answer after them): a dead point reached
        // once a part the function lists to move has itself turned by half the reach or more, as
        // the 9392 Quad Bike's hubs do well before its handlebars turn that far. No test at the
        // stop tells the real end of a linkage's travel from that of one read wrongly; the bound
        // on what the function shows does: a jam shows at the start of a turn, not after a listed
        // part has turned that far.
        // Only for a control, not a motor, that turns a link of a loop itself (see onALoop in causes.ts): one that reaches
        // the loop only through gears, a worm, a chain or a motor turns on in the real set past
        // where the loop stops (a winch knob slips, a crank goes over its dead point, a motor
        // stalls), so its stop stays a dead point (decision 115).
        const endOfTravel = DEAD_POINT_TRAVEL && measured.halt === 'dead point' && moves.some((_, k) => went[k][0] >= half) && mech.roles[control] !== 'motor' && onALoop(mech, link.joint);
        const halt: Halt | null = endOfTravel ? 'end of travel' : measured.halt;
        const farEnough = Math.abs(turned) >= half || endOfTravel || (measured.halt === 'limit' && Math.abs(turned) > 1e-3);
        const share = farEnough && !wrong.length && (!moves.length || still.length < moves.length);
        return { turned, still, moved: wrong, rates, expected: { ...expected, ...strokes }, off, back, torn, free, strayed, halt, slow, controlMoved, works: shared ? share : farEnough && !still.length && !wrong.length };
      });
      // The better way: one that works, or else the one with fewer wrong parts that went further.
      // Two ways that went the same distance are a tie, and the tie goes to the first way (the sort
      // keeps the order of equals). "The same" is within TIE (radians, or LDU for a slide or a push):
      // a tolerance at rounding level, not a tuned threshold. Both ways of a free control turn the
      // full reach, and the last bits of rounding (which the working set changes, decision 272)
      // must not choose which way's rates are stored.
      const TIE = 1e-9;
      const further = (x: { turned: number }, y: { turned: number }) => (Math.abs(Math.abs(y.turned) - Math.abs(x.turned)) > TIE ? Math.abs(y.turned) - Math.abs(x.turned) : 0);
      const bestOf = (both: ReturnType<typeof bothWays>) => [...both].sort((x, y) => Number(y.works) - Number(x.works) || x.still.length + x.moved.length - (y.still.length + y.moved.length) || further(x, y))[0];
      let each = bothWays();
      kin.restore(start);
      let best = bestOf(each);
      // Parts the control moves too slowly to see over the usual reach are too-little, not
      // part-fixed or not-driven (see slowPartsRule).
      const slowly = (e: Explained | null): Explained | null => (slowPartsRule && (e?.cause === 'part-fixed' || e?.cause === 'not-driven') && best.slow ? { ...e, cause: 'too-little' } : e);
      let explained = best.works ? null : slowly(explain(best.still, best.moved, best.turned));
      // Parts geared so far down that the usual reach moves them too little: worked again, up
      // to LONG_REACH each way, a limit met on the way ending the turn as usual. Not a slide's
      // control, whose reach is in LDU.
      if (explained?.cause === 'too-little' && !slides) {
        reach = LONG_REACH;
        each = bothWays();
        kin.restore(start);
        best = bestOf(each);
        explained = best.works ? null : slowly(explain(best.still, best.moved, best.turned));
      }
      kin.frozen = new Set();
      together = [];
      const something = each.some((w) => (!controlMovedRule || w.controlMoved) && (Math.abs(w.turned) >= 0.01 || w.still.length < moves.length));
      // A function that names a loose part can't work, whatever the drag did (see loosePart), nor
      // one that runs a track not read round its wheel (see trackRead), nor one whose control worked
      // first didn't go its distance (see firstShort).
      const works = best.works && loosePart === undefined && trackRead && !firstShort;
      if (best.works && !works) explained = explain(best.still, best.moved, best.turned);
      // Steering's stops (see LOCK): each way from where it started, turned until it stops.
      // A wheel's axle against the frame, seen from above (LDraw's y is down), in the given poses.
      const heading = (j: number, poses: Matrix4[]) => {
        const x = mech.joints[j];
        const d = x.to.clone().sub(x.from).normalize().transformDirection(poses[0].clone().invert().multiply(poses[x.bodyA]));
        return new Vector3(d.x, 0, d.z).normalize();
      };
      // How upright a body's joint is (the y of its axis), or null if it doesn't turn on one.
      const upright = (body: number) => {
        const l = kin.parentLink(body);
        if (!l || mech.joints[l.joint].kind !== 'revolute') return null;
        const j = mech.joints[l.joint];
        return Math.abs(j.to.clone().sub(j.from).normalize().transformDirection(startPoses[j.bodyA]).y);
      };
      const steeredBy = moves.flatMap((m) => {
        const body = mech.bodyOf[m.part];
        const y = upright(body);
        if (m.body !== 0 || body === b || y === null) return [];
        const joint = kin.parentLink(body)!.joint;
        if (y <= Math.sin(LEVEL)) return [() => Math.acos(Math.min(1, Math.abs(heading(joint, kin.poses).dot(heading(joint, startPoses)))))];
        const on = upright(kin.parentLink(body)!.parent);
        if (y >= Math.cos(LEVEL) && !(on !== null && on >= Math.cos(LEVEL))) return [() => angle(relative(m.part, 0, startPoses), relative(m.part, 0, kin.poses))];
        return [];
      });
      const lock = locks && !slides && steeredBy.length && fn.mechanisms?.some((m) => STEERING.includes(m.split(':')[0]))
        ? [1, -1].map((way) => {
            kin.restore(start);
            // The parts' shapes, if they match the model's parts (but a path's, a chain's links,
            // which only show where it runs, as in the viewer).
            const known = shapesHere();
            const collisions = known ? new Collisions(parts.map((p, i) => (p.path ? [] : known[i].shape)), mech.bodyOf, connectedPairs(mech), placedNow().map((p) => p.matrix)) : null;
            // A loose part never stops a motion, here as in the viewer (see Collisions.ignored).
            if (collisions) collisions.ignored = new Set(mech.loose);
            let met = false;
            const allowed = () => {
              if (kin.atLimit() !== null) return false;
              met = collisions !== null && collisions.check(placedNow().map((p) => p.matrix)) !== null;
              return !met;
            };
            kin.holdWhatTheDragDoesntNeed(b, () => kin.jointMotion(link.joint) !== null, link.joint);
            let turned = 0;
            let why: Stop = 'free';
            while (Math.abs(turned) < LOCK - 1e-9) {
              const piece = way * Math.min(PIECE, LOCK - Math.abs(turned));
              const step = kin.turnJoint(link.joint, piece, allowed);
              turned += step;
              if (Math.abs(step) < Math.abs(piece) - 1e-9) {
                why = met ? 'meets' : kin.atLimit() !== null ? 'limit' : 'stuck';
                break;
              }
            }
            kin.letGoAfterDrag();
            const most = Math.max(...steeredBy.map((f) => f()));
            return [round((most * 180) / Math.PI), round(turned), why] as [number, number, Stop];
          })
        : null;
      const movedParts = moves.filter((m) => !best.still.includes(m.ref)).map((m) => m.ref);
      // Why the parts no control moved didn't move, for a function whose controls share them out.
      const explainStill = (left: string[]) => explain(left, best.moved, best.turned);
      return { works, movedParts, explainStill, pushed, judged: each.indexOf(best), turned: each.map((w) => round(w.turned)) as [number, number], still: best.still, moved: best.moved, something, rates: best.rates, expected: best.expected, off: best.off, back: each.map((w) => w.back), torn: each.map((w) => w.torn), free: each.map((w) => w.free), strayed: each.flatMap((w) => w.strayed), lock, stop: each.map((w) => w.halt), explained };
    };
    const all = fn.together ? controls.slice(0, 1) : controls;
    // With --way (see SPLIT_WAYS_OVER), only that control, its share written for the process that
    // put it to work, to put together with the others'.
    if (onlyWay !== null) {
      const { explainStill, ...share } = workWay(all[onlyWay], onlyWay);
      return { result: 'error', way: { ...share, why, freed: freedPins }, ...(collisionStops.length ? { collisionStops } : {}) };
    }
    let ways = all.map(workWay);
    let combined = combineWays(fn, ways, why, freedPins, (still) => ways[0].explainStill(still), causesOnly ? prior : undefined)!;
    // Controls that share out the parts, whose cause together is too-little: each worked the
    // longer turn, and judged then, as one control is (see slowPartsRule).
    if (slowPartsRule && shared && !causesOnly && combined?.cause === 'too-little') {
      longShared = true;
      ways = all.map(workWay);
      longShared = false;
      combined = combineWays(fn, ways, why, freedPins, (still) => ways[0].explainStill(still))!;
    }
    // The collisions that stopped a way (collisionStops), beside the result.
    // A function whose kinds all turn without end (see endless.ts) works at most partly where a
    // collision stopped a control that is itself a part that turns without end, a wheel, sprocket
    // or shaft (endlessPart; decisions 279 and 282 of 2026-11-21), however far its parts moved
    // first: a wheel that rolls doesn't stop, so the stop is a fault, as the viewer sweep judges it.
    // A lever stopped (the 8063's) is at the end of its travel, whatever the function's kinds.
    // What tells such a part from a lever is the part itself (endlessPart: its role, else its LDraw
    // title), not its joint: a wheel and a lever both turn on a revolute joint, and the 8063's lever
    // is a connector turning on its own axle. A function with several controls or ways of which only
    // some are stopped so is at most partly too: one stopped wheel is one the user sees stop.
    const endless = endlessKinds(fn.mechanisms).endless;
    const controlRefs = [fn.control!].flat();
    const withCollisions = <T extends { result?: Result; cause?: Cause; detail?: string }>(r: T): T => {
      if (!collisionStops.length) return r;
      const judged = endless ? collisionStops.find(([wi]) => controlRefs[wi] !== undefined && endlessPart(parts[part(controlRefs[wi])].name)) : undefined;
      const stopped = judged && r.result === 'works' ? { result: 'partly' as Result, cause: 'stopped-endless' as Cause, detail: `${controlRefs[judged[0]]}: ${name(judged[2])} against ${name(judged[3])}` } : {};
      return { ...r, ...stopped, collisionStops };
    };
    // A function that doesn't work as read, whose control moves only together with a bigger body
    // that friction pins hold it in (the 42082's cab door, fused to the cab, so that its drag slews
    // the cab): worked again with those pins freed, as a user who sees that would press it with
    // Shift (see pinsForShift; decision 173 of 2026-11-17). Kept only if it comes out better, and
    // then it says so (`shiftPressed`). A function that works as read is never tried.
    if (combined && !causesOnly && shiftFreed.size === 0 && combined.result !== 'works' && combined.result !== 'error') {
      use(asLoaded);
      kin.reset();
      allFree ??= loaded.allFree(asLoaded.parts);
      // A function whose first steps slide a part (decision 206 of 2026-11-18) is pressed as it
      // stands after them: the 42078's container doors are free of their lock bars only then.
      let pressed = allFree;
      if ((fn.first ?? []).some((f) => f.slide)) {
        freed = new Set();
        slid = new Set();
        for (const f of fn.first!) if (f.slide) slideFirst(part(f.control), f.by);
        pressed = loaded.allFree(placedNow());
      }
      const pins = new Set<number>();
      for (const ref of all) {
        const c = part(ref);
        const body = mech.roles[c] === 'motor' ? motorOutput(mech, c) : mech.bodyOf[c];
        const link = kin.parentLink(body);
        const moves = !kin.frames.includes(body) && link !== null && kin.jointMotion(link.joint, false) !== null;
        if (moves && heldInBodyByPins(mech, pressed, c)) for (const pin of pinsForShift(mech, pressed, c).pins) pins.add(pin);
      }
      if (pins.size) {
        const [whyBefore, freedBefore] = [why.length, freedPins];
        // The collisions that stopped a way are the try's whose result is kept.
        const stopsBefore = collisionStops.length;
        shiftFreed = pins;
        const again = combineWays(fn, all.map(workWay), why, freedPins, null);
        shiftFreed = new Set();
        if (again && RANK[again.result] < RANK[combined.result]) {
          collisionStops.splice(0, stopsBefore);
          return withCollisions({ ...again, shiftPressed: [...pins].sort((a, b) => a - b) });
        }
        why.length = whyBefore;
        freedPins = freedBefore;
        collisionStops.length = stopsBefore;
      }
    }
    // The pins freed, each with the part it was freed for, beside the count (`freed`).
    const withFreedFor = <T extends object>(r: T) => (freedFor.size ? { ...r, freedFor: [...freedFor].sort((a, b) => a[0] - b[0]).map(([pin, forRef]) => ({ pin: name(pin), for: forRef })) } : r);
    return combined ? withFreedFor(withCollisions(combined)) : combined;
  };

  // Each function's entry says how long it took (`seconds`), so a slow set shows which function
  // Each function's entry says how long it took (`seconds`), so a slow set shows which function
  // is slow. KINEBRICK_TIMES=1 says it as the set goes, too.
  const checked = functions.map((fn, i): Checked => {
    const started = Date.now();
    let found: Checked;
    kin.pivoted = null;
    kin.onPlay = 0;
    try {
      found = checkOne(fn, priors[i]);
      if (kin.onPlay > 0 && found.result !== 'skipped' && found.result !== 'not checked') found = { ...found, onPlay: round(kin.onPlay) };
      const p = kin.pivoted as { slide: number; rise: number; tread: number } | null;
      if (p && found.result !== 'skipped' && found.result !== 'not checked') found = { ...found, pivoted: { slide: round(p.slide), rise: round(p.rise), tyre: name(mech.treads[p.tread].part) } };
    } catch (err) {
      found = { result: 'error', cause: 'bad-reference', why: [(err as Error).message] };
    }
    const seconds = Math.round((Date.now() - started) / 100) / 10;
    if (process.env.KINEBRICK_TIMES === '1') console.error(`function ${i + 1}: ${found.result}, ${seconds} s`);
    // The working set's counts for this function (decision 266), then reset: printed only when
    // KINEBRICK_WORKING_SET=1 asks for them, though the set is on without it.
    if (process.env.KINEBRICK_WORKING_SET === '1') {
      const st = Kinematics.wsShared;
      const beyond = st.compared.filter((c) => c.pose > 1e-6 || c.angle2 > 1e-6);
      console.error(`ws-stats function ${i + 1}: ${JSON.stringify({ small: st.small, made: st.made, excluded: st.excluded, fallback: st.fallback, compared: st.compared.length, beyond: beyond.length, worstPose: Math.max(0, ...st.compared.map((c) => c.pose)), worstAngle: Math.max(0, ...st.compared.map((c) => c.angle2)), turnedApart: st.compared.filter((c) => Math.abs(c.small - c.full) > 1e-12).length, worst: beyond.sort((x, y) => y.pose - x.pose)[0] ?? null })}`);
      if (st.shadow.length) {
        // The shadow: the most the set and the full calculation came apart over the turn, where, and
        // for each drag whether it was still growing at its end; and the calls that turned apart.
        const most = st.shadow.reduce((m, s) => (s.ldu > m.ldu ? s : m), st.shadow[0]);
        const mostRad = Math.max(...st.shadow.map((s) => s.rad));
        const byDrag = new Map<number, typeof st.shadow>();
        for (const s of st.shadow) byDrag.set(s.drag, [...(byDrag.get(s.drag) ?? []), s]);
        const growing = [...byDrag.values()].filter((list) => list.length > 1 && list[list.length - 1].ldu >= Math.max(...list.map((s) => s.ldu)) && list[list.length - 1].ldu > list[list.length - 2].ldu).length;
        const apart = st.shadow.filter((s) => Math.abs(s.small - s.full) > 1e-12);
        // The parts of the body that came apart most (by a joint's point, and by turning): the first six.
        const partsOf = (body: number | undefined) => mech.bodyOf.flatMap((bb: number, pp: number) => (bb === body ? [name(pp)] : [])).slice(0, 6);
        console.error(`ws-shadow function ${i + 1}: ${JSON.stringify({ calls: st.shadow.length, drags: byDrag.size, ldu: most.ldu, rad: mostRad, at: most.at, growingAtEnd: growing, turnedApart: apart.length, firstApart: apart[0] ?? null, parts: partsOf(most.body), radParts: partsOf(st.shadow.reduce((m, s) => (s.rad > m.rad ? s : m), st.shadow[0]).radBody) })}`);
      }
      Object.assign(st, { small: 0, made: 0, excluded: 0, fallback: { short: 0, ring: 0, played: 0, holds: 0, audit: 0 }, compared: [], shadow: [] });
    }
    return { ...found, seconds };
  });
  return { checked, loose: mech.loose.map(name), errata: loaded.errata };
}

// One control's share of a function's check (see checkModel's workWay), as data: what a process
// checking only that control (--way) writes, for the process that put it to work.
interface WayShare {
  works: boolean;
  movedParts: string[];
  pushed: boolean;
  judged: number;
  turned: [number, number];
  still: string[];
  moved: string[];
  something: boolean;
  rates: Record<string, [number, number]>;
  expected: Record<string, number>;
  off: string[];
  back: [number, number][];
  torn: [number, number][];
  free: boolean[];
  strayed: string[];
  lock: [number, number, Stop][] | null;
  stop: (Halt | null)[];
  explained: Explained | null;
}

// A function's result from its controls' shares, in order, with the notes (`why`) they left and
// the most friction pins any freed. `explainStill` says why parts no control moved are still,
// from the first control's working, for a function whose controls share out its parts; null
// where that working is gone (its share came from another process): then, if it's needed, this
// is null, and the function is checked again whole. With `prior` (--causes), only the cause is
// found afresh.
function combineWays(fn: Fn, ways: WayShare[], why: string[], freedPins: number, explainStill: ((still: string[]) => Explained | null) | null, prior?: Checked): Checked | null {
  const controls = [fn.control!].flat();
  const shared = controls.length > 1 && !fn.together;
  // Controls that share out the parts: the parts none of them moved are still.
  const movedByAny = new Set(ways.flatMap((w) => w.movedParts));
  const still = shared ? (fn.moves ?? []).filter((m) => !movedByAny.has(m)) : [...new Set(ways.flatMap((w) => w.still))];
  // The cause is that of the first control that doesn't work.
  const found = ways.find((w) => w.explained)?.explained;
  if (!found && shared && still.length && !explainStill) return null;
  const first = found ?? (shared && still.length ? explainStill!(still) : undefined);
  const explained = first ? { cause: first.cause, ...(first.detail ? { detail: first.detail } : {}) } : {};
  if (prior) {
    const kept: Checked = { ...prior };
    delete kept.cause;
    delete kept.detail;
    return { ...kept, ...explained };
  }
  const result: Result = ways.every((w) => w.works) && !(shared && still.length) ? 'works' : ways.some((w) => w.something) ? 'partly' : 'no';
    const wrong = [...new Set(ways.flatMap((w) => w.moved))];
  const off = [...new Set(ways.flatMap((w) => w.off))];
  const strayed = [...new Set(ways.flatMap((w) => w.strayed))];
  const expected = ways.some((w) => Object.keys(w.expected).length) ? { expected: ways.map((w) => w.expected) } : {};
  return {
    result,
    turned: ways.map((w) => w.turned),
    ...(still.length ? { still } : {}),
    ...(wrong.length ? { moved: wrong } : {}),
    rates: ways.map((w) => w.rates),
    ...expected,
    ...(off.length ? { wrong: off } : {}),
    back: ways.map((w) => w.back),
    torn: ways.map((w) => w.torn),
    ...(ways.some((w) => w.torn.some(([ldu]) => ldu > BACK)) && ways.every((w) => w.torn.every(([ldu], k) => ldu <= BACK || w.free[k])) ? { freeTurned: true } : {}),
    ...(strayed.length ? { strayed } : {}),
    ...(ways.some((w) => w.lock) ? { lock: ways.map((w) => w.lock ?? []) } : {}),
    ...(why.length ? { why: [...new Set(why)] } : {}),
    ...(ways.some((w) => w.stop.some((h) => h)) ? { stop: ways.map((w) => w.stop) } : {}),
    ...(ways.some((w) => w.pushed) ? { pushed: ways.map((w) => w.pushed) } : {}),
    ...(freedPins ? { freed: freedPins } : {}),
    ...(shared ? { movedBy: ways.map((w) => w.movedParts) } : {}),
    ...(shared && wrong.length ? { wrongBy: ways.map((w) => w.moved) } : {}),
    ...(result === 'works' ? {} : { judged: ways.map((w) => w.judged) }),
    ...(result === 'works' ? {} : explained),
  };
}

// How each result ranks, best first, for telling better from worse.
const RANK: Record<Result, number> = { works: 0, partly: 1, no: 2, error: 3, skipped: 4, 'not checked': 4 };

// What's better or worse in a set's functions than it was before (`was`, its generated
// functions then): a result, a part moving by the wrong amount, or not coming back.
function changes(functions: { does: string }[], was: Checked[], now: Checked[]): string[] {
  const lines: string[] = [];
  now.forEach((c, i) => {
    const before = was[i];
    const what = `function ${i + 1} (${functions[i].does.slice(0, 50)}…)`;
    if (!before) return;
    if (RANK[c.result] < RANK[before.result]) lines.push(`better: ${what} ${before.result} → ${c.result}`);
    if (RANK[c.result] > RANK[before.result]) lines.push(`worse: ${what} ${before.result} → ${c.result}`);
    // Only once both were measured for amounts, and neither is held (a held record keeps its
    // amounts in `found`; see holds.ts).
    if (before.rates && !('hold' in c) && !('hold' in before)) {
      const [wrongBefore, wrongNow] = [before.wrong?.length ?? 0, c.wrong?.length ?? 0];
      if (wrongNow !== wrongBefore) lines.push(`${wrongNow < wrongBefore ? 'better' : 'worse'}: ${what} ${wrongNow} parts by the wrong amount, had ${wrongBefore}`);
      // (By the ways worked that leave a part out of place, not the parts named: see ratchet.ts.)
      const notBack = (x: Checked) => (x.back ?? []).flat().filter(([ldu, degrees]) => ldu > BACK || degrees > BACK).length;
      const [backBefore, backNow] = [notBack(before), notBack(c)];
      if (backNow !== backBefore) lines.push(`${backNow < backBefore ? 'better' : 'worse'}: ${what} ${backNow} ways not back, had ${backBefore}`);
    }
  });
  return lines;
}

// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const one = args.indexOf('--one'); // (internal) check this one set's file and print what it found
const wayAt = args.indexOf('--way'); // (internal) with --only, only this control, by its place in the list
const onlyWay = wayAt >= 0 ? Number(args[wayAt + 1]) : null;
// A folder the run's processes share (KINEBRICK_SHAPES_SHOWN, made by the run), where each model's
// parts with no shape are marked once shown: the first process that reads a model says them, and
// the others, checking the same set's other functions, don't. A process run by hand says them.
const SHOWN = process.env.KINEBRICK_SHAPES_SHOWN;
function firstToShow(model: string): boolean {
  if (!SHOWN) return true;
  try {
    closeSync(openSync(join(SHOWN, encodeURIComponent(model)), 'wx'));
    return true;
  } catch {
    return false;
  }
}
if (one >= 0) {
  const set = JSON.parse(readFileSync(args[one + 1], 'utf-8'));
  // Read as the viewer reads the model: a set's file with its signed errata, which may add parts.
  if (locks || stopsReport || collide) for (const m of new Set<string>([set.curated.model, ...set.curated.functions.flatMap((fn: Fn) => (fn.model ? [fn.model] : []))])) {
    const read = readParts(m, m.startsWith('omr/'));
    const shapes = await partShapes(m, read.text, read.parts);
    shapesOf.set(m, shapes);
    // The parts with no shape, each with its reason, so none goes without its collision test unseen;
    // once a model in a run, not once for each process a set is checked in (see SHOWN).
    const empty = read.parts.flatMap((p, i) => (shapes[i]?.empty ? [`${i} ${p.name} (${shapes[i].empty})`] : []));
    if (empty.length && firstToShow(m)) console.error(`${m}: ${empty.length} parts with no shape: ${empty.join(', ')}`);
    if (stopsReport || collide) {
      const file = `data/collisions/${keptFileName(m)}.json`;
      const kept = existsSync(file) ? JSON.parse(readFileSync(file, 'utf-8')) : null;
      const release = JSON.parse(readFileSync('data/collisions/library.json', 'utf-8')).release;
      keptNearOf.set(m, kept && kept.key === (await collisionKey(read.parts, release)) ? kept.near : null);
    }
  }
  const onlyAt = args.indexOf('--only'); // (internal) only this function, by its place in the list
  const found = await check(set, onlyAt >= 0 ? Number(args[onlyAt + 1]) : null);
  // With the most memory it took (see check-pool.ts), for the next run to expect. Let the output
  // drain before the process ends: a pipe takes it in pieces.
  process.stdout.write(JSON.stringify({ ...found, peak: peakMb() }), () => process.exit(0));
} else {
  await main();
}

async function main() {
  const jobsAt = args.indexOf('--jobs');
  const jobs = jobsAt >= 0 ? Number(args[jobsAt + 1]) : Math.max(1, Math.floor(availableParallelism() / 2));
  const limitAt = args.indexOf('--limit');
  const slowOnly = args.includes('--slow');
  const limit = limitAt >= 0 ? Number(args[limitAt + 1]) : slowOnly ? SLOW_LIMIT_MINUTES : LIMIT_MINUTES;
  const named = args.filter((a, i) => !a.startsWith('--') && !['--jobs', '--limit'].includes(args[i - 1]));
  const filters = args.includes('--quick') ? QUICK : named;
  // Whether a set's file is one of those named: by its whole name if the name has a "-" (855-1,
  // not 8855-1), else by its number in full (855: 855-1 and 855-2, not 8855-1).
  const isNamed = (f: string) => filters.some((x) => (x.includes('-') ? f === `${x}.json` : f.split('-')[0] === x));
  if (args.includes('--lock')) process.env.KINEBRICK_CHECK_LOCK = '1';
  if (args.includes('--stops')) process.env.KINEBRICK_CHECK_STOPS = '1';
  const causes = args.includes('--causes');
  if (causes) process.env.KINEBRICK_CAUSES = '1';
  // With the errata not yet signed off applied too (see src/errata.ts), to show a set before and
  // after: what each function now does against its stored result is printed, and nothing is
  // written, since a result checked so is never the set's own.
  const proposed = args.includes('--proposed');
  if (proposed) process.env.KINEBRICK_PROPOSED = '1';
  const commit = execSync('git rev-parse --short HEAD').toString().trim();
  // No shell, so the pathspec isn't left quoted by Windows' cmd.
  const uncommitted = execFileSync('git', ['status', '--porcelain', '--', 'src', 'data', ':!data/sets']).toString().trim() !== '';
  const date = new Date().toISOString().slice(0, 10);
  // Checked with holds rather than least motion (KINEBRICK_LEAST=0; see docs/least-motion.md).
  const holds = !experiments.leastMotion;
  // The results held by hand (see holds.ts).
  const heldResults = readHolds();

  // The sets with functions, slowest first, by how long each took the last time (a set that timed
  // out before any), so that the longest set starts at once rather than last, on its own: then
  // the whole check takes about as long as its slowest set. A set not timed yet goes by its
  // model's size, biggest first.
  const took = (s: { data: { generated?: { seconds?: number; timedOut?: number } } }) => (s.data.generated?.timedOut ? Infinity : (s.data.generated?.seconds ?? -1));
  const withFunctions = readdirSync(SETS_DIR)
    .filter((f) => f.endsWith('.json') && (filters.length === 0 || isNamed(f)))
    .map((f) => ({ file: join(SETS_DIR, f), data: JSON.parse(readFileSync(join(SETS_DIR, f), 'utf-8')) }))
    .filter((s) => s.data.curated.functions?.length);
  // The slowest sets are for the slow check (see SLOW_OVER), unless named. Finding the causes
  // afresh works no control, and leaves none out.
  const slow = (s: { data: { generated?: { seconds?: number } } }) => (s.data.generated?.seconds ?? 0) > SLOW_OVER;
  const leftOut = filters.length === 0 && !slowOnly && !causes ? withFunctions.filter(slow) : [];
  const files = withFunctions
    .filter((s) => (slowOnly ? slow(s) : !leftOut.includes(s)))
    .sort((a, b) => took(b) - took(a) || statSync(b.data.curated.model).size - statSync(a.data.curated.model).size);

  // The sets being checked, and when each was started; how many are done, and their functions'
  // results so far.
  const checking = new Map<string, number>();
  let done = 0;
  const results: Partial<Record<Result, number>> = {};
  // How many functions have each cause, of the sets checked.
  const caused: Partial<Record<Cause, number>> = {};
  const notBack = { torn: 0, 'free-turned': 0, 'moved whole': 0 };
  type Found = Awaited<ReturnType<typeof check>> | { timedOut: number } | { failed: string };
  // The sets whose process failed: their files are left as they were.
  const failedSets: string[] = [];
  // Each process may take as much memory as the pool's whole budget (see check-pool.ts), half the
  // machine's, so that one that runs away fails alone. V8's own limit is about 4 GB on a 32 GB
  // machine, less than the 42082's function 9 takes with the collision stop on (7.6 GB at its
  // peak; 0.5 GB with it off): run with no limit of its own, it died 11 seconds in. Given here,
  // every run has the same limit, by name or whole, whatever NODE_OPTIONS says.
  const heap = `--max-old-space-size=${BUDGET_MB}`;
  // Every child of every check on the machine is entered in the pool with the memory it is
  // expected to take, and starts only when it fits (decision 229 of 2026-11-19): the most it took
  // the last time (`peak` in the set's record, or the function's for a set checked a function to
  // a process), else an estimate from the set's part count.
  const pool = new Pool(poolDir());
  // Where the processes mark the models whose parts with no shape they have said (see firstToShow).
  process.env.KINEBRICK_SHAPES_SHOWN = mkdtempSync(join(tmpdir(), 'kinebrick-shapes-shown-'));
  process.on('exit', () => rmSync(process.env.KINEBRICK_SHAPES_SHOWN!, { recursive: true, force: true }));
  const parts = partCounts();
  const expectedMb = (s: (typeof files)[number], only: number | null) => {
    const g = s.data.generated;
    const fns: Checked[] = (g?.functions ?? []).map(foundOf);
    const peak = only !== null ? (fns[only]?.peak ?? g?.peak) : (g?.peak ?? (fns.some((c) => c?.peak) ? Math.max(...fns.map((c) => c?.peak ?? 0)) : undefined));
    return peak ?? estimateMb(parts.get(s.data.set) ?? 0);
  };
  // Checks a set in a process of its own, or with `only`, one of its functions: what it found,
  // and how long it took (not counting the wait for room in the pool).
  const inProcess = async (s: (typeof files)[number], only: number | null, way: number | null = null) => {
    const entry = await pool.reserve(expectedMb(s, only), `${s.data.set}${only === null ? '' : ` function ${only + 1}`}${way === null ? '' : ` control ${way + 1}`}`);
    return new Promise<{ found: Found; seconds: number }>((resolve) => {
      const started = Date.now();
      const child = spawn(process.execPath, [...process.execArgv, heap, process.argv[1], '--one', s.file, ...(only === null ? [] : ['--only', String(only)]), ...(way === null ? [] : ['--way', String(way)])], { stdio: ['ignore', 'pipe', 'inherit'] });
      if (child.pid) pool.started(entry, child.pid);
      else pool.release(entry);
      let out = '';
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill();
      }, limit * 60_000);
      child.stdout.on('data', (d) => (out += d));
      child.on('close', (code) => {
        clearTimeout(timer);
        pool.release(entry);
        const seconds = Math.round((Date.now() - started) / 1000);
        let found: Found;
        if (timedOut) found = { timedOut: limit };
        else {
          try {
            if (code !== 0) throw new Error(`exit ${code}`);
            found = JSON.parse(out);
          } catch (err) {
            found = { failed: (err as Error).message };
          }
        }
        resolve({ found, seconds });
      });
    });
  };
  // Writes what a set's check found into its file, and says it.
  const finish = (s: (typeof files)[number], found: Found, seconds: number) => {
    if ('failed' in found) {
      console.log(`${s.data.set}: failed: ${found.failed}; its file is left as it was (${seconds} s)`);
      failedSets.push(s.data.set);
      checking.delete(s.data.set);
      done++;
      return;
    }
    // Read afresh, so only generated changes, whatever else changed meanwhile.
    const data = JSON.parse(readFileSync(s.file, 'utf-8'));
    // The functions data/holds.json holds that came out better are stored at their held result,
    // with what was found beside it, and counted so; for the other holds, the run says that they
    // are no longer needed (see holds.ts).
    if ('functions' in found) {
      const held = applyHolds(data.set, found.functions, heldResults);
      found = { ...found, functions: held.functions as Checked[], ...('counts' in found ? { counts: countsOf(held.functions as Checked[]) } : {}) };
      for (const note of held.notes) console.log(`${data.set}: ${note}`);
    }
    if (causes) {
      // Only the causes change: the results stay those of the commit they were checked at.
      if ('functions' in found && data.generated) data.generated = { ...data.generated, causes: commit, functions: found.functions };
    } else {
      if ('functions' in found) for (const line of changes(data.curated.functions, data.generated?.functions ?? [], found.functions)) console.log(`${data.set}: ${proposed ? 'with proposed errata: ' : ''}${line}`);
      if ('errata' in found && found.errata) console.log(`${data.set}: errata applied: ${found.errata.applied.join(', ') || 'none'}${found.errata.refused.length ? `; refused: ${found.errata.refused.join('; ')}` : ''}`);
      // A track drawn link by link isn't read as a track: the set's results say so (see unread-tracks.ts).
      const unread = unreadTracks(modelsOf(data.curated));
      data.generated = { commit, ...(uncommitted ? { uncommitted } : {}), ...(holds ? { holds } : {}), date, seconds, ...found, ...(unread ? { unreadTracks: unread } : {}) };
    }
    if (!proposed) writeFileSync(s.file, JSON.stringify(data, null, 2) + '\n');
    if ('functions' in found) for (const c of found.functions) if (c.cause) caused[c.cause] = (caused[c.cause] ?? 0) + 1;
    if ('functions' in found) for (const c of found.functions) if (c && notBackAs(c)) notBack[notBackAs(c)!]++;
    const summary = causes && 'functions' in found ? found.functions.flatMap((c) => (c.cause ? [c.cause] : [])).join(', ') || 'nothing to explain' : 'counts' in found ? Object.entries(found.counts).map(([k, n]) => `${n} ${k}`).join(', ') : `timed out after ${limit} minutes`;
    console.log(`${data.set}: ${summary} (${seconds} s)`);
    checking.delete(s.data.set);
    done++;
    if ('counts' in found) for (const [k, n] of Object.entries(found.counts)) if (k in RANK) results[k as Result] = (results[k as Result] ?? 0) + n;
  };
  // The work to do, each piece a process: a set, or one function of a set that took more than
  // SPLIT_OVER seconds the last time (or timed out). Such a set's functions are checked a function
  // to a process, the slowest first, side by side with everything else, and put together when
  // the last is done: each starts from the model as loaded anyway, so the results are the same,
  // and the set takes as long as its slowest function, not as all of them (the 8110 Unimog, 5
  // hours in one process). Its `seconds` are its functions' added up, to compare with a set
  // checked in one.
  // In the slow check, or anywhere with KINEBRICK_SPLIT_WAYS=1 (to try it on a quick set), a split
  // set's function with several controls not worked together goes a control to a process (see
  // combineWays): each control starts from the model as loaded too, so the results are the same,
  // and the function takes as long as its slowest control (the 8110 Unimog's rolling, four
  // wheels, 2 hours in one process). KINEBRICK_SPLIT_WAYS=1 splits every set so.
  const forceWays = process.env.KINEBRICK_SPLIT_WAYS === '1';
  const waysOf = (fn: Fn) => (slowOnly || forceWays) && !fn.together && Array.isArray(fn.control) && fn.control.length > 1 ? fn.control.length : 0;
  const queue: (() => Promise<void>)[] = [];
  for (const s of files) {
    const functions: Fn[] = s.data.curated.functions;
    const modelOf = (fn: Fn): string => fn.model ?? s.data.curated.model;
    const models = [...new Set(functions.map(modelOf))];
    // Not a set with a model none of whose functions is checked: no process would load it, to
    // list its loose parts.
    const everyModelChecked = models.every((m) => functions.some((fn) => modelOf(fn) === m && !withoutChecking(fn)));
    if (causes || (functions.length < 2 && !waysOf(functions[0])) || !(took(s) > SPLIT_OVER || forceWays) || !everyModelChecked) {
      queue.push(async () => {
        checking.set(s.data.set, Date.now());
        const { found, seconds } = await inProcess(s, null);
        finish(s, found, seconds);
      });
      continue;
    }
    const last: Checked[] = (s.data.generated?.functions ?? []).map(foundOf);
    const checked: Checked[] = functions.map((fn) => withoutChecking(fn) ?? { result: 'error' });
    const todo = functions.flatMap((fn, i) => (withoutChecking(fn) ? [] : [i])).sort((i, j) => (last[j]?.seconds ?? Infinity) - (last[i]?.seconds ?? Infinity));
    let left = todo.length;
    let total = 0;
    let failed: Found | null = null;
    const loose = new Map<string, string[]>(); // each model's loose parts
    const errata = new Map<string, { applied: string[]; refused: string[] }>(); // each model's errata
    const functionDone = () => {
      const applied = [...errata.values()].flatMap((e) => e.applied);
      const refused = [...errata.values()].flatMap((e) => e.refused);
      const ofErrata = applied.length || refused.length ? { errata: { applied: [...new Set(applied)], refused: [...new Set(refused)] } } : {};
      if (--left === 0) finish(s, failed ?? { counts: countsOf(checked), loose: models.flatMap((m) => loose.get(m) ?? []), ...ofErrata, functions: checked }, total);
    };
    // Checks function i in a process (its control `way` only, if given): its entry, or null if the
    // process failed.
    const run = async (i: number, way: number | null = null): Promise<Checked | null> => {
      if (!checking.has(s.data.set)) checking.set(s.data.set, Date.now());
      const { found, seconds } = await inProcess(s, i, way);
      total += seconds;
      if (!('functions' in found)) {
        failed ??= found;
        return null;
      }
      loose.set(modelOf(functions[i]), found.loose);
      if (found.errata) errata.set(modelOf(functions[i]), found.errata);
      const peak = (found as { peak?: number }).peak;
      return { ...found.functions[i], ...(peak ? { peak } : {}) };
    };
    for (const i of todo) {
      const fn = functions[i];
      const n = waysOf(fn);
      if (!n) {
        queue.push(async () => {
          checked[i] = (await run(i)) ?? checked[i];
          functionDone();
        });
        continue;
      }
      // A control to a process, put together when the last is done; checked again whole if
      // putting them together needs the first control's working (see combineWays).
      const shares: (Checked | null)[] = new Array(n).fill(null);
      let waysLeft = n;
      for (let w = 0; w < n; w++) {
        queue.push(async () => {
          shares[w] = await run(i, w);
          if (--waysLeft > 0) return;
          if (shares.every((c) => c?.way)) {
            const ways = shares.map((c) => c!.way!);
            const combined = combineWays(fn, ways, ways.flatMap((w) => w.why), Math.max(0, ...ways.map((w) => w.freed)), null);
            // The pivot that slid or rose most, the first of equals, as one process keeps it.
            const pivoted = shares.reduce<Checked['pivoted']>((most, c) => (c!.pivoted && (!most || Math.max(c!.pivoted.slide, c!.pivoted.rise) > Math.max(most.slide, most.rise)) ? c!.pivoted : most), undefined);
            const seconds = Math.round(shares.reduce((sum, c) => sum + (c!.seconds ?? 0), 0) * 10) / 10;
            const collisionStops = shares.flatMap((c) => c!.collisionStops ?? []);
            const peak = Math.max(0, ...shares.map((c) => c!.peak ?? 0));
            checked[i] = combined ? { ...combined, ...(pivoted ? { pivoted } : {}), ...(collisionStops.length ? { collisionStops } : {}), seconds, ...(peak ? { peak } : {}) } : ((await run(i)) ?? checked[i]);
          } else {
            // A control that failed as one process would have failed the function there too.
            const error = shares.find((c) => c && !c.way);
            if (error) checked[i] = error;
          }
          functionDone();
        });
      }
    }
  }

  console.log(`Checking ${files.length} sets, ${jobs} at a time`);
  if (leftOut.length) console.log(`Left for the slow check, before a merge to main (npm run functions -- --slow): ${leftOut.map((s) => s.data.set).join(', ')}`);
  // Once a minute, how far it's got, with its functions' results so far as shares of all their
  // functions, as the Status in DEVELOPER.md has them: "12 done, 173 left; 30 works (37%), 21 partly (26%), 9 no
  // (11%), 21 skipped or not checked (26%); checking 42082-1 (14 min), 9397-1 (3 min)".
  const progress = setInterval(() => {
    const now = Date.now();
    const sets = [...checking].map(([set, started]) => `${set} (${Math.floor((now - started) / 60_000)} min)`);
    const all = Object.values(results).reduce((sum, n) => sum + n, 0);
    const share = (n: number, what: string) => `${n} ${what} (${all ? Math.round((100 * n) / all) : 0}%)`;
    const shares = [share(results.works ?? 0, 'works'), share(results.partly ?? 0, 'partly'), share(results.no ?? 0, 'no'), share((results.skipped ?? 0) + (results['not checked'] ?? 0), 'skipped or not checked')];
    console.log(`${done} done, ${files.length - done} left; ${shares.join(', ')}; checking ${sets.join(', ')}`);
  }, 60_000);
  await Promise.all(
    Array.from({ length: jobs }, async () => {
      for (let work = queue.shift(); work; work = queue.shift()) await work();
    }),
  );
  clearInterval(progress);
  // Why the functions that don't work don't, most common first, with who looks into each.
  const byCount = (Object.entries(caused) as [Cause, number][]).sort((a, b) => b[1] - a[1]);
  // Of the functions that left a part not back, those that came back torn, and those that came
  // back whole but somewhere else (see notBackAs).
  if (notBack.torn + notBack['free-turned'] + notBack['moved whole']) console.log(`Not back: ${notBack.torn} came back torn, ${notBack['free-turned']} torn only where they move freely with the control held, ${notBack['moved whole']} came back whole but somewhere else`);
  if (byCount.length) console.log('Causes:\n' + byCount.map(([c, n]) => `  ${String(n).padStart(4)}  ${c} (${CAUSES[c].owner}): ${CAUSES[c].says}`).join('\n'));
  // The mechanism catalog quotes each function's result: written afresh with them.
  if (!causes && !proposed) execFileSync('npx', ['tsx', 'scripts/mechanisms.ts'], { stdio: 'inherit' });
  if (failedSets.length) {
    console.log(`Failed, their files left as they were: ${failedSets.join(', ')}`);
    process.exitCode = 1;
  }
}
