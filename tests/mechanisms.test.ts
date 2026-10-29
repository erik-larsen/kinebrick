import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// data/mechanisms.json lists the kinds of mechanism, and each curated function in
// data/sets/<set>.json lists the kinds it uses in `mechanisms`, each a kind, optionally with a
// colon and a detail ("piston-engine: V8"). The catalog in docs/mechanisms/ is made from them.
const vocabulary: { families: string[]; kinds: { kind: string; name: string; family: string; means: string }[] } = JSON.parse(readFileSync('data/mechanisms.json', 'utf-8'));
const known = new Set(vocabulary.kinds.map((k) => k.kind));
const sets = readdirSync('data/sets')
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(`data/sets/${f}`, 'utf-8')));

describe('the mechanism kinds', () => {
  it('each have a name, a family of those listed and what they mean, once each', () => {
    expect(known.size).toBe(vocabulary.kinds.length);
    for (const k of vocabulary.kinds) {
      expect(k.kind, k.kind).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(k.name.trim(), k.kind).not.toBe('');
      expect(k.means.trim(), k.kind).not.toBe('');
      expect(vocabulary.families, k.kind).toContain(k.family);
    }
  });

  it('cover every curated function, with kinds that are listed', () => {
    for (const set of sets) {
      set.curated.functions.forEach((f: any, i: number) => {
        const where = `${set.set} function ${i}`;
        expect(Array.isArray(f.mechanisms) && f.mechanisms.length > 0, `${where} has no mechanisms`).toBe(true);
        for (const tag of f.mechanisms) expect(known, `${where}: ${tag}`).toContain(tag.split(': ')[0]);
      });
    }
  });
});

describe('the mechanism catalog', () => {
  it('is up to date with the kinds and the tags: written afresh, every page is as it is in docs/mechanisms/', () => {
    const fresh = mkdtempSync(join(tmpdir(), 'mechanisms-'));
    try {
      execFileSync('npx', ['tsx', 'scripts/mechanisms.ts', fresh]);
      const pages = readdirSync(fresh).sort();
      expect(readdirSync('docs/mechanisms').sort()).toEqual(pages);
      for (const page of pages) expect(readFileSync(join('docs/mechanisms', page), 'utf-8'), `${page}: run npm run mechanisms`).toBe(readFileSync(join(fresh, page), 'utf-8'));
    } finally {
      rmSync(fresh, { recursive: true, force: true });
    }
  }, 60000);
});
