// A part turning on an axle that a linkage slides along it.

import { Vector3 } from 'three';
import type { Connection } from '../mechanism.ts';
import { axialOverlap, AXIS_TOLERANCE, type WorldCylinder } from './shared.ts';

// A part turning on an axle may slide along it too, as far as the parts either side of it on
// the axle let it, if a linkage works it that way: its body turns on another body about an
// axis across the axle, in a closed loop of joints back to the axle, so swinging there moves
// it along the axle (an old helicopter's
// swashplate, raised and lowered on its rotor shaft by the pilot's levers, so tilting the
// blades through their pitch links). A connecting rod on a crank, whose other end turns on a
// parallel pin, swings across its axle, and stays where it is along it. Parts stacked against it on the axle that turn
// there too ride along with it, turning against it (the swashplate's other half, which turns
// with the rotor while this one doesn't). Other parts stay where they're built along their
// axles: most are held there by their neighbours, or by friction.
// Turns the parts' turning connections with the axle into slides that turn (with their travel
// as extents, see slideRange), and returns the connections between the parts of a stack.
export function slidingOnAxles(roles: string[], cyls: WorldCylinder[], connections: Connection[], bodyOf: number[]): Connection[] {
  const TOUCH = 0.5; // LDU: parts along an axle this close touch
  const result: Connection[] = [];
  for (const axle of cyls.filter((c) => c.gender === 'M' && roles[c.part] === 'axle')) {
    const length = axle.secs.reduce((sum, sec) => sum + sec.length, 0);
    const at = (p: Vector3) => new Vector3().subVectors(p, axle.start).dot(axle.dir);
    // The parts on the axle, each with where it lies along it.
    const spans = new Map<number, [number, number]>();
    for (const c of cyls) {
      if (c.part === axle.part) continue;
      const overlap = axialOverlap(axle, c);
      if (!overlap) continue;
      const [lo, hi] = [at(overlap.from), at(overlap.to)].sort((x, y) => x - y);
      const span = spans.get(c.part);
      spans.set(c.part, span ? [Math.min(span[0], lo), Math.max(span[1], hi)] : [lo, hi]);
    }
    const shaft = bodyOf[axle.part];
    const onAxle = (c: Connection) => Math.max(...[c.from, c.to].map((p) => new Vector3().subVectors(p, axle.start).cross(axle.dir).length())) < AXIS_TOLERANCE;
    // Parts that turn on it, and of those, the ones a linkage works.
    const turning = (part: number) => bodyOf[part] !== shaft && connections.some((c) => c.kind === 'revolute' && c.male === axle.part && c.female === part);
    // Whether a body joins back up with the shaft's through joints, other than through `not`.
    const joinsShaft = (start: number, not: number) => {
      const seen = new Set([start, not]);
      const queue = [start];
      while (queue.length) {
        const body = queue.shift()!;
        if (body === shaft) return true;
        for (const c of connections) {
          if (c.kind !== 'revolute' && c.kind !== 'ball' && c.kind !== 'slide') continue;
          const [a, b] = [bodyOf[c.male], bodyOf[c.female]];
          const next = a === body ? b : b === body ? a : -1;
          if (next >= 0 && !seen.has(next)) {
            seen.add(next);
            queue.push(next);
          }
        }
      }
      return false;
    };
    const linked = (part: number) =>
      connections.some((c) => {
        if (c.kind !== 'revolute') return false;
        const [a, b] = [bodyOf[c.male], bodyOf[c.female]];
        const other = a === bodyOf[part] ? b : b === bodyOf[part] ? a : -1;
        const across = new Vector3().subVectors(c.to, c.from).normalize().cross(axle.dir).length() > 0.5;
        return other >= 0 && other !== bodyOf[part] && other !== shaft && across && joinsShaft(other, bodyOf[part]);
      });
    const done = new Set<number>();
    for (const [part] of spans) {
      if (done.has(part) || !turning(part) || !linked(part)) continue;
      // The stack of turning parts touching it, and the room either side of the stack.
      const stack = [part];
      let [lo, hi] = spans.get(part)!;
      let grew = true;
      while (grew) {
        grew = false;
        for (const [other, [a, b]] of spans) {
          if (stack.includes(other) || a > hi + TOUCH || b < lo - TOUCH || !turning(other)) continue;
          stack.push(other);
          [lo, hi] = [Math.min(lo, a), Math.max(hi, b)];
          grew = true;
        }
      }
      for (const p of stack) done.add(p);
      // Not the frame, nor a body held on the axle elsewhere too (the frame, or a tail boom, with
      // a shaft turning in a row of its holes): those hold the axle, rather than ride on it.
      const bodies = new Set(stack.map((p) => bodyOf[p]));
      if (bodies.has(0) || [...spans.keys()].some((p) => bodies.has(bodyOf[p]) && !stack.includes(p))) continue;
      let [below, above] = [lo, length - hi];
      for (const [other, [a, b]] of spans) {
        if (stack.includes(other)) continue;
        if (b <= lo + TOUCH) below = Math.min(below, Math.max(0, lo - b));
        else if (a >= hi - TOUCH) above = Math.min(above, Math.max(0, a - hi));
        else [below, above] = [0, 0]; // something else round the axle in the stack's way
      }
      if (below + above < TOUCH) continue;
      for (const c of connections) {
        if (c.kind !== 'revolute' || !onAxle(c)) continue;
        const [a, b] = [bodyOf[c.male], bodyOf[c.female]];
        if (!((a === shaft && bodies.has(b)) || (b === shaft && bodies.has(a)))) continue;
        // How far the axle may slide against the part, along from -> to.
        const way = new Vector3().subVectors(c.to, c.from).dot(axle.dir) >= 0 ? 1 : -1;
        const room: [number, number] = a === shaft ? [-above, below] : [-below, above];
        c.kind = 'slide';
        c.turns = true;
        c.extents = { male: [0, 0], female: way > 0 ? room : [-room[1], -room[0]], overlap: 0 };
      }
      // The stack's parts, each turning against the next.
      const ordered = stack.slice().sort((x, y) => spans.get(x)![0] - spans.get(y)![0]);
      for (let k = 1; k < ordered.length; k++) {
        const [x, y] = [ordered[k - 1], ordered[k]];
        if (bodyOf[x] === bodyOf[y]) continue;
        const point = (t: number) => axle.start.clone().addScaledVector(axle.dir, t);
        result.push({ male: x, female: y, kind: 'revolute', from: point(spans.get(x)![0]), to: point(spans.get(y)![1]) });
      }
    }
  }
  return result;
}
