// How far a part has turned from where it was, leaving out a turn about a line it is free on.
// The check (check-functions.ts) uses it to judge whether a function came back: a pin or a free
// wheel left turned in its holes, and in its place, is back (decision of 2026-11-15).

import { Matrix4, Quaternion, Vector3 } from 'three';

// How far apart (radians) the poses `then` and `now` turn, once any turn about `axis` (a
// direction in the world) is taken out. A turn about the axis alone comes to 0; a turn about a
// line across it comes out whole.
export function turnOffAxis(then: Matrix4, now: Matrix4, axis: Vector3): number {
  // The turn from `then` to `now`, in the world.
  const q = new Quaternion().setFromRotationMatrix(new Matrix4().extractRotation(now.clone().multiply(then.clone().invert())));
  const d = axis.clone().normalize();
  // The part of the turn about the axis (its twist), and what is left once it is taken out.
  const along = d.multiplyScalar(q.x * d.x + q.y * d.y + q.z * d.z);
  const twist = new Quaternion(along.x, along.y, along.z, q.w);
  if (twist.lengthSq() < 1e-24) return 2 * Math.acos(Math.min(1, Math.abs(q.w)));
  twist.normalize();
  const rest = q.clone().multiply(twist.invert());
  return 2 * Math.acos(Math.min(1, Math.abs(rest.w)));
}
