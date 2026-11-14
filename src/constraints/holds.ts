// Bodies held still: frozen, held for a drag, the frame kept still, and bodies turned together
// with the one a drag turns.

import type { Kinematics } from '../kinematics.ts';
import type { Row } from '../linalg.ts';
import { addPointVelocity, axisOf, DRIVE_WEIGHT, type Equations } from './equations.ts';

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
  // A frozen body that turns on a shaft is held against what that shaft turns in (see
  // housing), as a body held against the frame for a drag is, not on its own joint: which body
  // its joint joins it to is how the tree of joints happened to grow, which no user sees. Held
  // on its joint, the Ackermann car's differential housing, whose joint is on a rear half
  // shaft, was held to that half shaft, locking the differential.
  const onShaft = (body: number) => body !== solver.fixedBody && solver.parentJoint[body] >= 0 && solver.mech.joints[solver.parentJoint[body]].kind === 'revolute';
  const fixed = new Set([...[...solver.frozen].filter((b) => !onShaft(b)), ...solver.drag.held]);
  const toFrame = new Set([...[...solver.frozen].filter(onShaft), ...solver.drag.heldToFrame]);
  if (solver.fixedBody >= 0) fixed.add(solver.fixedBody);
  // Held bodies stay held while the loops close too (the weights are closing's): where the
  // rules can't all hold, what's held gives last. Else a layout's track gave a little as its
  // cars, far off the rails as built, were drawn onto it.
  for (const row of holdRows(solver, fixed, toFrame)) add(row, 0, DRIVE_WEIGHT);
  // Slides that springs hold at rest, held still while the steering is found (see
  // Kinematics.steeringBodies).
  if (solver.springsHeld) for (const row of solver.springRows()) add(row, 0, DRIVE_WEIGHT);
  // What a drag can't reach is held where it is on the frame (see Kinematics.outOfReach): each
  // body whole, not just on its joint, as the rows on nothing but these bodies and the frame are
  // left out (see buildEquations). Held only on their joints, without their joints' own rows,
  // they came loose: the 8859 Tractor's front wheel, rolling it, stopped short at a dead point.
  for (const body of solver.drag.outOfReach) {
    for (let k = 0; k < 6; k++) {
      const row = new Array(n).fill(0);
      row[6 * body + k] = 1;
      row[k] = -1;
      add(row, 0, DRIVE_WEIGHT);
    }
  }
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
