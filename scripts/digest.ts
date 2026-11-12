// A fingerprint of the mechanism worked out for every set's model: its bodies, joints, gear
// meshes and the rest, to the last bit of every number. For a change that must not change what
// is inferred (moving code about in src/mechanism.ts), it says so in minutes: if no fingerprint
// changes, the solver is handed the same mechanism, and the function check comes out the same.
//
//   npm run digest                          every set's fingerprints, printed
//   npm run digest -- --write before.txt    written to a file
//   npm run digest -- --compare before.txt  compared with a file written before: lists each set
//                                           that differs and the fields of its mechanism that
//                                           do, and fails (exit 1) if any does
//   npm run digest -- 8859 956              only sets whose number has one of these in it
//   npm run digest -- --jobs 4              how many sets to read at once (default: the cores less 2)
//
// One line for each model (a set's own, and each model a function of its names): the set, the
// model's file, then a fingerprint for each field of the mechanism (see Mechanism), with tabs
// between (a model's file name may have spaces in it).

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join } from 'node:path';
import { inferMechanism } from '../src/mechanism.ts';
import { readParts } from './load-model.ts';

const SETS_DIR = join('data', 'sets');

// A value as text, with everything JSON leaves out put in: maps and sets by what they hold, and
// the numbers JSON can't write.
function text(value: unknown): string {
  return JSON.stringify(value, (_key, v) => {
    if (v instanceof Map) return { map: [...v.entries()] };
    if (v instanceof Set) return { set: [...v.values()] };
    if (typeof v === 'number' && !Number.isFinite(v)) return String(v);
    if (typeof v === 'function') return 'function';
    return v;
  });
}

// One model's line: a fingerprint for each field of its mechanism.
function lineFor(set: string, model: string): string {
  const { table, parts, paths } = readParts(model, model.startsWith('omr/') || process.env.KINEBRICK_AS_OMR === '1');
  const roles: Record<string, string> = JSON.parse(readFileSync('data/roles.json', 'utf-8'));
  const mech = inferMechanism(parts, table, roles, paths) as unknown as Record<string, unknown>;
  const fields = Object.keys(mech)
    .sort()
    .map((k) => `${k}=${createHash('sha256').update(text(mech[k]) ?? 'undefined').digest('hex').slice(0, 12)}`);
  return [set, model, ...fields].join('\t');
}

const args = process.argv.slice(2);
// One model, in a process of its own (see below): its line, printed.
const oneAt = args.indexOf('--one');
if (oneAt >= 0) {
  console.log(lineFor(args[oneAt + 1], args[oneAt + 2]));
  process.exit(0);
}

const valueOf = (flag: string) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
const jobs = Number(valueOf('--jobs') ?? Math.max(1, availableParallelism() - 2));
const named = args.filter((a, i) => !a.startsWith('--') && !['--jobs', '--write', '--compare'].includes(args[i - 1]));
const filters = named.map((n) => (n.includes('-') ? n : `${n}-`));
const models: [string, string][] = [];
for (const file of readdirSync(SETS_DIR).filter((f) => f.endsWith('.json') && (!filters.length || filters.some((x) => f.startsWith(x))))) {
  const set = JSON.parse(readFileSync(join(SETS_DIR, file), 'utf-8'));
  const own: string[] = [set.curated.model, ...(set.curated.functions ?? []).map((fn: { model?: string }) => fn.model)].filter(Boolean);
  for (const model of new Set(own)) models.push([set.set, model]);
}

// Each model is read in a process of its own, several at a time: the largest sets take minutes.
const lines: string[] = new Array(models.length);
let next = 0;
const readOne = (i: number) =>
  new Promise<void>((resolve) => {
    const [set, model] = models[i];
    const child = spawn(process.execPath, [...process.execArgv, join('scripts', 'digest.ts'), '--one', set, model], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('close', (code) => {
      lines[i] = code === 0 ? out.trim() : [set, model, `failed=${(err.trim().split('\n').pop() ?? `exit ${code}`).replace(/\s+/g, '_')}`].join('\t');
      resolve();
    });
  });
await Promise.all(
  Array.from({ length: jobs }, async () => {
    while (next < models.length) await readOne(next++);
  }),
);

const write = valueOf('--write');
const compare = valueOf('--compare');
if (write) writeFileSync(write, lines.join('\n') + '\n');
if (!compare) {
  if (!write) for (const line of lines) console.log(line);
  else console.log(`${lines.length} models' fingerprints written to ${write}`);
  process.exit(lines.some((l) => l.includes('\tfailed=')) ? 1 : 0);
}

// Compared with the file: each model that differs, and the fields that do.
const keyOf = (line: string) => line.split('\t').slice(0, 2).join(' ');
const fieldsOf = (line: string) => new Map(line.split('\t').slice(2).map((f) => f.split('=') as [string, string]));
const before = new Map(readFileSync(compare, 'utf-8').trim().split('\n').map((l) => [keyOf(l), l]));
let differ = 0;
for (const line of lines) {
  const was = before.get(keyOf(line));
  if (was === line) continue;
  differ++;
  if (!was) {
    console.log(`${keyOf(line)}: not in ${compare}`);
    continue;
  }
  const [a, b] = [fieldsOf(was), fieldsOf(line)];
  const fields = [...new Set([...a.keys(), ...b.keys()])].filter((k) => a.get(k) !== b.get(k));
  console.log(`${keyOf(line)}: differs in ${fields.join(', ')}`);
}
console.log(`${lines.length} models: ${differ ? `${differ} differ from ${compare}` : `all the same as in ${compare}`}`);
process.exit(differ ? 1 : 0);
