import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { load } from './load.ts';

describe('8859 Tractor', () => {
  const { parts, mech, kin, bodyOf, turn, angleOf, frameMoved } = load('models/8859-Tractor.mpd');
  // Its steering arms (those that turn: some sets' files place more), and its rack.
  const arms = parts.flatMap((p, i) => (p.name === '4261.dat' && kin.parentLink(mech.bodyOf[i]) ? [mech.bodyOf[i]] : []));
  const rack = mech.gears.find((g) => g.face)!;

  it("turning the 24 tooth gear at the bottom of its steering column steers both front wheels the same way, sliding the rack, 4 LDU further from it than the gear's pitch radius, 30 LDU per radian, and the tractor stays where it is", () => {
    kin.reset();
    const start = new Vector3().applyMatrix4(kin.poses[rack.body]);
    expect(Math.abs(turn(bodyOf('3648a.dat'), 0.5))).toBeCloseTo(0.5, 6);
    expect(arms).toHaveLength(2);
    const [a, b] = arms.map(angleOf);
    expect(a).toBeCloseTo(-0.386, 2);
    expect(b).toBeCloseTo(a, 2);
    expect(Math.abs(new Vector3().applyMatrix4(kin.poses[rack.body]).sub(start).dot(rack.axis))).toBeCloseTo(15, -0.3);
    expect(frameMoved()).toBeLessThan(1e-6);
  });
});
