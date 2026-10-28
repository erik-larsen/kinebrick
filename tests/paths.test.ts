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

// A string tied to a Technic brick at both ends, looped round a circle where nothing turns (as
// 42064 Ocean Explorer's ropes go round a pin): no drum to wind it, no pulley to run over.
const TIED = `0 FILE Tied.ldr
1 16 0 0 0 1 0 0 0 1 0 0 0 1 3701.dat
1 16 0 0 0 1 0 0 0 1 0 0 0 1 Rope.ldr
0 NOFILE
0 FILE Rope.ldr
0 !LDCAD CONTENT [type=path] [looped=false] [displayKind=mm]
0 !LDCAD PATH_POINT [type=bezier] [posOri=-20 -24 0 1 0 0 0 1 0 0 0 1] [cirR=4] [cirDir=xyCW]
0 !LDCAD PATH_POINT [type=circle] [posOri=0 -60 0 1 0 0 0 1 0 0 0 1] [cirR=8] [cirDir=xyCW]
0 !LDCAD PATH_POINT [type=bezier] [posOri=20 -24 0 1 0 0 0 1 0 0 0 1] [cirR=4] [cirDir=xyCW]
0 !LDCAD PATH_SKIN [donPart=ldcLQRopeSeg.dat]
2 16 -20 -24 0 20 -24 0
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

  it('knows the links LDCad put in a subpart of the path are its links too (the 42131 Cat D11 Bulldozer\'s tracks)', () => {
    const sub = MPD.replace(
      '1 16 20 -50 0 1 0 0 0 1 0 0 0 1 3711.dat\n1 16 -20 -50 0 1 0 0 0 1 0 0 0 1 3711.dat\n0 NOFILE\n',
      '1 16 0 0 0 1 0 0 0 1 0 0 0 1 Chain_subPart1.ldr\n0 NOFILE\n0 FILE Chain_subPart1.ldr\n1 16 20 -50 0 1 0 0 0 1 0 0 0 1 3711.dat\n1 16 -20 -50 0 1 0 0 0 1 0 0 0 1 3711.dat\n0 NOFILE\n',
    );
    const { parts, paths } = parseModel(sub);
    expect(paths).toHaveLength(1);
    expect(parts.map((p) => p.path)).toEqual([paths[0], paths[0]]);
  });

  it("knows a path's caps are parts in their own right, not its links (a cable's plug, or the receiver it comes out of)", () => {
    const cable = `0 FILE Cabled.ldr
