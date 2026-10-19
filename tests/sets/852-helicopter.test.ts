import { describe, expect, it } from 'vitest';
import { load } from './load.ts';

describe('852 Helicopter', () => {
  const { mech, kin, bodyOf, turn } = load('models/852-Helicopter.mpd');
  const shaft = bodyOf('3708.dat', 2); // the main rotor's
  const blades = [bodyOf('3665a.dat', 0), bodyOf('3665a.dat', 1)];
  const lever = bodyOf('3701.dat', 4); // a pilot's
  // How far a joint between two bodies has turned.
  const between = (a: number, b: number) => kin.jointAngles[mech.joints.findIndex((j) => (j.bodyA === a && j.bodyB === b) || (j.bodyA === b && j.bodyB === a))];
  const swashplate = mech.joints.flatMap((j, i) => (j.turns ? [i] : []));

  it('is fully attached: its rotors are Technic plates gripped by bushes on their shafts, and the two halves of its swashplate turn and slide on the rotor shaft', () => {
    expect(mech.loose).toEqual([]);
    expect(swashplate.map((i) => mech.joints[i].range)).toEqual([
      [-16, 36],
      [-16, 36],
    ]);
  });

  it('a turn of the crank turns the tail rotor once and the main rotor a third of a turn, through a crown gear, with the swashplate\'s top half; the blades keep their pitch', () => {
    kin.reset();
    expect(turn(bodyOf('3736.dat'), 1)).toBeCloseTo(1, 6); // the crank
    expect(Math.abs(kin.jointAngles[kin.parentLink(shaft)!.joint])).toBeCloseTo(1 / 3, 6);
    expect(Math.abs(kin.jointAngles[kin.parentLink(bodyOf('3709b.dat', 1))!.joint])).toBeCloseTo(1, 6);
    expect(Math.abs(between(bodyOf('3709b.dat', 0), bodyOf('3709b.dat', 3)))).toBeCloseTo(1 / 3, 6);
    for (const blade of blades) expect(between(shaft, blade)).toBeCloseTo(0, 6);
  });

  it('a pilot\'s lever slides the swashplate along the rotor shaft, both halves together, and through the pitch links pitches both blades alike, until the swashplate meets the bush above it or the frame below', () => {
    kin.reset();
    expect(turn(lever, 0.3)).toBeCloseTo(0.3, 6);
    const [lower, upper] = swashplate.map((i) => kin.slideOffset(i));
    expect(lower).toBeGreaterThan(5);
    expect(upper).toBeCloseTo(lower, 6);
    const [a, b] = blades.map((blade) => between(shaft, blade));
    expect(Math.abs(a)).toBeGreaterThan(0.2);
    expect(Math.abs(b)).toBeCloseTo(Math.abs(a), 3);
    for (const way of [1, -1]) {
      kin.reset();
      turn(lever, way * 2);
      // Within a step (2 degrees of the lever) of the end.
      const [lo, hi] = mech.joints[swashplate[0]].range!;
      expect(Math.abs(kin.slideOffset(swashplate[0]) - (way > 0 ? hi : lo))).toBeLessThan(1);
    }
  });
});
