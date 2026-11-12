// Pistons and shock absorbers: a piston block sliding in the bricks round it, and a shock
// absorber held at the length it was built at.

import { Vector3 } from 'three';
import { PlacedPart } from '../ldr.ts';
import type { Connection } from '../mechanism.ts';
import { axialOverlap, AXIS_TOLERANCE, rigidGroups, type WorldCylinder } from './shared.ts';

// A shock absorber: its rod slides in its cylinder against a spring. Until Kinebrick models
// springs (v2.0), the spring holds it at the length it was built at, so a car sits on its
// suspension: the rod (square, open at both ends) is fixed in the cylinder (square, closed at
// one end) it's in.
export function shockAbsorbers(cyls: WorldCylinder[]): Connection[] {
  const square = (c: WorldCylinder, gender: string, caps: string) => c.gender === gender && c.caps === caps && c.secs.length === 1 && c.secs[0].shape === 'S' && c.secs[0].radius > 6;
  const result: Connection[] = [];
  for (const rod of cyls.filter((c) => square(c, 'M', 'none'))) {
    for (const cylinder of cyls.filter((c) => square(c, 'F', 'one') && c.part !== rod.part && Math.abs(c.secs[0].radius - rod.secs[0].radius) < AXIS_TOLERANCE)) {
      const overlap = axialOverlap(rod, cylinder);
      if (overlap) result.push({ male: rod.part, female: cylinder.part, kind: 'rigid', ...overlap });
    }
  }
  return result;
}

// A piston with no cylinder of its own to slide in, such as the old 2x2 piston block, whose
// cylinder is a square of bricks around it, slides along its own axis (its y) against the
// part nearest to it that it isn't connected to. Not an axle, an axle pin or an axle hole: the
// walls are bricks and plates, and an axle pin beside the piston may turn (the 8865's, holding
// the top of a cylinder bank).
export function guidedPistons(parts: PlacedPart[], roles: string[], cyls: WorldCylinder[], connections: Connection[]): Connection[] {
  const guided: Connection[] = [];
  roles.forEach((role, piston) => {
    if (role !== 'piston' || connections.some((c) => c.kind === 'slide' && (c.male === piston || c.female === piston))) return;
    // Not the piston, nor anything fixed to what it's connected to (its connecting rod).
    const group = rigidGroups(parts.length, connections);
    const touching = new Set(connections.flatMap((c) => (c.male === piston ? [group[c.female]] : c.female === piston ? [group[c.male]] : [])));
    touching.add(group[piston]);
    const at = new Vector3().setFromMatrixPosition(parts[piston].matrix);
    let nearest: WorldCylinder | null = null;
    for (const c of cyls) {
      if (touching.has(group[c.part]) || c.secs.some((s) => s.shape === 'A')) continue;
      if (!nearest || c.start.distanceTo(at) < nearest.start.distanceTo(at)) nearest = c;
    }
    if (!nearest) return;
    const axis = new Vector3(0, 1, 0).transformDirection(parts[piston].matrix);
    guided.push({ male: piston, female: nearest.part, kind: 'slide', from: at, to: at.clone().add(axis) });
  });
  return guided;
}
