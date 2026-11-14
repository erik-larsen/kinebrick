// Why a function doesn't work: one cause from a fixed list, for the function check to write beside
// each result that isn't "works" (see docs/plan.md, phase 1). A cause says where to look, and who
// looks: the function lists, the inference (connections and parts' behaviour), the solver, or the
// check itself.
//
// Most causes are told from the motions the mechanism allows where the control starts (the
// solver's free motions), without dragging anything:
//   - can the control move at all?
//   - can a part that should move, move at all against what it's measured against?
//   - must that part move whenever the control does? If it must, the mechanism is right and the
//     drag fell short. If it needn't, something else may move instead: either nothing ties the two
//     (a connection or mesh is missing), or gears do tie them and the solver chose another motion
//     (a differential's other side, say).

import { Kinematics } from '../src/kinematics.ts';

// Each cause: who looks into it, and what it says, in plain English.
export const CAUSES = {
  'bad-reference': { owner: 'function lists', says: "The function names a part that isn't in the model" },
  'loose-part': { owner: 'inference', says: 'The control, or a part it should move, is loose' },
  // Until the solver gives a second model a frame of its own, it is welded to the main model as
  // loose parts are, so its functions can't count as working either (see Mechanism.frames).
  'second-model': { owner: 'solver', says: 'The control, or a part it should move, is on a second model that is not yet a frame of its own' },
  'control-fixed': { owner: 'inference', says: 'The control is part of the frame, or has no joint to work' },
  'first-failed': { owner: 'check', says: "A control that has to be worked first didn't go" },
  'control-jammed': { owner: 'inference', says: "The control has a joint, but nothing lets it move" },
  'part-fixed': { owner: 'inference', says: "A part that should move can't move at all against what it's measured against" },
  'not-driven': { owner: 'inference', says: 'A part that should move can move, but nothing ties it to the control' },
  'other-motion': { owner: 'solver', says: 'Gears tie a part to the control, but the control can also move without it, and did' },
  'stopped-early': { owner: 'solver', says: 'The mechanism is right there, but the drag stopped before half way' },
  'too-little': { owner: 'solver', says: 'The control went far enough, but a part it must move hardly moved' },
  'stay-forced': { owner: 'function lists', says: 'A part that should stay has to move whenever the control does' },
  'stay-chosen': { owner: 'solver', says: 'A part that should stay moved, though the control can move without it' },
  unknown: { owner: 'check', says: 'None of the above' },
} as const;
export type Cause = keyof typeof CAUSES;
export interface Explained {
  cause: Cause;
  detail?: string; // the part it's about, or what stopped the drag
}

// A radian of turning counts as much as this many LDU of moving (a stud).
const TURN = 20;
// Smaller than this, a row of speeds counts as nothing.
const TINY = 1e-6;

// How body `b` moves against body `a` under each motion: six rows (three of turning, three of
// moving), one column per motion.
function relative(motions: number[][], a: number, b: number): number[][] {
  return [0, 1, 2, 3, 4, 5].map((c) => motions.map((m) => (m[6 * b + c] - m[6 * a + c]) * (c < 3 ? TURN : 1)));
}

// How many of the rows are independent.
function rank(rows: number[][]): number {
  const kept: number[][] = [];
  for (const row of rows) {
    const u = row.slice();
    for (const k of kept) {
      const d = u.reduce((sum, x, i) => sum + x * k[i], 0);
      for (let i = 0; i < u.length; i++) u[i] -= d * k[i];
    }
    const length = Math.hypot(...u);
    if (length > TINY) kept.push(u.map((x) => x / length));
  }
  return kept.length;
}

// A part of a function: its name there, its body, and the body it's measured against.
export interface Listed {
  ref: string;
  body: number;
  against: number;
}

// The cause, for a control that has a joint: `control` is its body and what that turns in, `still`
// the parts that should have moved and didn't, `moved` those that should have stayed and didn't,
// `geared` the bodies gears tie to the control, and `far` whether the control went half way.
export function causeOf(kin: Kinematics, control: { body: number; parent: number }, still: Listed[], moved: Listed[], geared: Set<number>, far: boolean): Explained {
  const motions = kin.freeMotions();
  const own = relative(motions, control.parent, control.body);
  if (rank(own) === 0) return { cause: 'control-jammed' };
  // Each part's cause, and the worst of them, in this order.
  const order: Cause[] = ['part-fixed', 'not-driven', 'other-motion'];
  let worst: Explained | null = null;
  for (const part of still) {
    const its = relative(motions, part.against, part.body);
    const free = rank(its);
    let cause: Cause | null = null;
    if (free === 0) cause = 'part-fixed';
    else if (rank([...its, ...own]) > free) cause = geared.has(part.body) ? 'other-motion' : 'not-driven';
    if (cause && (!worst || order.indexOf(cause) < order.indexOf(worst.cause))) worst = { cause, detail: part.ref };
  }
  if (worst) return worst;
  if (still.length) return far ? { cause: 'too-little', detail: still[0].ref } : { cause: 'stopped-early' };
  for (const part of moved) {
    const its = relative(motions, part.against, part.body);
    return { cause: rank([...its, ...own]) > rank(its) ? 'stay-chosen' : 'stay-forced', detail: part.ref };
  }
  return far ? { cause: 'unknown' } : { cause: 'stopped-early' };
}
