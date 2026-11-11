// Writes the status page: every OMR set as a box, sized by its number of pieces and coloured by
// the share of its checked functions that work, and why the functions that don't work don't, by
// cause (see docs/plan.md, "What Erik sees"). It reads each
// set's results from data/sets/ (written by npm run functions) and its name, year and piece count
// from models/technic-sets.csv, and puts them into the page in scripts/status-page.html.
//
//   npm run status                 writes dist/status.html
//   npm run status -- some/file    writes it there instead
//   npm run status -- --trains     the train sets' page instead (see docs/plan.md, "The train
//                                  track"), from data/trains/ and models/train-sets.csv: every set
//                                  with track, each linked to its model in the preview-train
//                                  viewer; written to dist/trains.html

import { execSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { CAUSES } from './causes.ts';

const trains = process.argv.includes('--trains');
const SETS_DIR = trains ? join('data', 'trains') : join('data', 'sets');
const out = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? join('dist', trains ? 'trains.html' : 'status.html');
const TRAIN_VIEWER = 'https://erik-larsen.github.io/kinebrick/preview-train/?train=';

// The fields of a CSV line. Fields may be quoted, with commas inside.
function csvFields(line: string): string[] {
  return [...line.matchAll(/("([^"]*(?:""[^"]*)*)"|[^,]*)(,|$)/g)].slice(0, -1).map((m) => (m[2] !== undefined ? m[2].replaceAll('""', '"') : m[1]));
}

// A model file's name as the viewer knows it: "models/855-Mobile Crane.mpd" is "855-Mobile Crane".
const modelName = (file: string | undefined) => (file ?? '').replace(/^.*\//, '').replace(/\.(ldr|mpd)$/i, '');

const lines = readFileSync(trains ? 'models/train-sets.csv' : 'models/technic-sets.csv', 'utf-8').trim().split('\n');
const header = csvFields(lines[0]);
const rows = lines.slice(1).map((line) => Object.fromEntries(header.map((name, i) => [name, csvFields(line)[i] ?? ''])));
const csv = new Map(rows.map((row) => [row.set_num, row]));

// The models the viewer has, so a set built in one links to it on the preview site.
const viewerModels = new Set(Object.keys(JSON.parse(readFileSync('packed/models.json', 'utf-8'))));

// One entry per set that has results: what the page shows for it.
const sets = [];
for (const file of readdirSync(SETS_DIR).filter((f) => f.endsWith('.json'))) {
  const set = JSON.parse(readFileSync(join(SETS_DIR, file), 'utf-8'));
  const results = set.generated?.functions ?? [];
  if (results.length === 0 || (trains && !csv.has(set.set))) continue;
  const row: Record<string, string> = csv.get(set.set) ?? {};
  const curated = set.curated?.functions ?? [];
  sets.push({
    set: set.set,
    name: row.name ?? '',
    year: Number(row.year) || 0,
    pieces: Number(row.parts) || Number(row.omr_parts) || 1,
    loose: (set.generated.loose ?? []).length,
    // Its model's name in the viewer, if the viewer has it, and its page in the OMR.
    viewer: viewerModels.has(modelName(set.curated?.model)) ? modelName(set.curated?.model) : '',
    omr: row.omr_url ?? '',
    ...(trains ? { link: TRAIN_VIEWER + encodeURIComponent(modelName(set.curated?.model) + '.mpd') } : {}),
    // Each function: what it does, its result, and if it doesn't work, why (see causes.ts) and the part that's about.
    functions: results.map((r: { result: string; cause?: string; detail?: string }, i: number) => [String(curated[i]?.does ?? '').slice(0, 160), r.result, r.cause ?? '', r.detail ?? '']),
  });
}

// On the train sets' page, every set with track has a box: those not checked yet too.
if (trains) {
  for (const row of rows) {
    if (sets.some((s) => s.set === row.set_num)) continue;
    sets.push({ set: row.set_num, name: row.name, year: Number(row.year) || 0, pieces: Number(row.parts) || 1, loose: 0, viewer: '', omr: row.omr_url ?? '', functions: [] });
  }
}

const commit = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
const data = { commit, date: new Date().toISOString().slice(0, 10), causes: CAUSES, sets, ...(trains ? { title: 'Every OMR set with train track, by how much of it works' } : {}) };
const page = readFileSync(join('scripts', 'status-page.html'), 'utf-8').replace('/*DATA*/null', () => JSON.stringify(data).replaceAll('</', '<\\/'));
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, page);
console.log(`${sets.length} sets written to ${out}`);
