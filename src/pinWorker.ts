// The viewer's helper for friction pins, run beside the page so the page stays live. A model is
// built with its friction pins held (see inferMechanism); when a part you grab can't move, the
// page asks here which pins to free so it can (see pinsToFree), and works the model out again
// with them free.
//
// The page sends two kinds of message:
//   { model: { text, primitives, pieces, table, roles } }  the model as the page read it: this
//       builds it with every friction pin free, once, which on a big model takes seconds
//   { ask: number, part: number, freed: number[], shift: true }  which pins a press with Shift
//       frees (see pinsForShift): the answer is { ask, pins, why }
//   { ask: number, part: number, freed: number[], search?, lifted?, at? }  which pins to free so
//       that part can move (grabbed at `at`, on it as built, else at its middle),
//       besides those freed already: the answer is { ask, pins }, pins being part numbers (none
//       if freeing pins wouldn't let it move). Where the pins that pinsToFree names don't let it
//       move, they're found by trying them in the model as read (see pinsByTrial): a build each.
// Messages are answered in the order they come, so a question sent before the model is built
// waits until it is.

import { parseModel } from './ldr.ts';
import { inferMechanism, Mechanism } from './mechanism.ts';
import { pinsForDrag, pinsForShift } from './pinSearch.ts';
import { Vector3 } from 'three';
import type { PlacedPart } from './ldr.ts';

let allFree: Mechanism | null = null;
// The model as the page read it, to build again with pins freed (see pinsForDrag).
let model: { parts: PlacedPart[]; table: any; roles: Record<string, string>; paths: any[] } | null = null;

self.onmessage = (event: MessageEvent) => {
  const message = event.data;
  if (message.model) {
    const { text, primitives, pieces, table, roles } = message.model;
    const primitiveSet = new Set(primitives);
    const { parts, paths } = parseModel(text, (name) => primitiveSet.has(name), (name) => pieces[name] ?? null);
    allFree = inferMechanism(parts, table, roles, paths, new Set(), true);
    model = { parts, table, roles, paths };
  } else if (message.ask !== undefined) {
    const m = model;
    if (message.shift) {
      const answer = allFree && m ? pinsForShift(inferMechanism(m.parts, m.table, m.roles, m.paths, new Set<number>(message.freed ?? [])), allFree, message.part) : { pins: [], why: 'more' };
      self.postMessage({ ask: message.ask, ...answer });
      return;
    }
    // Grabbed where the page says (on the part as built), or else at the part's middle.
    const at = m && message.at ? new Vector3(...(message.at as [number, number, number])) : m ? new Vector3().setFromMatrixPosition(m.parts[message.part].matrix) : new Vector3();
    const pins = allFree && m ? pinsForDrag((freed) => inferMechanism(m.parts, m.table, m.roles, m.paths, freed), allFree, message.part, at, new Set<number>(message.freed ?? []), message.search !== false, message.lifted === true) : [];
    self.postMessage({ ask: message.ask, pins });
  }
};
