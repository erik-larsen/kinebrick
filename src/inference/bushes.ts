// Bushes that lock what they're pushed against to their axle: into a Technic plate's hole, or
// against a toothed toggle joint.

import { Vector3 } from 'three';
import type { Connection } from '../mechanism.ts';
import { ANGLE_TOLERANCE, axialOverlap, AXIS_TOLERANCE, type WorldCylinder } from './shared.ts';

// A bush seated in a Technic plate's hole grips the plate: the plate's hole is counterbored
// 4 LDU deep for a bush's flange (a brick's only 2), and the bush reaches at least
// BUSH_SEAT into it. Clamped so, the plate turns with the bush's axle, as an old helicopter's
// rotors are driven (Technic plates on the shaft, a bush pushed into each).
export function bushGrips(roles: string[], cyls: WorldCylinder[]): Connection[] {
  const BUSH_SEAT = 3; // LDU
  const result: Connection[] = [];
  for (const bush of cyls.filter((c) => roles[c.part] === 'bush' && c.gender === 'F' && c.secs.some((s) => s.shape === 'A'))) {
    const length = bush.secs.reduce((sum, sec) => sum + sec.length, 0);
    for (const hole of cyls) {
      if (hole.part === bush.part || hole.gender !== 'F' || !hole.secs.every((s) => s.shape === 'R')) continue;
      if (!axialOverlap(bush, hole)) continue;
      // How far the bush reaches into one of the hole's counterbores (its sections of radius 8).
      const way = Math.sign(hole.dir.dot(bush.dir));
      let at = new Vector3().subVectors(hole.start, bush.start).dot(bush.dir);
      let seated = 0;
      for (const sec of hole.secs) {
        const end = at + way * sec.length;
        if (Math.abs(sec.radius - 8) < AXIS_TOLERANCE) seated = Math.max(seated, Math.min(length, Math.max(at, end)) - Math.max(0, Math.min(at, end)));
        at = end;
      }
      if (seated >= BUSH_SEAT) result.push({ male: bush.part, female: hole.part, kind: 'rigid', from: bush.start.clone(), to: bush.start.clone().addScaledVector(bush.dir, length) });
    }
  }
  return result;
}

// A toothed half bush pushed up against a toothed toggle joint locks it: the teeth on one face
// of the bush fit those round the toggle joint's pin hole, so the toggle joint turns with the
// bush's axle, through the pin hole it would otherwise turn on (the 8849 Tractor's hitch: its
// rear cross axle turns its lower links so). The bush's teeth are at the end its hole runs to
// (its round section), the toggle joint's at the end its pin hole runs to, away from its axle
// hole; the two face each other, touching.
export function toothedBushes(roles: string[], cyls: WorldCylinder[]): Connection[] {
  const TOUCH = 2; // LDU: how far apart the two rings of teeth may be
  const end = (c: WorldCylinder) => c.start.clone().addScaledVector(c.dir, c.secs.reduce((sum, sec) => sum + sec.length, 0));
  const holes = cyls.filter((c) => roles[c.part] === 'toothed toggle joint' && c.gender === 'F' && c.secs.every((s) => s.shape === 'R'));
  const result: Connection[] = [];
  for (const bush of cyls.filter((c) => roles[c.part] === 'toothed bush' && c.gender === 'F')) {
    const teeth = end(bush);
    for (const hole of holes) {
      if (bush.dir.dot(hole.dir) > -1 + ANGLE_TOLERANCE || teeth.distanceTo(end(hole)) > TOUCH) continue;
      result.push({ male: bush.part, female: hole.part, kind: 'rigid', from: teeth, to: end(hole) });
    }
  }
  return result;
}
