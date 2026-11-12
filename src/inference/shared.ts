// What the inference rules share: a connection point in model coordinates, the tolerances
// more than one rule uses, and small helpers.

import { Vector3 } from 'three';
import { ConnectionTable, Section } from '../connections.ts';
import { PlacedPart } from '../ldr.ts';
import type { Connection } from '../mechanism.ts';

// How far apart two connection points may be and still count as connected, in LDU.
export const AXIS_TOLERANCE = 0.5;
// How far off the axis of the part it sits in a ball may be built, and still be taken to sit on
// it (see lineUpBalls).
export const BALL_LINE = 3;
// How far off each other's axis a pin and its hole (or a tyre and its rim) may be and still
// fit, in LDU. Models are often built half an LDU out.
export const ALIGN_TOLERANCE = 1;
// The same for a part that would otherwise be loose (see looseFits): an official helicopter's
// rotor linkage is built a little stretched, its levers' ends 1.8 and 1.2 LDU off their pins.
// Not for every part: some parts have holes this close together (a steering arm's two pin holes,
// 2 LDU apart), and a pin would catch both.
export const LOOSE_ALIGN_TOLERANCE = 2;
// How far apart two connection points' directions may be and still line up, as the sine of
// the angle between them: 2 degrees. Models are sometimes built a little askew (an official
// model tilts a go-kart's engine by a degree), as real parts allow.
export const ANGLE_TOLERANCE = 0.035;
// Minimum length two connection points must overlap along their axis, in LDU.
export const MIN_OVERLAP = 1;
// How much two sliding parts must still overlap, in LDU (see slideRange): a plate on tiles a
// stud, so it rests on them; a piston in its bore half a stud, so it stays in it.
export const SURFACE_OVERLAP = 20;
export const BORE_OVERLAP = 10;

// A connection point in model coordinates.
export interface WorldCylinder {
  part: number; // index into the model's parts
  gender: 'M' | 'F';
  caps: string;
  start: Vector3;
  dir: Vector3; // unit vector
  secs: Section[];
  face?: Vector3; // a rack: the way its teeth face
  turns?: boolean; // a motor's output: what's fixed in it turns in the motor (see buildMechanism)
}

// For each part, a representative of the parts fixed to it (rigid and stud connections).
export function rigidGroups(count: number, connections: Connection[]): number[] {
  const leader = Array.from({ length: count }, (_, i) => i);
  const find = (i: number): number => (leader[i] === i ? i : (leader[i] = find(leader[i])));
  for (const c of connections) if (c.kind === 'rigid' || c.kind === 'stud') leader[find(c.male)] = find(c.female);
  return leader.map((_, i) => find(i));
}

// Step 3: every part's connection points, moved into model coordinates.
export function worldCylinders(parts: PlacedPart[], table: ConnectionTable): WorldCylinder[] {
  const result: WorldCylinder[] = [];
  parts.forEach((part, index) => {
    for (const cyl of table.parts[part.name] ?? []) {
      const start = new Vector3(...cyl.start).applyMatrix4(part.matrix);
      const dir = new Vector3(...cyl.dir).transformDirection(part.matrix);
      const rack = cyl.secs[0].rack;
      const face = rack ? new Vector3(...rack).transformDirection(part.matrix) : undefined;
      result.push({ part: index, gender: cyl.gender, caps: cyl.caps, start, dir, secs: cyl.secs, face });
    }
  });
  return result;
}

// Closed at one end: most connection points just say so, some say which (A: the start, B: the
// far end), as a round tile's anti-stud does.
export function closedAtOneEnd(c: WorldCylinder): boolean {
  return c.caps === 'one' || c.caps === 'A' || c.caps === 'B';
}

// A stud: a short round peg, closed at one end, on top of a brick or plate.
export function isStud(c: WorldCylinder): boolean {
  return c.caps === 'one' && c.secs.length === 1 && c.secs[0].shape === 'R' && Math.abs(c.secs[0].radius - 6) < AXIS_TOLERANCE;
}

// An anti-stud: the socket for a stud, underneath a brick or plate. A pin's end holds in one as
// a stud does (a 1 x 1 round tile on a half pin, a plate on a long pin's end).
export function isAntiStud(c: WorldCylinder): boolean {
  const sec = c.secs[0];
  return closedAtOneEnd(c) && c.secs.length === 1 && (sec.shape === 'R' || sec.shape === 'S') && Math.abs(sec.radius - 6) < AXIS_TOLERANCE;
}

// Where two cylinders on the same axis overlap, or null if they're not on the same axis or
// overlap by less than MIN_OVERLAP.
export function axialOverlap(m: WorldCylinder, f: WorldCylinder, align = ALIGN_TOLERANCE): { from: Vector3; to: Vector3 } | null {
  if (new Vector3().crossVectors(m.dir, f.dir).length() > ANGLE_TOLERANCE) return null;
  const offset = new Vector3().subVectors(f.start, m.start);
  const along = offset.dot(m.dir);
  if (offset.clone().addScaledVector(m.dir, -along).length() > align) return null;
  const mLength = m.secs.reduce((sum, s) => sum + s.length, 0);
  const fEnd = along + Math.sign(f.dir.dot(m.dir)) * f.secs.reduce((sum, s) => sum + s.length, 0);
  const lo = Math.max(0, Math.min(along, fEnd));
  const hi = Math.min(mLength, Math.max(along, fEnd));
  if (hi - lo < MIN_OVERLAP) return null;
  return { from: m.start.clone().addScaledVector(m.dir, lo), to: m.start.clone().addScaledVector(m.dir, hi) };
}

// The parts outside the largest group of parts attached to each other, and outside any group
// with an anchor in it (a train track, or a train on it: see anchorsOf), which stands on its own.
export function findLooseParts(count: number, connections: Connection[], anchors: Set<number> = new Set()): number[] {
  const leader = Array.from({ length: count }, (_, i) => i);
  const find = (i: number): number => {
    while (leader[i] !== i) i = leader[i];
    return i;
  };
  for (const c of connections) leader[find(c.male)] = find(c.female);
  const sizes = new Map<number, number>();
  for (let i = 0; i < count; i++) sizes.set(find(i), (sizes.get(find(i)) ?? 0) + 1);
  let biggest = -1;
  for (const [group, size] of sizes) if (biggest < 0 || size > sizes.get(biggest)!) biggest = group;
  const standing = new Set([biggest, ...[...anchors].map(find)]);
  const loose: number[] = [];
  for (let i = 0; i < count; i++) if (!standing.has(find(i))) loose.push(i);
  return loose;
}
