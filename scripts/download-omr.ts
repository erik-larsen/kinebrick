// Downloads every Technic set in models/technic-sets.csv that the LDraw Official Model Repository
// has (its omr_url column) into omr/, for npm run scan. omr/ isn't committed.
//
// Each set's file is pinned: its omr_file column holds the exact version to download (the OMR's
// file address, with the version it gives each upload, "?v=..."), so the scan always reads the same
// files. A set with no omr_file yet is looked up on its OMR page, and the version found there is
// written into the column. To take a newer version of a set, empty its omr_file and run this again.
// omr/versions.json says which version each downloaded file is, so a file is downloaded again
// only when its pin changes.
//
// Run with: npm run omr

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CSV = 'models/technic-sets.csv';
const OUT_DIR = 'omr';
const VERSIONS = join(OUT_DIR, 'versions.json');

// The fields of a CSV line. Fields may be quoted, with commas inside.
function csvFields(line: string): string[] {
  return [...line.matchAll(/("([^"]*(?:""[^"]*)*)"|[^,]*)(,|$)/g)].slice(0, -1).map((m) => (m[2] !== undefined ? m[2].replaceAll('""', '"') : m[1]));
}

const text = readFileSync(CSV, 'utf-8');
const eol = text.includes('\r\n') ? '\r\n' : '\n';
const lines = text.replace(/(\r?\n)+$/, '').split(/\r?\n/);
const header = csvFields(lines[0]);
const hasPins = header.includes('omr_file');
const sets = lines.slice(1).map((line) => Object.fromEntries((hasPins ? header : [...header, 'omr_file']).map((name, i) => [name, csvFields(line)[i] ?? ''])));

mkdirSync(OUT_DIR, { recursive: true });
const versions: Record<string, string> = existsSync(VERSIONS) ? JSON.parse(readFileSync(VERSIONS, 'utf-8')) : {};
let pinned = 0;
for (const set of sets) {
  if (!set.omr_url) continue;
  if (!set.omr_file) {
    const page = await (await fetch(set.omr_url)).text();
    const link = /https:\/\/library\.ldraw\.org\/media\/omr_models\/[^"'\s]+\.(mpd|ldr)(\?[^"'\s]*)?/.exec(page);
    if (!link) {
      console.log(`${set.set_num}: no model file on ${set.omr_url}`);
      continue;
    }
    set.omr_file = link[0].replaceAll('&amp;', '&');
    pinned++;
  }
  const ext = /\.(mpd|ldr)(\?|$)/.exec(set.omr_file)?.[1] ?? 'mpd';
  const file = `${set.set_num} ${set.name}`.replace(/[/\\:]/g, '-') + '.' + ext;
  if (versions[file] === set.omr_file && existsSync(join(OUT_DIR, file))) continue;
  const response = await fetch(set.omr_file);
  if (!response.ok) {
    console.log(`${set.set_num}: ${response.status} for ${set.omr_file}`);
    continue;
  }
  writeFileSync(join(OUT_DIR, file), await response.text());
  versions[file] = set.omr_file;
  console.log(`${set.set_num} ${set.name}`);
}
writeFileSync(VERSIONS, JSON.stringify(versions, null, 2) + '\n');

// New pins go into the CSV: each line as it was, with its omr_file at the end (an address needs no
// quoting), so the rest of the file is untouched.
if (pinned || !hasPins) {
  const out = lines.map((line, i) => {
    if (i === 0) return hasPins ? line : `${line},omr_file`;
    if (!hasPins) return `${line},${sets[i - 1].omr_file}`;
    const fields = csvFields(line);
    const column = header.indexOf('omr_file');
    if (fields[column] === sets[i - 1].omr_file) return line;
    // Only a set pinned just now changes: its empty last field gets the address.
    return line.replace(/,$/, `,${sets[i - 1].omr_file}`);
  });
  writeFileSync(CSV, out.join(eol) + eol);
  console.log(`Pinned ${pinned} sets in ${CSV}`);
}
