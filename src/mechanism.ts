// Works out a model's mechanism: which parts move together (bodies) and how bodies can
// move relative to each other (joints). See "How it works" in ARCHITECTURE.md, steps 2 to 6.

import { Matrix4, Vector3 } from 'three';
import { ConnectionTable, Section } from './connections.ts';
import { acrossDirections, Kinematics, nullSpace } from './kinematics.ts';
import { PathPoint, PlacedPath, PlacedPart } from './ldr.ts';
import { LoopPath } from './paths.ts';

// How far apart two connection points may be and still count as connected, in LDU.
const AXIS_TOLERANCE = 0.5;
// How far the middle of a circle a chain placed link by link goes round may be from its wheel's
// axis, in LDU (see findLoops): the 8835 Forklift's chain is 0.7 LDU off its sprockets.
const CHAIN_REACH = 2;
// How far off the axis of the part it sits in a ball may be built, and still be taken to sit on
// it (see lineUpBalls).
const BALL_LINE = 3;
// How far off each other's axis a pin and its hole (or a tyre and its rim) may be and still
// fit, in LDU. Models are often built half an LDU out.
const ALIGN_TOLERANCE = 1;
// The same for a part that would otherwise be loose (see looseFits): an official helicopter's
// rotor linkage is built a little stretched, its levers' ends 1.8 and 1.2 LDU off their pins.
// Not for every part: some parts have holes this close together (a steering arm's two pin holes,
// 2 LDU apart), and a pin would catch both.
const LOOSE_ALIGN_TOLERANCE = 2;
// How far apart two connection points' directions may be and still line up, as the sine of
// the angle between them: 2 degrees. Models are sometimes built a little askew (an official
// model tilts a go-kart's engine by a degree), as real parts allow.
const ANGLE_TOLERANCE = 0.035;
// How far meshing gears' axles (or a gear and a rack's pitch line) may be from exactly their
// pitch radii apart, in LDU. Real teeth still engage a little closer or further, and models
// built by hand often have them so: an official model may put a gear 2 LDU into a rack.
const MESH_TOLERANCE = 2;
// The same for a gear and a rack's pitch line. A rack's straight teeth engage over more than a
// gear's do, and official models set gears further from them: the 8859 Tractor's 24 tooth
// gear sits 4 LDU off its steering rack, the 8849 Tractor's 8 tooth gears 3 LDU into theirs.
const RACK_TOLERANCE = 4.5;
// How far a gear's axle may tip about the way a rack runs, from square to its teeth, and still
// mesh (radians): the 1972 Go-Kart's steering column meets its rack at 26 degrees.
const RACK_TILT = 0.55;
// How far a bevel gear's cone tip may be from where its axle crosses the other gear's, in LDU.
// Teeth still overlap a tooth's depth (4 LDU, on the old 14 tooth bevel gear) apart: an
// official model sets one of a pair 20 LDU from where the axles cross, the other at 17.
const BEVEL_TOLERANCE = 3.5;
// How far a rim may reach past its tyre's bore, in LDU: its flanges, either side of where the
// tyre sits (14 LDU on the 8880 Super Car's rim, as measured from its shape).
const RIM_FLANGE = 16;
// How far a spur gear meshing with a crown gear may be from over its pitch circle, in LDU: the
// crown teeth stand in a band across its face (from 26 to 33 LDU out on the 24 tooth crown gear,
// round its 30 LDU pitch radius), and a spur gear over any of it engages (an official crane's
// boom drive has one 2 LDU out).
const CROWN_BAND = 3.5;
// How far a ball's middle may be from its socket's, in LDU. Some sockets are deeper than the
// shadow library's sphere for them says (a wheel hub's, 2999's, is a bore an official model
// seats its driveshaft's ball 1 LDU further into).
const BALL_TOLERANCE = 2.5;
// How far beyond a string's circle the middle of the part it goes round may be, in LDU (see
// findStrings): LSynth runs a crane's rope round the edge of a cross block 12 LDU from its middle.
const GUIDE_REACH = 15;
// How near the middle of a chain's gap a connection point of what's hooked to its ends must be,
// in LDU (see hookedParts): the 8835 Forklift's carriage's nearest is 20 LDU from it, behind the
// chain tread closing the gap.
const HOOK_REACH = 24;
// How far off where it should be on its body's axis a linear actuator's input or piston may be
// built, and still be taken for it, in LDU (see linearActuators).
const ACTUATOR_REACH = 3;
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
  turns?: boolean; // a motor's output: what's fixed in it turns in the motor (see buildMechanism)
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
  stiff?: boolean; // turns on a friction pin, or in a motor
  motor?: boolean; // turns in a motor: an axle in its output (see buildMechanism)
  held?: boolean; // would turn on a friction pin, but the pin holds it (see inferMechanism)
  // A slide: where the male and female sections lie, as distances along the male's axis
  // (from -> to), and how much they must still overlap. How far it may slide follows from
  // them (see slideRange).
  extents?: { male: [number, number]; female: [number, number]; overlap: number };
  turns?: boolean; // a slide along which the parts may turn too (see slidingOnAxles)
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
  stiff: boolean; // turns on a friction pin or in a motor, so a drag turns it only if nothing else can move
  motor?: boolean; // turns in a motor
  // A slide joint: how far bodyB may slide relative to bodyA from where it starts (along
  // from -> to), and two parts that slide, which meet at either end of that.
  range?: [number, number];
  sliding?: [number, number];
  turns?: boolean; // a slide joint along which bodyB may also turn about the axis, relative to bodyA
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
  // For each of its path's points, the body it moves with: the wheel it's on, or else the part
  // nearest its middle (the peg a rubber band is hooked round). A loop with no links of its own
  // (a rubber band, drawn as shapes) is drawn afresh round where these have taken its points.
  carriers: number[];
  // What's hooked to it (a fork-lift's carriage, hooked to both ends of its chain): each a slide
  // joint (an index into Mechanism.joints) along the run it's hooked on, whose bodyB the loop
  // carries along it at its speed, as fast as the rim of `wheel` (an index into wheels) turns in
  // bodyA (see chainHooks).
  hooks?: { joint: number; wheel: number }[];
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
  // line, axis the way that line runs, length its length, and radius 0; or for a round rack (its
  // teeth rings round a bar, facing every way, as on the 2790 steering rack), the middle of the
  // bar's axis, and the rings' pitch radius about it.
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
  strings: StringLine[]; // strings wound on drums and run over pulleys
  screws: Screw[]; // linear actuators' screws, each driving a piston as its input turns
  rests: Rest[]; // parts resting on others under gravity: push rods on a camshaft, rockers on the rods
}

// A linear actuator's screw: as the input body turns about the axis, the piston body slides
// along it, `lead` for each turn (a right-handed screw: away from the input as it turns
// anticlockwise looking from it). Each turns or slides in the actuator's body (see
// linearActuators). A point on the axis, and its direction from the input towards the piston,
// in model coordinates.
export interface Screw {
  input: number;
  piston: number;
  center: Vector3;
  axis: Vector3;
  lead: number;
}

// A part resting on others under gravity, which Kinebrick keeps touching whichever of them is
// highest under it, as its weight would (see restingParts): the 858 inline engine's push rods,
// standing on its camshaft's pins, and its valves' rockers, lying on the rods.
export interface Rest {
  body: number; // the body that rests
  on: RestContact[]; // the ways it may rest
}

// One way a body may rest: a flat face of it, facing down, on a shape of another body. All in
// model coordinates, as built.
export interface RestContact {
  // The face: its middle, the way it faces (out of the part, down), and how far it reaches from
  // its middle either way along two directions in it.
  face: { point: Vector3; normal: Vector3; across: Vector3; along: Vector3; half: [number, number] };
  body: number; // the body it rests on
  // What it rests on: a cylinder (a camshaft's pin: from `point`, `length` along `axis`), a disc
  // (the top of a push rod's bush: round `point`, facing along `axis`), or a plane (the top of
  // the plate a push rod's bush stops on: through `point`, facing along `axis`).
  shape: { kind: 'cylinder' | 'disc' | 'plane'; point: Vector3; axis: Vector3; length: number; radius: number };
}

// Where a resting face touches what it rests on, each placed by its pose (model -> where it is
// now): the point, the way the face would have to move to reach it, and how far (negative if
// they overlap); or null if the shape isn't under the face.
export function restTouch(contact: RestContact, facePose: Matrix4, shapePose: Matrix4): { point: Vector3; dir: Vector3; clearance: number } | null {
  const { face, shape } = contact;
  const o = face.point.clone().applyMatrix4(facePose);
  const n = face.normal.clone().transformDirection(facePose);
  const across = face.across.clone().transformDirection(facePose);
  const along = face.along.clone().transformDirection(facePose);
  const p = shape.point.clone().applyMatrix4(shapePose);
  const u = shape.axis.clone().transformDirection(shapePose);
  // How far the face reaches from its middle along a direction in it.
  const reach = (d: Vector3) => face.half[0] * Math.abs(d.dot(across)) + face.half[1] * Math.abs(d.dot(along));
  // Whether a point is over the face, or within `margin` of it.
  const within = (q: Vector3, margin = 0) => {
    const off = new Vector3().subVectors(q, o);
    return Math.abs(off.dot(across)) <= face.half[0] + margin + 1e-9 && Math.abs(off.dot(along)) <= face.half[1] + margin + 1e-9;
  };
  if (shape.kind === 'plane') return { point: o, dir: n, clearance: new Vector3().subVectors(p, o).dot(n) };
  if (shape.kind === 'disc') {
    // The disc's rim, where it reaches furthest towards the face. Within a few degrees of facing
    // the face square (SQUARE, as the sine of the angle), it's taken partly in from the rim:
    // there the whole disc nearly touches, and the nearest point of its rim would otherwise jump
    // from one side to the other as the face tips through square, which no loop could follow
    // (a rocker lying level on a push rod).
    const SQUARE = 0.05;
    const out = n.clone().addScaledVector(u, -n.dot(u));
    let q = p.clone().addScaledVector(out, -shape.radius / Math.sqrt(out.lengthSq() + SQUARE * SQUARE));
    // Only the part of the disc under the face counts (a brick's edge coming down on the rim of a
    // stud just beyond it): the point pulled in over the face, then back onto the disc, twice.
    for (let k = 0; k < 2 && !within(q); k++) {
      const off = new Vector3().subVectors(q, o);
      const over = o.clone().addScaledVector(across, Math.min(Math.max(off.dot(across), -face.half[0]), face.half[0])).addScaledVector(along, Math.min(Math.max(off.dot(along), -face.half[1]), face.half[1])).addScaledVector(n, off.dot(n));
      const d = new Vector3().subVectors(over, p);
      d.addScaledVector(u, -d.dot(u));
      if (d.length() > shape.radius) d.setLength(shape.radius);
      q = p.clone().add(d);
    }
    return within(q, 0.5) ? { point: q, dir: n, clearance: new Vector3().subVectors(q, o).dot(n) } : null;
  }
  // A cylinder lying across the face: where along it the face is, if it reaches the face at all.
  const t = new Vector3().subVectors(o, p).dot(u);
  if (t < -reach(u) || t > shape.length + reach(u)) return null;
  const middle = p.clone().addScaledVector(u, Math.min(Math.max(t, 0), shape.length));
  // Across the cylinder, the face is a strip: the cylinder's highest point over it (towards the
  // face), straight under the strip's edge if its axis is beside the strip, which the face rests
  // on however high the axis is. (A pin coming round beside a push rod's foot, above it, lifts
  // the rod as soon as it reaches under the foot, rather than running into its side.)
  const side = new Vector3().crossVectors(n, u).normalize();
  const off = new Vector3().subVectors(middle, o);
  const across0 = off.dot(side);
  const edge = Math.min(Math.max(across0, -reach(side)), reach(side));
  const beside = Math.abs(across0 - edge);
  if (beside >= shape.radius) return null;
  const up = Math.sqrt(shape.radius * shape.radius - beside * beside);
  const top = middle.clone().addScaledVector(side, edge - across0).addScaledVector(n, -up);
  return { point: top, dir: n, clearance: off.dot(n) - up };
}

// A string wound on a drum and run over pulleys (see findStrings).
export interface StringLine {
  path: PlacedPath;
  drum: LoopWheel | null; // the drum at its start, if it's wound on one
  start: { body: number; at: Vector3 } | null; // else where it's tied at its start
  pulleys: LoopWheel[]; // in order along it, guides (joint -1) among them
  end: { body: number; at: Vector3 }; // where it's tied at its end
  hook: { body: number; pulley: number } | null; // the body hanging on it, and its pulley (an index into pulleys; pulleys.length if it hangs from the string's end)
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
  // Only their turning is tied, not where their ends are: a grooved ball in a wheel hub's
  // socket, the shaft and the hub each held in place by their own joints. (A wheel whose
  // steering pivot misses the ball's middle a little, as LDraw's shapes have it, still steers.)
  turningOnly?: boolean;
}

