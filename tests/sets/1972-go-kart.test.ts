import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { load } from './load.ts';

describe('1972 Go-Kart', () => {
  const { parts, mech, kin, bodyOf, turn, angleOf, frameMoved } = load('models/1972-Go-Kart.mpd');
  // Its steering arms (those that turn: some sets' files place more), and its rack.
  const arms = parts.flatMap((p, i) => (p.name === '4261.dat' && kin.parentLink(mech.bodyOf[i]) ? [mech.bodyOf[i]] : []));
  const rack = mech.gears.find((g) => g.face)!;

  it("turning the steering wheel steers both front wheels the same way: on its slanted column, its 16 tooth gear meets the rack at 26 degrees and slides it 20 LDU per radian, and the kart stays where it is", () => {
    kin.reset();
    const start = new Vector3().applyMatrix4(kin.poses[rack.body]);
    expect(Math.abs(turn(bodyOf('4185a.dat'), 1))).toBeCloseTo(1, 6);
    expect(arms).toHaveLength(2);
    const [a, b] = arms.map(angleOf);
    expect(a).toBeCloseTo(-0.522, 2);
    expect(b).toBeCloseTo(a, 2);
    expect(Math.abs(new Vector3().applyMatrix4(kin.poses[rack.body]).sub(start).dot(rack.axis))).toBeCloseTo(20, -0.3);
    expect(frameMoved()).toBeLessThan(1e-6);
  });
});
