// The history the status page draws: how many sets were in each colour bucket after each commit
// that changed a set's stored results, from the commit that made the first status page on.
//
// Walking every commit's set files takes minutes, so the points are kept in
// data/status-history.json and only the commits since the last one kept are read. The walk
// follows first parents, so a merged branch counts once, where it joined.

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const SETS_DIR = 'data/sets';
const FILE = 'data/status-history.json';
// The commit that made the first status page (2026-11-10).
const START = '6987cc1a';

// A point: when, at which commit, the sets in each bucket (0 none work, 1 to 3 some, 4 all,
// 5 nothing checked: the page's own buckets), and the functions that work, partly work and don't.
export interface Point {
  time: number;
  commit: string;
  buckets: number[];
  functions: number[];
}
interface Kept {
  start: string;
  upto: string;
  points: Point[];
}
// What one set's file says: its bucket, and its functions that work, partly work and don't.
type SetState = { bucket: number; functions: number[] } | null;

const git = (args: string, input?: string) => execSync(`git ${args}`, { input: input === undefined ? undefined : Buffer.from(input), maxBuffer: 1 << 30, stdio: ['pipe', 'pipe', 'ignore'] });

// A set file's state, as the page works it out; null for a file with no results.
export function setState(text: string): SetState {
  let results: { result?: string }[];
  try {
    results = JSON.parse(text).generated?.functions ?? [];
  } catch {
    return null;
  }
  if (results.length === 0) return null;
  const count = (r: string) => results.filter((f) => f.result === r).length;
  const functions = [count('works'), count('partly'), count('no')];
  const checked = functions[0] + functions[1] + functions[2];
  const share = checked ? functions[0] / checked : null;
  const bucket = share === null ? 5 : share >= 1 ? 4 : share >= 0.75 ? 3 : share >= 0.5 ? 2 : share > 0 ? 1 : 0;
  return { bucket, functions };
}

// The texts of files at a commit, read in one go.
function read(commit: string, paths: string[]): Map<string, string> {
  const texts = new Map<string, string>();
  if (paths.length === 0) return texts;
  const out = git('cat-file --batch', paths.map((p) => `${commit}:${p}\n`).join(''));
  let at = 0;
  for (const path of paths) {
    const end = out.indexOf(10, at);
    const header = out.subarray(at, end).toString();
    at = end + 1;
    if (header.endsWith('missing')) continue;
    const size = Number(header.split(' ')[2]);
    texts.set(path, out.subarray(at, at + size).toString());
    at += size + 1;
  }
  return texts;
}

const setFiles = (commit: string) => git(`ls-tree -r --name-only ${commit} -- ${SETS_DIR}`).toString().split('\n').filter((p) => p.endsWith('.json'));

function point(time: number, commit: string, state: Map<string, SetState>): Point {
  const buckets = [0, 0, 0, 0, 0, 0];
  const functions = [0, 0, 0];
  for (const s of state.values()) {
    if (!s) continue;
    buckets[s.bucket]++;
    s.functions.forEach((n, i) => (functions[i] += n));
  }
  return { time, commit: commit.slice(0, 8), buckets, functions };
}

const same = (a: Point, b: Point) => a.buckets.join() === b.buckets.join() && a.functions.join() === b.functions.join();

// The points up to HEAD, oldest first: one where the counts changed, no more.
export function history(): Point[] {
  const head = git('rev-parse HEAD').toString().trim();
  let kept: Kept | null = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf-8')) : null;
  // Kept points are used only if they end on a commit that HEAD's first parents pass.
  if (kept && (kept.start !== START || !git(`rev-list --first-parent ${START}~1..HEAD`).toString().includes(kept.upto))) kept = null;
  const from = kept ? kept.upto : git(`rev-parse ${START}`).toString().trim();
  const state = new Map<string, SetState>();
  for (const [path, text] of read(from, setFiles(from))) state.set(path, setState(text));
  const points = kept ? kept.points : [point(Number(git(`show -s --format=%ct ${from}`).toString()), from, state)];
  const commits = git(`log --first-parent --reverse --format=%H:%ct ${from}..${head} -- ${SETS_DIR}`).toString().trim().split('\n').filter(Boolean);
  for (const line of commits) {
    const [commit, time] = line.split(':');
    const changed = git(`diff --name-only ${commit}~1 ${commit} -- ${SETS_DIR}`).toString().split('\n').filter((p) => p.endsWith('.json'));
    const texts = read(commit, changed);
    for (const path of changed) texts.has(path) ? state.set(path, setState(texts.get(path)!)) : state.delete(path);
    const next = point(Number(time), commit, state);
    if (!same(points[points.length - 1], next)) points.push(next);
  }
  writeFileSync(FILE, JSON.stringify({ start: START, upto: head, points } satisfies Kept, null, 0).replaceAll('},{', '},\n{') + '\n');
  return points;
}
