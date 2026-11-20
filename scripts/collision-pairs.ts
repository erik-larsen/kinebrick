// Keeps the viewer's first collision pass for each model the sets use (see nearPairsOf in
// src/collisions.ts): every pair of parts whose boxes meet as built, whatever bodies they're on,
// and which of them are near, in data/collisions/<model>.json under the key it depends on (see
// collisionKey). The viewer then needn't find them: on the 42114 that saves 4.5 s of tests.
// tests/collision-pairs.test.ts fails when a kept file's key no longer matches its model.
//
//   npm run collisions                 every model the sets use whose kept file is missing, or
//                                      whose key no longer matches (the model, how its parts are cut into pieces, or the library changed)
//   npm run collisions -- 42114 8012   only models whose file name has one of these in it
//   npm run collisions -- --force      worked out again even where the key matches
//
// The largest models (the 42082, 42083, 42100, 42115 and 42131) take about 8 GB to work out,
// more than node's usual heap, so the script in package.json gives it 12 GB.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { collisionKey, keptFileName, libraryRelease, nearPairsOf } from '../src/collisions.ts';
import { readParts } from './load-model.ts';
import { partShapes } from './part-shapes.ts';

export const DIR = 'data/collisions';
export const RELEASE_FILE = `${DIR}/library.json`;

// Every model a set's functions are checked on, and Kinebrick's own models.
export function keptModels(): string[] {
  const models = new Set<string>();
  for (const f of readdirSync('data/sets').filter((f) => f.endsWith('.json'))) {
    const curated = JSON.parse(readFileSync(`data/sets/${f}`, 'utf-8')).curated ?? {};
    for (const m of [curated.model, ...(curated.functions ?? []).map((fn: { model?: string }) => fn.model)]) if (m && existsSync(m)) models.add(m);
  }
  return [...models].sort();
}

// The kept file's name for a model (see keptFileName).
export const keptName = keptFileName;

// The model's text as the viewer reads it: a set's file from the OMR with its signed errata.
export const modelText = (model: string) => readParts(model, model.startsWith('omr/')).text;

// The model's parts as the viewer reads them, in its order: what a kept file's key is made from.
export const modelParts = (model: string) => readParts(model, model.startsWith('omr/')).parts;

if (process.argv[1]?.endsWith('collision-pairs.ts')) {
  const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const force = process.argv.includes('--force');
  const release = libraryRelease(readFileSync('ldraw/LDConfig.ldr', 'utf-8'));
  mkdirSync(DIR, { recursive: true });
  writeFileSync(RELEASE_FILE, JSON.stringify({ release }, null, 2) + '\n');
  for (const model of keptModels().filter((m) => !only.length || only.some((o) => m.includes(o)))) {
    const start = Date.now();
    const { parts, text } = readParts(model, model.startsWith('omr/'));
    const key = await collisionKey(parts, release);
    const file = `${DIR}/${keptName(model)}.json`;
    if (!force && existsSync(file) && JSON.parse(readFileSync(file, 'utf-8')).key === key) continue;
    // The viewer's shapes: its parts' meshes, the first of the packed model's objects; a path's
    // parts (a chain's links) have none.
    const shapes = (await partShapes(model, text, parts.map((p) => p.name))).slice(0, parts.length).map((s, i) => (parts[i].path ? [] : s.shape));
    const { tested, near } = nearPairsOf(shapes, parts.map((p) => p.matrix));
    writeFileSync(file, JSON.stringify({ key, tested: tested.length, near }) + '\n');
    console.log(`${keptName(model)}: ${parts.length} parts, ${tested.length} pairs meet, ${near.length} near (${((Date.now() - start) / 1000).toFixed(1)} s)`);
  }
}
