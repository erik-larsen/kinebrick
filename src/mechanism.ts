// Works out a model's mechanism: which parts move together (bodies) and how bodies can
// move relative to each other (joints). See "How it works" in ARCHITECTURE.md, steps 2 to 6.

import { Vector3 } from 'three';
import { ConnectionTable, Section } from './connections.ts';
import { Kinematics } from './kinematics.ts';
import { PlacedPath, PlacedPart } from './ldr.ts';

// How far apart two connection points may be and still count as connected, in LDU.
const AXIS_TOLERANCE = 0.5;
// How far off each other's axis a pin and its hole (or a tyre and its rim) may be and still
// fit, in LDU. Models are often built half an LDU out.
const ALIGN_TOLERANCE = 1;
// How far apart two connection points' directions may be and still line up, as the sine of
// the angle between them: 2 degrees. Models are sometimes built a little askew (an official
// model tilts a go-kart's engine by a degree), as real parts allow.
const ANGLE_TOLERANCE = 0.035;
// How far meshing gears' axles (or a gear and a rack's pitch line) may be from exactly their
// pitch radii apart, in LDU. Real teeth still engage a little closer or further, and models
// built by hand often have them so: an official model may put a gear 2 LDU into a rack.
const MESH_TOLERANCE = 2;
// Minimum length two connection points must overlap along their axis, in LDU.
const MIN_OVERLAP = 1;
// How much two sliding parts must still overlap, in LDU (see slideRange): a plate on tiles a
// stud, so it rests on them; a piston in its bore half a stud, so it stays in it.
const SURFACE_OVERLAP = 20;
const BORE_OVERLAP = 10;

// A connection point in model coordinates.
interface WorldCylinder {
  part: number; // index into the model's parts
  gender: 'M' | 'F';
  caps: string;
  start: Vector3;
  dir: Vector3; // unit vector
  secs: Section[];
  face?: Vector3; // a rack: the way its teeth face
}

// rigid     the parts turn together (an axle in an axle hole, a tyre on a rim)
// revolute  the parts can turn about the shared axis (an axle in a round hole)
// slide     the parts can slide along the shared axis, but not turn (a piston in its bore)
// ball      the parts can turn any way about a shared point (a towball in a ball socket)
// stud      a stud in an anti-stud: the parts are attached and move together
export type ConnectionKind = 'rigid' | 'revolute' | 'slide' | 'ball' | 'stud' | 'coupling';

// Two parts joined at one pair of connection points.
export interface Connection {
  male: number; // part index (axle, pin)
  female: number; // part index (hole)
  kind: ConnectionKind;
  from: Vector3; // where the overlap starts, on the shared axis (for a ball: its centre)
  to: Vector3; // where it ends (for a ball: its centre again)
  stiff?: boolean; // turns on a friction pin
  held?: boolean; // would turn on a friction pin, but the pin holds it (see inferMechanism)
  // A slide: where the male and female sections lie, as distances along the male's axis
  // (from -> to), and how much they must still overlap. How far it may slide follows from
  // them (see slideRange).
  extents?: { male: [number, number]; female: [number, number]; overlap: number };
}

export interface Body {
  name: string; // "frame", "body 1", "body 2", ...
  parts: number[]; // part indices
}

// Two bodies that can move relative to each other: turn about an axis (revolute), slide
// along one (slide), or turn any way about a point (ball).
export interface Joint {
  kind: 'revolute' | 'slide' | 'ball';
  bodyA: number;
  bodyB: number;
  from: Vector3; // the axis, as a segment covering every connection behind this joint (for a
  to: Vector3; //   ball, both are its centre)
  stiff: boolean; // turns on a friction pin, so a drag turns it only if nothing else can move
  // A slide joint: how far bodyB may slide relative to bodyA from where it starts (along
  // from -> to), and two parts that slide, which meet at either end of that.
  range?: [number, number];
  sliding?: [number, number];
}

// A tyre's tread: the part of a tyre that can touch the ground.
export interface Tread {
  part: number;
  body: number;
  center: Vector3; // middle of the tread, on the tyre's axis
  axis: Vector3; // unit vector
  radius: number;
  track?: number; // for a track's wheel, the track (an index into Mechanism.loops)
  // For a track's wheel, the radius it rolls at: its path's. The track's run along the ground
  // moves at the path's speed, though its links reach further out (to `radius`) under the wheel.
  rollRadius?: number;
}

// A chain, track or rubber band looped round wheels (a looped path, see PlacedPath). It makes
// the wheels it wraps turn together, their rims all moving at its speed.
export interface Loop {
  path: PlacedPath;
  wheels: LoopWheel[];
  links: number[]; // its parts
  depth: number | null; // a track's: how far its links reach out beyond its path; else null
}

// A wheel a loop wraps: the body that turns on `joint`, in `mount`, where the path goes round
// the circle `point` (an index into the path's points).
export interface LoopWheel {
  body: number;
  joint: number;
  mount: number;
  point: number;
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
  crown: number; // crown teeth facing +1 (along axis) or -1, their pitch plane through center; 0 for none
  worm: number; // a worm: its thread's advance per turn (right-handed about axis), else 0
  // A rack: the way its teeth face, else null. For a rack, center is the middle of its pitch
  // line, axis the way that line runs, length its length, and radius 0.
  face: Vector3 | null;
  length: number;
}

// Two gears whose teeth mesh: where their teeth touch, both move at the same speed.
//   spur   axes parallel, side by side
//   bevel  axes crossing; the tips of their bevel cones meet where the axes cross
//   worm   a worm (gearA) and a spur gear (gearB) on axes at right angles that don't meet
//   rack   a spur gear (gearA) whose pitch circle touches a rack's pitch line (gearB)
//   crown  a crown gear (gearA) and a spur gear (gearB) whose axle crosses the crown gear's at
//          right angles, its pitch circle touching the crown gear's pitch plane
export interface Mesh {
  gearA: number; // index into gears
  gearB: number;
  kind: 'spur' | 'bevel' | 'worm' | 'rack' | 'crown';
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
  // Universal joints: the shafts on either side turn together (see universalJoints).
  couplings: Coupling[];
  loops: Loop[]; // chains, tracks and rubber bands looped round wheels
}

