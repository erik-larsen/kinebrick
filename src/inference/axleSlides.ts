// A part turning on an axle that a linkage slides along it.

import { Vector3 } from 'three';
import type { Connection } from '../mechanism.ts';
import { axialOverlap, AXIS_TOLERANCE, axleStops, rigidGroups, type WorldCylinder } from './shared.ts';

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
        return other >= 0 && other !== bodyOf[part] && other !== shaft && across && joinsShaft(other, bodyOf[part]) && canSwing(c, other);
      });
    // Whether the part's body can really swing about the hinge c on `other`, as it rides the
    // axle. If `other` turns on the shaft itself (by a joint straight between their bodies),
    // `other` can only turn about that joint's axis against the shaft; the swing on top of
    // that must leave the part turning about the axle and sliding along it, and nothing else.
    // Where it can't (a beam hinged on the frame that the shaft turns in, with the shaft
    // through it), the shaft holds the part where it is: the part only turns on the axle.
    // Where `other` is joined to the shaft only through other bodies, it may move as the
    // linkage lets it, and the part is taken to swing.
    const canSwing = (hinge: Connection, other: number) => {
      const bearings = connections.filter((k) => (k.kind === 'revolute' || k.kind === 'rigid') && [bodyOf[k.male], bodyOf[k.female]].sort().join() === [shaft, other].sort().join());
      if (!bearings.length) return true;
      // Each joint as a turn about a line, written as how a body turning about it at 1 radian
      // per second moves: its turn, and the speed of the point at the axle's start.
      const twist = (k: Connection) => {
        const dir = new Vector3().subVectors(k.to, k.from).normalize();
        return [...dir.toArray(), ...new Vector3().subVectors(k.from, axle.start).cross(dir).toArray()];
      };
      // How the part may move on the axle (turning about it, sliding along it), and how
      // `other` may move on the shaft: one bearing's turn, if all its bearings turn about the
      // one line, and none if not (or if one is rigid).
      const allowed = [[...axle.dir.toArray(), 0, 0, 0], [0, 0, 0, ...axle.dir.toArray()]];
      const turn = twist(bearings[0]);
      const same = (t: number[], sign: number) => t.every((x, i) => Math.abs(x - sign * turn[i]) < (i < 3 ? 0.01 : 1));
      const oneLine = bearings.every((k) => k.kind === 'revolute' && (same(twist(k), 1) || same(twist(k), -1)));
      if (oneLine) allowed.push(turn);
      // The swing can happen if it's made of those: take each away from it in turn (as
      // they're made at right angles to each other), and see that nothing is left.
      const swing = twist(hinge);
      const basis: number[][] = [];
      for (const v of allowed) {
        const w = basis.reduce((acc, b) => { const dot = acc.reduce((sum, x, i) => sum + x * b[i], 0); return acc.map((x, i) => x - dot * b[i]); }, v.slice());
        const size = Math.hypot(...w);
        if (size > 1e-6) basis.push(w.map((x) => x / size));
      }
      const left = basis.reduce((acc, b) => { const dot = acc.reduce((sum, x, i) => sum + x * b[i], 0); return acc.map((x, i) => x - dot * b[i]); }, swing);
      return Math.hypot(...left) < 1e-3 * Math.hypot(...swing);
    };
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
      // Nor past a stop on the axle itself (an axle with a stop's flange).
      for (const [a, b] of axleStops(axle)) {
        if (b <= lo + TOUCH) below = Math.min(below, Math.max(0, lo - b));
        else if (a >= hi - TOUCH) above = Math.min(above, Math.max(0, a - hi));
        else [below, above] = [0, 0];
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

// A part riding in round holes on two or more parallel axles, all gripped by one other body,
// slides along them, if a linkage works it that way (a telescopic fork: the 42063's top piece
// rides on the two leg axles that the lower fork grips, and the fork's ball at the top and the
// suspension arm's ball at the bottom close a loop that can only move if it slides). Two hinges
// on two lines would hold it fast (see groupIntoBodies), so this comes before the bodies are
// found. The test of need is the single axle's: the rider joins back to the axles' body through
// a hinge across them (or a ball) on another body. Its travel is what every axle allows: the
// parts either side of it on each axle, and the axles' stops. Turns those hinges into slides
// along the axles, which don't turn.
export function slidingOnParallelAxles(roles: string[], frameRoles: string[], cyls: WorldCylinder[], connections: Connection[], count: number): void {
  const TOUCH = 0.5; // LDU: parts along an axle this close touch
  const group = rigidGroups(count, connections);
  const axles = cyls.filter((c) => c.gender === 'M' && roles[c.part] === 'axle');
  const onLine = (axle: WorldCylinder, c: Connection) => Math.max(...[c.from, c.to].map((p) => new Vector3().subVectors(p, axle.start).cross(axle.dir).length())) < AXIS_TOLERANCE;
  // Each rider and holder (by their groups), with the axles the rider turns on.
  const rides = new Map<string, { rider: number; holder: number; axles: WorldCylinder[] }>();
  for (const axle of axles) {
    const holder = group[axle.part];
    for (const c of connections) {
      if (c.kind !== 'revolute' || !onLine(axle, c)) continue;
      const other = c.male === axle.part ? c.female : c.female === axle.part ? c.male : -1;
      if (other < 0 || group[other] === holder) continue;
      const key = `${group[other]} ${holder}`;
      if (!rides.has(key)) rides.set(key, { rider: group[other], holder, axles: [] });
      const ride = rides.get(key)!;
      if (!ride.axles.includes(axle)) ride.axles.push(axle);
    }
  }
  // The group the frame will be: the one with the most structure parts (see groupIntoBodies).
  const structure = new Map<number, number>();
  for (let i = 0; i < count; i++) if (frameRoles[i] === 'structure') structure.set(group[i], (structure.get(group[i]) ?? 0) + 1);
  const frame = [...structure].reduce((a, b) => (b[1] > a[1] ? b : a), [-1, 0])[0];
  for (const { rider, holder, axles: on } of rides.values()) {
    if (rider === frame || on.length < 2) continue;
    const ref = on[0].dir;
    if (on.some((a) => new Vector3().crossVectors(a.dir, ref).length() > 1e-3)) continue;
    const lines = on.filter((a, k) => !on.slice(0, k).some((b) => new Vector3().subVectors(a.start, b.start).cross(ref).length() < AXIS_TOLERANCE));
    if (lines.length < 2) continue;
    // Every hinge between the two must be on those axles, or the rider is held some other way.
    const between = connections.filter((c) => c.kind === 'revolute' && [group[c.male], group[c.female]].sort().join() === [rider, holder].sort().join());
    if (!between.every((c) => on.some((a) => onLine(a, c)))) continue;
    // The test of need: a hinge across the axles, or a ball, from the rider to another body
    // that joins back to the holder without the rider.
    const joinsHolder = (start: number) => {
      const seen = new Set([start, rider]);
      const queue = [start];
      while (queue.length) {
        const g = queue.shift()!;
        if (g === holder) return true;
        for (const c of connections) {
          if (c.kind !== 'revolute' && c.kind !== 'ball' && c.kind !== 'slide') continue;
          const [a, b] = [group[c.male], group[c.female]];
          const next = a === g ? b : b === g ? a : -1;
          if (next >= 0 && !seen.has(next)) {
            seen.add(next);
            queue.push(next);
          }
        }
      }
      return false;
    };
    const linked = connections.some((c) => {
      if (c.kind !== 'ball' && c.kind !== 'revolute') return false;
      const [a, b] = [group[c.male], group[c.female]];
      const other = a === rider ? b : b === rider ? a : -1;
      if (other < 0 || other === rider || other === holder) return false;
      if (c.kind === 'revolute' && new Vector3().subVectors(c.to, c.from).normalize().cross(ref).length() <= 0.5) return false;
      return joinsHolder(other);
    });
    if (!linked) continue;
    // The room either side of the rider on each axle, measured along the first axle's way.
    let [below, above] = [Infinity, Infinity];
    for (const axle of on) {
      const length = axle.secs.reduce((sum, sec) => sum + sec.length, 0);
      const at = (p: Vector3) => new Vector3().subVectors(p, axle.start).dot(axle.dir);
      const spans = new Map<number, [number, number]>();
      for (const c of cyls) {
        if (c.part === axle.part) continue;
        const overlap = axialOverlap(axle, c);
        if (!overlap) continue;
        const [lo, hi] = [at(overlap.from), at(overlap.to)].sort((x, y) => x - y);
        const span = spans.get(c.part);
        spans.set(c.part, span ? [Math.min(span[0], lo), Math.max(span[1], hi)] : [lo, hi]);
      }
      const mine = [...spans].filter(([p]) => group[p] === rider).map(([, s]) => s);
      if (!mine.length) continue;
      const [lo, hi] = [Math.min(...mine.map((s) => s[0])), Math.max(...mine.map((s) => s[1]))];
      let [down, up] = [lo, length - hi];
      for (const [other, [a, b]] of spans) {
        if (group[other] === rider) continue;
        if (b <= lo + TOUCH) down = Math.min(down, Math.max(0, lo - b));
        else if (a >= hi - TOUCH) up = Math.min(up, Math.max(0, a - hi));
        else [down, up] = [0, 0];
      }
      for (const [a, b] of axleStops(axle)) {
        if (b <= lo + TOUCH) down = Math.min(down, Math.max(0, lo - b));
        else if (a >= hi - TOUCH) up = Math.min(up, Math.max(0, a - hi));
        else [down, up] = [0, 0];
      }
      if (axle.dir.dot(ref) < 0) [down, up] = [up, down];
      [below, above] = [Math.min(below, down), Math.min(above, up)];
    }
    if (!(below + above >= TOUCH)) continue;
    for (const c of between) {
      // How far the axles may slide against the rider, along from -> to.
      const way = new Vector3().subVectors(c.to, c.from).dot(ref) >= 0 ? 1 : -1;
      const room: [number, number] = group[c.male] === holder ? [-above, below] : [-below, above];
      c.kind = 'slide';
      c.extents = { male: [0, 0], female: way > 0 ? room : [-room[1], -room[0]], overlap: 0 };
    }
  }
}
