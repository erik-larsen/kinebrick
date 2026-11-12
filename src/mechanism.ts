// Works out a model's mechanism: which parts move together (bodies) and how bodies can
// move relative to each other (joints). See "How it works" in ARCHITECTURE.md, steps 2 to 6.

import { Matrix4, Vector3 } from 'three';
import { ConnectionTable } from './connections.ts';
import { acrossDirections, Kinematics, nullSpace } from './kinematics.ts';
import { PathPoint, PlacedPart, PlacedPath } from './ldr.ts';
import { LoopPath } from './paths.ts';
import { groupIntoBodies, nameBodies } from './inference/bodies.ts';
import { crankWebs, dropBallsInBearings, groovedBalls, universalJoints } from './inference/couplings.ts';
import { findConnections } from './inference/fits.ts';
import { findGears, findMeshes, rackMesh } from './inference/gears.ts';
import { findJoints, withoutSlidesOnCouplers } from './inference/joints.ts';
import { lineUpAxles, lineUpBalls } from './inference/lineUp.ts';
import { fixPins } from './inference/pins.ts';
import { ALIGN_TOLERANCE, ANGLE_TOLERANCE, axialOverlap, AXIS_TOLERANCE, BALL_LINE, findLooseParts, isAntiStud, LOOSE_ALIGN_TOLERANCE, rigidGroups, SURFACE_OVERLAP, type WorldCylinder, worldCylinders } from './inference/shared.ts';
import { bushesOnFourStuds, onFourStuds, platesOnEdge } from './inference/studs.ts';
export { axesCrossing, closestPoints, findMeshes, meshesChanged } from './inference/gears.ts';
export { withoutSlidesOnCouplers } from './inference/joints.ts';
export { lineUpBalls } from './inference/lineUp.ts';

// How far the middle of a circle a chain placed link by link goes round may be from its wheel's
// axis, in LDU (see findLoops): the 8835 Forklift's chain is 0.7 LDU off its sprockets.
const CHAIN_REACH = 2;
const LINKS = ['steering link', 'connecting rod'];
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
  fixed?: boolean; // a wheel that's part of its body and can't turn (a train motor's), which slides along the rail rather than rolling
}

// A piece of a train track's centreline (see findRails), in model coordinates as built, at the
// height of the rail heads: straight from `from` to `to`, or, with `center` and `radius`, an arc
// about `center` from `from` to `to`.
export interface Rail {
  part: number;
  from: Vector3;
  to: Vector3;
  center?: Vector3;
  radius?: number;
}

