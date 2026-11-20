import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { partShapes } from '../scripts/part-shapes.ts';

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
      const shapes = await partShapes(file, undefined, ['3001.dat', 's\\4865p01b.dat', '3003.dat', '3001.dat']);
      expect(shapes.map((s) => s.name)).toEqual(['3001.dat', 's/4865p01b.dat', '3003.dat', '3001.dat']);
      expect(shapes[1].shape).toEqual([]);
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
      const shapes = await partShapes(file, undefined, ['3001.dat', '3003.dat', '3001.dat']);
      expect(shapes.map((s) => s.name)).toEqual(['3001.dat', '3003.dat', '3001.dat']);
      expect(shapes[1].shape.length).toBe(made[1].shape.length);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