// A universal joint: bodyA and bodyB, each a shaft turning in something, turn at the same rate
// about their own axes, which meet at `center`. The axes are the ends' axle holes (model
// coordinates), for a shaft that turns in nothing but the joints at its ends.
export interface Coupling {
  bodyA: number;
  bodyB: number;
  center: Vector3;
  axisA: Vector3;
  axisB: Vector3;
  atA: Vector3; // where each end part is
  atB: Vector3;
}

export function inferMechanism(parts: PlacedPart[], table: ConnectionTable, roleList: Record<string, string>): Mechanism {
  // Friction pins hold what they join in place, unless they're the only way the model can
  // move (a linkage built on friction pins). So first try them as rigid: if the model can
  // still move, that's it; if not, they stay joints, stiff ones.
  const build = (guide: Set<number>) => {
    const rigid = buildMechanism(parts, table, roleList, true, guide);
    if (!rigid.connections.some((c) => c.held) || new Kinematics(rigid).freeMotions().length > 0) return rigid;
    return buildMechanism(parts, table, roleList, false, guide);
  };
  const mech = build(new Set());
  const guide = racksToGuide(mech);
  return guide.size ? build(guide) : mech;
}

// Racks that need guiding: a rack that can still move with its gear held still, held by
// nothing that sets its path but the gear (a steering rack on tie rods, which in the real
// model slides in a channel of bricks). A rack whose linkage sets its path already (a tie bar
// fixed to the tops of two turntables) needs no guide, and a straight one would jam it.
// Returns the rack parts to guide.
function racksToGuide(mech: Mechanism): Set<number> {
  const guide = new Set<number>();
  const kin = new Kinematics(mech);
  for (const mesh of mech.meshes) {
    if (mesh.kind !== 'rack') continue;
    const gear = mech.gears[mesh.gearA];
    const rack = mech.gears[mesh.gearB];
    if (mech.joints.some((j) => j.kind === 'slide' && (j.bodyA === rack.body || j.bodyB === rack.body))) continue;
    if (!kin.parentLink(gear.body)) continue;
    kin.toggleFreeze(gear.body);
    const moves = kin.freeMotions().some((m) => [0, 1, 2, 3, 4, 5].some((k) => Math.abs(m[6 * rack.body + k] - m[k]) > 1e-6));
    kin.toggleFreeze(gear.body);
    if (moves) for (const g of mech.gears) if (g.face && g.body === rack.body) guide.add(g.part);
  }
  return guide;
}

// The mechanism, with friction pins treated as rigid or as stiff joints.
function buildMechanism(parts: PlacedPart[], table: ConnectionTable, roleList: Record<string, string>, frictionRigid: boolean, guide = new Set<number>()): Mechanism {
  // A path's parts (a chain's links) only show where it runs: they connect to nothing, and
  // move with what's nearest (see decorations), or round their loop (see findLoops).
  const roles = parts.map((p) => (p.path ? 'path' : roleList[p.name] ?? 'structure'));
  const cyls = worldCylinders(parts, table).filter((c) => roles[c.part] !== 'path');
  const connections = findConnections(cyls);
  fixPins(connections, roles, frictionRigid);
  connections.push(...platesOnEdge(cyls));
  connections.push(...onFourStuds(cyls));
  connections.push(...onTiles(cyls, connections));
  connections.push(...inGrooves(parts, cyls, table));
  connections.push(...guidedRacks(parts.length, cyls, connections, guide));
  connections.push(...decorations(parts, roles, cyls));
  connections.push(...guidedPistons(parts, roles, cyls, connections));
  const joined = universalJoints(parts, roles, cyls, connections);
  const loose = findLooseParts(parts.length, connections);
  connections.push(...rideAlong(parts, cyls, connections, loose));
  const bodyOf = groupIntoBodies(parts.length, roles, connections);
  const bodies = nameBodies(bodyOf, roles);
  const joints = findJoints(connections, bodyOf);
  const treads = findTreads(cyls, bodyOf);
  const gears = findGears(cyls, bodyOf);
  const meshes = findMeshes(gears);
  const at = (part: number) => new Vector3().setFromMatrixPosition(parts[part].matrix);
  const couplings = joined.map(({ partA, partB, center, axisA, axisB }) => ({ bodyA: bodyOf[partA], bodyB: bodyOf[partB], center, axisA, axisB, atA: at(partA), atB: at(partB) }));
  const loops = findLoops(parts, roles, bodyOf, joints, table);
  treads.push(...trackTreads(loops));
  return { roles, bodyOf, bodies, joints, connections, treads, gears, meshes, loose, couplings, loops };
}

// A piston with no cylinder of its own to slide in, such as the old 2x2 piston block, whose
// cylinder is a square of bricks around it, slides along its own axis (its y) against the
// part nearest to it that it isn't connected to.
function guidedPistons(parts: PlacedPart[], roles: string[], cyls: WorldCylinder[], connections: Connection[]): Connection[] {
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
      if (touching.has(group[c.part])) continue;
      if (!nearest || c.start.distanceTo(at) < nearest.start.distanceTo(at)) nearest = c;
    }
    if (!nearest) return;
    const axis = new Vector3(0, 1, 0).transformDirection(parts[piston].matrix);
    guided.push({ male: piston, female: nearest.part, kind: 'slide', from: at, to: at.clone().add(axis) });
  });
  return guided;
}

// For each part, a representative of the parts fixed to it (rigid and stud connections).
function rigidGroups(count: number, connections: Connection[]): number[] {
  const leader = Array.from({ length: count }, (_, i) => i);
  const find = (i: number): number => (leader[i] === i ? i : (leader[i] = find(leader[i])));
  for (const c of connections) if (c.kind === 'rigid' || c.kind === 'stud') leader[find(c.male)] = find(c.female);
  return leader.map((_, i) => find(i));
}

