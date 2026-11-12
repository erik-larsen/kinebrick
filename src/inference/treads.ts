// Treads: what rolls on the ground, tyres and the wheels of a track.

import type { Loop, Tread } from '../mechanism.ts';
import type { WorldCylinder } from './shared.ts';

// A track touches the ground under its wheels, its links reaching `depth` beyond its path: so
// each wheel of a track rolls on the ground like a tyre that reaches as far.
export function trackTreads(loops: Loop[]): Tread[] {
  return loops.flatMap((loop, track) =>
    loop.depth === null
      ? []
      : loop.wheels.map((w) => {
          const point = loop.path.points[w.point];
          return { part: loop.links[0], body: w.body, center: point.center.clone(), axis: point.axis.clone(), radius: point.radius + loop.depth!, track, rollRadius: point.radius };
        }),
  );
}

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
