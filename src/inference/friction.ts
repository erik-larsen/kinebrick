// Friction pins freed on demand. A model is built with its friction pins held rigid, unless they
// are the only way it can move (see inferMechanism). Where that leaves a control, or a part the
// user grabs, with no motion at all, the pins that hold it are freed: the fewest of those that
// turn in the motions that move it in a build of the model with every friction pin free.

import { Kinematics } from '../kinematics.ts';
import { combine, nullSpace } from '../linalg.ts';
import type { Mechanism } from '../mechanism.ts';

// Whether the check frees the friction pins of controls with no motion (on; off with
// KINEBRICK_FREE_PINS=0, for measuring).
export const FREE_PINS = typeof process === 'undefined' || process.env?.KINEBRICK_FREE_PINS !== '0';

// How much two bodies' speeds may differ in a motion (scaled so its largest speed is 1) and still
// count as moving together.
const TOGETHER = 1e-6;

// The friction pins to free so that `part` can move. In `allFree` (the model built with every
// friction pin free), the motions that move the part against what it turns in are found; then
// the pins that turn in them are held again one by one, those farthest from the part (in joints)
// first, each kept held if the part can still move. The pins left are those it can't move
// without: a motion that moves the part and turns them, and no other friction pin. A motor named
// as the part is taken by its output, as the check works it. Pins are parts, as fixPins knows
// them (a connection's male part); none if no motion moves the part even with every pin free.
export function pinsToFree(allFree: Mechanism, part: number): number[] {
  const kin = new Kinematics(allFree);
  let body = allFree.bodyOf[part];
  if (allFree.roles[part] === 'motor') {
    const j = allFree.joints.find((x) => x.motor && (x.bodyA === body || x.bodyB === body));
    if (j) body = j.bodyA === body ? j.bodyB : j.bodyA;
  }
  const link = kin.parentLink(body);
  if (body === 0 || !link) return [];
  const apart = (m: number[], a: number, b: number) => [0, 1, 2, 3, 4, 5].some((k) => Math.abs(m[6 * a + k] - m[6 * b + k]) > TOGETHER);
  const movesPart = (m: number[]) => apart(m, body, link.parent);
  const scaled = (m: number[]) => {
    const most = Math.max(...m.map(Math.abs));
    return most > 0 ? m.map((x) => x / most) : m;
  };
  let motions = kin.freeMotions().map(scaled);
  if (!motions.some(movesPart)) return [];

  // Each friction pin, with the pairs of bodies it joins (a pin may sit in more than one hole).
  // A motor's output turns stiffly too, but it is the motor's gearbox that holds it, not a pin
  // to free: freeing it would let the drag turn the motor (the 42109's steering).
  const pins = new Map<number, [number, number][]>();
  for (const c of allFree.connections) {
    if (!c.stiff || c.motor) continue;
    const [a, b] = [allFree.bodyOf[c.male], allFree.bodyOf[c.female]];
    if (a === b) continue;
    if (!pins.has(c.male)) pins.set(c.male, []);
    pins.get(c.male)!.push([a, b]);
  }
  const turns = (m: number[], pin: number) => pins.get(pin)!.some(([a, b]) => apart(m, a, b));
  const turning = [...pins.keys()].filter((p) => motions.some((m) => movesPart(m) && turns(m, p)));

  // How many joints each body is from the part's.
  const hops = new Map<number, number>([[body, 0]]);
  for (let front = [body]; front.length; ) {
    const next: number[] = [];
    for (const j of allFree.joints) {
      for (const [from, to] of [[j.bodyA, j.bodyB], [j.bodyB, j.bodyA]]) {
        if (front.includes(from) && !hops.has(to)) {
          hops.set(to, hops.get(from)! + 1);
          next.push(to);
        }
      }
    }
    front = next;
  }
  const away = (pin: number) => Math.min(...pins.get(pin)!.flat().map((b) => hops.get(b) ?? Infinity));
  const order = [...turning].sort((x, y) => away(y) - away(x) || y - x);

  // Hold each pin again (keep only the motions in which it doesn't turn) if the part still moves.
  for (const pin of order) {
    const rows = pins.get(pin)!.flatMap(([a, b]) => [0, 1, 2, 3, 4, 5].map((k) => motions.map((m) => m[6 * a + k] - m[6 * b + k])));
    const held = nullSpace(rows, motions.length).map((amounts) => scaled(combine(motions, amounts)));
    if (held.some(movesPart)) motions = held;
  }
  return turning.filter((p) => motions.some((m) => movesPart(m) && turns(m, p))).sort((x, y) => x - y);
}

