// Treads: what rolls on the ground, tyres and the wheels of a track.

import { Vector3 } from 'three';
import { linkKind, type PlacedPart } from '../ldr.ts';
import type { Loop, Tread } from '../mechanism.ts';
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
export function trackTreads(loops: Loop[], parts: PlacedPart[] = []): Tread[] {
  return loops.flatMap((loop, track) => {
    if (loop.depth === null) return [];
    const pins = loop.links.flatMap((i) => {
      const kind = parts[i] && linkKind(parts[i].name);
      return kind ? [kind.pin.clone().applyMatrix4(parts[i].matrix)] : [];
    });
    const first = parts[loop.links[0]] && linkKind(parts[loop.links[0]].name);
    const pitch = loop.path.pitch ?? first?.pin.length() ?? 16;
    return loop.wheels.map((w) => {
      const point = loop.path.points[w.point];
      const run = runBelow(pins, point.center, point.axis, pitch);
      const reach = run !== null && Math.abs(run - point.radius) < pitch / 2 ? run : point.radius;
      return { part: loop.links[0], body: w.body, center: point.center.clone(), axis: point.axis.clone(), radius: reach + loop.depth!, track, rollRadius: point.radius };
    });
  });
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
