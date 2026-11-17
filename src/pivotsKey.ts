// The key a kept result of the rule for stuck actuators is filed under (see pivotsOfStuckSlides
// in mechanism.ts, keptPivots.ts, and npm run pivots): made from what the result depends on, so
// that a kept result whose model has changed since is not used. That is the model's parts as
// read (their names and places, after its errata), what Kinebrick knows of each kind of part in
// it (its role, and its entry in the connection table), and PIVOTS_RULE.

import type { ConnectionTable } from './connections.ts';
import type { PlacedPart } from './ldr.ts';
import { libraryName } from './mechanism.ts';

// Made one more whenever the rule changes in a way that changes what it frees: every kept
// result is then stale, and npm run pivots makes them again.
export const PIVOTS_RULE = 1;

export function pivotsKey(parts: PlacedPart[], table: ConnectionTable, roles: Record<string, string>): string {
  const names = parts.map((p) => libraryName(p.name, table));
  const place = (p: PlacedPart) => [0, 1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 14].map((k) => Math.round(p.matrix.elements[k] * 100) / 100 || 0).join(' ');
  const lines = parts.map((p, i) => `${names[i]} ${place(p)}${p.path ? ' path' : ''}`);
  const kinds = [...new Set(names)].sort().map((n) => [n, roles[n] ?? '', table.parts[n] ?? null]);
  const text = JSON.stringify([PIVOTS_RULE, lines, kinds]);
  return hash(text, 2166136261) + hash(text, 374761393);
}

// A short fingerprint of a text (FNV-1a, 32 bits): two of them, from different starts, make the key.
function hash(text: string, start: number): string {
  let h = start >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
