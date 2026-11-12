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
