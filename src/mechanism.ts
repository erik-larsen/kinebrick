// Works out a model's mechanism: which parts move together (bodies) and how bodies can
// move relative to each other (joints). See "How it works" in ARCHITECTURE.md, steps 2 to 6.
// Here are the types the rest of the code reads, and the order the rules run in (see
// buildMechanism). Each rule is a file in src/inference/.

import { Vector3 } from 'three';
import { ConnectionTable } from './connections.ts';
import { Kinematics } from './kinematics.ts';
import { PlacedPart, PlacedPath } from './ldr.ts';
import { actuatorScrews, linearActuators } from './inference/actuators.ts';
import { slidingOnAxles, slidingOnParallelAxles } from './inference/axleSlides.ts';
import { bodyCenters, groupIntoBodies, nameBodies } from './inference/bodies.ts';
import { bushGrips, toothedBushes } from './inference/bushes.ts';
import { crankWebs, lockedJoints, dropBallsInBearings, findCouplings, groovedBalls, reductions, universalJoints } from './inference/couplings.ts';
import { findConnections } from './inference/fits.ts';
import { findGears, findMeshes, wormRacks } from './inference/gears.ts';
import { inGrooves } from './inference/grooves.ts';
import { chainHooks, hookedParts } from './inference/hooks.ts';
import { findJoints, withoutSlidesOnCouplers } from './inference/joints.ts';
import { lineUpAxles, lineUpBalls } from './inference/lineUp.ts';
import { findLoops } from './inference/loops.ts';
import { looseFits, onAxleTips } from './inference/looseFits.ts';
import { fixPins, slipClutches } from './inference/pins.ts';
import { throughOutputs } from './inference/motors.ts';
import { guidedPistons, shockAbsorbers, squareRodsInBores } from './inference/pistons.ts';
import { hungOnSliders } from './inference/guides.ts';
import { guidedRacks, racksToGuide } from './inference/racks.ts';
import { restingParts } from './inference/rests.ts';
import { decorations, figureSubmodels, rideAlong } from './inference/rideAlong.ts';
import { slidesAsked } from './inference/slideOnDemand.ts';
import { findLooseParts, worldCylinders } from './inference/shared.ts';
import { findStrings, hangingParts } from './inference/strings.ts';
import { bushesOnFourStuds, onFourStuds, platesOnEdge } from './inference/studs.ts';
import { onTiles } from './inference/tiles.ts';
import { secondModels } from './inference/frames.ts';
import { anchorsOf, findRails, findRiders, magnetCouplings, railJoins, smallGroups, stiffMagnetHinges } from './inference/trains.ts';
import { findTreads, trackTreads } from './inference/treads.ts';
export { axesCrossing, closestPoints, findMeshes, meshesChanged } from './inference/gears.ts';
export { withoutSlidesOnCouplers } from './inference/joints.ts';
export { lineUpBalls } from './inference/lineUp.ts';
export { pinsToFree } from './inference/friction.ts';
import { pinsToSlide } from './inference/friction.ts';
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
  springHeld?: boolean; // a slide that a spring holds at rest, as a shock absorber's, or friction holds, as a part's on an axle it turns on (see Joint.springHeld)
  asked?: boolean; // a slide asked for: a part slid on its axle by a function's first step or the viewer's user (see slidesAsked)
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
  // A slide that a spring holds at rest, as a shock absorber's rod in its cylinder, or that friction
  // holds, as a part's that turns on an axle (see slidingOnAxles). Free to slide,
  // but held where the question is the model at rest (see Kinematics.springRows): finding its
  // steering, choosing how it parks and rolls, and in least motion's friction-pin tier. Until
  // springs push (v2.0), nothing pushes it back.
  springHeld?: boolean;
  asked?: boolean; // a slide asked for (see slidesAsked)
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
  // Each model's frame, the main model's (body 0) first, then each further model the file
  // holds standing on its own (a set's second vehicle: see secondModels): the body with the most
  // parts in it. `carried`: each model carried on the main model or hitched to it (see
  // secondModels): its parts, and the parts it is welded to where it rests (as loose parts ride
  // along), so that a user might lift it off one day. Its parts aren't loose.
  frames?: number[]; // always set by inferMechanism; left out of hand-built mechanisms (tests): just the frame
  slid?: number[]; // the parts asked to slide whose slides were made (see slidesAsked); only when some were asked
  slideWhy?: Record<number, string>; // why each other part asked can't slide
  // The parts of each further frame's model (each second model's group), in the order of frames.
  frameParts?: number[][];
  carried?: { parts: number[]; weldedTo: number[] }[];
  // Things that stand apart and aren't vehicles (a building): loose, riding along (see secondModels).
  accessories?: number[][];
  // Groups that would be carried but meet the main model where a joint should be and the reading
  // made none: each group's parts, and the near-miss pair (a male and a female connection point).
  // They stay loose (see secondModels).
  missedJoints?: { parts: number[]; pair: [number, number] }[];
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
  // How many times bodyA turns for each turn of bodyB, each against what it turns in: a
  // planetary wheel hub's driving shaft and its hub (see reductions). 1 if not given, as for
  // every universal joint and grooved ball.
  ratio?: number;
}

