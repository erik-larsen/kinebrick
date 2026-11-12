// What's hooked to the ends of a chain that doesn't close up, and carried along by it.

import { Vector3 } from 'three';
import { PlacedPart, PlacedPath } from '../ldr.ts';
import { LoopPath } from '../paths.ts';
import type { Connection, Joint, Loop } from '../mechanism.ts';
import { stepsFromFrame } from './loops.ts';
import type { WorldCylinder } from './shared.ts';

// How near the middle of a chain's gap a connection point of what's hooked to its ends must be,
// in LDU (see hookedParts): the 8835 Forklift's carriage's nearest is 20 LDU from it, behind the
// chain tread closing the gap.
const HOOK_REACH = 24;

// The loose parts hooked to a chain's ends, and the chain each is hooked to: for each chain placed
// by hand that doesn't close up, the biggest group of loose parts attached to each other with a
// connection point within HOOK_REACH of the middle of the gap between its ends (a fork-lift's
// carriage, hooked to both ends of a chain a link short, which closes it). The chain carries it
// (see chainHooks). Smaller groups there ride along with what's nearest, as loose parts do: the
// 8835 Forklift's chain tread, the chain's missing link, which in the real model is held between
// four bushes in the carriage.
export function hookedParts(cyls: WorldCylinder[], connections: Connection[], loose: number[], paths: PlacedPath[]): Map<number, PlacedPath> {
  const isLoose = new Set(loose);
  const leader = new Map(loose.map((i) => [i, i]));
  const find = (i: number): number => {
    while (leader.get(i) !== i) i = leader.get(i)!;
    return i;
  };
  for (const c of connections) if (isLoose.has(c.male) && isLoose.has(c.female)) leader.set(find(c.male), find(c.female));
  const size = new Map<number, number>();
  for (const i of loose) size.set(find(i), (size.get(find(i)) ?? 0) + 1);
  const hooked = new Map<number, PlacedPath>();
  for (const path of paths) {
    if (!path.looped || !path.ends) continue;
    const middle = path.ends[0].clone().add(path.ends[1]).multiplyScalar(0.5);
    const near = new Set(cyls.filter((c) => isLoose.has(c.part) && !hooked.has(c.part) && c.start.distanceTo(middle) < HOOK_REACH).map((c) => find(c.part)));
    const group = [...near].reduce((best, g) => (best < 0 || size.get(g)! > size.get(best)! ? g : best), -1);
    for (const i of loose) if (group >= 0 && find(i) === group) hooked.set(i, path);
  }
  return hooked;
}

// What's hooked to a chain's ends (see hookedParts) slides along the straight run the chain's gap
// is on, as far as it goes, on what the wheel at one end of that run turns in: of the two, the
// one furthest from the frame (a fork-lift's mast, which tilts on the frame about its bottom
// sprocket's axle). Of the bodies hooked, the one with the most parts slides (a carriage, not the
// axle pins turning in it); the chain carries it along at the speed that wheel's rim turns in
// what it slides on (see Loop's hooks). Returns the hooked parts it couldn't slide: on a chain
// with no wheel at either end of the run its gap is on, or with its gap round a wheel.
export function chainHooks(parts: PlacedPart[], bodyOf: number[], joints: Joint[], loops: Loop[], hooked: Map<number, PlacedPath>): number[] {
  const steps = stepsFromFrame(joints);
  const at = (i: number) => new Vector3().setFromMatrixPosition(parts[i].matrix);
  const slid = new Set<PlacedPath>();
  for (const loop of loops) {
    const ends = loop.path.ends;
    const mine = [...hooked.keys()].filter((i) => hooked.get(i) === loop.path);
    if (!ends || !mine.length) continue;
    const count = (b: number) => mine.filter((i) => bodyOf[i] === b).length;
    const body = mine.map((i) => bodyOf[i]).reduce((best, b) => (count(b) > count(best) ? b : best));
    let path: LoopPath;
    try {
      path = new LoopPath(loop.path.points);
    } catch {
      continue;
    }
    const middle = ends[0].clone().add(ends[1]).multiplyScalar(0.5);
    const s = path.nearest(middle);
    const run = path.runAt(s);
    if (!run) continue;
    const wheel = loop.wheels.reduce((best, w, k) => ((w.point === run.from || w.point === run.to) && (best < 0 || steps[w.mount] > steps[loop.wheels[best].mount]) ? k : best), -1);
    if (wheel < 0) continue;
    const frame = path.frameAt(s);
    const from = new Vector3().setFromMatrixPosition(frame);
    const along = new Vector3().setFromMatrixColumn(frame, 0);
    const w = loop.wheels[wheel];
    // Run to either end, it meets a wheel: its part nearest the gap, and the part of that wheel
    // nearest its circle's middle.
    const center = loop.path.points[w.point].center;
    const nearest = (list: number[], p: Vector3) => list.reduce((best, i) => (at(i).distanceTo(p) < at(best).distanceTo(p) ? i : best));
    const sliding: [number, number] = [nearest(mine.filter((i) => bodyOf[i] === body), middle), nearest(parts.flatMap((_, i) => (bodyOf[i] === w.body ? [i] : [])), center)];
    joints.push({ kind: 'slide', bodyA: w.mount, bodyB: body, from, to: from.clone().add(along), stiff: false, range: [-run.back, run.on], sliding });
    loop.hooks = [...(loop.hooks ?? []), { joint: joints.length - 1, wheel }];
    slid.add(loop.path);
  }
  return [...hooked.keys()].filter((i) => !slid.has(hooked.get(i)!));
}