// `paths`: every path in the model (see parseModel), including those drawn with shapes rather
// than parts (a string), which the parts alone don't show.
export function inferMechanism(parts: PlacedPart[], table: ConnectionTable, roleList: Record<string, string>, paths: PlacedPath[] = []): Mechanism {
  parts = parts.map((p) => ({ ...p, name: libraryName(p.name, table) }));
  // Friction pins hold what they join in place, unless they're the only way the model can
  // move (a linkage built on friction pins). So first try them as rigid: if the model can
  // still move, that's it; if not, they stay joints, stiff ones.
  const allPaths = [...new Set([...paths, ...parts.flatMap((p) => (p.path ? [p.path] : []))])];
  const build = (guide: Set<number>) => {
    const rigid = buildMechanism(parts, table, roleList, true, guide, allPaths);
    if (!rigid.connections.some((c) => c.held) || new Kinematics(rigid).freeMotions().length > 0) return rigid;
    return buildMechanism(parts, table, roleList, false, guide, allPaths);
  };
  const mech = build(new Set());
  const guide = racksToGuide(mech);
  return guide.size ? build(guide) : mech;
}

// The OMR embeds parts that weren't in the LDraw library yet in the model's file, named
// "<set> - <part>.dat" (42116 - 42924.dat). Most are in the library now: such a part is read as
// the library's, if Kinebrick knows nothing of its own name.
export function libraryName(name: string, table: ConnectionTable): string {
  const part = / - ([^/]+)$/.exec(name)?.[1];
  return !table.parts[name] && part && table.parts[part] ? part : name;
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
    const motions = kin.freeMotions();
    kin.toggleFreeze(gear.body);
    // Against the gear, in the motions that leave everything its shaft turns in still on it: the
    // 8849 Tractor's front axle, which holds its steering shaft beside the rack, rocks on that
    // shaft, the rack sliding along it as it goes, which doesn't need a guide.
    const apart = (m: number[], a: number, b: number, k: number) => m[6 * a + k] - m[6 * b + k];
    const six = [0, 1, 2, 3, 4, 5];
    const bearings = [...new Set(mountsOf(gear.part, mech.connections).map((p) => mech.bodyOf[p]))];
    const still = nullSpace(bearings.flatMap((b) => six.map((k) => motions.map((m) => apart(m, b, gear.body, k)))), motions.length);
    const moves = still.some((c) => six.some((k) => Math.abs(c.reduce((sum, x, i) => sum + x * apart(motions[i], rack.body, gear.body, k), 0)) > 1e-6));
    if (moves) for (const g of mech.gears) if (g.face && g.body === rack.body) guide.add(g.part);
  }
  return guide;
}

// The mechanism, with friction pins treated as rigid or as stiff joints.
function buildMechanism(parts: PlacedPart[], table: ConnectionTable, roleList: Record<string, string>, frictionRigid: boolean, guide: Set<number>, paths: PlacedPath[]): Mechanism {
  // A path's parts (a chain's links) only show where it runs: they connect to nothing, and
  // move with what's nearest (see decorations), or round their loop (see findLoops).
  const roles = parts.map((p) => (p.path ? 'path' : roleList[p.name] ?? (table.stickers?.includes(p.name) ? 'decoration' : 'structure')));
  const cyls = worldCylinders(parts, table).filter((c) => roles[c.part] !== 'path');
  // A motor's output, its axle hole or (on the old motors) axle stub, turns in the motor: an axle
  // in it turns, rather than being fixed to the motor and whatever the motor is built into.
  for (const c of cyls) if (roles[c.part] === 'motor' && c.secs.some((s) => s.shape === 'A')) c.turns = true;
  const connections = findConnections(cyls, frictionRigid);
  fixPins(connections, roles, frictionRigid);
  connections.push(...platesOnEdge(cyls));
  connections.push(...onFourStuds(cyls));
  connections.push(...onTiles(cyls, connections));
  connections.push(...inGrooves(parts, cyls, table));
  connections.push(...guidedRacks(parts.length, cyls, connections, guide));
  connections.push(...decorations(parts, roles, cyls));
  connections.push(...guidedPistons(parts, roles, cyls, connections));
  connections.push(...shockAbsorbers(cyls));
  const actuators = linearActuators(parts, connections);
  connections.push(...bushGrips(roles, cyls));
  connections.push(...toothedBushes(roles, cyls));
  const joined = [...universalJoints(parts, roles, cyls, connections), ...groovedBalls(parts, roles, cyls, connections)];
  connections.push(...bushesOnFourStuds(roles, cyls, connections));
  connections.push(...onAxleTips(cyls, connections));
  // Loose parts hanging on a string, or hooked to a chain, are held by it; the rest ride along
  // with what's nearest.
  connections.push(...looseFits(roles, cyls, connections, frictionRigid));
  const hanging = hangingParts(parts, connections, findLooseParts(parts.length, connections), paths);
  const hooked = hookedParts(cyls, connections, findLooseParts(parts.length, connections), paths);
  const loose = findLooseParts(parts.length, connections).filter((i) => !hanging.has(i) && !hooked.has(i));
  connections.push(...rideAlong(parts, cyls, connections, loose));
  const bodyOf = groupIntoBodies(parts.length, roles, connections);
  connections.push(...slidingOnAxles(roles, cyls, connections, bodyOf));
  const bodies = nameBodies(bodyOf, roles);
  const rests = restingParts(parts, roles, cyls, connections, bodyOf);
  const joints = withoutSlidesOnCouplers(findJoints(connections, bodyOf));
  lineUpAxles(joints);
  lineUpBalls(joints);
  const treads = findTreads(cyls, bodyOf);
  const gears = findGears(cyls, bodyOf);
  const meshes = findMeshes(gears);
  const at = (part: number) => new Vector3().setFromMatrixPosition(parts[part].matrix);
  dropBallsInBearings(joints, joined, roles, bodyOf);
  // A nudged ball's coupling is at its ball joint's middle, where lineUpBalls has put it.
  const ballAt = (partA: number, partB: number, center: Vector3) => joints.find((j) => j.kind === 'ball' && [j.bodyA, j.bodyB].includes(bodyOf[partA]) && [j.bodyA, j.bodyB].includes(bodyOf[partB]) && j.from.distanceTo(center) < BALL_LINE)?.from.clone() ?? center;
  const couplings: Coupling[] = joined.map(({ partA, partB, center, axisA, axisB }) => ({ bodyA: bodyOf[partA], bodyB: bodyOf[partB], center: roles[partA] === 'nudged ball' ? ballAt(partA, partB, center) : center, axisA, axisB, atA: at(partA), atB: at(partB), turningOnly: roles[partA] === 'grooved ball' || roles[partA] === 'nudged ball' }));
  couplings.push(...crankWebs(joints));
  const loops = findLoops(parts, roles, bodyOf, joints, table, paths);
  // What's hooked to a chain it can't slide along is loose after all (it rides along with nothing).
  loose.push(...chainHooks(parts, bodyOf, joints, loops, hooked));
  loose.sort((a, b) => a - b);
  treads.push(...trackTreads(loops));
  const strings = findStrings(parts, roles, bodyOf, joints, paths, hanging, loose);
  // An actuator whose input or piston is fixed to its body (by what's built round it) can't work.
  const screws = actuators.filter((a) => new Set([a.body, a.input, a.piston].map((i) => bodyOf[i])).size === 3).map((a) => ({ input: bodyOf[a.input], piston: bodyOf[a.piston], center: a.center, axis: a.axis, lead: a.lead }));
  return { roles, bodyOf, bodies, joints, connections, treads, gears, meshes, loose, couplings, loops, strings, screws, rests };
}

// A nudged ball (see groovedBalls) keeps its ball joint only where it's needed: where its shaft,
// or the part it sits in, has nothing else to hold it (a half shaft, a universal joint at its
// other end). Where both turn in bearings of their own, on axes through the ball (a drive shaft
// joined at an angle to another, as an official bucket wheel excavator's are), the joint would
// tie them a second way, which shafts built a hair out of line can't keep: they locked.
function dropBallsInBearings(joints: Joint[], joined: { partA: number; partB: number; center: Vector3 }[], roles: string[], bodyOf: number[]) {
  const turnsThrough = (body: number, center: Vector3) =>
    joints.some((j) => {
      if (j.kind !== 'revolute' || (j.bodyA !== body && j.bodyB !== body)) return false;
      const dir = new Vector3().subVectors(j.to, j.from).normalize();
      const rel = new Vector3().subVectors(center, j.from);
      return rel.addScaledVector(dir, -rel.dot(dir)).length() < BALL_LINE;
    });
  for (const { partA, partB, center } of joined) {
    if (roles[partA] !== 'nudged ball') continue;
    const [a, b] = [bodyOf[partA], bodyOf[partB]];
    if (!turnsThrough(a, center) || !turnsThrough(b, center)) continue;
    const k = joints.findIndex((j) => j.kind === 'ball' && [j.bodyA, j.bodyB].includes(a) && [j.bodyA, j.bodyB].includes(b) && j.from.distanceTo(center) < BALL_LINE);
    if (k >= 0) joints.splice(k, 1);
  }
}

