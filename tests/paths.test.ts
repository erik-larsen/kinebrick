import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { parseLdr } from '../src/ldr.ts';
import { LoopPath, loopLinks } from '../src/paths.ts';

// A chain as LDCad draws one: a path submodel round two circles of radius 20, 100 LDU apart,
// with a link on each, placed 50 LDU along z.
const MPD = `0 FILE Chained.ldr
1 16 0 0 50 1 0 0 0 1 0 0 0 1 Chain.ldr
0 NOFILE
0 FILE Chain.ldr
0 !LDCAD CONTENT [type=path] [addFallBack=default] [looped=true] [displayKind=links]
0 !LDCAD PATH_POINT [type=circle] [posOri=0 0 0 1 0 0 0 1 0 0 0 1] [cirR=20] [cirDir=xyCW]
0 !LDCAD PATH_POINT [type=circle] [posOri=0 -100 0 1 0 0 0 1 0 0 0 1] [cirR=20] [cirDir=xyCW]
0 !LDCAD PATH_SKIN [donCol=16] [donPart=3711.dat] [segSize=16]
1 16 20 -50 0 1 0 0 0 1 0 0 0 1 3711.dat
1 16 -20 -50 0 1 0 0 0 1 0 0 0 1 3711.dat
0 NOFILE
`;

describe('paths', () => {
  it("reads a path LDCad drew, its circles placed where its submodel puts them, and knows its links", () => {
    const parts = parseLdr(MPD);
    expect(parts).toHaveLength(2);
    const path = parts[0].path!;
    expect(parts[1].path).toBe(path);
    expect(path.looped).toBe(true);
    expect(path.skin).toBe('3711.dat');
    expect(path.points.map((p) => [p.circle, p.center.toArray(), p.axis.toArray(), p.radius, p.turn])).toEqual([
      [true, [0, 0, 50], [0, 0, 1], 20, 1],
      [true, [0, -100, 50], [0, 0, 1], 20, 1],
    ]);
  });

  it('goes round the circles and along the straight runs between them', () => {
    const path = new LoopPath(parseLdr(MPD)[0].path!.points);
    expect(path.length).toBeCloseTo(2 * Math.PI * 20 + 2 * 100, 6);
    // Every point of it is on a circle, or on a run 20 LDU either side of the line between them.
    for (let s = 0; s < path.length; s += 7) {
      const p = new Vector3().setFromMatrixPosition(path.frameAt(s));
      expect(p.z).toBeCloseTo(50, 9);
      const onRun = p.y < 0 && p.y > -100 && Math.abs(Math.abs(p.x) - 20) < 1e-6;
      const onCircle = [0, -100].some((y) => Math.abs(new Vector3(p.x, p.y - y, 0).length() - 20) < 1e-6);
      expect(onRun || onCircle).toBe(true);
    }
  });

  it('moves its links along it, each keeping its place on the path', () => {
    const parts = parseLdr(MPD);
    const place = loopLinks(parts[0].path!.points, parts.map((p) => p.matrix))!;
    const at = (s: number) => place(s).map((m) => new Vector3().setFromMatrixPosition(m));
    // Half way round, the two links have swapped places.
    const half = at(2 * Math.PI * 10 + 100);
    expect(half[0].distanceTo(new Vector3(-20, -50, 50))).toBeLessThan(1e-6);
    expect(half[1].distanceTo(new Vector3(20, -50, 50))).toBeLessThan(1e-6);
  });
});
