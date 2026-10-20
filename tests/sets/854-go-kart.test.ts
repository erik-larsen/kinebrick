import { describe, expect, it } from 'vitest';
import { load } from './load.ts';

describe('854 Go-Kart', () => {
  const { mech, kin, bodyOf, turn, motor, angleOf, frameMoved, turntables } = load('models/854-Go Kart.mpd');
  const knuckles = turntables();

  it('is fully attached: its hoses are decoration, its seat sits on a hinge, its steering column bends through a universal joint', () => {
    expect(mech.loose).toEqual([]);
    expect(mech.couplings).toHaveLength(1);
    expect(knuckles).toHaveLength(2);
  });

  it('turning the steering wheel turns both front wheels the same way, on their turntables, and the kart stays where it is', () => {
    kin.reset();
    expect(Math.abs(turn(bodyOf('3736.dat'), 1))).toBeCloseTo(1, 6);
    const [a, b] = knuckles.map(angleOf);
    expect(Math.abs(a)).toBeGreaterThan(0.1);
    expect(b).toBeCloseTo(a, 3);
    expect(frameMoved()).toBeLessThan(1e-6);
  });

  it('a turn of a rear wheel rolls the kart one tyre round, and runs the engine: its piston slides up and down its 28 LDU stroke', () => {
    kin.reset();
    const piston = mech.joints.findIndex((j) => j.kind === 'slide');
    const wheel = bodyOf('3634.dat', 2);
    const joint = kin.parentLink(wheel)!.joint;
    kin.holdWhatTheDragDoesntNeed(wheel, () => kin.jointMotion(joint) !== null);
    const offsets: number[] = [];
    let turned = 0;
    for (let i = 0; i < 60; i++) {
      turned += kin.turnJoint(joint, (2 * Math.PI) / 60);
      offsets.push(kin.slideOffset(piston));
    }
    kin.letGoAfterDrag();
    expect(Math.abs(turned)).toBeCloseTo(2 * Math.PI, 6);
    expect(frameMoved()).toBeCloseTo(2 * Math.PI * 54.2, 0); // the big tyre's radius
    expect(Math.max(...offsets) - Math.min(...offsets)).toBeCloseTo(28, 0); // twice the crank's throw
  });

  it('at full lock either way, about 33 degrees where a knuckle meets its chassis, a turn of a rear wheel still takes it round, its tyres scrubbing sideways by up to the 16% its file allows, which 15% wouldn\'t', () => {
    expect(kin.scrub).toBe(0.16);
    for (const way of [1, -1]) {
      kin.reset();
      turn(bodyOf('3736.dat'), way * 2.16); // the steering wheel 124 degrees, as far as the viewer lets it go
      for (const tt of turntables()) expect(Math.abs(angleOf(tt)) * (180 / Math.PI)).toBeCloseTo(32.7, 0);
      const start = kin.snapshot();
      kin.scrub = 0.15;
      expect(motor(bodyOf('3634.dat', 2), 24)).toBeLessThan(0.1);
      kin.restore(start);
      kin.scrub = 0.16;
      expect(motor(bodyOf('3634.dat', 2), 24)).toBeCloseTo(2 * Math.PI, 6); // a turn of the wheel
    }
  });

  it('allowed only 8%, steered 22 degrees its tyres would have to scrub more to roll, and it says by how much; within that, each tyre reports how much it scrubs', () => {
    kin.scrub = 0.08;
    kin.reset();
    turn(bodyOf('3736.dat'), 1); // about 15 degrees: it rolls
    expect(motor(bodyOf('3634.dat', 2), 4)).toBeGreaterThan(1);
    expect(kin.scrubNeeded).toBeNull();
    const rates = kin.treadScrubRate.filter((r) => r > 0);
    expect(rates.length).toBeGreaterThan(0);
    for (const r of rates) expect(r).toBeLessThan(0.2);
    kin.reset();
    turn(bodyOf('3736.dat'), 1.5); // about 22 degrees: too far to roll at 8%
    expect(motor(bodyOf('3634.dat', 2), 4)).toBeLessThan(1e-9);
    expect(kin.scrubNeeded).toBeGreaterThan(0.08);
    expect(kin.scrubNeeded).toBeLessThan(0.15); // at 15% it rolls
    kin.scrub = 0.16;
  });
});
