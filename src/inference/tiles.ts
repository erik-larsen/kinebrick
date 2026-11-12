// A part held by nothing but smooth tiles under it slides along them.

import { Vector3 } from 'three';
import type { Connection } from '../mechanism.ts';
import { AXIS_TOLERANCE, findLooseParts, isAntiStud, rigidGroups, SURFACE_OVERLAP, type WorldCylinder } from './shared.ts';
import { anchorsOf } from './trains.ts';

// A part held by nothing but smooth tiles under it slides along them: nothing grips a tile
// from above (an official crane's outriggers slide out on tiles). Like a plate on tiles (see
// the corrections), along the tile's length (whatever keeps it in line is taken as read), as
// long as it still overlaps the tile by a stud. A part attached otherwise (a seat on a rack)
// is left to that: a tile lets it slide any way, so a slide along the tile could jam it.
export function onTiles(roles: string[], cyls: WorldCylinder[], connections: Connection[]): Connection[] {
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
