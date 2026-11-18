// Reads every model the sets use both ways, as the scripts do (readParts in load-model.ts) and as
// the viewer does (packModel in src/pack.ts), and says where their parts differ, index by index.
// The two must agree: the check counts what the viewer shows (decision 169).
//
//   npx tsx scripts/readings-agree.ts           every set's model
//   npx tsx scripts/readings-agree.ts 42099     only models whose file name has one of these in it
//
// Exits 1 if any model differs.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { readParts } from './load-model.ts';
import { drawnDirectly, packModel } from '../src/pack.ts';
import { parseModel } from '../src/ldr.ts';

const LIBRARY = ['ldraw/parts/', 'ldraw/p/', 'ldraw/unofficial/parts/', 'ldraw/unofficial/p/'];
const roles: Record<string, string> = JSON.parse(readFileSync('data/roles.json', 'utf-8'));
const primitives = new Set<string>(JSON.parse(readFileSync('packed/primitives.json', 'utf-8')));
const libraryText = (name: string) => {
  const file = name.replace(/\\/g, '/').toLowerCase();
  for (const dir of LIBRARY) if (existsSync(dir + file)) return readFileSync(dir + file, 'utf-8');
  return null;
};
const plain = (name: string) => name.replace(/^.* - /, '').toLowerCase();

// The parts of a set's model file as the scripts and as the viewer read them, by plain name.
export async function bothReadings(model: string): Promise<{ scripts: string[]; viewer: string[] }> {
  const { text, parts } = readParts(model, true);
  const isPrimitive = (name: string) => drawnDirectly(name, primitives);
  const packed = await packModel(model.replace(/^.*\//, '').replace(/\.mpd$/i, ''), text, '', async (name) => libraryText(name), isPrimitive, roles);
  const viewer = parseModel(text, isPrimitive, (name) => packed.pieces[name] ?? null).parts;
  return { scripts: parts.map((p) => plain(p.name)), viewer: viewer.map((p) => plain(p.name)) };
}

// The set models, each once.
export function setModels(only: string[] = []): string[] {
  const models = new Set<string>();
  for (const file of readdirSync('data/sets').filter((f) => /^\d.*-\d+\.json$/.test(f))) {
    const model = JSON.parse(readFileSync('data/sets/' + file, 'utf-8')).curated?.model;
    if (model && existsSync(model) && (only.length === 0 || only.some((o) => model.includes(o)))) models.add(model);
  }
  return [...models].sort();
}

if (process.argv[1]?.endsWith('readings-agree.ts')) {
  const started = Date.now();
  let differ = 0;
  const models = setModels(process.argv.slice(2));
  for (const model of models) {
    const { scripts, viewer } = await bothReadings(model);
    const at = scripts.findIndex((n, i) => n !== viewer[i]);
    if (at >= 0 || scripts.length !== viewer.length) {
      differ++;
      const shown = at >= 0 ? at : Math.min(scripts.length, viewer.length);
      console.log(`${model}: the scripts read ${scripts.length} parts, the viewer ${viewer.length}; first different, p${shown}: ${scripts[shown]} / ${viewer[shown]}`);
    }
  }
  console.log(`${models.length} models, ${differ} read differently (${Math.round((Date.now() - started) / 1000)} s)`);
  process.exit(differ ? 1 : 0);
}
