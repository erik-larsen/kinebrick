import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { importSet, modelFiles, modelSettings } from '../src/ldr.ts';

// KineBrick's own lines for each real LEGO set, by its name in models/, from data/sets/.
const sets: Record<string, string[]> = {};
for (const file of readdirSync('data/sets').filter((f) => f.endsWith('.json'))) {
  Object.assign(sets, JSON.parse(readFileSync(`data/sets/${file}`, 'utf-8')).curated.settings);
}
// The real LEGO sets in models/, by name.
const models = readdirSync('models').filter((f) => /^\d+-.*\.mpd$/.test(f)).map((f) => f.replace(/\.mpd$/, ''));

// A set as the LDraw Official Model Repository has it: its files named "956 - ...", with CRLF
// line endings, and an LDCad line naming another of its files.
const FRESH = [
  '0 FILE 956 - main.ldr',
  '0 main',
  '0 Name: 956 - main.ldr',
  '0 !LDRAW_ORG Model',
  '0 !LICENSE Redistributable under CCAL version 2.0 : see CAreadme.txt',
  '',
  '1 14 0 0 0 1 0 0 0 1 0 0 0 1 956 - chassis.ldr',
  '0 FILE 956 - chassis.ldr',
  '0 !LICENSE Redistributable under CCAL version 2.0 : see CAreadme.txt',
  '0 !LDCAD GENERATED [generator=LDCad 1.6b] [master=956 - chassis.ldr]',
  '1 4 0 0 0 1 0 0 0 1 0 0 0 1 3702.dat',
  '',
].join('\r\n');

// A set's own lines, as its file in data/sets/ has them.
const LINES = ['0 // KineBrick: its tyres scrub', '0 !KINEBRICK SCRUB [percent=16]'];

describe('Importing real LEGO sets', () => {
  it('leaves every set in models/ as it is: each is already imported, with its own lines from data/sets/', () => {
    for (const name of models) {
      const text = readFileSync(`models/${name}.mpd`, 'utf-8');
      expect(importSet(text, name.split('-')[0], sets[name] ?? []), name).toBe(text);
    }
  });

  it("renames a fresh set's files wherever they're named, and adds its lines after its main file's license", () => {
    const out = importSet(FRESH, '956', LINES);
    expect(out).not.toContain(' - ');
    expect([...modelFiles(out).keys()]).toEqual(['956-main.ldr', '956-chassis.ldr']);
    expect(out).toContain('[master=956-chassis.ldr]');
    expect(out.split('\r\n').slice(4, 7)).toEqual(['0 !LICENSE Redistributable under CCAL version 2.0 : see CAreadme.txt', ...LINES]);
    expect(out.split('\r\n').length).toBe(FRESH.split('\r\n').length + 2); // line endings kept, and no lines added elsewhere
    expect(modelSettings(out).scrub).toBe(16);
  });

  it('changes nothing the second time, and replaces lines that have changed', () => {
    const once = importSet(FRESH, '956', ['0 !KINEBRICK SCRUB [percent=25]']);
    expect(importSet(once, '956', ['0 !KINEBRICK SCRUB [percent=25]'])).toBe(once);
    const changed = importSet(once, '956', ['0 !KINEBRICK SCRUB [percent=10]']);
    expect(modelSettings(changed).scrub).toBe(10);
    expect(changed).not.toContain('percent=25');
    expect(importSet(once, '956', [])).toBe(importSet(FRESH, '956', []));
  });
});
