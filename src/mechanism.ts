// Works out a model's mechanism: which parts move together (bodies) and how bodies can
// move relative to each other (joints). See "How it works" in the README, steps 2 to 6.

import { Vector3 } from 'three';
import { ConnectionTable, Section } from './connections.ts';
import { PlacedPart } from './ldr.ts';

// How far apart two connection points may be and still count as connected, in LDU.
const AXIS_TOLERANCE = 0.5;
// Minimum length two connection points must overlap along their axis, in LDU.
const MIN_OVERLAP = 1;

// A connection point in model coordinates.
interface WorldCylinder {
  part: number; // index into the model's parts
  gender: 'M' | 'F';
  caps: string;
  start: Vector3;
  dir: Vector3; // unit vector
  secs: Section[];
}

// rigid     the parts turn together (an axle in an axle hole, a tyre on a rim)
// revolute  the parts can turn about the shared axis (an axle in a round hole)
// stud      a stud in an anti-stud: the parts are attached and move together
export type ConnectionKind = 'rigid' | 'revolute' | 'stud';

// Two parts joined at one pair of connection points.
export interface Connection {
  male: number; // part index (axle, pin)
  female: number; // part index (hole)
  kind: ConnectionKind;
  from: Vector3; // where the overlap starts, on the shared axis
  to: Vector3; // where it ends
}

export interface Body {
  name: string; // "frame", "body 1", "body 2", ...
  parts: number[]; // part indices
}

// Two bodies that can turn relative to each other about an axis.
export interface Joint {
  bodyA: number;
  bodyB: number;
  from: Vector3; // the axis, as a segment covering every connection behind this joint
  to: Vector3;
}

// A tyre's tread: the part of a tyre that can touch the ground.
export interface Tread {
  part: number;
  body: number;
  center: Vector3; // middle of the tread, on the tyre's axis
  axis: Vector3; // unit vector
  radius: number;
}

// A gear ring on a part, in model coordinates.
export interface Gear {
  part: number;
  body: number;
  center: Vector3; // middle of the teeth, on the gear's axis
  axis: Vector3; // unit vector
  radius: number; // pitch radius
  width: number; // of the teeth, along the axis
  teeth: number;
  spur: boolean; // straight teeth, for meshing on parallel axes
  bevel: string; // bevel teeth facing '+' (along axis), '-', 'both', or '' for none
  apex: number; // bevel teeth: distance from center to the tip of the pitch cone
  worm: number; // a worm: its thread's advance per turn (right-handed about axis), else 0
}

// Two gears whose teeth mesh: where their teeth touch, both move at the same speed.
//   spur   axes parallel, side by side
//   bevel  axes crossing; the tips of their bevel cones meet where the axes cross
//   worm   a worm (gearA) and a spur gear (gearB) on axes at right angles that don't meet
export interface Mesh {
  gearA: number; // index into gears
  gearB: number;
  kind: 'spur' | 'bevel' | 'worm';
}

export interface Mechanism {
  roles: string[]; // role of each part
  bodyOf: number[]; // body index of each part
  bodies: Body[];
  joints: Joint[];
  connections: Connection[];
  treads: Tread[];
  gears: Gear[];
  meshes: Mesh[];
  // Parts not attached to the rest of the model (by any connection, gear meshes aside):
  // everything outside the largest group of parts attached to each other. Usually a sign
  // that a part is in the wrong place.
  loose: number[];
}

export function inferMechanism(parts: PlacedPart[], table: ConnectionTable, roleList: Record<string, string>): Mechanism {
  const roles = parts.map((p) => roleList[p.name] ?? 'structure');
  const cyls = worldCylinders(parts, table);
  const connections = findConnections(cyls);
  const bodyOf = groupIntoBodies(parts.length, roles, connections);
  const bodies = nameBodies(bodyOf, roles);
  const joints = findJoints(connections, bodyOf);
  const treads = findTreads(cyls, bodyOf);
  const gears = findGears(cyls, bodyOf);
  const meshes = findMeshes(gears);
  const loose = findLooseParts(parts.length, connections);
  return { roles, bodyOf, bodies, joints, connections, treads, gears, meshes, loose };
}