1 16 0 0 0 1 0 0 0 1 0 0 0 1 Cable.ldr
0 NOFILE
0 FILE Cable.ldr
0 !LDCAD CONTENT [type=path] [looped=false] [displayKind=mm]
0 !LDCAD PATH_POINT [type=bezier] [posOri=0 10 40 1 0 0 0 0 1 0 -1 0] [cirR=20] [cirDir=xyCW]
0 !LDCAD PATH_POINT [type=bezier] [posOri=-30 40 40 1 0 0 0 0 1 0 -1 0] [cirR=20] [cirDir=xyCW]
0 !LDCAD PATH_SKIN [donPart=u9190.dat]
0 !LDCAD PATH_CAP [group=start] [posOri=0 0 0 1 0 0 0 1 0 0 0 1] [part=58123.dat]
1 71 0 0 0 1 0 0 0 1 0 0 0 1 58123.dat
1 0 0 10 40 1 0 0 0 1 0 0 0 1 u9190.dat
0 NOFILE
`;
    const parts = parseLdr(cable);
    expect(parts.map((p) => [p.name, !!p.path])).toEqual([
      ['58123.dat', false],
      ['u9190.dat', true],
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

  it('leaves out a string that goes round no wheel, which moves nothing', () => {
    const { parts, paths } = parseModel(TIED);
    expect(paths).toHaveLength(1);
    const mech = inferMechanism(parts, table, roles, paths);
    expect(mech.strings).toHaveLength(0);
    expect(() => new Kinematics(mech)).not.toThrow();
  });
});

// A winch as the OMR's files draw one with LSynth: an axle through a Technic brick, and a rope of
// LSynth string segments (LS60), 1.5 LDU apart, wound twice round the axle 6 LDU from its middle,
// then down 60 LDU to a hook (a bush, attached to nothing) tied to its end; and beside it a hose of
// LSynth's flex-system hose segments (LS51).
const segment = (x: number, y: number, z: number, part: string) => `1 0 ${x.toFixed(3)} ${y.toFixed(3)} ${z} 1 0 0 0 1 0 0 0 1 ${part}`;
const rope: string[] = [];
for (let a = 5 * Math.PI; a > Math.PI; a -= 1.5 / 6) rope.push(segment(-20 + 6 * Math.cos(a), 10 + 6 * Math.sin(a), 30, '9391 - LS60.dat'));
for (let y = 10; y <= 70; y += 1.5) rope.push(segment(-26, y, 30, '9391 - LS60.dat'));
const hose = Array.from({ length: 20 }, (_, i) => segment(40, -10 - 1.5 * i, 0, '9391 - LS51.dat'));
const WINCH = `1 16 0 0 0 1 0 0 0 1 0 0 0 1 3701.dat
1 16 -20 10 0 0 0 -1 0 1 0 1 0 0 3705.dat
${rope.join('\n')}
1 16 -26 74 30 1 0 0 0 1 0 0 0 1 3713.dat
${hose.join('\n')}
`;

describe('paths LSynth drew', () => {
  it('reads a run of segments as a path; a rope goes round the circles it turns round, a hose only shows where it runs', () => {
    const parts = parseLdr(WINCH);
    const rope = parts[2].path!;
    expect(parts.filter((p) => p.path === rope)).toHaveLength(parts.filter((p) => p.name.endsWith('ls60.dat')).length);
    expect(rope.looped).toBe(false);
    const [drum, ...rest] = rope.points;
    expect(drum.circle).toBe(true);
    expect(drum.center.x).toBeCloseTo(-20, 0);
    expect(drum.center.y).toBeCloseTo(10, 0);
    expect(drum.radius).toBeCloseTo(6, 0);
    expect(Math.abs(drum.axis.z)).toBeCloseTo(1, 3);
    expect(rest.map((p) => p.circle)).toEqual([false]); // then down to where it's tied
    const hose = parts.find((p) => p.name.endsWith('ls51.dat'))!.path!;
    expect(hose.points.some((p) => p.circle)).toBe(false);
    expect(parts.filter((p) => p.path === hose)).toHaveLength(20);
  });

  it('a winch wound with an LSynth rope raises the hook tied to its end as far as the drum turns it, straight up', () => {
    const { parts, paths } = parseModel(WINCH);
    const mech = inferMechanism(parts, table, roles, paths);
    expect(mech.loose).toEqual([]);
    expect(mech.strings).toHaveLength(1);
    const [s] = mech.strings;
    expect(s.drum).not.toBeNull();
    expect(s.hook?.body).toBe(s.end.body);
    expect(mech.bodyOf[parts.findIndex((p) => p.name === '3713.dat')]).toBe(s.end.body);
    const kin = new Kinematics(mech);
    const hook = () => s.end.at.clone().applyMatrix4(kin.poses[s.end.body]);
    const before = hook();
    kin.turnJoint(s.drum!.joint, 1);
    const moved = hook().sub(before);
    expect(Math.abs(moved.y)).toBeCloseTo(s.path.points[0].radius, 1);
    expect(Math.hypot(moved.x, moved.z)).toBeCloseTo(0, 3);
  });
});

// A chain placed link by link, as older models place one: 18 Technic chain links (3711) round two
// 16 tooth gears on axles 80 LDU apart through a Technic brick, each link's end on the pin of the
// one before, 8 links to a turn; `drop` links are left out, from the 8th (as a forklift's chain
// is left a link short, both its ends hooked to the carriage).
function handChain(drop = 0): string {
  const r = 8 / Math.sin(Math.PI / 8); // where the pins go round each gear
  const pins: [number, number][] = [];
  for (let k = 0; k < 5; k++) pins.push([-40 + 16 * k, 10 - r]); // along the top
  for (let j = 0; j < 4; j++) pins.push([40 + r * Math.sin((j * Math.PI) / 4), 10 - r * Math.cos((j * Math.PI) / 4)]); // round the right gear
  for (let k = 0; k < 5; k++) pins.push([40 - 16 * k, 10 + r]); // along the bottom
  for (let j = 0; j < 4; j++) pins.push([-40 - r * Math.sin((j * Math.PI) / 4), 10 + r * Math.cos((j * Math.PI) / 4)]); // round the left gear
  // Each link along z to the next pin, its pin across the chain, along the gears' axes (x).
  const links = pins.map(([x, y], i) => {
    const [nx, ny] = pins[(i + 1) % pins.length];
    const [dx, dy] = [(nx - x) / 16, (ny - y) / 16];
    return `1 0 ${x.toFixed(4)} ${y.toFixed(4)} 30 0 ${dy.toFixed(6)} ${dx.toFixed(6)} 0 ${(-dx).toFixed(6)} ${dy.toFixed(6)} 1 0 0 3711.dat`;
  });
  // Out of order in the file, as a model's may be.
  const order = links.map((_, i) => (i * 5) % links.length).filter((i) => i < 7 || i >= 7 + drop);
  return `1 16 0 0 0 1 0 0 0 1 0 0 0 1 3702.dat
