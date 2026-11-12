// Invariance and jitter: does a set's function check come out the same when its model is moved,
// turned about the upright, or has every part nudged a hair? It should: none of these changes
// the mechanism. Where it doesn't, a result hangs on where the model happens to sit, or on a
// tolerance that a rounded-off position falls either side of.
//
//   npm run invariance                 the quick sets (see check-functions.ts)
//   npm run invariance -- 8851 956     only sets whose number has one of these in it
//   npm run invariance -- --jobs 4     how many checks to run at once (default: half the cores)
//
// Each set's model is copied five ways, and the function check run on each copy:
//   copy      as it is: must match the set's stored results, or the comparison itself is off
//   moved     1000 LDU along x and 600 back along z
//   turned90  a quarter turn about the upright, which keeps every part square to the axes
//   turned37  37 degrees about the upright, which doesn't
//   jitter    every part and sub-model moved by up to 0.05 LDU each way, at random
// and each function's result compared with the plain copy's. A function comes out one of:
//   same      the same result, the same parts listed, each control as far
//   numbers   the same result and parts, but a control went a different distance (by over 0.01)
//   parts     the same result, but other parts are listed as still, moved, wrong or strayed
//   RESULT    another result (works, partly, no), with the cause the check now gives
// Fails (exit 1) if any copy differs from the stored results, or any function's result changes.

import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { availableParallelism, tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { changed, VARIANTS } from './variants.ts';

const SETS_DIR = join('data', 'sets');
// The quick sets of check-functions.ts.
const QUICK = ['8270', '42107', '8849', '42061', '42109', '8001', '8204', '8245', '8851', '8856', '8208', '8448', '8824', '8202', '42084', '42074', '42071', '8845', '8837', '858', '8074', '42063', '42057', '42065', '956', '8081', '8049', '8416', '42112', '42129', '9394', '42000', '42114'];
interface Checked {
  result: string;
  turned?: number[][];
  still?: string[];
  moved?: string[];
  wrong?: string[];
  strayed?: string[];
  cause?: string;
}

// How a function's result differs from the plain copy's.
function differs(a: Checked, b: Checked): 'same' | 'numbers' | 'parts' | 'RESULT' {
  if (a.result !== b.result) return 'RESULT';
  const list = (x?: string[]) => [...(x ?? [])].sort().join(',');
  if (list(a.still) !== list(b.still) || list(a.moved) !== list(b.moved) || list(a.wrong) !== list(b.wrong) || list(a.strayed) !== list(b.strayed)) return 'parts';
  const [ta, tb] = [(a.turned ?? []).flat(), (b.turned ?? []).flat()];
  if (ta.length !== tb.length || ta.some((x, i) => Math.abs(x - tb[i]) > 0.01)) return 'numbers';
  return 'same';
}

// Runs the function check on one set's file, in a process of its own.
function checkFile(file: string, omr: boolean): Promise<{ functions: Checked[] } | { failed: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [...process.execArgv, join('scripts', 'check-functions.ts'), '--one', file], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...(omr ? { KINEBRICK_AS_OMR: '1' } : {}) } });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('close', (code) => {
      try {
        resolve(code === 0 ? JSON.parse(out) : { failed: err.trim().split('\n').pop() ?? `exit ${code}` });
      } catch {
        resolve({ failed: 'no results' });
      }
    });
  });
}

const args = process.argv.slice(2);
const jobsAt = args.indexOf('--jobs');
const jobs = jobsAt >= 0 ? Number(args[jobsAt + 1]) : Math.max(1, Math.floor(availableParallelism() / 2));
const named = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--jobs');
const filters = (named.length ? named : QUICK).map((n) => (n.includes('-') ? n : `${n}-`));
const sets = readdirSync(SETS_DIR)
  .filter((f) => f.endsWith('.json') && filters.some((x) => f.startsWith(x)))
  .map((f) => JSON.parse(readFileSync(join(SETS_DIR, f), 'utf-8')))
  .filter((s) => s.curated.functions?.length && s.generated?.functions);

const dir = mkdtempSync(join(tmpdir(), 'kinebrick-invariance-'));
// Each set and variant's results, as they come.
const found = new Map<string, Checked[] | string>();
const work: (() => Promise<void>)[] = [];
for (const set of sets) {
  for (const v of VARIANTS) {
    work.push(async () => {
      // The copy keeps the model's file name: a model of ours finds its connections by it.
      const folder = join(dir, v.name);
      mkdirSync(folder, { recursive: true });
      const copyOf = (model: string) => {
        const to = join(folder, basename(model));
        writeFileSync(to, changed(readFileSync(model, 'utf-8'), v));
        return to;
      };
      const curated = { ...set.curated, model: copyOf(set.curated.model), functions: set.curated.functions.map((fn: { model?: string }) => (fn.model ? { ...fn, model: copyOf(fn.model) } : fn)) };
      const file = join(folder, `${set.set}.json`);
      writeFileSync(file, JSON.stringify({ set: set.set, curated }));
      const result = await checkFile(file, set.curated.model.startsWith('omr/'));
      found.set(`${set.set} ${v.name}`, 'functions' in result ? result.functions : result.failed);
    });
  }
}
console.log(`Checking ${sets.length} sets, each ${VARIANTS.length} ways, ${jobs} at a time`);
await Promise.all(
  Array.from({ length: jobs }, async () => {
    for (let next = work.shift(); next; next = work.shift()) await next();
  }),
);
rmSync(dir, { recursive: true, force: true });

// Each variant's functions, by how they differ; and each difference, listed.
const counts: Record<string, Record<string, number>> = {};
const lines: string[] = [];
let bad = false;
for (const set of sets) {
  const stored: Checked[] = set.generated.functions;
  const plain = found.get(`${set.set} copy`)!;
  for (const v of VARIANTS) {
    const now = found.get(`${set.set} ${v.name}`)!;
    const count = (counts[v.name] ??= {});
    if (typeof now === 'string' || typeof plain === 'string') {
      lines.push(`${set.set} ${v.name}: failed: ${typeof now === 'string' ? now : plain}`);
      count.failed = (count.failed ?? 0) + 1;
      bad = true;
      continue;
    }
    // The plain copy against the stored results; every other copy against the plain copy.
    const base = v.name === 'copy' ? stored : plain;
    now.forEach((fn, i) => {
      const how = differs(base[i], fn);
      count[how] = (count[how] ?? 0) + 1;
      if (how === 'same') return;
      if (how === 'RESULT' || v.name === 'copy') bad = true;
      const detail = how === 'RESULT' ? `${base[i].result} -> ${fn.result}${fn.cause ? `, ${fn.cause}` : ''}` : how === 'numbers' ? `${JSON.stringify(base[i].turned)} -> ${JSON.stringify(fn.turned)}` : '';
      lines.push(`${set.set} ${v.name}: function ${i + 1}: ${how}${detail ? ` (${detail})` : ''}`);
    });
  }
}
for (const line of lines) console.log(line);
console.log('');
for (const v of VARIANTS) {
  const c = counts[v.name] ?? {};
  console.log(`${v.name.padEnd(9)} ${['same', 'numbers', 'parts', 'RESULT', 'failed'].filter((k) => c[k]).map((k) => `${c[k]} ${k}`).join(', ')}`);
}
process.exit(bad ? 1 : 0);
