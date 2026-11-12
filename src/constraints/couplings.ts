// Universal joints, and the like that tie two shafts' turning (see Kinematics.findCouplings).

import type { Kinematics } from '../kinematics.ts';
import { addPointVelocity, DRIVE_WEIGHT, type Equations } from './equations.ts';

export function couplings(solver: Kinematics, eq: Equations) {
  const { n, add } = eq;
  // A universal joint: its two shafts turn at the same rate, each relative to what it turns
  // in, about its own axis pointing away from the joint's middle (so a straight joint turns
  // both the same way). And its two ends stay together, where each shaft's axis passes the
  // joint's middle (points on the axes, so turning the shafts doesn't move them), unless
  // only their turning is tied (a grooved ball in a wheel hub, see Coupling). Shafts that
  // both turn in one body (a steering column's, in the frame) are kept together by it
  // already: as rows, their ends would come out, from parts placed only so precisely in an
  // LDraw file, as a hair's breadth short of that, and stop some other motion altogether (a
  // car turning a corner).
  for (const { shafts, turningOnly } of solver.couplings) {
    if (turningOnly) continue;
    if (shafts.every((sh) => sh.joint >= 0 && sh.mount === shafts[0].mount)) continue;
    const [a, b] = shafts.map((sh) => ({ body: sh.body, at: sh.near.clone().applyMatrix4(solver.poses[sh.body]) }));
    for (let k = 0; k < 3; k++) {
      const row = new Array(n).fill(0);
      addPointVelocity(row, a.body, a.at, k, 1);
      addPointVelocity(row, b.body, b.at, k, -1);
      add(row);
    }
  }
  for (const { shafts } of solver.couplings) {
    const row = new Array(n).fill(0);
    for (const shaft of shafts) {
      const d = solver.shaftAxis(shaft);
      for (let k = 0; k < 3; k++) {
        row[6 * shaft.body + k] += shaft.away * d.getComponent(k);
        row[6 * shaft.mount + k] -= shaft.away * d.getComponent(k);
      }
    }
    add(row, 0, DRIVE_WEIGHT);
  }
}