1 16 -40 10 0 0 0 -1 0 1 0 1 0 0 3705.dat
1 16 40 10 0 0 0 -1 0 1 0 1 0 0 3705.dat
1 16 -40 10 30 1 0 0 0 1 0 0 0 1 4019.dat
1 16 40 10 30 1 0 0 0 1 0 0 0 1 4019.dat
${order.map((i) => links[i]).join('\n')}
`;
}

// A model in models/, read as the viewer reads it, with what the packer found.
const packed: Record<string, { primitives: string[]; pieces: Record<string, string[]> }> = JSON.parse(readFileSync('packed/models.json', 'utf-8'));
function model(name: string) {
  const { primitives, pieces } = packed[name] ?? { primitives: [], pieces: {} };
  const { parts, paths } = parseModel(readFileSync(`models/${name}.mpd`, 'utf-8'), (n) => primitives.includes(n), (n) => pieces[n] ?? null);
  return { parts, mech: inferMechanism(parts, table, roles, paths) };
}

describe('chains placed link by link', () => {
  it('reads the links as a looped chain, round a circle at each gear, as far round as the chain goes in a turn', () => {
    const { parts, paths } = parseModel(handChain());
    expect(paths).toHaveLength(1);
    const [chain] = paths;
    expect(chain.looped).toBe(true);
    expect(chain.byHand).toBe(true);
    expect(parts.filter((p) => p.path === chain)).toHaveLength(18);
    const circles = [...chain.points].sort((a, b) => a.center.x - b.center.x);
    expect(circles.map((c) => [c.circle, Math.round(c.center.x), Math.round(c.center.y), Math.round(c.center.z)])).toEqual([
      [true, -40, 10, 30],
      [true, 40, 10, 30],
    ]);
    // 8 links of 16 LDU to a turn.
    for (const c of circles) expect(c.radius).toBeCloseTo((8 * 16) / (2 * Math.PI), 3);
  });

  it('turns the gears together', () => {
    const { parts, paths } = parseModel(handChain());
    const mech = inferMechanism(parts, table, roles, paths);
    expect(mech.loops).toHaveLength(1);
    expect(mech.loops[0].wheels).toHaveLength(2);
    const kin = new Kinematics(mech);
    const [a, b] = mech.loops[0].wheels;
    kin.turnJoint(a.joint, 1);
    const turned = (w: typeof a) => (mech.joints[w.joint].bodyB === w.body ? 1 : -1) * kin.jointAngles[w.joint];
    expect(turned(b) / turned(a)).toBeCloseTo(1, 6);
  });

  it('closes a chain left a link short, as a forklift carriage hooked to both its ends closes it, but not one left open further', () => {
    expect(parseModel(handChain(1)).paths.map((p) => p.looped)).toEqual([true]);
    expect(parseModel(handChain(3)).paths).toEqual([]);
  });

  it("the 8835 Forklift's chain turns its top sprocket with the bottom one, which the crank drives", () => {
    const { parts, mech } = model('8835-Forklift');
    expect(mech.loops).toHaveLength(1);
    const [chain] = mech.loops;
    expect(chain.links.every((i) => parts[i].name === '3711.dat')).toBe(true);
    expect(chain.links).toHaveLength(43);
    // The sprockets: the 16 tooth gears on the mast's top axle (p71) and bottom axle (p75).
    expect(chain.wheels.map((w) => w.body).sort()).toEqual([mech.bodyOf[71], mech.bodyOf[75]].sort());
    const kin = new Kinematics(mech);
    const [a, b] = chain.wheels;
    kin.turnJoint(a.joint, 1);
    const turned = (w: typeof a) => (mech.joints[w.joint].bodyB === w.body ? 1 : -1) * kin.jointAngles[w.joint];
    expect(turned(b) / turned(a)).toBeCloseTo(1, 6);
  });

  it("the 8844 Helicopter's landing gear chain is found, on the front axle's sprocket; its other end goes round a gear the model places twice (see docs/ldraw-errata.md)", () => {
    const { mech } = model('8844-Helicopter');
    expect(mech.loops).toHaveLength(1);
    expect(mech.loops[0].links).toHaveLength(25);
    // The front axle (p8, with its 16 tooth gear p10).
    expect(mech.loops[0].wheels.map((w) => w.body)).toEqual([mech.bodyOf[8]]);
  });
});
