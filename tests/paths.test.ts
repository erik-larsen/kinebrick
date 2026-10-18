import { readFileSync } from 'node:fs';
import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { ConnectionTable } from '../src/connections.ts';
import { Kinematics } from '../src/kinematics.ts';
import { parseLdr, parseModel } from '../src/ldr.ts';
import { inferMechanism } from '../src/mechanism.ts';
import { LoopPath, loopLinks } from '../src/paths.ts';

const table: ConnectionTable = JSON.parse(readFileSync('data/connections.json', 'utf-8'));
const roles: Record<string, string> = JSON.parse(readFileSync('data/roles.json', 'utf-8'));

// A rubber band round two axles through a Technic brick, on circles of radius 8 and 16, drawn
// (as LDCad draws a band) with shapes; `way` is how the band goes round the second: the same
// way as the first, or crossed.
const band = (way: string) => `0 FILE Belt.ldr
1 16 0 0 0 1 0 0 0 1 0 0 0 1 3701.dat
1 16 -20 10 0 0 0 -1 0 1 0 1 0 0 3705.dat
1 16 20 10 0 0 0 -1 0 1 0 1 0 0 3705.dat
1 16 0 0 0 1 0 0 0 1 0 0 0 1 Band.ldr
0 NOFILE
0 FILE Band.ldr
0 !LDCAD CONTENT [type=path] [looped=true] [displayKind=mm]
0 !LDCAD PATH_POINT [type=circle] [posOri=-20 10 30 1 0 0 0 1 0 0 0 1] [cirR=8] [cirDir=xyCW]
0 !LDCAD PATH_POINT [type=circle] [posOri=20 10 30 1 0 0 0 1 0 0 0 1] [cirR=16] [cirDir=${way}]
0 !LDCAD PATH_SKIN [donPart=ldcRubberBandSqSeg.dat]
2 16 -20 2 30 20 -6 30
0 NOFILE
`;

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

  it('a rubber band turns its pulleys together, at speeds in the inverse ratio of its circles; crossed, the other way', () => {
    for (const [way, ratio] of [
      ['xyCW', 0.5],
      ['xyCCW', -0.5],
    ] as const) {
      const { parts, paths } = parseModel(band(way));
      const mech = inferMechanism(parts, table, roles, paths);
      expect(mech.loops).toHaveLength(1);
      expect(mech.loops[0].wheels).toHaveLength(2);
      const kin = new Kinematics(mech);
      const [small, big] = mech.loops[0].wheels;
      kin.turnJoint(small.joint, 1);
      const turned = (w: typeof small) => (mech.joints[w.joint].bodyB === w.body ? 1 : -1) * kin.jointAngles[w.joint];
      expect(turned(big) / turned(small)).toBeCloseTo(ratio, 6);
    }
  });
});
