// Works out a model's mechanism: which parts move together (bodies) and how bodies can
// move relative to each other (joints). See "How it works" in ARCHITECTURE.md, steps 2 to 6.
// Here are the types the rest of the code reads, and the order the rules run in (see
// buildMechanism). Each rule is a file in src/inference/.

import { Vector3 } from 'three';
import { ConnectionTable } from './connections.ts';
import { Kinematics } from './kinematics.ts';
import { PlacedPart, PlacedPath } from './ldr.ts';
import { buildTrack, outermostRiders, Track, wheelPairs } from './track.ts';
import { actuatorScrews, linearActuators } from './inference/actuators.ts';
import { slidingOnAxles } from './inference/axleSlides.ts';
import { bodyCenters, groupIntoBodies, nameBodies } from './inference/bodies.ts';
import { bushGrips, toothedBushes } from './inference/bushes.ts';
import { crankWebs, dropBallsInBearings, findCouplings, groovedBalls, universalJoints } from './inference/couplings.ts';
import { findConnections } from './inference/fits.ts';
import { findGears, findMeshes } from './inference/gears.ts';
import { inGrooves } from './inference/grooves.ts';
import { chainHooks, hookedParts } from './inference/hooks.ts';
import { findJoints, withoutSlidesOnCouplers } from './inference/joints.ts';
import { lineUpAxles, lineUpBalls } from './inference/lineUp.ts';
import { findLoops } from './inference/loops.ts';
import { looseFits, onAxleTips } from './inference/looseFits.ts';
import { fixPins } from './inference/pins.ts';
import { guidedPistons, shockAbsorbers } from './inference/pistons.ts';
import { guidedRacks, racksToGuide } from './inference/racks.ts';
import { restingParts } from './inference/rests.ts';
import { decorations, figureSubmodels, rideAlong } from './inference/rideAlong.ts';
import { findLooseParts, worldCylinders } from './inference/shared.ts';
import { findStrings, hangingParts } from './inference/strings.ts';
import { bushesOnFourStuds, onFourStuds, platesOnEdge } from './inference/studs.ts';
import { onTiles } from './inference/tiles.ts';
import { ABOVE_RAILS, anchorsOf, findRails, findRiders, loads, magnetCouplings, railJoins, smallGroups, stiffMagnetHinges } from './inference/trains.ts';
import { findTreads, trackTreads } from './inference/treads.ts';
export { axesCrossing, closestPoints, findMeshes, meshesChanged } from './inference/gears.ts';
export { withoutSlidesOnCouplers } from './inference/joints.ts';
export { lineUpBalls } from './inference/lineUp.ts';
export { movePaths } from './inference/loops.ts';
export { restTouch } from './inference/rests.ts';

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
  track?: Track; // the track as a graph, with its switches (see src/track.ts)
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

