import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applyErrata, type Errata, setOfFile } from '../src/errata.ts';
import { parseModel } from '../src/ldr.ts';
import { readErrata } from '../scripts/load-model.ts';
import { PAGE, pageWithSection } from '../scripts/errata.ts';

// A small model: a main model placing a submodel and a part.
const MODEL = ['0 FILE main.ldr', '1 16 0 0 0 1 0 0 0 1 0 0 0 1 sub.ldr', '1 4 0 -24 0 1 0 0 0 1 0 0 0 1 3001.dat', '', '0 FILE sub.ldr', '1 1 0 0 0 1 0 0 0 1 0 0 0 1 3003.dat', '1 2 40 0 0 1 0 0 0 1 0 0 0 1 3004.dat', ''].join('\n');
const names = (text: string) => parseModel(text).parts.map((p) => p.name);
const at = (text: string, n: number) => parseModel(text).parts[n].matrix.elements.slice(12, 15);
const errata = (entries: Errata['entries']): Errata => ({ set: 'test', entries });
const signed = { by: 'Erik', date: '2026-11-14' };

describe('errata', () => {
  it('find the set of an OMR model file, and no other', () => {
    expect(setOfFile('omr/42064-1 Ocean Explorer.mpd')).toBe('42064-1');
    expect(setOfFile('models/8880-Super Car.mpd')).toBe(null);
    expect(setOfFile('my-car.mpd')).toBe(null);
  });

  it('move a part, which keeps its number', () => {
    const { text, applied } = applyErrata(MODEL, errata([{ id: 'm', what: 'move', file: 'sub.ldr', line: '1 2 40 0 0 1 0 0 0 1 0 0 0 1 3004.dat', part: 'p1 3004', position: [40, 8, 0], evidence: '', signedOff: signed }]), false, (n) => parseModel(MODEL).parts[n]?.name);
    expect(applied).toEqual(['m']);
    expect(names(text)).toEqual(names(MODEL));
    expect(at(text, 1)).toEqual([40, 8, 0]);
  });

  it('add parts after every other part, the pieces numbered after the model included, so no number moves', () => {
    const pieces = (name: string) => (name === '3005.dat' ? ['0 !KINEBRICK PIECES AFTER', '1 16 0 0 0 1 0 0 0 1 0 0 0 1 3006.dat', '1 16 0 8 0 1 0 0 0 1 0 0 0 1 3007.dat'] : null);
    const model = MODEL.replace('1 4 0 -24 0 1 0 0 0 1 0 0 0 1 3001.dat', '1 4 0 -24 0 1 0 0 0 1 0 0 0 1 3001.dat\n1 4 0 -48 0 1 0 0 0 1 0 0 0 1 3005.dat');
    const { text } = applyErrata(model, errata([{ id: 'a', what: 'add', lines: ['1 14 0 -72 0 1 0 0 0 1 0 0 0 1 3010.dat'], evidence: '', signedOff: signed }]), false, null);
    const before = parseModel(model, () => false, pieces).parts.map((p) => p.name);
    const after = parseModel(text, () => false, pieces).parts.map((p) => p.name);
    expect(after.slice(0, before.length)).toEqual(before);
    expect(after.slice(before.length)).toEqual(['3010.dat']);
  });

  it('remove a part, which keeps its number, marked removed, with no connection points', () => {
    const { text, applied } = applyErrata(MODEL, errata([{ id: 'r', what: 'remove', file: 'sub.ldr', line: '1 1 0 0 0 1 0 0 0 1 0 0 0 1 3003.dat', part: 'p0 3003', evidence: '', signedOff: signed }]), false, (n) => parseModel(MODEL).parts[n]?.name);
    expect(applied).toEqual(['r']);
    const parts = parseModel(text).parts;
    expect(parts.map((p) => p.name)).toEqual(names(MODEL));
    expect(parts.map((p) => !!p.removed)).toEqual([true, false, false]);
  });

  it('refuse an entry whose line is not found once, or whose number names another part', () => {
    const wrongLine = applyErrata(MODEL, errata([{ id: 'w', what: 'move', file: 'sub.ldr', line: '1 2 44 0 0 1 0 0 0 1 0 0 0 1 3004.dat', position: [0, 0, 0], evidence: '', signedOff: signed }]), false, null);
    expect(wrongLine.applied).toEqual([]);
    expect(wrongLine.refused[0]).toMatch(/found 0 times/);
    expect(wrongLine.text).toBe(MODEL);
    const wrongPart = applyErrata(MODEL, errata([{ id: 'n', what: 'move', file: 'sub.ldr', line: '1 2 40 0 0 1 0 0 0 1 0 0 0 1 3004.dat', part: 'p0 3004', position: [0, 0, 0], evidence: '', signedOff: signed }]), false, (n) => parseModel(MODEL).parts[n]?.name);
    expect(wrongPart.refused[0]).toMatch(/p0 is 3003.dat/);
  });

  it('apply an entry not yet signed off only when asked to', () => {
    const entry = errata([{ id: 'p', what: 'move', file: 'sub.ldr', line: '1 1 0 0 0 1 0 0 0 1 0 0 0 1 3003.dat', position: [0, 8, 0], evidence: '', signedOff: null }]);
    expect(applyErrata(MODEL, entry, false, null).applied).toEqual([]);
    expect(applyErrata(MODEL, entry, true, null).applied).toEqual(['p']);
  });

  it("apply each set's entries to its own OMR file: each line found once, each number naming its part", () => {
    for (const [set, file] of [['42064-1', 'omr/42064-1 Ocean Explorer.mpd'], ['8258-1', 'omr/8258-1 Crane Truck.mpd'], ['9396-1', 'omr/9396-1 Helicopter.mpd'], ['8838-1', 'omr/8838-1 Shock Cycle.mpd'], ['42083-1', 'omr/42083-1 Bugatti Chiron.mpd'], ['42109-1', 'omr/42109-1 App-Controlled Top Gear Rally Car.mpd']]) {
      const original = readFileSync(file, 'utf-8');
      const found = readErrata(file);
      expect(found?.set).toBe(set);
      const { refused, applied } = applyErrata(original, found, true, null);
      expect(refused, set).toEqual([]);
      expect(applied.length, set).toBe(found!.entries.length);
    }
  });

  it('are listed on the errata page as the entries have them (npm run errata)', () => {
    const page = readFileSync(PAGE, 'utf-8');
    expect(pageWithSection(page)).toBe(page);
  });
});
