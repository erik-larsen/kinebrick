// Checks that the check's part shapes (scripts/part-shapes.ts) match the model's parts one for one,
// by name, for every model the Technic sets use (data/sets: each set's model and its functions'
// own models), as the check's guard does (shapesHere in scripts/check-functions.ts), and that a part
// has no shape only where the reading says why (partShapes' `empty`, which it lists). Each model is
// read in a child process of its own, one at a time, so memory doesn't build up.
//
// Run through the machine's pool (decision 229):
//   npx tsx scripts/check-pool.ts run --mb 2000 --what "part shapes scan" -- npx tsx scripts/scan-part-shapes.ts
// It prints one line for each model that doesn't match, and a count at the end; it exits with 1 if
// any doesn't. With --model <file> it reads that one model only (what each child does).
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizePartName } from '../src/connections.ts';
import { readParts } from './load-model.ts';
import { partShapes } from './part-shapes.ts';

const args = process.argv.slice(2);
const at = args.indexOf('--model');
if (at >= 0) {
  // One model: its parts as the check reads them, and the shapes given their names.
  const model = args[at + 1];
  const read = readParts(model, model.startsWith('omr/'));
  const shapes = await partShapes(model, read.text, read.parts);
  const wrong = read.parts.findIndex((p, i) => !shapes[i] || shapes[i].name !== normalizePartName(p.name));
  if (wrong >= 0) {
    console.log(`${model}: part ${wrong} is ${read.parts[wrong].name}, its shape ${shapes[wrong]?.name ?? 'missing'}`);
    process.exit(1);
  }
  // A part with no shape is wrong unless the reading says why (see partShapes' `empty`).
  const bare = read.parts.findIndex((p, i) => shapes[i].shape.length === 0 && !shapes[i].empty);
  if (bare >= 0) {
    console.log(`${model}: part ${bare} is ${read.parts[bare].name}, with no shape and no reason`);
    process.exit(1);
  }
  const empty = read.parts.flatMap((p, i) => (shapes[i].empty ? [`${i} ${p.name} (${shapes[i].empty})`] : []));
  console.log(`${model}: ${read.parts.length} parts match, ${empty.length} of them with no shape${empty.length ? `: ${empty.join(', ')}` : ''}`);
} else {
  // Every model the sets use, each in a child of its own.
  const models = new Set<string>();
  for (const file of readdirSync(join('data', 'sets')).filter((f) => f.endsWith('.json'))) {
    const set = JSON.parse(readFileSync(join('data', 'sets', file), 'utf-8'));
    if (set.curated?.model) models.add(set.curated.model);
    for (const fn of set.curated?.functions ?? []) if (fn.model) models.add(fn.model);
  }
  let bad = 0;
  for (const model of [...models].sort()) {
    const child = spawnSync(process.execPath, [...process.execArgv, process.argv[1], '--model', model], { encoding: 'utf-8' });
    const said = child.stdout.trim() || child.stderr.trim().split('\n').filter((line) => /Error/.test(line)).join(' ');
    if (child.status !== 0) {
      bad++;
      console.log(`no: ${said || model}`);
    } else console.log(said);
  }
  console.log(`${models.size - bad} of ${models.size} models match their parts`);
  if (bad) process.exit(1);
}
