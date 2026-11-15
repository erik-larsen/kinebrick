// A group hung by one hinge on a part that slides, kept in line by the guide the slider slides in.

import { Vector3 } from 'three';
import type { Connection } from '../mechanism.ts';
import { groupIntoBodies } from './bodies.ts';
import { ANGLE_TOLERANCE, SURFACE_OVERLAP, type WorldCylinder } from './shared.ts';

// How far apart two beams' middle lines are when they lie side by side, face to face: a beam
// is 20 LDU across.
const BESIDE = 20;
const BESIDE_TOLERANCE = 1;

// A group of parts hung by one hinge on a part that slides, with a beam lying along the slide,
// face to face with a beam of what the slider slides in: that beam keeps it from swinging on
// its hinge, so it slides along with the slider, both kept in line by the guide. The 8258 Crane
// Truck's outriggers: each yellow beam is pinned by one axle pin to its gear rack, and the two
// slide in the chassis's guide frame together, the yellow beam lying against a grey one.
// A beam's body is the square section along its length that its data gives it (a 13 long
// beam's runs its whole length). Returns a slide for each such group, between its beam and the
// guide's, along the slider's slide.
export function hungOnSliders(count: number, roles: string[], cyls: WorldCylinder[], connections: Connection[]): Connection[] {
  const body = groupIntoBodies(count, roles, connections);
  // What joins each body to the others.
  const touching = new Map<number, Connection[]>();
  for (const c of connections) {
    const [a, b] = [body[c.male], body[c.female]];
    if (a === b) continue;
    for (const x of [a, b]) touching.set(x, [...(touching.get(x) ?? []), c]);
  }
  const beams = cyls.filter((c) => c.gender === 'M' && c.secs.length === 1 && c.secs[0].shape === 'S' && Math.abs(c.secs[0].radius - BESIDE / 2) < 0.1);
  const length = (c: WorldCylinder) => c.secs[0].length;
  const found: Connection[] = [];
  const done = new Set<number>();
  for (const s of connections) {
    if (s.kind !== 'slide') continue;
    const [slider, guide] = [body[s.male], body[s.female]];
    if (slider === guide) continue;
    const along = new Vector3().subVectors(s.to, s.from);
    if (along.length() === 0) continue;
    along.normalize();
    // The bodies hung on the slider: all that joins them to any other body is a turn on the
    // slider, about one axis across the slide.
    for (const [hung, joins] of touching) {
      if (hung === slider || hung === guide || done.has(hung)) continue;
      if (!joins.every((c) => c.kind === 'revolute' && [body[c.male], body[c.female]].includes(slider))) continue;
      const axis = new Vector3().subVectors(joins[0].to, joins[0].from);
      if (axis.length() === 0) continue;
      axis.normalize();
      if (Math.abs(axis.dot(along)) > ANGLE_TOLERANCE) continue;
      if (joins.some((c) => new Vector3().subVectors(c.to, c.from).normalize().cross(axis).length() > ANGLE_TOLERANCE)) continue;
      // A beam of the hung body beside a beam of the guide, along the slide, on the side its
      // hinge would swing it to.
      for (const mine of beams) {
        if (body[mine.part] !== hung || mine.dir.clone().cross(along).length() > ANGLE_TOLERANCE) continue;
        const other = beams.find((g) => {
          if (body[g.part] !== guide || g.dir.clone().cross(along).length() > ANGLE_TOLERANCE) return false;
          const offset = new Vector3().subVectors(g.start, mine.start);
          const shift = offset.dot(along);
          const across = offset.clone().addScaledVector(along, -shift);
          if (Math.abs(across.length() - BESIDE) > BESIDE_TOLERANCE || Math.abs(across.dot(axis)) > BESIDE_TOLERANCE) return false;
          // How far they lie side by side along the slide.
          const [a0, a1] = [0, length(mine) * Math.sign(mine.dir.dot(along))].sort((x, y) => x - y);
          const [b0, b1] = [shift, shift + length(g) * Math.sign(g.dir.dot(along))].sort((x, y) => x - y);
          return Math.min(a1, b1) - Math.max(a0, b0) >= SURFACE_OVERLAP;
        });
        if (!other) continue;
        found.push({ male: mine.part, female: other.part, kind: 'slide', from: mine.start.clone(), to: mine.start.clone().add(along) });
        done.add(hung);
        break;
      }
    }
  }
  return found;
}
