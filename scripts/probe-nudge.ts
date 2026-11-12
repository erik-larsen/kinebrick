// What a nudge changes in the mechanism worked out from a model: each part moved by up to
// JITTER (0.05 LDU) each way, as invariance.ts's jitter does, and the mechanism compared with the
// model's own. Nothing should change: a part 0.05 LDU off is still in its hole.
//
//   npm run nudge                  the quick sets (see check-functions.ts)
//   npm run nudge -- 8851 956      only sets whose number has one of these in it
//
// For each set: how many connections, joints and gear meshes are lost and gained, by kind, and
// the first few of each, by their parts ("p12 3703"). Then the totals over the sets.

import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { Mechanism } from '../src/mechanism.ts';
import { PlacedPart } from '../src/ldr.ts';
import { loadModel } from './load-model.ts';
import { changed, VARIANTS } from './variants.ts';

const SETS_DIR = join('data', 'sets');
const QUICK = ['8270', '42107', '8849', '42061', '42109', '8001', '8204', '8245', '8851', '8856', '8208', '8448', '8824', '8202', '42084', '42074', '42071', '8845', '8837', '858', '8074', '42063', '42057', '42065', '956', '8081', '8049', '8416', '42112', '42129', '9394', '42000', '42114'];
const SHOWN = 4;

// Everything in a mechanism that a nudge might change, each as a line of text that names it by
// its parts, under the kind of thing it is.
function contents(parts: PlacedPart[], mech: Mechanism): Map<string, Set<string>> {
  const name = (p: number) => `p${p} ${parts[p].name.replace(/\.dat$/i, '')}`;
  // A body, by its lowest-numbered part.
  const first = mech.bodies.map(() => Infinity);
  mech.bodyOf.forEach((b, p) => (first[b] = Math.min(first[b], p)));
  const body = (b: number) => name(first[b]);
  const pair = (a: string, b: string) => [a, b].sort().join(' + ');
  const found = new Map<string, Set<string>>();
  const add = (kind: string, what: string) => (found.get(kind) ?? found.set(kind, new Set()).get(kind)!).add(what);
  for (const c of mech.connections) add(`connection: ${c.kind}${c.stiff ? ' (stiff)' : ''}${c.held ? ' (held)' : ''}`, `${name(c.male)} in ${name(c.female)}`);
  // Parts in one body: each part with its body's first part.
  mech.bodyOf.forEach((b, p) => add('same body', `${name(p)} with ${body(b)}`));
  for (const j of mech.joints) add(`joint: ${j.kind}${j.stiff ? ' (stiff)' : ''}${j.turns ? ' (turns)' : ''}`, pair(body(j.bodyA), body(j.bodyB)));
  for (const m of mech.meshes) add(`mesh: ${m.kind}`, pair(name(mech.gears[m.gearA].part), name(mech.gears[m.gearB].part)));
  for (const c of mech.couplings) add('coupling', pair(body(c.bodyA), body(c.bodyB)));
  for (const s of mech.screws) add('screw', pair(body(s.input), body(s.piston)));
  for (const r of mech.rests) add('rest', body(r.body));
  for (const l of mech.loops) add('loop', l.links.length ? name(Math.min(...l.links)) : `round ${l.wheels.length} wheels`);
  for (const p of mech.loose) add('loose part', name(p));
  return found;
}

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const filters = (args.length ? args : QUICK).map((n) => (n.includes('-') ? n : `${n}-`));
const sets = readdirSync(SETS_DIR)
  .filter((f) => f.endsWith('.json') && filters.some((x) => f.startsWith(x)))
  .map((f) => JSON.parse(readFileSync(join(SETS_DIR, f), 'utf-8')))
  .filter((s) => s.curated.model);
const jitter = VARIANTS.find((v) => v.name === 'jitter')!;
const dir = mkdtempSync(join(tmpdir(), 'kinebrick-nudge-'));
const totals = new Map<string, { lost: number; gained: number; sets: number }>();
for (const set of sets) {
  const model: string = set.curated.model;
  const omr = model.startsWith('omr/');
  const plain = loadModel(model, omr);
  // The copy keeps the model's file name: a model of ours finds its connections by it.
  const copy = join(dir, basename(model));
  writeFileSync(copy, changed(readFileSync(model, 'utf-8'), jitter));
  const nudged = loadModel(copy, omr);
  const [was, now] = [contents(plain.parts, plain.mech), contents(nudged.parts, nudged.mech)];
  const lines: string[] = [];
  for (const kind of [...new Set([...was.keys(), ...now.keys()])].sort()) {
    const [a, b] = [was.get(kind) ?? new Set<string>(), now.get(kind) ?? new Set<string>()];
    const lost = [...a].filter((x) => !b.has(x));
    const gained = [...b].filter((x) => !a.has(x));
    if (lost.length + gained.length === 0) continue;
    const t = totals.get(kind) ?? totals.set(kind, { lost: 0, gained: 0, sets: 0 }).get(kind)!;
    t.lost += lost.length;
    t.gained += gained.length;
    t.sets++;
    const some = (list: string[]) => list.slice(0, SHOWN).join('; ') + (list.length > SHOWN ? `; and ${list.length - SHOWN} more` : '');
    if (lost.length) lines.push(`  ${kind}: ${lost.length} lost of ${a.size}: ${some(lost)}`);
    if (gained.length) lines.push(`  ${kind}: ${gained.length} gained: ${some(gained)}`);
  }
  console.log(`${set.set}: ${lines.length ? 'changed' : 'the same'}`);
  for (const line of lines) console.log(line);
}
rmSync(dir, { recursive: true, force: true });
console.log('\nOver all of them:');
for (const [kind, t] of [...totals].sort((a, b) => b[1].lost + b[1].gained - (a[1].lost + a[1].gained))) console.log(`  ${kind}: ${t.lost} lost, ${t.gained} gained, in ${t.sets} sets`);
