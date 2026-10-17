// Packs each test model in models/ (.ldr, or .mpd with submodels) together with every LDraw
// part and primitive it uses into one file, packed/<model>.mpd, so the viewer needs no LDraw
// parts library: just one file per model. The model goes in flattened, its submodels' parts
// placed directly, in the order the viewer's own reading of the model gives (src/ldr.ts), then
// any shapes its submodels draw without parts (hoses, springs), each as a file of its own.
// Parts the model file brings with it (unofficial ones) are used where the library has none.
// Also writes packed/titles.json, the LDraw title of every part the models use, and
// packed/models.json, each model's title.
//
// Needs the LDraw parts library in ldraw/. Run with: npm run pack

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizePartName } from '../src/connections.ts';
import { embeddedParts, modelTitle, parseModel, partLine } from '../src/ldr.ts';

const LDRAW_DIR = 'ldraw';
const MODELS_DIR = 'models';
const OUT_DIR = 'packed';

function readLdrawFile(name: string, embedded: Map<string, string>): string {
  for (const dir of ['parts', 'p']) {
    const path = join(LDRAW_DIR, dir, name);
    if (existsSync(path)) return readFileSync(path, 'utf-8');
  }
  const own = embedded.get(name);
  if (own !== undefined) return own;
  throw new Error(`${name} is not in the LDraw library (${LDRAW_DIR}/) or the model file`);
}

// The files a file refers to, from its type 1 lines.
function references(text: string): string[] {
  const names: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const tokens = line.trim().split(/\s+/);
    if (tokens[0] === '1' && tokens.length >= 15) names.push(normalizePartName(tokens.slice(14).join(' ')));
  }
  return names;
}

// The name three.js's LDraw loader looks a file up by: it files subparts ("s/...") under
// "parts/s/..." and high-resolution primitives ("48/...") under "p/48/...".
function packedName(name: string): string {
  if (name.startsWith('s/')) return 'parts/' + name;
  if (name.startsWith('48/')) return 'p/' + name;
  return name;
}

// LDConfig.ldr's colour definitions, so the packed file brings its own colours.
const colours = readFileSync(join(LDRAW_DIR, 'LDConfig.ldr'), 'utf-8')
  .split(/\r?\n/)
  .filter((line) => line.includes('!COLOUR'))
  .join('\n');

mkdirSync(OUT_DIR, { recursive: true });
const titles: Record<string, string> = {};

const modelTitles: Record<string, string> = {};

for (const file of readdirSync(MODELS_DIR).filter((f) => /\.(ldr|mpd)$/.test(f)).sort()) {
  const source = readFileSync(join(MODELS_DIR, file), 'utf-8');
  const { parts, shapes } = parseModel(source);
  const embedded = embeddedParts(source);
  const shapeName = (submodel: string) => `kinebrick-shape/${submodel}`;
  const model = [
    ...parts.map(partLine),
    ...shapes.map((s) => partLine({ name: shapeName(s.submodel), color: s.color, matrix: s.matrix })),
  ].join('\n');

  // Every file the model needs, each once, found by following references.
  const included = new Map<string, string>();
  for (const s of shapes) included.set(shapeName(s.submodel), s.lines.join('\n'));
  const queue = references(model).filter((name) => !included.has(name));
  while (queue.length) {
    const name = queue.shift()!;
    if (included.has(name)) continue;
    const text = readLdrawFile(name, embedded);
    included.set(name, text);
    queue.push(...references(text));
  }
  for (const p of parts) {
    titles[p.name] = included.get(p.name)!.split(/\r?\n/)[0].replace(/^0\s+/, '').replace(/\s+/g, ' ').trim();
  }

  const base = file.replace(/\.(ldr|mpd)$/, '');
  modelTitles[base] = modelTitle(source);
  let out = `0 FILE ${base}.ldr\n${colours}\n${model}\n`;
  for (const [name, text] of included) out += `\n0 NOFILE\n0 FILE ${packedName(name)}\n${text.trimEnd()}\n`;
  writeFileSync(join(OUT_DIR, `${base}.mpd`), out);
  const shapeNote = shapes.length ? `, ${shapes.length} shapes` : '';
  console.log(`${base}.mpd: ${parts.length} parts${shapeNote}, ${included.size} files, ${(out.length / 1024).toFixed(0)} KB`);
}

writeFileSync(join(OUT_DIR, 'models.json'), JSON.stringify(modelTitles, null, 2) + '\n');
// Packed files of models no longer in models/ (renamed or removed) go too.
for (const file of readdirSync(OUT_DIR).filter((f) => f.endsWith('.mpd'))) {
  if (!(file.replace(/\.mpd$/, '') in modelTitles)) {
    rmSync(join(OUT_DIR, file));
    console.log(`Removed ${file}: no such model`);
  }
}
const sorted = Object.fromEntries(Object.entries(titles).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(join(OUT_DIR, 'titles.json'), JSON.stringify(sorted, null, 2) + '\n');
console.log(`Wrote ${OUT_DIR}/titles.json`);
