// A part resting on others (see Rest in mechanism.ts).

import { Vector3 } from 'three';
import { type Rest, restTouch } from '../mechanism.ts';
import type { Kinematics } from '../kinematics.ts';
import { addPointVelocity, type Equations } from './equations.ts';

export function rests(solver: Kinematics, eq: Equations) {
  const { n, add } = eq;
  // A part resting on others (see Rest): where its face touches the highest of them now, the
  // two move alike towards each other, so it stays on it, neither lifting off nor sinking in.
  // Its gap: how far the face is off it.
  for (const rest of solver.mech.rests ?? []) {
    const touch = restingOn(solver, rest);
    if (!touch) continue;
    const { body, point, dir, clearance } = touch;
    const row = new Array(n).fill(0);
    for (let k = 0; k < 3; k++) {
      addPointVelocity(row, rest.body, point, k, dir.getComponent(k));
      addPointVelocity(row, body, point, k, -dir.getComponent(k));
    }
    add(row, clearance);
  }
}

// What a resting body (see Rest) rests on now: of the ways it may, the one where it's nearest
// to touching, or deepest in (the highest thing under it), with where and which way (see
// restTouch); or null if nothing is under it.
function restingOn(solver: Kinematics, rest: Rest): { body: number; point: Vector3; dir: Vector3; clearance: number } | null {
  let best: { body: number; point: Vector3; dir: Vector3; clearance: number } | null = null;
  for (const contact of rest.on) {
    const touch = restTouch(contact, solver.poses[rest.body], solver.poses[contact.body]);
    if (touch && (!best || touch.clearance < best.clearance)) best = { body: contact.body, ...touch };
  }
  return best;
}
