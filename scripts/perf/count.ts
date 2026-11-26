// A count for the speed work (decision 377 of 2026-11-26): how much of one function's check runs on
// the drag's working set and how much on the whole model, with the time inside the main parts of
// each. It is loaded beside the check and changes nothing the check works out; it prints one line,
// "STATS {…}", to stderr when the process ends.
//
//   node --max-old-space-size=16384 --import tsx --import ./scripts/perf/count.ts scripts/check-functions.ts --one data/sets/8110-1.json --only 3
//
// (--only counts from 0. A run like this prints only, and writes no record; on a big set, run it
// through the machine's pool: npx tsx scripts/check-pool.ts run --mb 2000 --what "…" -- node …)
//
// What the line holds, each as [calls, seconds]:
//   "turn full", "turn set"       the solver's turns worked on the whole model, and on the working set
//   "closeLoops full|set"         closing the loops; its calls are the steps taken
//   "jointMotion …", "freeMotionsApart …", "motionChoices …", "makeBasis …"   the search for a motion
//   "collisions full|set"         the collision test, inside the turns
//   "pushStepByTiers"             a control that is pushed, not turned
//   ws                            the working set's own count: turns on the set, sets made, turns
//                                 left out by rule (excluded), turns worked again in full and why
//   beforeFirstTurn               seconds of loading and reading before the first turn

import { Kinematics } from '../../src/kinematics.ts';
import { Collisions } from '../../src/collisions.ts';

const solver = Kinematics.prototype as any;
const times: Record<string, [number, number]> = {};
const sizes: Record<string, number> = {};
const begun = performance.now();
let mode = 'outside'; // which kind of turn the solver is in
let first = 0; // when the first turn began

function add(label: string, ms: number) {
  const entry = (times[label] ??= [0, 0]);
  entry[0]++;
  entry[1] += ms;
}

// Times every call of a method, under the label given at the call.
function time(proto: any, name: string, label: () => string) {
  const original = proto[name];
  if (typeof original !== 'function') return console.error(`count: no method ${name}`);
  proto[name] = function (this: unknown, ...args: unknown[]) {
    const l = label();
    const started = performance.now();
    try {
      return original.apply(this, args);
    } finally {
      add(l, performance.now() - started);
    }
  };
}

// The plain turn, by whether it is worked on the set: everything inside it counts under that.
const plain = solver.turnJointPlain;
solver.turnJointPlain = function (this: any, ...args: unknown[]) {
  if (!first) {
    first = performance.now();
    sizes.bodies = this.poses.length;
    sizes.joints = this.mech.joints.length;
    sizes.columns = this.treeBasis()[0]?.length ?? 0;
  }
  const was = mode;
  mode = this.wsActive ? 'set' : 'full';
  const started = performance.now();
  try {
    return plain.apply(this, args);
  } finally {
    add(`turn ${mode}`, performance.now() - started);
    mode = was;
  }
};
for (const m of ['closeLoops', 'jointMotion', 'freeMotionsApart', 'motionChoices', 'makeBasis']) time(solver, m, () => `${m} ${mode}`);
for (const m of ['holdWhatTheDragDoesntNeed', 'dragMoves', 'pushStepByTiers']) time(solver, m, () => m);
time(Collisions.prototype, 'check', () => `collisions ${mode}`);

process.on('exit', () => {
  const ws = Kinematics.wsShared;
  const tenths = (ms: number) => Math.round(ms / 100) / 10;
  const out: Record<string, unknown> = { seconds: tenths(performance.now() - begun), beforeFirstTurn: first ? tenths(first - begun) : null, sizes, ws: { small: ws.small, made: ws.made, fallback: ws.fallback, excluded: ws.excluded } };
  for (const [name, [calls, ms]] of Object.entries(times)) out[name] = [calls, tenths(ms)];
  console.error('STATS ' + JSON.stringify(out));
});
