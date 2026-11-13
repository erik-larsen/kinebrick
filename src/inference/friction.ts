// Friction pins freed on demand. A model is built with its friction pins held rigid, unless they
// are the only way it can move (see inferMechanism). Where that leaves a control, or a part the
// user grabs, with no motion at all, the pins that hold it are freed: those that turn in the
// motions that move it in a build of the model with every friction pin free.

import { Kinematics } from '../kinematics.ts';
import type { Mechanism } from '../mechanism.ts';

// Whether controls with no motion get their friction pins freed (on with KINEBRICK_FREE_PINS=1).
export const FREE_PINS = typeof process !== 'undefined' && process.env?.KINEBRICK_FREE_PINS === '1';

// How much two bodies' speeds may differ in a motion and still count as moving together.
const TOGETHER = 1e-6;

// The friction pins to free so that `part` can move: in `allFree` (the model built with every
// friction pin free), the pins whose two sides move differently in some free motion that moves
// the part against what it turns in. A motor named as the part is taken by its output, as the
// check works it. Pins are parts, as fixPins knows them (a connection's male part); none if no
// motion moves the part even with every pin free.
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
  const moving = kin.freeMotions().filter((m) => apart(m, body, link.parent));
  const pins = new Set<number>();
  for (const c of allFree.connections) {
    if (!c.stiff) continue;
    const [a, b] = [allFree.bodyOf[c.male], allFree.bodyOf[c.female]];
    if (a !== b && moving.some((m) => apart(m, a, b))) pins.add(c.male);
  }
  return [...pins].sort((x, y) => x - y);
}
