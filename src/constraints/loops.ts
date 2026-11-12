// Chains, tracks and rubber bands looped round wheels, and what is hooked to a chain.

import type { Kinematics } from '../kinematics.ts';
import { addPointVelocity, axisOf, DRIVE_WEIGHT, type Equations } from './equations.ts';

export function loops(solver: Kinematics, eq: Equations) {
  const { n, add, gaps } = eq;
  // A chain, track or rubber band looped round wheels: each wheel's rim moves at the loop's
  // speed, relative to what the wheel turns in, the way the loop goes round it.
  for (const loop of solver.mech.loops ?? []) {
    const rims = loop.wheels.map((w) => {
      const point = loop.path.points[w.point];
      const z = point.axis.clone().transformDirection(solver.poses[w.mount]).multiplyScalar(point.turn * point.radius);
      const row = new Array(n).fill(0);
      for (let k = 0; k < 3; k++) {
        row[6 * w.body + k] += z.getComponent(k);
        row[6 * w.mount + k] -= z.getComponent(k);
      }
      return row;
    });
    for (let r = 1; r < rims.length; r++) add(rims[0].map((x, k) => x - rims[r][k]), 0, DRIVE_WEIGHT);
    // What's hooked to it slides along its joint at the speed of the loop's run there: as fast
    // as its wheel's rim turns in what it slides on. Its gap: how far it has slid short of how
    // far the loop has moved.
    for (const hook of loop.hooks ?? []) {
      const joint = solver.mech.joints[hook.joint];
      const w = loop.wheels[hook.wheel];
      const c = joint.from.clone().applyMatrix4(solver.poses[joint.bodyA]);
      const d = axisOf(joint.from, joint.to).transformDirection(solver.poses[joint.bodyA]);
      const row = solver.rimRate(w.body, w.mount, loop.path.points[w.point], n);
      for (let k = 0; k < 3; k++) {
        addPointVelocity(row, joint.bodyB, c, k, -d.getComponent(k));
        addPointVelocity(row, joint.bodyA, c, k, d.getComponent(k));
      }
      add(row, gaps ? solver.slideOffset(hook.joint) - solver.wheelTravel(loop.path.points[w.point], w) : 0, DRIVE_WEIGHT);
    }
  }
}
