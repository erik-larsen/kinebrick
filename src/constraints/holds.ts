// Bodies held still: frozen, held for a drag, the frame kept still, and bodies turned together
// with the one a drag turns.

import type { Kinematics } from '../kinematics.ts';
import type { Row } from '../linalg.ts';
import { axisOf, DRIVE_WEIGHT, type Equations } from './equations.ts';

// Rows for bodies held still: `fixed` on their joints (or, for a root body, altogether), and
// `toFrame` against the frame.
export function holdRows(solver: Kinematics, fixed: Set<number>, toFrame: Set<number>): Row[] {
  const rows: Row[] = [];
  const n = 6 * solver.bodyCount;
  for (const body of toFrame) {
    // Held against the frame: no turning about its joint's axis relative to what its shaft
    // turns in (see housing), which is the frame, or what stands for it: the 42111 Dodge
    // Charger's rear axle, hung on a ball joint (held against the car, the differential on its
    // half shafts left a rear wheel turning only by swinging the whole axle on its ball); the
    // 8110 Unimog's axles (its frame, the body with the most structure parts, is the cab,
    // which tilts: held against the cab, a differential left a wheel turning only by tipping
    // the cab with it, while the truck itself couldn't roll).
    const joint = solver.mech.joints[solver.parentJoint[body]];
    const d = axisOf(joint.from, joint.to).transformDirection(solver.poses[joint.bodyA]);
    const root = solver.housing(body);
    const row = new Array(n).fill(0);
    for (let k = 0; k < 3; k++) {
      row[6 * body + k] += d.getComponent(k);
      row[6 * root + k] -= d.getComponent(k);
    }
    rows.push(row);
  }
  for (const body of fixed) {
    const j = solver.parentJoint[body];
    if (j >= 0 && body !== solver.fixedBody) {
      // Frozen, or held for a drag, on its joint: no turning relative to the body it turns on.
      const joint = solver.mech.joints[j];
      const d = axisOf(joint.from, joint.to).transformDirection(solver.poses[joint.bodyA]);
      const row = new Array(n).fill(0);
      for (let k = 0; k < 3; k++) {
        row[6 * joint.bodyB + k] += d.getComponent(k);
        row[6 * joint.bodyA + k] -= d.getComponent(k);
      }
      rows.push(row);
    } else {
      // Held still altogether: a root body (the frame), or a body that only slides or swivels
      // on another (see mounts), on that.
      const mount = body === solver.fixedBody ? undefined : solver.mounts.get(body);
      for (let k = 0; k < 6; k++) {
        const row = new Array(n).fill(0);
        row[6 * body + k] = 1;
        if (mount !== undefined) row[6 * mount + k] = -1;
        rows.push(row);
      }
    }
  }
  return rows;
}

export function holds(solver: Kinematics, eq: Equations) {
  const { n, add } = eq;
  const fixed = new Set([...solver.frozen, ...solver.drag.held]);
  if (solver.fixedBody >= 0) fixed.add(solver.fixedBody);
  // Held bodies stay held while the loops close too (the weights are closing's): where the
  // rules can't all hold, what's held gives last. Else a layout's track gave a little as its
  // cars, far off the rails as built, were drawn onto it.
  for (const row of holdRows(solver, fixed, solver.drag.heldToFrame)) add(row, 0, DRIVE_WEIGHT);
  // Bodies turned together (see turnTogether): each turns against its housing, about the
  // grabbed body's axis, as fast as the grabbed body does against its own.
  if (solver.drag.together.length > 1) {
    const [grabbed, ...others] = solver.drag.together;
    const joint = solver.mech.joints[solver.parentJoint[grabbed]];
    const d = axisOf(joint.from, joint.to).transformDirection(solver.poses[joint.bodyA]);
    for (const body of others) {
      const row = new Array(n).fill(0);
      for (const [b, sign] of [[body, 1], [solver.housing(body), -1], [grabbed, -1], [solver.housing(grabbed), 1]]) for (let k = 0; k < 3; k++) row[6 * b + k] += sign * d.getComponent(k);
      add(row);
    }
  }
}
