import { describe, expect, it } from 'vitest';
import { load } from './load.ts';

// The four engines of LEGO set 858, Auto Engines (1980), each a model of its own. Each has a
// crankshaft built of 24 tooth gears joined by axles off their middles, 16 LDU, so each piston's
// stroke is 32 LDU, and rubber bands from belt wheels (30.5 LDU round) to bushes (10.5 LDU).
const BAND = 30.5 / 10.5;

// Turns the part at `handle` once round as a drag does, in small steps; how far each piston's
// slide ranged and where it ended, and how many times each of the `others` turned.
function crank(engine: ReturnType<typeof load>, handle: number, others: number[] = []) {
  const { mech, kin, angleOf } = engine;
  const body = mech.bodyOf[handle];
  const joint = kin.parentLink(body)!.joint;
  const pistons = new Set(mech.bodies.flatMap((b, i) => (b.name.startsWith('piston') ? [i] : [])));
  const slides = mech.joints.flatMap((j, i) => (j.kind === 'slide' && (pistons.has(j.bodyA) || pistons.has(j.bodyB)) ? [i] : []));
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

  it("turns its camshaft as fast as the crankshaft, the other way, through four pairs of 24 tooth gears (the model had it 2 LDU off the hole it runs in, so they missed; models/ corrects that)", () => {
    expect(mech.meshes).toHaveLength(4);
    const { turns } = crank(engine, 43, [32, 11]);
    expect(turns[0]).toBeCloseTo(1, 6);
    expect(turns[1]).toBeCloseTo(1, 6);
  });

  it("lifts its three push rods on the camshaft's pins, each up to 14 LDU and back down onto the plate it stands through, and their rockers tip as they go: the rods resting on what's under them, the rockers on the rods, or on the studs below", () => {
    const { kin, angleOf } = engine;
    const rods = [157, 160, 163].map((p) => mech.bodyOf[p]);
    const rockers = [179, 181, 183].map((p) => mech.bodyOf[p]);
    expect(mech.rests.map((r) => r.body).sort((a, b) => a - b)).toEqual([...rods, ...rockers].sort((a, b) => a - b));
    const height = (body: number) => -kin.poses[body].elements[13]; // how far it has risen
    const body = mech.bodyOf[43];
    const joint = kin.parentLink(body)!.joint;
    kin.reset();
    kin.holdWhatTheDragDoesntNeed(body, () => kin.jointMotion(joint) !== null, joint);
    const lifts = rods.map(() => [] as number[]);
    const tips = rockers.map(() => [] as number[]);
    let turned = 0;
    for (let i = 0; i < 73; i++) {
      turned += kin.turnJoint(joint, (2 * Math.PI) / 72, () => kin.atLimit() === null);
      rods.forEach((b, k) => lifts[k].push(height(b)));
      rockers.forEach((b, k) => tips[k].push((angleOf(b) * 180) / Math.PI));
    }
    kin.letGoAfterDrag();
    expect(turned).toBeCloseTo((73 / 72) * 2 * Math.PI, 6);
    // The middle rod is built lifted 11 LDU, on a pin (0.75 LDU above it, which it drops onto).
    const range = (xs: number[]) => Math.max(...xs) - Math.min(...xs);
    for (const xs of lifts) expect(range(xs)).toBeCloseTo(14.3, 0);
    expect(Math.min(...lifts[0])).toBeCloseTo(0, 3);
    expect(Math.min(...lifts[1])).toBeCloseTo(-11, 3);
    // The outer rods' pins come round under them twice a turn, half a turn apart.
    const rises = lifts[0].slice(0, 72).filter((h, i) => h > 5 && lifts[0][(i + 71) % 72] <= 5).length;
    expect(rises).toBe(2);
    for (const xs of tips) expect(range(xs)).toBeGreaterThan(15);
    // A turn later, all back where they were.
    for (const xs of [...lifts, ...tips]) expect(xs[72]).toBeCloseTo(xs[0], 3);
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

  it("stands each bank a stud out on the 1 x 4 Technic bricks it hangs from (its file had them flush, so the banks leaned 102 degrees apart and the pistons ran into the taps; models/ corrects that): the banks lean about 86 degrees apart, and each tap stands as far from the crankshaft along its cylinder as on the boxer engine", () => {
    const boxer = load('models/858-Auto Engines-Boxer Engine.mpd');
    // How far a tap stands from the crankshaft (the x axis in the V-6, at y -38 in the boxer),
    // along its cylinder (the tap's own z axis), and that axis.
    const out = (part: { matrix: { elements: number[] } }, crankY: number) => {
      const e = part.matrix.elements;
      return { distance: Math.abs((e[13] - crankY) * e[9] + e[14] * e[10]), axis: [e[9], e[10]] };
    };
    const taps = parts.filter((p) => p.name === '3496c01.dat').map((p) => out(p, 0));
    const boxerTaps = boxer.parts.filter((p) => p.name === '3496c01.dat').map((p) => out(p, -38));
    expect(taps).toHaveLength(6);
    for (const t of [...taps, ...boxerTaps]) expect(t.distance).toBeCloseTo(boxerTaps[0].distance, -0.5);
    const [a, b] = [taps[0].axis, taps[5].axis];
    expect((Math.acos(a[0] * b[0] + a[1] * b[1]) * 180) / Math.PI).toBeCloseTo(86.5, 0);
  });

  it('turns its crank like a knob, as a drag would: the frame is the bigger bank, but the block the crankshaft turns in is held to it', () => {
    const crankshaft = mech.bodyOf[133];
    expect(kin.parentLink(crankshaft)!.parent).toBe(mech.bodyOf[0]);
    expect(kin.turnsLikeAKnob(crankshaft)).toBe(true);
    expect(kin.turnsLikeAKnob(mech.bodyOf[13])).toBe(false); // a connecting rod
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