// Whether inferMechanism first tries friction pins as rigid (on unless KINEBRICK_FRICTION_RIGID=0).
const FRICTION_RIGID = typeof process === 'undefined' || process.env?.KINEBRICK_FRICTION_RIGID !== '0';
const SHOCK_PIVOTS = typeof process !== 'undefined' && process.env?.KINEBRICK_SHOCK_PIVOTS === '1';

// `paths`: every path in the model (see parseModel), including those drawn with shapes rather
// than parts (a string), which the parts alone don't show.
// `freed`: friction pins left to turn, stiffly, though the others are held (see pinsToFree);
// `allFree`, every friction pin left to turn, as KINEBRICK_FRICTION_RIGID=0 has them.
// `kept`: the pins the rule for stuck actuators frees in this model, kept for it (see
// pivotsOfStuckSlides, keptPivots.ts and npm run pivots), so the rule isn't worked out again.
// Used only with no pins `freed`, as the kept result was found; else the rule is worked out.
// `slid`: parts asked to slide on their axles (see slidesAsked): a function's first step, or the
// viewer's user, names them; none, and the reading is as it was.
export function inferMechanism(parts: PlacedPart[], table: ConnectionTable, roleList: Record<string, string>, paths: PlacedPath[] = [], freed = new Set<number>(), allFree = false, kept: number[] | null = null, slid = new Set<number>()): Mechanism {
  return infer(parts, table, roleList, paths, freed, allFree, kept, slid).mech;
}

// The pins the rule for stuck actuators frees in a model as read, an empty list if none: what
// npm run pivots keeps.
export function actuatorPivots(parts: PlacedPart[], table: ConnectionTable, roleList: Record<string, string>, paths: PlacedPath[] = []): number[] {
  return infer(parts, table, roleList, paths, new Set(), false, null).pivots;
}

