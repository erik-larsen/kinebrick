import { existsSync } from 'node:fs';
import { BoxGeometry, BufferGeometry, Matrix4 } from 'three';
import { describe, expect, it } from 'vitest';
import { Box3, Vector3 } from 'three';
import { Collisions, inOnePlane, libraryIntersects, meetingPairs, pairNumber, PartMesh } from '../src/collisions.ts';
import { ExtendedTriangle } from 'three-mesh-bvh';
import { partShapes } from '../scripts/part-shapes.ts';

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
  it('shares one shape and one tree between parts given one list, shrinks it once, and still finds them meeting', () => {
    const shared = cube();
    const size = () => {
      shared[0].geometry.computeBoundingBox();
      return shared[0].geometry.boundingBox!.max.x;
    };
    const c = new Collisions([shared, shared], [0, 1], new Set(), [at(0), at(50)]);
    const [a, b] = c.shapeBoxes();
    expect(a).toBe(b);
    const tree = shared[0].geometry.boundsTree;
    expect(tree).toBeDefined();
    const shrunkOnce = size();
    expect(shrunkOnce).toBeCloseTo(10 - 0.25, 6);
    expect(c.check([at(0), at(30)])).toBeNull();
    expect(c.check([at(0), at(15)])).toEqual([0, 1]);
    // A second Collisions given the same list neither shrinks it again nor builds another tree.
    const again = new Collisions([shared, shared], [0, 1], new Set(), [at(0), at(50)]);
    expect(size()).toBe(shrunkOnce);
    expect(shared[0].geometry.boundsTree).toBe(tree);
    expect(again.check([at(0), at(15)])).toEqual([0, 1]);
  });

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

// A model's shapes for the check (scripts/part-shapes.ts): every copy of a part in one colour
// shares one list of meshes.
describe('part shapes', () => {
  it.skipIf(!existsSync('ldraw/LDConfig.ldr') && !existsSync('packed/8020-Building Set.mpd'))('gives the copies of one part in one colour one list', async () => {
    const shapes = await partShapes('models/8020-Building Set.mpd');
    const byName = new Map<string, PartMesh[][]>();
    for (const s of shapes) byName.set(s.name, [...(byName.get(s.name) ?? []), s.shape]);
    const repeated = [...byName.values()].filter((lists) => lists.length > 1);
    expect(repeated.length).toBeGreaterThan(0);
    expect(repeated.some((lists) => lists.every((l) => l === lists[0]))).toBe(true);
  });
});

// Two triangles in one plane don't cross (see inOnePlane in src/collisions.ts, decision 246).
describe('triangles in one plane', () => {
  const triangle = (corners: number[][]) => {
    const t = new ExtendedTriangle(...(corners.map((c) => new Vector3(...c)) as [Vector3, Vector3, Vector3]));
    t.needsUpdate = true;
    return t;
  };
  it('are apart where they are apart in the plane, though the library says they meet', () => {
    // A face of the 42075's crankshaft and one of its engine, as placed where its function 2 stopped:
    // in one plane to a few 1e-15, 11 LDU apart in it.
    const a = triangle([
      [8.73792308989778, -149.61844993105532, -217.21986073697832],
      [8.389246805136983, -151.76933277196272, -217.40773905741935],
      [-1.306561427787277, -150.20946200688533, -217.2714852857705],
    ]);
    const b = triangle([
      [19.612734648917872, -148.20432254617407, -217.096337561793],
      [20.4457195004669, -144.94431186840706, -216.81157759295144],
      [22.211538427732997, -157.39494999992942, -217.89913333335747],
    ]);
    expect(libraryIntersects.call(a, b)).toBe(true);
    expect(inOnePlane(a, b)).toBe(true);
    expect(a.intersectsTriangle(b)).toBe(false);
    expect(a.distanceToTriangle(b)).toBeGreaterThan(10);
  });

  it('touch, and do not cross, where they lie on each other', () => {
    const a = triangle([[0, 0, 0], [10, 0, 0], [0, 10, 0]]);
    const b = triangle([[2, 2, 0], [12, 2, 0], [2, 12, 0]]);
    expect(inOnePlane(a, b)).toBe(true);
    expect(a.intersectsTriangle(b)).toBe(false);
  });

  it('still cross where they cross', () => {
    const a = triangle([[0, 0, 0], [10, 0, 0], [0, 10, 0]]);
    const b = triangle([[2, 2, -5], [2, 2, 5], [8, 1, 0]]);
    expect(inOnePlane(a, b)).toBe(false);
    expect(a.intersectsTriangle(b)).toBe(true);
    // Nearly in one plane but tilted far beyond rounding: they cross.
    const c = triangle([[1, 1, -1e-6], [9, 1, 1e-6], [1, 9, 0]]);
    expect(inOnePlane(a, c)).toBe(false);
    expect(a.intersectsTriangle(c)).toBe(true);
  });
});
