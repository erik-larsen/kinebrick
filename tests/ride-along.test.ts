import { Matrix4, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { rideAlong } from '../src/inference/rideAlong.ts';
import type { PlacedPart } from '../src/ldr.ts';
import type { WorldCylinder } from '../src/inference/shared.ts';

// A part at (x, 0, 0), with one connection point there.
const part = (x: number): PlacedPart => ({ name: '3001.dat', color: 0, matrix: new Matrix4().makeTranslation(x, 0, 0) }) as PlacedPart;
const point = (p: number, x: number): WorldCylinder => ({ part: p, gender: 'F', caps: 'none', start: new Vector3(x, 0, 0), dir: new Vector3(0, 1, 0), secs: [] });

describe('loose parts riding along', () => {
  // The main group is part 0 at x 0. A second model, parts 1 and 2 (a trailer), stands at x 30 and
  // 40; another, parts 3 and 4 (a container), stands on it at x 50 and 60: 10 from the trailer, 50
  // from the main group. Part 5, alone, is at x 65; parts 6 and 7, a loose group but no second
  // model, at x 70 and 80.
  const xs = [0, 30, 40, 50, 60, 65, 70, 80];
  const parts = xs.map(part);
  const cyls = xs.map((x, i) => point(i, x));
  const joined = [
    { male: 1, female: 2, kind: 'rigid' as const, from: new Vector3(), to: new Vector3() },
    { male: 3, female: 4, kind: 'rigid' as const, from: new Vector3(), to: new Vector3() },
    { male: 6, female: 7, kind: 'rigid' as const, from: new Vector3(), to: new Vector3() },
  ];
  const welds = rideAlong(parts, cyls, joined, [1, 2, 3, 4, 5, 6, 7], undefined, [[1, 2], [3, 4]]);
  const of = (male: number) => welds.find((w) => w.male === male);

  it('welds the second model nearest the main group to it first', () => {
    expect(welds[0]).toMatchObject({ male: 1, female: 0 });
  });

  it('lets the second model standing on it ride on it, not on the main group', () => {
    expect(welds[1]).toMatchObject({ male: 3, female: 2 });
  });

  it('lets a single loose part ride on the main group only, even beside a second model', () => {
    expect(of(5)).toMatchObject({ female: 0 });
  });

  it('lets a loose group that is no second model ride on the main group only', () => {
    expect(of(6)).toMatchObject({ female: 0 });
    expect(welds).toHaveLength(4);
  });
});
