// Pistons and shock absorbers: a piston block sliding in the bricks round it, and a shock
// absorber sliding in its cylinder between its end stops.

import { Vector3 } from 'three';
import { PlacedPart } from '../ldr.ts';
import type { Connection } from '../mechanism.ts';
import type { ConnectionTable } from '../connections.ts';
import { ALIGN_TOLERANCE, ANGLE_TOLERANCE, AXIS_TOLERANCE, axialOverlap, rigidGroups, type WorldCylinder } from './shared.ts';

// A shock absorber in two parts: its rod slides in its cylinder along their shared axis, and
// may turn in it (a strut that is also a kingpin; pins at both its ends keep a rod from spinning
// elsewhere). Until Kinebrick models springs (v2.0) nothing pushes it out: it moves only as far
// as what it's fixed to is moved, between its end stops, rod fully in and fully out, which the
// cylinder's part data gives (see ConnectionTable.shocks). A rod is in its cylinder when its
// origin lies on the cylinder's axis, the rod placed the same way round, within those stops.
export function shockAbsorbers(parts: PlacedPart[], table: ConnectionTable, nameOf: (name: string) => string): Connection[] {
  const result: Connection[] = [];
  const at = (i: number) => new Vector3().setFromMatrixPosition(parts[i].matrix);
  parts.forEach((cylinder, c) => {
    for (const shock of table.shocks?.[nameOf(cylinder.name)] ?? []) {
      const out = new Vector3(...shock.dir).transformDirection(cylinder.matrix).normalize();
      parts.forEach((rod, r) => {
        if (r === c || nameOf(rod.name) !== shock.rod) return;
        // Placed the same way round: the rod's own axis along the cylinder's.
        if (new Vector3(...shock.dir).transformDirection(rod.matrix).normalize().cross(out).length() > ANGLE_TOLERANCE) return;
        const offset = at(r).sub(at(c));
        const along = offset.dot(out);
        if (offset.addScaledVector(out, -along).length() > ALIGN_TOLERANCE) return;
        if (along < shock.from - ALIGN_TOLERANCE || along > shock.to + ALIGN_TOLERANCE) return;
        // Measured into the cylinder from the rod's origin: it may go in as far as `from`, out
        // as far as `to`.
        const from = at(r);
        const [inward, outward] = [Math.max(0, along - shock.from), Math.max(0, shock.to - along)];
        result.push({ male: r, female: c, kind: 'slide', turns: true, springHeld: true, from, to: from.clone().sub(out), extents: { male: [0, 0], female: [-outward, inward], overlap: 0 } });
      });
    }
  });
  return result;
}

// A square rod in a square bore closed at one end that no shock absorber's data covers (a crane
// arm's inner beam in its outer arm, 32278 in 57779: a telescopic boom) is fixed at the length it
// was built at, as shock absorbers were before they slid. `shocks`: the connections
// shockAbsorbers made, whose parts this leaves alone.
export function squareRodsInBores(cyls: WorldCylinder[], shocks: Connection[]): Connection[] {
  const taken = new Set(shocks.flatMap((c) => [c.male, c.female]));
  const square = (c: WorldCylinder, gender: string, caps: string) => c.gender === gender && c.caps === caps && c.secs.length === 1 && c.secs[0].shape === 'S' && c.secs[0].radius > 6;
  const result: Connection[] = [];
  for (const rod of cyls.filter((c) => square(c, 'M', 'none') && !taken.has(c.part))) {
    for (const bore of cyls.filter((c) => square(c, 'F', 'one') && c.part !== rod.part && !taken.has(c.part) && Math.abs(c.secs[0].radius - rod.secs[0].radius) < AXIS_TOLERANCE)) {
      const overlap = axialOverlap(rod, bore);
      if (overlap) result.push({ male: rod.part, female: bore.part, kind: 'rigid', ...overlap });
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