// Step 3: every part's connection points, moved into model coordinates.
function worldCylinders(parts: PlacedPart[], table: ConnectionTable): WorldCylinder[] {
  const result: WorldCylinder[] = [];
  parts.forEach((part, index) => {
    for (const cyl of table.parts[part.name] ?? []) {
      const start = new Vector3(...cyl.start).applyMatrix4(part.matrix);
      const dir = new Vector3(...cyl.dir).transformDirection(part.matrix);
      result.push({ part: index, gender: cyl.gender, caps: cyl.caps, start, dir, secs: cyl.secs });
    }
  });
  return result;
}

function findTreads(cyls: WorldCylinder[], bodyOf: number[]): Tread[] {
  const treads: Tread[] = [];
  for (const c of cyls) {
    const sec = c.secs[0];
    if (c.secs.length !== 1 || sec.shape !== 'W') continue;
    const center = c.start.clone().addScaledVector(c.dir, sec.length / 2);
    treads.push({ part: c.part, body: bodyOf[c.part], center, axis: c.dir.clone(), radius: sec.radius });
  }
  return treads;
}

function findGears(cyls: WorldCylinder[], bodyOf: number[]): Gear[] {
  const gears: Gear[] = [];
  for (const c of cyls) {
    const sec = c.secs[0];
    if (c.secs.length !== 1 || sec.shape !== 'G') continue;
    const center = c.start.clone().addScaledVector(c.dir, sec.length / 2);
    gears.push({
      part: c.part,
      body: bodyOf[c.part],
      center,
      axis: c.dir.clone(),
      radius: sec.radius,
      width: sec.length,
      teeth: sec.teeth ?? 0,
      spur: sec.spur !== false,
      bevel: sec.bevel ?? '',
      apex: sec.apex ?? 0,
      worm: sec.worm ?? 0,
    });
  }
  return gears;
}

function findMeshes(gears: Gear[]): Mesh[] {
  const meshes: Mesh[] = [];
  for (let a = 0; a < gears.length; a++) {
    for (let b = a + 1; b < gears.length; b++) {
      const ga = gears[a];
      const gb = gears[b];
      if (ga.body === gb.body) continue;
      const parallel = new Vector3().crossVectors(ga.axis, gb.axis).length() < 0.01;
      if (ga.worm || gb.worm) {
        if (ga.worm && wormMesh(ga, gb)) meshes.push({ gearA: a, gearB: b, kind: 'worm' });
        if (gb.worm && wormMesh(gb, ga)) meshes.push({ gearA: b, gearB: a, kind: 'worm' });
        continue;
      }
      if (parallel && spurMesh(ga, gb)) meshes.push({ gearA: a, gearB: b, kind: 'spur' });
      if (!parallel && bevelMesh(ga, gb)) meshes.push({ gearA: a, gearB: b, kind: 'bevel' });
    }
  }
  return meshes;
}

// Spur gears on parallel axes mesh when their teeth are the same size, line up along the
// axis, and their axes are exactly their two pitch radii apart.
function spurMesh(ga: Gear, gb: Gear): boolean {
  if (!ga.spur || !gb.spur) return false;
  if (Math.abs(ga.radius / ga.teeth - gb.radius / gb.teeth) > 0.01) return false; // different tooth sizes
  const offset = new Vector3().subVectors(gb.center, ga.center);
  const along = offset.dot(ga.axis);
  const across = offset.clone().addScaledVector(ga.axis, -along).length();
  if ((ga.width + gb.width) / 2 - Math.abs(along) < MIN_OVERLAP) return false; // teeth don't face each other
  return Math.abs(across - (ga.radius + gb.radius)) < AXIS_TOLERANCE;
}

// A worm meshes with a spur gear of the same tooth size when their axes are at right angles,
// exactly their two pitch radii apart where they pass closest, and that closest point lies
// along both the worm and the gear's teeth.
function wormMesh(worm: Gear, gear: Gear): boolean {
  if (!gear.spur || gear.worm) return false;
  if (Math.abs(worm.axis.dot(gear.axis)) > 0.01) return false;
  if (Math.abs(worm.worm - 2 * Math.PI * (gear.radius / gear.teeth)) > 0.01) return false; // tooth size
  const closest = closestPoints(worm.center, worm.axis, gear.center, gear.axis);
  if (Math.abs(closest.distance - (worm.radius + gear.radius)) > AXIS_TOLERANCE) return false;
  const alongWorm = new Vector3().subVectors(closest.onA, worm.center).dot(worm.axis);
  const alongGear = new Vector3().subVectors(closest.onB, gear.center).dot(gear.axis);
  return Math.abs(alongWorm) <= worm.width / 2 && Math.abs(alongGear) <= gear.width / 2;
}

