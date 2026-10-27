import { describe, expect, it } from 'vitest';
import { load } from './load.ts';

// The four engines of LEGO set 858, Auto Engines (1980), each a model of its own. Each has a
// crankshaft built of 24 tooth gears joined by axles off their middles, 16 LDU, so each piston's
// stroke is 32 LDU, and rubber bands from belt wheels (30.5 LDU round) to bushes (10.5 LDU).
const BAND = 30.5 / 10.5;

// Turns the part at `handle` once round as a drag does, in small steps; how far each slide (each
// piston) ranged and where it ended, and how many times each of the `others` turned.
function crank(engine: ReturnType<typeof load>, handle: number, others: number[] = []) {
  const { mech, kin, angleOf } = engine;
  const body = mech.bodyOf[handle];
  const joint = kin.parentLink(body)!.joint;
  const slides = mech.joints.flatMap((j, i) => (j.kind === 'slide' ? [i] : []));
  const low = slides.map(() => Infinity);
  const high = slides.map(() => -Infinity);
  const spun = others.map(() => 0);
  kin.reset();
  kin.holdWhatTheDragDoesntNeed(body, () => kin.jointMotion(joint) !== null, joint);
  let was = others.map((p) => angleOf(mech.bodyOf[p]));
  let turned = 0;
  for (let i = 0; i < 72; i++) {
    turned += kin.turnJoint(joint, (2 * Math.PI) / 72, () => kin.atLimit() === null);
    slides.forEach((s, k) => {
      low[k] = Math.min(low[k], kin.slideOffset(s));
      high[k] = Math.max(high[k], kin.slideOffset(s));
    });
    const now = others.map((p) => angleOf(mech.bodyOf[p]));
    now.forEach((a, k) => (spun[k] += a - was[k]));
    was = now;
  }
  kin.letGoAfterDrag();
  return {
    turned,
    strokes: slides.map((s, k) => high[k] - low[k]),
    ends: slides.map((s) => kin.slideOffset(s)),
    turns: spun.map((a) => Math.abs(a / turned)),
  };
}

describe('858 Auto Engines: the 2-cycle engine', () => {
  const engine = load('models/858-Auto Engines-2-Cycle Engine.mpd');
  const { parts, mech } = engine;

  it('is fully attached: a crankshaft, a connecting rod, a piston, and a hand wheel on a rubber band', () => {
    expect(mech.loose).toEqual([]);
    expect(mech.loops).toHaveLength(2);
    expect([parts[20].name, parts[21].name, parts[15].name]).toEqual(['3648a.dat', '3673.dat', '3652.dat']);
  });

  it('a turn of the hand wheel turns the crankshaft about 2.9 times through the rubber band, and the piston runs its 32 LDU stroke', () => {
    const { turned, strokes, turns } = crank(engine, 20, [7]);
    expect(turned).toBeCloseTo(2 * Math.PI, 6);
    expect(strokes).toHaveLength(1);
    expect(strokes[0]).toBeCloseTo(32, 0);
    expect(turns[0]).toBeCloseTo(BAND, 2);
  });
});

describe('858 Auto Engines: the boxer engine', () => {
  const engine = load('models/858-Auto Engines-Boxer Engine.mpd');
  const { parts, mech } = engine;

  it('is attached but for its round cap, a 2 x 2 round brick on an axle, whose bush stands between four studs', () => {
    expect(mech.loose.map((i) => parts[i].name)).toEqual(['3713.dat', '3705.dat', '3941.dat', '3713.dat']);
  });

  it('a turn of the crank takes all six pistons through their 32 LDU strokes and back, and the rubber bands turn the fan and the top axle about 2.9 times', () => {
    const { turned, strokes, ends, turns } = crank(engine, 91, [138, 157]);
    expect(turned).toBeCloseTo(2 * Math.PI, 6);
    expect(strokes).toHaveLength(6);
    for (const s of strokes) expect(s).toBeCloseTo(32, 0);
    for (const e of ends) expect(e).toBeCloseTo(0, 3);
    for (const t of turns) expect(t).toBeCloseTo(BAND, 2);
  });
});

describe('858 Auto Engines: the inline engine', () => {
  const engine = load('models/858-Auto Engines-Inline Engine.mpd');
  const { parts, mech } = engine;

  it('is attached but for its round cap, and its fan, whose round plate meets the end of its axle pin rather than going on it', () => {
    expect(mech.loose.map((i) => parts[i].name)).toEqual(['3713.dat', '3705.dat', '3941.dat', '3713.dat', '4032a.dat', '3623.dat', '3623.dat', '3623.dat', '3623.dat', '4032a.dat']);
  });

  it('a turn of the crank takes its three pistons through their 32 LDU strokes and back, and the rubber bands turn the fan and the distributor about 2.9 times', () => {
    const { turned, strokes, ends, turns } = crank(engine, 43, [110, 52]);
    expect(turned).toBeCloseTo(2 * Math.PI, 6);
    expect(strokes).toHaveLength(3);
    for (const s of strokes) expect(s).toBeCloseTo(32, 0);
    for (const e of ends) expect(e).toBeCloseTo(0, 3);
    for (const t of turns) expect(t).toBeCloseTo(BAND, 2);
  });

  it("doesn't turn its camshaft yet: the model has it 62 LDU from the crankshaft, 2 LDU from the hole it runs in, so their 24 tooth gears just miss", () => {
    expect(mech.meshes).toHaveLength(0);
    const { turns } = crank(engine, 43, [32]);
    expect(turns[0]).toBeCloseTo(0, 6);
  });
});

describe('858 Auto Engines: the V-6 engine', () => {
  const engine = load('models/858-Auto Engines-V-6 Engine.mpd');
  const { parts, mech, kin } = engine;

  it('is attached but for its round cap and its fan, as on the inline engine', () => {
    expect(mech.loose.map((i) => parts[i].name)).toEqual(['4032a.dat', '3623.dat', '3623.dat', '3623.dat', '3623.dat', '4032a.dat', '3713.dat', '3705.dat', '3941.dat', '3713.dat']);
  });

  it('holds its two cylinder banks in a V: each hangs on an axle along the block, and an axle runs through both their tops, so neither can swing', () => {
    kin.reset();
    const block = mech.bodyOf[0];
    expect(block).not.toBe(0);
    expect(engine.turn(block, 0.5)).toBeCloseTo(0, 6);
  });

  it('a turn of the crank takes all six pistons through their 32 LDU strokes and back, with the block and banks still, and the rubber bands turn the fan and the side axle about 2.9 times', () => {
    const { turned, strokes, ends, turns } = crank(engine, 133, [158, 114]);
    expect(turned).toBeCloseTo(2 * Math.PI, 6);
    expect(strokes).toHaveLength(6);
    for (const s of strokes) expect(s).toBeCloseTo(32, 0);
    for (const e of ends) expect(e).toBeCloseTo(0, 3);
    for (const t of turns) expect(t).toBeCloseTo(BAND, 2);
    for (const p of [0, 38]) expect(engine.angleOf(mech.bodyOf[p])).toBeCloseTo(0, 6);
  });
});