// A universal joint's centre is a cross whose two arms turn in the ends of two shafts. As two
// hinges, the cross would lock the joint solid if the model's shafts miss its middle by a
// fraction of an LDU, as built models do. What the joint does is pass turning from one shaft
// to the other, so that's what KineBrick models: the cross is fixed to the first end, its
// other arm lets go of the second end, and the two shafts turn together (see Coupling).
// Replaces those connections in `connections` with a coupling (which only says the two ends
// are attached); returns the pairs of ends it couples.
function universalJoints(parts: PlacedPart[], roles: string[], cyls: WorldCylinder[], connections: Connection[]) {
  const joined: { partA: number; partB: number; center: Vector3; axisA: Vector3; axisB: Vector3 }[] = [];
  const axisOfEnd = (end: number) => cyls.find((c) => c.part === end && c.secs.some((s) => s.shape === 'A'))?.dir.clone() ?? new Vector3(0, 0, 1);
  roles.forEach((role, cross) => {
    if (role !== 'universal joint') return;
    const arms = connections.filter((c) => c.kind === 'revolute' && (c.male === cross || c.female === cross));
    const ends = [...new Set(arms.map((c) => (c.male === cross ? c.female : c.male)))];
    if (ends.length !== 2) return;
    for (const c of arms) {
      const end = c.male === cross ? c.female : c.male;
      if (end === ends[0]) c.kind = 'rigid';
      else connections.splice(connections.indexOf(c), 1);
    }
    const center = new Vector3().setFromMatrixPosition(parts[cross].matrix);
    connections.push({ male: ends[0], female: ends[1], kind: 'coupling', from: center, to: center.clone() });
    joined.push({ partA: ends[0], partB: ends[1], center, axisA: axisOfEnd(ends[0]), axisB: axisOfEnd(ends[1]) });
  });
  return joined;
}

// A part with a single anti-stud (a 1x1 round brick or plate) sitting centred between four
// studs grips them: its round underside fits between them, a classic way to set a part half a
// stud off the grid (an official crane's outrigger legs stand so on their pads).
function onFourStuds(cyls: WorldCylinder[]): Connection[] {
  const UP = new Vector3(0, -1, 0);
  const antiStuds = cyls.filter((c) => c.gender === 'F' && isAntiStud(c) && c.dir.dot(UP) > 0.99);
  const perPart = new Map<number, number>();
  for (const a of antiStuds) perPart.set(a.part, (perPart.get(a.part) ?? 0) + 1);
  const studs = cyls.filter((c) => c.gender === 'M' && isStud(c) && c.dir.dot(UP) > 0.99);
  const held: Connection[] = [];
  for (const a of antiStuds) {
    if (perPart.get(a.part) !== 1) continue;
    const around = studs.filter((st) => st.part !== a.part && Math.abs(st.start.y - a.start.y) < AXIS_TOLERANCE && Math.abs(Math.abs(st.start.x - a.start.x) - 10) < ALIGN_TOLERANCE && Math.abs(Math.abs(st.start.z - a.start.z) - 10) < ALIGN_TOLERANCE);
    for (const part of new Set(around.map((st) => st.part))) {
      if (around.filter((st) => st.part === part).length < 4) continue;
      held.push({ male: part, female: a.part, kind: 'stud', from: a.start.clone(), to: a.start.clone() });
    }
  }
  return held;
}

// A part held by nothing but smooth tiles under it slides along them: nothing grips a tile
// from above (an official crane's outriggers slide out on tiles). Like a plate on tiles (see
// the corrections), along the tile's length (whatever keeps it in line is taken as read), as
// long as it still overlaps the tile by a stud. A part attached otherwise (a seat on a rack)
// is left to that: a tile lets it slide any way, so a slide along the tile could jam it.
function onTiles(cyls: WorldCylinder[], connections: Connection[]): Connection[] {
  const count = Math.max(0, ...cyls.map((c) => c.part)) + 1;
  const loose = new Set(findLooseParts(count, connections));
  if (loose.size === 0) return [];
  const UP = new Vector3(0, -1, 0);
  const tops = cyls.filter((c) => c.gender === 'F' && c.secs.length === 1 && c.secs[0].shape === 'P' && Math.abs(c.dir.dot(UP)) < 0.01);
  const antiStuds = cyls.filter((c) => c.gender === 'F' && isAntiStud(c) && c.dir.dot(UP) > 0.99);
  const group = rigidGroups(count, connections);
  const slides: Connection[] = [];
  for (const top of tops) {
    const length = top.secs[0].length;
    const width = top.secs[0].radius;
    const resting = new Set<number>(); // parts with anti-studs on this tile
    for (const a of antiStuds) {
      if (a.part === top.part || !loose.has(a.part) || loose.has(top.part) || group[a.part] === group[top.part]) continue;
      const offset = new Vector3().subVectors(a.start, top.start);
      if (Math.abs(offset.y) > AXIS_TOLERANCE) continue;
      const along = offset.dot(top.dir);
      const across = offset.clone().addScaledVector(top.dir, -along).length();
      if (across > width - 4 || along < 0 || along > length) continue;
      resting.add(a.part);
    }
    for (const part of resting) {
      const ownAlong = antiStuds.filter((a) => a.part === part).map((a) => new Vector3().subVectors(a.start, top.start).dot(top.dir));
      const from = top.start.clone();
      slides.push({
        male: part,
        female: top.part,
        kind: 'slide',
        from,
        to: from.clone().add(top.dir),
        extents: { male: [Math.min(...ownAlong) - 10, Math.max(...ownAlong) + 10], female: [0, length], overlap: SURFACE_OVERLAP },
      });
    }
  }
  return slides;
}

