import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { partShapes } from '../scripts/part-shapes.ts';
import { REMOVED } from '../src/ldr.ts';

// The check's part shapes (scripts/part-shapes.ts) are read once for each colour and part, and each
// placed part takes its own line's shape. A line the loader makes no part of (a subpart the model
// places itself, which it draws into the model's own mesh) gets no shape, and every part after it
// keeps its own (decision 242 of 2026-11-20: the 4558 Metroliner's shapes were shifted by one).
describe('part shapes', () => {
  it.skipIf(!existsSync('ldraw/parts/s/4865p01b.dat'))('keeps every part on its own line when a line makes no part', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'part-shapes-'));
    try {
      const file = join(dir, 'shapes-gap.ldr');
      writeFileSync(
        file,
        [
          '0 A brick, a subpart placed directly, two bricks',
          '1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat',
          '1 7 0 -24 0 1 0 0 0 1 0 0 0 1 s/4865p01b.dat',
          '1 1 0 -48 0 1 0 0 0 1 0 0 0 1 3003.dat',
          '1 4 0 -72 0 1 0 0 0 1 0 0 0 1 3001.dat',
          '',
        ].join('\n'),
      );
      // As the loader makes parts: the subpart is drawn into the model, and every part after it
      // keeps its own shape.
      const made = await partShapes(file);
      expect(made.map((s) => s.name)).toEqual(['3001.dat', '3003.dat', '3001.dat']);
      expect(made.every((s) => s.shape.length > 0)).toBe(true);
      // The two red 3001s share one list.
      expect(made[2]).toBe(made[0]);
      // One for each part as the model's reading has them: the subpart, read as a part, has none.
      const shapes = await partShapes(file, undefined, [{ name: '3001.dat' }, { name: 's\\4865p01b.dat' }, { name: '3003.dat' }, { name: '3001.dat' }]);
      expect(shapes.map((s) => s.name)).toEqual(['3001.dat', 's/4865p01b.dat', '3003.dat', '3001.dat']);
      expect(shapes[1].shape).toEqual([]);
      expect(shapes[1].empty).toBe('the loader made nothing of its line');
      expect(shapes[2].shape.length).toBe(made[1].shape.length);
      expect(shapes[3]).toBe(shapes[0]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // A subpart placed directly that holds a part (the 6990's s/2684s01, the monorail motor's gear)
  // comes back from the loader as a child with no name, in the middle of the list. It is no line's:
  // its line gets no shape, and every part after it keeps its own (decision 247 of 2026-11-20).
  it.skipIf(!existsSync('ldraw/parts/s/2684s01.dat'))('passes over a child with no name', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'part-shapes-'));
    try {
      const file = join(dir, 'shapes-nameless.ldr');
      writeFileSync(
        file,
        [
          '0 A brick, a subpart placed directly that holds a part, two bricks',
          '1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat',
          '1 334 0 -24 0 1 0 0 0 1 0 0 0 1 s/2684s01.dat',
          '1 1 0 -48 0 1 0 0 0 1 0 0 0 1 3003.dat',
          '1 4 0 -72 0 1 0 0 0 1 0 0 0 1 3001.dat',
          '',
        ].join('\n'),
      );
      const made = await partShapes(file);
      expect(made.map((s) => s.name)).toEqual(['3001.dat', '3003.dat', '3001.dat']);
      expect(made.every((s) => s.shape.length > 0)).toBe(true);
      expect(made[2]).toBe(made[0]);
      // One for each part, as the model's reading has them: it leaves the subpart out.
      const shapes = await partShapes(file, undefined, [{ name: '3001.dat' }, { name: '3003.dat' }, { name: '3001.dat' }]);
      expect(shapes.map((s) => s.name)).toEqual(['3001.dat', '3003.dat', '3001.dat']);
      expect(shapes[1].shape.length).toBe(made[1].shape.length);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // A part an erratum removes keeps its number and is drawn as an empty file (REMOVED_FILE): its
  // shape is empty, and every part after it keeps its own (decision 248 of 2026-11-20: the 42093's
  // part 7, a removed 32270, left every later part with no shape).
  it.skipIf(!existsSync('ldraw/parts/32270.dat'))('keeps every part on its own line after a removed part', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'part-shapes-'));
    try {
      const file = join(dir, 'shapes-removed.ldr');
      writeFileSync(
        file,
        [
          '0 A brick, a gear an erratum removes, two bricks',
          '1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat',
          `${REMOVED} 1 72 0 -24 0 1 0 0 0 1 0 0 0 1 32270.dat`,
          '1 1 0 -48 0 1 0 0 0 1 0 0 0 1 3003.dat',
          '1 4 0 -72 0 1 0 0 0 1 0 0 0 1 3001.dat',
          '',
        ].join('\n'),
      );
      const parts = [{ name: '3001.dat' }, { name: '32270.dat', removed: true }, { name: '3003.dat' }, { name: '3001.dat' }];
      const shapes = await partShapes(file, undefined, parts);
      expect(shapes.map((s) => s.name)).toEqual(['3001.dat', '32270.dat', '3003.dat', '3001.dat']);
      expect(shapes[1].shape).toEqual([]);
      expect(shapes[1].empty).toBe('removed by an erratum');
      expect([0, 2, 3].every((i) => shapes[i].shape.length > 0 && !shapes[i].empty)).toBe(true);
      // A part out of step is an error, never a list of empty shapes.
      await expect(partShapes(file, undefined, [{ name: '3001.dat' }, { name: '3003.dat' }, { name: '3001.dat' }])).rejects.toThrow(/part 1 \(3003.dat\) has no line of its own/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
