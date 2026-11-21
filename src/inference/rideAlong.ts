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
// A second model in the file (see secondModels) may ride on another, as a container stands on a
// trailer that is itself a second model (the 42078 Mack Anthem's; it rode with the tractor,
// 290 LDU away, the trailer under it being loose too). So the second models (`carried`) are
// welded outward from the parts that aren't loose: at each turn the one whose nearest anchor is
// the nearest of all is welded to it, and its parts become anchors for those after it. Each
// rides on what it stands on once that is itself carried, and no two ride on each other.
//
// Every other loose group, and every single loose part, rides as before, on the parts that
// aren't loose only, and after the second models, so it is never an anchor for one. A second
// model is a model in its own right that the file's author placed on or beside another, so what
// it stands on is known to be a thing that carries; a loose group inside one model is most often
// a reading gap, and what it should ride on is that gap's question. (Letting loose groups of
// more than one part ride on each other changed the bodies of 19 sets, and letting single loose
// parts do so too, 33, the 9391's frame among them: see the branch's history,
// claude/ride-on-loose df978eec and adc91b2f.)
//
// A group that touches, as built, parts that aren't loose (`touches`, each loose part's, see
// touchingFrom in collisions.ts) rides on one of those, the one whose connection point is nearest,
// or, if none of them has one, whose origin is (decision 259 of 2026-11-20: the 9397's battery
// box lid touches only the box, but rode on the steering shaft, whose axle passes 23 LDU from the
// lid's origin). That holds only where the parts it touches are all of one body (`bodyOf`, the
// bodies as the connections found before the welds make them): it rides with that body. A group
// that touches parts of several bodies, or none, rides as above (the 42084's carried model touched
// a gear of its hook arm's drive as well as the bed, and rode on the gear; the 42069's hoses lie
// between door and frame).
export function rideAlong(parts: PlacedPart[], cyls: WorldCylinder[], connections: Connection[], loose: number[], among?: Set<number>, carried: number[][] = [], touches: Map<number, number[]> | null = null, bodyOf: number[] | null = null): Connection[] {
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
  // Each group's parts that aren't loose it touches, if any and all of one body: it rides on one of them alone.
  const touchedOf = new Map<number, Set<number>>();
  if (touches) {
    for (const [g, members] of groups) {
      const touched = new Set(members.flatMap((i) => (touches.get(i) ?? []).filter((p) => !isLoose.has(p) && (!among || among.has(p)))));
      if (touched.size && (!bodyOf || new Set([...touched].map((p) => bodyOf[p])).size === 1)) touchedOf.set(g, touched);
    }
  }
  // A point an anchor offers: a connection point's start, or (`own`) the origin of a touched part
  // that has none, offered only to the groups that touch it.
  type Point = { part: number; start: Vector3; own?: boolean };
  // `ofAnotherModel`: the anchors are another second model's parts, which count as another
  // submodel's even where they are a copy of the same one: two containers of one design are two
  // things (the 42062 Container Yard's, the one standing apart rode on the one held in the
  // spreader, as a part "of its own submodel").
  const offer = (anchorCyls: Point[], ofAnotherModel = false) => {
    for (const [g, members] of groups) {
      const touched = touchedOf.get(g);
      for (const i of members) {
        for (const c of anchorCyls) {
          if (touched ? !touched.has(c.part) : c.own) continue;
          // Another submodel's part counts as much further away.
          const distance = c.start.distanceTo(at.get(i)!) + (!ofAnotherModel && parts[c.part].submodel === parts[i].submodel ? 0 : 1e6);
          const b = best.get(g);
          if (!b || distance < b.distance) best.set(g, { part: i, anchor: c.part, distance });
        }
      }
    }
  };
  const cylsOf = new Map<number, WorldCylinder[]>();
  for (const c of cyls) if (isLoose.has(c.part)) cylsOf.set(c.part, [...(cylsOf.get(c.part) ?? []), c]);
  const withPoints = new Set(cyls.map((c) => c.part));
  const ownPoints = [...new Set([...touchedOf.values()].flatMap((t) => [...t]))].filter((p) => !withPoints.has(p)).map((p) => ({ part: p, start: new Vector3().setFromMatrixPosition(parts[p].matrix), own: true }));
  offer([...cyls.filter((c) => !isLoose.has(c.part) && (!among || among.has(c.part))), ...ownPoints]);
  // The other groups' nearest anchor is fixed now: they ride on the parts that aren't loose.
  const ofSecondModel = new Set(carried.flat());
  const singles = [...groups].filter(([, members]) => !members.some((i) => ofSecondModel.has(i))).map(([g]) => g);
  const fixed = new Map(singles.flatMap((g) => (best.has(g) ? [[g, best.get(g)!] as const] : [])));
  for (const g of singles) groups.delete(g);
  const welds: Connection[] = [];
  const weld = ({ part, anchor }: Best) => welds.push({ male: part, female: anchor, kind: 'rigid' as ConnectionKind, from: at.get(part)!.clone(), to: at.get(part)!.clone() });
  while (groups.size) {
    let next: number | null = null;
    for (const [g, b] of best) if (groups.has(g) && (next === null || b.distance < best.get(next)!.distance)) next = g;
    if (next === null) break; // no anchor at all
    const members = groups.get(next)!;
    weld(best.get(next)!);
    groups.delete(next);
    best.delete(next);
    // Its parts are anchors now for the groups still loose.
    offer(members.flatMap((i) => cylsOf.get(i) ?? []), true);
  }
  for (const b of fixed.values()) weld(b);
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