// A plate standing on its edge between two rows of studs is held there: a plate is 8 LDU thick,
// just the gap between neighbouring studs (an old trick, used on an official tractor's cab).
// Found from connection points alone: an upright plate's studs all point the same way across,
// its anti-studs lie 8 LDU behind them, and its bottom edge is half a stud below its lowest
// studs. It's held by a part whose studs stand on the surface that edge rests on, half a stud
// either side of the plate's middle.
function platesOnEdge(cyls: WorldCylinder[]): Connection[] {
  const UP = new Vector3(0, -1, 0); // LDraw's y points down
  const isStudCyl = (c: WorldCylinder) => c.gender === 'M' && isStud(c);
  const byPart = new Map<number, WorldCylinder[]>();
  for (const c of cyls) byPart.set(c.part, [...(byPart.get(c.part) ?? []), c]);
  const upStuds = cyls.filter((c) => isStudCyl(c) && c.dir.dot(UP) > 0.99);
  const held: Connection[] = [];
  for (const [part, own] of byPart) {
    const studs = own.filter(isStudCyl);
    if (studs.length === 0) continue;
    const across = studs[0].dir;
    if (Math.abs(across.dot(UP)) > 0.1 || studs.some((st) => st.dir.dot(across) < 0.99)) continue; // not upright
    const antiStuds = own.filter((c) => c.gender === 'F' && isAntiStud(c));
    const face = studs[0].start.dot(across);
    if (!antiStuds.some((a) => Math.abs(face - a.start.dot(across) - 8) < AXIS_TOLERANCE)) continue; // not a plate
    const middle = face - 4;
    const edge = Math.max(...studs.map((st) => st.start.y)) + 10; // y points down
    const sideways = new Vector3().crossVectors(across, UP).normalize();
    const along = studs.map((st) => st.start.dot(sideways));
    const [lo, hi] = [Math.min(...along) - 10, Math.max(...along) + 10];
    const sides = new Map<number, Set<number>>();
    for (const st of upStuds) {
      if (st.part === part || Math.abs(st.start.y - edge) > AXIS_TOLERANCE) continue;
      const off = st.start.dot(across) - middle;
      const at = st.start.dot(sideways);
      if (Math.abs(Math.abs(off) - 10) > AXIS_TOLERANCE || at < lo || at > hi) continue;
      sides.set(st.part, (sides.get(st.part) ?? new Set()).add(Math.sign(off)));
    }
    for (const [other, signs] of sides) {
      if (signs.size < 2) continue; // studs on both sides grip it
      const at = studs[0].start.clone().addScaledVector(across, -4);
      held.push({ male: other, female: part, kind: 'stud', from: at, to: at.clone() });
    }
  }
  return held;
}

// Decoration: parts that are there for looks and connect to nothing in a way that matters,
// such as stickers and the old pneumatic hoses models use for exhausts and cables. Each moves
// with the part whose connection point (stud, hole, axle) is nearest to it.
function decorations(parts: PlacedPart[], roles: string[], cyls: WorldCylinder[]): Connection[] {
  const isDecoration = (i: number) => roles[i] === 'decoration' || roles[i] === 'path' || parts[i].name.includes('sticker');
  const anchors = cyls.filter((c) => !isDecoration(c.part));
  const result: Connection[] = [];
  parts.forEach((p, i) => {
    if (!isDecoration(i)) return;
    const at = new Vector3().setFromMatrixPosition(p.matrix);
    let nearest: WorldCylinder | null = null;
    for (const c of anchors) if (!nearest || c.start.distanceTo(at) < nearest.start.distanceTo(at)) nearest = c;
    if (nearest) result.push({ male: i, female: nearest.part, kind: 'rigid', from: at, to: at.clone() });
  });
  return result;
}

// A plate slid edge first into a groove (a tipper end's, see ConnectionTable.grooves) is held
// there: one of its anti-studs lies in the groove (within ALIGN_TOLERANCE of its box), the
// plate facing across the groove.
function inGrooves(parts: PlacedPart[], cyls: WorldCylinder[], table: ConnectionTable): Connection[] {
  const result: Connection[] = [];
  parts.forEach((part, g) => {
    for (const groove of table.grooves?.[part.name] ?? []) {
      const center = new Vector3(...groove.center).applyMatrix4(part.matrix);
      const along = new Vector3(...groove.along).transformDirection(part.matrix);
      const across = new Vector3(...groove.across).transformDirection(part.matrix);
      const into = new Vector3().crossVectors(along, across);
      const held = new Set<number>();
      for (const c of cyls) {
        if (c.part === g || held.has(c.part) || c.gender !== 'F' || !isAntiStud(c)) continue;
        if (new Vector3().crossVectors(c.dir, across).length() > ANGLE_TOLERANCE) continue;
        const d = new Vector3().subVectors(c.start, center);
        const inside = [along, across, into].every((axis, k) => Math.abs(d.dot(axis)) <= groove.size[k] / 2 + ALIGN_TOLERANCE);
        if (!inside) continue;
        held.add(c.part);
        result.push({ male: g, female: c.part, kind: 'rigid', from: c.start.clone(), to: c.start.clone() });
      }
    }
  });
  return result;
}

// The chains, tracks and rubber bands looped round wheels: each looped path, with the wheels
// it goes round. A circle of the path is on a wheel if a turning joint's axis runs along the
// circle's axis, through its middle (within AXIS_TOLERANCE); of the joint's two bodies, the
// wheel is the one with a part nearest the circle's middle (a 40 tooth gear a track runs
// round, say), and the other is what it turns in. A circle on nothing that turns (a peg a
// rubber band is hooked round) is left out: the band slides round it.
function findLoops(parts: PlacedPart[], roles: string[], bodyOf: number[], joints: Joint[], table: ConnectionTable): Loop[] {
  const paths = [...new Set(parts.flatMap((p) => (p.path?.looped ? [p.path] : [])))];
  const at = parts.map((p) => new Vector3().setFromMatrixPosition(p.matrix));
  return paths.map((path) => {
    const wheels: LoopWheel[] = [];
    path.points.forEach((point, index) => {
      if (!point.circle) return;
      let best: LoopWheel | null = null;
      let bestDistance = point.radius;
      joints.forEach((joint, j) => {
        if (joint.kind !== 'revolute') return;
        const d = new Vector3().subVectors(joint.to, joint.from).normalize();
        if (Math.abs(Math.abs(d.dot(point.axis)) - 1) > 1e-3) return;
        const off = new Vector3().subVectors(point.center, joint.from);
        if (off.addScaledVector(d, -off.dot(d)).length() > AXIS_TOLERANCE) return;
        parts.forEach((_, i) => {
          if (roles[i] === 'path' || (bodyOf[i] !== joint.bodyA && bodyOf[i] !== joint.bodyB)) return;
          const distance = at[i].distanceTo(point.center);
          if (distance >= bestDistance) return;
          bestDistance = distance;
          const mount = bodyOf[i] === joint.bodyA ? joint.bodyB : joint.bodyA;
          best = { body: bodyOf[i], joint: j, mount, point: index };
        });
      });
      if (best) wheels.push(best);
    });
    const links = parts.flatMap((p, i) => (p.path === path ? [i] : []));
    return { path, wheels, links, depth: table.tracks?.[path.skin]?.depth ?? null };
  });
}