function infer(parts: PlacedPart[], table: ConnectionTable, roleList: Record<string, string>, paths: PlacedPath[], freed: Set<number>, allFree: boolean, kept: number[] | null, slid = new Set<number>()): { mech: Mechanism; pivots: number[] } {
  parts = parts.map((p) => ({ ...p, name: libraryName(p.name, table) }));
  // Friction pins hold what they join in place, unless they're the only way the model can
  // move (a linkage built on friction pins). So first try them as rigid: if the model can
  // still move, that's it; if not, they stay joints, stiff ones.
  const allPaths = [...new Set([...paths, ...parts.flatMap((p) => (p.path ? [p.path] : []))])];
  const build = (guide: Set<number>, free = freed) => {
    // KINEBRICK_FRICTION_RIGID=0 skips that first try: friction pins are always stiff joints.
    // For measuring what the rule does; unset, nothing changes.
    if (FRICTION_RIGID && !allFree) {
      const rigid = buildMechanism(parts, table, roleList, true, guide, allPaths, free, slid);
      if (!rigid.connections.some((c) => c.held) || new Kinematics(rigid).freeMotions().length > 0) return rigid;
    }
    return buildMechanism(parts, table, roleList, false, guide, allPaths, free, slid);
  };
  const useKept = kept !== null && !freed.size && FRICTION_RIGID && !allFree;
  let pivots: number[] = useKept ? kept : [];
  if (useKept) freed = new Set(kept);
  let mech = build(new Set());
  // A linear actuator exists to change its length: where its slide can't move at all with the
  // friction pins held, the pins that hold it are real pivots (the 42070's front outrigger
  // arms), and stay joints, stiff ones, as a linkage built on friction pins does when the whole
  // model couldn't move otherwise. Once per reading, with only the friction pins near the
  // actuator freed to find them (see pivotsOfStuckSlides).
  if (!useKept && FRICTION_RIGID && !allFree && mech.connections.some((c) => c.held)) {
    const found = pivotsOfStuckSlides(mech, parts, table, (pins) => buildMechanism(parts, table, roleList, true, new Set(), allPaths, new Set([...freed, ...pins]), slid));
    if (found) {
      pivots = found.pins;
      freed = new Set([...freed, ...found.pins]);
      mech = found.mech ?? build(new Set());
    }
  }
  const guide = racksToGuide(mech);
  return { mech: guide.size ? build(guide) : mech, pivots };
}

