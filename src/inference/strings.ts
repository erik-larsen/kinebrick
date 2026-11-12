// Strings: a crane's rope wound on a drum, over pulleys, and what hangs on it.

import { Vector3 } from 'three';
import { PathPoint, PlacedPart, PlacedPath } from '../ldr.ts';
import type { Connection, Joint, LoopWheel, StringLine } from '../mechanism.ts';
import { findWheel } from './loops.ts';

// How far beyond a string's circle the middle of the part it goes round may be, in LDU (see
// findStrings): LSynth runs a crane's rope round the edge of a cross block 12 LDU from its middle.
const GUIDE_REACH = 15;

// A string (a path that isn't looped, as LDCad draws a crane's rope): wound on a drum at its
// start, if its first point is a circle on a wheel; over the pulleys after that (its other
// circles on wheels, in order; any other point it passes is left out); and tied at its last
// point to the part nearest there. Its circles on no wheel are guides it slides over, if
// something is there to go round. A pulley whose parts are attached to nothing else (a
// crane's hook block) hangs on the string: its `hook`. So do parts attached to nothing else
// tied to its end (a hook on a single rope, as LSynth draws a crane's), if no pulley hangs on
// it. A string that goes round no wheel at all moves nothing, and is left out.
export function findStrings(parts: PlacedPart[], roles: string[], bodyOf: number[], joints: Joint[], paths: PlacedPath[], hanging: Set<number>, loose: number[]): StringLine[] {
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
export function hangingParts(parts: PlacedPart[], connections: Connection[], loose: number[], paths: PlacedPath[]): Set<number> {
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
