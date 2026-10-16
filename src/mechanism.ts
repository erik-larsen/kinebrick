// Works out a model's mechanism: which parts move together (bodies) and how bodies can
// move relative to each other (joints). See "How it works" in the README, steps 2 to 5.

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
  start: Vector3;
  dir: Vector3; // unit vector
  secs: Section[];
}

export type ConnectionKind = 'rigid' | 'revolute';

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
}

// Two gears whose teeth mesh: where their teeth touch, both move at the same speed.
//   spur   axes parallel, side by side
//   bevel  axes crossing; the tips of their bevel cones meet where the axes cross
export interface Mesh {
  gearA: number; // index into gears
  gearB: number;
  kind: 'spur' | 'bevel';
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
  return { roles, bodyOf, bodies, joints, connections, treads, gears, meshes };
}

// Step 3: every part's connection points, moved into model coordinates. Only open-ended
// cylinders (Technic holes, axles, pins, tyre seats) are used; studs aren't needed while
// all structure parts move together as one frame.
function worldCylinders(parts: PlacedPart[], table: ConnectionTable): WorldCylinder[] {
  const result: WorldCylinder[] = [];
  parts.forEach((part, index) => {
    for (const cyl of table.parts[part.name] ?? []) {
      if (cyl.caps !== 'none') continue;
      const start = new Vector3(...cyl.start).applyMatrix4(part.matrix);
      const dir = new Vector3(...cyl.dir).transformDirection(part.matrix);
      result.push({ part: index, gender: cyl.gender, start, dir, secs: cyl.secs });
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
function findConnections(cyls: WorldCylinder[]): Connection[] {
  const connections: Connection[] = [];
  for (const m of cyls) {
    if (m.gender !== 'M') continue;
    for (const f of cyls) {
      if (f.gender !== 'F' || f.part === m.part) continue;
      const c = connect(m, f);
      if (c) connections.push(c);
    }
  }
  return connections;
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

// Step 5: all structure parts form one body, the frame; rigid connections merge more parts
// into bodies. Returns the body index of each part.
function groupIntoBodies(count: number, roles: string[], connections: Connection[]): number[] {
  // Union-find: each part points towards a representative part of its group.
  const leader = Array.from({ length: count }, (_, i) => i);
  const find = (i: number): number => {
    while (leader[i] !== i) i = leader[i];
    return i;
  };
  const merge = (a: number, b: number) => {
    leader[find(a)] = find(b);
  };

  let firstStructure = -1;
  for (let i = 0; i < count; i++) {
    if (roles[i] !== 'structure') continue;
    if (firstStructure < 0) firstStructure = i;
    else merge(i, firstStructure);
  }
  for (const c of connections) {
    if (c.kind === 'rigid') merge(c.male, c.female);
  }

  // Number the groups 0, 1, 2, ... with the frame (if any) first.
  const bodyOfLeader = new Map<number, number>();
  if (firstStructure >= 0) bodyOfLeader.set(find(firstStructure), 0);
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
  ['tyre', 'wheels'],
  ['rim', 'wheels'],
  ['differential', 'differential'],
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
  for (const body of bodies) {
    const bodyRoles = body.parts.map((p) => roles[p]);
    if (bodyRoles.includes('structure')) {
      body.name = 'frame';
      continue;
    }
    const noun = BODY_NOUNS.find(([role]) => bodyRoles.includes(role))?.[1] ?? 'body';
    counts.set(noun, (counts.get(noun) ?? 0) + 1);
    body.name = `${noun} ${counts.get(noun)}`;
  }
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