// The closest points of two lines (each a point and a unit direction), and how far apart they are.
export function closestPoints(pa: Vector3, da: Vector3, pb: Vector3, db: Vector3): { onA: Vector3; onB: Vector3; distance: number } {
  const w = new Vector3().subVectors(pa, pb);
  const b = da.dot(db);
  const d = da.dot(w);
  const e = db.dot(w);
  const denominator = 1 - b * b;
  const s = denominator > 1e-9 ? (b * e - d) / denominator : 0;
  const t = denominator > 1e-9 ? (e - b * d) / denominator : e;
  const onA = pa.clone().addScaledVector(da, s);
  const onB = pb.clone().addScaledVector(db, t);
  return { onA, onB, distance: onA.distanceTo(onB) };
}

// Bevel gears on crossing axes mesh when the tips of their bevel cones meet where the axes cross.
function bevelMesh(ga: Gear, gb: Gear): boolean {
  if (!ga.bevel || !gb.bevel) return false;
  const crossing = axesCrossing(ga.center, ga.axis, gb.center, gb.axis);
  if (!crossing) return false;
  return coneTipAt(ga, crossing) && coneTipAt(gb, crossing);
}

// Whether one of a gear's bevel cones has its tip at `point`.
function coneTipAt(g: Gear, point: Vector3): boolean {
  const sides = g.bevel === 'both' ? [1, -1] : g.bevel === '+' ? [1] : [-1];
  return sides.some((side) => g.center.clone().addScaledVector(g.axis, side * g.apex).distanceTo(point) < 1);
}

// Where two axes cross: the midpoint of their closest approach, or null if they're parallel
// or pass more than AXIS_TOLERANCE apart.
export function axesCrossing(pa: Vector3, da: Vector3, pb: Vector3, db: Vector3): Vector3 | null {
  const n = new Vector3().crossVectors(da, db);
  const nn = n.lengthSq();
  if (nn < 1e-6) return null;
  const w = new Vector3().subVectors(pb, pa);
  if (Math.abs(w.dot(n)) / Math.sqrt(nn) > AXIS_TOLERANCE) return null;
  // Closest points pa + s·da and pb + t·db.
  const s = new Vector3().crossVectors(w, db).dot(n) / nn;
  const t = new Vector3().crossVectors(w, da).dot(n) / nn;
  const onA = pa.clone().addScaledVector(da, s);
  const onB = pb.clone().addScaledVector(db, t);
  return onA.add(onB).multiplyScalar(0.5);
}

// What happens when a male section sits inside a female section, or null if they don't fit.
// Most fits need the same radius; a thinner round pin turns loosely inside an axle hole.
function sectionFit(male: Section, female: Section): ConnectionKind | null {
  const same = Math.abs(male.radius - female.radius) < AXIS_TOLERANCE;
  if (male.shape === 'A' && female.shape === 'A' && same) return 'rigid'; // axle in axle hole
  if (male.shape === 'T' && female.shape === 'T' && same) return 'rigid'; // tyre on rim
  if (male.shape === 'A' && female.shape === 'R' && same) return 'revolute'; // axle in round hole
  if (male.shape === 'R' && female.shape === 'R' && same) return 'revolute'; // pin in round hole
  if (male.shape === 'R' && female.shape === 'A' && male.radius < female.radius) return 'revolute'; // thin pin in axle hole
  return null;
}

// Step 4: pairs of connection points that line up.
// Open-ended cylinders (Technic holes, axles, pins, tyre seats) make rigid and revolute
// connections; studs in anti-studs make stud connections.
function findConnections(cyls: WorldCylinder[]): Connection[] {
  const connections: Connection[] = [];
  const males = cyls.filter((c) => c.gender === 'M');
  const females = cyls.filter((c) => c.gender === 'F');
  for (const m of males) {
    for (const f of females) {
      if (f.part === m.part) continue;
      const c = m.caps === 'none' && f.caps === 'none' ? connect(m, f) : isStud(m) && isAntiStud(f) ? studConnect(m, f) : null;
      if (c) connections.push(c);
    }
  }
  return connections;
}

// A stud: a short round peg, closed at one end, on top of a brick or plate.
function isStud(c: WorldCylinder): boolean {
  return c.caps === 'one' && c.secs.length === 1 && c.secs[0].shape === 'R' && Math.abs(c.secs[0].radius - 6) < AXIS_TOLERANCE;
}

