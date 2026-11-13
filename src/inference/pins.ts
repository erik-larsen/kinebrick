// Pins: which of the parts a pin joins it turns with, and a friction pin's stiffness.

import type { Connection } from '../mechanism.ts';

// A pin joins two parts through round holes, and both turn on it. Which of them the pin turns
// with doesn't matter, so it's locked to one (the one it goes furthest into, or the first in
// the model), saving a body that only spins to no purpose. A friction pin's other joints are
// stiff, or, if `frictionRigid`, rigid too (marked `held`, so inferMechanism knows), but for the
// pins in `freed` (see pinsToFree).
export function fixPins(connections: Connection[], roles: string[], frictionRigid: boolean, freed: Set<number>) {
  roles.forEach((role, pin) => {
    if (role !== 'pin' && role !== 'friction pin') return;
    const turning = connections.filter((c) => c.male === pin && c.kind === 'revolute');
    if (turning.length === 0) return;
    const length = (c: Connection) => c.from.distanceTo(c.to);
    turning.sort((a, b) => length(b) - length(a) || a.female - b.female);
    turning[0].kind = 'rigid';
    if (role !== 'friction pin') return;
    for (const c of turning.slice(1)) {
      if (frictionRigid && !freed.has(pin)) {
        c.kind = 'rigid';
        c.held = true;
      } else {
        c.stiff = true;
      }
    }
  });
}
