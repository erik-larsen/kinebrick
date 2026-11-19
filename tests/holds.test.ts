import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applyHolds, foundOf, Hold, readHolds } from '../scripts/holds.ts';

// Held results (see scripts/holds.ts): a held function that comes out better is stored at its
// held result, with what was found beside it; one that comes out as good or worse is stored as
// found, and the hold is said to be no longer needed. Nothing else is touched.
describe('held results', () => {
  const hold: Hold = { set: '1-1', function: 2, result: 'partly', reason: 'a gain the viewer does not show', date: '2026-11-19' };
  const found = (result: string) => ({ result, turned: [[0, -0.1]] });

  it('holds a function that came out better, and keeps what was found', () => {
    const { functions, notes } = applyHolds('1-1', [found('no'), found('works'), found('works')], [hold]);
    expect(functions[1]).toEqual({ result: 'partly', hold: { reason: hold.reason, date: hold.date }, found: found('works') });
    expect(notes).toEqual([]);
  });

  it('stores as found, and says so, a function as good as its hold or worse', () => {
    for (const result of ['partly', 'no']) {
      const { functions, notes } = applyHolds('1-1', [found('works'), found(result)], [hold]);
      expect(functions[1]).toEqual(found(result));
      expect(notes).toEqual([`function 2 is held at partly and came out ${result}: the hold is no longer needed`]);
    }
  });

  it('touches only the function the hold names, in its own set', () => {
    const checked = [found('works'), found('works'), found('works')];
    expect(applyHolds('2-1', checked, [hold]).functions).toEqual(checked);
    const { functions } = applyHolds('1-1', checked, [hold]);
    expect(functions.filter((f, i) => f !== checked[i]).length).toBe(1);
    // A function left out of the run (checked by name, one at a time) is left.
    expect(applyHolds('1-1', [found('works')], [hold]).functions).toEqual([found('works')]);
  });

  it('reads back what was found from a held record, and a record as it is', () => {
    const { functions } = applyHolds('1-1', [found('no'), found('works')], [hold]);
    expect(functions.map(foundOf)).toEqual([found('no'), found('works')]);
  });

  it("names, in the file, functions that each set's list has", () => {
    const sets = new Set(readdirSync('data/sets').map((f) => f.replace(/\.json$/, '')));
    for (const h of readHolds()) {
      expect(sets.has(h.set)).toBe(true);
      const data = JSON.parse(readFileSync(`data/sets/${h.set}.json`, 'utf-8'));
      expect(data.curated.functions[h.function - 1]).toBeTruthy();
      expect(['works', 'partly', 'no']).toContain(h.result);
      expect(h.reason.length).toBeGreaterThan(0);
      expect(h.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
