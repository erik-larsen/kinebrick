// Strings: a drum winding a string over pulleys, and a hook hanging on it.

import { Matrix4, Quaternion, Vector3 } from 'three';
import type { Kinematics } from '../kinematics.ts';
import type { StringCircle } from '../paths.ts';
import { addPointVelocity, DOWN, type Equations } from './equations.ts';

export function strings(solver: Kinematics, eq: Equations) {
  const { n, add, slip } = eq;
  // A string keeps its length: as the bodies carrying its circles move, its free length
  // changes by just what its drum pays out (or winds in). A pulley turns as the string runs
  // round it, without slipping, unless it shares its body with another of the string's
  // pulleys (two pulleys side by side on one axle, which the string runs round at different
  // speeds: one of them must slip). The body hanging on the string (its hook) hangs
  // beneath the middle of the two pulleys either side of its own, as it did at the start,
  // and stays upright, turning with what it hangs from only about the vertical.
  (solver.mech.strings ?? []).forEach((s, i) => {
    const start = solver.strings[i];
    if (!start) return; // still being set up
    const { circles, bodies, layout } = solver.stringNow(s);
    const payout = s.drum ? solver.rimRate(s.drum.body, s.drum.mount, s.path.points[s.drum.point], n) : new Array(n).fill(0);
    const length = solver.stringRate(s, (l) => l.length, n);
    add(
      length.map((x, k) => x - payout[k]),
      -(layout.length - start.length - solver.payout(s)),
    );
    s.pulleys.forEach((w, k) => {
      if (w.joint < 0 || s.pulleys.some((o) => o !== w && o.body === w.body) || s.drum?.body === w.body) return;
      // The string runs past at what the drum pays out, less how fast the string up to here
      // is getting longer.
      const upTo = solver.stringRate(s, (l) => l.upTo[k + 1], n);
      const rim = solver.rimRate(w.body, w.mount, s.path.points[w.point], n);
      add(rim.map((x, m) => x - payout[m] + upTo[m]));
    });
    if (!s.hook || !start.hookOffset) return;
    const h = s.hook.pulley + 1; // circles start with the drum (or where it's tied)
    const hook = s.hook.body;
    const off = circles[h].center.clone().sub(hungFrom(circles, h)).sub(start.hookOffset);
    const level = [new Vector3(1, 0, 0), new Vector3(0, 0, 1)];
    const either = h + 1 < circles.length ? [h - 1, h + 1] : [h - 1];
    for (const dir of level) {
      const row = new Array(n).fill(0);
      for (let k = 0; k < 3; k++) {
        addPointVelocity(row, hook, circles[h].center, k, dir.getComponent(k));
        for (const e of either) addPointVelocity(row, bodies[e], circles[e].center, k, -dir.getComponent(k) / either.length);
      }
      add(row, -off.dot(dir));
    }
    // Upright: turned from the start only about the vertical, as far as what it hangs from
    // has turned about it.
    const above = bodies[h - 1];
    let heading = new Vector3(1, 0, 0).transformDirection(solver.poses[above]);
    if (Math.hypot(heading.x, heading.z) < 0.1) heading = new Vector3(0, 0, 1).transformDirection(solver.poses[above]).applyAxisAngle(DOWN, -Math.PI / 2);
    const target = new Matrix4().makeRotationY(Math.atan2(-heading.z, heading.x));
    const q = new Quaternion().setFromRotationMatrix(new Matrix4().extractRotation(solver.poses[hook]).multiply(target.transpose()));
    const tilt = new Vector3(q.x, q.y, q.z).multiplyScalar(2 * (q.w < 0 ? -1 : 1));
    for (const dir of [...level, DOWN]) {
      const row = new Array(n).fill(0);
      for (let k = 0; k < 3; k++) {
        row[6 * hook + k] += dir.getComponent(k);
        if (dir === DOWN) row[6 * above + k] -= dir.getComponent(k);
      }
      add(row, -tilt.dot(dir));
    }
  });
}

// Where a hook on a string's circle h hangs from: the middle of the circles either side, or, for
// a hook tied to the string's end, the last circle before it.
export function hungFrom(circles: StringCircle[], h: number): Vector3 {
  return h + 1 < circles.length ? circles[h - 1].center.clone().add(circles[h + 1].center).multiplyScalar(0.5) : circles[h - 1].center.clone();
}
