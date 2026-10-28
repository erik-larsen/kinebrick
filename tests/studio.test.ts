import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { studioModel } from '../src/studio.ts';

// tests/fixtures/simple-car.io: models/simple-car.ldr as model.ldr, beside a stand-in thumbnail,
// zipped with Studio's password (zip -P), as a BrickLink Studio file is.
const io = readFileSync('tests/fixtures/simple-car.io');
const bytes = io.buffer.slice(io.byteOffset, io.byteOffset + io.byteLength);

describe('BrickLink Studio files', () => {
  it('give the LDraw model inside them', async () => {
    expect(await studioModel(bytes)).toBe(readFileSync('models/simple-car.ldr', 'utf-8'));
  });

  it("say so when a file isn't one", async () => {
    await expect(studioModel(new TextEncoder().encode('0 not a zip').buffer)).rejects.toThrow("isn't a ZIP archive");
  });
});
