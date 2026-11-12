// A linear actuator's screw.

import { Vector3 } from 'three';
import type { Kinematics } from '../kinematics.ts';
import { addPointVelocity, acrossDirections, DRIVE_WEIGHT, STUD, type Equations } from './equations.ts';

export function screws(solver: Kinematics, eq: Equations) {
  const { n, add } = eq;
  // A linear actuator's screw: its thread and the piston's nut move together across the
  // thread's surface, as a worm's thread and its gear's tooth do (see meshContact), so the
  // piston goes one lead along the axis for each turn of the input. Taken at any point off the
  // axis: the thread leans the same at any radius, for a given lead.
  for (const screw of solver.mech.screws ?? []) {
    const pose = solver.poses[screw.input];
    const d = screw.axis.clone().transformDirection(pose);
    const [out] = acrossDirections(d);
    const point = screw.center.clone().applyMatrix4(pose).addScaledVector(out, STUD);
    const surface = new Vector3().crossVectors(d, out); // how the thread moves there as the input turns
    const lean = Math.atan(screw.lead / (2 * Math.PI * STUD));
    const across = d.clone().multiplyScalar(Math.cos(lean)).addScaledVector(surface, Math.sin(lean));
    const row = new Array(n).fill(0);
    for (let k = 0; k < 3; k++) {
      addPointVelocity(row, screw.input, point, k, across.getComponent(k));
      addPointVelocity(row, screw.piston, point, k, -across.getComponent(k));
    }
    add(row, 0, DRIVE_WEIGHT);
  }
}
