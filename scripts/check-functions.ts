// Checks each real LEGO set's functions (curated.functions in data/sets/<set>.json, what each
// control is supposed to do) against what Kinebrick does with the set's model, and writes what it
// found into the set's generated section, afresh each time. Each function's control is worked
// both ways from where the model was loaded (after its `first` controls), as a drag on it would
// (holding what a drag holds): a turn of REACH radians, or a push of PUSH LDU for a slide. A way
// works if the control goes at least half that far, every part in `moves` moves and no part in
// `stays` does, each against the frame or the part it names. A function works if one way works
// for each of its controls; it partly works if something moves; otherwise it doesn't.
//
// How much, too. For each part in `moves` and `stays`, it writes how far the part turned
// (radians) and slid (LDU) for each radian the control turned, adding up every step of the way
// it went (`rates`). Where tooth counts alone say how fast a part should turn (see gearRates),
// it writes that (`expected`), and lists the parts more than RATE_OFF off it (`wrong`). And each
// way is worked back again, as a new drag: everything should come back to where it started
// (`back`: the furthest any part is left from it, LDU and degrees; `strayed`: parts left more
// than BACK away).
//
//   npm run functions                 every set with functions
//   npm run functions -- 855 8880     only sets whose number has one of these in it
//   npm run functions -- --jobs 4     how many sets to check at once (default: half the cores)
//   npm run functions -- --limit 20   stop a set that takes more than this many minutes (default
//                                     30), marking it as timed out
//   npm run functions -- --quick      only the quick sets (QUICK): a couple of minutes, for every
//                                     change; the whole check is for overnight
//
// Each set's results are compared with what it had before, and each function that comes out
// better or worse is listed as the run goes.
//
// Each set is checked in a process of its own. generated has the commit it was checked at (and
// "uncommitted": true if src/ or data/ had changes not yet committed, and "least": true if checked
// with KINEBRICK_LEAST=1), the date, how many functions came out each way, the model's loose
// parts, and one entry per function, in the same order as curated.functions: its result, how far
// each control went each way, and the parts that didn't do what they should ("still": in `moves`
// but didn't move; "moved": in `stays` but did).

import { execFileSync, execSync, spawn } from 'node:child_process';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join } from 'node:path';
import { Matrix4, Quaternion, Vector3 } from 'three';
import { Kinematics } from '../src/kinematics.ts';
import { PlacedPart } from '../src/ldr.ts';
import { Mechanism } from '../src/mechanism.ts';
import { Catch, catchShifts, findCatches, findSliders, nearestPosition, Slider, sliderMovedTo, sliderPosition } from '../src/shift.ts';
import { gearRates } from './gear-rates.ts';
import { loadModel } from './load-model.ts';

const SETS_DIR = join('data', 'sets');
// How far a control is turned each way (radians), or pushed (LDU) if it slides.
const REACH = 1.5;
const PUSH = 20;
// A part counts as moved if it went at least this far (LDU) or turned at least this much (degrees).
const MOVED = 1;
const LIMIT_MINUTES = 30;
// A drag is measured in pieces of this many radians (or LDU, for a slide), adding up how far each
// part went in each: a part geared up turns further than half a turn, which its pose alone can't
// tell.
const PIECE = 0.1;
// A part counts as moving by the wrong amount if its rate is more than this share off what its
// gears say.
const RATE_OFF = 0.03;
// After there and back, a part counts as having strayed if it's this far (LDU) or this much
// (degrees) from where it started.
const BACK = 0.5;
// The quick sets: between them, every kind of mechanism the check can work (in the mechanism
// catalog), but two only the slow 42054 and 42055 have, chosen for the least time the check
// takes: about 6 minutes of one core's time in all, at 0.850.
const QUICK = ['8270', '42107', '8849', '42061', '42109', '8001', '8204', '8245', '8851', '8856', '8208', '8448', '8824', '8202', '42084', '42074', '42071', '8845', '8837', '858', '8074', '42063', '42057', '42065', '956', '8081', '8049', '8416', '42112', '42129', '9394', '42000', '42114'];

