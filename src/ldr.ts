// Reads the parts of an LDraw model file (.ldr): which part, which colour, and where.

import { Matrix4 } from 'three';
import { normalizePartName } from './connections.ts';

export interface PlacedPart {
  name: string; // normalized file name, e.g. "3701.dat"
  color: number; // LDraw colour code
  matrix: Matrix4; // part coordinates -> model coordinates, in LDU
}

// Only the model's own type 1 lines are read. Models made of submodels (MPD files with
// "0 FILE" sections) aren't supported yet.
export function parseLdr(text: string): PlacedPart[] {
  const parts: PlacedPart[] = [];
  for (const line of text.split(/\r?\n/)) {
    const tokens = line.trim().split(/\s+/);
    if (tokens[0] === '0' && tokens[1] === 'FILE') {
      throw new Error('Models with submodels (0 FILE) are not supported yet');
    }
    if (tokens[0] !== '1' || tokens.length < 15) continue;
    const [x, y, z, a, b, c, d, e, f, g, h, i] = tokens.slice(2, 14).map(Number);
    const matrix = new Matrix4().set(a, b, c, x, d, e, f, y, g, h, i, z, 0, 0, 0, 1);
    parts.push({ name: normalizePartName(tokens.slice(14).join(' ')), color: Number(tokens[1]), matrix });
  }
  return parts;
}
