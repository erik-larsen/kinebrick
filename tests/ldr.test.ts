import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { embeddedParts, parseLdr, parseModel, partLine, PlacedPart } from '../src/ldr.ts';

// A main model placing a wheel submodel twice (once turned half round), which holds an axle
// and another submodel, a hub; a shape drawn without parts; and a part the file brings with it.
const MPD = `0 FILE Car.ldr
0 Little car
0 !LDRAW_ORG Model
1 72 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat
1 4 0 0 100 1 0 0 0 1 0 0 0 1 Wheel.ldr
1 1 0 0 -100 -1 0 0 0 1 0 0 0 -1 wheel.LDR
1 16 0 -50 0 1 0 0 0 1 0 0 0 1 myPart.dat
0 NOFILE
0 FILE Wheel.ldr
0 !LDRAW_ORG Model
1 0 0 0 10 0 0 1 0 1 0 -1 0 0 3704.dat
1 16 0 0 20 1 0 0 0 1 0 0 0 1 hub.ldr
3 16 0 0 0 1 0 0 0 1 0
0 NOFILE
0 FILE hub.ldr
1 16 0 0 0 1 0 0 0 1 0 0 0 1 3482.dat
0 NOFILE
0 FILE myPart.dat
0 Unofficial thing
0 !LDRAW_ORG Unofficial_Part
4 16 0 0 0 1 0 0 1 1 0 0 1 0
0 NOFILE
`;

const at = (p: PlacedPart) => new Vector3().setFromMatrixPosition(p.matrix);

describe('reading model files', () => {
  it('reads a plain .ldr as before', () => {
    const parts = parseLdr('0 Plain\n1 4 10 0 0 1 0 0 0 1 0 0 0 1 3001.DAT\n');
    expect(parts).toHaveLength(1);
    expect(parts[0]).toMatchObject({ name: '3001.dat', color: 4 });
    expect(parts[0].submodel).toBeUndefined();
  });

  it('flattens submodels, in order, each part placed where its submodels put it', () => {
    const parts = parseLdr(MPD);
    expect(parts.map((p) => p.name)).toEqual(['3001.dat', '3704.dat', '3482.dat', '3704.dat', '3482.dat', 'mypart.dat']);
    expect(at(parts[1])).toEqual(new Vector3(0, 0, 110));
    expect(at(parts[2])).toEqual(new Vector3(0, 0, 120));
    // The second wheel is turned half round about y, so its hub is on the other side.
    expect(at(parts[3]).z).toBeCloseTo(-110, 9);
    expect(at(parts[4]).z).toBeCloseTo(-120, 9);
    expect(parts[2].submodel).toBe('hub.ldr');
    expect(parts[1].submodel).toBe('wheel.ldr');
  });

  it('gives colour 16 the colour of whatever placed it, through every level', () => {
    expect(parseLdr(MPD).map((p) => p.color)).toEqual([72, 0, 4, 0, 1, 16]);
  });

  it("treats a file whose header says it's a part as a part, which the file brings with it", () => {
    expect([...embeddedParts(MPD).keys()]).toEqual(['mypart.dat']);
  });

  it('keeps shapes a submodel draws without parts, for each time the submodel is placed', () => {
    const { parts, shapes } = parseModel(MPD);
    expect(shapes.map((s) => s.submodel)).toEqual(['wheel.ldr', 'wheel.ldr']);
    expect(shapes.map((s) => s.color)).toEqual([4, 1]);
    // Each moves with the first part of the same placement: that wheel's axle.
    expect(shapes.map((s) => s.nearPart)).toEqual([1, 3]);
    expect(parts[shapes[1].nearPart].name).toBe('3704.dat');
  });

  it('reads a part the caller says is made of pieces as those pieces, each placed where the part puts it', () => {
    const pieces = (name: string) => (name === '3001.dat' ? ['1 16 0 0 0 1 0 0 0 1 0 0 0 1 base.dat', '1 4 0 -8 0 1 0 0 0 1 0 0 0 1 top.dat'] : null);
    const parts = parseLdr(MPD, undefined, pieces);
    expect(parts.slice(0, 2).map((p) => [p.name, p.color])).toEqual([['base.dat', 72], ['top.dat', 4]]);
    expect(at(parts[1])).toEqual(new Vector3(0, -8, 0));
    expect(parts[1].submodel).toBeUndefined(); // in the main model, as the part was
  });

  it("writes a part back as the line it'd be without submodels", () => {
    const hub = parseLdr(MPD)[4];
    expect(parseLdr(partLine(hub))[0]).toMatchObject({ name: '3482.dat', color: 1 });
    expect(at(parseLdr(partLine(hub))[0]).z).toBeCloseTo(-120, 6);
  });
});
