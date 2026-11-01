// Times the kinematics solver on a fixed set of drags, from small models to the biggest, so a
// change to the solver can be judged for speed as the function check judges it for what moves.
// Each drag is a curated function's control, worked as the function check works it (its controls
// turned together where it says so): the model loaded, the drag's holds chosen, then STEPS steps
// of MAX_STEP radians each. It prints, for each, the model's bodies and joints, the seconds each
// stage took, the median and slowest step, and how far the drag got, as a Markdown table.
//
//   npm run bench                 every drag
//   npm run bench -- --quick      all but the biggest (BIG), a minute or so
//   npm run bench -- --steps 10   how many steps each drag takes (default STEPS)
//
// It runs whatever the switches say (KINEBRICK_LEAST, KINEBRICK_ONE and the like), so two runs
// with different switches, or at different commits, compare like for like. On a busy machine its
// times are slower, and less steady.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadModel } from './load-model.ts';

// The drags: a set, and its function's number. Chosen for size, and for the kinds of motion that
// cost most: a car pushed along through its differential, an engine's loops, steering.
const DRAGS: { set: string; fn: number }[] = [
  { set: '956-1', fn: 2 }, // Auto Chassis: rolling it runs the engine (35 bodies)
  { set: '8865-1', fn: 2 }, // Test Car: pushed along, the V4 engine through the differential
  { set: '42037-1', fn: 1 }, // Formula Off-Roader: rear wheels pushed together, the inline 4
  { set: '42062-1', fn: 1 }, // Container Yard: the roof knob steers the truck
  { set: '42056-1', fn: 2 }, // Porsche 911 GT3 RS: pushed along in gear, the flat 6
  { set: '8110-1', fn: 1 }, // Unimog: the cab roof gear steers (663 bodies)
];
// The drags left out with --quick.
const BIG = new Set(['8110-1']);
const STEPS = 5;
// A step as big as the viewer's drags take (MAX_TURN_STEP in the solver).
const MAX_STEP = 0.035;

const args = process.argv.slice(2);
const stepsAt = args.indexOf('--steps');
const steps = stepsAt >= 0 ? Number(args[stepsAt + 1]) : STEPS;
const drags = DRAGS.filter((d) => !args.includes('--quick') || !BIG.has(d.set));

const seconds = (since: number) => (performance.now() - since) / 1000;
const show = (s: number) => (s < 10 ? s.toFixed(2) : s.toFixed(1));

console.log(`| Drag | Bodies | Joints | Load (s) | Holds (s) | Median step (s) | Slowest step (s) | Turned |`);
console.log(`|---|---|---|---|---|---|---|---|`);
for (const { set, fn } of drags) {
  const data = JSON.parse(readFileSync(join('data', 'sets', `${set}.json`), 'utf-8'));
  const f = data.curated.functions[fn - 1];
  const model = f.model ?? data.curated.model;
  let t = performance.now();
  const { mech, kin } = loadModel(model, model.startsWith('omr/'));
  const load = seconds(t);
  const part = (ref: string) => Number(/^p(\d+)/.exec(ref)![1]);
  const controls = [f.control].flat().map((r: string) => mech.bodyOf[part(r)]);
  const body = controls[0];
  const joint = kin.parentLink(body)!.joint;
  t = performance.now();
  if (f.together) kin.turnTogether(body, controls);
  kin.holdWhatTheDragDoesntNeed(body, () => kin.jointMotion(joint) !== null, joint);
  const holds = seconds(t);
  const times: number[] = [];
  let turned = 0;
  for (let i = 0; i < steps; i++) {
    t = performance.now();
    const step = kin.turnJoint(joint, MAX_STEP, () => kin.atLimit() === null);
    times.push(seconds(t));
    turned += step;
    if (Math.abs(step) < MAX_STEP - 1e-9) break;
  }
  kin.letGoAfterDrag();
  const sorted = [...times].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  console.log(`| ${set} f${fn} | ${mech.bodies.length} | ${mech.joints.length} | ${show(load)} | ${show(holds)} | ${show(median)} | ${show(sorted[sorted.length - 1])} | ${(turned / (steps * MAX_STEP)) * 100 >= 99.5 ? 'all' : `${Math.round((turned / (steps * MAX_STEP)) * 100)}%`} |`);
}