// The friction pins that hold a linear actuator's slide still (see inferMechanism), with the
// mechanism built with them freed when that build is already at hand; null if there are none.
// For each actuator slide that no free motion slides, the pins are looked for near it only, as
// a build with every friction pin free costs too much in a large model. Near means: the bodies
// within NEAR joints of either end of the actuator (not through its own slide), and the bodies
// joined to those; each part of them sits in a piece of parts held together without friction
// pins, and the friction pins of those pieces are freed, all at once, and the slide tried in
// that build (see pinsToSlide). The largest piece of a frame is left out, or nearly every pin
// would be freed.
const NEAR = 1;
function pivotsOfStuckSlides(mech: Mechanism, parts: PlacedPart[], table: ConnectionTable, withFreed: (pins: Set<number>) => Mechanism): { pins: number[]; mech: Mechanism | null } | null {
  // Shock absorbers are left out for now: freeing their arms' pins made the drag far slower in
  // the 42039 and the 42125 (decision 103). KINEBRICK_SHOCK_PIVOTS=1 takes them in again, for a trial.
  const shockParts = new Set(SHOCK_PIVOTS ? Object.entries(table.shocks ?? {}).flatMap(([cylinder, list]) => [cylinder, ...list.map((s) => s.rod)]) : []);
  const pistons = new Set((mech.screws ?? []).map((s) => s.piston));
  const slides = mech.joints.filter((j) => j.kind === 'slide' && j.sliding && (pistons.has(j.bodyA) || pistons.has(j.bodyB) || j.sliding.some((p) => shockParts.has(parts[p].name))));
  if (!slides.length) return null;
  const axisOf = (j: Joint) => new Vector3().subVectors(j.to, j.from).normalize();
  const kin = new Kinematics(mech);
  const motions = kin.freeMotions().map((m) => Array.from(m));
  const stuck = slides.filter((j) => !motions.some((m) => Math.abs(kin.pointVelocity(m, j.bodyA, j.from).sub(kin.pointVelocity(m, j.bodyB, j.from)).dot(axisOf(j))) > 1e-6));
  if (!stuck.length) return null;

  // The pieces: each part's piece, by the first part of it (joined through connections that
  // aren't friction pins, within one body), and how many parts each has.
  const pieceOf = parts.map((_, i) => i);
  const find = (i: number): number => (pieceOf[i] === i ? i : (pieceOf[i] = find(pieceOf[i])));
  for (const c of mech.connections) {
    if (c.held || mech.bodyOf[c.male] !== mech.bodyOf[c.female]) continue;
    const [a, b] = [find(c.male), find(c.female)];
    if (a !== b) pieceOf[Math.max(a, b)] = Math.min(a, b);
  }
  const size = new Map<number, number>();
  parts.forEach((_, i) => size.set(find(i), (size.get(find(i)) ?? 0) + 1));
  const frames = new Set(mech.frames ?? [0]);
  const largest = new Map<number, number>();
  parts.forEach((_, i) => {
    const [body, piece] = [mech.bodyOf[i], find(i)];
    if (frames.has(body) && (!largest.has(body) || size.get(piece)! > size.get(largest.get(body)!)!)) largest.set(body, piece);
  });

  // The pieces near each stuck slide, and the friction pins in them.
  const bodies = new Set<number>();
  for (const j of stuck) {
    let front = [j.bodyA, j.bodyB];
    front.forEach((b) => bodies.add(b));
    for (let hop = 0; hop < NEAR; hop++) {
      const next: number[] = [];
      for (const k of mech.joints) {
        if (k === j) continue;
        for (const [from, to] of [[k.bodyA, k.bodyB], [k.bodyB, k.bodyA]]) if (front.includes(from) && !bodies.has(to)) (bodies.add(to), next.push(to));
      }
      front = next;
    }
  }
  const near = new Set<number>();
  for (const c of mech.connections) {
    if (bodies.has(mech.bodyOf[c.male]) || bodies.has(mech.bodyOf[c.female])) (near.add(find(c.male)), near.add(find(c.female)));
  }
  for (const piece of [...near]) if (largest.get(mech.bodyOf[piece]) === piece) near.delete(piece);
  const candidates = new Set<number>();
  for (const c of mech.connections) if (c.held && (near.has(find(c.male)) || near.has(find(c.female)))) candidates.add(c.male);
  if (!candidates.size) return null;

  const tried = withFreed(candidates);
  const pins = new Set<number>();
  for (const j of stuck) for (const pin of pinsToSlide(tried, j.sliding![0], j.sliding![1], j.from, axisOf(j))) pins.add(pin);
  if (!pins.size) return null;
  // The build tried is the one wanted when every pin freed in it is needed.
  return { pins: [...pins].sort((a, b) => a - b), mech: [...candidates].every((p) => pins.has(p)) ? tried : null };
}

// The body a motor turns: its output's axle, through the motor's own connection to it, not the
// first motor joint on its case's body, which is another motor's when two motors' cases sit on
// one body (the 42114's L and XL motors). The case's body if the motor turns nothing.
// The part the viewer keeps turning when a part is spun: for an electric motor (role "motor"), a
// part of its output (see motorOutput), the one its connection names, as the function check works
// a motor, so that the two can't differ (decision 152 of 2026-11-17: the 42114's L motor, spun,
// pushed the body it's built into, and the whole truck went back and forth). Any other part, or a
// motor whose output isn't found (motorOutput gives its own body), is itself.
export function motorRunPart(mech: Mechanism, part: number): number {
  if (mech.roles[part] !== 'motor') return part;
  const out = motorOutput(mech, part);
  if (out === mech.bodyOf[part]) return part;
  const c = mech.connections.find((x) => x.motor && (x.male === part || x.female === part) && mech.bodyOf[x.male] !== mech.bodyOf[x.female]);
  return c ? (c.male === part ? c.female : c.male) : mech.bodies[out].parts[0];
}