// A track touches the ground under its wheels, its links reaching `depth` beyond its path: so
// each wheel of a track rolls on the ground like a tyre that reaches as far.
function trackTreads(loops: Loop[]): Tread[] {
  return loops.flatMap((loop, track) =>
    loop.depth === null
      ? []
      : loop.wheels.map((w) => {
          const point = loop.path.points[w.point];
          return { part: loop.links[0], body: w.body, center: point.center.clone(), axis: point.axis.clone(), radius: point.radius + loop.depth!, track, rollRadius: point.radius };
        }),
  );
}

// A rack held by nothing but the gear it meshes with, such as a fork-lift's carriage riding up
// its mast, slides along its length past the gear, as if guided (the bricks either side that
// keep it in line are taken as read, as for a plate sliding on tiles). Its parts connect to the
// part the gear's axle turns in by a slide; it stops where the gear reaches the end of its
// teeth.
// `guide` names more racks to guide so, though attached (see racksToGuide).
function guidedRacks(count: number, cyls: WorldCylinder[], connections: Connection[], guide: Set<number>): Connection[] {
  const loose = new Set(findLooseParts(count, connections));
  if (loose.size === 0 && guide.size === 0) return [];
  const gears = findGears(cyls, Array.from({ length: count }, (_, i) => i));
  const guided: Connection[] = [];
  for (const rack of gears) {
    if (!rack.face || !(loose.has(rack.part) || guide.has(rack.part))) continue;
    for (const gear of gears) {
      if (gear.face || loose.has(gear.part) || !rackMesh(gear, rack)) continue;
      const mount = mountOf(gear.part, connections);
      if (mount < 0) continue;
      const from = rack.center.clone();
      guided.push({ male: rack.part, female: mount, kind: 'slide', from, to: from.clone().add(rack.axis) });
      break;
    }
  }
  return guided;
}

// The part a gear's axle turns in: from the gear, through what's rigidly fixed to it, to the
// other side of a turning connection. Or -1 if none.
function mountOf(gear: number, connections: Connection[]): number {
  const fixed = new Set([gear]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const c of connections) {
      if (c.kind !== 'rigid') continue;
      for (const [a, b] of [[c.male, c.female], [c.female, c.male]]) {
        if (fixed.has(a) && !fixed.has(b)) {
          fixed.add(b);
          grew = true;
        }
      }
    }
  }
  for (const c of connections) {
    if (c.kind !== 'revolute') continue;
    if (fixed.has(c.male) && !fixed.has(c.female)) return c.female;
    if (fixed.has(c.female) && !fixed.has(c.male)) return c.male;
  }
  return -1;
}

