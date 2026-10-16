// Packs each test model in models/ together with every LDraw part and primitive it uses into
// one file, packed/<model>.mpd, so the viewer needs no LDraw parts library: just one file per
// model. Also writes packed/titles.json, the LDraw title of every part the models use.
//
// Needs the LDraw parts library in ldraw/. Run with: npm run pack

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizePartName } from '../src/connections.ts';

const LDRAW_DIR = 'ldraw';
const MODELS_DIR = 'models';
const OUT_DIR = 'packed';

function readLdrawFile(name: string): string {
  for (const dir of ['parts', 'p']) {
    const path = join(LDRAW_DIR, dir, name);
    if (existsSync(path)) return readFileSync(path, 'utf-8');
  }
  throw new Error(`${name} is not in the LDraw library (${LDRAW_DIR}/)`);
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

for (const file of readdirSync(MODELS_DIR).filter((f) => f.endsWith('.ldr')).sort()) {
  const model = readFileSync(join(MODELS_DIR, file), 'utf-8');

  // Every file the model needs, each once, found by following references.
  const included = new Map<string, string>();
  const queue = references(model);
  while (queue.length) {
    const name = queue.shift()!;
    if (included.has(name)) continue;
    const text = readLdrawFile(name);
    included.set(name, text);
    queue.push(...references(text));
  }
  for (const name of references(model)) {
    titles[name] = included.get(name)!.split(/\r?\n/)[0].replace(/^0\s+/, '').replace(/\s+/g, ' ').trim();
  }

  let out = `0 FILE ${file}\n${colours}\n${model.trimEnd()}\n`;
  for (const [name, text] of included) out += `\n0 NOFILE\n0 FILE ${packedName(name)}\n${text.trimEnd()}\n`;
  const outName = file.replace(/\.ldr$/, '.mpd');
  writeFileSync(join(OUT_DIR, outName), out);
  console.log(`${outName}: ${included.size} parts and primitives, ${(out.length / 1024).toFixed(0)} KB`);
}

const sorted = Object.fromEntries(Object.entries(titles).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(join(OUT_DIR, 'titles.json'), JSON.stringify(sorted, null, 2) + '\n');
console.log(`Wrote ${OUT_DIR}/titles.json`);
