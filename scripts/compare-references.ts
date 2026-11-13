// Shows that a set's curated part references still name the same parts after a change that adds
// or drops parts in how models are read (a part read as its pieces), which shifts their numbers:
// for each reference, the part it names now and the part it named at another commit must have
// the same name, colour and place. Run with: npx tsx scripts/compare-references.ts 851-1 42108-1
// [--against origin/preview]. Needs the sets' models (omr/ for the OMR's).

import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const at = args.indexOf('--against');
const ref = at >= 0 ? args[at + 1] : 'origin/preview';
const sets = args.filter((a, i) => !a.startsWith('--') && !(at >= 0 && i === at + 1));

// The parts of a set's model as the scripts read them, in the folder given: name, colour and place.
const PRINT = `
import { readFileSync } from 'node:fs';
import { Vector3 } from 'three';
import { readParts } from './scripts/load-model.ts';
const set = JSON.parse(readFileSync('data/sets/' + process.argv[2] + '.json', 'utf-8'));
const model = set.curated.model;
const parts = readParts(model, model.startsWith('omr/')).parts;
console.log(JSON.stringify(parts.map((p) => {
  const v = new Vector3().setFromMatrixPosition(p.matrix);
  return [p.name.replace(/^.* - /, '').toLowerCase(), p.color, [v.x, v.y, v.z].map((x) => Math.round(x * 1000) / 1000)];
})));
`;
const partsIn = (dir: string, set: string) => JSON.parse(execSync(`npx tsx print-parts.mts ${set}`, { cwd: dir, encoding: 'utf-8', maxBuffer: 1 << 28 }));

// The other commit's code and data, in a folder of its own, with the models and packages linked.
const old = mkdtempSync(join(tmpdir(), 'references-'));
execSync(`git archive ${ref} src scripts data packed models | tar -x -C "${old}"`);
for (const link of ['node_modules', 'omr']) symlinkSync(resolve(link), join(old, link));
const here = mkdtempSync(join(tmpdir(), 'references-'));
for (const link of ['node_modules', 'omr', 'src', 'scripts', 'data', 'packed', 'models']) symlinkSync(resolve(link), join(here, link));
for (const dir of [old, here]) execSync(`cat > print-parts.mts`, { cwd: dir, input: PRINT });

// Every "pNNN name" in a set's curated functions, in order, from the fields that name parts.
const PROSE = new Set(['does', 'source', 'note', 'mechanisms', 'model', 'skip']);
const references = (functions: Record<string, unknown>[]) =>
  functions.flatMap((fn) => Object.entries(fn).filter(([k]) => !PROSE.has(k)).flatMap(([, v]) => [...JSON.stringify(v).matchAll(/\bp(\d+) /g)].map((m) => Number(m[1]))));

let wrong = 0;
for (const set of sets) {
  const before = references(JSON.parse(execSync(`git show ${ref}:data/sets/${set}.json`, { encoding: 'utf-8' })).curated.functions);
  const after = references(JSON.parse(readFileSync(`data/sets/${set}.json`, 'utf-8')).curated.functions);
  const [oldParts, newParts] = [partsIn(old, set), partsIn(here, set)];
  const differ: string[] = [];
  if (before.length !== after.length) differ.push(`${before.length} references at ${ref}, ${after.length} now`);
  before.forEach((n, i) => {
    const [a, b] = [oldParts[n], newParts[after[i]]];
    if (JSON.stringify(a) !== JSON.stringify(b)) differ.push(`p${n} (${JSON.stringify(a)}) is now p${after[i]} (${JSON.stringify(b)})`);
  });
  const moved = before.filter((n, i) => n !== after[i]).length;
  console.log(`${set}: ${before.length} references, ${moved} renumbered; ${differ.length ? differ.length + ' name another part:' : 'each names the same part (name, colour and place) as at ' + ref}`);
  for (const d of differ) console.log('  ' + d);
  wrong += differ.length;
}
rmSync(old, { recursive: true, force: true });
rmSync(here, { recursive: true, force: true });
process.exit(wrong ? 1 : 0);
