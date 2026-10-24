import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { load } from './load.ts';

describe('8849 Tractor', () => {
  const { parts, mech, kin, bodyOf, turn, angleOf, frameMoved } = load('models/8849-Tractor.mpd');
  // Its steering arms (those that turn: some sets' files place more), and its rack.
  const arms = parts.flatMap((p, i) => (p.name === '4261.dat' && kin.parentLink(mech.bodyOf[i]) ? [mech.bodyOf[i]] : []));
  const rack = mech.gears.find((g) => g.face)!;
  const axle = mech.bodyOf[97]; // the front axle's 1 x 8 plate, rocking on the steering shaft
  expect(parts[97].name).toBe('4442.dat');

  it("turning the steering wheel steers both front wheels the same way, its two 8 tooth gears sliding the rack on the tie rod 10 LDU per radian; the front axle, which rocks on the steering shaft, stays level, and the tractor stays where it is", () => {
    kin.reset();
    const start = new Vector3().applyMatrix4(kin.poses[rack.body]);
    const axleEnd = () => new Vector3(100, 0, -167).applyMatrix4(kin.poses[axle]);
    const axleStart = axleEnd();
    expect(Math.abs(turn(bodyOf('3736.dat'), 1))).toBeCloseTo(1, 6);
    expect(arms).toHaveLength(2);
    const [a, b] = arms.map(angleOf);
    expect(a).toBeCloseTo(-0.2525, 2);
    expect(b).toBeCloseTo(a, 2);
    expect(Math.abs(new Vector3().applyMatrix4(kin.poses[rack.body]).sub(start).dot(rack.axis))).toBeCloseTo(10, -0.3);
    expect(axleEnd().distanceTo(axleStart)).toBeLessThan(1e-6);
    expect(frameMoved()).toBeLessThan(1e-6);
  });
});