// An anti-stud: the socket for a stud, underneath a brick or plate.
function isAntiStud(c: WorldCylinder): boolean {
  const sec = c.secs[0];
  return c.caps === 'one' && c.secs.length === 1 && (sec.shape === 'R' || sec.shape === 'S') && Math.abs(sec.radius - 6) < AXIS_TOLERANCE;
}

// A stud sitting in an anti-stud: on the same axis, overlapping along it.
function studConnect(m: WorldCylinder, f: WorldCylinder): Connection | null {
  const overlap = axialOverlap(m, f);
  if (!overlap) return null;
  return { male: m.part, female: f.part, kind: 'stud', from: overlap.from, to: overlap.to };
}

// Where two cylinders on the same axis overlap, or null if they're not on the same axis or
// overlap by less than MIN_OVERLAP.
function axialOverlap(m: WorldCylinder, f: WorldCylinder): { from: Vector3; to: Vector3 } | null {
  if (new Vector3().crossVectors(m.dir, f.dir).length() > 0.01) return null;
  const offset = new Vector3().subVectors(f.start, m.start);
  const along = offset.dot(m.dir);
  if (offset.clone().addScaledVector(m.dir, -along).length() > AXIS_TOLERANCE) return null;
  const mLength = m.secs.reduce((sum, s) => sum + s.length, 0);
  const fEnd = along + Math.sign(f.dir.dot(m.dir)) * f.secs.reduce((sum, s) => sum + s.length, 0);
  const lo = Math.max(0, Math.min(along, fEnd));
  const hi = Math.min(mLength, Math.max(along, fEnd));
  if (hi - lo < MIN_OVERLAP) return null;
  return { from: m.start.clone().addScaledVector(m.dir, lo), to: m.start.clone().addScaledVector(m.dir, hi) };
}

// Step 5: parts outside the largest group of parts that are attached to each other.
function findLooseParts(count: number, connections: Connection[]): number[] {
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
  const loose: number[] = [];
  for (let i = 0; i < count; i++) if (find(i) !== biggest) loose.push(i);
  return loose;
}

function connect(m: WorldCylinder, f: WorldCylinder): Connection | null {
  // Same axis: parallel, and the female's start lies on the male's line.
  if (new Vector3().crossVectors(m.dir, f.dir).length() > 0.01) return null;
  const offset = new Vector3().subVectors(f.start, m.start);
  const along = offset.dot(m.dir);
  const sideways = offset.clone().addScaledVector(m.dir, -along).length();
  if (sideways > AXIS_TOLERANCE) return null;

  // Walk both cylinders' sections, measured as distances along the male's axis.
  const sign = f.dir.dot(m.dir) > 0 ? 1 : -1;
  let total = 0;
  let kind: ConnectionKind = 'revolute';
  let lo = Infinity;
  let hi = -Infinity;
  let mPos = 0;
  for (const ms of m.secs) {
    const mEnd = mPos + ms.length;
    let fPos = along;
    for (const fs of f.secs) {
      const fEnd = fPos + sign * fs.length;
      const overlap = Math.min(mEnd, Math.max(fPos, fEnd)) - Math.max(mPos, Math.min(fPos, fEnd));
      const fit = sectionFit(ms, fs);
      if (overlap > 0 && fit) {
        total += overlap;
        if (fit === 'rigid') kind = 'rigid';
        lo = Math.min(lo, Math.max(mPos, Math.min(fPos, fEnd)));
        hi = Math.max(hi, Math.min(mEnd, Math.max(fPos, fEnd)));
      }
      fPos = fEnd;
    }
    mPos = mEnd;
  }
  if (total < MIN_OVERLAP) return null;

  return {
    male: m.part,
    female: f.part,
    kind,
    from: m.start.clone().addScaledVector(m.dir, lo),
    to: m.start.clone().addScaledVector(m.dir, hi),
  };
}