type Result = 'works' | 'partly' | 'no' | 'skipped' | 'not checked' | 'error';
interface Checked {
  result: Result;
  turned?: [number, number][]; // each control's turn (or push), each way
  still?: string[];
  moved?: string[];
  rates?: Record<string, [number, number]>[]; // for each control, in the way taken, each listed part's turning and sliding for each radian it turned
  expected?: Record<string, number>[]; // for each control, what its gears say for the parts that have a say
  wrong?: string[];
  back?: [number, number][][]; // for each control, each way: the furthest a part is left after there and back (LDU, degrees)
  strayed?: string[];
  why?: string[];
}
interface Fn {
  control?: string | string[];
  moves?: string[];
  stays?: string[];
  first?: { control: string; by: number }[];
  skip?: string;
  model?: string; // its own model, for a set with several (the 858's four engines)
}

// Checks one set's functions on its model, or each on its own; what goes in its generated
// section, but for the commit and date.
function check(set: { curated: { model: string; functions: Fn[] } }) {
  const { model, functions } = set.curated;
  const modelOf = (fn: Fn) => fn.model ?? model;
  const checked: Checked[] = [];
  const loose: string[] = [];
  for (const m of new Set(functions.map(modelOf))) {
    const found = checkModel(m, functions.filter((fn) => modelOf(fn) === m));
    functions.forEach((fn, i) => {
      if (modelOf(fn) === m) checked[i] = found.checked.shift()!;
    });
    loose.push(...found.loose.map((p) => (m === model ? p : `${p} in ${m}`)));
  }
  const counts: Partial<Record<Result | 'wrong amount' | 'not back', number>> = {};
  const count = (what: keyof typeof counts) => (counts[what] = (counts[what] ?? 0) + 1);
  for (const c of checked) {
    count(c.result);
    if (c.wrong) count('wrong amount');
    if (c.strayed) count('not back');
  }
  return { counts, loose, functions: checked };
}

