import { Matrix4, Object3D } from 'three';
import { LDrawLoader } from 'three/addons/loaders/LDrawLoader.js';
import { LDrawConditionalLineMaterial } from 'three/addons/materials/LDrawConditionalLineMaterial.js';
import { describe, expect, it } from 'vitest';
import { loadedLines } from '../src/loadedLines.ts';

// The viewer's match of the loader's children to the packed model's lines (src/loadedLines.ts): a
// line whose file is a primitive (or a subpart) gets no child of its own, as the 42120's 252
// flexible axle segments ("42120 - axlehol8.dat", an unofficial primitive the model carries), and
// every line after it keeps its own child (decision 250 of 2026-11-20: matched by place, the
// 42120 never opened).
const text = [
  '0 FILE main.ldr',
  '0 !COLOUR Red CODE 4 VALUE #C91A09 EDGE #333333',
  '0 !COLOUR Blue CODE 1 VALUE #0055BF EDGE #333333',
  '0 !COLOUR Grey CODE 7 VALUE #9BA19D EDGE #333333',
  '1 4 0 0 0 1 0 0 0 1 0 0 0 1 brick.dat',
  '1 7 0 -24 0 1 0 0 0 1 0 0 0 1 segment.dat',
  '1 1 0 -48 0 1 0 0 0 1 0 0 0 1 brick.dat',
  '0 NOFILE',
  '0 FILE brick.dat',
  '0 A brick',
  '0 !LDRAW_ORG Unofficial_Part',
  '3 16 0 0 0 10 0 0 0 0 10',
  '0 NOFILE',
  '0 FILE segment.dat',
  '0 A segment',
  '0 !LDRAW_ORG Unofficial_Primitive',
  '3 16 0 0 0 5 0 0 0 0 5',
  '0 NOFILE',
  '',
].join('\n');
const at = (y: number) => new Matrix4().makeTranslation(0, y, 0);

async function load() {
  const loader = new LDrawLoader();
  loader.setConditionalLineMaterial(LDrawConditionalLineMaterial);
  const model = await new Promise<Object3D>((resolve, reject) => loader.parse(text, resolve, reject));
  return { loader, model };
}

describe('the loader\'s children matched to lines', () => {
  it('keeps every line on its own child after a primitive drawn into the model', async () => {
    const { loader, model } = await load();
    const objects = loadedLines(model, [{ name: 'brick.dat', color: 4, matrix: at(0) }, { name: 'segment.dat', color: 7, matrix: at(-24) }, { name: 'brick.dat', color: 1, matrix: at(-48) }], loader);
    expect(objects.map((o) => o.name)).toEqual(['brick.dat', 'segment.dat', 'brick.dat']);
    expect(objects[0].userData.colorCode).toBe('4');
    expect(objects[2].userData.colorCode).toBe('1');
    expect(objects[1].userData.noChild).toMatch(/Unofficial_Primitive/);
    expect(objects[1].position.y).toBe(-24);
    expect([objects[0], objects[2]].every((o) => !o.userData.noChild)).toBe(true);
  });

  it('fails where a part has no child of its own, never taking the next one', async () => {
    const { loader, model } = await load();
    // The third line in red, where the loader made the blue brick: no child is its own.
    expect(() => loadedLines(model, [{ name: 'brick.dat', color: 4, matrix: at(0) }, { name: 'segment.dat', color: 7, matrix: at(-24) }, { name: 'brick.dat', color: 4, matrix: at(-48) }], loader)).toThrow(/Line 2 \(brick.dat\): the loader made no part of it \(its file is a Unofficial_Part\)/);
  });
});
