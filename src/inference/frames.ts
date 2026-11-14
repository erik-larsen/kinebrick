// More than one model in a file: a set's second vehicle (the 42055's mine truck beside its
// excavator), or a user's file with several models in it. Each stands on its own, with a frame
// of its own, rather than riding along with the first.

import { Vector3 } from 'three';
import { PlacedPart } from '../ldr.ts';
import type { Connection } from '../mechanism.ts';
import { rigidGroups } from './shared.ts';

// How many parts a second model has at least, and how much of it lies under one submodel of its
// own, in a file that has submodels.
const MODEL_PARTS = 20;
const UNDER_ONE = 0.9;
// How near a part of one group comes to a part of another, origin to origin, for the two to
// touch: a stud's width and a little.
const TOUCHING = 30;
// How far above the main model's lowest part a second model's lowest part may be and still stand
// on the ground beside it, in LDU: two bricks, since part origins sit at different heights in a
// part (the 42055's mine truck's lowest origin, a wheel's axle, is 27 above the excavator's; the
// 42076's truck on the hovercraft's deck is 115 above).
const ON_THE_GROUND = 48;

// What the groups of parts not attached to the largest group are:
// - `models`: second models, each standing on its own. A group is one if it has
//   1. in a file with submodels, 90% or more of its parts under one submodel of its own: the
//      outermost submodel each part is in that isn't the main model's (the 42055's
//      minetruck.ldr); a flat file has no such test,
//   2. 20 parts or more,
//   3. a joint or a tyre of its own: something of its own that moves, so a heap of loose bricks
//      (the 42055's randombricks.ldr) or a load with no joints stays loose,
//   4. no part touching the main model: it stands apart,
//   5. its feet on the ground: its lowest part no more than two bricks above the main model's, and
//   6. a wheel of its own (a rim or a tyre): a vehicle.
// - `accessories`: groups that meet 1 to 5 but have no tyre: a thing that stands apart, not a
//   vehicle (the 42082's house, a building of panel walls). They ride along, loose, as today.
// - `carried`: groups that meet 1 to 3 but touch the main model, or stand off the ground: a model
//   carried on it (the 42060's excavator on its trailer, the 42076's truck on its deck), or hitched
//   to it by a connection the reading misses (the 42078's semitrailer). Each stays welded to the
//   main model where it rests, as loose parts are, but isn't loose: its own functions are judged on
//   what they do.
// What meets none of these (under 20 parts, or nothing of its own that moves: a container, a heap
// of bricks) is a load, loose, riding along.
// A group with a figure's parts in it is a figure's, never a model or a load (see figureSubmodels).
// `tyres`: the parts of a wheel, by their data: a rim's or a tyre's half of a tyre's seat.
export function secondModels(parts: PlacedPart[], roles: string[], connections: Connection[], loose: number[], figures: Set<string>, tyres: Set<number>): { models: number[][]; carried: number[][]; accessories: number[][] } {
  const isLoose = new Set(loose);
  const leader = Array.from({ length: parts.length }, (_, i) => i);
  const find = (i: number): number => (leader[i] === i ? i : (leader[i] = find(leader[i])));
  for (const c of connections) if (isLoose.has(c.male) && isLoose.has(c.female)) leader[find(c.male)] = find(c.female);
  const groups = new Map<number, number[]>();
  for (const i of loose) groups.set(find(i), [...(groups.get(find(i)) ?? []), i]);
  const rigid = rigidGroups(parts.length, connections);
  const hasSubmodels = parts.some((p) => p.within !== undefined);
  const main = parts.flatMap((_, i) => (isLoose.has(i) ? [] : [i]));
  // The submodels that are the main model's: those with at least half their parts (with their
  // submodels') in the main group. Not every one with a part of it: a second model's tracks lying
  // on a trailer's bed (the 42060's excavator) join a few of its links to it.
  const inSubmodel = new Map<string, number>();
  const ofMain = new Map<string, number>();
  parts.forEach((p, i) => {
    for (const s of p.within ?? []) {
      inSubmodel.set(s, (inSubmodel.get(s) ?? 0) + 1);
      if (!isLoose.has(i)) ofMain.set(s, (ofMain.get(s) ?? 0) + 1);
    }
  });
  const mainSubmodels = new Set([...inSubmodel].filter(([s, n]) => 2 * (ofMain.get(s) ?? 0) >= n).map(([s]) => s));
  // The outermost submodel a part is in that isn't the main model's, or '' if none.
  const ownSubmodel = (i: number) => (parts[i].within ?? []).find((s) => !mainSubmodels.has(s)) ?? '';
  const at = (i: number) => new Vector3().setFromMatrixPosition(parts[i].matrix);
  const mainAt = main.map(at);
  // LDraw's y points down: the lowest part has the greatest y.
  const mainLowest = Math.max(...mainAt.map((p) => p.y));
  const models: number[][] = [];
  const carried: number[][] = [];
  const accessories: number[][] = [];
  for (const group of groups.values()) {
    if (group.length < MODEL_PARTS) continue;
    if (group.some((i) => figures.has(parts[i].submodel ?? ''))) continue;
    const inGroup = new Set(group);
    const tyre = group.some((i) => tyres.has(i));
    const moves = tyre || connections.some((c) => (c.kind === 'revolute' || c.kind === 'slide' || c.kind === 'ball') && inGroup.has(c.male) && inGroup.has(c.female) && rigid[c.male] !== rigid[c.female]);
    if (!moves) continue;
    if (hasSubmodels) {
      const bySubmodel = new Map<string, number>();
      for (const i of group) bySubmodel.set(ownSubmodel(i), (bySubmodel.get(ownSubmodel(i)) ?? 0) + 1);
      const [own, n] = [...bySubmodel].reduce((a, b) => (b[1] > a[1] ? b : a));
      if (own === '' || n < UNDER_ONE * group.length) continue;
    }
    const touches = group.some((i) => {
      const p = at(i);
      return mainAt.some((q) => q.distanceTo(p) <= TOUCHING);
    });
    const onTheGround = Math.max(...group.map((i) => at(i).y)) >= mainLowest - ON_THE_GROUND;
    if (touches || !onTheGround) carried.push(group);
    else if (tyre) models.push(group);
    else accessories.push(group);
  }
  return { models, carried, accessories };
}
