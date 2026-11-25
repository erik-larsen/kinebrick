// Treads: what rolls on the ground, tyres and the wheels of a track.

import { Vector3 } from 'three';
import { linkKind, type PlacedPart } from '../ldr.ts';
import type { Joint, Loop, Tread } from '../mechanism.ts';
import { stepsFromFrame } from './loops.ts';
import type { WorldCylinder } from './shared.ts';

// A track touches the ground under its wheels, its links reaching `depth` beyond its path: so
// each wheel of a track rolls on the ground like a tyre that reaches as far. How far below its
// axle the track runs is read from the links themselves where they pass under it (their pins, as
// built: LDraw's y is down), where they do, and not from the circle the path fits round the
// wheel: that circle is how far the track moves for a radian of the wheel (its roll radius), and
// where the links leave a wheel along a slant before they wrap it, as placed by hand, it reaches
// further down than the run does (the 42021 Snowmobile's rear wheel by 1.84 LDU, which held its
// front wheel off the ground, and the 42038 Arctic Truck's, by 1.5 LDU, so that it stood on two of
// its twelve, though there the file's own path puts the track 1.5 LDU lower under one wheel than
// the other). Only a run within half a pitch of the circle is read so: a wheel the track only
// passes over, far above its lower run, keeps its circle.
//
// And a track stands on the ground at both ends of its run along the ground, read from its links
// too: the run is the links' pins as low as the lowest, to within GROUND_TOLERANCE (LDraw's y
// down), as the ground's contacts are, its ends the
// first and last of them along the way the track runs. Under its wheels alone, a track unit whose
// wheels are all far above its run, or whose run reaches beyond them, stood on one wheel or on none
// that touched: the 42069 Extreme Adventure's one wheel in each track is the sprocket at the top
// of a triangle, 108 LDU above the run, so the track stood on that wheel's circle, 52 LDU above
// where it touches, and on nothing else, and the unit, free to pitch about the wheel's axle,
// dipped its nose under the ground when steered. Each end is carried by what holds the path's
// round part nearest it (a wheel's mount, an idler's), and rolls as the track's wheel drives the
// run (see Tread.roll).
export function trackTreads(loops: Loop[], parts: PlacedPart[] = [], joints: Joint[] = []): Tread[] {
  const steps = stepsFromFrame(joints);
  return loops.flatMap((loop, track) => {
    if (loop.depth === null) return [];
    const pins = loop.links.flatMap((i) => {
      const kind = parts[i] && linkKind(parts[i].name);
      return kind ? [kind.pin.clone().applyMatrix4(parts[i].matrix)] : [];
    });
    const first = parts[loop.links[0]] && linkKind(parts[loop.links[0]].name);
    const pitch = loop.path.pitch ?? first?.pin.length() ?? 16;
    const wheels: Tread[] = loop.wheels.map((w) => {
      const point = loop.path.points[w.point];
      const run = runBelow(pins, point.center, point.axis, pitch);
      const reach = run !== null && Math.abs(run - point.radius) < pitch / 2 ? run : point.radius;
      return { part: loop.links[0], body: w.body, center: point.center.clone(), axis: point.axis.clone(), radius: reach + loop.depth!, track, rollRadius: point.radius };
    });
    return [...wheels, ...runEnds(loop, pins, joints, steps).map((end) => ({ ...end, part: loop.links[0], track }))];
  });
}

