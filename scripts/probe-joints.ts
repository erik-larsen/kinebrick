// Tries every control of every model: turns each part that turns like a knob (a gear, a wheel, a
// crank, an axle) both ways, as a drag on it does (the joint a drag turns, holding what a drag
// holds), and writes down how far it turns and what it moves: the bodies that go somewhere or
// turn, and how far. A knob that locks after a fraction of a turn, or a wheel that no longer works
// the bucket, shows up as a change from the last time. (Slides, such as pistons and racks, are
// driven by something turning, so they show up in what that moves; so do joints no drag turns
// directly, such as a differential's insides.) There are no collision checks here, as there are
// in the viewer: this is the mechanism alone.
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
//                                     yourself would be read; baselines in omr/joints/, not committed
//   npm run joints -- --jobs 4        how many models to probe at once (default: half the cores)
//   npm run joints -- --report        no probing: from the baselines, each model's knobs that
//                                     stop after a little, or turn only one way, or can't move at all

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join } from 'node:path';
import { Quaternion, Vector3 } from 'three';
import { ConnectionTable, libraryConnections } from '../src/connections.ts';
import { DEFAULT_SCRUB, Kinematics } from '../src/kinematics.ts';
import { modelSettings, parseModel } from '../src/ldr.ts';
import { inferMechanism } from '../src/mechanism.ts';

// How far each joint is turned each way, in radians, in steps of STEP.
const REACH = 1.5;
const STEP = 0.05;
// A body counts as moved if it went at least this far (LDU) or turned at least this much (degrees).
const MOVED = 1;
// How many of the bodies a joint moves are written down: the ones that moved most.
const LISTED = 8;
// A model file is probed in one process for each this many bytes of it (up to --jobs).
const CHUNK_BYTES = 100_000;
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
  plus: Way;
  minus: Way;
}

interface Baseline {
  model: string;
  joints: JointFinding[];
}

