// A push: a part moved so that a point on it goes a given way, by whatever the mechanism allows
// (see "Interaction" in the README). The viewer pushes a part that doesn't spin on an axle (the
// frame, a door, an arm of a linkage), and the function check pushes such a control as the
// viewer would (scripts/check-functions.ts), so both use the steps here.

import { Vector2, Vector3 } from 'three';
import { Kinematics } from './kinematics.ts';
import { heldCount, trace, TRACE, withoutHolds } from './trace.ts';
import { combine, nullSpace, orthonormalize } from './linalg.ts';

// In how many independent directions a point on a body can move.
export function pointDirections(kin: Kinematics, body: number, g: Vector3): number {
  const basis: Vector3[] = [];
  for (const m of kin.freeMotions()) {
    const v = kin.pointVelocity(m, body, g);
    for (const b of basis) v.addScaledVector(b, -v.dot(b));
    if (v.length() > 1e-6) basis.push(v.normalize());
  }
  return basis.length;
}

// One step of a push: moves the mechanism so that the point `grab` of a body (given on the body
// as built) goes `step` LDU, by the mix of the ways it can go nearest `dir`, and then turns `dir`
// to the way the point went, so that steps one after another follow a curve (a steered car
// rolling round, a door swinging on its hinge). Returns 'stuck', with nothing moved, if the point
// has nowhere to go, or only well off `dir`; and 'blocked', with the step undone, if `allowed`
// says no to where the step left the model (it ran into something, or past the end of a slide).
export function pushStep(kin: Kinematics, body: number, grab: Vector3, dir: Vector3, step: number, allowed: () => boolean = () => true): 'moved' | 'stuck' | 'blocked' {
  // Least motion, for a part on a turning joint (see Options.leastPush).
  if (kin.pushesByTiers(body)) return kin.pushStepByTiers(body, grab, dir, step, allowed);
  const g = grab.clone().applyMatrix4(kin.poses[body]);
  const motions = kin.freeMotions();
  const speeds = motions.map((m) => kin.pointVelocity(m, body, g));
  const amounts = motions.length ? leastSquares(speeds, dir) : null;
  const move = new Vector3();
  if (amounts) amounts.forEach((a, i) => move.addScaledVector(speeds[i], a));
  // Nowhere to go, or only well off the way it was going.
  if (!amounts || move.length() < 1e-6 || move.clone().normalize().dot(dir) < 0.5) {
    if (TRACE) tracePushStuck(kin, body, g, dir, motions);
    return 'stuck';
  }
  const scale = step / move.length();
  const combined = new Array(motions[0].length).fill(0);
  motions.forEach((m, i) => m.forEach((x, k) => (combined[k] += x * amounts[i] * scale)));
  const before = kin.snapshot();
  kin.advance(combined, 1);
  if (!allowed()) {
    if (TRACE) trace({ event: 'push blocked', body, limit: kin.atLimit() });
    kin.restore(before);
    return 'blocked';
  }
  const now = grab.clone().applyMatrix4(kin.poses[body]).sub(g);
  if (now.length() > 1e-9) dir.copy(now.normalize());
  return 'moved';
}

// The amounts a_i that make  Σ a_i · columns_i  as close as possible to `target`, slightly
// damped so a motion that barely shows on screen doesn't get a huge amount.
export function leastSquares(columns: (Vector2 | Vector3)[], target: Vector2 | Vector3): number[] | null {
  const dot = (u: Vector2 | Vector3, v: Vector2 | Vector3) => u.toArray().reduce((sum: number, x: number, i: number) => sum + x * v.toArray()[i], 0);
  const k = columns.length;
  const a: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < k; i++) {
    a.push([]);
    for (let j = 0; j < k; j++) a[i].push(dot(columns[i], columns[j]) + (i === j ? 1e-3 : 0));
    b.push(dot(columns[i], target));
  }
  // Gaussian elimination on the small k × k system.
  for (let c = 0; c < k; c++) {
    let best = c;
    for (let r = c + 1; r < k; r++) if (Math.abs(a[r][c]) > Math.abs(a[best][c])) best = r;
    if (Math.abs(a[best][c]) < 1e-12) return null;
    [a[c], a[best]] = [a[best], a[c]];
    [b[c], b[best]] = [b[best], b[c]];
    for (let r = 0; r < k; r++) {
      if (r === c) continue;
      const f = a[r][c] / a[c][c];
      for (let j = c; j < k; j++) a[r][j] -= f * a[c][j];
      b[r] -= f * b[c];
    }
  }
  return b.map((x, i) => x / a[i][i]);
}

// With KINEBRICK_TRACE: why a push step is stuck. How near `dir` the point `g` (where it is now)
// can go, and how fast, by the free motions the push has (with its holds), by all of them with
// the holds let go, and by those of them that leave the frame where it is.
function tracePushStuck(kin: Kinematics, body: number, g: Vector3, dir: Vector3, motions: number[][]) {
  const best = (ms: number[][]) => {
    const speeds = ms.map((m) => kin.pointVelocity(m, body, g));
    const amounts = ms.length ? leastSquares(speeds, dir) : null;
    const move = new Vector3();
    if (amounts) amounts.forEach((a, i) => move.addScaledVector(speeds[i], a));
    return { motions: ms.length, along: move.length() > 1e-9 ? move.clone().normalize().dot(dir) : 0, speed: move.length() };
  };
  const free = withoutHolds(kin, () => kin.freeMotions());
  const still = free.length ? orthonormalize(nullSpace([0, 1, 2, 3, 4, 5].map((k) => free.map((m) => m[k])), free.length).map((a) => combine(free, a))) : [];
  trace({ event: 'push stuck', body, held: heldCount(kin), withHolds: best(motions), free: best(free), frameStill: best(still) });
}
