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
// (`back`: the furthest any part is left from it, LDU and degrees; `strayed`: parts left more
// than BACK away).
//
//   npm run functions                 every set with functions, but for the slowest (SLOW_OVER)
//   npm run functions -- --slow       only the slowest sets, left out of the plain run: hours,
//                                     before a merge to main
//   npm run functions -- 855 8880     only sets whose number has one of these in it
//   npm run functions -- --jobs 4     how many sets to check at once (default: half the cores)
//   npm run functions -- --limit 20   stop a process (a set, or one function of a slow set) that
//                                     takes more than this many minutes (default 60), marking
//                                     the set as timed out
//   npm run functions -- --lock       steering's stops too (see LOCK), for now only reported
//   npm run functions -- --causes     no drags: only works out afresh why each function that
//                                     doesn't work doesn't (see causes.ts), from the results
//                                     already written, and writes each one's `cause`
//   npm run functions -- --quick      only the quick sets (QUICK): a couple of minutes, for every
//                                     change; the whole check takes about an hour
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
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join } from 'node:path';
import { Matrix4, Quaternion, Vector3 } from 'three';
import { experiments, Kinematics } from '../src/kinematics.ts';
import { PlacedPart } from '../src/ldr.ts';
import { Mechanism, meshesChanged } from '../src/mechanism.ts';
import { pointDirections, pushStep } from '../src/push.ts';
import { Collisions, connectedPairs, PartMesh } from '../src/collisions.ts';
import { Cause, causeOf, CAUSES, Explained, Listed } from './causes.ts';
import { Catch, catchShifts, findCatches, findSliders, nearestPosition, Slider, sliderMovedTo, sliderPosition } from '../src/shift.ts';
import { gearRates, line } from './gear-rates.ts';
import { loadModel } from './load-model.ts';
import { FREE_PINS, pinsToFree } from '../src/inference/friction.ts';
import { partShapes } from './part-shapes.ts';
import { pistonAt, sliderCranks } from './slider-cranks.ts';

const SETS_DIR = join('data', 'sets');
// How far a control is turned each way (radians), or pushed (LDU) if it slides.
const REACH = 1.5;
const PUSH = 20;
// A part counts as moved if it went at least this far (LDU) or turned at least this much (degrees).
const MOVED = 1;
const LIMIT_MINUTES = 60;
// A drag is measured in pieces of this many radians (or LDU, for a slide), adding up how far each
// part went in each: a part geared up turns further than half a turn, which its pose alone can't
// tell.
const PIECE = 0.1;
// A control the viewer would push, not turn (see pushMeasuring), is pushed in steps of up to this
// many LDU, as the viewer's are (MAX_STEP in src/interaction.ts).
const PUSH_STEP = 1;
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
const STEERING = ['rack-steering', 'linkage-steering', 'multi-axle-steering', 'fork-steering', 'articulated-steering', 'swivel-axle-steering'];
const locks = process.env.KINEBRICK_CHECK_LOCK === '1';
// With --lock, each model's part shapes (see partShapes), read before it's checked.
const shapesOf = new Map<string, { name: string; shape: PartMesh[] }[]>();
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
// no motion left that turns the joint, or a step that couldn't be taken.
type Halt = 'limit' | 'dead point' | 'no motion' | 'stuck';
// With --causes, nothing is dragged: each failing function's cause is worked out afresh.
const causesOnly = process.env.KINEBRICK_CAUSES === '1';
type Result = 'works' | 'partly' | 'no' | 'skipped' | 'not checked' | 'error';
interface Checked {
  result: Result;
  seconds?: number; // how long the function took to check
  turned?: [number, number][]; // each control's turn against what its shaft turns in (or push), each way
  still?: string[];
  moved?: string[];
  rates?: Record<string, [number, number]>[]; // for each control, in the way taken, each listed part's turning and sliding for each radian it turned
  expected?: Record<string, number>[]; // for each control, what its gears say for the parts that have a say
  wrong?: string[];
  back?: [number, number][][]; // for each control, each way: the furthest a part is left after there and back (LDU, degrees)
  lock?: [number, number, Stop][][]; // for each steering control, each way: its steered parts' most turn (degrees), its own turn (radians), and what stopped it (see LOCK)
  strayed?: string[];
  why?: string[];
  stop?: (Halt | null)[][]; // for each control, each way: what stopped it short of its reach, if anything did
  pushed?: boolean[]; // for each control: whether it was worked by a push, as the viewer would, not a turn (see isPushed)
  movedBy?: string[][]; // for a function with several controls not worked together: for each control, the parts in `moves` it moved
  freed?: number; // how many friction pins were freed for its control, which had no motion (see pinsToFree)
  cause?: Cause; // for a function that doesn't work: why (see causes.ts)
  detail?: string; // the part the cause is about
}
interface Fn {
  control?: string | string[];
  mechanisms?: string[];
  moves?: string[];
  stays?: string[];
  first?: { control: string; by: number }[];
  together?: boolean; // the controls are worked as one, turning together (see turnTogether)
  // Parts whose bodies are frozen while the control is worked, as the viewer's Alt-click freezes
  // them: what the function's text says is held (the 8464's drive, for its differentials). Or,
  // by control, the parts each one's working holds (the 42000's "turning one rear wheel with the
  // other held": each rear wheel holds the other).
  held?: string[] | Record<string, string[]>;
  skip?: string;
  model?: string; // its own model, for a set with several (the 858's four engines)
}

