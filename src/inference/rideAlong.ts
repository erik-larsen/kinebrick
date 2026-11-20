// Parts that move with what's nearest them: decorations, and loose parts riding along.

import { Vector3 } from 'three';
import { PlacedPart } from '../ldr.ts';
import type { Connection, ConnectionKind } from '../mechanism.ts';
import type { WorldCylinder } from './shared.ts';

// Decoration: parts that are there for looks and connect to nothing in a way that matters,
// such as stickers and the old pneumatic hoses models use for exhausts and cables. Each moves
// with the part whose connection point (stud, hole, axle) is nearest to it.
export function decorations(parts: PlacedPart[], roles: string[], cyls: WorldCylinder[], connections: Connection[]): Connection[] {
  const isDecoration = (i: number) => roles[i] === 'decoration' || roles[i] === 'path' || roles[i] === 'figure';
  // Not a train's wheels, which turn: a figure standing by the track beside them stays put.
  const anchors = cyls.filter((c) => !isDecoration(c.part) && roles[c.part] !== 'train wheel');
  const nearestTo = (at: Vector3) => {
    let nearest: WorldCylinder | null = null;
    for (const c of anchors) if (!nearest || c.start.distanceTo(at) < nearest.start.distanceTo(at)) nearest = c;
    return nearest;
  };
  // On a train layout, a figure is fixed as one, to what its lowest piece (its feet) is nearest:
  // a figure standing on the track beside a train joins neither to the other. Its pieces are
  // those joined to each other, or in one submodel and within 40 LDU of each other (arms and
  // hands, posed by hand, may not sit in their sockets).
  const layout = roles.includes('rail');
  const lead = parts.map((_, i) => i);
  const find = (i: number): number => (lead[i] === i ? i : (lead[i] = find(lead[i])));
  if (layout) {
    for (const c of connections) if (roles[c.male] === 'figure' && roles[c.female] === 'figure') lead[find(c.male)] = find(c.female);
    const figures = parts.flatMap((p, i) => (roles[i] === 'figure' ? [i] : []));
    const at = (i: number) => new Vector3().setFromMatrixPosition(parts[i].matrix);
    for (const a of figures) for (const b of figures) if (a < b && parts[a].submodel === parts[b].submodel && at(a).distanceTo(at(b)) < 40) lead[find(a)] = find(b);
  }
  const lowest = new Map<number, number>();
  parts.forEach((p, i) => {
    if (!layout || roles[i] !== 'figure') return;
    const was = lowest.get(find(i));
    if (was === undefined || p.matrix.elements[13] > parts[was].matrix.elements[13]) lowest.set(find(i), i);
  });
  // A figure already joined to something (its feet on a cab floor's studs) is held by that, all
  // of it: its other pieces are fixed to the piece that is (legs on a seat take the hips on pins,
  // which join nothing, and the rest would stand as a loose group of its own).
  const held = new Map<number, number>();
  if (layout) for (const c of connections) if ((roles[c.male] === 'figure') !== (roles[c.female] === 'figure')) held.set(find(roles[c.male] === 'figure' ? c.male : c.female), roles[c.male] === 'figure' ? c.male : c.female);
  const result: Connection[] = [];
  parts.forEach((p, i) => {
    const holder = roles[i] === 'figure' ? held.get(find(i)) : undefined;
    if (holder !== undefined && holder !== i) {
      const at = new Vector3().setFromMatrixPosition(p.matrix);
      result.push({ male: i, female: holder, kind: 'rigid', from: at, to: at.clone() });
    }
    if (!isDecoration(i) || holder !== undefined) return;
    const at = new Vector3().setFromMatrixPosition(p.matrix);
    const feet = lowest.get(find(i));
    const nearest = nearestTo(feet === undefined ? at : new Vector3().setFromMatrixPosition(parts[feet].matrix));
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
export function rideAlong(parts: PlacedPart[], cyls: WorldCylinder[], connections: Connection[], loose: number[], among?: Set<number>, carried: number[][] = []): Connection[] {
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
  // `ofAnotherModel`: the anchors are another second model's parts, which count as another
  // submodel's even where they are a copy of the same one: two containers of one design are two
  // things (the 42062 Container Yard's, the one standing apart rode on the one held in the
  // spreader, as a part "of its own submodel").
  const offer = (anchorCyls: WorldCylinder[], ofAnotherModel = false) => {
    for (const [g, members] of groups) {
      for (const i of members) {
        for (const c of anchorCyls) {
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
  offer(cyls.filter((c) => !isLoose.has(c.part) && (!among || among.has(c.part))));
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
