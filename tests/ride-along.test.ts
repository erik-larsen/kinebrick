import { Matrix4, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { rideAlong } from '../src/inference/rideAlong.ts';
import type { PlacedPart } from '../src/ldr.ts';
import type { WorldCylinder } from '../src/inference/shared.ts';

// A part at (x, 0, 0), with one connection point there.
const part = (x: number): PlacedPart => ({ name: '3001.dat', color: 0, matrix: new Matrix4().makeTranslation(x, 0, 0) }) as PlacedPart;
const point = (p: number, x: number): WorldCylinder => ({ part: p, gender: 'F', caps: 'none', start: new Vector3(x, 0, 0), dir: new Vector3(0, 1, 0), secs: [] });

describe('loose parts riding along', () => {
  // The main group is part 0 at x 0. A loose group, parts 1 and 2 (a trailer), stands at x 30 and 40;
  // another, parts 3 and 4 (a container), stands on it at x 50 and 60: 10 from the trailer, 50 from
  // the main group.
  const parts = [part(0), part(30), part(40), part(50), part(60)];
  const cyls = parts.map((_, i) => point(i, [0, 30, 40, 50, 60][i]));
  const joined = [
    { male: 1, female: 2, kind: 'rigid' as const, from: new Vector3(), to: new Vector3() },
    { male: 3, female: 4, kind: 'rigid' as const, from: new Vector3(), to: new Vector3() },
  ];
  const welds = rideAlong(parts, cyls, joined, [1, 2, 3, 4]);

  it('welds the group nearest the main group to it first', () => {
    expect(welds[0]).toMatchObject({ male: 1, female: 0 });
  });

  it('lets the group standing on it ride on it, not on the main group', () => {
    expect(welds[1]).toMatchObject({ male: 3, female: 2 });
    expect(welds).toHaveLength(2);
  });

  it('lets a single loose part ride on the main group only, even beside a loose group', () => {
    // Part 5, alone, at x 65: 5 from the container, 65 from the main group.
    const more = [...parts, part(65)];
    const moreCyls = more.map((_, i) => point(i, [0, 30, 40, 50, 60, 65][i]));
    const all = rideAlong(more, moreCyls, joined, [1, 2, 3, 4, 5]);
    expect(all.find((w) => w.male === 5)).toMatchObject({ female: 0 });
  });
});