// Checks one set's functions on its model, or each on its own; what goes in its generated
// section, but for the commit and date.
// Given `only`, just that function (by its place in the list) is checked, and only its model is
// loaded: the others' entries are left out (null), for a set checked a function to a process
// (see SPLIT_OVER).
function check(set: { curated: { model: string; functions: Fn[] }; generated?: { functions?: Checked[] } }, only: number | null = null) {
  const { model, functions } = set.curated;
  // What each function came to the last time, for --causes.
  const priors = set.generated?.functions ?? [];
  const modelOf = (fn: Fn) => fn.model ?? model;
  const checked: Checked[] = [];
  const loose: string[] = [];
  const wanted = (i: number) => only === null || i === only;
  for (const m of new Set(functions.map(modelOf))) {
    const mine = functions.flatMap((fn, i) => (modelOf(fn) === m && wanted(i) ? [i] : []));
    if (mine.length === 0) continue;
    const found = checkModel(m, mine.map((i) => functions[i]), mine.map((i) => priors[i]));
    mine.forEach((i, at) => (checked[i] = found.checked[at]));
    loose.push(...found.loose.map((p) => (m === model ? p : `${p} in ${m}`)));
  }
  return { counts: countsOf(checked), loose, functions: checked };
}

// How many functions came out each way, and how many moved a part by the wrong amount or left
// one not back.
function countsOf(checked: Checked[]) {
  const counts: Partial<Record<Result | 'wrong amount' | 'not back', number>> = {};
  const count = (what: keyof typeof counts) => (counts[what] = (counts[what] ?? 0) + 1);
  for (const c of checked) {
    if (!c) continue; // left out (see check's `only`)
    count(c.result);
    if (c.wrong) count('wrong amount');
    if (c.strayed) count('not back');
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
function checkModel(model: string, functions: Fn[], priors: (Checked | undefined)[]) {
  // A model from the OMR, or a changed copy of one (see invariance.ts), is read with the library's
  // connections.
  const loaded = loadModel(model, model.startsWith('omr/') || process.env.KINEBRICK_AS_OMR === '1');
  const { table, slides } = loaded;
  // The model as it's being worked: as loaded, or worked out afresh after a shift (see shiftTo).
  let { parts, mech, kin } = loaded;
  let sliders: Slider[] = [];
  let catches: Catch[] = [];
  let at: Vector3[] = [];
  const use = (now: { parts: PlacedPart[]; mech: Mechanism; kin: Kinematics }) => {
    ({ parts, mech, kin } = now);
    sliders = findSliders(parts, mech, table, slides);
    catches = findCatches(parts, sliders);
    at = parts.map((p) => new Vector3().setFromMatrixPosition(p.matrix));
  };
  const asLoaded = { parts, mech, kin };
  use(asLoaded);
  // The friction pins freed for the control being checked (see pinsToFree), and the model with
  // every pin free, worked out the first time a control needs it.
  let freed = new Set<number>();
  let allFree: Mechanism | null = null;
  // Where everything is now, as parts placed in the model.
  const placedNow = () => parts.map((p, i) => ({ ...p, matrix: kin.poses[mech.bodyOf[i]].clone().multiply(p.matrix) }));
  // Slides driving rings to the click-in positions given (by each ring's part), and works the
  // mechanism out afresh from where everything now is, as the viewer does after a shift.
  const shiftTo = (shifts: Map<number, number>) => {
    const now = placedNow();
    for (const [ring, to] of shifts) {
      const slider = sliders.find((s) => s.part === ring)!;
      const by = sliderMovedTo(now, table, slider, to).multiply(now[ring].matrix.clone().invert());
      for (const i of slider.riders ?? [ring]) now[i] = { ...now[i], matrix: by.clone().multiply(now[i].matrix) };
    }
    use(loaded.read(now, freed));
  };
  // A part named as the joints probe names it: "p483 3736".
  const part = (ref: string) => {
    const n = Number(/^p(\d+)\b/.exec(ref.trim())?.[1]);
    if (!(n >= 0 && n < parts.length)) throw new Error(`no part ${ref}`);
    return n;
  };
  const name = (p: number) => `p${p} ${parts[p].name.replace(/\.dat$/, '')}`;
  // "p402 3703 against p315 3029": the part, and the body it's measured against (the frame if none).
  const against = (ref: string) => {
    const [a, b] = ref.split(' against ');
    return { ref, part: part(a), body: b ? mech.bodyOf[part(b)] : 0 };
  };
  // Whether a part moved against its body, from the poses at `start` to now, or is a driving
  // ring a catch has shifted (`shifted`).
  const moved = ({ part, body }: { part: number; body: number }, start: Matrix4[], shifted: Map<number, number>) => {
    if (shifted.has(part)) return true;
    const rel = (poses: Matrix4[]) => poses[body].clone().invert().multiply(poses[mech.bodyOf[part]]);
    const was = rel(start);
    const is = rel(kin.poses);
    const went = at[part].clone().applyMatrix4(is).distanceTo(at[part].clone().applyMatrix4(was));
    const q = new Quaternion().setFromRotationMatrix(was.clone().invert().multiply(is));
    return went >= MOVED || (2 * Math.acos(Math.min(1, Math.abs(q.w))) * 180) / Math.PI >= MOVED;
  };
  // The body a control works: its own, or for a motor named as the control, what turns in it
  // (its output's axle), as the motor would turn it.
  const worked = (control: number) => {
    const b = mech.bodyOf[control];
    if (mech.roles[control] !== 'motor') return b;
    const j = mech.joints.find((x) => x.motor && (x.bodyA === b || x.bodyB === b));
    return j ? (j.bodyA === b ? j.bodyB : j.bodyA) : b;
  };
  // The bodies turned with the one worked, for a function whose controls are worked together.
  let together: number[] = [];
  // Works a body's joint as a drag does, as far as it goes up to `amount`; how far it went.
  const turn = (body: number, amount: number) => {
    const joint = kin.parentLink(body)!.joint;
    if (together.length) kin.turnTogether(body, together);
    kin.holdWhatTheDragDoesntNeed(body, () => kin.jointMotion(joint) !== null, joint);
    const turned = kin.turnJoint(joint, amount, () => kin.atLimit() === null);
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
  // (LDU) against its body on the way, and calling `each` after each piece.
  const turnMeasuring = (body: number, amount: number, parts: { part: number; body: number }[], each = () => {}) => {
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
      if (kin.atLimit() === null) return true;
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
        halt = limited ? 'limit' : kin.atDeadPoint(joint) ? 'dead point' : kin.jointMotion(joint) === null ? 'no motion' : 'stuck';
        break;
      }
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
    const motion = kin.jointMotion(kin.parentLink(body)!.joint);
    if (!motion) return null;
    const m = parts[control].matrix;
    const points = [at[control].clone()];
    for (const k of [0, 1, 2]) for (const way of [1, -1]) points.push(at[control].clone().addScaledVector(new Vector3().setFromMatrixColumn(m, k).normalize(), way * GRAB));
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
  // turns in, or the push can go no further. `back`: back the way an earlier push went, as far as it went. It
  // follows the way the point goes, round a curve. Also returns how the push went, to push it
  // back.
  type Pushed = { grab: Vector3; dir: Vector3; length: number };
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
    const far = 'back' in to ? to.back.length : PUSH_FAR;
    while (length < far - 1e-9 && ('back' in to || ownTurned < Math.abs(to.reach) - 1e-9)) {
      if (dir.length() < 0.5) {
        halt = 'no motion';
        break;
      }
      const step = Math.min(PUSH_STEP, far - length);
      const how = pushStep(kin, body, grab, dir, step, () => kin.atLimit() === null);
      if (how !== 'moved') {
        halt = how === 'blocked' ? 'limit' : kin.jointMotion(joint) === null ? 'no motion' : 'stuck';
        break;
      }
      length += step;
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
    return { turned: kin.jointAngles[joint] - from, went, halt, pushed: { grab, dir: dir.clone(), length } };
  };
  // The furthest any part is from where it was in `poses` (LDU, degrees), and the part that's
  // furthest (by LDU, or degrees for a part that only turns).
  const furthest = (poses: Matrix4[]) => {
    let most = { ldu: 0, degrees: 0, part: -1, by: 0 };
    parts.forEach((_, i) => {
      const b = mech.bodyOf[i];
      const ldu = at[i].clone().applyMatrix4(kin.poses[b]).distanceTo(at[i].clone().applyMatrix4(poses[b]));
      const degrees = (angle(poses[b], kin.poses[b]) * 180) / Math.PI;
      const by = Math.max(ldu, degrees);
      most = { ldu: Math.max(most.ldu, ldu), degrees: Math.max(most.degrees, degrees), part: by > most.by ? i : most.part, by: Math.max(by, most.by) };
    });
    return most;
  };

  const checkOne = (fn: Fn, prior?: Checked): Checked => {
    const known = withoutChecking(fn);
    if (known) return known;
    // With --causes, only a function that didn't work is looked at, and nothing is dragged.
    if (causesOnly && !(prior && (prior.result === 'partly' || prior.result === 'no'))) return prior ?? { result: 'not checked' };
    const why: string[] = [];
    let freedPins = 0;
    // Controls worked together are worked as one, by the first, the others turning with it.
    const controls = [fn.control!].flat();
    // Several controls not worked together: each drives its own share of the parts.
    const shared = controls.length > 1 && !fn.together;
    const ways = (fn.together ? controls.slice(0, 1) : controls).map((ref, wi) => {
      together = [];
      use(asLoaded);
      kin.reset();
      freed = new Set();
      // A control with no motion at the start, held by friction pins: those pins are freed, and
      // the model worked out again, for this control only (see pinsToFree). So too a control
      // the viewer would push whose joint turns only by swinging the rest of the model round it,
      // so that no point of it moves and the push couldn't start (see grabOf): the 8865's seat
      // back, on friction hinge plates.
      if (FREE_PINS) {
        const c = part(ref);
        const l = kin.parentLink(worked(c));
        const noGrab = () => !fn.together && isPushed(worked(c)) && grabOf(worked(c), c) === null;
        if (worked(c) === 0 || !l || kin.jointMotion(l.joint) === null || noGrab()) {
          allFree ??= loaded.allFree(asLoaded.parts);
          freed = new Set(pinsToFree(allFree, c));
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
            if (worked(c) === 0 || !l || kin.jointMotion(l.joint) === null || noGrab()) return false;
            const before = kin.snapshot();
            kin.holdWhatTheDragDoesntNeed(worked(c), () => kin.jointMotion(l.joint) !== null, l.joint);
            const went = kin.turnJoint(l.joint, 0.01, () => true);
            kin.letGoAfterDrag();
            kin.restore(before);
            return Math.abs(went) > 1e-6;
          };
          if (goes()) for (const m of held) why.push(`${m.ref} is held by friction pins the control doesn't reach`);
          else {
            allFree ??= loaded.allFree(asLoaded.parts);
            for (const m of held) for (const pin of pinsToFree(allFree, m.part)) freed.add(pin);
          }
        }
        if (freed.size) {
          use(loaded.read(asLoaded.parts, freed));
          freedPins = Math.max(freedPins, freed.size);
        }
      }
      const whyBefore = why.length;
      for (const first of fn.first ?? []) {
        const p = part(first.control);
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
        else if (meshesChanged(mech, kin.poses)) use(loaded.read(placedNow(), freed));
      }
      // Measured on the model as it is now, after any shift.
      const moves = (fn.moves ?? []).map(against);
      const stays = (fn.stays ?? []).map(against);
      const control = part(ref);
      const b = worked(control);
      const link = kin.parentLink(b);
      // Why it doesn't work, if it doesn't (see causes.ts). Told before anything else: a loose
      // part (the control, or one it should move or keep still), or a control worked first that
      // didn't go. A loose part rides along with its nearest neighbour, attached to nothing, so a
      // function that names one can't work, whatever the drag does: at most partly (the 8285's
      // wheels "rolling freely" on rims that sit on nothing).
      const loosePart = [control, ...moves.map((m) => m.part), ...stays.map((m) => m.part)].find((p) => mech.loose.includes(p));
      const early: Explained | null = loosePart !== undefined ? { cause: 'loose-part', detail: name(loosePart) } : why.length > whyBefore ? { cause: 'first-failed' } : null;
      const nothing = (explained: Explained) => ({ works: false, pushed: false, turned: [0, 0] as [number, number], still: moves.map((m) => m.ref), moved: [] as string[], something: false, rates: {}, expected: {}, off: [] as string[], back: [] as [number, number][], strayed: [] as string[], lock: null as [number, number, Stop][] | null, stop: [null, null] as (Halt | null)[], explained: explained as Explained | null, movedParts: [] as string[], explainStill: (() => explained) as (still: string[]) => Explained | null });
      if (b === 0 || !link) {
        why.push(`${ref} ${b === 0 ? 'is part of the frame' : 'has no joint to work'}`);
        return nothing(early ?? { cause: 'control-fixed' });
      }
      const reach = mech.joints[link.joint].kind === 'slide' ? PUSH : REACH;
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
      for (const m of listed) if (m.body === 0 && mech.bodyOf[m.part] !== b && geared.has(mech.bodyOf[m.part])) expected[m.ref] = sig(geared.get(mech.bodyOf[m.part])!);
      // The cause, from where the control starts: given the parts that didn't move and should
      // have, those that moved and shouldn't have, and how far the control went.
      const listedAs = (m: { ref: string; part: number; body: number }): Listed => ({ ref: m.ref, body: mech.bodyOf[m.part], against: m.body });
      const explain = (still: string[], wrong: string[], turned: number): Explained =>
        early ?? causeOf(kin, { body: b, parent: link.parent }, moves.filter((m) => still.includes(m.ref)).map(listedAs), stays.filter((x) => wrong.includes(x.ref)).map(listedAs), new Set(geared.keys()), Math.abs(turned) >= reach / 2);
      if (causesOnly) return nothing(explain(prior!.still ?? [], prior!.moved ?? [], Math.max(0, ...(prior!.turned?.[wi] ?? []).map(Math.abs))));
      // How far the control really turns: against what its shaft turns in (see housing), not
      // just its joint's angle, which a shaft spinning back under it makes up without the
      // control turning at all (the 8865 Test Car's seats, on axles free in their holes).
      const slides = mech.joints[link.joint].kind === 'slide';
      const itself = { part: mech.bodies[b].parts[0], body: kin.housing(b) };
      // The pistons in `moves`, each with its slider-crank (see sliderCranks): how far it should
      // slide in its cylinder is set by how far its crank turns, whatever turned the crank.
      const cranks = sliderCranks(mech, (x) => kin.parentLink(x));
      const pistons = moves.flatMap((m) => cranks.filter((sc) => sc.piston === mech.bodyOf[m.part]).slice(0, 1).map((sc) => ({ m, sc, in: { part: m.part, body: sc.cylinder } })));
      // A crank's angle against its housing (see line), from where it was built.
      const crankAngle = (c: number) => {
        const l = line(mech, (x) => kin.parentLink(x), c)!.joints;
        return l.reduce((sum, j) => sum + kin.jointAngles[j.joint] * Math.sign(j.axis.dot(l[0].axis)), 0);
      };
      const each = [1, -1].map((way) => {
        kin.restore(start);
        // How far each piston should slide, piece by piece, as its crank turns.
        let was = pistons.map((p) => pistonAt(p.sc, crankAngle(p.sc.crank)));
        const should = pistons.map(() => 0);
        const measure = (amount: number, parts: { part: number; body: number }[], after = () => {}) => (pushed ? pushMeasuring(b, control, { reach: amount }, parts, after) : { ...turnMeasuring(b, amount, parts, after), pushed: null });
        const measured = measure(way * reach, [...listed, itself, ...pistons.map((p) => p.in)], () => {
          const now = pistons.map((p) => pistonAt(p.sc, crankAngle(p.sc.crank)));
          now.forEach((x, k) => (should[k] += x === null || was[k] === null ? NaN : Math.abs(x - was[k]!)));
          was = now;
        });
        const went = measured.went;
        // The joint's own turn, to work it back again.
        const joint = measured.turned;
        const turned = slides ? joint : Math.sign(joint) * went[listed.length][0];
        const shifted = catchShifts(placedNow(), table, catches);
        const still = moves.filter((m) => !moved(m, startPoses, shifted)).map((m) => m.ref);
        const wrong = stays.filter((s) => moved(s, startPoses, shifted)).map((s) => s.ref);
        const rates: Record<string, [number, number]> = {};
        listed.forEach((m, k) => (rates[m.ref] = Math.abs(turned) > 1e-6 ? [sig(went[k][0] / Math.abs(turned)), sig(went[k][1] / Math.abs(turned))] : [0, 0]));
        // A rate is the part's turning, or its sliding if it slides on its joint.
        const rateOf = (m: (typeof listed)[number]) => rates[m.ref][kin.parentLink(mech.bodyOf[m.part]) && mech.joints[kin.parentLink(mech.bodyOf[m.part])!.joint].kind === 'slide' ? 1 : 0];
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
        } else if (Math.abs(joint) >= 0.01) turn(b, -joint);
        const most = furthest(startPoses);
        kin.restore(there);
        const back: [number, number] = [round(most.ldu), round(most.degrees)];
        const strayed = most.ldu > BACK || most.degrees > BACK ? [name(most.part)] : [];
        // For a function whose controls share out the parts, a way does its share if it moves
        // at least one of them (if it lists any).
        const share = Math.abs(turned) >= reach / 2 && !wrong.length && (!moves.length || still.length < moves.length);
        return { turned, still, moved: wrong, rates, expected: { ...expected, ...strokes }, off, back, strayed, halt: measured.halt, works: shared ? share : Math.abs(turned) >= reach / 2 && !still.length && !wrong.length };
      });
      kin.restore(start);
      kin.frozen = new Set();
      together = [];
      // The better way: one that works, or else the one with fewer wrong parts that went further.
      const best = [...each].sort((x, y) => Number(y.works) - Number(x.works) || x.still.length + x.moved.length - (y.still.length + y.moved.length) || Math.abs(y.turned) - Math.abs(x.turned))[0];
      const something = each.some((w) => Math.abs(w.turned) >= 0.01 || w.still.length < moves.length);
      const works = best.works && loosePart === undefined;
      const explained = works ? null : explain(best.still, best.moved, best.turned);
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
            const known = shapesOf.get(model);
            const matches = known !== undefined && known.length >= parts.length && parts.every((p, i) => known[i].name === p.name);
            const collisions = matches ? new Collisions(parts.map((p, i) => (p.path ? [] : known[i].shape)), mech.bodyOf, connectedPairs(mech), placedNow().map((p) => p.matrix)) : null;
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
      return { works, movedParts, explainStill, pushed, turned: each.map((w) => round(w.turned)) as [number, number], still: best.still, moved: best.moved, something, rates: best.rates, expected: best.expected, off: best.off, back: each.map((w) => w.back), strayed: each.flatMap((w) => w.strayed), lock, stop: each.map((w) => w.halt), explained };
    });
    // Controls that share out the parts: the parts none of them moved are still.
    const movedByAny = new Set(ways.flatMap((w) => w.movedParts));
    const still = shared ? (fn.moves ?? []).filter((m) => !movedByAny.has(m)) : [...new Set(ways.flatMap((w) => w.still))];
    // The cause is that of the first control that doesn't work.
    const first = ways.find((w) => w.explained)?.explained ?? (shared && still.length ? ways[0].explainStill(still) : undefined);
    const explained = first ? { cause: first.cause, ...(first.detail ? { detail: first.detail } : {}) } : {};
    if (causesOnly) {
      const kept: Checked = { ...prior! };
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
      ...(strayed.length ? { strayed } : {}),
      ...(ways.some((w) => w.lock) ? { lock: ways.map((w) => w.lock ?? []) } : {}),
      ...(why.length ? { why: [...new Set(why)] } : {}),
      ...(ways.some((w) => w.stop.some((h) => h)) ? { stop: ways.map((w) => w.stop) } : {}),
      ...(ways.some((w) => w.pushed) ? { pushed: ways.map((w) => w.pushed) } : {}),
      ...(freedPins ? { freed: freedPins } : {}),
      ...(shared ? { movedBy: ways.map((w) => w.movedParts) } : {}),
      ...(result === 'works' ? {} : explained),
    };
  };

  // Each function's entry says how long it took (`seconds`), so a slow set shows which function
  // is slow. KINEBRICK_TIMES=1 says it as the set goes, too.
  const checked = functions.map((fn, i): Checked => {
    const started = Date.now();
    let found: Checked;
    try {
      found = checkOne(fn, priors[i]);
    } catch (err) {
      found = { result: 'error', cause: 'bad-reference', why: [(err as Error).message] };
    }
    const seconds = Math.round((Date.now() - started) / 100) / 10;
    if (process.env.KINEBRICK_TIMES === '1') console.error(`function ${i + 1}: ${found.result}, ${seconds} s`);
    return { ...found, seconds };
  });
  return { checked, loose: mech.loose.map(name) };
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
    // Only once both were measured for amounts.
    if (before.rates) {
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
if (one >= 0) {
  const set = JSON.parse(readFileSync(args[one + 1], 'utf-8'));
  if (locks) for (const m of new Set<string>([set.curated.model, ...set.curated.functions.flatMap((fn: Fn) => (fn.model ? [fn.model] : []))])) shapesOf.set(m, await partShapes(m));
  const onlyAt = args.indexOf('--only'); // (internal) only this function, by its place in the list
  const found = check(set, onlyAt >= 0 ? Number(args[onlyAt + 1]) : null);
  // Let the output drain before the process ends: a pipe takes it in pieces.
  process.stdout.write(JSON.stringify(found), () => process.exit(0));
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
  // A set's number, followed by "-" so that 855 doesn't also pick the 8855.
  const filters = args.includes('--quick') ? QUICK.map((n) => `${n}-`) : named;
  if (args.includes('--lock')) process.env.KINEBRICK_CHECK_LOCK = '1';
  const causes = args.includes('--causes');
  if (causes) process.env.KINEBRICK_CAUSES = '1';
  const commit = execSync('git rev-parse --short HEAD').toString().trim();
  // No shell, so the pathspec isn't left quoted by Windows' cmd.
  const uncommitted = execFileSync('git', ['status', '--porcelain', '--', 'src', 'data', ':!data/sets']).toString().trim() !== '';
  const date = new Date().toISOString().slice(0, 10);
  // Checked with holds rather than least motion (KINEBRICK_LEAST=0; see docs/least-motion.md).
  const holds = !experiments.leastMotion;

  // The sets with functions, slowest first, by how long each took the last time (a set that timed
  // out before any), so that the longest set starts at once rather than last, on its own: then
  // the whole check takes about as long as its slowest set. A set not timed yet goes by its
  // model's size, biggest first.
  const took = (s: { data: { generated?: { seconds?: number; timedOut?: number } } }) => (s.data.generated?.timedOut ? Infinity : (s.data.generated?.seconds ?? -1));
  const withFunctions = readdirSync(SETS_DIR)
    .filter((f) => f.endsWith('.json') && (filters.length === 0 || filters.some((x) => f.includes(x))))
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
  type Found = ReturnType<typeof check> | { timedOut: number } | { failed: string };
  // Checks a set in a process of its own, or with `only`, one of its functions: what it found,
  // and how long it took.
  const inProcess = (s: (typeof files)[number], only: number | null) =>
    new Promise<{ found: Found; seconds: number }>((resolve) => {
      const started = Date.now();
      const child = spawn(process.execPath, [...process.execArgv, process.argv[1], '--one', s.file, ...(only === null ? [] : ['--only', String(only)])], { stdio: ['ignore', 'pipe', 'inherit'] });
      let out = '';
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill();
      }, limit * 60_000);
      child.stdout.on('data', (d) => (out += d));
      child.on('close', (code) => {
        clearTimeout(timer);
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
  // Writes what a set's check found into its file, and says it.
  const finish = (s: (typeof files)[number], found: Found, seconds: number) => {
    // Read afresh, so only generated changes, whatever else changed meanwhile.
    const data = JSON.parse(readFileSync(s.file, 'utf-8'));
    if (causes) {
      // Only the causes change: the results stay those of the commit they were checked at.
      if ('functions' in found && data.generated) data.generated = { ...data.generated, causes: commit, functions: found.functions };
    } else {
      if ('functions' in found) for (const line of changes(data.curated.functions, data.generated?.functions ?? [], found.functions)) console.log(`${data.set}: ${line}`);
      data.generated = { commit, ...(uncommitted ? { uncommitted } : {}), ...(holds ? { holds } : {}), date, seconds, ...found };
    }
    writeFileSync(s.file, JSON.stringify(data, null, 2) + '\n');
    if ('functions' in found) for (const c of found.functions) if (c.cause) caused[c.cause] = (caused[c.cause] ?? 0) + 1;
    const summary = causes && 'functions' in found ? found.functions.flatMap((c) => (c.cause ? [c.cause] : [])).join(', ') || 'nothing to explain' : 'counts' in found ? Object.entries(found.counts).map(([k, n]) => `${n} ${k}`).join(', ') : 'timedOut' in found ? `timed out after ${limit} minutes` : `failed: ${found.failed}`;
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
  const queue: (() => Promise<void>)[] = [];
  for (const s of files) {
    const functions: Fn[] = s.data.curated.functions;
    const modelOf = (fn: Fn): string => fn.model ?? s.data.curated.model;
    const models = [...new Set(functions.map(modelOf))];
    // Not a set with a model none of whose functions is checked: no process would load it, to
    // list its loose parts.
    const everyModelChecked = models.every((m) => functions.some((fn) => modelOf(fn) === m && !withoutChecking(fn)));
    if (causes || functions.length < 2 || !(took(s) > SPLIT_OVER) || !everyModelChecked) {
      queue.push(async () => {
        checking.set(s.data.set, Date.now());
        const { found, seconds } = await inProcess(s, null);
        finish(s, found, seconds);
      });
      continue;
    }
    const last: Checked[] = s.data.generated?.functions ?? [];
    const checked: Checked[] = functions.map((fn) => withoutChecking(fn) ?? { result: 'error' });
    const todo = functions.flatMap((fn, i) => (withoutChecking(fn) ? [] : [i])).sort((i, j) => (last[j]?.seconds ?? Infinity) - (last[i]?.seconds ?? Infinity));
    let left = todo.length;
    let total = 0;
    let failed: Found | null = null;
    const loose = new Map<string, string[]>(); // each model's loose parts
    for (const i of todo) {
      queue.push(async () => {
        if (!checking.has(s.data.set)) checking.set(s.data.set, Date.now());
        const { found, seconds } = await inProcess(s, i);
        total += seconds;
        if ('functions' in found) {
          checked[i] = found.functions[i];
          loose.set(modelOf(functions[i]), found.loose);
        } else failed ??= found;
        if (--left === 0) finish(s, failed ?? { counts: countsOf(checked), loose: models.flatMap((m) => loose.get(m) ?? []), functions: checked }, total);
      });
    }
  }

  console.log(`Checking ${files.length} sets, ${jobs} at a time`);
  if (leftOut.length) console.log(`Left for the slow check, before a merge to main (npm run functions -- --slow): ${leftOut.map((s) => s.data.set).join(', ')}`);
  // Once a minute, how far it's got, with its functions' results so far as shares of all their
  // functions, as the README has them: "12 done, 173 left; 30 works (37%), 21 partly (26%), 9 no
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
  if (byCount.length) console.log('Causes:\n' + byCount.map(([c, n]) => `  ${String(n).padStart(4)}  ${c} (${CAUSES[c].owner}): ${CAUSES[c].says}`).join('\n'));
  // The mechanism catalog quotes each function's result: written afresh with them.
  if (!causes) execFileSync('npx', ['tsx', 'scripts/mechanisms.ts'], { stdio: 'inherit' });
}
