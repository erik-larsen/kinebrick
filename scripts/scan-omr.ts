// Measures how much of the real Technic sets KineBrick understands: reads every model in omr/
// (npm run omr downloads them) as the viewer reads a model you open yourself, with the connection
// table for the whole library, and writes omr/coverage.md: for each model, how many of its parts
// are attached and what moves; and the parts most worth teaching KineBrick next, ranked by how
// many models they leave short:
//   - parts with no connection points at all, which can't connect to anything
//   - parts that look like they move (by their LDraw title: a gear, a tyre, a shock absorber) but
//     have no role, so KineBrick takes them for plain structure: a gear that doesn't mesh, a tyre
//     that doesn't roll
//   - parts left loose, not attached to the rest of their model
//
// Needs the LDraw parts library in ldraw/. Run with: npm run scan

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { libraryConnections } from '../src/connections.ts';
import { parseModel } from '../src/ldr.ts';
import { inferMechanism } from '../src/mechanism.ts';

const LDRAW_DIR = 'ldraw';
const OMR_DIR = 'omr';
const REPORT = join(OMR_DIR, 'coverage.md');

const table = libraryConnections(JSON.parse(readFileSync('data/library-connections.json', 'utf-8')));
const roles: Record<string, string> = JSON.parse(readFileSync('data/roles.json', 'utf-8'));
const primitives = new Set<string>(JSON.parse(readFileSync('packed/primitives.json', 'utf-8')));

const readPart = (name: string) => {
  const path = join(LDRAW_DIR, 'parts', name);
  return existsSync(path) ? readFileSync(path, 'utf-8') : null;
};
const title = (name: string) => (readPart(name)?.split(/\r?\n/)[0] ?? '').replace(/^0\s+/, '').trim();
const piecesOf = (name: string) => (roles[name] === 'split' ? (readPart(name) ?? '').split(/\r?\n/).filter((line) => /^\s*1\s/.test(line)) : null);

// What a part looks like it does, from its title, if it looks like it moves.
const MOVERS = /\b(gear|worm|rack|differential|turntable|tyre|tire|wheel|rim|steering|universal joint|ball joint|shock absorber|spring|pneumatic|engine cylinder|pump|actuator|motor|piston|crankshaft|driving ring|clutch|chain|tread|link)\b/i;
const kindOf = (t: string) => (/sticker/i.test(t) ? null : (MOVERS.exec(t)?.[1].toLowerCase() ?? null));

interface PartStats {
  models: Set<string>; // models it's in
  copies: number;
  looseModels: Set<string>; // models it's loose in
  looseCopies: number;
}
const stats = new Map<string, PartStats>();
const statsOf = (name: string) => {
  if (!stats.has(name)) stats.set(name, { models: new Set(), copies: 0, looseModels: new Set(), looseCopies: 0 });
  return stats.get(name)!;
};

const rows: string[] = [];
let attachedModels = 0;
const files = readdirSync(OMR_DIR).filter((f) => /\.(ldr|mpd)$/i.test(f)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
for (const file of files) {
  const model = file.replace(/\.(ldr|mpd)$/i, '');
  const started = Date.now();
  try {
    const { parts, paths } = parseModel(readFileSync(join(OMR_DIR, file), 'utf-8'), (name) => primitives.has(name), piecesOf);
    const mech = inferMechanism(parts, table, roles, paths);
    const loose = new Set(mech.loose);
    parts.forEach((p, i) => {
      const s = statsOf(p.name);
      s.models.add(model);
      s.copies++;
      if (loose.has(i)) {
        s.looseModels.add(model);
        s.looseCopies++;
      }
    });
    const names = new Set(parts.map((p) => p.name));
    const unconnected = [...names].filter((n) => !table.parts[n]?.length && roles[n] !== 'decoration' && !table.stickers?.includes(n)).length;
    const unknownMovers = [...names].filter((n) => !roles[n] && table.parts[n]?.length && kindOf(title(n))).length;
    const attached = 1 - loose.size / parts.length;
    if (loose.size === 0) attachedModels++;
    rows.push(`| ${model} | ${parts.length} | ${(attached * 100).toFixed(0)}% | ${unconnected} | ${unknownMovers} | ${mech.joints.length} | ${mech.meshes.length} | ${mech.treads.length} | ${((Date.now() - started) / 1000).toFixed(1)} s |`);
    console.log(`${model}: ${parts.length} parts, ${loose.size} loose`);
  } catch (err) {
    rows.push(`| ${model} | | | | | | | | error: ${(err as Error).message} |`);
    console.log(`${model}: ${(err as Error).message}`);
  }
}

// The parts ranked by how many models they're in (or loose in), with what KineBrick knows of them.
const ranked = (keep: (name: string, s: PartStats) => boolean, by: (s: PartStats) => number) =>
  [...stats]
    .filter(([name, s]) => keep(name, s))
    .sort(([, a], [, b]) => by(b) - by(a))
    .slice(0, 60)
    .map(([name, s]) => `| ${name} | ${title(name)} | ${s.models.size} | ${s.copies} | ${s.looseModels.size} | ${s.looseCopies} | ${roles[name] ?? ''} |`);
const partHeader = '| Part | Title | Models | Copies | Loose in models | Loose copies | Role |\n|---|---|---|---|---|---|---|';

// Parts that look like they move but have no role, by kind.
const kinds = new Map<string, { parts: number; models: Set<string> }>();
for (const [name, s] of stats) {
  const kind = kindOf(title(name));
  if (!kind || roles[name] || !table.parts[name]?.length) continue;
  const k = kinds.get(kind) ?? { parts: 0, models: new Set<string>() };
  k.parts++;
  s.models.forEach((m) => k.models.add(m));
  kinds.set(kind, k);
}

const report = `# KineBrick coverage of the OMR's Technic sets

${files.length} models from the LDraw Official Model Repository, read as the viewer reads a model you open yourself (written by \`npm run scan\`). ${attachedModels} have every part attached.

## Parts with no connection points

They can't connect to anything (stickers and decoration aside).

${partHeader}
${ranked((name) => !table.parts[name]?.length && roles[name] !== 'decoration' && !table.stickers?.includes(name), (s) => s.models.size).join('\n')}

## Parts that look like they move, but have no role

KineBrick takes them for plain structure. By kind (from their LDraw titles):

| Kind | Parts | Models |
|---|---|---|
${[...kinds].sort(([, a], [, b]) => b.models.size - a.models.size).map(([kind, k]) => `| ${kind} | ${k.parts} | ${k.models.size} |`).join('\n')}

The parts themselves:

${partHeader}
${ranked((name) => !roles[name] && !!table.parts[name]?.length && !!kindOf(title(name)), (s) => s.models.size).join('\n')}

## Parts most often left loose

${partHeader}
${ranked((_, s) => s.looseCopies > 0, (s) => s.looseModels.size).join('\n')}

## Models

Attached: the share of its parts attached to the rest of it. No connections: parts with no connection points. Unknown movers: parts that look like they move but have no role. Treads: wheels and tracks on the ground.

| Model | Parts | Attached | No connections | Unknown movers | Joints | Gear meshes | Treads | Time |
|---|---|---|---|---|---|---|---|---|
${rows.join('\n')}
`;
writeFileSync(REPORT, report);
console.log(`Wrote ${REPORT}`);
