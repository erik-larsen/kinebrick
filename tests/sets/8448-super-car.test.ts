import { describe, expect, it } from 'vitest';
import { load } from './load.ts';

describe('8448 Super Street Sensation', () => {
  const { parts, mech, kin, turn, angleOf } = load('models/8448-Super Car.mpd');

  it("its rear cross shaft turns the propeller shaft as far, through a pair of the old 20 tooth bevel gears (32198)", () => {
    const [cross, prop] = [31, 100].map((i) => mech.bodyOf[i]);
    expect([parts[31].name, parts[100].name, parts[25].name]).toEqual(['3706.dat', '3737.dat', '32198.dat']);
    kin.reset();
    expect(Math.abs(turn(cross, 1))).toBeCloseTo(1, 6);
    expect(Math.abs(angleOf(prop))).toBeCloseTo(1, 6);
  });
});
