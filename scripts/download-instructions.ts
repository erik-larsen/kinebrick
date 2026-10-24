// Downloads the building instructions of every real LEGO set KineBrick has a model of (each set
// in models/technic-sets.csv with an omr_url, and each in models/) into omr/instructions/, and
// writes what it found into the set's data/sets/<set>.json, as its imported.instructions. LEGO's
// own PDFs where its site has them (omr/instructions/<set>-<n>.pdf, in the order its site lists
// them, which isn't always the books' order); otherwise the scans lego.brickinstructions.com has
// (omr/instructions/<set>/001.jpg, ...). A file already downloaded isn't downloaded again. A set
// whose pages can't be read (no network) keeps what its file had. omr/ isn't committed.
//
// Run with: npm run instructions (or npm run instructions -- 855 8880, for only those sets)

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CSV = 'models/technic-sets.csv';
const OUT_DIR = join('omr', 'instructions');
const SETS_DIR = join('data', 'sets');
const HEADERS = { 'User-Agent': 'Mozilla/5.0' };

interface Book {
  url: string;
  file?: string; // a PDF
  folder?: string; // a book of scans
  pages?: number;
}

// The fields of a CSV line. Fields may be quoted, with commas inside.
function csvFields(line: string): string[] {
  return [...line.matchAll(/("([^"]*(?:""[^"]*)*)"|[^,]*)(,|$)/g)].slice(0, -1).map((m) => (m[2] !== undefined ? m[2].replaceAll('""', '"') : m[1]));
}

async function page(url: string): Promise<string> {
  const response = await fetch(url, { headers: HEADERS });
  if (!response.ok) throw new Error(`${response.status} for ${url}`);
  return response.text();
}

// A file, downloaded unless it's there already; null if the site has no such file.
async function download(url: string, file: string): Promise<Buffer | null> {
  if (existsSync(file)) return readFileSync(file);
  const response = await fetch(url, { headers: HEADERS });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`${response.status} for ${url}`);
  const data = Buffer.from(await response.arrayBuffer());
  writeFileSync(file, data);
  return data;
}

// A set's books: LEGO's PDFs, or else brickinstructions.com's scans, or none.
async function books(set: string): Promise<Book[]> {
  const number = set.replace(/-\d+$/, '');
  const ids = [...new Set((await page(`https://www.lego.com/en-us/service/building-instructions/${number}`)).match(/product\.bi\.core\.pdf\/\d+\.pdf/g) ?? [])].map((m) => m.replace(/\D+(\d+)\.pdf$/, '$1'));
  if (ids.length) {
    const found: Book[] = [];
    for (const [i, id] of ids.entries()) {
      const url = `https://www.lego.com/cdn/product-assets/product.bi.core.pdf/${id}.pdf`;
      const file = join(OUT_DIR, `${set}-${i + 1}.pdf`);
      if (!(await download(url, file))) throw new Error(`no ${url}`);
      found.push({ url, file });
    }
    return found;
  }
  const url = `https://lego.brickinstructions.com/en/lego_instructions/set/${number}`;
  const scans = [...new Set((await page(url)).match(/https:\/\/lego\.brickinstructions\.com\/instructions\/\d+\/\d+\/\d+\.jpg/g) ?? [])].sort();
  const folder = join(OUT_DIR, set);
  if (scans.length) mkdirSync(folder, { recursive: true });
  let pages = 0;
  for (const scan of scans) {
    const file = join(folder, scan.replace(/^.*\//, ''));
    const fresh = !existsSync(file);
    const data = await download(scan, file);
    // Only a JPEG is a page: the site lists some it hasn't got, or answers with a page of its own.
    if (data && data[0] === 0xff && data[1] === 0xd8) pages++;
    else if (data) rmSync(file);
    if (fresh) await new Promise((resolve) => setTimeout(resolve, 200)); // gently, one at a time
  }
  return pages ? [{ url, folder: `${folder}/`, pages }] : [];
}

const filters = process.argv.slice(2);
const lines = readFileSync(CSV, 'utf-8').trim().split(/\r?\n/);
const header = csvFields(lines[0]);
const inModels = new Set(readdirSync('models').flatMap((f) => /^(\d+)-.*\.mpd$/.exec(f)?.[1] ?? []));
const sets = lines
  .slice(1)
  .map((line) => Object.fromEntries(header.map((name, i) => [name, csvFields(line)[i] ?? ''])))
  .filter((s) => s.omr_url || inModels.has(s.set_num.replace(/-\d+$/, '')))
  .map((s) => s.set_num)
  .filter((s) => filters.length === 0 || filters.some((f) => s.includes(f)));

mkdirSync(OUT_DIR, { recursive: true });
for (const set of sets) {
  const path = join(SETS_DIR, `${set}.json`);
  const data = existsSync(path) ? JSON.parse(readFileSync(path, 'utf-8')) : { set, imported: {}, curated: {}, generated: {} };
  let found: Book[];
  try {
    found = await books(set);
  } catch (err) {
    console.log(`${set}: ${(err as Error).message}, so its file keeps what it had`);
    continue;
  }
  const before = JSON.stringify(data.imported.instructions);
  data.imported.instructions = found;
  if (JSON.stringify(found) === before) continue;
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
  console.log(`${set}: ${found.length ? found.map((b) => b.file ?? `${b.pages} pages of scans`).join(', ') : 'no instructions found'}`);
}
