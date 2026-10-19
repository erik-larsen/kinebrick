// Downloads every Technic set in models/technic-sets.csv that the LDraw Official Model Repository
// has (its omr_url column) into omr/, for npm run scan. Each set's page links its model file; a
// set already downloaded is skipped. omr/ isn't committed.
//
// Run with: npm run omr

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT_DIR = 'omr';

// The rows of a CSV file, as records by column name. Fields may be quoted, with commas inside.
function readCsv(text: string): Record<string, string>[] {
  const rows = text.trim().split(/\r?\n/).map((line) => [...line.matchAll(/("([^"]*(?:""[^"]*)*)"|[^,]*)(,|$)/g)].slice(0, -1).map((m) => (m[2] !== undefined ? m[2].replaceAll('""', '"') : m[1])));
  const [header, ...body] = rows;
  return body.map((row) => Object.fromEntries(header.map((name, i) => [name, row[i] ?? ''])));
}

mkdirSync(OUT_DIR, { recursive: true });
const sets = readCsv(readFileSync('models/technic-sets.csv', 'utf-8')).filter((set) => set.omr_url);
for (const set of sets) {
  const base = `${set.set_num} ${set.name}`.replace(/[/\\:]/g, '-');
  if (['.mpd', '.ldr'].some((ext) => existsSync(join(OUT_DIR, base + ext)))) continue;
  const page = await (await fetch(set.omr_url)).text();
  const link = /https:\/\/library\.ldraw\.org\/media\/omr_models\/[^"'\s]+\.(mpd|ldr)(\?[^"'\s]*)?/.exec(page);
  if (!link) {
    console.log(`${set.set_num}: no model file on ${set.omr_url}`);
    continue;
  }
  const response = await fetch(link[0].replaceAll('&amp;', '&'));
  if (!response.ok) {
    console.log(`${set.set_num}: ${response.status} for ${link[0]}`);
    continue;
  }
  writeFileSync(join(OUT_DIR, `${base}.${link[1]}`), await response.text());
  console.log(`${set.set_num} ${set.name}`);
}
