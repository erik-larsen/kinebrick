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

// The model's title: its first line, a comment.
export function modelTitle(text: string): string {
  const first = [...modelFiles(text).values()][0]?.find((line) => line.trim() !== '') ?? '';
  return first.trim().replace(/^0\s+/, '').replace(/^(Title|Name):\s*/i, '');
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
export function parseModel(text: string): { parts: PlacedPart[]; shapes: PlacedShape[] } {
  const files = modelFiles(text);
  const submodels = new Map([...files].filter(([name, lines]) => name && !isPart(lines)));
  const shapeLines = new Map([...submodels].map(([name, lines]) => [name, lines.filter((l) => /^\s*[2-5]\s/.test(l))]));
  const parts: PlacedPart[] = [];
  const shapes: PlacedShape[] = [];
  const place = (lines: string[], placement: Matrix4, color: number, submodel: string | undefined, depth: number) => {
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
      const sub = submodels.get(name);
      if (sub) place(sub, matrix, partColor, name, depth + 1);
      else parts.push({ name, color: partColor, matrix, ...(submodel ? { submodel } : {}) });
    }
    const own = submodel ? shapeLines.get(submodel)! : [];
    if (own.length) shapes.push({ submodel: submodel!, lines: own, color, matrix: placement, nearPart: parts.length > first ? first : -1 });
  };
  place([...files.values()][0] ?? [], new Matrix4(), INHERIT, undefined, 0);
  return { parts, shapes };
}

// Every part in the model (see parseModel).
export function parseLdr(text: string): PlacedPart[] {
  return parseModel(text).parts;
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
