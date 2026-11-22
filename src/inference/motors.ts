// Motors whose output goes through them.

import type { Connection } from '../mechanism.ts';

// Two axles turning in one motor's output, on one axis, turn together: the output is one rotor,
// open at both faces (the Powered Up large angular motor, 69730), so an axle in each face is
// driven alike. Read apart, each axle turns in the motor on its own and the motor's drive to the
// far face is lost (the 42131's drive motors: the control turns the outer face's axle, and the
// differential's half shaft in the inner face stays still). A rigid connection joins each such
// pair; each axle still turns in the motor.
export function throughOutputs(connections: Connection[]): Connection[] {
  const added: Connection[] = [];
  const byMotor = new Map<number, Connection[]>();
  for (const c of connections) if (c.motor) byMotor.set(c.female, [...(byMotor.get(c.female) ?? []), c]);
  for (const cs of byMotor.values()) {
    for (let i = 0; i < cs.length; i++) {
      for (let j = i + 1; j < cs.length; j++) {
        const [a, b] = [cs[i], cs[j]];
        if (a.male === b.male) continue;
        const axis = a.to.clone().sub(a.from).normalize();
        const along = b.to.clone().sub(b.from).normalize();
        const off = b.from.clone().sub(a.from);
        const apart = off.clone().addScaledVector(axis, -off.dot(axis)).length();
        if (Math.abs(Math.abs(axis.dot(along)) - 1) < 1e-3 && apart < 1) added.push({ male: a.male, female: b.male, kind: 'rigid', from: a.to.clone(), to: b.from.clone() });
      }
    }
  }
  return added;
}
