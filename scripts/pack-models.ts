// Packs each test model in models/ (.ldr, or .mpd with submodels) together with every LDraw
// part and primitive it uses into one file, packed/<model>.mpd, so the viewer needs no LDraw
// parts library: just one file per model (see src/pack.ts). Also writes packed/titles.json, the
// LDraw title of every part the models use, and packed/models.json, which files each model
// places are primitives (drawn shapes) and which parts are read as their pieces.
//
// For models opened from your own computer, which the viewer packs itself, it also writes
// packed/primitives.json, which files in the LDraw library are primitives, and
// packed/colours.ldr, the library's colours.
//
// Needs the LDraw parts library in ldraw/. Run with: npm run pack

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { packModel } from '../src/pack.ts';

const LDRAW_DIR = 'ldraw';
const MODELS_DIR = 'models';
const OUT_DIR = 'packed';

async function readLdrawFile(name: string): Promise<string | null> {
  for (const dir of ['parts', 'p']) {
    const path = join(LDRAW_DIR, dir, name);
    if (existsSync(path)) return readFileSync(path, 'utf-8');
  }
  return null;
}

// LDConfig.ldr's colour definitions, so the packed file brings its own colours.
const colours = readFileSync(join(LDRAW_DIR, 'LDConfig.ldr'), 'utf-8')
  .split(/\r?\n/)
  .filter((line) => line.includes('!COLOUR'))
  .join('\n');

mkdirSync(OUT_DIR, { recursive: true });
const titles: Record<string, string> = {};

const models: Record<string, { primitives: string[]; pieces: Record<string, string[]> }> = {};

// An LDraw primitive (a piece of shape, such as a cylinder), rather than a part.
const isPrimitive = (name: string) => !existsSync(join(LDRAW_DIR, 'parts', name)) && existsSync(join(LDRAW_DIR, 'p', name));
const roles: Record<string, string> = JSON.parse(readFileSync('data/roles.json', 'utf-8'));

for (const file of readdirSync(MODELS_DIR).filter((f) => /\.(ldr|mpd)$/.test(f)).sort()) {
  const base = file.replace(/\.(ldr|mpd)$/, '');
  const packed = await packModel(base, readFileSync(join(MODELS_DIR, file), 'utf-8'), colours, readLdrawFile, isPrimitive, roles);
  if (packed.missing.length) throw new Error(`${file}: ${packed.missing.join(', ')} not in the LDraw library (${LDRAW_DIR}/) or the model file`);
  Object.assign(titles, packed.titles);
  models[base] = { primitives: packed.primitives, pieces: packed.pieces };
  writeFileSync(join(OUT_DIR, `${base}.mpd`), packed.text);
  const shapeNote = packed.shapes.length ? `, ${packed.shapes.length} shapes` : '';
  console.log(`${base}.mpd: ${packed.parts.length} parts${shapeNote}, ${packed.files} files, ${(packed.text.length / 1024).toFixed(0)} KB`);
}

writeFileSync(join(OUT_DIR, 'models.json'), JSON.stringify(models, null, 2) + '\n');
// Packed files of models no longer in models/ (renamed or removed) go too.
for (const file of readdirSync(OUT_DIR).filter((f) => f.endsWith('.mpd'))) {
  if (!(file.replace(/\.mpd$/, '') in models)) {
    rmSync(join(OUT_DIR, file));
    console.log(`Removed ${file}: no such model`);
  }
}
const sorted = Object.fromEntries(Object.entries(titles).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(join(OUT_DIR, 'titles.json'), JSON.stringify(sorted, null, 2) + '\n');
console.log(`Wrote ${OUT_DIR}/titles.json`);

// Every primitive in the library (p/, and its 48/ and 8/ folders), one per line, as models name
// them ("48/4-4cyli.dat"), less any a part in parts/ shares a name with.
const primitives = readdirSync(join(LDRAW_DIR, 'p'), { recursive: true, encoding: 'utf-8' })
  .map((name) => name.replaceAll('\\', '/'))
  .filter((name) => name.endsWith('.dat') && isPrimitive(name))
  .sort();
writeFileSync(join(OUT_DIR, 'primitives.json'), '[\n' + primitives.map((name) => '  ' + JSON.stringify(name)).join(',\n') + '\n]\n');
console.log(`Wrote ${OUT_DIR}/primitives.json: ${primitives.length} primitives`);
writeFileSync(join(OUT_DIR, 'colours.ldr'), colours + '\n');
console.log(`Wrote ${OUT_DIR}/colours.ldr`);