// The mechanism, with friction pins treated as rigid or as stiff joints. Each rule is a file in
// src/inference/. They run in this order, in five stages: each stage reads what the ones before
// it found.
//
//   1. Connections   which parts are joined, and how
//   2. Loose parts   what the rules above left attached to nothing
//   3. Bodies        parts fixed to each other move as one
//   4. Joints        how the bodies move against each other
//   5. The rest      gears, couplings, loops, strings and screws between bodies
function buildMechanism(parts: PlacedPart[], table: ConnectionTable, roleList: Record<string, string>, frictionRigid: boolean, guide: Set<number>, paths: PlacedPath[]): Mechanism {
  // A path's parts (a chain's links) only show where it runs: they connect to nothing, and
  // move with what's nearest (see decorations), or round their loop (see findLoops).
  // A printed part (3626bp01, 973p19) has its plain part's role (3626b, 973).
  const plain = (name: string) => name.replace(/(?:p[0-9a-z]+|pb[0-9a-z]+)\.dat$/, '.dat');
  const roles = parts.map((p) => (p.path ? 'path' : roleList[p.name] ?? roleList[plain(p.name)] ?? (table.stickers?.includes(p.name) ? 'decoration' : 'structure')));
  const cyls = worldCylinders(parts, table).filter((c) => roles[c.part] !== 'path');
  // A motor's output, its axle hole or (on the old motors) axle stub, turns in the motor: an axle
  // in it turns, rather than being fixed to the motor and whatever the motor is built into.
  // Before findConnections, which reads it.
  for (const c of cyls) if (roles[c.part] === 'motor' && c.secs.some((s) => s.shape === 'A')) c.turns = true;

  // 1. Connections. First the connection points that fit (fits.ts).
  const connections = findConnections(cyls, frictionRigid);
  // A train wheel on a wheel pin (a handcar's) rolls freely: the pin's lip doesn't hold it.
  for (const c of connections) if (c.held && (roles[c.male] === 'train wheel' || roles[c.female] === 'train wheel')) [c.kind, c.held] = ['revolute', false];
  // A monorail car's pin on its wheel chassis lets it turn any way (as a ball joint does): round
  // a curve, and up or down a ramp. At its other end it's clipped to the motor: the clip holds
  // it fast, and swings on the motor (on a ball, see the corrections for 2684).
  for (const c of connections) {
    const role = [roles[c.male], roles[c.female]];
    if (c.kind !== 'revolute' && !c.held) continue;
    if (role.includes('monorail clip')) Object.assign(c, { kind: 'rigid', held: false });
    if (!role.includes('monorail coupling')) continue;
    const middle = c.from.clone().lerp(c.to, 0.5);
    Object.assign(c, { kind: 'ball', from: middle, to: middle.clone(), held: false });
  }
  // A train track's pieces hold together end to end (nothing else joins them), and the track,
  // the trains' wheels and what's built on them are assemblies of their own, standing apart
  // from each other, never loose (see findLooseParts).
  const track = buildTrack(parts.map((p, i) => (roles[i] === 'rail' ? p : { ...p, name: '' })));
  const rails = track ? track.rails() : findRails(parts, roles);
  connections.push(...railJoins(rails));
  connections.push(...magnetCouplings(parts, roles, cyls, connections));
  const anchors = anchorsOf(roles);
  // Pins and hinges, among the connections found so far.
  fixPins(connections, roles, frictionRigid);
  stiffMagnetHinges(connections, roles, frictionRigid);
  // Parts held by more than their connection points say.
  connections.push(...platesOnEdge(cyls));
  connections.push(...onFourStuds(cyls));
  // onTiles and guidedRacks take only parts still loose, so they come after the rules that
  // attach parts; guidedPistons slides a piston against a part it isn't connected to.
  connections.push(...onTiles(roles, cyls, connections));
  connections.push(...inGrooves(parts, cyls, table));
  connections.push(...guidedRacks(parts.length, cyls, connections, guide));
  connections.push(...decorations(parts, roles, cyls, connections));
  connections.push(...guidedPistons(parts, roles, cyls, connections));
  connections.push(...shockAbsorbers(cyls));
  // linearActuators, universalJoints and groovedBalls replace connections already found.
  const actuators = linearActuators(parts, connections);
  connections.push(...bushGrips(roles, cyls));
  connections.push(...toothedBushes(roles, cyls));
  const joined = [...universalJoints(parts, roles, cyls, connections), ...groovedBalls(parts, roles, cyls, connections)];

  // 2. Loose parts. Second chances first, for parts no rule above attached (looseFits leaves a
  // universal joint's cross the arms universalJoints left it).
  connections.push(...bushesOnFourStuds(roles, cyls, connections));
  connections.push(...onAxleTips(roles, cyls, connections));
  connections.push(...looseFits(roles, cyls, connections, frictionRigid));
  // Loose parts hanging on a string, or hooked to a chain, are held by it; the rest ride along
  // with what's nearest.
  const hanging = hangingParts(parts, connections, findLooseParts(parts.length, connections, anchors), paths);
  const hooked = hookedParts(cyls, connections, findLooseParts(parts.length, connections, anchors), paths);
  // (On a layout, a part joined to a car only by its magnet's coupling to the next car, a buffer
  // beam the file places off its car, is loose: it rides along with its own car.)
  const uncoupled = rails.length ? connections.filter((c) => !(roles[c.male] === 'magnet' && roles[c.female] === 'magnet')) : connections;
  const riding = findLooseParts(parts.length, uncoupled, anchors).filter((i) => !hanging.has(i) && !hooked.has(i));
  // On a train layout, what stands on the table beside the track (a platform, with the figures
  // on it) is scenery, not loose: it rides along with the track, never with a train that happens
  // to stand beside it. A few parts on their own are loose as ever, and ride along with what's
  // nearest, as elsewhere.
  // Nor is what a figure holds or stands with (see figureSubmodels).
  const figures = figureSubmodels(parts, roles);
  // (Two cars' loose bits, coupled by their magnets, aren't one group either: each is its own car's.)
  const trainSubmodels = new Set(parts.flatMap((p, i) => (p.submodel && ['train wheel', 'train motor'].includes(roles[i]) ? [p.submodel] : [])));
  let loose = (rails.length ? smallGroups(parts.length, uncoupled, riding, track ? track.head() - ABOVE_RAILS : undefined, parts, trainSubmodels) : riding).filter((i) => !figures.has(parts[i].submodel ?? ''));
  const scenery = new Set(riding.filter((i) => !loose.includes(i)));
  // What stands on a train rides with it (see loads): scenery, or a loose group not of a train's
  // own submodel (a container on a monorail car, too high above the rails to be scenery).
  if (track) {
    const loadable = new Set([...scenery, ...loose.filter((i) => !trainSubmodels.has(parts[i].submodel ?? ''))]);
    const before = new Set(loadable);
    connections.push(...loads(parts, roles, cyls, uncoupled, loadable));
    for (const i of before) if (!loadable.has(i)) scenery.delete(i);
    loose = loose.filter((i) => !before.has(i) || loadable.has(i));
  }
  connections.push(...rideAlong(parts, cyls, uncoupled, loose));
  if (scenery.size) connections.push(...rideAlong(parts, cyls, uncoupled, [...scenery], new Set(rails.map((r) => r.part))));

  // 3. Bodies, from every connection above.
  const bodyOf = groupIntoBodies(parts.length, roles, connections);
  // slidingOnAxles and restingParts read the bodies, and turn connections into slides, so they
  // come before the joints are found.
  connections.push(...slidingOnAxles(roles, cyls, connections, bodyOf));
  const bodies = nameBodies(bodyOf, roles);
  const rests = restingParts(parts, roles, cyls, connections, bodyOf);

  // 4. Joints, then put on one line where built a hair out of it.
  const joints = withoutSlidesOnCouplers(findJoints(connections, bodyOf));
  lineUpAxles(joints);
  lineUpBalls(joints);

  // 5. The rest, between bodies.
  const treads = findTreads(cyls, bodyOf, roles);
  const riders = rails.length ? findRiders(treads, roles) : [];
  if (rails.length) riders.splice(0, riders.length, ...outermostRiders([...riders, ...wheelPairs(treads, riders, roles)], joints));
  const gears = findGears(cyls, bodyOf);
  const meshes = findMeshes(gears);
  // After lineUpBalls: dropBallsInBearings and findCouplings find a nudged ball's joint where
  // lineUpBalls has put it.
  dropBallsInBearings(joints, joined, roles, bodyOf);
  const couplings = findCouplings(joined, joints, parts, roles, bodyOf);
  couplings.push(...crankWebs(joints));
  const loops = findLoops(parts, roles, bodyOf, joints, table, paths);
  // What's hooked to a chain it can't slide along is loose after all (it rides along with nothing).
  loose.push(...chainHooks(parts, bodyOf, joints, loops, hooked));
  loose.sort((a, b) => a - b);
  treads.push(...trackTreads(loops));
  // After chainHooks, as a string reads which parts are loose.
  const strings = findStrings(parts, roles, bodyOf, joints, paths, hanging, loose);
  const screws = actuatorScrews(actuators, bodyOf);
  const centers = bodyCenters(bodies, parts);
  return { roles, bodyOf, bodies, joints, connections, treads, gears, meshes, loose, couplings, loops, strings, screws, rests, centers, ...(rails.length ? { rails, riders } : {}), ...(track ? { track } : {}) };
}