// How many held pins the search tries at most, the nearest (see pinsByTrial): with 1, 2, 4 and so
// on to 64 tried in turn, at most seven builds to find a set that lets the part move. The pins
// that hold a mast to the frame lie 32 to 64 pins from the knob that tilts it, counted along
// the connections (the 42079 Heavy Duty Forklift's); 16 missed them.
const NEAREST = 64;

// The friction pins held in a build as read (`read`), nearest `part` first: those a connection
// marks held (see fixPins), by how many connections apart they are from the part. First come
// those that join the part's own body (`own` says how many), then the rest, NEAREST in all; none
// of those in `freed`.
export function heldPins(read: Mechanism, part: number, freed: Set<number> = new Set()): { pins: number[]; own: number } {
  const held = new Set(read.connections.filter((c) => c.held && !freed.has(c.male)).map((c) => c.male));
  const next = new Map<number, number[]>();
  const link = (a: number, b: number) => next.set(a, [...(next.get(a) ?? []), b]);
  for (const c of read.connections) {
    link(c.male, c.female);
    link(c.female, c.male);
  }
  const hops = new Map<number, number>([[part, 0]]);
  for (let front = [part]; front.length; ) {
    const ahead: number[] = [];
    for (const p of front) for (const q of next.get(p) ?? []) if (!hops.has(q)) hops.set(q, hops.get(p)! + 1), ahead.push(q);
    front = ahead;
  }
  const body = read.bodyOf[part];
  const touches = (pin: number) => read.connections.some((c) => c.held && c.male === pin && (read.bodyOf[c.female] === body || read.bodyOf[c.male] === body));
  const sorted = [...held].sort((x, y) => Number(touches(y)) - Number(touches(x)) || (hops.get(x) ?? Infinity) - (hops.get(y) ?? Infinity) || x - y);
  return { pins: sorted.slice(0, NEAREST), own: Math.min(NEAREST, sorted.filter(touches).length) };
}

// The friction pins to free so that a part can move, found by trying them (decision 126 of
// 2026-11-16), where pinsToFree's reading of the build with every pin free names none that help:
// that build may differ from the one as read in more than the pins it frees (a held axle pin
// joins a motor's axle to the frame as read, and with every pin free that axle is still jammed,
// the 42080 Mobile Crane MK II's). `candidates` are the pins that may be freed, nearest the part
// first (see heldPins); `moves` says whether the part can move with a set of pins freed, building
// the model with them freed (each try is a build). Freeing more pins can jam a part that fewer
// let move (as with every pin free), so the pins are taken nearest first, 1, 2, 4 and so on, until
// the part can move; none if it can't with all of them. Then that set is cut down: of its two
// halves, one alone if it will do, else what each needs with the other freed.
export function pinsByTrial({ pins: candidates, own }: { pins: number[]; own: number }, moves: (freed: Set<number>) => boolean): number[] {
  let found: number[] | null = null;
  // The pins on the part's own body first, in one build: most often they're the ones.
  if (own > 0 && moves(new Set(candidates.slice(0, own)))) found = candidates.slice(0, own);
  for (let n = 1; !found && candidates.length; n = Math.min(2 * n, candidates.length)) {
    const nearest = candidates.slice(0, n);
    if (moves(new Set(nearest))) {
      found = nearest;
      break;
    }
    if (n === candidates.length) break;
  }
  if (!found) return [];
  // The fewest of `pins` that, with `kept` freed too, let the part move (`kept` alone doesn't).
  const fewest = (kept: number[], pins: number[]): number[] => {
    if (pins.length <= 1) return pins;
    const half = Math.ceil(pins.length / 2);
    const near = pins.slice(0, half);
    const far = pins.slice(half);
    if (moves(new Set([...kept, ...near]))) return fewest(kept, near);
    if (moves(new Set([...kept, ...far]))) return fewest(kept, far);
    const fromNear = fewest([...kept, ...far], near);
    return [...fromNear, ...(moves(new Set([...kept, ...fromNear])) ? [] : fewest([...kept, ...fromNear], far))];
  };
  return fewest([], found).sort((x, y) => x - y);
}
