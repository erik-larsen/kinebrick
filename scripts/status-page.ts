// Writes the status page: every OMR set as a box, sized by its number of pieces and coloured by
// the share of its checked functions that work, and why the functions that don't work don't, by
// cause (see docs/plan.md, "What Erik sees"). It reads each
// set's results from data/sets/ (written by npm run functions) and its name, year and piece count
// from models/technic-sets.csv, and puts them into the page in scripts/status-page.html. The page's
// graph of the sets in each colour over time comes from git (see status-history.ts). Its table of
// times comes from the viewer sweep's records in data/viewer/ (scripts/drags/sweep.ts), for the
// sets swept so far: what one small turn of each working function's control takes in the viewer.
//
//   npm run status                 writes dist/status.html
//   npm run status -- some/file    writes it there instead
//   npm run status -- --trains     the train sets' page instead (see docs/plan.md, "The train
//                                  track"), from data/trains/ and models/train-sets.csv: every set
//                                  with track, each linked to its model in the preview-train
//                                  viewer; written to dist/trains.html

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { CAUSES } from './causes.ts';
import { history, setState } from './status-history.ts';

const trains = process.argv.includes('--trains');
const SETS_DIR = trains ? join('data', 'trains') : join('data', 'sets');
const VIEWER_DIR = join('data', 'viewer');
// The viewer sweep's record of a set, if it has been swept (decisions 257 and 258).
type Swept = { date: string; commit: string; functions: { function: number; msOneCall?: number; msPerStep?: number; verdict?: string }[] };
const swept = (set: string): Swept | null => (existsSync(join(VIEWER_DIR, `${set}.json`)) ? JSON.parse(readFileSync(join(VIEWER_DIR, `${set}.json`), 'utf-8')) : null);
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
  const sweep = swept(set.set);
  // Each swept function's times in the viewer, in ms: one small turn of its control as a drag makes
  // it (one call of one solver step), a step in one long turn, and whether the turn moved what the
  // list says it moves. A record made before the sweep timed one call has no first figure.
  const times = new Map((sweep?.functions ?? []).map((f) => [f.function, [f.msOneCall ?? null, f.msPerStep ?? null, f.verdict ?? '']]));
  sets.push({
    set: set.set,
    name: row.name ?? '',
    year: Number(row.year) || 0,
    pieces: Number(row.parts) || Number(row.omr_parts) || 1,
    loose: (set.generated.loose ?? []).length,
    // Its track links that are on no path, if its track isn't read as a track (see unread-tracks.ts).
    unreadTracks: set.generated.unreadTracks ?? null,
    // Its model's name in the viewer on the preview site, if that has it, and its page in the OMR.
    viewer: viewerModels.has(modelName(set.curated?.model)) ? modelName(set.curated?.model) : '',
    // Its model file, for the viewer on this computer to open where the preview site doesn't have the set.
    file: set.curated?.model ?? '',
    omr: row.omr_url ?? '',
    ...(trains ? { link: TRAIN_VIEWER + encodeURIComponent(modelName(set.curated?.model) + '.mpd') } : {}),
    // Each function: what it does (in full: a set's card wraps the text), its result, and if it doesn't work, why (see causes.ts) and the part that's about.
    // Last, its times in the viewer if the sweep has them (see `times`), else null.
    functions: results.map((r: { result: string; cause?: string; detail?: string }, i: number) => [String(curated[i]?.does ?? ''), r.result, r.cause ?? '', r.detail ?? '', times.get(i + 1) ?? null]),
    // When the sweep timed it, and at which commit.
    swept: sweep ? [sweep.date.slice(0, 10), sweep.commit] : null,
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
// The sets in each colour after each commit that changed them, and last as the files are now, if a
// check has changed them since the last commit: [seconds, commit, the six buckets' counts]. (The
// history is of the Technic sets: the train sets' page has none.)
const points = trains ? [] : history().map((p) => [p.time, p.commit, ...p.buckets]);
const now = [0, 0, 0, 0, 0, 0];
for (const file of readdirSync(SETS_DIR).filter((f) => f.endsWith('.json'))) {
  const state = setState(readFileSync(join(SETS_DIR, file), 'utf-8'));
  if (state) now[state.bucket]++;
}
if (!trains && points[points.length - 1].slice(2).join() !== now.join()) points.push([Math.floor(Date.now() / 1000), 'not committed', ...now]);
const data = { commit, date: new Date().toISOString().slice(0, 10), causes: CAUSES, sets, history: points, ...(trains ? { title: 'Every OMR set with train track, by how much of it works' } : {}) };
const page = readFileSync(join('scripts', 'status-page.html'), 'utf-8').replace('/*DATA*/null', () => JSON.stringify(data).replaceAll('</', '<\\/'))
// The train sets' page has its own name, so that it and the Technic page aren't two pages with one name.
const named = trains ? page.replace('<title>Kinebrick Set Status</title>', '<title>Kinebrick Train Status</title>') : page;
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, named);
console.log(`${sets.length} sets written to ${out}`);