// Two train wheels on one axle, running on the rails (see findRiders): their body, the axle's
// middle and direction in model coordinates as built, and whether the wheels turn with the body
// as it rolls (not a train motor's, which are part of it).
export interface Rider {
  body: number;
  center: Vector3;
  axis: Vector3;
  rolls: boolean;
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
  centers?: Vector3[]; // each body's middle as built: the mean of its parts' origins
  rails?: Rail[]; // a train track's centreline, piece by piece (see findRails)
  riders?: Rider[]; // pairs of train wheels on the rails (see findRiders)
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
  // A printed part (3626bp01, 973p19) has its plain part's role (3626b, 973).
  const plain = (name: string) => name.replace(/(?:p[0-9a-z]+|pb[0-9a-z]+)\.dat$/, '.dat');
  const roles = parts.map((p) => (p.path ? 'path' : roleList[p.name] ?? roleList[plain(p.name)] ?? (table.stickers?.includes(p.name) ? 'decoration' : 'structure')));
  const cyls = worldCylinders(parts, table).filter((c) => roles[c.part] !== 'path');
  // A motor's output, its axle hole or (on the old motors) axle stub, turns in the motor: an axle
  // in it turns, rather than being fixed to the motor and whatever the motor is built into.
  for (const c of cyls) if (roles[c.part] === 'motor' && c.secs.some((s) => s.shape === 'A')) c.turns = true;
  const connections = findConnections(cyls, frictionRigid);
  // A train track's pieces hold together end to end (nothing else joins them), and the track,
  // the trains' wheels and what's built on them are assemblies of their own, standing apart
  // from each other, never loose (see findLooseParts).
  const rails = findRails(parts, roles);
  connections.push(...railJoins(rails));
  connections.push(...magnetCouplings(parts, roles, cyls, connections));
  const anchors = anchorsOf(roles);
  fixPins(connections, roles, frictionRigid);
  // A train coupling's magnet casing clicks onto its holder's hinge fingers and swings on them,
  // stiffly, as a friction pin turns: held, unless nothing else can move. Free, the two casings
  // of a coupling would swing as the magnets met, and the cars behind them lurch.
  for (const c of connections) {
    if (c.kind !== 'revolute' || !((roles[c.male] === 'coupling' && roles[c.female] === 'magnet') || (roles[c.male] === 'magnet' && roles[c.female] === 'coupling'))) continue;
    if (frictionRigid) [c.kind, c.held] = ['rigid', true];
    else c.stiff = true;
  }
  connections.push(...platesOnEdge(cyls));
  connections.push(...onFourStuds(cyls));
  connections.push(...onTiles(roles, cyls, connections));
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
  connections.push(...onAxleTips(roles, cyls, connections));
  // Loose parts hanging on a string, or hooked to a chain, are held by it; the rest ride along
  // with what's nearest.
  connections.push(...looseFits(roles, cyls, connections, frictionRigid));
  const hanging = hangingParts(parts, connections, findLooseParts(parts.length, connections, anchors), paths);
  const hooked = hookedParts(cyls, connections, findLooseParts(parts.length, connections, anchors), paths);
  const riding = findLooseParts(parts.length, connections, anchors).filter((i) => !hanging.has(i) && !hooked.has(i));
  // On a train layout, what stands on the table beside the track (a platform, with the figures
  // on it) is scenery, not loose: it rides along with the track, never with a train that happens
  // to stand beside it. A few parts on their own are loose as ever, and ride along with what's
  // nearest, as elsewhere.
  // Nor is what a figure holds or stands with (a porter's hand truck and suitcase, in the
  // figure's own submodel, one that's mostly figure parts): posed by hand, as the figure is.
  const bySubmodel = new Map<string, { parts: number; figure: number }>();
  parts.forEach((p, i) => {
    if (!p.submodel) return;
    const n = bySubmodel.get(p.submodel) ?? { parts: 0, figure: 0 };
    n.parts++;
    if (roles[i] === 'figure') n.figure++;
    bySubmodel.set(p.submodel, n);
  });
  const figures = new Set([...bySubmodel].filter(([, n]) => n.figure * 2 >= n.parts).map(([sub]) => sub));
  const loose = (rails.length ? smallGroups(parts.length, connections, riding) : riding).filter((i) => !figures.has(parts[i].submodel ?? ''));
  const scenery = new Set(riding.filter((i) => !loose.includes(i)));
  connections.push(...rideAlong(parts, cyls, connections, loose));
  if (scenery.size) connections.push(...rideAlong(parts, cyls, connections, [...scenery], new Set(rails.map((r) => r.part))));
  const bodyOf = groupIntoBodies(parts.length, roles, connections);
  connections.push(...slidingOnAxles(roles, cyls, connections, bodyOf));
  const bodies = nameBodies(bodyOf, roles);
  const rests = restingParts(parts, roles, cyls, connections, bodyOf);
  const joints = withoutSlidesOnCouplers(findJoints(connections, bodyOf));
  lineUpAxles(joints);
  lineUpBalls(joints);
  const treads = findTreads(cyls, bodyOf, roles);
  const riders = rails.length ? findRiders(treads) : [];
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
  const centers = bodies.map((b) => b.parts.reduce((sum, i) => sum.add(new Vector3().setFromMatrixPosition(parts[i].matrix)), new Vector3()).multiplyScalar(1 / Math.max(1, b.parts.length)));
  return { roles, bodyOf, bodies, joints, connections, treads, gears, meshes, loose, couplings, loops, strings, screws, rests, centers, ...(rails.length ? { rails, riders } : {}) };
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

// Parts that would be loose get a second chance, fitting with the looser LOOSE_ALIGN_TOLERANCE:
// connections that join a loose part to anything, found as findConnections finds them. So do
// parts held to the rest only by slides and balls, which hold nothing in place: the 42039 and
// 42041's V8 connecting rods, tied by balls to pistons sliding in their cylinders, are built
// 1.005 LDU off their crank pins. But not a universal joint's cross, which keeps only the arms
// universalJoints left it. Such a steering link or connecting rod's balls fit with the looser
// LOOSE_BALL_TOLERANCE too. A pin's new joints turn as fixPins has its others do: a friction
// pin's stiffly.
function looseFits(roles: string[], cyls: WorldCylinder[], connections: Connection[], frictionRigid: boolean): Connection[] {
  const count = Math.max(0, ...cyls.map((c) => c.part)) + 1;
  // Every group but the biggest gets the chance, a train's bogies among them (a layout's cars
  // are placed by hand, and a bogie's pin may sit a hair over 1 LDU from its hole).
  const loose = new Set(findLooseParts(count, connections.filter((c) => c.kind !== 'slide' && c.kind !== 'ball')));
  if (loose.size === 0) return [];
  const known = new Set(connections.map((c) => `${c.male},${c.female}`));
  const settled = (c: Connection) => roles[c.male] === 'universal joint' || roles[c.female] === 'universal joint';
  const links = new Set([...loose].filter((p) => LINKS.includes(roles[p])));
  const found = findConnections(cyls, frictionRigid, LOOSE_ALIGN_TOLERANCE, links).filter((c) => (loose.has(c.male) || loose.has(c.female)) && !known.has(`${c.male},${c.female}`) && !settled(c));
  for (const c of found) {
    if (c.kind !== 'revolute' || roles[c.male] !== 'friction pin') continue;
    if (frictionRigid) [c.kind, c.held] = ['rigid', true];
    else c.stiff = true;
  }
  return found;
}

// A part that would be loose, its axle hole lined up with an axle's tip and starting right there,
// is pushed on that axle: real parts give a little, so a builder may press a part on an axle
// already filled by others, where in LDraw it can only sit against its tip (the 858 Auto Engines'
// fans, two round plates pressed on an axle pin past the bush their rubber band runs in).
function onAxleTips(roles: string[], cyls: WorldCylinder[], connections: Connection[]): Connection[] {
  const count = Math.max(0, ...cyls.map((c) => c.part)) + 1;
  const loose = new Set(findLooseParts(count, connections, anchorsOf(roles)));
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

// A part held by nothing but smooth tiles under it slides along them: nothing grips a tile
// from above (an official crane's outriggers slide out on tiles). Like a plate on tiles (see
// the corrections), along the tile's length (whatever keeps it in line is taken as read), as
// long as it still overlaps the tile by a stud. A part attached otherwise (a seat on a rack)
// is left to that: a tile lets it slide any way, so a slide along the tile could jam it.
function onTiles(roles: string[], cyls: WorldCylinder[], connections: Connection[]): Connection[] {
  const count = Math.max(0, ...cyls.map((c) => c.part)) + 1;
  const loose = new Set(findLooseParts(count, connections, anchorsOf(roles)));
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

// Decoration: parts that are there for looks and connect to nothing in a way that matters,
// such as stickers and the old pneumatic hoses models use for exhausts and cables. Each moves
// with the part whose connection point (stud, hole, axle) is nearest to it.
function decorations(parts: PlacedPart[], roles: string[], cyls: WorldCylinder[]): Connection[] {
  const isDecoration = (i: number) => roles[i] === 'decoration' || roles[i] === 'path' || roles[i] === 'figure';
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

function findTreads(cyls: WorldCylinder[], bodyOf: number[], roles: string[]): Tread[] {
  const treads: Tread[] = [];
  for (const c of cyls) {
    const sec = c.secs[0];
    if (c.secs.length !== 1 || sec.shape !== 'W') continue;
    const center = c.start.clone().addScaledVector(c.dir, sec.length / 2);
    treads.push({ part: c.part, body: bodyOf[c.part], center, axis: c.dir.clone(), radius: sec.radius, ...(roles[c.part] === 'train motor' ? { fixed: true } : {}) });
  }
  return treads;
}

// ---------------------------------------------------------------------------
// Trains: a track of rails, and the wheels that run on it

// How close the ends of two pieces of track must come to join (LDU): half a stud, since a
// layout's pieces are laid by hand and an oval may not quite close.
const RAIL_JOIN = 10;
// A train's wheels are this far apart on their axle, between where they run on the rail heads
// (LDU): LEGO's gauge is 5 studs between the rails' centres, and a hair more.
const GAUGE = 101;
// A group of this many parts or more, standing apart on a train layout, is scenery.
const SCENERY = 5;

// The parts whose groups stand on their own, never loose: a train track's rails, and trains'
// wheels and motors, which run on it.
export function anchorsOf(roles: string[]): Set<number> {
  const anchors = new Set<number>();
  roles.forEach((r, i) => {
    if (r === 'rail' || r === 'train wheel' || r === 'train motor') anchors.add(i);
  });
  return anchors;
}

// The track's centreline, a piece for each rail part, at the height of the rail heads (16 LDU
// above the sleepers' base). A 9V straight (74746, once 2865) is 320 LDU long along its x; a
// 9V curve (74747, once 2867) is a 22.5 degree arc, one sixteenth of a circle of 800 LDU radius
// (40 studs) whose centre is 800 LDU along the part's -z from its origin, the middle of the arc:
// that's how layouts place the pieces end to end, though the part draws its rails 3 LDU further
// towards the centre.
function findRails(parts: PlacedPart[], roles: string[]): Rail[] {
  const rails: (Rail & { mid: Vector3 })[] = [];
  const HEAD = -16;
  parts.forEach((p, i) => {
    if (roles[i] !== 'rail') return;
    const name = p.name.replace(/\.dat$/, '');
    const at = (x: number, z: number) => new Vector3(x, HEAD, z).applyMatrix4(p.matrix);
    if (name === '74746' || name === '2865') rails.push({ part: i, from: at(-160, 0), to: at(160, 0), mid: at(0, 0) });
    else if (name === '74747' || name === '2867') {
      const R = 800;
      const half = Math.PI / 16;
      rails.push({ part: i, from: at(-R * Math.sin(half), R * Math.cos(half) - R), to: at(R * Math.sin(half), R * Math.cos(half) - R), mid: at(0, 0), center: new Vector3(), radius: R });
    }
  });
  // Pieces laid by hand don't quite meet: their ends are moved to meet halfway, so that the
  // centreline runs on without a step (a bogie's two axles, one each side of a step, couldn't
  // both keep to it). Then each curve is the circle through its ends and middle as placed: a
  // layout often places a curve with its rotation rounded (a cosine of 1), which stretches the
  // part a little, so the arc's centre and radius come from the three points rather than from
  // the part.
  for (let a = 0; a < rails.length; a++) {
    for (let b = a + 1; b < rails.length; b++) {
      for (const pa of [rails[a].from, rails[a].to]) {
        for (const pb of [rails[b].from, rails[b].to]) {
          if (pa.distanceTo(pb) >= RAIL_JOIN) continue;
          const meet = pa.clone().lerp(pb, 0.5);
          pa.copy(meet);
          pb.copy(meet);
        }
      }
    }
  }
  for (const rail of rails) {
    if (rail.center === undefined) continue;
    const circle = circleThrough(rail.from, rail.mid, rail.to);
    rail.center = circle.center;
    rail.radius = circle.radius;
  }
  return rails.map(({ mid: _, ...rail }) => rail);
}

// The circle through three points, seen from above (in x and z), at the first point's height.
function circleThrough(a: Vector3, b: Vector3, c: Vector3): { center: Vector3; radius: number } {
  const d = 2 * (a.x * (b.z - c.z) + b.x * (c.z - a.z) + c.x * (a.z - b.z));
  const [a2, b2, c2] = [a.x * a.x + a.z * a.z, b.x * b.x + b.z * b.z, c.x * c.x + c.z * c.z];
  const x = (a2 * (b.z - c.z) + b2 * (c.z - a.z) + c2 * (a.z - b.z)) / d;
  const z = (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d;
  const center = new Vector3(x, a.y, z);
  return { center, radius: Math.hypot(a.x - x, a.z - z) };
}

// Pieces of track whose ends meet (findRails has moved them together) are joined, rigidly: the
// track is one assembly.
function railJoins(rails: Rail[]): Connection[] {
  const joins: Connection[] = [];
  for (let a = 0; a < rails.length; a++) {
    for (let b = a + 1; b < rails.length; b++) {
      for (const pa of [rails[a].from, rails[a].to]) {
        for (const pb of [rails[b].from, rails[b].to]) {
          if (pa.distanceTo(pb) < 1e-6) joins.push({ male: rails[a].part, female: rails[b].part, kind: 'rigid', from: pa.clone(), to: pb.clone() });
        }
      }
    }
  }
  return joins;
}

// How far apart two magnets' faces may be and still hold (LDU): they touch in the real model,
// but a layout's cars are placed by hand, a stud or so apart, and closing the loops draws them
// together as the magnets would.
const MAGNET_REACH = 32;

// Train cars couple by magnets: a magnet (see the corrections for 70023) whose face lies near
// another's, their axes within 45 degrees, holds it, turning any way about where they meet
// (midway between the faces), as a ball joint does. Each coupling has two holders (2920), each
// swivelling on its car's buffer beam; here one of them is fixed, so that the two cars hang
// together as a drawbar on one swivel would hold them, with nothing left to fold or slide: both
// swivelling, with the magnets a ball joint, the holders could fold while the cars stood, and
// with the faces held in line as well, the cars couldn't round a curve, their pins' distance
// having to change.
function magnetCouplings(parts: PlacedPart[], roles: string[], cyls: WorldCylinder[], connections: Connection[]): Connection[] {
  const magnets = cyls.filter((c) => roles[c.part] === 'magnet' && c.gender === 'M' && c.secs[0].shape === 'A' && c.secs[0].radius >= 10);
  const couplings: Connection[] = [];
  const at = (part: number) => new Vector3().setFromMatrixPosition(parts[part].matrix);
  for (let i = 0; i < magnets.length; i++) {
    for (let j = i + 1; j < magnets.length; j++) {
      const [a, b] = [magnets[i], magnets[j]];
      if (a.part === b.part || Math.abs(a.dir.dot(b.dir)) < 0.7) continue;
      const ends = (c: WorldCylinder) => [c.start.clone(), c.start.clone().addScaledVector(c.dir, c.secs.reduce((sum, s) => sum + s.length, 0))];
      let best: { at: Vector3; distance: number } | null = null;
      for (const pa of ends(a)) for (const pb of ends(b)) {
        const distance = pa.distanceTo(pb);
        if (!best || distance < best.distance) best = { at: pa.clone().lerp(pb, 0.5), distance };
      }
      if (!best || best.distance > MAGNET_REACH) continue;
      couplings.push({ male: a.part, female: b.part, kind: 'ball', from: best.at, to: best.at.clone() });
      // The first magnet's holder, the coupling part nearest it, fixed on its beam.
      const holder = roles.flatMap((r, p) => (r === 'coupling' ? [p] : [])).sort((p, q) => at(p).distanceTo(at(a.part)) - at(q).distanceTo(at(a.part)))[0];
      if (holder !== undefined && at(holder).distanceTo(at(a.part)) < 60) for (const c of connections) if (c.kind === 'revolute' && (c.male === holder || c.female === holder) && roles[c.male] !== 'magnet' && roles[c.female] !== 'magnet') c.kind = 'rigid';
    }
  }
  return couplings;
}

// Pairs of train wheels on one axle: two treads on one body, on one axis, a gauge apart.
function findRiders(treads: Tread[]): Rider[] {
  const riders: Rider[] = [];
  const used = new Set<number>();
  treads.forEach((a, i) => {
    if (used.has(i)) return;
    treads.forEach((b, j) => {
      if (j <= i || used.has(j) || a.body !== b.body) return;
      if (new Vector3().crossVectors(a.axis, b.axis).length() > ANGLE_TOLERANCE) return;
      const offset = new Vector3().subVectors(b.center, a.center);
      const along = offset.dot(a.axis);
      if (Math.abs(Math.abs(along) - GAUGE) > 4 || offset.clone().addScaledVector(a.axis, -along).length() > AXIS_TOLERANCE) return;
      used.add(i).add(j);
      riders.push({ body: a.body, center: a.center.clone().lerp(b.center, 0.5), axis: a.axis.clone(), rolls: !a.fixed && !b.fixed });
    });
  });
  return riders;
}

// Of the parts that ride along, those in groups smaller than SCENERY: the loose ones.
function smallGroups(count: number, connections: Connection[], riding: number[]): number[] {
  const isRiding = new Set(riding);
  const leader = Array.from({ length: count }, (_, i) => i);
  const find = (i: number): number => {
    while (leader[i] !== i) i = leader[i];
    return i;
  };
  for (const c of connections) if (isRiding.has(c.male) && isRiding.has(c.female)) leader[find(c.male)] = find(c.female);
  const sizes = new Map<number, number>();
  for (const i of riding) sizes.set(find(i), (sizes.get(find(i)) ?? 0) + 1);
  return riding.filter((i) => sizes.get(find(i))! < SCENERY);
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
function rideAlong(parts: PlacedPart[], cyls: WorldCylinder[], connections: Connection[], loose: number[], among?: Set<number>): Connection[] {
  if (loose.length === 0) return [];
  const isLoose = new Set(loose);
  const leader = new Map(loose.map((i) => [i, i]));
  const find = (i: number): number => {
    while (leader.get(i) !== i) i = leader.get(i)!;
    return i;
  };
  for (const c of connections) if (isLoose.has(c.male) && isLoose.has(c.female)) leader.set(find(c.male), find(c.female));
  // Only the parts given (`among`), if any: scenery rides with a train track's rails.
  const anchors = cyls.filter((c) => !isLoose.has(c.part) && (!among || among.has(c.part)));
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
