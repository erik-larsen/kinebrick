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
//
// What a loose part touches as built (decision 259 of 2026-11-20, see touchingFrom and
// rideAlong) needs the parts' shapes, which only the page has. So the helper keeps what the page
// has told it, and where a build asks about a loose part it hasn't been told of, it drops what it
// worked out and asks the page: { need: number[], retry: message }. The page answers
// { touches: [part, touched[]][], retry: message }, and the message is handled again, the others
// waiting meanwhile. So no build here goes by any other rule than the page's.

import { parseModel } from './ldr.ts';
import { inferMechanism, Mechanism } from './mechanism.ts';
import type { Touching } from './collisions.ts';
import { pinsForDrag, pinsForShift } from './pinSearch.ts';
import { Vector3 } from 'three';
import type { PlacedPart } from './ldr.ts';

let allFree: Mechanism | null = null;
// The model as the page read it, to build again with pins freed (see pinsForDrag).
let model: { parts: PlacedPart[]; table: any; roles: Record<string, string>; paths: any[] } | null = null;

// What each loose part touches as built, as the page said; the parts a build asked about that it
// hasn't said (see above).
const told = new Map<number, number[]>();
const missing = new Set<number>();
const touching: Touching = (_matrices, which) =>
  new Map(
    which.map((i) => {
      if (!told.has(i)) missing.add(i);
      return [i, told.get(i) ?? []];
    }),
  );
// Messages that came while the page was asked (see above), in order.
const waiting: unknown[] = [];
let asking = false;

self.onmessage = (event: MessageEvent) => {
  const message = event.data;
  if (message.touches) {
    for (const [part, touched] of message.touches as [number, number[]][]) told.set(part, touched);
    asking = false;
    handle(message.retry);
    while (!asking && waiting.length) handle(waiting.shift());
  } else if (asking) waiting.push(message);
  else handle(message);
};

function handle(message: any) {
  missing.clear();
  answer(message);
  if (missing.size) {
    asking = true;
    if (message.model) allFree = null;
    self.postMessage({ need: [...missing], retry: message });
  }
}

function answer(message: any) {
  if (message.model) {
    const { text, primitives, pieces, table, roles } = message.model;
    const primitiveSet = new Set(primitives);
    const { parts, paths } = parseModel(text, (name) => primitiveSet.has(name), (name) => pieces[name] ?? null);
    allFree = inferMechanism(parts, table, roles, paths, new Set(), true, null, new Set(), touching);
    model = { parts, table, roles, paths };
  } else if (message.ask !== undefined) {
    const m = model;
    if (message.shift) {
      const found = allFree && m ? pinsForShift(inferMechanism(m.parts, m.table, m.roles, m.paths, new Set<number>(message.freed ?? []), false, null, new Set(), touching), allFree, message.part) : { pins: [], why: 'more' };
      if (!missing.size) self.postMessage({ ask: message.ask, ...found });
      return;
    }
    // Grabbed where the page says (on the part as built), or else at the part's middle.
    const at = m && message.at ? new Vector3(...(message.at as [number, number, number])) : m ? new Vector3().setFromMatrixPosition(m.parts[message.part].matrix) : new Vector3();
    const pins = allFree && m ? pinsForDrag((freed) => inferMechanism(m.parts, m.table, m.roles, m.paths, freed, false, null, new Set(), touching), allFree, message.part, at, new Set<number>(message.freed ?? []), message.search !== false, message.lifted === true) : [];
    if (!missing.size) self.postMessage({ ask: message.ask, pins });
  }
}