// Step 3: every part's connection points, moved into model coordinates.
function worldCylinders(parts: PlacedPart[], table: ConnectionTable): WorldCylinder[] {
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
    const width = sec.rack ? (sec.width ?? 0) : sec.length;
    gears.push({
      part: c.part,
      body: bodyOf[c.part],
      center,
      axis: c.dir.clone(),
      radius: sec.radius,
      width,
      teeth: sec.teeth ?? 0,
      spur: sec.spur !== false && !sec.rack,
      bevel: sec.bevel ?? '',
      apex: sec.apex ?? 0,
      crown: sec.crown === '+' ? 1 : sec.crown === '-' ? -1 : 0,
      worm: sec.worm ?? 0,
      face: c.face ?? null,
      length: sec.rack ? sec.length : 0,
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
      if (ga.face || gb.face) {
        if (gb.face && rackMesh(ga, gb)) meshes.push({ gearA: a, gearB: b, kind: 'rack' });
        if (ga.face && rackMesh(gb, ga)) meshes.push({ gearA: b, gearB: a, kind: 'rack' });
        continue;
      }
      if (ga.worm || gb.worm) {
        if (ga.worm && wormMesh(ga, gb)) meshes.push({ gearA: a, gearB: b, kind: 'worm' });
        if (gb.worm && wormMesh(gb, ga)) meshes.push({ gearA: b, gearB: a, kind: 'worm' });
        continue;
      }
      if (parallel && spurMesh(ga, gb)) meshes.push({ gearA: a, gearB: b, kind: 'spur' });
      if (!parallel && bevelMesh(ga, gb)) meshes.push({ gearA: a, gearB: b, kind: 'bevel' });
      if (!parallel && crownMesh(ga, gb)) meshes.push({ gearA: a, gearB: b, kind: 'crown' });
      if (!parallel && crownMesh(gb, ga)) meshes.push({ gearA: b, gearB: a, kind: 'crown' });
    }
  }
  // Racks lined up end to end on one body (two 1x4 racks on a plate) make one long row of
  // teeth: a gear meshing with one of them also meshes with the rest, though it isn't over
  // them yet, so it can roll from one to the next.
  for (const mesh of meshes.slice()) {
    if (mesh.kind !== 'rack') continue;
    gears.forEach((other, r) => {
      if (!other.face || other.body !== gears[mesh.gearB].body) return;
      if (meshes.some((m) => m.gearA === mesh.gearA && m.gearB === r)) return;
      if (rackMesh(gears[mesh.gearA], other, false)) meshes.push({ gearA: mesh.gearA, gearB: r, kind: 'rack' });
    });
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
  return Math.abs(across - (ga.radius + gb.radius)) < MESH_TOLERANCE;
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

// A spur gear meshes with a rack of the same tooth size when its axis lies across the rack
// (at right angles both to the way the rack runs and to the way its teeth face), its pitch
// circle touches the rack's pitch line, within the rack's length (unless `within` is false),
// and their teeth overlap across their widths.
function rackMesh(gear: Gear, rack: Gear, within = true): boolean {
  if (!gear.spur || gear.worm || gear.face) return false;
  const face = rack.face!;
  // Tooth size: the distance between teeth along the pitch line.
  if (Math.abs((2 * Math.PI * gear.radius) / gear.teeth - rack.length / rack.teeth) > 0.25) return false;
  if (Math.abs(gear.axis.dot(rack.axis)) > 0.01 || Math.abs(gear.axis.dot(face)) > 0.01) return false;
  const offset = new Vector3().subVectors(gear.center, rack.center);
  if (within && Math.abs(offset.dot(rack.axis)) > rack.length / 2) return false;
  if (Math.abs(offset.dot(face) - gear.radius) > MESH_TOLERANCE) return false;
  return (gear.width + rack.width) / 2 - Math.abs(offset.dot(gear.axis)) >= MIN_OVERLAP;
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

// A crown gear meshes with a spur gear of the same tooth size whose axle crosses its own at
// right angles, the spur gear's middle a pitch radius out from the crown gear's axis, and its
// pitch circle touching the crown gear's pitch plane on the side its teeth face.
function crownMesh(crown: Gear, gear: Gear): boolean {
  if (!crown.crown || !gear.spur || gear.crown || gear.worm || gear.face) return false;
  if (Math.abs(crown.radius / crown.teeth - gear.radius / gear.teeth) > 0.01) return false;
  if (Math.abs(crown.axis.dot(gear.axis)) > 0.01) return false;
  const offset = new Vector3().subVectors(gear.center, crown.center);
  const along = offset.dot(crown.axis);
  const out = offset.clone().addScaledVector(crown.axis, -along);
  if (Math.abs(out.length() - crown.radius) > MESH_TOLERANCE) return false;
  if (Math.abs(out.normalize().dot(gear.axis)) < 0.99) return false; // the gear's axle points at the crown gear's
  return Math.abs(along - crown.crown * gear.radius) <= MESH_TOLERANCE;
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
  if (male.shape === 'K' && female.shape === 'K' && same) return 'rigid'; // driving ring in a clutch gear
  if (male.shape === 'A' && female.shape === 'R' && same) return 'revolute'; // axle in round hole
  if (male.shape === 'R' && female.shape === 'R' && same) return 'revolute'; // pin in round hole
  if ((male.shape === 'R' || male.shape === 'S') && (female.shape === 'B' || female.shape === 'P') && same) return 'slide'; // piston in its bore, plate on a tile
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
      let c: Connection | null = null;
      if (isBall(m) && isBall(f)) c = ballConnect(m, f);
      else if (goesInForTechnic(m) && opensForTechnic(f)) c = connect(m, f);
      else if ((isStud(m) && isAntiStud(f)) || (isBottomPin(m) && isHollowStud(f))) c = studConnect(m, f);
      else if (isStud(m) && isTechnicHole(f)) c = studInHole(m, f);
      if (c) connections.push(c);
    }
  }
  return connections;
}


// A towball or a ball socket.
function isBall(c: WorldCylinder): boolean {
  return c.secs.length === 1 && c.secs[0].shape === 'O';
}

// A towball in a ball socket: same size, centred on the same point.
function ballConnect(m: WorldCylinder, f: WorldCylinder): Connection | null {
  if (Math.abs(m.secs[0].radius - f.secs[0].radius) > AXIS_TOLERANCE) return null;
  const centre = (c: WorldCylinder) => c.start.clone().addScaledVector(c.dir, c.secs[0].length / 2);
  const point = centre(m);
  if (point.distanceTo(centre(f)) > AXIS_TOLERANCE) return null;
  return { male: m.part, female: f.part, kind: 'ball', from: point, to: point.clone() };
}

// A pin joins two parts through round holes, and both turn on it. Which of them the pin turns
// with doesn't matter, so it's locked to one (the one it goes furthest into, or the first in
// the model), saving a body that only spins to no purpose. A friction pin's other joints are
// stiff, or, if `frictionRigid`, rigid too (marked `held`, so inferMechanism knows).
function fixPins(connections: Connection[], roles: string[], frictionRigid: boolean) {
  roles.forEach((role, pin) => {
    if (role !== 'pin' && role !== 'friction pin') return;
    const turning = connections.filter((c) => c.male === pin && c.kind === 'revolute');
    if (turning.length === 0) return;
    const length = (c: Connection) => c.from.distanceTo(c.to);
    turning.sort((a, b) => length(b) - length(a) || a.female - b.female);
    turning[0].kind = 'rigid';
    if (role !== 'friction pin') return;
    for (const c of turning.slice(1)) {
      if (frictionRigid) {
        c.kind = 'rigid';
        c.held = true;
      } else {
        c.stiff = true;
      }
    }
  });
}

// A male connection point that goes into Technic holes: open at both ends (an axle, a pin),
// closed at both (a bar, or a universal joint's centre's arms, which clips grip from the
// side), or an axle stub fixed to a part at one end (a connector's, a crankshaft's). Studs,
// closed at one end too, have no axle shape, so they don't count.
function goesInForTechnic(m: WorldCylinder): boolean {
  return m.caps === 'none' || m.caps === 'two' || (m.caps === 'one' && m.secs.some((s) => s.shape === 'A'));
}

// A female connection point that takes Technic axles and pins: open at both ends, or an axle
// hole closed at the far end (such as the ends of an axle joiner, or an angle connector's,
// which have a thin round lip at the mouth). Anti-studs, closed at one end too, have no axle
// shape, so they don't count.
function opensForTechnic(f: WorldCylinder): boolean {
  return f.caps === 'none' || (f.caps === 'one' && f.secs.some((s) => s.shape === 'A'));
}

// A stud: a short round peg, closed at one end, on top of a brick or plate.
function isStud(c: WorldCylinder): boolean {
  return c.caps === 'one' && c.secs.length === 1 && c.secs[0].shape === 'R' && Math.abs(c.secs[0].radius - 6) < AXIS_TOLERANCE;
}

// A bottom pin: the small peg under a 1-wide plate or tile, between its anti-studs.
function isBottomPin(c: WorldCylinder): boolean {
  return c.caps === 'one' && c.secs.length === 1 && c.secs[0].shape === 'R' && Math.abs(c.secs[0].radius - 4) < AXIS_TOLERANCE;
}

// The hole inside a hollow stud (on Technic bricks): a bottom pin plugs into it, so a 1-wide
// tile can sit half a stud off the grid, crosswise over a row of Technic bricks.
function isHollowStud(c: WorldCylinder): boolean {
  return c.caps === 'one' && c.secs.length === 1 && c.secs[0].shape === 'R' && Math.abs(c.secs[0].radius - 4) < AXIS_TOLERANCE;
}

// A Technic hole, round and open at both ends. A stud in one turns in it, like a pin (an old
// engine's piston turns on its connecting rod's stud), unless held on another axis too (a
// Technic plate's holes sit on studs, next to its anti-studs).
function isTechnicHole(c: WorldCylinder): boolean {
  return c.caps === 'none' && c.secs.some((s) => s.shape === 'R' && Math.abs(s.radius - 6) < AXIS_TOLERANCE);
}

// An anti-stud: the socket for a stud, underneath a brick or plate.
function isAntiStud(c: WorldCylinder): boolean {
  const sec = c.secs[0];
  return c.caps === 'one' && c.secs.length === 1 && (sec.shape === 'R' || sec.shape === 'S') && Math.abs(sec.radius - 6) < AXIS_TOLERANCE;
}

// A stud sitting in an anti-stud: on the same axis, overlapping along it.
function studInHole(m: WorldCylinder, f: WorldCylinder): Connection | null {
  const overlap = axialOverlap(m, f);
  if (!overlap) return null;
  return { male: m.part, female: f.part, kind: 'revolute', from: overlap.from, to: overlap.to };
}

function studConnect(m: WorldCylinder, f: WorldCylinder): Connection | null {
  const overlap = axialOverlap(m, f);
  if (!overlap) return null;
  return { male: m.part, female: f.part, kind: 'stud', from: overlap.from, to: overlap.to };
}

// Where two cylinders on the same axis overlap, or null if they're not on the same axis or
// overlap by less than MIN_OVERLAP.
function axialOverlap(m: WorldCylinder, f: WorldCylinder): { from: Vector3; to: Vector3 } | null {
  if (new Vector3().crossVectors(m.dir, f.dir).length() > ANGLE_TOLERANCE) return null;
  const offset = new Vector3().subVectors(f.start, m.start);
  const along = offset.dot(m.dir);
  if (offset.clone().addScaledVector(m.dir, -along).length() > ALIGN_TOLERANCE) return null;
  const mLength = m.secs.reduce((sum, s) => sum + s.length, 0);
  const fEnd = along + Math.sign(f.dir.dot(m.dir)) * f.secs.reduce((sum, s) => sum + s.length, 0);
  const lo = Math.max(0, Math.min(along, fEnd));
  const hi = Math.min(mLength, Math.max(along, fEnd));
  if (hi - lo < MIN_OVERLAP) return null;
  return { from: m.start.clone().addScaledVector(m.dir, lo), to: m.start.clone().addScaledVector(m.dir, hi) };
}

// Step 5: parts outside the largest group of parts that are attached to each other.
// Loose parts ride along with the part nearest to them: each group of loose parts attached to
// each other is fixed to the part whose connection point (stud, hole, axle) is nearest one of
// them, preferring a part of the same submodel (a bucket's plates ride with the bucket, not
// with a lever arm that happens to pass close by). They're still listed as loose, but the model can move: left where they were, they'd
// stand in the way of everything moving past them (an official bulldozer's bucket plates,
// which slot into grooves no connection data describes, stopped its tracks).
function rideAlong(parts: PlacedPart[], cyls: WorldCylinder[], connections: Connection[], loose: number[]): Connection[] {
  if (loose.length === 0) return [];
  const isLoose = new Set(loose);
  const leader = new Map(loose.map((i) => [i, i]));
  const find = (i: number): number => {
    while (leader.get(i) !== i) i = leader.get(i)!;
    return i;
  };
  for (const c of connections) if (isLoose.has(c.male) && isLoose.has(c.female)) leader.set(find(c.male), find(c.female));
  const anchors = cyls.filter((c) => !isLoose.has(c.part));
  const nearest = new Map<number, { part: number; anchor: number; distance: number }>(); // for each group
  for (const i of loose) {
    const at = new Vector3().setFromMatrixPosition(parts[i].matrix);
    for (const c of anchors) {
      // Another submodel's part counts as much further away.
      const distance = c.start.distanceTo(at) + (parts[c.part].submodel === parts[i].submodel ? 0 : 1e6);
      const best = nearest.get(find(i));
      if (!best || distance < best.distance) nearest.set(find(i), { part: i, anchor: c.part, distance });
    }
  }
  return [...nearest.values()].map(({ part, anchor }) => {
    const at = new Vector3().setFromMatrixPosition(parts[part].matrix);
    return { male: part, female: anchor, kind: 'rigid' as ConnectionKind, from: at, to: at.clone() };
  });
}

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
  if (new Vector3().crossVectors(m.dir, f.dir).length() > ANGLE_TOLERANCE) return null;
  const offset = new Vector3().subVectors(f.start, m.start);
  const along = offset.dot(m.dir);
  const sideways = offset.clone().addScaledVector(m.dir, -along).length();
  if (sideways > ALIGN_TOLERANCE) return null;

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
        if (fit === 'rigid' || (fit === 'slide' && kind === 'revolute')) kind = fit;
        lo = Math.min(lo, Math.max(mPos, Math.min(fPos, fEnd)));
        hi = Math.max(hi, Math.min(mEnd, Math.max(fPos, fEnd)));
      }
      fPos = fEnd;
    }
    mPos = mEnd;
  }
  if (total < MIN_OVERLAP) return null;

  const from = m.start.clone().addScaledVector(m.dir, lo);
  let extents: Connection['extents'];
  if (kind === 'slide') {
    // Measured along from -> to, from `from`.
    const length = (c: WorldCylinder) => c.secs.reduce((sum, sec) => sum + sec.length, 0);
    const fEnd = along + sign * length(f);
    const overlap = f.secs.some((sec) => sec.shape === 'P') ? SURFACE_OVERLAP : BORE_OVERLAP;
    extents = { male: [-lo, length(m) - lo], female: [Math.min(along, fEnd) - lo, Math.max(along, fEnd) - lo], overlap };
  }
  return { male: m.part, female: f.part, kind, from, to: m.start.clone().addScaledVector(m.dir, hi), extents };
}

