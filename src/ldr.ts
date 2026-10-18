// Reads the parts of an LDraw model file: which part, which colour, and where.
//
// A model file is either a plain .ldr, or a multi-part file (.mpd) of several files one after
// another, each starting with "0 FILE <name>". The first is the main model. The others are
// submodels (a gearbox, a wheel assembly), placed by type 1 lines like parts, or parts that
// aren't in the LDraw library (the official model repository embeds unofficial parts this
// way). Submodels are flattened: each part they hold is placed where the submodel puts it.

import { Matrix4 } from 'three';
import { normalizePartName } from './connections.ts';

export interface PlacedPart {
  name: string; // normalized file name, e.g. "3701.dat"
  color: number; // LDraw colour code
  matrix: Matrix4; // part coordinates -> model coordinates, in LDU
  submodel?: string; // the submodel it's in (the innermost one), if not the main model
}

// Colour 16 means "the colour of whatever placed me".
const INHERIT = 16;

// The files in a model file, by normalized name, in order; the first is the main model. A
// file with no "0 FILE" lines is one file, named "".
export function modelFiles(text: string): Map<string, string[]> {
  const files = new Map<string, string[]>();
  let current: string[] | null = null;
  for (const line of text.split(/\r?\n/)) {
    const tokens = line.trim().split(/\s+/);
    if (tokens[0] === '0' && tokens[1] === 'FILE') {
      current = [];
      const name = normalizePartName(tokens.slice(2).join(' '));
      if (!files.has(name)) files.set(name, current);
      continue;
    }
    // Ends a file, or starts embedded data (a texture), which isn't part of any file.
    if (tokens[0] === '0' && (tokens[1] === 'NOFILE' || tokens[1] === '!DATA')) {
      current = null;
      continue;
    }
    if (!current && files.size === 0) files.set('', (current = []));
    current?.push(line);
  }
  return files;
}

// Whether a file in a model file is a part (or subpart or primitive), which its header says
// with "0 !LDRAW_ORG Unofficial_Part" and the like, rather than a submodel.
function isPart(lines: string[]): boolean {
  return lines.some((line) => /^\s*0\s+!LDRAW_ORG\s+(Unofficial_)?(Part|Subpart|Primitive|8_Primitive|48_Primitive|Shortcut)\b/i.test(line));
}

// The parts a model file brings with it (not submodels), by normalized name.
export function embeddedParts(text: string): Map<string, string> {
  const parts = new Map<string, string>();
  for (const [name, lines] of modelFiles(text)) if (name && isPart(lines)) parts.set(name, lines.join('\n'));
  return parts;
}

// KineBrick's own settings for a model, from "0 !KINEBRICK" lines in its main file (LDraw
// programs skip meta-commands they don't know, so the file still opens anywhere), e.g.
//   0 !KINEBRICK SCRUB [percent=10]   tyres may scrub sideways by up to 10% of how far they roll
export interface ModelSettings {
  scrub?: number; // percent
}

export function modelSettings(text: string): ModelSettings {
  const settings: ModelSettings = {};
  for (const line of [...modelFiles(text).values()][0] ?? []) {
    const scrub = /^\s*0\s+!KINEBRICK\s+SCRUB\b.*\[percent=([\d.]+)\]/.exec(line);
    if (scrub) settings.scrub = Number(scrub[1]);
  }
  return settings;
}

// Shapes a submodel draws directly, with lines of types 2 to 5, rather than with parts: a hose
// or a spring bent to fit, as CAD programs generate them. They have no connections, so they
// don't take part in the mechanism, but they're drawn.
export interface PlacedShape {
  submodel: string; // the submodel whose lines they are
  lines: string[]; // those lines, in the submodel's coordinates
  color: number;
  matrix: Matrix4; // submodel coordinates -> model coordinates
  nearPart: number; // a part placed by the same submodel line (it moves with that part), or -1
}

