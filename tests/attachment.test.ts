import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ConnectionTable, libraryConnections } from '../src/connections.ts';
import { parseModel } from '../src/ldr.ts';
import { inferMechanism } from '../src/mechanism.ts';

const table: ConnectionTable = JSON.parse(readFileSync('data/connections.json', 'utf-8'));
const roles: Record<string, string> = JSON.parse(readFileSync('data/roles.json', 'utf-8'));

// Which files each model places are LDraw primitives (drawn shapes, not parts), and which parts
// are read as their pieces, as the packer found.
const packed: Record<string, { primitives: string[]; pieces: Record<string, string[]> }> = JSON.parse(readFileSync('packed/models.json', 'utf-8'));

// The names of a model's loose parts, read as the viewer reads it (`name` is its file's, without
// .ldr or .mpd, if it's in models/).
function looseParts(text: string, name = ''): string[] {
  const model = packed[name];
  const { parts, paths } = parseModel(text, (n) => model?.primitives.includes(n) ?? false, (n) => model?.pieces[n] ?? null);
  return inferMechanism(parts, table, roles, paths).loose.map((i) => parts[i].name);
}

// Real models Kinebrick can't fully read yet, and what they need (M7 works through them).
const NOT_YET = [
  '8448-Super Car.mpd', // hinges, universal joints, its tyres
  // Their round caps (a 2 x 2 round brick on an axle, on a bush between four studs) and the
  // inline and V-6's fans (a round plate against the end of an axle pin)
  '858-Auto Engines-Boxer Engine.mpd',
  '858-Auto Engines-Inline Engine.mpd',
  '858-Auto Engines-V-6 Engine.mpd',
  // The 1980s sets, brought in to be tried by hand, not yet worked through
  '1972-Go-Kart.mpd',
  '8024-Universal Set.mpd',
  '8832-Roadster.mpd',
  '8835-Forklift.mpd',
  '8841-Dune Buggy.mpd',
  '8844-Helicopter.mpd',
  '8848-Power Truck.mpd',
  '8851-Excavator.mpd',
  '8854-Power Crane.mpd',
  '8855-Prop Plane.mpd',
  '8859-Tractor.mpd',
];

describe('every test model is fully attached', () => {
  for (const file of readdirSync('models').filter((f) => /\.(ldr|mpd)$/.test(f) && !NOT_YET.includes(f))) {
    it(file, () => {
      expect(looseParts(readFileSync(`models/${file}`, 'utf-8'), file.replace(/\.(ldr|mpd)$/, ''))).toEqual([]);
    });
  }
});

describe('a part that is in the wrong place', () => {
  const car = readFileSync('models/simple-car.ldr', 'utf-8');

  it('is caught when a brick sits between the studs instead of on them', () => {
    // Move the front 1x4 brick half a stud along the car: its anti-studs no longer meet the
    // plate's studs, and nothing else holds it.
    const shifted = car.replace('1 14 70 -24 0 0 0 1 0 1 0 -1 0 0 3701.dat', '1 14 70 -24 10 0 0 1 0 1 0 -1 0 0 3701.dat');
    expect(shifted).not.toEqual(car);
    expect(looseParts(shifted)).toEqual(['3701.dat']);
  });

  it('is caught when a brick floats above the plate', () => {
    const lifted = car.replace('1 14 70 -24 0 0 0 1 0 1 0 -1 0 0 3701.dat', '1 14 70 -40 0 0 0 1 0 1 0 -1 0 0 3701.dat');
    expect(looseParts(lifted)).toEqual(['3701.dat']);
  });
});

