// Trains: a track of rails, the wheels that run on it, and the magnets that couple the cars.

import { Vector3 } from 'three';
import { PlacedPart } from '../ldr.ts';
import type { Connection, Rail, Rider, Tread } from '../mechanism.ts';
import { ANGLE_TOLERANCE, AXIS_TOLERANCE, type WorldCylinder } from './shared.ts';

// How close the ends of two pieces of track must come to join (LDU): half a stud, since a
// layout's pieces are laid by hand and an oval may not quite close.
const RAIL_JOIN = 10;
// A train's wheels are this far apart on their axle, between where they run on the rail heads
// (LDU): LEGO's gauge is 5 studs between the rails' centres, and a hair more.
const GAUGE = 101;
// A monorail's wheels run on its beam's top, 56.5 LDU apart.
const MONORAIL_GAUGE = 56.5;
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
export function findRails(parts: PlacedPart[], roles: string[]): Rail[] {
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
export function railJoins(rails: Rail[]): Connection[] {
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

// Pairs of train wheels on one axle: two treads on one body, on one axis, a gauge apart.
export function findRiders(treads: Tread[], roles: string[]): Rider[] {
  const riders: Rider[] = [];
  const used = new Set<number>();
  treads.forEach((a, i) => {
    if (used.has(i)) return;
    treads.forEach((b, j) => {
      if (j <= i || used.has(j) || a.body !== b.body) return;
      if (new Vector3().crossVectors(a.axis, b.axis).length() > ANGLE_TOLERANCE) return;
      const offset = new Vector3().subVectors(b.center, a.center);
      const along = offset.dot(a.axis);
      // (A monorail's gauge only for train wheels: a lorry's wheels may stand as far apart.)
      const gauges = roles[a.part] === 'train wheel' ? [GAUGE, MONORAIL_GAUGE] : [GAUGE];
      if (Math.min(...gauges.map((g) => Math.abs(Math.abs(along) - g))) > 4 || offset.clone().addScaledVector(a.axis, -along).length() > AXIS_TOLERANCE) return;
      used.add(i).add(j);
      riders.push({ body: a.body, center: a.center.clone().lerp(b.center, 0.5), axis: a.axis.clone(), rolls: !a.fixed && !b.fixed });
    });
  });
  return riders;
}

// On a layout: a group that would be scenery but stands on a train (a car on a car transporter,
// a pallet on a wagon) is the train's load, and rides with it. It stands on a train if the
// connection point nearest its lowest part, of those no higher than it, is a train's: of a part
// joined, other than through the rails, to a train's wheels or motor. And at most LOAD_REACH
// from it (a car's chassis stands on its wheels, 31 LDU above the wagon's deck in 167). Such
// groups are taken out of `riding`, the groups to look at. A train's wheels don't count: they
// turn, and what stands beside them (a signalman by the track) is no load.
const LOAD_REACH = 40;
export function loads(parts: PlacedPart[], roles: string[], cyls: WorldCylinder[], connections: Connection[], riding: Set<number>): Connection[] {
  const joined = parts.map((_, i) => i);
  const top = (i: number): number => (joined[i] === i ? i : (joined[i] = top(joined[i])));
  for (const c of connections) if (roles[c.male] !== 'rail' && roles[c.female] !== 'rail') joined[top(c.male)] = top(c.female);
  const trains = new Set(parts.flatMap((_, i) => (['train wheel', 'train motor'].includes(roles[i]) ? [top(i)] : [])));
  const leader = new Map([...riding].map((i) => [i, i]));
  const find = (i: number): number => {
    while (leader.get(i) !== i) i = leader.get(i)!;
    return i;
  };
  for (const c of connections) if (riding.has(c.male) && riding.has(c.female)) leader.set(find(c.male), find(c.female));
  // Each group's lowest part (the greatest y, as y points down).
  const lowest = new Map<number, number>();
  for (const i of riding) if (!lowest.has(find(i)) || parts[i].matrix.elements[13] > parts[lowest.get(find(i))!].matrix.elements[13]) lowest.set(find(i), i);
  const result: Connection[] = [];
  for (const [group, low] of lowest) {
    const at = new Vector3().setFromMatrixPosition(parts[low].matrix);
    let nearest: WorldCylinder | null = null;
    for (const c of cyls) if (!riding.has(c.part) && roles[c.part] !== 'train wheel' && c.start.y >= at.y - 1 && (!nearest || c.start.distanceTo(at) < nearest.start.distanceTo(at))) nearest = c;
    if (!nearest || !trains.has(top(nearest.part)) || nearest.start.distanceTo(at) > LOAD_REACH) continue;
    result.push({ male: low, female: nearest.part, kind: 'rigid', from: at, to: at.clone() });
    for (const i of [...riding]) if (find(i) === group) riding.delete(i);
  }
  return result;
}

// Of the parts that ride along, those in groups smaller than SCENERY: the loose ones.
// A group whose every part stands higher than this above the rail heads (a locomotive's
// pantograph, on its roof) stands on no table or platform: it's loose, not scenery.
export const ABOVE_RAILS = 100;

// On a layout (`above` given): a group of a train's own submodel (`trains`: those holding train
// wheels; a car's buffer beams, the file places off it) is loose too, and rides with its car.
export function smallGroups(count: number, connections: Connection[], riding: number[], above?: number, parts?: PlacedPart[], trains?: Set<string>): number[] {
  const isRiding = new Set(riding);
  const leader = Array.from({ length: count }, (_, i) => i);
  const find = (i: number): number => {
    while (leader[i] !== i) i = leader[i];
    return i;
  };
  for (const c of connections) if (isRiding.has(c.male) && isRiding.has(c.female)) leader[find(c.male)] = find(c.female);
  const sizes = new Map<number, number>();
  for (const i of riding) sizes.set(find(i), (sizes.get(find(i)) ?? 0) + 1);
  // Each group's lowest part (the greatest y, as y points down).
  const lowest = new Map<number, number>();
  if (above !== undefined && parts) for (const i of riding) lowest.set(find(i), Math.max(lowest.get(find(i)) ?? -Infinity, parts[i].matrix.elements[13]));
  const ofTrain = new Set(riding.filter((i) => parts && trains?.has(parts[i].submodel ?? '')).map(find));
  return riding.filter((i) => sizes.get(find(i))! < SCENERY || (above !== undefined && lowest.get(find(i))! < above) || ofTrain.has(find(i)));
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
export function magnetCouplings(parts: PlacedPart[], roles: string[], cyls: WorldCylinder[], connections: Connection[]): Connection[] {
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
      // A magnet that is its own holder (the older train bases', 735) has its own swivel fixed.
      if (holder === undefined || at(holder).distanceTo(at(a.part)) >= 60) for (const c of connections) if (c.kind === 'revolute' && (c.male === a.part || c.female === a.part) && roles[c.male] !== roles[c.female]) c.kind = 'rigid';
    }
  }
  return couplings;
}

// A train coupling's magnet casing clicks onto its holder's hinge fingers and swings on them,
// stiffly, as a friction pin turns: held, unless nothing else can move. Free, the two casings
// of a coupling would swing as the magnets met, and the cars behind them lurch.
export function stiffMagnetHinges(connections: Connection[], roles: string[], frictionRigid: boolean) {
  for (const c of connections) {
    if (c.kind !== 'revolute' || !((roles[c.male] === 'coupling' && roles[c.female] === 'magnet') || (roles[c.male] === 'magnet' && roles[c.female] === 'coupling'))) continue;
    if (frictionRigid) [c.kind, c.held] = ['rigid', true];
    else c.stiff = true;
  }
}
