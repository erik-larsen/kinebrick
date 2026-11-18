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
//
// A group may ride on another loose group, as a container stands on a trailer that is itself a
// second model (the 42078 Mack Anthem's; it rode with the tractor, 290 LDU away, the trailer
// under it being loose too). So the groups are welded outward from the parts that aren't loose:
// at each turn the group whose nearest anchor is the nearest of all is welded to it, and its
// parts become anchors for the groups after it. Each group rides on what it stands on once
// that is itself carried, and no two groups ride on each other.
export function rideAlong(parts: PlacedPart[], cyls: WorldCylinder[], connections: Connection[], loose: number[], among?: Set<number>): Connection[] {
  if (loose.length === 0) return [];
  const isLoose = new Set(loose);
  const leader = new Map(loose.map((i) => [i, i]));
  const find = (i: number): number => {
    while (leader.get(i) !== i) i = leader.get(i)!;
    return i;
  };
  for (const c of connections) if (isLoose.has(c.male) && isLoose.has(c.female)) leader.set(find(c.male), find(c.female));
  const groups = new Map<number, number[]>();
  for (const i of loose) groups.set(find(i), [...(groups.get(find(i)) ?? []), i]);
  const at = new Map(loose.map((i) => [i, new Vector3().setFromMatrixPosition(parts[i].matrix)]));
  // Each remaining group's nearest anchor so far; only the parts given (`among`), if any, are
  // anchors at first: scenery rides with a train track's rails.
  type Best = { part: number; anchor: number; distance: number };
  const best = new Map<number, Best>();
  const offer = (anchorCyls: WorldCylinder[]) => {
    for (const [g, members] of groups) {
      for (const i of members) {
        for (const c of anchorCyls) {
          // Another submodel's part counts as much further away.
          const distance = c.start.distanceTo(at.get(i)!) + (parts[c.part].submodel === parts[i].submodel ? 0 : 1e6);
          const b = best.get(g);
          if (!b || distance < b.distance) best.set(g, { part: i, anchor: c.part, distance });
        }
      }
    }
  };
  const cylsOf = new Map<number, WorldCylinder[]>();
  for (const c of cyls) if (isLoose.has(c.part)) cylsOf.set(c.part, [...(cylsOf.get(c.part) ?? []), c]);
  offer(cyls.filter((c) => !isLoose.has(c.part) && (!among || among.has(c.part))));
  const welds: Connection[] = [];
  while (groups.size) {
    let next: number | null = null;
    for (const [g, b] of best) if (groups.has(g) && (next === null || b.distance < best.get(next)!.distance)) next = g;
    if (next === null) break; // no anchor at all
    const { part, anchor } = best.get(next)!;
    const members = groups.get(next)!;
    groups.delete(next);
    best.delete(next);
    welds.push({ male: part, female: anchor, kind: 'rigid' as ConnectionKind, from: at.get(part)!.clone(), to: at.get(part)!.clone() });
    // Its parts are anchors now for the groups still loose.
    offer(members.flatMap((i) => cylsOf.get(i) ?? []));
  }
  return welds;
}

// The submodels that are a figure's own: what a figure holds or stands with (a porter's hand
// truck and suitcase, in the figure's own submodel, one that's mostly figure parts) is posed by
// hand, as the figure is, so it isn't loose.
export function figureSubmodels(parts: PlacedPart[], roles: string[]): Set<string> {
  const bySubmodel = new Map<string, { parts: number; figure: number }>();
  parts.forEach((p, i) => {
    if (!p.submodel) return;
    const n = bySubmodel.get(p.submodel) ?? { parts: 0, figure: 0 };
    n.parts++;
    if (roles[i] === 'figure') n.figure++;
    bySubmodel.set(p.submodel, n);
  });
  return new Set([...bySubmodel].filter(([, n]) => n.figure * 2 >= n.parts).map(([sub]) => sub));
}
