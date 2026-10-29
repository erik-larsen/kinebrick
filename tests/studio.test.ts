import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { studioModel, studioParts } from '../src/studio.ts';

// tests/fixtures/simple-car.io: models/simple-car.ldr as model.ldr, beside a stand-in thumbnail,
// zipped with Studio's password (zip -P), as a BrickLink Studio file is.
const io = readFileSync('tests/fixtures/simple-car.io');
const bytes = io.buffer.slice(io.byteOffset, io.byteOffset + io.byteLength);

describe('BrickLink Studio files', () => {
  it('give the LDraw model inside them', async () => {
    expect((await studioModel(bytes)).model).toBe(readFileSync('models/simple-car.ldr', 'utf-8'));
  });

  it("bring the parts written into them, each by its name, with Studio's -1 for a part's own colour read as LDraw's 16", () => {
    const parts = studioParts('0 FILE model.ldr\n1 72 0 0 0 1 0 0 0 1 0 0 0 1 2431pb568.dat\n0 NOFILE\n0 FILE 2431pb568.dat\n0 Tile 1 x 4 with Sticker\n1 -1 0 0 0 1 0 0 0 1 0 0 0 1 2431.dat\n1 -1 0 -8 0 1 0 0 0 1 0 0 0 1 6062886c.dat\n0 NOFILE\n');
    expect([...parts.keys()]).toEqual(['2431pb568.dat']);
    expect(parts.get('2431pb568.dat')).toBe('0 Tile 1 x 4 with Sticker\n1 16 0 0 0 1 0 0 0 1 0 0 0 1 2431.dat\n1 16 0 -8 0 1 0 0 0 1 0 0 0 1 6062886c.dat');
  });

  it("say so when a file isn't one", async () => {
    await expect(studioModel(new TextEncoder().encode('0 not a zip').buffer)).rejects.toThrow("isn't a ZIP archive");
  });
});
