import { BoxGeometry, BufferGeometry, Matrix4 } from 'three';
import { describe, expect, it } from 'vitest';
import { Box3, Vector3 } from 'three';
import { Collisions, meetingPairs, pairNumber, PartMesh } from '../src/collisions.ts';

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

  it('waits, when asked to, for the pairs near at the start, found elsewhere, and then watches as it would have', () => {
    const placed = [at(0), at(15), at(50)];
    const now = new Collisions([cube(), cube(), cube()], [0, 1, 2], new Set(), placed);
    const later = new Collisions([cube(), cube(), cube()], [0, 1, 2], new Set(), placed, true);
    expect(later.watchedPairs).toBe(0);
    expect(later.check([at(0), at(15), at(5)])).toBeNull(); // no collision stop while it waits
    const tested = later.candidates([0, 1, 2], new Set(), placed);
    later.setNear(tested, new Set(tested.filter(([a, b]) => later.nearNow(a, b, placed)).map(([a, b]) => pairNumber(a, b, 3))), placed);
    expect(later.watchedPairs).toBe(now.watchedPairs);
    expect(later.check([at(0), at(15), at(30)])).toEqual(now.check([at(0), at(15), at(30)]));
  });

  it('finds the pairs whose boxes meet by sorting them, the same as trying every pair', () => {
    const boxes = Array.from({ length: 40 }, (_, i) => new Box3(new Vector3(0, 0, 0), new Vector3(10 + (i % 7), 10, 10)));
    const placed = boxes.map((_, i) => at(((i * 37) % 23) * 6));
    const every: string[] = [];
    for (let a = 0; a < boxes.length; a++) for (let b = a + 1; b < boxes.length; b++) if (boxes[a].clone().applyMatrix4(placed[a]).expandByScalar(1).intersectsBox(boxes[b].clone().applyMatrix4(placed[b]))) every.push(`${a},${b}`);
    const sorted = meetingPairs(boxes, placed, () => true).map(([a, b]) => `${a},${b}`);
    expect(sorted.sort()).toEqual(every.sort());
  });

  it('never traps a model moved into overlap before the near pairs were known: that pose is its start', () => {
    const placed = [at(0), at(50)];
    const later = new Collisions([cube(), cube()], [0, 1], new Set(), placed, true);
    const dragged = [at(0), at(10)]; // a drag ran the second cube into the first meanwhile
    const tested = later.candidates([0, 1], new Set(), placed);
    later.setNear(tested, new Set(), placed, dragged);
    expect(later.check(dragged)).toBeNull(); // not stuck where it is
    expect(later.check([at(0), at(40)])).toBeNull(); // and free to come back out
  });
});
