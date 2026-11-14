// The viewer's helper for friction pins, run beside the page so the page stays live. A model is
// built with its friction pins held (see inferMechanism); when a part you grab can't move, the
// page asks here which pins to free so it can (see pinsToFree), and works the model out again
// with them free.
//
// The page sends two kinds of message:
//   { model: { text, primitives, pieces, table, roles } }  the model as the page read it: this
//       builds it with every friction pin free, once, which on a big model takes seconds
//   { ask: number, part: number }  which pins to free so that part can move: the answer is
//       { ask, pins }, pins being part numbers (none if freeing pins wouldn't let it move)
// Messages are answered in the order they come, so a question sent before the model is built
// waits until it is.

import { parseModel } from './ldr.ts';
import { inferMechanism, Mechanism, pinsToFree } from './mechanism.ts';

let allFree: Mechanism | null = null;

self.onmessage = (event: MessageEvent) => {
  const message = event.data;
  if (message.model) {
    const { text, primitives, pieces, table, roles } = message.model;
    const primitiveSet = new Set(primitives);
    const { parts, paths } = parseModel(text, (name) => primitiveSet.has(name), (name) => pieces[name] ?? null);
    allFree = inferMechanism(parts, table, roles, paths, new Set(), true);
  } else if (message.ask !== undefined) {
    const pins = allFree ? pinsToFree(allFree, message.part) : [];
    self.postMessage({ ask: message.ask, pins });
  }
};