// The two ends of a track's run along the ground (see trackTreads), each as a tread: a circle as
// deep as the links reach, round the end's pin, on what holds the path's round part nearest it
// (a wheel's mount, or an idler's), rolling as the track's first wheel drives it. A point of the
// path that nothing turns on through its middle (an arc the path makes between them) isn't a round
// part. None for a track with no wheel, or no pins.
function runEnds(loop: Loop, pins: Vector3[], joints: Joint[], steps: number[]): Omit<Tread, 'part' | 'track'>[] {
  if (loop.wheels.length === 0 || pins.length === 0) return [];
  const drive = loop.wheels[0];
  const drivePoint = loop.path.points[drive.point];
  const axis = drivePoint.axis.clone().normalize();
  const forward = new Vector3().crossVectors(DOWN_Y, axis);
  if (forward.length() < 0.5) return [];
  forward.normalize();
  const lowest = Math.max(...pins.map((p) => p.y));
  const run = pins.filter((p) => p.y > lowest - GROUND_TOLERANCE);
  const along = run.map((p) => p.dot(forward));
  const ends = [run[along.indexOf(Math.min(...along))], run[along.indexOf(Math.max(...along))]];
  // Each round part's holder, by its point: its wheel's mount, or what an idler turns in. A point
  // carried by one of the track's wheels that isn't its own is an arc the path makes beside that
  // wheel (the 42069's run, drawn round a circle 109 LDU across under its sprocket), not a part.
  const wheelBodies = loop.wheels.map((w) => w.body);
  const holders = loop.path.points.map((point, i) => {
    const w = loop.wheels.find((w) => w.point === i);
    if (w) return w.mount;
    return wheelBodies.includes(loop.carriers[i]) ? null : mountOf(loop.carriers[i], point.center, point.axis, point.radius, joints, steps);
  });
  return ends.flatMap((pin, k) => {
    if (k === 1 && pin === ends[0]) return [];
    let best = -1;
    loop.path.points.forEach((point, i) => {
      const off = (q: typeof point) => Math.abs(pin.distanceTo(q.center) - q.radius);
      if (holders[i] !== null && (best < 0 || off(point) < off(loop.path.points[best]))) best = i;
    });
    if (best < 0) return [];
    return [{ body: holders[best]!, center: pin.clone(), axis: axis.clone(), radius: loop.depth!, roll: { body: drive.body, center: drivePoint.center.clone(), radius: drivePoint.radius } }];
  });
}

// What a body turns in about a circle (an idler a track runs round): of its turning joints along
// the circle's axis, within its radius of its middle (a path placed by hand is often a few LDU off
// the idler's axle: the 42069's, 4.4), the other body nearest the frame, as findWheel takes a
// wheel's mount; or null where none is.
function mountOf(body: number, center: Vector3, axis: Vector3, radius: number, joints: Joint[], steps: number[]): number | null {
  let mount: number | null = null;
  for (const j of joints) {
    if (j.kind !== 'revolute' || (j.bodyA !== body && j.bodyB !== body)) continue;
    const d = new Vector3().subVectors(j.to, j.from).normalize();
    if (Math.abs(Math.abs(d.dot(axis)) - 1) > 0.01) continue;
    const off = new Vector3().subVectors(center, j.from);
    if (off.addScaledVector(d, -off.dot(d)).length() > radius) continue;
    const other = j.bodyA === body ? j.bodyB : j.bodyA;
    if (mount === null || (steps[other] ?? Infinity) < (steps[mount] ?? Infinity)) mount = other;
  }
  return mount;
}

// How far below `center` (LDraw's y down, across `axis`) the track reaches near it: its lowest pin
// within a pitch either way of the point straight below, or null if none is.
function runBelow(pins: Vector3[], center: Vector3, axis: Vector3, pitch: number): number | null {
  const forward = new Vector3().crossVectors(DOWN_Y, axis);
  if (forward.length() < 0.5) return null;
  forward.normalize();
  const down = new Vector3().crossVectors(axis, forward).normalize();
  if (down.y < 0) down.negate();
  let lowest: number | null = null;
  for (const p of pins) {
    const d = p.clone().sub(center);
    const v = d.dot(down);
    if (v > 0 && Math.abs(d.dot(forward)) <= pitch && (lowest === null || v > lowest)) lowest = v;
  }
  return lowest;
}

const DOWN_Y = new Vector3(0, 1, 0);

// How close a tyre must be to the ground to count as touching it, in LDU. Models are often
// built half an LDU out (an official tractor's front tyres sit half an LDU above its rear ones).
// A track's run along the ground is its pins within this of the lowest (see runEnds).
export const GROUND_TOLERANCE = 1;

export function findTreads(cyls: WorldCylinder[], bodyOf: number[], roles: string[]): Tread[] {
  const treads: Tread[] = [];
  for (const c of cyls) {
    const sec = c.secs[0];
    if (c.secs.length !== 1 || sec.shape !== 'W') continue;
    const center = c.start.clone().addScaledVector(c.dir, sec.length / 2);
    treads.push({ part: c.part, body: bodyOf[c.part], center, axis: c.dir.clone(), radius: sec.radius, ...(roles[c.part] === 'train motor' ? { fixed: true } : {}) });
  }
  return treads;
}