// A bush seated in a Technic plate's hole grips the plate: the plate's hole is counterbored
// 4 LDU deep for a bush's flange (a brick's only 2), and the bush reaches at least
// BUSH_SEAT into it. Clamped so, the plate turns with the bush's axle, as an old helicopter's
// rotors are driven (Technic plates on the shaft, a bush pushed into each).
function bushGrips(roles: string[], cyls: WorldCylinder[]): Connection[] {
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
function toothedBushes(roles: string[], cyls: WorldCylinder[]): Connection[] {
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

// A shock absorber: its rod slides in its cylinder against a spring. Until Kinebrick models
// springs (v2.0), the spring holds it at the length it was built at, so a car sits on its
// suspension: the rod (square, open at both ends) is fixed in the cylinder (square, closed at
// one end) it's in.
function shockAbsorbers(cyls: WorldCylinder[]): Connection[] {
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

// Linear actuators, by their body's part: the parts its input and piston may be, where the input
// sits along the body's axis (its z, from the input end), how far along it the piston's head may
// be (contracted and extended, as the LDraw library's -f1 and -f2 shortcuts place it), and how
// far the piston goes for each turn of the input, from builders' measurements of the turns from
// one end of the stroke to the other: 19.9 for the small one's 60 LDU, 26.8 for the large one's
// 100, and 43.75 for the extra large one's 160 (the later large one, which shares its base, taken
// to be geared alike).
const ACTUATORS: Record<string, { inputs: string[]; input: number; pistons: string[]; stroke: [number, number]; lead: number }> = {
  '92693c01.dat': { inputs: ['92695.dat'], input: 30, pistons: ['92696.dat'], stroke: [120, 180], lead: 60 / 19.9 },
  '62271c01.dat': { inputs: ['47157.dat', '62273.dat'], input: 0, pistons: ['62274c01.dat'], stroke: [170, 270], lead: 100 / 26.8 },
  'u9487c01.dat': { inputs: ['47157.dat'], input: 0, pistons: ['62274c02.dat'], stroke: [250, 410], lead: 160 / 43.75 },
  'u9559c01.dat': { inputs: ['47157.dat'], input: 0, pistons: ['62274c01.dat'], stroke: [170, 270], lead: 160 / 43.75 },
};

// A linear actuator's three parts: its body, the input that turns in its back end, and the piston
// that a screw inside drives in and out of its front end as the input turns. The input turns in
// the body and the piston slides in it, as far as its stroke, in place of whatever their shapes
// connect them by (the piston's rod sits in the body's bore like a stud in a hole). Returns each
// actuator, its parts and screw, for buildMechanism to make a Screw of.
function linearActuators(parts: PlacedPart[], connections: Connection[]): { body: number; input: number; piston: number; center: Vector3; axis: Vector3; lead: number }[] {
  const found: { body: number; input: number; piston: number; center: Vector3; axis: Vector3; lead: number }[] = [];
  parts.forEach((p, body) => {
    const kind = ACTUATORS[p.name];
    if (!kind) return;
    const toBody = p.matrix.clone().invert();
    // The part of one of these names nearest to the axis, between lo and hi along it.
    const onAxis = (names: string[], lo: number, hi: number) => {
      let best = -1;
      let bestOff = ACTUATOR_REACH;
      parts.forEach((q, i) => {
        if (!names.includes(q.name)) return;
        const at = new Vector3().setFromMatrixPosition(q.matrix).applyMatrix4(toBody);
        const off = Math.hypot(at.x, at.y) + Math.max(0, lo - at.z, at.z - hi);
        if (off < bestOff) [best, bestOff] = [i, off];
      });
      return best;
    };
    const input = onAxis(kind.inputs, kind.input, kind.input);
    const piston = onAxis(kind.pistons, kind.stroke[0], kind.stroke[1]);
    if (input < 0 || piston < 0) return;
    const center = new Vector3().setFromMatrixPosition(p.matrix);
    const axis = new Vector3(0, 0, 1).transformDirection(p.matrix);
    const trio = new Set([body, input, piston]);
    for (let k = connections.length - 1; k >= 0; k--) if (trio.has(connections[k].male) && trio.has(connections[k].female)) connections.splice(k, 1);
    const along = (z: number) => center.clone().addScaledVector(axis, z);
    connections.push({ male: input, female: body, kind: 'revolute', from: along(kind.input), to: along(kind.input + 20) });
    // Where the piston's head is now, and so how far it may go each way (a hair more, if it's
    // built a little past either end).
    const head = new Vector3().setFromMatrixPosition(parts[piston].matrix).sub(center).dot(axis);
    const female: [number, number] = [Math.min(0, kind.stroke[0] - head), Math.max(0, kind.stroke[1] - head)];
    connections.push({ male: piston, female: body, kind: 'slide', from: along(head), to: along(head + 20), extents: { male: [0, 0], female, overlap: 0 } });
    found.push({ body, input, piston, center: along(kind.input), axis, lead: kind.lead });
  });
  return found;
}

// A piston with no cylinder of its own to slide in, such as the old 2x2 piston block, whose
// cylinder is a square of bricks around it, slides along its own axis (its y) against the
// part nearest to it that it isn't connected to. Not an axle, an axle pin or an axle hole: the
// walls are bricks and plates, and an axle pin beside the piston may turn (the 8865's, holding
// the top of a cylinder bank).
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
      if (touching.has(group[c.part]) || c.secs.some((s) => s.shape === 'A')) continue;
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
// to the other, so that's what Kinebrick models: the cross is fixed to the first end, its
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

// Parts that would be loose get a second chance, fitting with the looser LOOSE_ALIGN_TOLERANCE:
// connections that join a loose part to anything, found as findConnections finds them. A pin's
// new joints turn as fixPins has its others do: a friction pin's stiffly.
function looseFits(roles: string[], cyls: WorldCylinder[], connections: Connection[], frictionRigid: boolean): Connection[] {
  const count = Math.max(0, ...cyls.map((c) => c.part)) + 1;
  const loose = new Set(findLooseParts(count, connections));
  if (loose.size === 0) return [];
  const known = new Set(connections.map((c) => `${c.male},${c.female}`));
  const found = findConnections(cyls, frictionRigid, LOOSE_ALIGN_TOLERANCE).filter((c) => (loose.has(c.male) || loose.has(c.female)) && !known.has(`${c.male},${c.female}`));
  for (const c of found) {
    if (c.kind !== 'revolute' || roles[c.male] !== 'friction pin') continue;
    if (frictionRigid) [c.kind, c.held] = ['rigid', true];
    else c.stiff = true;
  }
  return found;
}

// A grooved ball (2907) on the end of a driveshaft, in a wheel hub's socket (2999's): ridges
// in the socket fit its grooves, so the hub turns with the shaft, at any angle the ball sits
// at (a constant velocity joint: steered wheels are driven through it). Like a universal
// joint, the ball's connection is replaced with a coupling at the ball's middle, between the
// shaft (the ball's axle hole's axis) and the hub (the axis of its holes through the socket: a
// socket, a sphere, has none of its own), tying only their turning (see Coupling): shaft and
// hub each turn in holes of their own.
//
// A nudged ball (32494) does the same in a portal axle's steering hub (92909), nudges on it
// fitting slots in the socket; but its shaft often hangs on nothing else (a half shaft, a
// universal joint at its other end), so its ball joint is kept as well, where it's needed
// (see dropBallsInBearings).
function groovedBalls(parts: PlacedPart[], roles: string[], cyls: WorldCylinder[], connections: Connection[]) {
  const joined: { partA: number; partB: number; center: Vector3; axisA: Vector3; axisB: Vector3 }[] = [];
  const axisOf = (part: number, shape: string) => cyls.find((c) => c.part === part && c.secs.some((s) => s.shape === shape))?.dir.clone() ?? new Vector3(0, 0, 1);
  // The hole whose axis passes nearest the ball's middle, within BALL_LINE (a model may set
  // the ball a little off it, as lineUpBalls allows).
  const through = (part: number, center: Vector3) => {
    let best: { dir: Vector3; off: number } | null = null;
    for (const c of cyls) {
      if (c.part !== part || c.secs.some((s) => s.shape === 'O')) continue;
      const rel = new Vector3().subVectors(center, c.start);
      const off = rel.addScaledVector(c.dir, -rel.dot(c.dir)).length();
      if (off < BALL_LINE && (!best || off < best.off)) best = { dir: c.dir, off };
    }
    return best ? best.dir.clone() : axisOf(part, 'O');
  };
  for (const c of connections) {
    if (c.kind !== 'ball' || (roles[c.male] !== 'grooved ball' && roles[c.male] !== 'nudged ball')) continue;
    if (roles[c.male] === 'grooved ball') c.kind = 'coupling';
    joined.push({ partA: c.male, partB: c.female, center: c.from.clone(), axisA: axisOf(c.male, 'A'), axisB: through(c.female, c.from) });
  }
  return joined;
}

// A part with a single round opening underneath (a 1x1 round brick's or plate's anti-stud,
// or the open end of an axle hole, as on a Technic connector) sitting centred between four
// studs grips them: its round end fits between them, a classic way to set a part half a stud
// off the grid (an official crane's outrigger legs stand so on their pads, and an official
// bulldozer's bucket is wedged so on the connectors that hold it). At any angle: the four
// studs point the way the opening does, at its level, each half a stud's diagonal (14.1 LDU)
// off its axis.
function onFourStuds(cyls: WorldCylinder[]): Connection[] {
  const openings = cyls.filter((c) => c.gender === 'F' && c.caps === 'one' && c.secs.length === 1 && ['R', 'S', 'A'].includes(c.secs[0].shape) && Math.abs(c.secs[0].radius - 6) < AXIS_TOLERANCE);
  const perPart = new Map<number, number>();
  for (const a of openings) perPart.set(a.part, (perPart.get(a.part) ?? 0) + 1);
  const studs = cyls.filter((c) => c.gender === 'M' && isStud(c));
  const held: Connection[] = [];
  for (const a of openings) {
    if (perPart.get(a.part) !== 1) continue;
    for (const part of fourStudsAround(studs, a.start, a.dir, a.part)) held.push({ male: part, female: a.part, kind: 'stud', from: a.start.clone(), to: a.start.clone() });
  }
  return held;
}

// A Technic bush standing on end between four studs grips them too, as a 2 x 2 brick's tube does
// (the 858 Auto Engines' round caps stand so, each on an axle with a bush under it). Only a bush
// that would otherwise be loose: a bush on an axle that turns in a Technic plate's hole may sit
// between the plate's studs as well, and mustn't hold the axle still.
function bushesOnFourStuds(roles: string[], cyls: WorldCylinder[], connections: Connection[]): Connection[] {
  const count = Math.max(0, ...cyls.map((c) => c.part)) + 1;
  const loose = new Set(findLooseParts(count, connections));
  if (loose.size === 0) return [];
  const studs = cyls.filter((c) => c.gender === 'M' && isStud(c));
  const held: Connection[] = [];
  for (const bush of cyls.filter((c) => loose.has(c.part) && roles[c.part] === 'bush' && c.gender === 'F' && c.secs.some((s) => s.shape === 'A'))) {
    const length = bush.secs.reduce((sum, sec) => sum + sec.length, 0);
    // Either end, with the way into the bush from it.
    const ends: [Vector3, Vector3][] = [
      [bush.start, bush.dir],
      [bush.start.clone().addScaledVector(bush.dir, length), bush.dir.clone().negate()],
    ];
    for (const [end, inwards] of ends) {
      for (const part of fourStudsAround(studs, end, inwards, bush.part)) held.push({ male: part, female: bush.part, kind: 'stud', from: end.clone(), to: end.clone() });
    }
  }
  return held;
}

// A part that would be loose, its axle hole lined up with an axle's tip and starting right there,
// is pushed on that axle: real parts give a little, so a builder may press a part on an axle
// already filled by others, where in LDraw it can only sit against its tip (the 858 Auto Engines'
// fans, two round plates pressed on an axle pin past the bush their rubber band runs in).
function onAxleTips(cyls: WorldCylinder[], connections: Connection[]): Connection[] {
  const count = Math.max(0, ...cyls.map((c) => c.part)) + 1;
  const loose = new Set(findLooseParts(count, connections));
  if (loose.size === 0) return [];
  const pushed: Connection[] = [];
  for (const axle of cyls.filter((c) => c.gender === 'M' && c.secs[c.secs.length - 1].shape === 'A')) {
    const tip = axle.start.clone().addScaledVector(axle.dir, axle.secs.reduce((sum, sec) => sum + sec.length, 0));
    for (const hole of cyls) {
      if (hole.gender !== 'F' || hole.part === axle.part || !loose.has(hole.part) || loose.has(axle.part)) continue;
      if (new Vector3().crossVectors(axle.dir, hole.dir).length() > ANGLE_TOLERANCE) continue;
      // Where each of the hole's sections starts and ends, along the axle from its tip.
      let at = new Vector3().subVectors(hole.start, tip).dot(axle.dir);
      const sideways = new Vector3().subVectors(hole.start, tip).addScaledVector(axle.dir, -at).length();
      if (sideways > LOOSE_ALIGN_TOLERANCE) continue;
      const way = Math.sign(hole.dir.dot(axle.dir));
      for (const sec of hole.secs) {
        const end = at + way * sec.length;
        if (sec.shape === 'A' && Math.abs(Math.min(at, end)) < AXIS_TOLERANCE) pushed.push({ male: axle.part, female: hole.part, kind: 'rigid', from: tip.clone(), to: tip.clone() });
        at = end;
      }
    }
  }
  return pushed;
}

// The parts (other than `part`) with four studs round `at`: each pointing `dir`, its base at the
// level of `at`, half a stud's diagonal (14.1 LDU) off the line through it.
function fourStudsAround(studs: WorldCylinder[], at: Vector3, dir: Vector3, part: number): number[] {
  const around = studs.filter((st) => {
    if (st.part === part || st.dir.dot(dir) < 0.99) return false;
    const d = new Vector3().subVectors(st.start, at);
    const level = d.dot(dir);
    return Math.abs(level) < AXIS_TOLERANCE && Math.abs(d.addScaledVector(dir, -level).length() - 10 * Math.SQRT2) < ALIGN_TOLERANCE;
  });
  return [...new Set(around.map((st) => st.part))].filter((p) => around.filter((st) => st.part === p).length >= 4);
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
  const isDecoration = (i: number) => roles[i] === 'decoration' || roles[i] === 'path';
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
// rubber band is hooked round) is left out: the band slides round it. A chain placed link by
// link (see PlacedPath's byHand) is only roughly round its wheels: each of its circles is on the
// wheel whose axis is within CHAIN_REACH of its middle, and is moved onto that axis.
function findLoops(parts: PlacedPart[], roles: string[], bodyOf: number[], joints: Joint[], table: ConnectionTable, paths: PlacedPath[]): Loop[] {
  return paths
    .filter((path) => path.looped)
    .map((path) => {
      const wheels = path.points.flatMap((point, index) => findWheel(point, index, parts, roles, bodyOf, joints, path.byHand ? CHAIN_REACH : AXIS_TOLERANCE) ?? []);
      if (path.byHand) {
        for (const w of wheels) {
          const { from, to } = joints[w.joint];
          const d = new Vector3().subVectors(to, from).normalize();
          const point = path.points[w.point];
          point.center = from.clone().addScaledVector(d, new Vector3().subVectors(point.center, from).dot(d));
        }
      }
      const links = parts.flatMap((p, i) => (p.path === path ? [i] : []));
      const carriers = path.points.map((point, index) => wheels.find((w) => w.point === index)?.body ?? bodyOf[nearestPart(point.center, parts, roles)]);
      return { path, wheels, links, depth: table.tracks?.[libraryName(path.skin, table)]?.depth ?? null, carriers };
    });
}

// The part nearest a point (not a path's link), by where the part is placed, or -1 if none.
function nearestPart(point: Vector3, parts: PlacedPart[], roles: string[]): number {
  let best = -1;
  let bestDistance = Infinity;
  parts.forEach((part, i) => {
    if (roles[i] === 'path') return;
    const distance = new Vector3().setFromMatrixPosition(part.matrix).distanceTo(point);
    if (distance < bestDistance) [best, bestDistance] = [i, distance];
  });
  return best;
}

// The wheel a path's circle is on, if any (see findLoops): the body turning on a joint whose
// axis runs along the circle's, through its middle, with a part on that axis (within the
// circle's radius of it) nearest the middle along it. (A drum is often just an axle, its
// middle well along from where the string is wound.)
function findWheel(point: PathPoint, index: number, parts: PlacedPart[], roles: string[], bodyOf: number[], joints: Joint[], reach = AXIS_TOLERANCE): LoopWheel | null {
  if (!point.circle) return null;
  let best: LoopWheel | null = null;
  let bestDistance = Infinity;
  joints.forEach((joint, j) => {
    if (joint.kind !== 'revolute') return;
    const d = new Vector3().subVectors(joint.to, joint.from).normalize();
    if (Math.abs(Math.abs(d.dot(point.axis)) - 1) > 0.01) return;
    const off = new Vector3().subVectors(point.center, joint.from);
    if (off.addScaledVector(d, -off.dot(d)).length() > reach) return;
    parts.forEach((part, i) => {
      if (roles[i] === 'path' || (bodyOf[i] !== joint.bodyA && bodyOf[i] !== joint.bodyB)) return;
      const offset = new Vector3().setFromMatrixPosition(part.matrix).sub(point.center);
      const distance = Math.abs(offset.dot(point.axis));
      if (offset.addScaledVector(point.axis, -offset.dot(point.axis)).length() > point.radius || distance >= bestDistance) return;
      bestDistance = distance;
      const mount = bodyOf[i] === joint.bodyA ? joint.bodyB : joint.bodyA;
      best = { body: bodyOf[i], joint: j, mount, point: index };
    });
  });
  if (!best) return null;
  // Of the joints it turns on along the circle's axis, the one in what's nearest the frame:
  // a gearbox's output shaft turns in the frame, and in the clutch gears freewheeling on it,
  // and it's how it turns in the frame that drives the chain.
  const wheel: LoopWheel = best;
  const steps = stepsFromFrame(joints);
  joints.forEach((joint, j) => {
    if (joint.kind !== 'revolute' || (joint.bodyA !== wheel.body && joint.bodyB !== wheel.body)) return;
    const d = new Vector3().subVectors(joint.to, joint.from).normalize();
    if (Math.abs(Math.abs(d.dot(point.axis)) - 1) > 0.01) return;
    const off = new Vector3().subVectors(point.center, joint.from);
    if (off.addScaledVector(d, -off.dot(d)).length() > reach) return;
    const mount = joint.bodyA === wheel.body ? joint.bodyB : joint.bodyA;
    if (steps[mount] < steps[wheel.mount]) [wheel.joint, wheel.mount] = [j, mount];
  });
  return wheel;
}

// How many joints away from the frame (body 0) each body is.
function stepsFromFrame(joints: Joint[]): number[] {
  const steps: number[] = [0];
  const queue = [0];
  while (queue.length) {
    const body = queue.shift()!;
    for (const j of joints) {
      const other = j.bodyA === body ? j.bodyB : j.bodyB === body ? j.bodyA : -1;
      if (other >= 0 && steps[other] === undefined) {
        steps[other] = steps[body] + 1;
        queue.push(other);
      }
    }
  }
  return steps.map((s) => s ?? Infinity);
}

// A string (a path that isn't looped, as LDCad draws a crane's rope): wound on a drum at its
// start, if its first point is a circle on a wheel; over the pulleys after that (its other
// circles on wheels, in order; any other point it passes is left out); and tied at its last
// point to the part nearest there. Its circles on no wheel are guides it slides over, if
// something is there to go round. A pulley whose parts are attached to nothing else (a
// crane's hook block) hangs on the string: its `hook`. So do parts attached to nothing else
// tied to its end (a hook on a single rope, as LSynth draws a crane's), if no pulley hangs on
// it. A string that goes round no wheel at all moves nothing, and is left out.
function findStrings(parts: PlacedPart[], roles: string[], bodyOf: number[], joints: Joint[], paths: PlacedPath[], hanging: Set<number>, loose: number[]): StringLine[] {
  const at = parts.map((p) => new Vector3().setFromMatrixPosition(p.matrix));
  return paths
    .filter((path) => !path.looped && path.points.some((p) => p.circle))
    .flatMap((path) => {
      const drum = findWheel(path.points[0], 0, parts, roles, bodyOf, joints);
      const nearest = (p: Vector3, hung = false) =>
        parts.reduce((best, _, i) => (roles[i] !== 'path' && (hung || !hanging.has(i)) && (best < 0 || at[i].distanceTo(p) < at[best].distanceTo(p)) ? i : best), -1);
      // A circle on no wheel, round something attached near its middle (not the drum: LSynth
      // bends a rope a little as it leaves its drum), is a guide the string slides over (a cross
      // block a crane's rope runs over at its boom tip): its joint is -1.
      const guide = (point: PathPoint, index: number): LoopWheel | null => {
        if (!point.circle) return null;
        const i = nearest(point.center);
        if (i < 0 || at[i].distanceTo(point.center) >= point.radius + GUIDE_REACH || bodyOf[i] === drum?.body) return null;
        return { body: bodyOf[i], joint: -1, mount: bodyOf[i], point: index };
      };
      const pulleys = path.points.slice(1, -1).flatMap((point, k) => findWheel(point, k + 1, parts, roles, bodyOf, joints) ?? guide(point, k + 1) ?? []);
      if (!drum && !pulleys.some((w) => w.joint >= 0)) return [];
      const last = path.points[path.points.length - 1].center;
      const start = drum ? null : { body: bodyOf[nearest(path.points[0].center)], at: path.points[0].center.clone() };
      const hung = pulleys.findIndex((w) => parts.some((_, i) => hanging.has(i) && (bodyOf[i] === w.body || bodyOf[i] === w.mount)));
      const tied = nearest(last, hung < 0);
      // Tied to something attached to nothing that doesn't hang on it (a tow truck's hook, run out
      // level), it's left out: what it's tied to rides along with what's near it, and would hold
      // the drum still.
      if (loose.includes(tied) && !hanging.has(tied)) return [];
      const end = { body: bodyOf[tied], at: last.clone() };
      const hook = hung >= 0 ? { body: pulleys[hung].mount, pulley: hung } : hanging.has(tied) ? { body: end.body, pulley: pulleys.length } : null;
      return [{ path, drum, start, pulleys, end, hook }];
    });
}

// The loose parts that hang on a string: each group of loose parts attached to each other, one
// of whose parts is inside a circle the string goes round (a crane's hook block, with its
// pulley), or is the part nearest where it ends, if it hangs down there (a hook tied to it).
function hangingParts(parts: PlacedPart[], connections: Connection[], loose: number[], paths: PlacedPath[]): Set<number> {
  const strings = paths.filter((p) => !p.looped && p.points.some((q) => q.circle));
  // Not the circles of a knot at its end (LSynth ties a rope to its hook so).
  const circles = strings.flatMap((p) => p.points.slice(1, -1).filter((q) => q.circle && q.center.distanceTo(p.points[p.points.length - 1].center) >= 20));
  const at = parts.map((p) => new Vector3().setFromMatrixPosition(p.matrix));
  // The part nearest each string's end, if the string hangs down to it (within 30 degrees of
  // straight down, from 20 LDU before its end): a hook tied to a crane's rope. A tow truck's
  // cable, run out level to its hook, holds up nothing.
  const ends = strings.map((p) => {
    const last = p.points[p.points.length - 1].center;
    const before = [...p.points].reverse().find((q) => q.center.distanceTo(last) >= 20);
    if (!before || last.clone().sub(before.center).normalize().y < Math.cos(Math.PI / 6)) return -1;
    return parts.reduce((best, part, i) => (!part.path && (best < 0 || at[i].distanceTo(last) < at[best].distanceTo(last)) ? i : best), -1);
  });
  const isLoose = new Set(loose);
  const leader = new Map(loose.map((i) => [i, i]));
  const find = (i: number): number => {
    while (leader.get(i) !== i) i = leader.get(i)!;
    return i;
  };
  for (const c of connections) if (isLoose.has(c.male) && isLoose.has(c.female)) leader.set(find(c.male), find(c.female));
  const groups = new Set(loose.filter((i) => ends.includes(i) || circles.some((q) => at[i].distanceTo(q.center) < q.radius)).map(find));
  return new Set(loose.filter((i) => groups.has(find(i))));
}

// The loose parts hooked to a chain's ends, and the chain each is hooked to: for each chain placed
// by hand that doesn't close up, the biggest group of loose parts attached to each other with a
// connection point within HOOK_REACH of the middle of the gap between its ends (a fork-lift's
// carriage, hooked to both ends of a chain a link short, which closes it). The chain carries it
// (see chainHooks). Smaller groups there ride along with what's nearest, as loose parts do: the
// 8835 Forklift's chain tread, the chain's missing link, which in the real model is held between
// four bushes in the carriage.
function hookedParts(cyls: WorldCylinder[], connections: Connection[], loose: number[], paths: PlacedPath[]): Map<number, PlacedPath> {
  const isLoose = new Set(loose);
  const leader = new Map(loose.map((i) => [i, i]));
  const find = (i: number): number => {
    while (leader.get(i) !== i) i = leader.get(i)!;
    return i;
  };
  for (const c of connections) if (isLoose.has(c.male) && isLoose.has(c.female)) leader.set(find(c.male), find(c.female));
  const size = new Map<number, number>();
  for (const i of loose) size.set(find(i), (size.get(find(i)) ?? 0) + 1);
  const hooked = new Map<number, PlacedPath>();
  for (const path of paths) {
    if (!path.looped || !path.ends) continue;
    const middle = path.ends[0].clone().add(path.ends[1]).multiplyScalar(0.5);
    const near = new Set(cyls.filter((c) => isLoose.has(c.part) && !hooked.has(c.part) && c.start.distanceTo(middle) < HOOK_REACH).map((c) => find(c.part)));
    const group = [...near].reduce((best, g) => (best < 0 || size.get(g)! > size.get(best)! ? g : best), -1);
    for (const i of loose) if (group >= 0 && find(i) === group) hooked.set(i, path);
  }
  return hooked;
}

// What's hooked to a chain's ends (see hookedParts) slides along the straight run the chain's gap
// is on, as far as it goes, on what the wheel at one end of that run turns in: of the two, the
// one furthest from the frame (a fork-lift's mast, which tilts on the frame about its bottom
// sprocket's axle). Of the bodies hooked, the one with the most parts slides (a carriage, not the
// axle pins turning in it); the chain carries it along at the speed that wheel's rim turns in
// what it slides on (see Loop's hooks). Returns the hooked parts it couldn't slide: on a chain
// with no wheel at either end of the run its gap is on, or with its gap round a wheel.
function chainHooks(parts: PlacedPart[], bodyOf: number[], joints: Joint[], loops: Loop[], hooked: Map<number, PlacedPath>): number[] {
  const steps = stepsFromFrame(joints);
  const at = (i: number) => new Vector3().setFromMatrixPosition(parts[i].matrix);
  const slid = new Set<PlacedPath>();
  for (const loop of loops) {
    const ends = loop.path.ends;
    const mine = [...hooked.keys()].filter((i) => hooked.get(i) === loop.path);
    if (!ends || !mine.length) continue;
    const count = (b: number) => mine.filter((i) => bodyOf[i] === b).length;
    const body = mine.map((i) => bodyOf[i]).reduce((best, b) => (count(b) > count(best) ? b : best));
    let path: LoopPath;
    try {
      path = new LoopPath(loop.path.points);
    } catch {
      continue;
    }
    const middle = ends[0].clone().add(ends[1]).multiplyScalar(0.5);
    const s = path.nearest(middle);
    const run = path.runAt(s);
    if (!run) continue;
    const wheel = loop.wheels.reduce((best, w, k) => ((w.point === run.from || w.point === run.to) && (best < 0 || steps[w.mount] > steps[loop.wheels[best].mount]) ? k : best), -1);
    if (wheel < 0) continue;
    const frame = path.frameAt(s);
    const from = new Vector3().setFromMatrixPosition(frame);
    const along = new Vector3().setFromMatrixColumn(frame, 0);
    const w = loop.wheels[wheel];
    // Run to either end, it meets a wheel: its part nearest the gap, and the part of that wheel
    // nearest its circle's middle.
    const center = loop.path.points[w.point].center;
    const nearest = (list: number[], p: Vector3) => list.reduce((best, i) => (at(i).distanceTo(p) < at(best).distanceTo(p) ? i : best));
    const sliding: [number, number] = [nearest(mine.filter((i) => bodyOf[i] === body), middle), nearest(parts.flatMap((_, i) => (bodyOf[i] === w.body ? [i] : [])), center)];
    joints.push({ kind: 'slide', bodyA: w.mount, bodyB: body, from, to: from.clone().add(along), stiff: false, range: [-run.back, run.on], sliding });
    loop.hooks = [...(loop.hooks ?? []), { joint: joints.length - 1, wheel }];
    slid.add(loop.path);
  }
  return [...hooked.keys()].filter((i) => !slid.has(hooked.get(i)!));
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
      const [mount] = mountsOf(gear.part, connections);
      if (mount === undefined) continue;
      const from = rack.center.clone();
      guided.push({ male: rack.part, female: mount, kind: 'slide', from, to: from.clone().add(rack.axis) });
      break;
    }
  }
  return guided;
}

// The parts a gear's axle turns in: from the gear, through what's rigidly fixed to it, to the
// other side of each turning connection.
function mountsOf(gear: number, connections: Connection[]): number[] {
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
  return connections.flatMap((c) => (c.kind !== 'revolute' || fixed.has(c.male) === fixed.has(c.female) ? [] : [fixed.has(c.male) ? c.female : c.male]));
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

// Whether gears now mesh that didn't, or no longer do, with each body moved by its pose (the
// 952 Tractor's harrow lowered onto its power take-off): if so, the mechanism wants working out
// afresh from where everything now is.
export function meshesChanged(mech: Mechanism, poses: Matrix4[]): boolean {
  const moved = mech.gears.map((g) => {
    const pose = poses[g.body];
    return { ...g, center: g.center.clone().applyMatrix4(pose), axis: g.axis.clone().transformDirection(pose), face: g.face ? g.face.clone().transformDirection(pose) : null };
  });
  const key = (m: Mesh) => `${m.gearA} ${m.gearB} ${m.kind}`;
  const now = new Set(findMeshes(moved).map(key));
  const before = new Set(mech.meshes.map(key));
  return now.size !== before.size || [...now].some((k) => !before.has(k));
}

// Moves each point of each path (a string, chain or rubber band) with the part nearest it (not
// one of the path's own links), each part moved by its body's pose: so a mechanism worked out
// afresh from where everything now is (see meshesChanged) finds them where the parts they run
// round now are, not where the model file drew them (the 855 Mobile Crane's string, its boom
// extended). In place, so the shapes LDCad drew each path with still match it.
export function movePaths(paths: PlacedPath[], parts: PlacedPart[], bodyOf: number[], poses: Matrix4[]) {
  const at = parts.map((p) => new Vector3().setFromMatrixPosition(p.matrix));
  const moved = paths.map((path) =>
    path.points.map((point) => {
      const near = parts.reduce((best, part, i) => (!part.path && (best < 0 || at[i].distanceTo(point.center) < at[best].distanceTo(point.center)) ? i : best), -1);
      const pose = near < 0 ? new Matrix4() : poses[bodyOf[near]];
      return { center: point.center.clone().applyMatrix4(pose), axis: point.axis.clone().transformDirection(pose) };
    }),
  );
  paths.forEach((path, i) => path.points.forEach((point, k) => Object.assign(point, moved[i][k])));
}

// Which gears mesh, by where each is (gears on one body never do).
export function findMeshes(gears: Gear[]): Mesh[] {
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

// A spur gear meshes with a rack of the same tooth size when its axis lies across the rack (at
// right angles to the way the rack runs, and to the way its teeth face or tipped from that by
// up to RACK_TILT, as a go-kart's slanted steering column meets its rack; a round rack's teeth
// face every way), its pitch circle touches the rack's pitch line, on the side its teeth face,
// within the rack's length (unless `within` is false), and their teeth overlap across their
// widths.
function rackMesh(gear: Gear, rack: Gear, within = true): boolean {
  if (!gear.spur || gear.worm || gear.face) return false;
  const face = rack.face!;
  // Tooth size: the distance between teeth along the pitch line.
  if (Math.abs((2 * Math.PI * gear.radius) / gear.teeth - rack.length / rack.teeth) > 0.25) return false;
  if (Math.abs(gear.axis.dot(rack.axis)) > 0.01) return false;
  const offset = new Vector3().subVectors(gear.center, rack.center);
  if (within && Math.abs(offset.dot(rack.axis)) > rack.length / 2) return false;
  // From the pitch line (a round rack's axis) to the gear's axis, in the gear's own plane.
  const apart = offset.clone().addScaledVector(rack.axis, -offset.dot(rack.axis)).addScaledVector(gear.axis, -offset.dot(gear.axis));
  if (!rack.radius && apart.dot(face) < Math.cos(RACK_TILT) * apart.length()) return false;
  if (Math.abs(apart.length() - rack.radius - gear.radius) > RACK_TOLERANCE) return false;
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

// A crown gear meshes with a spur gear (or a bevel gear, as the old differential's crown wheel's
// pinion is) of the same tooth size whose axle crosses its own at right angles, the spur gear's middle over its band of teeth (a pitch radius out from the
// crown gear's axis, within CROWN_BAND), and its pitch circle touching the crown gear's pitch
// plane on the side its teeth face.
function crownMesh(crown: Gear, gear: Gear): boolean {
  if (!crown.crown || !(gear.spur || gear.bevel) || gear.crown || gear.worm || gear.face) return false;
  if (Math.abs(crown.radius / crown.teeth - gear.radius / gear.teeth) > 0.01) return false;
  if (Math.abs(crown.axis.dot(gear.axis)) > 0.01) return false;
  const offset = new Vector3().subVectors(gear.center, crown.center);
  const along = offset.dot(crown.axis);
  const out = offset.clone().addScaledVector(crown.axis, -along);
  if (Math.abs(out.length() - crown.radius) > CROWN_BAND) return false;
  if (Math.abs(out.normalize().dot(gear.axis)) < 0.99) return false; // the gear's axle points at the crown gear's
  // A bevel gear's teeth slope back along its cone, engaging over its depth: the 8850 Rally Support
  // Truck's 14 tooth pinion sits 15 LDU from its crown wheel's pitch plane, its pitch radius 17.5.
  return Math.abs(along - crown.crown * gear.radius) <= (gear.bevel ? BEVEL_TOLERANCE : MESH_TOLERANCE);
}

// Bevel gears on crossing axes mesh when the tips of their bevel cones meet where the axes cross
// (to within BEVEL_TOLERANCE). On axes at right angles, two 45 degree cones also touch all along
// a line when their tips are either side of the crossing, as far from it as each other; gears with
// teeth of the same size mesh there if their pitch circles meet on that line. (An official
// model's differential has a 28 tooth ring whose tip is 10 LDU one side of the crossing, and the
// 20 tooth gear it meshes with has its tip 10 LDU the other side.)
function bevelMesh(ga: Gear, gb: Gear): boolean {
  if (!ga.bevel || !gb.bevel) return false;
  const crossing = axesCrossing(ga.center, ga.axis, gb.center, gb.axis);
  if (!crossing) return false;
  if (Math.abs(ga.radius / ga.teeth - gb.radius / gb.teeth) > 0.01) return false; // different tooth sizes (a knob wheel's knobs and a bevel gear's teeth)
  if (coneTipAt(ga, crossing) && coneTipAt(gb, crossing)) return true;
  if (Math.abs(ga.axis.dot(gb.axis)) > ANGLE_TOLERANCE) return false; // not at right angles
  // Where a gear's pitch circle is on the line along which its cone touches the other's: as far
  // from its tip along its own axis as along the other's.
  const pitchPoint = (cone: Cone, other: Cone, radius: number) => cone.tip.clone().addScaledVector(cone.out, radius).addScaledVector(other.out, radius);
  return cones(ga).some((a) => cones(gb).some((b) => pitchPoint(a, b, ga.radius).distanceTo(pitchPoint(b, a, gb.radius)) < BEVEL_TOLERANCE));
}

// A bevel cone: its tip, and the way it opens from there towards the teeth.
interface Cone {
  tip: Vector3;
  out: Vector3;
}

// A gear's bevel cones (two for a double bevel gear).
function cones(g: Gear): Cone[] {
  const sides = g.bevel === 'both' ? [1, -1] : g.bevel === '+' ? [1] : [-1];
  return sides.map((side) => ({ tip: g.center.clone().addScaledVector(g.axis, side * g.apex), out: g.axis.clone().multiplyScalar(-side) }));
}

// Whether one of a gear's bevel cones has its tip at `point`.
function coneTipAt(g: Gear, point: Vector3): boolean {
  return cones(g).some((cone) => cone.tip.distanceTo(point) < BEVEL_TOLERANCE);
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
  // Tyre on rim: a seat measured from their shapes is at the rim's largest radius, which may reach
  // past the tyre's bore by a flange's height (see shapeSeat in scripts/build-connections.ts).
  if (male.shape === 'T' && female.shape === 'T' && female.radius < male.radius + AXIS_TOLERANCE && male.radius < female.radius + RIM_FLANGE) return 'rigid';
  if (male.shape === 'K' && female.shape === 'K' && same) return 'rigid'; // driving ring in a clutch gear
  if (male.shape === 'A' && female.shape === 'R' && same) return 'revolute'; // axle in round hole
  if (male.shape === 'R' && female.shape === 'R' && same) return 'revolute'; // pin in round hole
  if (male.shape === 'H' && female.shape === 'H' && same) return 'revolute'; // hinge fingers
  if ((male.shape === 'R' || male.shape === 'S') && (female.shape === 'B' || female.shape === 'P') && same) return 'slide'; // piston in its bore, plate on a tile
  if (male.shape === 'S' && female.shape === 'S' && same) return 'slide'; // square peg in a square socket
  if (male.shape === 'R' && female.shape === 'A' && male.radius < female.radius) return 'revolute'; // thin pin in axle hole
  return null;
}

// Step 4: pairs of connection points that line up.
// Open-ended cylinders (Technic holes, axles, pins, tyre seats) make rigid and revolute
// connections; studs in anti-studs make stud connections.
function findConnections(cyls: WorldCylinder[], frictionRigid: boolean, align = ALIGN_TOLERANCE): Connection[] {
  const connections: Connection[] = [];
  const males = cyls.filter((c) => c.gender === 'M');
  const females = cyls.filter((c) => c.gender === 'F');
  const near = nearbyFemales(females);
  for (const m of males) {
    for (const f of near(m)) {
      if (f.part === m.part) continue;
      let c: Connection | null = null;
      if (isBall(m) && isBall(f)) c = ballConnect(m, f);
      else if (goesInForTechnic(m) && opensForTechnic(f)) c = connect(m, f, align);
      else if (goesInForTechnic(m) && hasRound(m, 6) && isAntiStud(f)) c = studConnect(m, f, align);
      else if ((isStud(m) && (isAntiStud(f) || endsInAntiStud(f))) || (isBottomPin(m) && isHollowStud(f))) c = studConnect(m, f, align);
      else if (isStud(m) && isTechnicHole(f)) c = studInHole(m, f, align);
      else if (isSwivelPin(m) && isSwivelHole(f)) c = studInHole(m, f, align);
      else if ((isRoundSocket(m) && isRoundSocket(f)) || (isSquareSocket(m) && isSquareSocket(f))) c = connect(m, f, align);
      if (c && (isSwivelPin(m) || m.secs[0].shape === 'H')) turnsStiffly(c, frictionRigid);
      if (c) connections.push(c);
    }
  }
  return connections;
}


// Which female connection points are near enough a male one to connect to it, in the order
// they were given: those whose boxes (round the cylinder, a little bigger than it) share a
// cube of a grid with its box. Far quicker than trying every pair in a big model.
function nearbyFemales(females: WorldCylinder[]): (m: WorldCylinder) => WorldCylinder[] {
  const CELL = 40; // LDU
  const MARGIN = 5; // LDU, more than any tolerance
  const cellsOf = (c: WorldCylinder): string[] => {
    const length = c.secs.reduce((sum, sec) => sum + sec.length, 0);
    const reach = Math.max(...c.secs.map((sec) => sec.radius)) + MARGIN;
    const end = c.start.clone().addScaledVector(c.dir, length);
    const lo = [0, 1, 2].map((k) => Math.floor((Math.min(c.start.getComponent(k), end.getComponent(k)) - reach) / CELL));
    const hi = [0, 1, 2].map((k) => Math.floor((Math.max(c.start.getComponent(k), end.getComponent(k)) + reach) / CELL));
    const keys: string[] = [];
    for (let x = lo[0]; x <= hi[0]; x++) for (let y = lo[1]; y <= hi[1]; y++) for (let z = lo[2]; z <= hi[2]; z++) keys.push(`${x},${y},${z}`);
    return keys;
  };
  const grid = new Map<string, number[]>();
  females.forEach((f, i) => {
    for (const key of cellsOf(f)) grid.set(key, [...(grid.get(key) ?? []), i]);
  });
  return (m) => {
    const found = new Set<number>();
    for (const key of cellsOf(m)) for (const i of grid.get(key) ?? []) found.add(i);
    return [...found].sort((a, b) => a - b).map((i) => females[i]);
  };
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
  if (point.distanceTo(centre(f)) > BALL_TOLERANCE) return null;
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
// side), or an axle stub or a pin fixed to a part at one end (a connector's axle, a crankshaft's;
// a cross block's pins, a long pin's beyond its stop bush, an old steering arm's pivots), or a
// bar (a beam's angled bar, a tile's bottom pin, a minifig's sword), which goes into a pin's
// hollow or a bar hole, or a wheel hub's boss (see isHubBoss). Studs, closed at one end too,
// have neither an axle's shape nor a pin's collar or tip, are wider than a bar, and are a single
// section, so they don't count.
function goesInForTechnic(m: WorldCylinder): boolean {
  return m.caps === 'none' || m.caps === 'two' || (closedAtOneEnd(m) && (m.secs.some((s) => s.shape === 'A') || hasPinCollar(m) || hasPinTip(m) || isBar(m) || isHubBoss(m)));
}

// A wheel hub's boss, closed at its outer end: round, wider than a pin, in more than one
// section (the hub with a brake disc, 35189, which turns in a steering bearing as the open
// hub of a portal axle, 92909, does). A stud is a single section.
function isHubBoss(m: WorldCylinder): boolean {
  return m.secs.length > 1 && m.secs.every((s) => s.shape === 'R' || s.shape === 'L') && Math.max(...m.secs.map((s) => s.radius)) >= 9;
}

// A female connection point that takes Technic axles and pins: open at both ends, or an axle
// hole or a pin hole closed at the far end (the ends of an axle joiner, or an angle
// connector's, which have a thin round lip at the mouth; a panel's pin holes). Anti-studs,
// closed at one end too, have neither an axle's shape nor a pin hole's collar, so they don't
// count.
function opensForTechnic(f: WorldCylinder): boolean {
  return f.caps === 'none' || (closedAtOneEnd(f) && (f.secs.some((s) => s.shape === 'A') || hasPinCollar(f)));
}

// Closed at one end: most connection points just say so, some say which (A: the start, B: the
// far end), as a round tile's anti-stud does.
function closedAtOneEnd(c: WorldCylinder): boolean {
  return c.caps === 'one' || c.caps === 'A' || c.caps === 'B';
}

// A Technic pin's collar and shaft, or a pin hole's counterbore and bore: round sections of
// radius 8 and 6 LDU.
function hasPinCollar(c: WorldCylinder): boolean {
  return hasRound(c, 8) && hasRound(c, 6);
}

// A Technic pin's shaft and its springy tip, with no collar (an old steering arm's pivots).
function hasPinTip(c: WorldCylinder): boolean {
  return hasRound(c, 6) && c.secs.some((s) => s.shape === 'L');
}

// A bar: round, of radius 4 LDU all along.
function isBar(c: WorldCylinder): boolean {
  return c.secs.every((s) => s.shape === 'R' && Math.abs(s.radius - 4) < AXIS_TOLERANCE);
}

function hasRound(c: WorldCylinder, radius: number): boolean {
  return c.secs.some((s) => s.shape === 'R' && Math.abs(s.radius - radius) < AXIS_TOLERANCE);
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

// A swivel hinge's pin: a thin round peg with a lip at its end (a 1 x 4 swivel hinge plate's
// top half, 2430), which clicks into the thin hole of the other half (2429) and turns in it.
function isSwivelPin(c: WorldCylinder): boolean {
  const [first, ...rest] = c.secs;
  return c.caps === 'one' && first.shape === 'R' && Math.abs(first.radius - 4) < AXIS_TOLERANCE && rest.length > 0 && rest.every((s) => s.shape === 'L');
}

function isSwivelHole(c: WorldCylinder): boolean {
  return c.caps === 'none' && c.secs.length === 1 && c.secs[0].shape === 'R' && Math.abs(c.secs[0].radius - 4) < AXIS_TOLERANCE;
}

// Hinges (a swivel hinge, hinge plates' fingers) turn stiffly, like a friction pin (see
// fixPins): they hold what they're set at an angle (a seat back, a spoiler, a bumper's
// corners), unless they're the only way the model can move.
function turnsStiffly(c: Connection, frictionRigid: boolean) {
  if (frictionRigid) [c.kind, c.held] = ['rigid', true];
  else c.stiff = true;
}

// A round peg or socket closed at one end and wider than a stud, the peg turning in a socket
// its size: a turntable's two halves, a linear actuator's end in its bracket.
function isRoundSocket(c: WorldCylinder): boolean {
  return closedAtOneEnd(c) && c.secs.length === 1 && c.secs[0].shape === 'R' && c.secs[0].radius > 10;
}

// A square peg or socket closed at one end and wider than an anti-stud, the peg sliding along
// a socket its size: a rack with a beam under it, in its housing (a telescopic boom).
function isSquareSocket(c: WorldCylinder): boolean {
  return closedAtOneEnd(c) && c.secs.length === 1 && c.secs[0].shape === 'S' && c.secs[0].radius > 8;
}

// A Technic hole, round and open at both ends. A stud in one turns in it, like a pin (an old
// engine's piston turns on its connecting rod's stud), unless held on another axis too (a
// Technic plate's holes sit on studs, next to its anti-studs).
function isTechnicHole(c: WorldCylinder): boolean {
  return c.caps === 'none' && c.secs.some((s) => s.shape === 'R' && Math.abs(s.radius - 6) < AXIS_TOLERANCE);
}

// An anti-stud: the socket for a stud, underneath a brick or plate. A pin's end holds in one as
// a stud does (a 1 x 1 round tile on a half pin, a plate on a long pin's end).
function isAntiStud(c: WorldCylinder): boolean {
  const sec = c.secs[0];
  return closedAtOneEnd(c) && c.secs.length === 1 && (sec.shape === 'R' || sec.shape === 'S') && Math.abs(sec.radius - 6) < AXIS_TOLERANCE;
}

// A hole that opens into an anti-stud: a headlight brick's (4070), through the brick from
// its underside, which sits on a stud as any brick does.
function endsInAntiStud(c: WorldCylinder): boolean {
  return c.secs.length > 1 && c.secs.some((s) => s.shape === 'S' && Math.abs(s.radius - 6) < AXIS_TOLERANCE);
}

// A stud sitting in an anti-stud: on the same axis, overlapping along it.
function studInHole(m: WorldCylinder, f: WorldCylinder, align = ALIGN_TOLERANCE): Connection | null {
  const overlap = axialOverlap(m, f, align);
  if (!overlap) return null;
  return { male: m.part, female: f.part, kind: 'revolute', from: overlap.from, to: overlap.to };
}

function studConnect(m: WorldCylinder, f: WorldCylinder, align = ALIGN_TOLERANCE): Connection | null {
  const overlap = axialOverlap(m, f, align);
  if (!overlap) return null;
  return { male: m.part, female: f.part, kind: 'stud', from: overlap.from, to: overlap.to };
}

// Where two cylinders on the same axis overlap, or null if they're not on the same axis or
// overlap by less than MIN_OVERLAP.
function axialOverlap(m: WorldCylinder, f: WorldCylinder, align = ALIGN_TOLERANCE): { from: Vector3; to: Vector3 } | null {
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

// A part pinned to two arms that turn on one body, all on parallel axes (a steering rack
// pinned to both steering arms), is the coupler of a four-bar linkage: that sets its path, a
// curve as the arms swing. So it doesn't also slide straight on that body, or on the frame, as
// a plate on tiles under it, or a guide for a rack, would have it: the two together would only
// fit as the model was built, and it would jam a step further on (the 8841 Dune Buggy's and the
// 8063 Tractor's steering). Such slides are left out.
export function withoutSlidesOnCouplers(joints: Joint[]): Joint[] {
  const axis = (j: Joint) => new Vector3().subVectors(j.to, j.from).normalize();
  const parallel = (a: Joint, b: Joint) => new Vector3().crossVectors(axis(a), axis(b)).length() < ANGLE_TOLERANCE;
  const other = (j: Joint, body: number) => (j.bodyA === body ? j.bodyB : j.bodyA);
  const pins = (body: number) => joints.filter((j) => j.kind === 'revolute' && (j.bodyA === body || j.bodyB === body));
  // The bodies a part's four-bars turn on, if it's a coupler (never the frame).
  const bases = (body: number): number[] => {
    if (body === 0) return [];
    const found: number[] = [];
    const own = pins(body);
    // What an arm turns on, about an axis parallel to the pin joining it to the part.
    const turnsOn = (arm: number, pin: Joint) => pins(arm).filter((j) => j !== pin && other(j, arm) !== body && parallel(j, pin)).map((j) => other(j, arm));
    own.forEach((a, i) => {
      for (const b of own.slice(i + 1)) {
        const [armA, armB] = [other(a, body), other(b, body)];
        if (armA === armB || !parallel(a, b)) continue;
        const onA = turnsOn(armA, a);
        for (const g of turnsOn(armB, b)) if (g !== armA && g !== armB && onA.includes(g)) found.push(g);
      }
    });
    return found;
  };
  return joints.filter((j) => {
    if (j.kind !== 'slide' || j.turns) return true;
    const onA = bases(j.bodyA);
    const onB = bases(j.bodyB);
    return !(onA.length && (j.bodyB === 0 || onA.includes(j.bodyB))) && !(onB.length && (j.bodyA === 0 || onB.includes(j.bodyA)));
  });
}

// Turning joints whose axes are parallel and all but on one line (within AXLE_LINE) are put on
// one line, the first one's: a model built by hand may set two half axles a hair apart (an
// official tractor's are 0.02 LDU apart), and an assembly hung on both (its hitch) would
// otherwise be held fast, as if on two axles side by side.
function lineUpAxles(joints: Joint[]) {
  const AXLE_LINE = 0.1; // LDU
  const lines: { from: Vector3; dir: Vector3 }[] = [];
  for (const joint of joints) {
    if (joint.kind !== 'revolute') continue;
    const dir = new Vector3().subVectors(joint.to, joint.from).normalize();
    const line = lines.find((l) => {
      if (new Vector3().crossVectors(l.dir, dir).length() > 1e-3) return false;
      const off = new Vector3().subVectors(joint.from, l.from);
      return off.addScaledVector(l.dir, -off.dot(l.dir)).length() < AXLE_LINE;
    });
    if (!line) {
      lines.push({ from: joint.from.clone(), dir });
      continue;
    }
    for (const end of [joint.from, joint.to]) {
      const along = new Vector3().subVectors(end, line.from).dot(line.dir);
      end.copy(line.from).addScaledVector(line.dir, along);
    }
  }
}

// A crankshaft built of webs on crank pins (the 8865 Test Car's: 24 tooth gears, joined by axles
// in their round holes), whose middle web is held only by two pins on opposite sides of the main
// axis, is at dead centre always: as the webs either side of it turn on the main axis, the pins
// don't tie their turning together, as in the real crankshaft they do. So those two turn together
// (a coupling, of their turning only). Only so: the middle web has no other joint, and the webs
// either side of it turn on the main axis in one body.
function crankWebs(joints: Joint[]): Coupling[] {
  const LINE = 1; // LDU
  const dirOf = (j: Joint) => new Vector3().subVectors(j.to, j.from).normalize();
  const parallel = (a: Joint, b: Joint) => Math.abs(dirOf(a).dot(dirOf(b))) > 0.999;
  // How far a point is from a joint's axis.
  const offAxis = (j: Joint, p: Vector3) => {
    const off = new Vector3().subVectors(p, j.from);
    return off.addScaledVector(dirOf(j), -off.dot(dirOf(j))).length();
  };
  const middleOf = (j: Joint) => j.from.clone().add(j.to).multiplyScalar(0.5);
  const jointsOf = (body: number) => joints.filter((j) => j.bodyA === body || j.bodyB === body);
  const other = (j: Joint, body: number) => (j.bodyA === body ? j.bodyB : j.bodyA);
  const found: Coupling[] = [];
  const bodies = new Set(joints.flatMap((j) => [j.bodyA, j.bodyB]));
  for (const middle of bodies) {
    const pins = jointsOf(middle);
    if (middle === 0 || pins.length !== 2 || pins.some((j) => j.kind !== 'revolute') || !parallel(pins[0], pins[1])) continue;
    if (other(pins[0], middle) === other(pins[1], middle) || offAxis(pins[0], pins[1].from) < LINE) continue;
    // The main axis: midway between the two pins.
    const center = middleOf(pins[0]).add(middleOf(pins[1])).multiplyScalar(0.5);
    const d = dirOf(pins[0]);
    const off = new Vector3().subVectors(middleOf(pins[1]), middleOf(pins[0]));
    center.addScaledVector(d, -off.dot(d) / 2);
    // Each pin's web beside the middle one: on the pin, and turning on the main axis.
    const webs = pins.map((pin) => {
      const p = other(pin, middle);
      for (const onPin of jointsOf(p)) {
        const web = other(onPin, p);
        if (web === middle || onPin.kind !== 'revolute' || !parallel(onPin, pin) || offAxis(pin, onPin.from) > LINE) continue;
        const main = jointsOf(web).find((j) => j.kind === 'revolute' && parallel(j, pin) && offAxis(j, center) < LINE);
        if (main) return { web, main };
      }
      return null;
    });
    const [a, b] = webs;
    if (!a || !b || a.web === b.web || other(a.main, a.web) !== other(b.main, b.web)) continue;
    found.push({ bodyA: a.web, bodyB: b.web, center, axisA: dirOf(a.main), axisB: dirOf(b.main), atA: middleOf(a.main), atB: middleOf(b.main), turningOnly: true });
  }
  return found;
}

// A ball joint whose middle sits all but on an axis one of its bodies turns about (within
// BALL_LINE of it, and no further along it than a stud past the turning joint's ends) is put on
// that axis: a model built by hand may set a ball a little off the axis of the part
// it's socketed in (an official Unimog's driveshaft ends in a ball 0.23 LDU off its constant
// velocity joint's axis, the 42110 Land Rover's half shafts, drawn drooped a little too far, 2 LDU
// off its steering hubs'), and as that part turned, the ball would go round its axis, which the
// shaft, held at its other end, couldn't follow: the drivetrain locked after a step. (No ball in
// the OMR sits between 2 and 15 LDU off such an axis: a crank's is a stud or more out.)
//
// Where two such axes cross at the ball, one each side of a constant velocity joint, it's put
// where they cross, so it's on both: on one, a hair off the other, it went round as that one
// turned (an official Porsche 911 GT3 RS's steering column, a ball 0.03 LDU off the axis of the
// shaft it ends, which slides and turns in a toggle joint, stopped the steering a few degrees on).
// Such a shaft's axis counts, if it crosses another's: a joint it slides on as it turns.
export function lineUpBalls(joints: Joint[]) {
  const REACH = 20; // LDU
  const CROSS = 0.5; // LDU: how near two axes must pass each other to count as crossing
  for (const ball of joints) {
    if (ball.kind !== 'ball') continue;
    // The axes the ball's bodies turn about, near it: where on each it's nearest the ball, and
    // whether that's within REACH of the joint (a crossing needs no reach: a shaft's axis runs on
    // past the joint it turns in, to the ball at its end).
    const axes: { from: Vector3; dir: Vector3; at: Vector3; off: number; slides: boolean; reaches: boolean }[] = [];
    for (const j of joints) {
      if ((j.kind !== 'revolute' && !(j.kind === 'slide' && j.turns)) || ![j.bodyA, j.bodyB].some((b) => b === ball.bodyA || b === ball.bodyB)) continue;
      const length = j.from.distanceTo(j.to);
      const dir = new Vector3().subVectors(j.to, j.from).normalize();
      const rel = new Vector3().subVectors(ball.from, j.from);
      const along = rel.dot(dir);
      const off = rel.addScaledVector(dir, -along).length();
      if (off >= BALL_LINE) continue;
      axes.push({ from: j.from, dir, at: j.from.clone().addScaledVector(dir, along), off, slides: j.kind === 'slide', reaches: along >= -REACH && along <= length + REACH });
    }
    // Two that cross near the ball: where they pass nearest each other.
    let crossing: { at: Vector3; off: number } | null = null;
    for (let a = 0; a < axes.length; a++) {
      for (let b = a + 1; b < axes.length; b++) {
        const [p, q] = [axes[a], axes[b]];
        const normal = new Vector3().crossVectors(p.dir, q.dir);
        if (normal.length() < 0.05) continue; // all but parallel
        const w = new Vector3().subVectors(p.from, q.from);
        const [dd, pq, qq] = [p.dir.dot(q.dir), p.dir.dot(w), q.dir.dot(w)];
        const den = 1 - dd * dd;
        const onP = p.from.clone().addScaledVector(p.dir, (dd * qq - pq) / den);
        const onQ = q.from.clone().addScaledVector(q.dir, (qq - dd * pq) / den);
        if (onP.distanceTo(onQ) >= CROSS) continue;
        const at = onP.add(onQ).multiplyScalar(0.5);
        const off = at.distanceTo(ball.from);
        if (off < BALL_LINE && (!crossing || off < crossing.off)) crossing = { at, off };
      }
    }
    // Failing that, the nearest axis it turns about (not one it slides on: a towball on a
    // sliding part may well sit off it).
    const nearest = axes.filter((x) => x.reaches && !x.slides && x.off > 1e-9).sort((x, y) => x.off - y.off)[0];
    const at = crossing?.at ?? nearest?.at;
    if (at) {
      ball.from.copy(at);
      ball.to.copy(at);
    }
  }
}

// A part turning on an axle may slide along it too, as far as the parts either side of it on
// the axle let it, if a linkage works it that way: its body turns on another body about an
// axis across the axle, in a closed loop of joints back to the axle, so swinging there moves
// it along the axle (an old helicopter's
// swashplate, raised and lowered on its rotor shaft by the pilot's levers, so tilting the
// blades through their pitch links). A connecting rod on a crank, whose other end turns on a
// parallel pin, swings across its axle, and stays where it is along it. Parts stacked against it on the axle that turn
// there too ride along with it, turning against it (the swashplate's other half, which turns
// with the rotor while this one doesn't). Other parts stay where they're built along their
// axles: most are held there by their neighbours, or by friction.
// Turns the parts' turning connections with the axle into slides that turn (with their travel
// as extents, see slideRange), and returns the connections between the parts of a stack.
function slidingOnAxles(roles: string[], cyls: WorldCylinder[], connections: Connection[], bodyOf: number[]): Connection[] {
  const TOUCH = 0.5; // LDU: parts along an axle this close touch
  const result: Connection[] = [];
  for (const axle of cyls.filter((c) => c.gender === 'M' && roles[c.part] === 'axle')) {
    const length = axle.secs.reduce((sum, sec) => sum + sec.length, 0);
    const at = (p: Vector3) => new Vector3().subVectors(p, axle.start).dot(axle.dir);
    // The parts on the axle, each with where it lies along it.
    const spans = new Map<number, [number, number]>();
    for (const c of cyls) {
      if (c.part === axle.part) continue;
      const overlap = axialOverlap(axle, c);
      if (!overlap) continue;
      const [lo, hi] = [at(overlap.from), at(overlap.to)].sort((x, y) => x - y);
      const span = spans.get(c.part);
      spans.set(c.part, span ? [Math.min(span[0], lo), Math.max(span[1], hi)] : [lo, hi]);
    }
    const shaft = bodyOf[axle.part];
    const onAxle = (c: Connection) => Math.max(...[c.from, c.to].map((p) => new Vector3().subVectors(p, axle.start).cross(axle.dir).length())) < AXIS_TOLERANCE;
    // Parts that turn on it, and of those, the ones a linkage works.
    const turning = (part: number) => bodyOf[part] !== shaft && connections.some((c) => c.kind === 'revolute' && c.male === axle.part && c.female === part);
    // Whether a body joins back up with the shaft's through joints, other than through `not`.
    const joinsShaft = (start: number, not: number) => {
      const seen = new Set([start, not]);
      const queue = [start];
      while (queue.length) {
        const body = queue.shift()!;
        if (body === shaft) return true;
        for (const c of connections) {
          if (c.kind !== 'revolute' && c.kind !== 'ball' && c.kind !== 'slide') continue;
          const [a, b] = [bodyOf[c.male], bodyOf[c.female]];
          const next = a === body ? b : b === body ? a : -1;
          if (next >= 0 && !seen.has(next)) {
            seen.add(next);
            queue.push(next);
          }
        }
      }
      return false;
    };
    const linked = (part: number) =>
      connections.some((c) => {
        if (c.kind !== 'revolute') return false;
        const [a, b] = [bodyOf[c.male], bodyOf[c.female]];
        const other = a === bodyOf[part] ? b : b === bodyOf[part] ? a : -1;
        const across = new Vector3().subVectors(c.to, c.from).normalize().cross(axle.dir).length() > 0.5;
        return other >= 0 && other !== bodyOf[part] && other !== shaft && across && joinsShaft(other, bodyOf[part]);
      });
    const done = new Set<number>();
    for (const [part] of spans) {
      if (done.has(part) || !turning(part) || !linked(part)) continue;
      // The stack of turning parts touching it, and the room either side of the stack.
      const stack = [part];
      let [lo, hi] = spans.get(part)!;
      let grew = true;
      while (grew) {
        grew = false;
        for (const [other, [a, b]] of spans) {
          if (stack.includes(other) || a > hi + TOUCH || b < lo - TOUCH || !turning(other)) continue;
          stack.push(other);
          [lo, hi] = [Math.min(lo, a), Math.max(hi, b)];
          grew = true;
        }
      }
      for (const p of stack) done.add(p);
      // Not the frame, nor a body held on the axle elsewhere too (the frame, or a tail boom, with
      // a shaft turning in a row of its holes): those hold the axle, rather than ride on it.
      const bodies = new Set(stack.map((p) => bodyOf[p]));
      if (bodies.has(0) || [...spans.keys()].some((p) => bodies.has(bodyOf[p]) && !stack.includes(p))) continue;
      let [below, above] = [lo, length - hi];
      for (const [other, [a, b]] of spans) {
        if (stack.includes(other)) continue;
        if (b <= lo + TOUCH) below = Math.min(below, Math.max(0, lo - b));
        else if (a >= hi - TOUCH) above = Math.min(above, Math.max(0, a - hi));
        else [below, above] = [0, 0]; // something else round the axle in the stack's way
      }
      if (below + above < TOUCH) continue;
      for (const c of connections) {
        if (c.kind !== 'revolute' || !onAxle(c)) continue;
        const [a, b] = [bodyOf[c.male], bodyOf[c.female]];
        if (!((a === shaft && bodies.has(b)) || (b === shaft && bodies.has(a)))) continue;
        // How far the axle may slide against the part, along from -> to.
        const way = new Vector3().subVectors(c.to, c.from).dot(axle.dir) >= 0 ? 1 : -1;
        const room: [number, number] = a === shaft ? [-above, below] : [-below, above];
        c.kind = 'slide';
        c.turns = true;
        c.extents = { male: [0, 0], female: way > 0 ? room : [-room[1], -room[0]], overlap: 0 };
      }
      // The stack's parts, each turning against the next.
      const ordered = stack.slice().sort((x, y) => spans.get(x)![0] - spans.get(y)![0]);
      for (let k = 1; k < ordered.length; k++) {
        const [x, y] = [ordered[k - 1], ordered[k]];
        if (bodyOf[x] === bodyOf[y]) continue;
        const point = (t: number) => axle.start.clone().addScaledVector(axle.dir, t);
        result.push({ male: x, female: y, kind: 'revolute', from: point(spans.get(x)![0]), to: point(spans.get(y)![1]) });
      }
    }
  }
  return result;
}

// Parts resting on others under gravity, which Kinebrick has no forces for, so keeps touching
// what they rest on (see Rest). Two kinds, both in the 858 inline engine's valve train:
//
//   push rods  an upright axle with bushes on it and nothing else, turning in round holes in one
//              other body, that stands by its bottom bush on a shaft turning across it below (the
//              pins on an engine's camshaft, or the camshaft itself between them), or by a bush
//              higher up on the hole under it. It rests on whichever is higher, so pins lift it as
//              they come round under it, and it drops back after them. Its holes become slides
//              that turn, as far up as its bushes let it go (see slideRange).
//   rockers    a part turning on an axle across a push rod whose underside lies on the rod's top
//              bush, so it tips as the rod rises and falls (a valve's rocker).
//
// Taken only where the rod (and the rocker) is built resting, within ALIGN_TOLERANCE.
function restingParts(parts: PlacedPart[], roles: string[], cyls: WorldCylinder[], connections: Connection[], bodyOf: number[]): Rest[] {
  const BUSH_RADIUS = 9; // a Technic bush's flanges (3713), round its axle
  const REACH = 30; // how far below a push rod's foot what it may stand on may be, in LDU
  const TOUCH = 0.5; // LDU: parts along an axle this close touch
  const identity = new Matrix4();
  const clearance = (c: RestContact) => restTouch(c, identity, identity)?.clearance ?? Infinity;
  // The axes a body turns about (in a round hole, on an axle).
  const axesOf = (body: number) => connections.filter((c) => c.kind === 'revolute' && bodyOf[c.male] !== bodyOf[c.female] && (bodyOf[c.male] === body || bodyOf[c.female] === body)).map((c) => new Vector3().subVectors(c.to, c.from).normalize());
  const turnsAbout = (body: number, d: Vector3) => axesOf(body).some((a) => a.clone().cross(d).length() < ANGLE_TOLERANCE);
  // Each part's underside, facing down: where its anti-studs open, as a face reaching half a stud
  // beyond their middles. And the studs pointing up, which an underside may rest on.
  const mouths = new Map<number, WorldCylinder[]>();
  for (const c of cyls) {
    if (c.gender !== 'F' || c.caps !== 'one' || c.secs.length !== 1 || !['S', 'R'].includes(c.secs[0].shape) || Math.abs(c.secs[0].radius - 6) > AXIS_TOLERANCE || -c.dir.y < 0.5) continue;
    mouths.set(c.part, [...(mouths.get(c.part) ?? []), c]);
  }
  const undersides = new Map<number, RestContact['face']>();
  for (const [part, list] of mouths) {
    if (list.some((m) => m.dir.dot(list[0].dir) < 1 - ANGLE_TOLERANCE)) continue;
    const normal = list[0].dir.clone().negate();
    const middle = list.reduce((sum, m) => sum.add(m.start), new Vector3()).divideScalar(list.length);
    // Its two ways, along its row of anti-studs (or any way, for one) and across it.
    const far = list.reduce((best, m) => (m.start.distanceTo(middle) > best.distanceTo(middle) ? m.start : best), middle);
    const lengthways = far.distanceTo(middle) > 1e-6 ? new Vector3().subVectors(far, middle).normalize() : acrossDirections(normal)[0];
    const sideways = new Vector3().crossVectors(normal, lengthways).normalize();
    const halfOf = (d: Vector3) => Math.max(...list.map((m) => Math.abs(new Vector3().subVectors(m.start, middle).dot(d)))) + 10;
    undersides.set(part, { point: middle, normal, across: sideways, along: lengthways, half: [halfOf(sideways), halfOf(lengthways)] });
  }
  const studs = cyls.filter((c) => c.gender === 'M' && c.caps === 'one' && c.secs.length === 1 && c.secs[0].shape === 'R' && Math.abs(c.secs[0].radius - 6) < AXIS_TOLERANCE && -c.dir.y > 0.5);
  const rests: Rest[] = [];
  for (const axle of cyls.filter((c) => c.gender === 'M' && roles[c.part] === 'axle' && Math.abs(c.dir.y) > 1 - ANGLE_TOLERANCE)) {
    const rod = bodyOf[axle.part];
    const own = parts.flatMap((_, i) => (bodyOf[i] === rod ? [i] : []));
    if (rod === 0 || own.some((i) => i !== axle.part && roles[i] !== 'bush')) continue;
    const holes = connections.filter((c) => c.kind === 'revolute' && c.male === axle.part && bodyOf[c.female] !== rod);
    if (!holes.length || new Set(holes.map((c) => bodyOf[c.female])).size > 1) continue;
    if (connections.some((c) => !holes.includes(c) && bodyOf[c.male] !== bodyOf[c.female] && (bodyOf[c.male] === rod || bodyOf[c.female] === rod))) continue;
    const mount = bodyOf[holes[0].female];
    // Up the axle, and how high a point is along it.
    const up = axle.dir.y < 0 ? axle.dir.clone() : axle.dir.clone().negate();
    const height = (p: Vector3) => p.dot(up);
    const point = (h: number) => axle.start.clone().addScaledVector(up, h - height(axle.start));
    const span = (c: Connection): [number, number] => [Math.min(height(c.from), height(c.to)), Math.max(height(c.from), height(c.to))];
    const bushes = connections.filter((c) => c.kind === 'rigid' && c.male === axle.part && roles[c.female] === 'bush').map(span);
    if (!bushes.length) continue;
    const [across, along] = acrossDirections(up);
    const foot = (h: number) => ({ point: point(h), normal: up.clone().negate(), across, along, half: [BUSH_RADIUS, BUSH_RADIUS] as [number, number] });
    // The bottom bush on what's below it, or may come round below it: the cylinders, near it
    // and lying across under it, of a body that turns about them.
    const bottom = bushes.reduce((low, b) => (b[0] < low[0] ? b : low));
    const footAt = point(bottom[0]);
    const on: RestContact[] = [];
    for (const c of cyls) {
      const body = bodyOf[c.part];
      if (c.gender !== 'M' || body === rod || body === mount || Math.abs(c.dir.dot(up)) > ANGLE_TOLERANCE || !turnsAbout(body, c.dir)) continue;
      let at = 0;
      for (const sec of c.secs) {
        const start = c.start.clone().addScaledVector(c.dir, at);
        at += sec.length;
        const t = new Vector3().subVectors(footAt, start).dot(c.dir);
        if (t < -BUSH_RADIUS || t > sec.length + BUSH_RADIUS) continue; // not across under it
        const off = new Vector3().subVectors(start.clone().addScaledVector(c.dir, t), footAt);
        if (Math.abs(off.dot(up)) > REACH || off.addScaledVector(up, -off.dot(up)).length() > BUSH_RADIUS + REACH) continue;
        on.push({ face: foot(bottom[0]), body, shape: { kind: 'cylinder', point: start, axis: c.dir.clone(), length: sec.length, radius: sec.radius } });
      }
    }
    if (!on.length) continue;
    // Each bush on the top of a hole under it.
    const holeSpans = holes.map(span);
    let [drop, rise] = [Infinity, Infinity];
    for (const b of bushes) {
      for (const h of holeSpans) {
        if (b[0] >= h[1] - TOUCH) {
          drop = Math.min(drop, b[0] - h[1]);
          on.push({ face: foot(b[0]), body: mount, shape: { kind: 'plane', point: point(h[1]), axis: up.clone(), length: 0, radius: 0 } });
        } else if (b[1] <= h[0] + TOUCH) rise = Math.min(rise, h[0] - b[1]);
      }
    }
    if (Math.abs(Math.min(...on.map(clearance))) > ALIGN_TOLERANCE) continue; // not resting as built
    // Its holes become slides: up as far as its bushes let it, down (beyond where it rests) a
    // little, so resting on the hole's top doesn't count as the end of its travel.
    for (const c of holes) {
      const room: [number, number] = [-(Math.min(drop, REACH) + 1), Math.min(rise, REACH)];
      const way = new Vector3().subVectors(c.to, c.from).dot(up) >= 0 ? 1 : -1;
      c.kind = 'slide';
      c.turns = true;
      c.extents = { male: [0, 0], female: way > 0 ? [-room[1], -room[0]] : room, overlap: 0 };
    }
    rests.push({ body: rod, on });
    // A rocker lying on its top bush: a part's underside (its anti-studs' mouths) over the bush's
    // rim, on a body turning about an axis across the rod. It rests on the rod, or on whatever
    // studs are under its parts' undersides, whichever is higher: when the rod drops, a valve's
    // rocker comes down on the plate the rod stands through.
    const top = bushes.reduce((high, b) => (b[1] > high[1] ? b : high));
    const disc = { kind: 'disc' as const, point: point(top[1]), axis: up.clone(), length: 0, radius: BUSH_RADIUS };
    for (const [part, face] of undersides) {
      const body = bodyOf[part];
      if ([rod, mount, 0].includes(body) || rests.some((r) => r.body === body)) continue;
      const contact: RestContact = { face, body: rod, shape: disc };
      if (Math.abs(clearance(contact)) > ALIGN_TOLERANCE || !axesOf(body).some((a) => Math.abs(a.dot(up)) < ANGLE_TOLERANCE)) continue;
      const on = [contact];
      for (const [other, f] of undersides) {
        if (bodyOf[other] !== body) continue;
        for (const stud of studs) {
          if (bodyOf[stud.part] === body || bodyOf[stud.part] === rod) continue;
          const onStud: RestContact = { face: f, body: bodyOf[stud.part], shape: { kind: 'disc', point: stud.start.clone().addScaledVector(stud.dir, stud.secs[0].length), axis: stud.dir.clone(), length: 0, radius: stud.secs[0].radius } };
          if (clearance(onStud) < REACH) on.push(onStud);
        }
      }
      rests.push({ body, on });
    }
  }
  // A part built a little into a flat thing it rests on rests where it's built: that's taken
  // as much lower (the 858 inline engine's rockers sink 1.6 LDU into the studs under them).
  // Not a pin coming round under a push rod: it turns, so it's that far in at only one turn.
  for (const rest of rests) {
    for (const c of rest.on) {
      const into = -clearance(c);
      if (c.shape.kind !== 'cylinder' && into > 0 && into <= LOOSE_ALIGN_TOLERANCE) c.shape.point.addScaledVector(c.face.normal, into);
    }
  }
  return rests;
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

function connect(m: WorldCylinder, f: WorldCylinder, align = ALIGN_TOLERANCE): Connection | null {
  // Same axis: parallel, and the female's start lies on the male's line.
  if (new Vector3().crossVectors(m.dir, f.dir).length() > ANGLE_TOLERANCE) return null;
  const offset = new Vector3().subVectors(f.start, m.start);
  const along = offset.dot(m.dir);
  const sideways = offset.clone().addScaledVector(m.dir, -along).length();
  if (sideways > align) return null;

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
  // A motor's output turns in it, stiffly: its gearbox holds it unless nothing else can move.
  const motor = kind === 'rigid' && (m.turns || f.turns);
  if (motor) kind = 'revolute';

  const from = m.start.clone().addScaledVector(m.dir, lo);
  let extents: Connection['extents'];
  if (kind === 'slide') {
    // Measured along from -> to, from `from`.
    const length = (c: WorldCylinder) => c.secs.reduce((sum, sec) => sum + sec.length, 0);
    const fEnd = along + sign * length(f);
    const overlap = f.secs.some((sec) => sec.shape === 'P') ? SURFACE_OVERLAP : BORE_OVERLAP;
    extents = { male: [-lo, length(m) - lo], female: [Math.min(along, fEnd) - lo, Math.max(along, fEnd) - lo], overlap };
  }
  return { male: m.part, female: f.part, kind, from, to: m.start.clone().addScaledVector(m.dir, hi), extents, ...(motor ? { stiff: true, motor: true } : {}) };
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
    const existing = joints.find((j) => j.kind === kind && j.turns === c.turns && sameBodies(j, a, b) && along(j));
    if (existing) {
      if (kind !== 'ball') extendJoint(existing, c);
      existing.stiff = existing.stiff || c.stiff === true;
      if (c.motor) existing.motor = true;
    } else {
      joints.push({ kind, bodyA: Math.min(a, b), bodyB: Math.max(a, b), from: c.from.clone(), to: c.to.clone(), stiff: c.stiff === true, ...(c.motor ? { motor: true } : {}), ...(c.turns ? { turns: true } : {}) });
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
      if (c.kind !== 'slide' || c.turns !== joint.turns || !c.extents || !sameBodies(joint, bodyOf[c.male], bodyOf[c.female]) || !parallel(joint, c)) continue;
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
