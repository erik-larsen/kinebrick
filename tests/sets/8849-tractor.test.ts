import { Matrix4, Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { load } from './load.ts';

describe('8849 Tractor', () => {
  const { parts, mech, kin, bodyOf, turn, motor, angleOf, frameMoved } = load('models/8849-Tractor.mpd');
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
  it("turning the handwheel on the cab's side raises both lower links of the three-point hitch together, the toothed half bushes beside their toggle joints turning them with the rear cross axle, a 72nd as far as the handwheel, and the sprayer hung on them rises level; the worm holds them, so dragging a link doesn't move it", () => {
    expect([81, 89, 92, 95, 96, 200, 269].map((i) => parts[i].name)).toEqual(['3737.dat', '4273b.dat', '4273b.dat', '4265a.dat', '4265a.dat', '4185.dat', '3894.dat']);
    const crossAxle = mech.bodyOf[81];
    expect(mech.bodyOf[89]).toBe(crossAxle);
    expect(mech.bodyOf[92]).toBe(crossAxle);
    kin.reset();
    // Where each link's end is: the axle in its toggle joint's axle hole.
    const ends = () => [90, 93].map((i) => new Vector3().setFromMatrixPosition(parts[i].matrix).applyMatrix4(kin.poses[mech.bodyOf[i]]));
    const start = ends();
    const sprayer = mech.bodyOf[269]; // a 1 x 6 Technic brick across its back
    const sprayerAt = () => new Vector3().setFromMatrixPosition(parts[269].matrix).applyMatrix4(kin.poses[sprayer]);
    const sprayerStart = sprayerAt();
    expect(motor(mech.bodyOf[200], 4 * 24)).toBeCloseTo(8 * Math.PI, 6); // four turns of the handwheel
    expect(Math.abs(angleOf(crossAxle))).toBeCloseTo((8 * Math.PI) / 72, 3);
    const [left, right] = ends().map((end, k) => end.sub(start[k]));
    expect(-left.y).toBeCloseTo(5.94, 1); // up: LDraw's y points down
    expect(right.distanceTo(left)).toBeLessThan(1e-6);
    expect(sprayerStart.y - sprayerAt().y).toBeCloseTo(11.88, 1);
    // How far the sprayer has tilted against the frame: not at all, as its top link runs parallel to the lower links.
    const tilt = new Quaternion().setFromRotationMatrix(new Matrix4().copy(kin.poses[0]).invert().multiply(kin.poses[sprayer]));
    expect(tilt.angleTo(new Quaternion())).toBeLessThan(1e-6);
    expect(frameMoved()).toBeLessThan(1e-6);
    kin.reset();
    expect(turn(mech.bodyOf[89], 0.3)).toBeCloseTo(0, 9);
  });
});
