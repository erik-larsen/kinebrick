// Finds every set in the LDraw Official Model Repository that includes train track and a train to
// ride on it, in any theme, and writes them to models/train-sets.csv. It reads the OMR's list of
// sets, downloads each set's main model into omr/all/ (once: a file already there is read again,
// not downloaded), and looks in it for track pieces and for a rail vehicle's wheels, by their
// titles in the LDraw library (see trackSystem and railWheels). A set's line says which kinds of
// track it has, how many pieces of each, and the exact file to download (omr_file), so that
// npm run omr -- --trains downloads the same files each time.
//
// A set with track but no train (a station, a level crossing, or rails used for something else,
// as in 358 Rocket Base) is left out.
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
// A part's title in the LDraw library, following a part that has moved to another number; or ''
// if it isn't in the library.
function partTitle(name: string): string {
  const path = join('ldraw', 'parts', name);
  if (!existsSync(path)) return '';
  const title = readFileSync(path, 'utf-8').split(/\r?\n/)[0].replace(/^0\s+/, '');
  const moved = /^~Moved to (\S+)/.exec(title)?.[1];
  return moved ? partTitle(`${moved.toLowerCase()}.dat`) : title;
}

const systems = new Map<string, string | null>();
function trackSystem(name: string): string | null {
  if (systems.has(name)) return systems.get(name)!;
  let system: string | null = null;
  const title = partTitle(name);
  if (title) {
    if (!title.startsWith('~') && !/Sticker|Roller Coaster|Sleeper|Car Track/i.test(title)) {
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

// Whether a part is a rail vehicle's wheels, by its title: 'set' for a whole wheelset, wheel block,
// wheeled train base, train motor or monorail chassis; 'wheel' for a single train wheel, which
// counts only with a second one on its axle (see onOneAxle); or null.
function railWheels(name: string): 'set' | 'wheel' | null {
  const title = partTitle(name);
  if (/Train Base\b.*\bwith Wheels|with Train Wheels|Train Wheel Bogie.*\bwith Wheelset|Axle Steel.*Train Wheels|Electric Train Motor.*\(Complete\)|Monorail (Wheel Chassis|Motor (Base|with))/i.test(title)) return 'set';
  if (/^~?Train Wheel\b/i.test(title) && !/Bogie|Traction Band/i.test(title)) return 'wheel';
  return null;
}

// Whether two single train wheels are the two ends of one axle, at the track's gauge: placed in
// the same submodel at the same height, 96 to 112 LDU apart (as wheelPairs in src/track.ts reads
// it), facing opposite ways along the line between them. (A wheel's axle is its z axis.) A mine
// cart's wheels, closer together, don't ride train track.
type Placed = { at: number[]; axle: number[] };
function onOneAxle(a: Placed, b: Placed): boolean {
  const d = a.at.map((v, i) => b.at[i] - v);
  const length = Math.hypot(...d);
  const dot = (u: number[], v: number[]) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  return Math.abs(d[1]) < 1 && length >= 96 && length <= 112 && dot(a.axle, b.axle) < -0.9 && Math.abs(dot(d, a.axle)) > 0.9 * length;
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
  train: boolean;
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
      // Every part placed, in the model and its submodels; the track pieces among them; and
      // whether there's a train: a rail vehicle's wheelset, or two single train wheels on one axle.
      const pieces: Record<string, number> = {};
      let parts = 0;
      let train = false;
      const submodels = new Set([...text.matchAll(/^\s*0\s+FILE\s+(.+?)\s*$/gim)].map((m) => m[1].toLowerCase()));
      // The single train wheels in each submodel.
      const wheels: Record<string, Placed[]> = {};
      let submodel = '';
      for (const line of text.split(/\r?\n/)) {
        const named = /^\s*0\s+FILE\s+(.+?)\s*$/i.exec(line);
        if (named) submodel = named[1];
        const m = /^\s*1\s+\S+((?:\s+\S+){12})\s+(.+?)\s*$/.exec(line);
        if (!m) continue;
        const name = m[2].toLowerCase().replaceAll('\\', '/');
        if (submodels.has(name)) continue;
        parts++;
        const system = trackSystem(name);
        if (system) pieces[system] = (pieces[system] ?? 0) + 1;
        const kind = railWheels(name);
        if (kind === 'set') train = true;
        if (kind === 'wheel') {
          const [x, y, z, , , c, , , f, , , i] = m[1].trim().split(/\s+/).map(Number);
          const wheel = { at: [x, y, z], axle: [c, f, i] };
          if ((wheels[submodel] ??= []).some((other) => onOneAxle(other, wheel))) train = true;
          wheels[submodel].push(wheel);
        }
      }
      if (pieces['12V'] && pieces['4.5V']) {
        pieces['12V'] += pieces['4.5V'];
        delete pieces['4.5V'];
      }
      found.push({ ...set, file, pieces, parts, train });
    } catch (e) {
      console.log(`${set.number}: ${(e as Error).message}`);
    }
  }
}
await Promise.all(Array.from({ length: AT_ONCE }, worker));

// The fields of a CSV line, quoted where they need it.
const field = (value: string | number) => (/[",\n]/.test(String(value)) ? `"${String(value).replaceAll('"', '""')}"` : String(value));
const withTrack = found.filter((s) => Object.keys(s.pieces).length);
const withTrain = withTrack.filter((s) => s.train).sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
const lines = ['set_num,name,theme,year,parts,track,track_pieces,omr_url,omr_file'];
for (const s of withTrain) {
  const systems = Object.keys(s.pieces).sort();
  lines.push([s.number, s.name, s.theme, s.year, s.parts, systems.join(' '), systems.map((k) => s.pieces[k]).join(' '), `${OMR}/${s.id}`, s.file].map(field).join(','));
}
writeFileSync(CSV, lines.join('\n') + '\n');
const trainTheme = sets.filter((s) => /^(Train|City > Trains)/.test(s.theme)).length;
console.log(`${trainTheme} sets in train themes; ${withTrack.length} sets with track; ${withTrain.length} with track and a train, written to ${CSV}`);
console.log(`Left out, with track but no train: ${withTrack.filter((s) => !s.train).map((s) => s.number).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).join(', ')}`);
