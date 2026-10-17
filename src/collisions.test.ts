import { BoxGeometry, BufferGeometry, Matrix4 } from 'three';
import { describe, expect, it } from 'vitest';
import { Collisions, PartMesh } from './collisions.ts';

// A 20 LDU cube, as a part with one mesh.
function cube(): PartMesh[] {
  const box = new BoxGeometry(20, 20, 20);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', box.getAttribute('position').clone());
  geometry.setIndex(box.getIndex()!.clone());
  return [{ geometry, matrix: new Matrix4() }];
}

const at = (x: number) => new Matrix4().makeTranslation(x, 0, 0);

describe('collisions', () => {
  it('lets apart parts move freely, and catches them when they start to overlap', () => {
    const c = new Collisions([cube(), cube()], [0, 1], new Set(), [at(0), at(50)]);
    expect(c.watchedPairs).toBe(1);
    expect(c.check([at(0), at(30)])).toBeNull(); // 10 LDU gap
    expect(c.check([at(0), at(15)])).toEqual([0, 1]); // overlapping by 5
  });

  it("doesn't watch parts on the same body, connected parts, or parts touching at the start", () => {
    const sameBody = new Collisions([cube(), cube()], [0, 0], new Set(), [at(0), at(50)]);
    const connected = new Collisions([cube(), cube()], [0, 1], new Set(['0,1']), [at(0), at(50)]);
    const touching = new Collisions([cube(), cube()], [0, 1], new Set(), [at(0), at(15)]);
    for (const c of [sameBody, connected, touching]) {
      expect(c.watchedPairs).toBe(0);
      expect(c.check([at(0), at(5)])).toBeNull();
    }
  });
});