// How far a slide's male part may slide from where it is, relative to the female: for as long
// as they still overlap by `overlap`, as a plate may overhang the end of its row of tiles, and
// a piston's skirt come out of the bottom of its cylinder.
function slideRange(e: { male: [number, number]; female: [number, number]; overlap: number }): [number, number] {
  const [mLo, mHi] = e.male;
  const [fLo, fHi] = e.female;
  return [fLo - mHi + e.overlap, fHi - mLo - e.overlap];
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
  // Two groups joined on two different axes can't turn on either, so they're one body (a
  // part pinned on at two places). Repeat, since each merge can make more.
  let merged = true;
  while (merged) {
    merged = false;
    const turning = connections.filter((c) => c.kind === 'revolute' && find(c.male) !== find(c.female));
    for (const a of turning) {
      const other = turning.find((b) => b !== a && sameGroups(a, b) && !coaxial(a, b));
      if (other) {
        leader[find(a.male)] = find(a.female);
        merged = true;
        break;
      }
    }
  }
  function sameGroups(a: Connection, b: Connection): boolean {
    const [a1, a2, b1, b2] = [find(a.male), find(a.female), find(b.male), find(b.female)];
    return (a1 === b1 && a2 === b2) || (a1 === b2 && a2 === b1);
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
  ['piston', 'piston'],
  ['connecting rod', 'connecting rod'],
  ['crankshaft', 'crankshaft'],
  ['rack', 'rack'],
  ['steering link', 'steering link'],
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
    // Other bodies with bricks or beams in them are assemblies (a steering axle's carrier),
    // unless they carry a rack (racks on a plate) or a crankshaft (with a fan on it).
    let noun = BODY_NOUNS.find(([role]) => bodyRoles.includes(role))?.[1] ?? 'body';
    if (bodyRoles.includes('structure') && !bodyRoles.includes('rack') && !bodyRoles.includes('crankshaft')) noun = 'assembly';
    counts.set(noun, (counts.get(noun) ?? 0) + 1);
    body.name = `${noun} ${counts.get(noun)}`;
  });
  return bodies;
}

