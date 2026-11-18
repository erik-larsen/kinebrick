import { BoxGeometry, BufferGeometry, CylinderGeometry, Matrix4 } from 'three';
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

// A tube's wall, 20 LDU long along y, drawn with 16 sides as LDraw draws a round, and no ends.
function tube(radius: number): PartMesh[] {
  const wall = new CylinderGeometry(radius, radius, 20, 16, 1, true);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', wall.getAttribute('position').clone());
  geometry.setIndex(wall.getIndex()!.clone());
  return [{ geometry, matrix: new Matrix4() }];
}
const up = (y: number) => new Matrix4().makeTranslation(0, y, 0);
// The same, turned half a side about its length: its corners stand out past the first one's flat sides.
const turned = (m: Matrix4) => m.clone().multiply(new Matrix4().makeRotationY(Math.PI / 16));

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

  it('lets a part slide along another where they meet, and stops one pushed into it (decision 188)', () => {
    // A rod in a hole of the same round, its sides turned half a side, so its corners cross the
    // hole's flat sides as LDraw's shapes cross where a real axle fits its hole: slid in along the
    // hole, the walls meet with the motion along both, and it goes on; moved in sideways, it
    // pushes into the wall, and stops.
    const along = new Collisions([tube(10), tube(10)], [0, 1], new Set(), [up(0), turned(up(30))]);
    expect(along.check([up(0), turned(up(5))])).toBeNull();
    expect([...along.slid]).toEqual(['0,1']);
    const sideways = new Collisions([tube(10), tube(10)], [0, 1], new Set(), [up(0), turned(at(40))]);
    expect(sideways.check([up(0), turned(at(5))])).toEqual([0, 1]);
    expect(sideways.slid.size).toBe(0);
  });
});
