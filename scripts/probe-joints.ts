// Tries every control of every model: turns each part that turns like a knob (a gear, a wheel, a
// crank, an axle) both ways, as a drag on it does (the joint a drag turns, holding what a drag
// holds), and writes down how far it turns and what it moves: the bodies that go somewhere or
// turn, and how far. A knob that locks after a fraction of a turn, or a wheel that no longer works
// the bucket, shows up as a change from the last time. (Slides, such as pistons and racks, are
// driven by something turning, so they show up in what that moves; so do joints no drag turns
// directly, such as a differential's insides.) There are no collision checks here, as there are
// in the viewer: this is the mechanism alone. Once a minute it says how many models are done and
// how many to go, and which it's working on.
//
// Each model's findings are kept in tests/joints/<model>.json, one line per joint, as a
// baseline. A run compares what it finds with the baseline and lists what got worse (a joint
// that turns much less than it did, a body it no longer moves) and what got better, and fails if
// anything got worse. It's too slow to run with every test, so it's run by hand after a change to
// the mechanism or the kinematics; when a change is meant, the baselines are written afresh.
//
//   npm run joints                    every model in models/, against tests/joints/
//   npm run joints -- 856 952         only models whose file name has one of these in it
//   npm run joints -- --update        write the baselines afresh from this run
//   npm run joints -- --omr           the OMR's sets in omr/ (npm run omr), as a model you open
//                                     yourself would be read, and only the controls a person
//                                     would use (see control below); baselines in omr/controls/
//                                     (or, with a --reach of its own, omr/controls-<reach>/), not
//                                     committed
//   npm run joints -- --omr --all     every knob of the OMR's sets; baselines in omr/joints/ (or
//                                     omr/joints-<reach>/)
//   npm run joints -- --resume        skip the models that have a baseline at this reach already,
//                                     and the batches of a model already done, so a long run that
//                                     stopped carries on where it left off
//   npm run joints -- --jobs 4        how many batches to probe at once (default: half the cores)
//   npm run joints -- --reach 0.25    how far to turn each knob each way, in radians (default 1.5):
//                                     a short reach is enough to tell which knobs are stuck, and
//                                     much quicker on big models (a survey of the OMR's sets)
//   npm run joints -- --limit 2       stop a model that takes more than this many hours (default
//                                     4), keeping what it found by then, marked as timed out: a
//                                     model to look into, which --resume doesn't try again
//   npm run joints -- --heartbeat 60  how often (in seconds; default 300) to say where each
//                                     process that has been going that long has got to
//   npm run joints -- --report        no probing: from the baselines, each model's knobs that
//                                     stop after a little, or turn only one way, or can't move at
//                                     all, and the models that timed out
//   npm run joints -- --omr --commit  as each OMR set's baseline is written, commit it to the
//                                     omr-survey branch and push it (see survey-branch.ts), with
//                                     any already written that the branch doesn't have
//
// The smallest models go first. A model is probed in batches of BATCH knobs, each in a process of
// its own, and each batch's findings are kept as it finishes (in .batches/ beside the baselines,
// until the model is done), so a big model shows how far it has got, and --resume carries on
// within it too. Each process also keeps a note of where it has got to (in .status/), which the
// run shows every few minutes for any process that has been going that long.