// Checks functions on one model: each one's result, and the model's loose parts.
function checkModel(model: string, functions: Fn[]) {
  const loaded = loadModel(model, model.startsWith('omr/'));
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
    use(loaded.read(now));
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
  // Works a body's joint as a drag does, as far as it goes up to `amount`; how far it went.
  const turn = (body: number, amount: number) => {
    const joint = kin.parentLink(body)!.joint;
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
  // (LDU) against its body on the way.
  const turnMeasuring = (body: number, amount: number, parts: { part: number; body: number }[]) => {
    const joint = kin.parentLink(body)!.joint;
    kin.holdWhatTheDragDoesntNeed(body, () => kin.jointMotion(joint) !== null, joint);
    const went = parts.map(() => [0, 0]);
    let was = parts.map((p) => relative(p.part, p.body, kin.poses));
    let turned = 0;
    while (Math.abs(turned) < Math.abs(amount) - 1e-9) {
      const piece = Math.sign(amount) * Math.min(PIECE, Math.abs(amount) - Math.abs(turned));
      const step = kin.turnJoint(joint, piece, () => kin.atLimit() === null);
      turned += step;
      const is = parts.map((p) => relative(p.part, p.body, kin.poses));
      parts.forEach((p, k) => {
        went[k][0] += angle(was[k], is[k]);
        went[k][1] += at[p.part].clone().applyMatrix4(is[k]).distanceTo(at[p.part].clone().applyMatrix4(was[k]));
      });
      was = is;
      if (Math.abs(step) < Math.abs(piece) - 1e-9) break;
    }
    kin.letGoAfterDrag();
    return { turned, went };
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

  const checkOne = (fn: Fn): Checked => {
    if (fn.skip) return { result: 'skipped' };
    if (!fn.control) return { result: 'not checked' };
    const why: string[] = [];
    const ways = [fn.control].flat().map((ref) => {
      use(asLoaded);
      kin.reset();
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
      }
      // Measured on the model as it is now, after any shift.
      const moves = (fn.moves ?? []).map(against);
      const stays = (fn.stays ?? []).map(against);
      const control = part(ref);
      const b = worked(control);
      const link = kin.parentLink(b);
      if (b === 0 || !link) {
        why.push(`${ref} ${b === 0 ? 'is part of the frame' : 'has no joint to work'}`);
        return { works: false, turned: [0, 0] as [number, number], still: moves.map((m) => m.ref), moved: [] as string[], something: false, rates: {}, expected: {}, off: [] as string[], back: [] as [number, number][], strayed: [] as string[] };
      }
      const reach = mech.joints[link.joint].kind === 'slide' ? PUSH : REACH;
      const start = kin.snapshot();
      const startPoses = kin.poses.map((m) => m.clone());
      const listed = [...moves, ...stays];
      // What the gears say, for listed parts measured against the frame (not those on the
      // control's own body, which turn with it whatever the gears do).
      const geared = gearRates(mech, (x) => kin.parentLink(x), b);
      const expected: Record<string, number> = {};
      for (const m of listed) if (m.body === 0 && mech.bodyOf[m.part] !== b && geared.has(mech.bodyOf[m.part])) expected[m.ref] = sig(geared.get(mech.bodyOf[m.part])!);
      const each = [1, -1].map((way) => {
        kin.restore(start);
        const { turned, went } = turnMeasuring(b, way * reach, listed);
        const shifted = catchShifts(placedNow(), table, catches);
        const still = moves.filter((m) => !moved(m, startPoses, shifted)).map((m) => m.ref);
        const wrong = stays.filter((s) => moved(s, startPoses, shifted)).map((s) => s.ref);
        const rates: Record<string, [number, number]> = {};
        listed.forEach((m, k) => (rates[m.ref] = Math.abs(turned) > 1e-6 ? [sig(went[k][0] / Math.abs(turned)), sig(went[k][1] / Math.abs(turned))] : [0, 0]));
        // A rate is the part's turning, or its sliding if it slides on its joint.
        const rateOf = (m: (typeof listed)[number]) => rates[m.ref][kin.parentLink(mech.bodyOf[m.part]) && mech.joints[kin.parentLink(mech.bodyOf[m.part])!.joint].kind === 'slide' ? 1 : 0];
        const off = listed.filter((m) => m.ref in expected && Math.abs(turned) >= 0.01 && Math.abs(rateOf(m) - expected[m.ref]) > RATE_OFF * expected[m.ref]).map((m) => m.ref);
        // There and back: worked back as far as it went, as a new drag.
        const there = kin.snapshot();
        if (Math.abs(turned) >= 0.01) turn(b, -turned);
        const most = furthest(startPoses);
        kin.restore(there);
        const back: [number, number] = [round(most.ldu), round(most.degrees)];
        const strayed = most.ldu > BACK || most.degrees > BACK ? [name(most.part)] : [];
        return { turned, still, moved: wrong, rates, off, back, strayed, works: Math.abs(turned) >= reach / 2 && !still.length && !wrong.length };
      });
      kin.restore(start);
      // The better way: one that works, or else the one with fewer wrong parts that went further.
      const best = [...each].sort((x, y) => Number(y.works) - Number(x.works) || x.still.length + x.moved.length - (y.still.length + y.moved.length) || Math.abs(y.turned) - Math.abs(x.turned))[0];
      const something = each.some((w) => Math.abs(w.turned) >= 0.01 || w.still.length < moves.length);
      return { works: best.works, turned: each.map((w) => round(w.turned)) as [number, number], still: best.still, moved: best.moved, something, rates: best.rates, expected, off: best.off, back: each.map((w) => w.back), strayed: each.flatMap((w) => w.strayed) };
    });
    const result: Result = ways.every((w) => w.works) ? 'works' : ways.some((w) => w.something) ? 'partly' : 'no';
    const still = [...new Set(ways.flatMap((w) => w.still))];
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
      ...(why.length ? { why: [...new Set(why)] } : {}),
    };
  };

  const checked = functions.map((fn) => {
    try {
      return checkOne(fn);
    } catch (err) {
      return { result: 'error' as Result, why: [(err as Error).message] };
    }
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
      const [backBefore, backNow] = [before.strayed?.length ?? 0, c.strayed?.length ?? 0];
      if (backNow !== backBefore) lines.push(`${backNow < backBefore ? 'better' : 'worse'}: ${what} ${backNow} parts not back, had ${backBefore}`);
    }
  });
  return lines;
}

// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const one = args.indexOf('--one'); // (internal) check this one set's file and print what it found
if (one >= 0) {
  const found = check(JSON.parse(readFileSync(args[one + 1], 'utf-8')));
  // Let the output drain before the process ends: a pipe takes it in pieces.
  process.stdout.write(JSON.stringify(found), () => process.exit(0));
} else {
  await main();
}

