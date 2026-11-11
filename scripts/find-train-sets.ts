// Finds every set in the LDraw Official Model Repository that includes train track, in any
// theme, and writes them to models/train-sets.csv. It reads the OMR's list of sets, downloads each
// set's main model into omr/all/ (once: a file already there is read again, not downloaded), and
// looks for track pieces in it, by their titles in the LDraw library (see trackSystem). A set's
// line says which kinds of track it has, how many pieces of each, and the exact file to download
// (omr_file), so that npm run omr -- --trains downloads the same files each time.
//
// Technic sets are left out: none has track. Track built of separate rails with a 12V centre
// rail counts as 12V, rails and all.
//
// Run with: npx tsx scripts/find-train-sets.ts

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OMR = 'https://library.ldraw.org/omr/sets';
const CACHE = join('omr', 'all');
const CSV = 'models/train-sets.csv';
// How many downloads run at once.
const AT_ONCE = 4;

mkdirSync(CACHE, { recursive: true });

// Which kind of track a part is, by its title in the LDraw library ("Train Track  9V Curved"),
// following a part that has moved to another number; or null if it isn't track. The 9V track
// and the plastic track after it (6 studs wide, for RC and Power Functions) share one geometry.
// Signs, stickers and parts of a piece (titles starting with ~) aren't track.
const systems = new Map<string, string | null>();
function trackSystem(name: string): string | null {
  if (systems.has(name)) return systems.get(name)!;
  let system: string | null = null;
  const path = [join('ldraw', 'parts', name)].find((p) => existsSync(p));
  if (path) {
    const title = readFileSync(path, 'utf-8').split(/\r?\n/)[0].replace(/^0\s+/, '');
    const moved = /^~Moved to (\S+)/.exec(title)?.[1];
    if (moved) system = trackSystem(`${moved.toLowerCase()}.dat`);
    else if (!title.startsWith('~') && !/Sticker|Roller Coaster|Sleeper|Car Track/i.test(title)) {
      if (/^Duplo Train Track/i.test(title)) system = 'duplo';
      else if (/^Monorail Track/i.test(title)) system = 'monorail';
      else if (/Train Track.*\b9V\b/i.test(title)) system = '9V';
      else if (/Train Track.*\b12V\b/i.test(title)) system = '12V';
      else if (/Train Track.*\b4\.5V\b/i.test(title)) system = '4.5V';
      else if (/Train Track (6|4) Studs Wide|Train Track Flexible/i.test(title)) system = 'plastic';
      else if (/^Train Track (Tapered |Slotted )?Rail/i.test(title)) system = '4.5V';
    }
  }
  systems.set(name, system);
  return system;
}

// Reads a page, from the cache if it's there.
async function cached(url: string, file: string) {
  const path = join(CACHE, file);
  if (existsSync(path)) return readFileSync(path, 'utf-8');
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} for ${url}`);
  const text = await response.text();
  writeFileSync(path, text);
  return text;
}

// Text of an HTML fragment, without its tags.
const plain = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

interface OmrSet {
  id: string;
  number: string;
  name: string;
  theme: string;
  year: string;
}

// The OMR's list of sets, 25 to a page.
const sets: OmrSet[] = [];
for (let page = 1; ; page++) {
  // The list changes as sets are added, so it is always read afresh.
  const response = await fetch(`${OMR}?page=${page}`);
  const html = await response.text();
  const before = sets.length;
  for (const row of html.split(/<tr\s/).slice(1)) {
    const cells: Record<string, string> = {};
    for (const m of row.matchAll(/table\.record\.(\d+)\.column\.([\w.]+)"[^>]*>([\s\S]*?)<\/td>/g)) {
      cells.id = m[1];
      cells[m[2]] = plain(m[3]);
    }
    if (cells.number) sets.push({ id: cells.id, number: cells.number, name: cells.name, theme: cells['theme.name'] ?? '', year: cells.year });
  }
  if (sets.length === before) break;
}
console.log(`${sets.length} sets in the OMR`);

// Each set's main model: its page's first model file, downloaded.
interface Found extends OmrSet {
  file: string;
  pieces: Record<string, number>;
  parts: number;
}
const found: Found[] = [];
const queue = sets.filter((s) => !s.theme.startsWith('Technic'));
async function worker() {
  for (let set = queue.shift(); set; set = queue.shift()) {
    try {
      const page = await cached(`${OMR}/${set.id}`, `${set.id}.html`);
      const link = /https:\/\/library\.ldraw\.org\/media\/omr_models\/[^"'\s]+\.(mpd|ldr)(\?[^"'\s]*)?/i.exec(page);
      if (!link) continue;
      const file = link[0].replaceAll('&amp;', '&');
      const text = await cached(file, `${set.id}.${link[1].toLowerCase()}`);
      // Every part placed, in the model and its submodels; and the track pieces among them.
      const pieces: Record<string, number> = {};
      let parts = 0;
      const submodels = new Set([...text.matchAll(/^\s*0\s+FILE\s+(.+?)\s*$/gim)].map((m) => m[1].toLowerCase()));
      for (const m of text.matchAll(/^\s*1(?:\s+\S+){13}\s+(.+?)\s*$/gm)) {
        const name = m[1].toLowerCase();
        if (submodels.has(name)) continue;
        parts++;
        const system = trackSystem(name.replaceAll('\\', '/'));
        if (system) pieces[system] = (pieces[system] ?? 0) + 1;
      }
      if (pieces['12V'] && pieces['4.5V']) {
        pieces['12V'] += pieces['4.5V'];
        delete pieces['4.5V'];
      }
      found.push({ ...set, file, pieces, parts });
    } catch (e) {
      console.log(`${set.number}: ${(e as Error).message}`);
    }
  }
}
await Promise.all(Array.from({ length: AT_ONCE }, worker));

// The fields of a CSV line, quoted where they need it.
const field = (value: string | number) => (/[",\n]/.test(String(value)) ? `"${String(value).replaceAll('"', '""')}"` : String(value));
const withTrack = found.filter((s) => Object.keys(s.pieces).length).sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
const lines = ['set_num,name,theme,year,parts,track,track_pieces,omr_url,omr_file'];
for (const s of withTrack) {
  const systems = Object.keys(s.pieces).sort();
  lines.push([s.number, s.name, s.theme, s.year, s.parts, systems.join(' '), systems.map((k) => s.pieces[k]).join(' '), `${OMR}/${s.id}`, s.file].map(field).join(','));
}
writeFileSync(CSV, lines.join('\n') + '\n');
const trainTheme = sets.filter((s) => /^(Train|City > Trains)/.test(s.theme)).length;
console.log(`${trainTheme} sets in train themes; ${withTrack.length} sets with track, written to ${CSV}`);
