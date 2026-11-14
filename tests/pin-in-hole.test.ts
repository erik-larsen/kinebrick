import { readFileSync } from 'node:fs';
import { Matrix4 } from 'three';
import { describe, expect, it } from 'vitest';
import { libraryConnections } from '../src/connections.ts';
import { findConnections } from '../src/inference/fits.ts';
import { worldCylinders } from '../src/inference/shared.ts';
import type { PlacedPart } from '../src/ldr.ts';

const table = libraryConnections(JSON.parse(readFileSync('data/library-connections.json', 'utf-8')));
// A part placed as an LDraw line places it: position, then the orientation's rows.
const placed = (name: string, x: number, y: number, z: number, rows = [1, 0, 0, 0, 1, 0, 0, 0, 1]): PlacedPart => ({ name, color: 16, matrix: new Matrix4().set(rows[0], rows[1], rows[2], x, rows[3], rows[4], rows[5], y, rows[6], rows[7], rows[8], z, 0, 0, 0, 1) });
const between = (parts: PlacedPart[]) => findConnections(worldCylinders(parts, table), false, new Set()).filter((c) => c.male !== c.female);

describe('a pin in a plate', () => {
  it("turns in a plate with a hole's hole, and isn't a stud there too (the 3176's hole is given open and closed at one end)", () => {
    // A long pin (6558, along its x) standing up through the hole of a plate 3 x 2 with hole (3176,
    // its hole at 0 8 -30, along y): its x turned to the plate's y.
    const kinds = between([placed('3176.dat', 0, 0, 0), placed('6558.dat', 0, 4, -30, [0, -1, 0, 1, 0, 0, 0, 0, 1])]).map((c) => c.kind);
    expect(kinds).toContain('revolute');
    expect(kinds).not.toContain('stud');
  });

  it("lets a round part on a single stud turn on it: a 1 x 1 round brick (3062b) on a brick's stud, its bore given as an anti-stud and as a hole", () => {
    // The round brick's bottom on the top of a brick 2 x 4 (3001), over its stud at 10 0 10.
    const kinds = between([placed('3001.dat', 0, 0, 0), placed('3062b.dat', 10, -24, 10)]).map((c) => c.kind);
    expect(kinds).toContain('revolute');
    expect(kinds).not.toContain('stud');
  });

  it("holds by its end in a plate's anti-stud, where it doesn't turn in a hole (a half pin under a plate)", () => {
    // A half pin (4274, along its x), its short end (x 0 to 4) up in the 3176's anti-stud at
    // -10 8 -10: its x turned to the plate's -y.
    const kinds = between([placed('3176.dat', 0, 0, 0), placed('4274.dat', -10, 8, -10, [0, 1, 0, -1, 0, 0, 0, 0, 1])]).map((c) => c.kind);
    expect(kinds).toContain('stud');
    expect(kinds).not.toContain('revolute');
  });
});