async function main() {
  const jobsAt = args.indexOf('--jobs');
  const jobs = jobsAt >= 0 ? Number(args[jobsAt + 1]) : Math.max(1, Math.floor(availableParallelism() / 2));
  const limitAt = args.indexOf('--limit');
  const limit = limitAt >= 0 ? Number(args[limitAt + 1]) : LIMIT_MINUTES;
  const named = args.filter((a, i) => !a.startsWith('--') && !['--jobs', '--limit'].includes(args[i - 1]));
  // A set's number, followed by "-" so that 855 doesn't also pick the 8855.
  const filters = args.includes('--quick') ? QUICK.map((n) => `${n}-`) : named;
  const commit = execSync('git rev-parse --short HEAD').toString().trim();
  // No shell, so the pathspec isn't left quoted by Windows' cmd.
  const uncommitted = execFileSync('git', ['status', '--porcelain', '--', 'src', 'data', ':!data/sets']).toString().trim() !== '';
  const date = new Date().toISOString().slice(0, 10);
  // Checked with the experimental least-motion drags (KINEBRICK_LEAST=1; see docs/least-motion.md).
  const least = process.env.KINEBRICK_LEAST === '1';

  // The sets with functions, smallest model first.
  const files = readdirSync(SETS_DIR)
    .filter((f) => f.endsWith('.json') && (filters.length === 0 || filters.some((x) => f.includes(x))))
    .map((f) => ({ file: join(SETS_DIR, f), data: JSON.parse(readFileSync(join(SETS_DIR, f), 'utf-8')) }))
    .filter((s) => s.data.curated.functions?.length)
    .sort((a, b) => statSync(a.data.curated.model).size - statSync(b.data.curated.model).size);

  // The sets being checked, and when each was started; how many are done, and their functions'
  // results so far.
  const checking = new Map<string, number>();
  let done = 0;
  const results: Partial<Record<Result, number>> = {};
  const run = (s: (typeof files)[number]) =>
    new Promise<void>((resolve) => {
      const started = Date.now();
      checking.set(s.data.set, started);
      const child = spawn(process.execPath, [...process.execArgv, process.argv[1], '--one', s.file], { stdio: ['ignore', 'pipe', 'inherit'] });
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
        let found: ReturnType<typeof check> | { timedOut: number } | { failed: string };
        if (timedOut) found = { timedOut: limit };
        else {
          try {
            if (code !== 0) throw new Error(`exit ${code}`);
            found = JSON.parse(out);
          } catch (err) {
            found = { failed: (err as Error).message };
          }
        }
        // Read afresh, so only generated changes, whatever else changed meanwhile.
        const data = JSON.parse(readFileSync(s.file, 'utf-8'));
        if ('functions' in found) for (const line of changes(data.curated.functions, data.generated?.functions ?? [], found.functions)) console.log(`${data.set}: ${line}`);
        data.generated = { commit, ...(uncommitted ? { uncommitted } : {}), ...(least ? { least } : {}), date, ...found };
        writeFileSync(s.file, JSON.stringify(data, null, 2) + '\n');
        const summary = 'counts' in found ? Object.entries(found.counts).map(([k, n]) => `${n} ${k}`).join(', ') : 'timedOut' in found ? `timed out after ${limit} minutes` : `failed: ${found.failed}`;
        console.log(`${data.set}: ${summary} (${seconds} s)`);
        checking.delete(s.data.set);
        done++;
        if ('counts' in found) for (const [k, n] of Object.entries(found.counts)) if (k in RANK) results[k as Result] = (results[k as Result] ?? 0) + n;
        resolve();
      });
    });

  console.log(`Checking ${files.length} sets, ${jobs} at a time`);
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
  const queue = [...files];
  await Promise.all(
    Array.from({ length: jobs }, async () => {
      for (let s = queue.shift(); s; s = queue.shift()) await run(s);
    }),
  );
  clearInterval(progress);
  // The mechanism catalog quotes each function's result: written afresh with them.
  execFileSync('npx', ['tsx', 'scripts/mechanisms.ts'], { stdio: 'inherit' });
}
