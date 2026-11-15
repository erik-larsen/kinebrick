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
