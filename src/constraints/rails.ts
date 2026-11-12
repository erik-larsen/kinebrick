// Train wheels on the rails (see Rider in mechanism.ts).

import { Vector3 } from 'three';
import type { Kinematics } from '../kinematics.ts';
import { addPointVelocity, axisOf, UP, type Equations } from './equations.ts';

export function rails(solver: Kinematics, eq: Equations) {
  const { n, add } = eq;
  // Train wheels on the rails (see Rider): their flanges keep each axle's middle on the
  // track's centreline, so it doesn't move across the track; and an axle alone in its truck
  // (a single-axle bogie) keeps square to the track, so it turns about the upright as fast
  // as the track bends under it (its curvature times how fast it moves along). Two axles in
  // one truck (a two-axle bogie, whose axles turn in it about level axes) are kept square by
  // both their middles being on the line: a row each would disagree where the truck straddles
  // a straight and a curve. The gaps, for closing the loops: how far the middle is off the
  // line, and how far the axle is from square to it.
  const ridersOn = (solver.mech.riders ?? []).filter((r) => solver.contactTreads.some((i) => solver.mech.treads[i].body === r.body));
  // The body a rider's axle yaws with: up the tree through joints about level axes (its axle
  // in its bogie), stopping at one about the upright (the bogie's pivot).
  const truckOf = (b: number) => {
    let body = b;
    for (;;) {
      const j = solver.parentJoint[body];
      if (j < 0) break;
      const joint = solver.mech.joints[j];
      if (Math.abs(axisOf(joint.from, joint.to).transformDirection(solver.poses[joint.bodyA]).dot(UP)) > 0.5) break;
      body = joint.bodyA === body ? joint.bodyB : joint.bodyA;
    }
    return body;
  };
  const trucks = ridersOn.map((r) => truckOf(r.body));
  for (const rider of ridersOn) {
    const pose = solver.poses[rider.body];
    const c = rider.center.clone().applyMatrix4(pose);
    const near = solver.nearestRail(c);
    if (!near) continue;
    const across = new Array(n).fill(0);
    for (let k = 0; k < 3; k++) {
      addPointVelocity(across, rider.body, c, k, near.n.getComponent(k));
      addPointVelocity(across, 0, c, k, -near.n.getComponent(k));
    }
    add(across, -near.offset);
    if (trucks.filter((t) => t === trucks[ridersOn.indexOf(rider)]).length > 1) continue;
    const axis = rider.axis.clone().transformDirection(pose);
    if (axis.dot(near.n) < 0) axis.negate();
    const skew = Math.atan2(new Vector3().crossVectors(near.n, axis).dot(UP), axis.dot(near.n));
    const square = new Array(n).fill(0);
    for (let k = 0; k < 3; k++) {
      square[6 * rider.body + k] += UP.getComponent(k);
      square[k] -= UP.getComponent(k);
      addPointVelocity(square, rider.body, c, k, -near.curvature * near.t.getComponent(k));
      addPointVelocity(square, 0, c, k, near.curvature * near.t.getComponent(k));
    }
    add(square, -skew);
  }
}
