import { readFileSync } from 'node:fs';
import { Matrix4 } from 'three';
import { describe, expect, it } from 'vitest';
import { libraryConnections } from '../src/connections.ts';
import { inferMechanism } from '../src/mechanism.ts';
import type { PlacedPart } from '../src/ldr.ts';

const table = libraryConnections(JSON.parse(readFileSync('data/library-connections.json', 'utf-8')));
const roles = JSON.parse(readFileSync('data/roles.json', 'utf-8'));
const placed = (name: string, x: number, y: number, z: number): PlacedPart => ({ name, color: 16, matrix: new Matrix4().makeTranslation(x, y, z) });

describe('a shock absorber in two parts', () => {
  // A 6.5L shock as its complete part (73129) places its halves: the rod 4254 110 above the
  // cylinder 4255, fully out.
  const mech = inferMechanism([placed('4255.dat', 0, 0, 0), placed('4254.dat', 0, 110, 0)], table, roles, []);
  const slide = mech.joints.find((j) => j.kind === 'slide');

  it('slides, and turns, between its end stops: fully out as built, 20 LDU to fully in', () => {
    expect(slide).toBeDefined();
    expect(slide!.turns).toBe(true);
    const [lo, hi] = slide!.range!;
    expect(Math.min(Math.abs(lo), Math.abs(hi))).toBeCloseTo(0, 6);
    expect(Math.max(Math.abs(lo), Math.abs(hi))).toBeCloseTo(20, 6);
  });

  it('is held by its spring at rest: its slide and its joint say so', () => {
    expect(mech.connections.some((c) => c.kind === 'slide' && c.springHeld === true)).toBe(true);
    expect(slide!.springHeld).toBe(true);
  });
});