// Step 6: parts that are rigidly connected (an axle in an axle hole, a tyre on a rim) or
// attached by studs move as one body. The frame is the body with the most structure parts
// (bricks, plates, beams), and is numbered 0. Returns the body index of each part.
function groupIntoBodies(count: number, roles: string[], connections: Connection[]): number[] {
  // Union-find: each part points towards a representative part of its group.
  const leader = Array.from({ length: count }, (_, i) => i);
  const find = (i: number): number => {
    while (leader[i] !== i) i = leader[i];
    return i;
  };
  for (const c of connections) {
    if (c.kind === 'rigid' || c.kind === 'stud') leader[find(c.male)] = find(c.female);
  }

  // The frame: the group with the most structure parts.
  const structureCount = new Map<number, number>();
  for (let i = 0; i < count; i++) {
    if (roles[i] === 'structure') structureCount.set(find(i), (structureCount.get(find(i)) ?? 0) + 1);
  }
  let frame = -1;
  for (const [group, n] of structureCount) if (frame < 0 || n > structureCount.get(frame)!) frame = group;

  // Number the groups 0, 1, 2, ... with the frame (if any) first.
  const bodyOfLeader = new Map<number, number>();
  if (frame >= 0) bodyOfLeader.set(frame, 0);
  const bodyOf: number[] = [];
  for (let i = 0; i < count; i++) {
    const l = find(i);
    if (!bodyOfLeader.has(l)) bodyOfLeader.set(l, bodyOfLeader.size);
    bodyOf.push(bodyOfLeader.get(l)!);
  }
  return bodyOf;
}

// Bodies are named after their most telling part: "frame", "wheels 1", "gear 2", ...
const BODY_NOUNS: [string, string][] = [
  ['steering wheel', 'steering wheel'],
  ['tyre', 'wheels'],
  ['rim', 'wheels'],
  ['differential', 'differential'],
  ['worm', 'worm'],
  ['gear', 'gear'],
  ['axle', 'axle'],
];

function nameBodies(bodyOf: number[], roles: string[]): Body[] {
  const bodies: Body[] = [];
  bodyOf.forEach((b, part) => {
    if (!bodies[b]) bodies[b] = { name: '', parts: [] };
    bodies[b].parts.push(part);
  });
  const counts = new Map<string, number>();
  bodies.forEach((body, i) => {
    const bodyRoles = body.parts.map((p) => roles[p]);
    if (i === 0 && bodyRoles.includes('structure')) {
      body.name = 'frame';
      return;
    }
    // Other bodies with bricks or beams in them are assemblies (a steering axle's carrier).
    const noun = bodyRoles.includes('structure') ? 'assembly' : (BODY_NOUNS.find(([role]) => bodyRoles.includes(role))?.[1] ?? 'body');
    counts.set(noun, (counts.get(noun) ?? 0) + 1);
    body.name = `${noun} ${counts.get(noun)}`;
  });
  return bodies;
}

// Revolute connections between different bodies, merged when they share both bodies and
// an axis (an axle passing through two holes of the frame is one joint).
function findJoints(connections: Connection[], bodyOf: number[]): Joint[] {
  const joints: Joint[] = [];
  for (const c of connections) {
    if (c.kind !== 'revolute') continue;
    const a = bodyOf[c.male];
    const b = bodyOf[c.female];
    if (a === b) continue;
    const existing = joints.find((j) => sameBodies(j, a, b) && onSameAxis(j, c));
    if (existing) extendJoint(existing, c);
    else joints.push({ bodyA: Math.min(a, b), bodyB: Math.max(a, b), from: c.from.clone(), to: c.to.clone() });
  }
  return joints;
}

function sameBodies(j: Joint, a: number, b: number): boolean {
  return (j.bodyA === a && j.bodyB === b) || (j.bodyA === b && j.bodyB === a);
}

function onSameAxis(j: Joint, c: Connection): boolean {
  const dir = new Vector3().subVectors(j.to, j.from).normalize();
  const distance = (p: Vector3) => {
    const offset = new Vector3().subVectors(p, j.from);
    return offset.addScaledVector(dir, -offset.dot(dir)).length();
  };
  return distance(c.from) < AXIS_TOLERANCE && distance(c.to) < AXIS_TOLERANCE;
}

// Stretch the joint's segment so it also covers the connection's overlap.
function extendJoint(j: Joint, c: Connection) {
  const dir = new Vector3().subVectors(j.to, j.from).normalize();
  const origin = j.from.clone();
  const ts = [0, j.to.clone().sub(origin).dot(dir), c.from.clone().sub(origin).dot(dir), c.to.clone().sub(origin).dot(dir)];
  j.from = origin.clone().addScaledVector(dir, Math.min(...ts));
  j.to = origin.clone().addScaledVector(dir, Math.max(...ts));
}