// Probes one model file, as the viewer reads it: one of KineBrick's own, or (`omr`) a set from
// the OMR, read as a model you open yourself. Only every `of`-th knob, from the `chunk`-th, so a
// big model can be shared out between processes.
function probe(file: string, omr: boolean, chunk = 0, of = 1): Baseline {
  const text = readFileSync(file, 'utf-8');
  const name = file.replace(/^.*\//, '').replace(/\.(ldr|mpd)$/i, '');
  const roles: Record<string, string> = JSON.parse(readFileSync('data/roles.json', 'utf-8'));
  const packedModels: Record<string, { primitives: string[]; pieces: Record<string, string[]> }> = JSON.parse(readFileSync('packed/models.json', 'utf-8'));
  let table: ConnectionTable;
  let isPrimitive: (n: string) => boolean;
  let piecesOf: (n: string) => string[] | null;
  if (omr) {
    table = libraryConnections(JSON.parse(readFileSync('data/library-connections.json', 'utf-8')));
    const primitives = new Set<string>(JSON.parse(readFileSync('packed/primitives.json', 'utf-8')));
    // The parts read as their pieces, from whichever of KineBrick's own models has them.
    const pieces = Object.assign({}, ...Object.values(packedModels).map((m) => m.pieces)) as Record<string, string[]>;
    isPrimitive = (n) => primitives.has(n);
    piecesOf = (n) => pieces[n] ?? null;
  } else {
    table = JSON.parse(readFileSync('data/connections.json', 'utf-8'));
    const packed = packedModels[name];
    const primitives = new Set(packed?.primitives ?? []);
    isPrimitive = (n) => primitives.has(n);
    piecesOf = (n) => packed?.pieces[n] ?? null;
  }
  const { parts, paths } = parseModel(text, isPrimitive, piecesOf);
  const mech = inferMechanism(parts, table, roles, paths);
  const kin = new Kinematics(mech);
  kin.scrub = (modelSettings(text).scrub ?? DEFAULT_SCRUB * 100) / 100;

  // A body by its first part, which stays the same as long as the model file does: "p49 3705".
  const bodyKey = (b: number) => {
    const first = Math.min(...mech.bodies[b].parts);
    return b === 0 ? 'frame' : `p${first} ${parts[first].name.replace(/\.dat$/, '')}`;
  };
  // Each body's middle (of its parts' origins), where the model was loaded.
  const middles = mech.bodies.map((body) => body.parts.reduce((sum, p) => sum.add(new Vector3().setFromMatrixPosition(parts[p].matrix)), new Vector3()).divideScalar(Math.max(1, body.parts.length)));

  const turnWay = (grabbed: number, joint: number, way: number): Way => {
    kin.reset();
    kin.holdWhatTheDragDoesntNeed(grabbed, () => kin.jointMotion(joint) !== null, joint);
    let turned = 0;
    for (let i = 0; i < Math.round(REACH / STEP); i++) {
      const t = kin.turnJoint(joint, way * STEP);
      turned += t;
      if (Math.abs(t) < 1e-9) break;
    }
    kin.letGoAfterDrag();
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

  // The knobs: each body a drag turns like a knob, and the joint it turns, as the viewer finds them.
  const knobs = mech.bodies.flatMap((_, b) => {
    const link = kin.parentLink(b);
    return link && kin.turnsLikeAKnob(b) ? [{ body: b, joint: link.joint, mount: link.parent }] : [];
  });
  const joints: JointFinding[] = [];
  knobs.forEach((knob, k) => {
    if (k % of !== chunk) return;
    joints.push({ joint: `${bodyKey(knob.body)} in ${bodyKey(knob.mount)}`, plus: turnWay(knob.body, knob.joint, 1), minus: turnWay(knob.body, knob.joint, -1) });
  });
  joints.sort((a, b) => a.joint.localeCompare(b.joint, undefined, { numeric: true }));
  return { model: name, joints };
}

// A baseline as text: one joint per line, so a change shows as a change of line.
function baselineText(b: Baseline): string {
  return `{\n  "model": ${JSON.stringify(b.model)},\n  "joints": [\n${b.joints.map((j) => '    ' + JSON.stringify(j)).join(',\n')}\n  ]\n}\n`;
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
const one = args.indexOf('--one'); // (internal) probe this one file (a chunk of it) and print its findings
if (one >= 0) {
  const [chunk, of] = (args[args.indexOf('--chunk') + 1] ?? '0/1').split('/').map(Number);
  // Let the output drain before the process ends: a pipe takes it in pieces.
  process.stdout.write(JSON.stringify(probe(args[one + 1], omr, chunk, of)), () => process.exit(0));
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
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.json') && (filters.length === 0 || filters.some((x) => f.includes(x)))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))) {
    const b: Baseline = JSON.parse(readFileSync(join(dir, f), 'utf-8'));
    const locked = b.joints.filter((j) => j.plus.turned === 0 && j.minus.turned === 0);
    const stops = b.joints.filter((j) => stuck(j.plus) && stuck(j.minus) && !locked.includes(j));
    const oneWay = b.joints.filter((j) => stuck(j.plus) !== stuck(j.minus));
    console.log(`${b.model}: ${b.joints.length} knobs; ${stops.length} stop after a little, ${oneWay.length} turn only one way, ${locked.length} can't move at all`);
    for (const j of stops) console.log(`  stops:    ${j.joint} (${j.plus.turned}, ${j.minus.turned})`);
    for (const j of oneWay) console.log(`  one way:  ${j.joint} (${j.plus.turned}, ${j.minus.turned})`);
    for (const j of locked) console.log(`  locked:   ${j.joint}`);
  }
}

async function main() {
  const filters = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--jobs');
  const modelsDir = omr ? 'omr' : 'models';
  const baselineDir = omr ? join('omr', 'joints') : join('tests', 'joints');
  const files = readdirSync(modelsDir)
    .filter((f) => /\.(ldr|mpd)$/i.test(f) && (filters.length === 0 || filters.some((x) => f.includes(x))))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((f) => join(modelsDir, f));
  if (args.includes('--report')) return report(baselineDir, filters);
  mkdirSync(baselineDir, { recursive: true });

  // Each model in a process of its own, or a big one (by its file's size: more parts, more joints)
  // shared out between up to `jobs`, all `jobs` at a time.
  function probeInChild(file: string, chunk: number, of: number): Promise<Baseline> {
    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [...process.execArgv, process.argv[1], '--one', file, '--chunk', `${chunk}/${of}`, ...(omr ? ['--omr'] : [])], { stdio: ['ignore', 'pipe', 'inherit'] });
      let out = '';
      child.stdout.on('data', (d) => (out += d));
      child.on('close', (code) => {
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
  const chunks = files.flatMap((file) => {
    const of = Math.max(1, Math.min(jobs, Math.ceil(statSync(file).size / CHUNK_BYTES)));
    return Array.from({ length: of }, (_, chunk) => ({ file, chunk, of }));
  });
  // Biggest first, so a big model's chunks don't all wait till the end.
  chunks.sort((a, b) => statSync(b.file).size - statSync(a.file).size);
  const started = new Map<string, number>();
  const found = new Map<string, Baseline[]>();
  const queue = [...chunks];
  async function worker() {
    while (queue.length) {
      const { file, chunk, of } = queue.shift()!;
      if (!started.has(file)) started.set(file, Date.now());
      let part: Baseline;
      try {
        part = await probeInChild(file, chunk, of);
      } catch (err) {
        console.log(`${file}: ${(err as Error).message}`);
        failed = true;
        continue;
      }
      // Once all of a model's chunks are in, put them together.
      const parts = [...(found.get(file) ?? []), part];
      found.set(file, parts);
      if (parts.length < of) continue;
      const now: Baseline = { model: part.model, joints: parts.flatMap((p) => p.joints).sort((a, b) => a.joint.localeCompare(b.joint, undefined, { numeric: true })) };
      const seconds = ((Date.now() - started.get(file)!) / 1000).toFixed(0);
      const path = join(baselineDir, `${now.model}.json`);
      if (update || !existsSync(path)) {
        writeFileSync(path, baselineText(now));
        console.log(`${now.model}: ${now.joints.length} knobs, baseline written (${seconds} s)`);
        continue;
      }
      const { worse, better } = compare(JSON.parse(readFileSync(path, 'utf-8')), now);
      const lines = [`${now.model}: ${now.joints.length} knobs, ${worse.length ? `${worse.length} worse` : 'none worse'}${better.length ? `, ${better.length} better` : ''} (${seconds} s)`];
      for (const w of worse) lines.push(`  worse:  ${w}`);
      for (const b of better) lines.push(`  better: ${b}`);
      console.log(lines.join('\n'));
      if (worse.length) failed = true;
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, jobs) }, worker));
  if (failed && !update) {
    console.log('Some joints got worse, or a model failed (see above). If the changes were meant, write the baselines afresh: npm run joints -- --update');
    process.exit(1);
  }
}