// Every part in the model, with submodels flattened, in the order their lines come (a
// submodel's parts where the submodel's line is), and the shapes drawn without parts.
// `isPrimitive` says which referenced files are LDraw primitives (pieces of shape, such as a
// cylinder, rather than parts): a submodel that places them is drawing a shape, as CAD
// programs draw a string or a hose. Only the LDraw library knows for sure, so the caller says.
// `piecesOf` gives the lines of a part that's read as the parts it's made of (a 4x4 turntable,
// one LDraw file, is a base and a top that turns on it), or null for any other part.
export function parseModel(
  text: string,
  isPrimitive: (name: string) => boolean = () => false,
  piecesOf: (name: string) => string[] | null = () => null,
): { parts: PlacedPart[]; shapes: PlacedShape[] } {
  const files = modelFiles(text);
  const submodels = new Map([...files].filter(([name, lines]) => name && !isPart(lines)));
  const referenced = (line: string) => normalizePartName(line.trim().split(/\s+/).slice(14).join(' '));
  const drawn = (line: string) => /^\s*[2-5]\s/.test(line) || (/^\s*1\s/.test(line) && isPrimitive(referenced(line)));
  const shapeLines = new Map([...submodels].map(([name, lines]) => [name, lines.filter(drawn)]));
  const parts: PlacedPart[] = [];
  const shapes: PlacedShape[] = [];
  // `pieces`: the lines are a part's pieces, which go in the submodel the part is in.
  const place = (lines: string[], placement: Matrix4, color: number, submodel: string | undefined, depth: number, pieces = false) => {
    if (depth > 64) throw new Error(`Submodels nested too deep (does one place itself?): ${submodel}`);
    const first = parts.length;
    for (const line of lines) {
      const tokens = line.trim().split(/\s+/);
      if (tokens[0] !== '1' || tokens.length < 15) continue;
      const [x, y, z, a, b, c, d, e, f, g, h, i] = tokens.slice(2, 14).map(Number);
      const matrix = placement.clone().multiply(new Matrix4().set(a, b, c, x, d, e, f, y, g, h, i, z, 0, 0, 0, 1));
      const ownColor = Number(tokens[1]);
      const partColor = ownColor === INHERIT ? color : ownColor;
      const name = normalizePartName(tokens.slice(14).join(' '));
      if (isPrimitive(name)) continue; // drawn with the submodel's shapes
      const sub = submodels.get(name);
      const ownPieces = sub ? null : piecesOf(name);
      if (sub) place(sub, matrix, partColor, name, depth + 1);
      else if (ownPieces) place(ownPieces, matrix, partColor, submodel, depth + 1, true);
      else parts.push({ name, color: partColor, matrix, ...(submodel ? { submodel } : {}) });
    }
    const own = submodel && !pieces ? shapeLines.get(submodel)! : [];
    if (own.length) shapes.push({ submodel: submodel!, lines: own, color, matrix: placement, nearPart: parts.length > first ? first : -1 });
  };
  place([...files.values()][0] ?? [], new Matrix4(), INHERIT, undefined, 0);
  return { parts, shapes };
}

// Every part in the model (see parseModel).
export function parseLdr(text: string, isPrimitive?: (name: string) => boolean, piecesOf?: (name: string) => string[] | null): PlacedPart[] {
  return parseModel(text, isPrimitive, piecesOf).parts;
}

// A part as a type 1 line, as the model would have it if it had no submodels.
export function partLine(p: PlacedPart): string {
  const m = p.matrix.elements; // column by column
  const n = (v: number) => {
    const s = (Math.abs(v) < 1e-9 ? 0 : v).toFixed(6).replace(/\.?0+$/, '');
    return s === '-0' ? '0' : s;
  };
  const numbers = [m[12], m[13], m[14], m[0], m[4], m[8], m[1], m[5], m[9], m[2], m[6], m[10]];
  return `1 ${p.color} ${numbers.map(n).join(' ')} ${p.name}`;
}
