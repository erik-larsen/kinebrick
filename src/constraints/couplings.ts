// Universal joints, and the like that tie two shafts' turning (see Kinematics.findCouplings).

import type { Kinematics } from '../kinematics.ts';
import { Vector3 } from 'three';
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
    // How far the two ends have come apart, closed as a loop's joint is (see closeLoops): a
    // shaft that hangs on nothing but the joints at its ends (between two universal joints)
    // would otherwise drift, each step true only to first order.
    // Only where a shaft floats (it turns in nothing, held by its joints' couplings alone, as the
    // 8448's between two universal joints is), and only the drift since the model was built: the
    // ends may have been built a hair apart (the 956's front double joint), and closing that, or
    // a shaft's that turns in a joint of its own, would fight the drive (the 854's steering).
    const floats = shafts.some((sh) => sh.joint < 0);
    const built = shafts[1].near.clone().sub(shafts[0].near);
    const gap = eq.gaps && floats ? b.at.clone().sub(a.at).sub(built) : new Vector3();
    for (let k = 0; k < 3; k++) {
      const row = new Array(n).fill(0);
      addPointVelocity(row, a.body, a.at, k, 1);
      addPointVelocity(row, b.body, b.at, k, -1);
      add(row, gap.getComponent(k));
    }
  }
  // A reduction (a planetary wheel hub's, see Coupling.ratio) turns its second shaft `ratio`
  // times slower: that shaft's turning counts `ratio` times. The solver's couplings are the
  // mechanism's, one each, in order.
  solver.couplings.forEach(({ shafts }, i) => {
    const ratio = solver.mech.couplings[i]?.ratio ?? 1;
    const row = new Array(n).fill(0);
    shafts.forEach((shaft, side) => {
      const d = solver.shaftAxis(shaft);
      const weight = side === 1 ? ratio : 1;
      for (let k = 0; k < 3; k++) {
        row[6 * shaft.body + k] += weight * shaft.away * d.getComponent(k);
        row[6 * shaft.mount + k] -= weight * shaft.away * d.getComponent(k);
      }
    });
    add(row, 0, DRIVE_WEIGHT);
  });
}