// Revolute, slide and ball connections between different bodies, merged when they're the
// same kind and share both bodies and an axis (an axle passing through two holes of the
// frame is one joint) or, for balls, a centre.
function findJoints(connections: Connection[], bodyOf: number[]): Joint[] {
  const joints: Joint[] = [];
  for (const c of connections) {
    if (c.kind !== 'revolute' && c.kind !== 'slide' && c.kind !== 'ball') continue;
    const a = bodyOf[c.male];
    const b = bodyOf[c.female];
    if (a === b) continue;
    const kind = c.kind;
    // Slides between the same two bodies along parallel lines are one joint too (an outrigger
    // riding on two rows of tiles side by side).
    const along = (j: Joint) => (kind === 'ball' ? j.from.distanceTo(c.from) < AXIS_TOLERANCE : kind === 'slide' ? parallel(j, c) : onSameAxis(j, c));
    const existing = joints.find((j) => j.kind === kind && sameBodies(j, a, b) && along(j));
    if (existing) {
      if (kind !== 'ball') extendJoint(existing, c);
      existing.stiff = existing.stiff || c.stiff === true;
    } else {
      joints.push({ kind, bodyA: Math.min(a, b), bodyB: Math.max(a, b), from: c.from.clone(), to: c.to.clone(), stiff: c.stiff === true });
    }
  }

  // A slide joint's travel, from all the slide connections behind it together. Along one line
  // they add up (a plate on a row of tiles may slide as far as it stays over the row, not over
  // each tile); lines side by side each allow their own travel, and the joint may slide as far
  // as any of them allows (an outrigger may leave a short tile at its end behind).
  for (const joint of joints) {
    if (joint.kind !== 'slide') continue;
    const dir = new Vector3().subVectors(joint.to, joint.from).normalize();
    const lines: Connection[][] = [];
    for (const c of connections) {
      if (c.kind !== 'slide' || !c.extents || !sameBodies(joint, bodyOf[c.male], bodyOf[c.female]) || !parallel(joint, c)) continue;
      const line = lines.find((l) => onSameLine(l[0], c));
      if (line) line.push(c);
      else lines.push([c]);
    }
    let range: [number, number] | null = null;
    for (const line of lines) {
      let male: [number, number] = [Infinity, -Infinity];
      let female: [number, number] = [Infinity, -Infinity];
      let maleBody = -1;
      let overlap = 0;
      for (const c of line) {
        // Move the connection's extents to be measured from the joint's `from`, along its axis.
        const sign = new Vector3().subVectors(c.to, c.from).dot(dir) >= 0 ? 1 : -1;
        const shift = new Vector3().subVectors(c.from, joint.from).dot(dir);
        const place = ([lo, hi]: [number, number]): [number, number] => [Math.min(shift + sign * lo, shift + sign * hi), Math.max(shift + sign * lo, shift + sign * hi)];
        const [m0, m1] = place(c.extents!.male);
        const [f0, f1] = place(c.extents!.female);
        male = [Math.min(male[0], m0), Math.max(male[1], m1)];
        female = [Math.min(female[0], f0), Math.max(female[1], f1)];
        maleBody = bodyOf[c.male];
        overlap = c.extents!.overlap;
        joint.sliding = [c.male, c.female];
      }
      // How far the male may slide; the joint measures bodyB relative to bodyA.
      const r = slideRange({ male, female, overlap });
      const lineRange: [number, number] = joint.bodyB === maleBody ? r : [-r[1], -r[0]];
      range = range ? [Math.min(range[0], lineRange[0]), Math.max(range[1], lineRange[1])] : lineRange;
    }
    if (range) joint.range = range;
  }
  return joints;
}

function sameBodies(j: Joint, a: number, b: number): boolean {
  return (j.bodyA === a && j.bodyB === b) || (j.bodyA === b && j.bodyB === a);
}

// Whether two connections lie on the same axis.
function coaxial(a: Connection, b: Connection): boolean {
  const dir = new Vector3().subVectors(a.to, a.from).normalize();
  const distance = (p: Vector3) => {
    const offset = new Vector3().subVectors(p, a.from);
    return offset.addScaledVector(dir, -offset.dot(dir)).length();
  };
  return distance(b.from) < AXIS_TOLERANCE && distance(b.to) < AXIS_TOLERANCE;
}

// Whether a connection's axis runs the same way as a joint's.
function parallel(j: Joint, c: Connection): boolean {
  const dj = new Vector3().subVectors(j.to, j.from).normalize();
  const dc = new Vector3().subVectors(c.to, c.from).normalize();
  return new Vector3().crossVectors(dj, dc).length() < 0.01;
}

// Whether two connections lie on one line.
function onSameLine(a: Connection, b: Connection): boolean {
  const dir = new Vector3().subVectors(a.to, a.from).normalize();
  const offset = new Vector3().subVectors(b.from, a.from);
  return offset.addScaledVector(dir, -offset.dot(dir)).length() < AXIS_TOLERANCE;
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
