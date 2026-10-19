// Packs a model file together with every LDraw part and primitive it uses into one file, which
// three.js's LDraw loader reads without needing an LDraw parts library: the model flattened, its
// submodels' parts placed directly, in the order the viewer's own reading of the model gives
// (src/ldr.ts), then any shapes its submodels draw without parts (hoses, springs), each as a file
// of its own, then every file those use. npm run pack packs the models in models/ this way, from
// the LDraw library on disk (scripts/pack-models.ts); the viewer packs a model you open from your
// own computer the same way, fetching the files from an LDraw library online (src/library.ts).

import { normalizePartName } from './connections.ts';
import { embeddedParts, modelFiles, parseModel, partLine, PlacedPart, PlacedPath, PlacedShape } from './ldr.ts';

export interface Packed {
  text: string; // the packed file
  parts: PlacedPart[]; // as parseModel reads them
  shapes: PlacedShape[];
  paths: PlacedPath[];
  primitives: string[]; // the files the model places that are primitives (drawn shapes)
  pieces: Record<string, string[]>; // the parts it places that are read as their pieces (role "split"): their lines
  titles: Record<string, string>; // each part's LDraw title, e.g. "Technic Brick 1 x 4 with Holes"
  files: number; // how many files it holds besides the model
  missing: string[]; // files neither the model file nor the library has, packed empty
}

// The files a file refers to, from its type 1 lines.
export function references(text: string): string[] {
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

// A file's lines with any subpart named with a capital S ("S\3634a.dat", as older copies of the
// library have) named with a small one, which is all the loader takes for a subpart.
function smallS(text: string): string {
  return text.replace(/^(\s*1(?:\s+\S+){13}\s+)S([\\/])/gm, '$1s$2');
}

// Packs model file `source`, naming the packed model `name`. `readFile` gives a file from the LDraw
// library, or null if the library hasn't got it; parts the model file brings with it (unofficial
// ones) come first. `colours` is LDConfig.ldr's "!COLOUR" lines, so the packed file brings its own
// colours. `isPrimitive` says which files are LDraw primitives (see parseModel), and `roles` which
// parts are read as their pieces.
export async function packModel(
  name: string,
  source: string,
  colours: string,
  readFile: (name: string) => Promise<string | null>,
  isPrimitive: (name: string) => boolean,
  roles: Record<string, string>,
): Promise<Packed> {
  const embedded = embeddedParts(source);
  const missing: string[] = [];
  const read = async (file: string) => {
    const text = embedded.get(file) ?? (await readFile(file));
    if (text === null) missing.push(file);
    return text ?? '';
  };

  // The files the model places directly, and the lines of those read as their pieces.
  const placed = [...new Set([...modelFiles(source).values()].flat().flatMap((line) => references(line)))].sort();
  const pieces: Record<string, string[]> = {};
  for (const file of placed) {
    if (roles[file] === 'split') pieces[file] = (await read(file)).split(/\r?\n/).filter((line) => /^\s*1\s/.test(line));
  }
  const { parts, shapes, paths } = parseModel(source, isPrimitive, (file) => pieces[file] ?? null);
  const shapeName = (submodel: string) => `kinebrick-shape/${submodel}`;
  const model = [
    ...parts.map(partLine),
    ...shapes.map((s) => partLine({ name: shapeName(s.submodel), color: s.color, matrix: s.matrix })),
  ].join('\n');

  // Every file the model needs, each once, found by following references, a round of
  // references at a time (each round's files read all at once).
  const included = new Map<string, string>();
  for (const s of shapes) included.set(shapeName(s.submodel), s.lines.join('\n'));
  let round = [...references(model), ...shapes.flatMap((s) => references(s.lines.join('\n')))];
  while (round.length) {
    const names = [...new Set(round)].filter((file) => !included.has(file));
    const texts = await Promise.all(names.map(read));
    names.forEach((file, i) => included.set(file, texts[i]));
    round = texts.flatMap(references);
  }

  const titles: Record<string, string> = {};
  for (const p of parts) titles[p.name] = included.get(p.name)!.split(/\r?\n/)[0].replace(/^0\s+/, '').replace(/\s+/g, ' ').trim();

  let text = `0 FILE ${name}.ldr\n${colours}\n${model}\n`;
  for (const [file, lines] of included) text += `\n0 NOFILE\n0 FILE ${packedName(file)}\n${smallS(lines).trimEnd()}\n`;
  return { text, parts, shapes, paths, primitives: placed.filter(isPrimitive), pieces, titles, files: included.size, missing };
}
