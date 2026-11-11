// Writes the status page: every OMR set as a box, sized by its number of pieces and coloured by
// the share of its checked functions that work (see docs/plan.md, "What Erik sees"). It reads each
// set's results from data/sets/ (written by npm run functions) and its name, year and piece count
// from models/technic-sets.csv, and puts them into the page in scripts/status-page.html.
//
//   npm run status                 writes dist/status.html
//   npm run status -- some/file    writes it there instead

import { execSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const SETS_DIR = join('data', 'sets');
const out = process.argv[2] ?? join('dist', 'status.html');

// The fields of a CSV line. Fields may be quoted, with commas inside.
function csvFields(line: string): string[] {
  return [...line.matchAll(/("([^"]*(?:""[^"]*)*)"|[^,]*)(,|$)/g)].slice(0, -1).map((m) => (m[2] !== undefined ? m[2].replaceAll('""', '"') : m[1]));
}

const lines = readFileSync('models/technic-sets.csv', 'utf-8').trim().split('\n');
const header = csvFields(lines[0]);
const rows = lines.slice(1).map((line) => Object.fromEntries(header.map((name, i) => [name, csvFields(line)[i] ?? ''])));
const csv = new Map(rows.map((row) => [row.set_num, row]));

// One entry per set that has results: what the page shows for it.
const sets = [];
for (const file of readdirSync(SETS_DIR).filter((f) => f.endsWith('.json'))) {
  const set = JSON.parse(readFileSync(join(SETS_DIR, file), 'utf-8'));
  const results = set.generated?.functions ?? [];
  if (results.length === 0) continue;
  const row: Record<string, string> = csv.get(set.set) ?? {};
  const curated = set.curated?.functions ?? [];
  sets.push({
    set: set.set,
    name: row.name ?? '',
    year: Number(row.year) || 0,
    pieces: Number(row.parts) || Number(row.omr_parts) || 1,
    loose: (set.generated.loose ?? []).length,
    // Each function: what it does, and its result.
    functions: results.map((r: { result: string }, i: number) => [String(curated[i]?.does ?? '').slice(0, 160), r.result]),
  });
}

const commit = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
const data = { commit, date: new Date().toISOString().slice(0, 10), sets };
const page = readFileSync(join('scripts', 'status-page.html'), 'utf-8').replace('/*DATA*/null', () => JSON.stringify(data).replaceAll('</', '<\\/'));
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, page);
console.log(`${sets.length} sets written to ${out}`);