export function motorOutput(mech: Mechanism, motor: number): number {
  const c = mech.connections.find((x) => x.motor && (x.male === motor || x.female === motor) && mech.bodyOf[x.male] !== mech.bodyOf[x.female]);
  if (c) return mech.bodyOf[c.male === motor ? c.female : c.male];
  const b = mech.bodyOf[motor];
  const j = mech.joints.find((x) => x.motor && (x.bodyA === b || x.bodyB === b));
  return j ? (j.bodyA === b ? j.bodyB : j.bodyA) : b;
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
// The axles given the role "axle" on 2026-11-15, which the frame is still chosen as if they
// were structure (see frameRoles in buildMechanism).
const AXLES_COUNTED_AS_STRUCTURE = new Set(['3737.dat', '23948.dat', '50450.dat', '50451.dat', '60485.dat', '44294.dat', '24316.dat', '87083.dat', '15462.dat', '55013.dat', '59426.dat', '6587.dat']);

function buildMechanism(parts: PlacedPart[], table: ConnectionTable, roleList: Record<string, string>, frictionRigid: boolean, guide: Set<number>, paths: PlacedPath[], freed: Set<number>, slid = new Set<number>()): Mechanism {
  // A path's parts (a chain's links) only show where it runs: they connect to nothing, and
  // move with what's nearest (see decorations), or round their loop (see findLoops).
  // A printed part (3626bp01, 973p19) has its plain part's role (3626b, 973).
  const plain = (name: string) => name.replace(/(?:p[0-9a-z]+|pb[0-9a-z]+)\.dat$/, '.dat');
  const roles = parts.map((p) => (p.path ? 'path' : roleList[p.name] ?? roleList[plain(p.name)] ?? (table.stickers?.includes(p.name) ? 'decoration' : 'structure')));
  // The roles the frame is chosen by (see groupIntoBodies): these axles count there as the
  // structure they were read as before they were given the role "axle", and the axles that
  // had it already don't. It is not principled: it is there only so that naming an axle does
  // not move a model's frame (the 42099's is a near tie, 132 structure parts against 127),
  // and it goes when the frame rule is mended. A changeover catch counts as structure too, for
  // the same reason: the 6641 was structure before it had a role, and the 8002 builds its shell
  // of ten of them, so the role alone moved its frame.
  const frameRoles = roles.map((r, i) => ((r === 'axle' && AXLES_COUNTED_AS_STRUCTURE.has(plain(parts[i].name).replace(/^.* - /, ''))) || r === 'changeover catch' ? 'structure' : r));
  // A part an erratum removed isn't there: no connection points, and never loose.
  const cyls = worldCylinders(parts, table).filter((c) => roles[c.part] !== 'path' && !parts[c.part].removed);
  // A motor's output, its axle hole or (on the old motors) axle stub, turns in the motor: an axle
  // in it turns, rather than being fixed to the motor and whatever the motor is built into.
  // Before findConnections, which reads it.
  for (const c of cyls) if (roles[c.part] === 'motor' && c.secs.some((s) => s.shape === 'A')) c.turns = true;

  // 1. Connections. First the connection points that fit (fits.ts).
  const connections = findConnections(cyls, frictionRigid, freed);
  connections.push(...throughOutputs(connections));
  // A train track's pieces hold together end to end (nothing else joins them), and the track,
  // the trains' wheels and what's built on them are assemblies of their own, standing apart
  // from each other, never loose (see findLooseParts).
  const rails = findRails(parts, roles);
  connections.push(...railJoins(rails));
  connections.push(...magnetCouplings(parts, roles, cyls, connections));
  const anchors = anchorsOf(roles);
  // Pins and hinges, among the connections found so far.
  // A shock absorber's cylinder or rod (see shockAbsorbers): it swings on its pins.
  const shockNames = new Set(Object.entries(table.shocks ?? {}).flatMap(([cylinder, list]) => [cylinder, ...list.map((s) => s.rod)]));
  fixPins(connections, roles, frictionRigid, freed, new Set(parts.flatMap((p, i) => (shockNames.has(p.name) ? [i] : []))));
  stiffMagnetHinges(connections, roles, frictionRigid, freed);
  slipClutches(connections, roles, frictionRigid, freed);
  // Parts held by more than their connection points say.
  connections.push(...platesOnEdge(cyls));
  connections.push(...onFourStuds(cyls));
  // onTiles and guidedRacks take only parts still loose, so they come after the rules that
  // attach parts; guidedPistons slides a piston against a part it isn't connected to.
  connections.push(...onTiles(roles, cyls, connections));
  connections.push(...inGrooves(parts, cyls, table));
  connections.push(...guidedRacks(parts.length, cyls, connections, guide));
  connections.push(...decorations(parts, roles, cyls));
  connections.push(...guidedPistons(parts, roles, cyls, connections));
  const shocks = shockAbsorbers(parts, table, (name) => libraryName(name, table));
  connections.push(...shocks, ...squareRodsInBores(cyls, shocks));
  // After the slides above: a group hung by one hinge on a slider, kept in line by its guide.
  connections.push(...hungOnSliders(parts.length, frameRoles, cyls, connections));
  // linearActuators, universalJoints and groovedBalls replace connections already found.
  const actuators = linearActuators(parts, connections);
  connections.push(...bushGrips(roles, cyls));
  connections.push(...toothedBushes(roles, cyls));
  const joined = [...universalJoints(parts, roles, cyls, connections), ...groovedBalls(parts, roles, cyls, connections)];
  lockedJoints(parts.length, connections, joined);

  // 2. Loose parts. Second chances first, for parts no rule above attached (looseFits leaves a
  // universal joint's cross the arms universalJoints left it).
  connections.push(...bushesOnFourStuds(roles, cyls, connections));
  connections.push(...onAxleTips(roles, cyls, connections));
  connections.push(...looseFits(roles, cyls, connections, frictionRigid, freed));
  // Loose parts hanging on a string, or hooked to a chain, are held by it; the rest ride along
  // with what's nearest.
  // A second model in the file stands on its own, never loose (see secondModels).
  const figures = figureSubmodels(parts, roles);
  const { models, carried: carriedGroups, accessories, missedJoints } = secondModels(parts, roles, connections, findLooseParts(parts.length, connections, anchors), figures, new Set(cyls.filter((c) => c.secs.some((s) => s.shape === 'T')).map((c) => c.part)), cyls);
  for (const model of models) for (const i of model) anchors.add(i);
  const hanging = hangingParts(parts, connections, findLooseParts(parts.length, connections, anchors), paths);
  const hooked = hookedParts(cyls, connections, findLooseParts(parts.length, connections, anchors), paths);
  const riding = findLooseParts(parts.length, connections, anchors).filter((i) => !hanging.has(i) && !hooked.has(i));
  // On a train layout, what stands on the table beside the track (a platform, with the figures
  // on it) is scenery, not loose: it rides along with the track, never with a train that happens
  // to stand beside it. A few parts on their own are loose as ever, and ride along with what's
  // nearest, as elsewhere.
  // Nor is what a figure holds or stands with (see figureSubmodels).
  const loose = (rails.length ? smallGroups(parts.length, connections, riding) : riding).filter((i) => !figures.has(parts[i].submodel ?? ''));
  const scenery = new Set(riding.filter((i) => !loose.includes(i)));
  const welds = rideAlong(parts, cyls, connections, loose, undefined, carriedGroups);
  connections.push(...welds);
  // A carried model rides along as loose parts do, but isn't loose: where it is welded.
  const carried = carriedGroups.map((group) => {
    const own = new Set(group);
    const weldedTo = [...new Set(welds.flatMap((c) => (own.has(c.male) && !own.has(c.female) ? [c.female] : own.has(c.female) && !own.has(c.male) ? [c.male] : [])))].sort((a, b) => a - b);
    return { parts: group, weldedTo };
  });
  const carriedParts = new Set(carriedGroups.flat());
  for (let i = loose.length - 1; i >= 0; i--) if (carriedParts.has(loose[i])) loose.splice(i, 1);
  if (scenery.size) connections.push(...rideAlong(parts, cyls, connections, [...scenery], new Set(rails.map((r) => r.part))));

  // 3. Bodies, from every connection above: first, a part riding on parallel axles that a
  // linkage slides along them, which two hinges would otherwise hold fast.
  slidingOnParallelAxles(roles, frameRoles, cyls, connections, parts.length);
  // Then the slides asked for (see slidesAsked), for the same reason.
  const asked = slidesAsked(parts.map((p) => p.name), roles, cyls, connections, slid);
  // The links of a track placed link by link (see chainPaths in ldr.ts) were structure, joined to
  // what they lie on, before they were read as a track, and the frame was chosen with them. So that
  // reading the track does not move a model's frame (the 9391 Crawler Crane's would go from its
  // undercarriage, whose structure is mostly its links, to its upper works, whose turntable then
  // can't turn against it), the frame is chosen as it was: from the bodies the model makes with its
  // links read as parts, by a part of it that isn't a link. As for the axles above, it goes when the
  // frame rule is mended.
  let framePart = -1;
  if (parts.some((p) => p.path?.byHand && p.path.halfWidth)) {
    const asParts = parts.map((p) => (p.path?.byHand && p.path.halfWidth ? { ...p, path: undefined } : p));
    const before = buildMechanism(asParts, table, roleList, frictionRigid, guide, paths.filter((p) => !(p.byHand && p.halfWidth)), freed, slid);
    framePart = before.bodyOf.findIndex((b, i) => b === 0 && roles[i] !== 'path' && !parts[i].removed);
  }
  const bodyOf = groupIntoBodies(parts.length, frameRoles, connections, new Set(models.flat()), parts.map((p) => p.matrix.elements[13]), framePart);
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
  const riders = rails.length ? findRiders(treads) : [];
  const gears = findGears(cyls, bodyOf);
  const meshes = findMeshes(gears);
  // After lineUpBalls: dropBallsInBearings and findCouplings find a nudged ball's joint where
  // lineUpBalls has put it.
  dropBallsInBearings(joints, joined, roles, bodyOf);
  const couplings = findCouplings(joined, joints, parts, roles, bodyOf);
  couplings.push(...crankWebs(joints));
  couplings.push(...reductions(parts, table, bodyOf, (name) => libraryName(name, table)));
  const loops = findLoops(parts, roles, bodyOf, joints, table, paths);
  // What's hooked to a chain it can't slide along is loose after all (it rides along with nothing).
  loose.push(...chainHooks(parts, bodyOf, joints, loops, hooked));
  loose.sort((a, b) => a - b);
  // A removed part rides along with what's nearest, as a loose part does, but isn't loose: it isn't there.
  for (let k = loose.length - 1; k >= 0; k--) if (parts[loose[k]].removed) loose.splice(k, 1);
  treads.push(...trackTreads(loops));
  // After chainHooks, as a string reads which parts are loose.
  const strings = findStrings(parts, roles, bodyOf, joints, paths, hanging, loose);
  const screws = [...actuatorScrews(actuators, bodyOf), ...wormRacks(gears)];
  const centers = bodyCenters(bodies, parts);
  const biggest = (model: number[]) => {
    const count = new Map<number, number>();
    for (const i of model) count.set(bodyOf[i], (count.get(bodyOf[i]) ?? 0) + 1);
    return [...count].reduce((a, b) => (b[1] > a[1] ? b : a))[0];
  };
  const frames = [0, ...models.map(biggest)];
  return { roles, bodyOf, bodies, joints, connections, treads, gears, meshes, loose, frames, frameParts: models, carried, accessories, missedJoints, couplings, loops, strings, screws, rests, centers, ...(rails.length ? { rails, riders } : {}), ...(slid.size ? { slid: asked.slid, slideWhy: Object.fromEntries(asked.why) } : {}) };
}
