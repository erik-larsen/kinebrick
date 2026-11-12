// Ball joints' extra rows: a towball that would spin on its axis, and a link held only by a
// ball at each end (see Kinematics.findLinks).

import type { Kinematics } from '../kinematics.ts';
import { axisOf, type Equations } from './equations.ts';

export function spinners(solver: Kinematics, eq: Equations) {
  const { n, add } = eq;
  // A towball and the like (see findLinks) doesn't spin on its axis.
  for (const j of solver.spinners) {
    const joint = solver.mech.joints[j];
    const d = axisOf(joint.from, joint.to).transformDirection(solver.poses[joint.bodyA]);
    const row = new Array(n).fill(0);
    for (let k = 0; k < 3; k++) {
      row[6 * joint.bodyB + k] += d.getComponent(k);
      row[6 * joint.bodyA + k] -= d.getComponent(k);
    }
    add(row);
  }
}

export function links(solver: Kinematics, eq: Equations) {
  const { n, add } = eq;
  // A link between two balls turns about its length as the bodies at its ends do, on average.
  for (const { body, balls } of solver.links) {
    const [a, b] = balls.map((i) => solver.mech.joints[i]);
    const ends = [a, b].map((j) => j.from.clone().applyMatrix4(solver.poses[j.bodyA]));
    const d = ends[1].sub(ends[0]).normalize();
    const row = new Array(n).fill(0);
    for (const j of [a, b]) {
      const other = j.bodyA === body ? j.bodyB : j.bodyA;
      for (let k = 0; k < 3; k++) row[6 * other + k] -= d.getComponent(k) / 2;
    }
    for (let k = 0; k < 3; k++) row[6 * body + k] += d.getComponent(k);
    add(row);
  }
}
