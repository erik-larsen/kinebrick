// The viewer's helper for friction pins, run beside the page so the page stays live. A model is
// built with its friction pins held (see inferMechanism); when a part you grab can't move, the
// page asks here which pins to free so it can (see pinsToFree), and works the model out again
// with them free.
//
// The page sends two kinds of message:
//   { model: { text, primitives, pieces, table, roles } }  the model as the page read it: this
//       builds it with every friction pin free, once, which on a big model takes seconds
//   { ask: number, part: number, freed: number[] }  which pins to free so that part can move,
//       besides those freed already: the answer is { ask, pins }, pins being part numbers (none
//       if freeing pins wouldn't let it move). Where the pins that pinsToFree names don't let it
//       move, they're found by trying them in the model as read (see pinsByTrial): a build each.
// Messages are answered in the order they come, so a question sent before the model is built
// waits until it is.

import { parseModel } from './ldr.ts';
import { inferMechanism, Mechanism, motorOutput, pinsToFree } from './mechanism.ts';
import { heldPins, pinsByTrial } from './inference/friction.ts';
import { Kinematics } from './kinematics.ts';
import type { PlacedPart } from './ldr.ts';

let allFree: Mechanism | null = null;
// The model as the page read it, to build again with pins freed (see pinsByTrial).
let model: { parts: PlacedPart[]; table: any; roles: Record<string, string>; paths: any[] } | null = null;

// Whether `part` can move, in the model built with the pins `freed` free: it isn't part of a frame,
// and the joint it turns on has an exact motion, as the check asks (see pinsToFree's callers).
function moves(part: number, freed: Set<number>): boolean {
  const mech = inferMechanism(model!.parts, model!.table, model!.roles, model!.paths, freed);
  const kin = new Kinematics(mech);
  // A motor is taken by its output, as pinsToFree takes it.
  const body = mech.roles[part] === 'motor' ? motorOutput(mech, part) : mech.bodyOf[part];
  const link = kin.parentLink(body);
  return !kin.frames.includes(body) && link !== null && kin.jointMotion(link.joint, false) !== null;
}

self.onmessage = (event: MessageEvent) => {
  const message = event.data;
  if (message.model) {
    const { text, primitives, pieces, table, roles } = message.model;
    const primitiveSet = new Set(primitives);
    const { parts, paths } = parseModel(text, (name) => primitiveSet.has(name), (name) => pieces[name] ?? null);
    allFree = inferMechanism(parts, table, roles, paths, new Set(), true);
    model = { parts, table, roles, paths };
  } else if (message.ask !== undefined) {
    const freed = new Set<number>(message.freed ?? []);
    let pins = allFree ? pinsToFree(allFree, message.part).filter((p) => !freed.has(p)) : [];
    if (model && message.search !== false && !(pins.length && moves(message.part, new Set([...freed, ...pins])))) {
      const read = inferMechanism(model.parts, model.table, model.roles, model.paths, freed);
      pins = pinsByTrial(heldPins(read, message.part, freed), (more) => moves(message.part, new Set([...freed, ...more])));
    }
    self.postMessage({ ask: message.ask, pins });
  }
};
