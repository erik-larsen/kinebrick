// Parts that move with what's nearest them: decorations, and loose parts riding along.

import { Vector3 } from 'three';
import { PlacedPart } from '../ldr.ts';
import type { Connection, ConnectionKind } from '../mechanism.ts';
import type { WorldCylinder } from './shared.ts';

// Decoration: parts that are there for looks and connect to nothing in a way that matters,
// such as stickers and the old pneumatic hoses models use for exhausts and cables. Each moves
// with the part whose connection point (stud, hole, axle) is nearest to it.
export function decorations(parts: PlacedPart[], roles: string[], cyls: WorldCylinder[]): Connection[] {
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

// Step 5: parts outside the largest group of parts that are attached to each other.
// Loose parts ride along with the part nearest to them: each group of loose parts attached to
// each other is fixed to the part whose connection point (stud, hole, axle) is nearest one of
// them, preferring a part of the same submodel (a bucket's plates ride with the bucket, not
// with a lever arm that happens to pass close by). They're still listed as loose, but the model can move: left where they were, they'd
// stand in the way of everything moving past them (an official bulldozer's bucket plates,
// which slot into grooves no connection data describes, stopped its tracks).
export function rideAlong(parts: PlacedPart[], cyls: WorldCylinder[], connections: Connection[], loose: number[], among?: Set<number>): Connection[] {
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