// Pairs of parts as real sets join them (from the OMR's: 42092, 42061, 42116, 42023, 42062,
// 8845, 42099, 42110, 42083), read with the whole library's table, as a model opened from your own computer is.
describe('parts joined in ways only real sets showed', () => {
  const library = libraryConnections(JSON.parse(readFileSync('data/library-connections.json', 'utf-8')));
  const loose = (text: string) => {
    const { parts } = parseModel(text);
    return inferMechanism(parts, library, roles).loose.map((i) => parts[i].name);
  };
  const pairs: [string, string][] = [
    ['a long pin with stop bush, through a beam', '1 71 -40 -89 -20 0 0 1 0 1 0 -1 0 0 32054.dat\n1 71 0 -89 -20 0 0 -1 1 0 0 0 -1 0 32316.dat'],
    ["a friction pin, in a panel's pin hole closed at the far end", '1 0 -70 -141.8 -320 1 0 0 0 -1 0 0 0 -1 2780.dat\n1 0 -80 -142 -260 0 1 0 1 0 0 0 0 -1 11946.dat'],
    ['a half pin, under a 1 x 1 round tile', '1 71 40 -78 130 0 -1 0 0 0 -1 1 0 0 4274.dat\n1 36 40 -78 138 -1 0 0 0 0 -1 0 -1 0 98138.dat'],
    ["a half pin, in a plate's anti-stud", '1 71 -60 -20 -210 0 0 -1 0 -1 0 -1 0 0 4274.dat\n1 47 -50 -20 -218 1 0 0 0 0 -1 0 1 0 3023.dat'],
    ["a beam's angled bar, in a steering wheel the set brings with it", '1 0 -137.96 -140 -290.274 0.259 0.966 0 0 0 1 0.966 -0.259 0 85940.dat\n1 71 -133.912607 -155.343 -275.178318 -0.183113 -0.183113 0.966 -0.707 0.707 0 -0.682962 -0.682962 -0.259 42062 - 16091.dat'],
    ["an old steering arm's pivot, in a Technic plate's hole", '1 7 -40 0.152 -271.736 -1 0 0 0 0.985 0.174 0 0.174 -0.985 4261.dat\n1 0 -10 23.787 -267.569 -1 0 0 0 0.985 0.174 0 0.174 -0.985 4263.dat'],
    ["a turntable's top, on its bottom", '1 0 0 -242.42 17.48 1 0 0 0 0.021 1 0 -1 0.021 18938.dat\n1 71 0 -242.42 17.48 1 0 0 0 0.021 1 0 -1 0.021 18939.dat'],
    ['a rack with a beam under it, in its housing', '1 72 20 -210 -254 0 0 -1 0 1 0 1 0 0 18942.dat\n1 4 20 -190 -204 0 0 -1 0 1 0 1 0 0 18940.dat'],
    ["a portal axle's wheel hub, turning in a steering bearing with arms", '1 0 177.81 20.812 0 0 0 -1 0 1 0 1 0 0 23801.dat\n1 72 203.81 20.812 0 0 0 -1 0 1 0 1 0 0 92909.dat'],
    ["a rim with double spokes, on a portal axle's wheel hub's pins", '1 72 0 0 0 1 0 0 0 1 0 0 0 1 92909.dat\n1 0 0 0 0 1 0 0 0 1 0 0 0 1 49294.dat'],
    ['a wheel hub with a brake disc, its boss closed at the end, turning in a steering bearing', '1 0 0 0 0 1 0 0 0 -1 0 0 0 -1 23801.dat\n1 72 0 0 30 1 0 0 0 -1 0 0 0 -1 35189.dat'],
    ["an old wheel with pegholes, on its axle (8218)", '1 16 0 0 0 0 0 -1 -0.383 0.924 0 0.924 0.383 0 2994.dat\n1 16 0 0 0 1 0 0 0 0.924 -0.383 0 0.383 0.924 3705.dat'],
  ];
  for (const [what, text] of pairs) it(what, () => expect(loose(text)).toEqual([]));

  it("a modern tyre, on its rim, both seats measured from the parts' shapes, and the tyre has its tread (42115)", () => {
    const text = '1 82 -286.593 -54.118 -20 0 0 1 0 1 0 -1 0 0 68577.dat\n1 256 -261.407 -54.118 -20 0 0 -1 0 -1 0 -1 0 0 23799.dat';
    const { parts } = parseModel(text);
    const mech = inferMechanism(parts, library, roles);
    expect(mech.loose).toEqual([]);
    expect(mech.bodies).toHaveLength(1);
    expect(mech.treads).toHaveLength(1);
    expect(mech.treads[0].radius).toBeCloseTo(102, 0);
  });

  it('an old tyre, on the old wheel with pegholes, and the tyre has its tread (8218)', () => {
    const text = '1 16 0 0 0 0 0 -1 -0.383 0.924 0 0.924 0.383 0 2994.dat\n1 16 0 0 0 0 0 -1 -0.383 0.924 0 0.924 0.383 0 6578.dat';
    const { parts } = parseModel(text);
    const mech = inferMechanism(parts, library, roles);
    expect(mech.loose).toEqual([]);
    expect(mech.bodies).toHaveLength(1);
    expect(mech.treads).toHaveLength(1);
  });

  it("an excavator bucket's click hinge, on a connector's, turning stiffly (8418)", () => {
    const text = '1 16 0 0 0 0 -1 0 -0.99 0 0.139 -0.139 0 -0.99 47973.dat\n1 16 0 29.708 4.176 1 0 0 0 0.99 -0.139 0 0.139 0.99 30394.dat';
    const { parts } = parseModel(text);
    const mech = inferMechanism(parts, library, roles);
    expect(mech.loose).toEqual([]);
    expect(mech.joints).toHaveLength(1);
    expect(mech.joints[0].kind).toBe('revolute');
    expect(mech.joints[0].stiff).toBe(true);
  });
});
