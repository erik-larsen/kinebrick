// Held results (data/holds.json, the orchestrator's to edit): a function the check finds better
// than it truly is, where the viewer does not show the gain, is stored at the result it is held
// at, and what the check found is kept beside it, in `found`. The ratchet, the status page and the
// counts then count the held result, and the hold can be seen in the set's file. Where the check
// finds the function as good as its held result or worse, it is stored as found, and the check
// says that the hold is no longer needed. Only the functions the file names are touched.

import { existsSync, readFileSync } from 'node:fs';

export interface Hold {
  set: string; // as in data/sets: "8274-1"
  function: number; // 1-based, as the README and the reports count them
  result: 'works' | 'partly' | 'no'; // the result to hold it at
  reason: string;
  date: string; // when it was held: "2026-11-19"
}

// A function's stored record while it is held: the held result, the hold, and what was found.
export interface Held<T> {
  result: Hold['result'];
  hold: { reason: string; date: string };
  found: T;
}

// How each result ranks, best first, as in check-functions.ts.
const RANK: Record<string, number> = { works: 0, partly: 1, no: 2, error: 3, skipped: 4, 'not checked': 4 };

export function readHolds(file = 'data/holds.json'): Hold[] {
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf-8')) : [];
}

// What a stored record was found to be: for a held one, what the check found, else the record.
export function foundOf<T>(record: T | Held<T>): T {
  return record && typeof record === 'object' && 'hold' in record && 'found' in record ? record.found : (record as T);
}

// A set's functions as the check found them (`functions`), with its holds put on: each held
// function that came out better than its held result is held. `notes` says, for each other hold,
// that it is no longer needed. A function not checked in this run (left out: undefined) is left.
export function applyHolds<T extends { result: string }>(set: string, functions: T[], holds: Hold[]) {
  const out: (T | Held<T>)[] = [...functions];
  const notes: string[] = [];
  for (const h of holds) {
    if (h.set !== set) continue;
    const c = functions[h.function - 1];
    if (!c) continue;
    if (RANK[c.result] < RANK[h.result]) out[h.function - 1] = { result: h.result, hold: { reason: h.reason, date: h.date }, found: c };
    else notes.push(`function ${h.function} is held at ${h.result} and came out ${c.result}: the hold is no longer needed`);
  }
  return { functions: out, notes };
}
