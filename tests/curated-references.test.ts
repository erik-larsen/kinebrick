import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readParts } from '../scripts/load-model.ts';

// A set's curated functions (data/sets/<set>.json) name parts by their number in the model as
// the scripts read it, with the part's name after it: "p1271 32524". Anything that adds a part
// or drops one (how a model is read, a correction, a fix to its file) shifts every number after
// it, and the function check then works the wrong parts. Each reference's name must be that of
// the part at its number. Sets from the OMR are checked only where omr/ has been downloaded.
const sets = readdirSync('data/sets')
  .filter((f) => f.endsWith('.json'))
  .map((f) => ({ file: f, data: JSON.parse(readFileSync(`data/sets/${f}`, 'utf-8')) }))
  .filter((s) => s.data.curated?.functions?.length);

// The functions' fields that name parts; the rest (what it does, its source, a note) are prose.
const PROSE = new Set(['does', 'source', 'note', 'mechanisms', 'model', 'skip']);

// Every "pNNNN name" in a function's fields that name parts, keys included.
function references(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(...(value.match(/\bp\d+ .*?(?= against |$)/g) ?? []));
  else if (Array.isArray(value)) for (const v of value) references(v, out);
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) references([k, v], out);
  return out;
}

describe('curated part references', () => {
  for (const { file, data } of sets) {
    const models = new Set<string>([data.curated.model, ...data.curated.functions.flatMap((fn: { model?: string }) => (fn.model ? [fn.model] : []))]);
    it.skipIf([...models].some((m) => !existsSync(m)))(`name the parts at their numbers in ${file}`, () => {
      const names = new Map([...models].map((m) => [m, readParts(m, m.startsWith('omr/')).parts.map((p) => p.name.replace(/\.dat$/i, ''))]));
      const wrong: string[] = [];
      data.curated.functions.forEach((fn: Record<string, unknown>, i: number) => {
        const parts = names.get((fn.model as string) ?? data.curated.model)!;
        for (const ref of references(Object.entries(fn).filter(([k]) => !PROSE.has(k)).map(([, v]) => v))) {
          const [, n, name] = /^p(\d+) (.*)$/.exec(ref)!;
          if (parts[Number(n)]?.toLowerCase() !== name.trim().toLowerCase()) wrong.push(`function ${i + 1}: ${ref} is ${parts[Number(n)] ?? 'no part'}`);
        }
      });
      expect(wrong).toEqual([]);
    });
  }
});