import { ChildProcess, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { basename, join } from 'node:path';
import { Quaternion, Vector3 } from 'three';
import { loadModel } from './load-model.ts';
import { commitFindings } from './survey-branch.ts';

// How far each knob is turned each way, in radians (unless --reach says otherwise), in steps of STEP.
const REACH = 1.5;
const STEP = 0.05;
// How many hours a model may take (unless --limit says otherwise) before it's stopped.
const LIMIT_HOURS = 4;
// A body counts as moved if it went at least this far (LDU) or turned at least this much (degrees).
const MOVED = 1;
// How many of the bodies a joint moves are written down: the ones that moved most.
const LISTED = 8;
// How many knobs each process probes.
const BATCH = 20;
// The controls a person would use, for the OMR's sets (see control): gears with at least this
// many teeth, reached from outside the model if there's this much room (LDU) round a line out
// from them.
const BIG_GEAR = 20;
const ROOM = 30;
// Got worse: a joint that turned at least WORSE_FROM now turns less than WORSE_SHARE of that, or a
// body that moved at least WORSE_FROM_LDU (or degrees) now doesn't move at all.
const WORSE_FROM = 0.2;
const WORSE_SHARE = 0.8;
const WORSE_FROM_LDU = 5;

// What turning a joint one way did: how far it turned, and the bodies it moved most, by key (see
// bodyKey), each with how far it went (LDU) and turned (degrees).
interface Way {
  turned: number;
  moved: number; // how many bodies it moved in all
  bodies: Record<string, [number, number]>;
}

interface JointFinding {
  joint: string; // bodyB's key "in" bodyA's key
  control?: string; // what kind of control it is, for the OMR's sets: "wheel", "steering wheel", "40 tooth gear"
  worm?: boolean; // it can't turn only because it would drive a worm from its gear's side
  plus: Way;
  minus: Way;
}

interface Baseline {
  model: string;
  reach: number; // how far each knob was turned each way
  timedOut?: number; // stopped after this many hours, its joints only those found by then
  joints: JointFinding[];
}

// Probes one model file, as the viewer reads it: one of KineBrick's own, or (`omr`) a set from
// the OMR, read as a model you open yourself, and then (unless `all`) only the controls a person
// would use. Only its knobs from `from` up to `to`, so a big model can be shared out between
// processes. Says how many knobs it has in all. Tells `status` where it has got to as it goes
// (`often` for each step of a turn, which it may skip).
function probe(file: string, omr: boolean, all: boolean, reach: number, from = 0, to = Infinity, status: (now: string, often?: boolean) => void = () => {}): Baseline & { knobs: number } {
  const { name, parts, mech, kin } = loadModel(file, omr, status);
  status('finding its knobs');

  // A body by its first part, which stays the same as long as the model file does: "p49 3705".
  const bodyKey = (b: number) => {
    const first = Math.min(...mech.bodies[b].parts);
    return b === 0 ? 'frame' : `p${first} ${parts[first].name.replace(/\.dat$/, '')}`;
  };
  // Each body's middle (of its parts' origins), where the model was loaded.
  const middles = mech.bodies.map((body) => body.parts.reduce((sum, p) => sum.add(new Vector3().setFromMatrixPosition(parts[p].matrix)), new Vector3()).divideScalar(Math.max(1, body.parts.length)));

  // Turns a joint one way, from where it is, and says what that did.
  const turnWay = (joint: number, way: number, knob: string): Way => {
    let turned = 0;
    const steps = Math.round(reach / STEP);
    for (let i = 0; i < steps; i++) {
      status(`${knob}, turning it ${way > 0 ? '+' : '-'}, step ${i + 1} of ${steps}`, true);
      const t = kin.turnJoint(joint, way * STEP);
      turned += t;
      if (Math.abs(t) < 1e-9) break;
    }
    const moves = mech.bodies.map((_, b) => {
      const went = middles[b].clone().applyMatrix4(kin.poses[b]).distanceTo(middles[b]);
      const q = new Quaternion().setFromRotationMatrix(kin.poses[b]);
      const angle = (2 * Math.acos(Math.min(1, Math.abs(q.w))) * 180) / Math.PI;
      return { b, went, angle };
    });
    const moved = moves.filter((m) => m.went >= MOVED || m.angle >= MOVED).sort((x, y) => y.went + y.angle - (x.went + x.angle));
    const bodies: Record<string, [number, number]> = {};
    for (const m of moved.slice(0, LISTED)) bodies[bodyKey(m.b)] = [Math.round(m.went), Math.round(m.angle)];
    return { turned: Math.round(turned * 100) / 100, moved: moved.length, bodies };
  };
  // Turns a knob both ways from where the model was loaded, holding what a drag on it would hold:
  // chosen once, as both ways start from the same place.
  const turnBothWays = (grabbed: number, joint: number, knob: string) => {
    status(`${knob}, choosing what to hold`);
    kin.reset();
    kin.holdWhatTheDragDoesntNeed(grabbed, () => kin.jointMotion(joint) !== null, joint);
    const worm = kin.againstWorm(grabbed, joint);
    const start = kin.snapshot();
    const plus = turnWay(joint, 1, knob);
    kin.restore(start);
    const minus = turnWay(joint, -1, knob);
    kin.letGoAfterDrag();
    return { ...(worm ? { worm: true } : {}), plus, minus };
  };

  // The controls a person would use: a wheel with a tyre, a steering wheel, or a big gear that
  // can be reached from outside the model (one of its parts with nothing of another body near a
  // line out from it, along one of the six axis directions). Not the pins, axles and small
  // gears inside, nor each link of a track.
  const wheels = new Set(mech.treads.map((t) => t.body));
  const at = parts.map((p) => new Vector3().setFromMatrixPosition(p.matrix));
  const axes = [new Vector3(1, 0, 0), new Vector3(-1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, -1, 0), new Vector3(0, 0, 1), new Vector3(0, 0, -1)];
  const reachable = (i: number) =>
    axes.some((d) =>
      at.every((q, k) => {
        if (mech.bodyOf[k] === mech.bodyOf[i]) return true;
        const r = q.clone().sub(at[i]);
        const along = r.dot(d);
        return along <= 10 || r.addScaledVector(d, -along).length() >= ROOM;
      }),
    );
  const control = (b: number): string | null => {
    if (wheels.has(b)) return 'wheel';
    if (mech.bodies[b].parts.some((p) => mech.roles[p] === 'steering wheel')) return 'steering wheel';
    const big = mech.gears.filter((g) => g.body === b && g.teeth >= BIG_GEAR && !g.worm).sort((x, y) => y.teeth - x.teeth)[0];
    return big && mech.bodies[b].parts.some(reachable) ? `${big.teeth} tooth gear` : null;
  };

  // The knobs: each body a drag turns like a knob, and the joint it turns, as the viewer finds them.
  const knobs = mech.bodies.flatMap((_, b) => {
    const link = kin.parentLink(b);
    if (!link || !kin.turnsLikeAKnob(b)) return [];
    const what = all ? null : control(b);
    return all || what ? [{ body: b, joint: link.joint, mount: link.parent, what }] : [];
  });
  const joints: JointFinding[] = knobs.slice(from, to).map((knob, k) => {
    const joint = `${bodyKey(knob.body)} in ${bodyKey(knob.mount)}`;
    return { joint, ...(knob.what ? { control: knob.what } : {}), ...turnBothWays(knob.body, knob.joint, `knob ${from + k + 1} of ${knobs.length} (${joint})`) };
  });
  return { model: name, reach, joints, knobs: knobs.length };
}

// A baseline as text: one joint per line, so a change shows as a change of line.
function baselineText(b: Baseline): string {
  return `{\n  "model": ${JSON.stringify(b.model)},\n  "reach": ${b.reach},\n${b.timedOut !== undefined ? `  "timedOut": ${b.timedOut},\n` : ''}  "joints": [\n${b.joints.map((j) => '    ' + JSON.stringify(j)).join(',\n')}\n  ]\n}\n`;
}

// What got worse, and what got better, from a baseline to now.
function compare(before: Baseline, now: Baseline): { worse: string[]; better: string[] } {
  const worse: string[] = [];
  const better: string[] = [];
  const nowByJoint = new Map(now.joints.map((j) => [j.joint, j]));
  for (const was of before.joints) {
    const is = nowByJoint.get(was.joint);
    if (!is) {
      worse.push(`${was.joint}: no longer a joint`);
      continue;
    }
    for (const sign of ['plus', 'minus'] as const) {
      const a = was[sign];
      const b = is[sign];
      const way = sign === 'plus' ? '+' : '-';
      if (Math.abs(a.turned) >= WORSE_FROM && Math.abs(b.turned) < WORSE_SHARE * Math.abs(a.turned)) worse.push(`${was.joint} ${way}: turns ${b.turned} rad, was ${a.turned}`);
      else if (Math.abs(b.turned) >= WORSE_FROM && Math.abs(a.turned) < WORSE_SHARE * Math.abs(b.turned)) better.push(`${was.joint} ${way}: turns ${b.turned} rad, was ${a.turned}`);
      for (const [body, [went, angle]] of Object.entries(a.bodies)) {
        if ((went >= WORSE_FROM_LDU || angle >= WORSE_FROM_LDU) && !(body in b.bodies) && b.moved < a.moved) worse.push(`${was.joint} ${way}: no longer moves ${body} (it went ${went} LDU, turned ${angle}°)`);
      }
    }
  }
  const beforeJoints = new Set(before.joints.map((j) => j.joint));
  for (const j of now.joints) if (!beforeJoints.has(j.joint)) better.push(`${j.joint}: a new joint (turns ${j.plus.turned}, ${j.minus.turned})`);
  return { worse, better };
}

// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const omr = args.includes('--omr');
const update = args.includes('--update');
const jobsAt = args.indexOf('--jobs');
const jobs = jobsAt >= 0 ? Number(args[jobsAt + 1]) : Math.max(1, Math.floor(availableParallelism() / 2));
const reachAt = args.indexOf('--reach');
const reach = reachAt >= 0 ? Number(args[reachAt + 1]) : REACH;
// How often a run says where each process that has been going this long has got to (ms).
const heartbeatAt = args.indexOf('--heartbeat');
const HEARTBEAT = heartbeatAt >= 0 ? Number(args[heartbeatAt + 1]) * 1000 : 5 * 60_000;
// Every knob, or (for the OMR's sets, unless --all) only the controls a person would use.
const all = !omr || args.includes('--all');
const one = args.indexOf('--one'); // (internal) probe this one file (a batch of its knobs) and print its findings
if (one >= 0) {
  const [from, to] = (args[args.indexOf('--knobs') + 1] ?? '0-Infinity').split('-').map(Number);
  // Where it has got to, in a file (--status) for the run to show if this takes long; each step
  // of a turn at most once a second.
  const statusAt = args.indexOf('--status');
  let written = 0;
  const status = (now: string, often = false) => {
    if (statusAt < 0 || (often && Date.now() - written < 1000)) return;
    try {
      writeFileSync(args[statusAt + 1], now);
    } catch {
      // Only a note: never a reason to stop (another run in the same folder may have tidied it away).
    }
    written = Date.now();
  };
  // Let the output drain before the process ends: a pipe takes it in pieces.
  process.stdout.write(JSON.stringify(probe(args[one + 1], omr, all, reach, from, to, status)), () => process.exit(0));
} else {
  await main();
}

// From the baselines: each model's knobs that turn a little and stop (less than WORSE_FROM either
// way), those that turn only one way, and those that can't move at all. Most that can't move at
// all are structure hinged on one pin but held by another (a drag on one says it's jammed), or meant
// not to (a worm's gear, a differential's pinion with the car on the ground); some that turn one
// way are at the end of their travel (a bucket at its lowest). The rest are controls to look at.
function report(dir: string, filters: string[]) {
  const stuck = (w: Way) => Math.abs(w.turned) < WORSE_FROM;
  const baselines: Baseline[] = readdirSync(dir)
    .filter((f) => f.endsWith('.json') && (filters.length === 0 || filters.some((x) => f.includes(x))))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf-8')));
  // The models that took too long first: they need looking into.
  const timedOut = baselines.filter((b) => b.timedOut !== undefined);
  if (timedOut.length) {
    console.log(`Timed out (${timedOut.length}), to look into:`);
    for (const b of timedOut) console.log(`  ${b.model}: stopped after ${b.timedOut} hours, ${b.joints.length} knobs done by then`);
    console.log('');
  }
  for (const b of baselines) {
    if (b.timedOut !== undefined && b.joints.length === 0) continue;
    // Those that would drive a worm from its gear's side are as they should be: not counted as stuck.
    const worm = b.joints.filter((j) => j.worm && stuck(j.plus) && stuck(j.minus));
    const locked = b.joints.filter((j) => j.plus.turned === 0 && j.minus.turned === 0 && !worm.includes(j));
    const stops = b.joints.filter((j) => stuck(j.plus) && stuck(j.minus) && !locked.includes(j) && !worm.includes(j));
    const oneWay = b.joints.filter((j) => stuck(j.plus) !== stuck(j.minus));
    console.log(`${b.model}: ${b.joints.length} knobs; ${stops.length} stop after a little, ${oneWay.length} turn only one way, ${locked.length} can't move at all${worm.length ? ` (and ${worm.length} against a worm, as they should be)` : ''}`);
    const what = (j: JointFinding) => (j.control ? `, a ${j.control}` : '');
    for (const j of stops) console.log(`  stops:    ${j.joint} (${j.plus.turned}, ${j.minus.turned}${what(j)})`);
    for (const j of oneWay) console.log(`  one way:  ${j.joint} (${j.plus.turned}, ${j.minus.turned}${what(j)})`);
    for (const j of locked) console.log(`  locked:   ${j.joint}${j.control ? ` (a ${j.control})` : ''}`);
  }
}

async function main() {
  const filters = args.filter((a, i) => !a.startsWith('--') && !['--jobs', '--reach', '--heartbeat', '--limit'].includes(args[i - 1]));
  const limitAt = args.indexOf('--limit');
  const limitHours = limitAt >= 0 ? Number(args[limitAt + 1]) : LIMIT_HOURS;
  const modelsDir = omr ? 'omr' : 'models';
  const baselineDir = omr ? join('omr', (all ? 'joints' : 'controls') + (reach === REACH ? '' : `-${reach}`)) : join('tests', 'joints');
  const resume = args.includes('--resume');
  // With --resume, a model whose baseline is already at this reach is done.
  const done = (f: string) => {
    const path = join(baselineDir, f.replace(/\.(ldr|mpd)$/i, '.json'));
    return resume && existsSync(path) && JSON.parse(readFileSync(path, 'utf-8')).reach === reach;
  };
  const models = readdirSync(modelsDir).filter((f) => /\.(ldr|mpd)$/i.test(f) && (filters.length === 0 || filters.some((x) => f.includes(x))));
  // Smallest first (by its file's size: fewer parts, fewer knobs), to get through the most soonest.
  const files = models
    .filter((f) => !done(f))
    .map((f) => join(modelsDir, f))
    .sort((a, b) => statSync(a).size - statSync(b).size || a.localeCompare(b, undefined, { numeric: true }));
  if (args.includes('--report')) return report(baselineDir, filters);
  mkdirSync(baselineDir, { recursive: true });
  // With --commit, the OMR's findings go to the omr-survey branch as they're written. Git
  // trouble is reported, not fatal: the survey goes on.
  const commit = () => {
    if (!omr || !args.includes('--commit')) return;
    try {
      commitFindings(baselineDir, (all ? 'every knob, ' : '') + (reach === REACH ? 'full' : `quick, reach ${reach}`));
    } catch (err) {
      console.log(`Couldn't commit to the omr-survey branch: ${(err as Error).message}`);
    }
  };
  commit();

  // A model under way: how many knobs it has (-1 while they're being counted), what the batches
  // done so far found, and its processes, so one that takes too long can be stopped.
  interface Model {
    model: string;
    batchesDir: string;
    knobs: number;
    done: number;
    found: JointFinding[];
    started: number;
    children: Set<ChildProcess>;
    running: number; // processes, or counting
    timedOut: boolean;
    over: boolean; // its baseline written, or given up on
  }
  // The processes under way, each with the file it says where it has got to in (see --status).
  const running = new Set<{ what: string; status: string; started: number }>();
  const statusDir = join(baselineDir, '.status');
  mkdirSync(statusDir, { recursive: true });

  // A batch of a model's knobs (from up to to) in a process of its own, which also counts them all
  // (from = to = 0 only counts them).
  function probeInChild(file: string, state: Model, from: number, to: number): Promise<Baseline & { knobs: number }> {
    const job = { what: to > 0 ? `${state.model}, knobs ${from + 1} to ${to}` : `${state.model}, counting its knobs`, status: join(statusDir, `${state.model} ${from}-${to}.txt`), started: Date.now() };
    running.add(job);
    state.running++;
    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [...process.execArgv, process.argv[1], '--one', file, '--knobs', `${from}-${to}`, '--reach', String(reach), '--status', job.status, ...(omr ? ['--omr'] : []), ...(all ? ['--all'] : [])], { stdio: ['ignore', 'pipe', 'inherit'] });
      state.children.add(child);
      let out = '';
      child.stdout.on('data', (d) => (out += d));
      child.on('close', (code) => {
        running.delete(job);
        state.children.delete(child);
        state.running--;
        rmSync(job.status, { force: true });
        try {
          if (code !== 0) throw new Error(`exit ${code}`);
          resolve(JSON.parse(out));
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  let failed = false;
  const modelsLeft = [...files];
  const under = new Set<Model>(); // the models started and not over
  let over = models.length - files.length; // how many models are done, counting those --resume skipped
  const batches: { file: string; state: Model; from: number; to: number }[] = [];
  const since = (start: number) => {
    const seconds = Math.round((Date.now() - start) / 1000);
    return seconds < 120 ? `${seconds} s` : `${Math.round(seconds / 60)} min`;
  };
  const elapsed = (state: Model) => since(state.started);
  const end = (state: Model) => {
    state.over = true;
    under.delete(state);
    over++;
  };

  // Once all of a model's batches are in, compare what they found with its baseline.
  function finish(state: Model) {
    end(state);
    rmSync(state.batchesDir, { recursive: true, force: true });
    const now: Baseline = { model: state.model, reach, joints: state.found.sort((a, b) => a.joint.localeCompare(b.joint, undefined, { numeric: true })) };
    const path = join(baselineDir, `${now.model}.json`);
    if (update || !existsSync(path)) {
      writeFileSync(path, baselineText(now));
      console.log(`${now.model}: ${now.joints.length} knobs, baseline written (${elapsed(state)})`);
      commit();
      return;
    }
    const before: Baseline = JSON.parse(readFileSync(path, 'utf-8'));
    if (before.reach !== now.reach) {
      console.log(`${now.model}: its baseline turned each knob ${before.reach} rad, this run ${now.reach}: not compared (write it afresh with --update, or run with --reach ${before.reach})`);
      failed = true;
      return;
    }
    const { worse, better } = compare(before, now);
    const lines = [`${now.model}: ${now.joints.length} knobs, ${worse.length ? `${worse.length} worse` : 'none worse'}${better.length ? `, ${better.length} better` : ''} (${elapsed(state)})`];
    for (const w of worse) lines.push(`  worse:  ${w}`);
    for (const b of better) lines.push(`  better: ${b}`);
    console.log(lines.join('\n'));
    if (worse.length) failed = true;
  }

  // A model that took more than limitHours, once its processes have stopped: what it found by
  // then, marked as timed out (kept for the OMR's sets, and new models; for one of KineBrick's own
  // with a baseline, a failure). Its batches stay kept, but --resume won't try it again.
  function timeOut(state: Model) {
    end(state);
    const joints = state.found.sort((a, b) => a.joint.localeCompare(b.joint, undefined, { numeric: true }));
    const path = join(baselineDir, `${state.model}.json`);
    console.log(`${state.model}: timed out after ${limitHours} hours, ${joints.length} knobs done by then; to look into`);
    if (omr || update || !existsSync(path)) {
      writeFileSync(path, baselineText({ model: state.model, reach, timedOut: limitHours, joints }));
      commit();
    } else {
      failed = true;
    }
  }

  // Each worker takes the next batch waiting, or else starts on the next model: counts its knobs
  // and puts its batches in the queue (those already done, with --resume, read back instead). With
  // neither, it waits for any model still being counted, whose batches may be for it.
  let counting = 0;
  const waiting: (() => void)[] = [];
  const counted = () => {
    counting--;
    for (const wake of waiting.splice(0)) wake();
  };
  async function worker() {
    for (;;) {
      const batch = batches.shift();
      if (!batch) {
        const file = modelsLeft.shift();
        if (!file) {
          if (counting === 0) return;
          await new Promise<void>((wake) => waiting.push(wake));
          continue;
        }
        const model = basename(file).replace(/\.(ldr|mpd)$/i, '');
        const state: Model = { model, batchesDir: join(baselineDir, '.batches', model), knobs: -1, done: 0, found: [], started: Date.now(), children: new Set(), running: 0, timedOut: false, over: false };
        under.add(state);
        let count: Baseline & { knobs: number };
        counting++;
        // The first batch too, while it's at it: each process works the mechanism out afresh,
        // and most models have no more knobs than a batch. (Not one --resume has already.)
        const firstDone = resume && existsSync(state.batchesDir) && readdirSync(state.batchesDir).some((f) => f.startsWith('0-'));
        const first = firstDone ? 0 : BATCH;
        try {
          count = await probeInChild(file, state, 0, first);
        } catch (err) {
          if (state.timedOut) timeOut(state);
          else {
            console.log(`${file}: ${(err as Error).message}`);
            failed = true;
            end(state);
          }
          counted();
          continue;
        }
        state.knobs = count.knobs;
        if (!resume) rmSync(state.batchesDir, { recursive: true, force: true });
        for (let from = 0; from < state.knobs; from += BATCH) {
          const to = Math.min(state.knobs, from + BATCH);
          const saved = join(state.batchesDir, `${from}-${to}.json`);
          if (from === 0 && first > 0) {
            mkdirSync(state.batchesDir, { recursive: true });
            writeFileSync(saved, JSON.stringify(count.joints));
            state.found.push(...count.joints);
            state.done += to - from;
          } else if (existsSync(saved)) {
            state.found.push(...JSON.parse(readFileSync(saved, 'utf-8')));
            state.done += to - from;
          } else batches.push({ file, state, from, to });
        }
        counted();
        if (state.done === state.knobs) finish(state);
        continue;
      }
      const { file, state, from, to } = batch;
      if (state.over) continue;
      if (state.timedOut) {
        if (state.running === 0) timeOut(state);
        continue;
      }
      let part: Baseline | null = null;
      try {
        part = await probeInChild(file, state, from, to);
      } catch (err) {
        if (!state.timedOut) {
          console.log(`${file}, knobs ${from + 1} to ${to}: ${(err as Error).message}`);
          failed = true;
        }
      }
      if (part) {
        mkdirSync(state.batchesDir, { recursive: true });
        writeFileSync(join(state.batchesDir, `${from}-${to}.json`), JSON.stringify(part.joints));
        state.found.push(...part.joints);
        state.done += to - from;
      }
      if (state.timedOut) {
        if (state.running === 0 && !state.over) timeOut(state);
      } else if (part && state.done < state.knobs) console.log(`${state.model}: ${state.done} of ${state.knobs} knobs (${elapsed(state)})`);
      else if (part) finish(state);
    }
  }
  // Once a minute: how many models are done and to go, and which are being worked on.
  const minute = setInterval(() => {
    const working = [...under].map((m) => m.model + (m.knobs < 0 ? ' (counting its knobs)' : m.knobs > BATCH ? ` (${m.done} of ${m.knobs} knobs)` : ''));
    console.log(`[${new Date().toTimeString().slice(0, 5)}] ${over} done, ${models.length - over} to go; working on ${working.join(', ')}`);
  }, 60_000);
  // Every few minutes, a line for each process that has been going that long, so a long run shows
  // it isn't stuck: where the process has got to, and how long since that changed (a single step
  // of a turn going on for hours would be stuck).
  const heartbeat = setInterval(() => {
    for (const job of running) {
      if (Date.now() - job.started < HEARTBEAT) continue;
      let now = 'starting';
      let changed = job.started;
      try {
        now = readFileSync(job.status, 'utf-8');
        changed = statSync(job.status).mtimeMs;
      } catch {
        // Nothing written yet.
      }
      console.log(`  still on ${job.what} (${since(job.started)}): ${now}, ${since(changed)} ago`);
    }
  }, HEARTBEAT);
  // A model that has taken more than limitHours is stopped: its processes, and its batches still
  // waiting to start.
  const watchdog = setInterval(() => {
    for (const state of under) {
      if (state.timedOut || Date.now() - state.started < limitHours * 3600_000) continue;
      state.timedOut = true;
      for (const child of state.children) child.kill();
    }
  }, 10_000);
  await Promise.all(Array.from({ length: Math.max(1, jobs) }, worker));
  clearInterval(minute);
  clearInterval(heartbeat);
  clearInterval(watchdog);
  rmSync(statusDir, { recursive: true, force: true });
  // The batches' folder too, unless some are kept (a model that failed), for --resume.
  try {
    rmdirSync(join(baselineDir, '.batches'));
  } catch {
    // Not there, or not empty.
  }
  if (failed && !update) {
    console.log('Some joints got worse, or a model failed (see above). If the changes were meant, write the baselines afresh: npm run joints -- --update');
    process.exit(1);
  }
}
