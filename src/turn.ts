// How far to turn a part when the pointer moves, treating the part like a knob: it turns by
// the angle the pointer swept around the part's axle between its last position and this one.
//
// Both pointer positions are measured around where the axle is *now*. The axle may itself be
// moving as the part turns (turning a car's wheel rolls the car), but because both positions
// are measured from the same place, that motion never feeds back into the turn: a pointer
// that doesn't move never turns anything, and the part keeps in step with the pointer
// however many times it goes round.

import { Plane, Ray, Vector3 } from 'three';

// When the pointer's ray is closer than this to running along the plane of turning
// (cosine of the angle to the axle), the plane is seen edge-on and can't be used.
export const EDGE_ON = 0.15;

export interface KnobSetup {
  hub: Vector3; // a point on the axle
  dir: Vector3; // axle direction (unit); positive turns follow the right-hand rule about it
  from: Ray; // camera ray through the pointer's last position
  to: Ray; // camera ray through the pointer's position now
  // Closer to the axle than this (LDU), sweeping around it would turn the part too fast, so
  // the turn is damped as if the pointer were this far out. Use about half the distance of
  // the grabbed point from the axle.
  minRadius: number;
}

// The turn in radians, or null if the plane of turning is seen edge-on.
export function knobTurn(k: KnobSetup): number | null {
  if (Math.abs(k.to.direction.dot(k.dir)) < EDGE_ON) return null;
  const plane = new Plane().setFromNormalAndCoplanarPoint(k.dir, k.hub);
  const a = k.from.intersectPlane(plane, new Vector3());
  const b = k.to.intersectPlane(plane, new Vector3());
  if (!a || !b) return null;
  a.sub(k.hub);
  b.sub(k.hub);
  // Sine and cosine of the swept angle, times the two distances from the axle.
  const cross = new Vector3().crossVectors(a, b).dot(k.dir);
  const dot = a.dot(b);
  if (Math.min(a.length(), b.length()) >= k.minRadius) return Math.atan2(cross, dot);
  // Near the axle: a gentle turn, as if the pointer were minRadius out.
  return cross / Math.max(a.length() * b.length(), k.minRadius * k.minRadius);
}
