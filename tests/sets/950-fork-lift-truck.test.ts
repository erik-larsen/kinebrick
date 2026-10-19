import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { load } from './load.ts';

describe('950 Fork-Lift Truck', () => {
  const { mech, kin, bodyOf, turn, angleOf, frameMoved, turntables } = load('models/950-Fork Lift.mpd');
  const carriage = bodyOf('3703.dat', 2);
  const shaft = bodyOf('3737.dat', 1);

  it('is fully attached: the forks ride up the mast on their racks, and the steering wheel drives a crown gear', () => {
    expect(mech.loose).toEqual([]);
    expect(mech.joints.some((j) => j.kind === 'slide' && (j.bodyA === carriage || j.bodyB === carriage))).toBe(true);
    expect(mech.meshes.filter((m) => m.kind === 'crown')).toHaveLength(1);
  });

  it('turning the lift shaft raises the forks 10 LDU per radian, until its gears reach the end of the racks', () => {
    for (const [way, reach] of [
      [1, 83.9],
      [-1, 155.9],
    ]) {
      kin.reset();
      const turned = turn(shaft, way * 30);
      const moved = new Vector3().applyMatrix4(kin.poses[carriage]).y;
      expect(Math.abs(moved)).toBeCloseTo(Math.abs(turned) * 10, 3); // the 8 tooth gears' pitch radius
      expect(Math.abs(moved)).toBeCloseTo(reach, 0);
      expect(frameMoved()).toBeLessThan(1e-6);
    }
  });

  it('turning the steering wheel turns both front wheels the same way, through the crown gear and a rack', () => {
    kin.reset();
    expect(Math.abs(turn(bodyOf('3736.dat'), 0.5))).toBeCloseTo(0.5, 6);
    const knuckles = turntables();
    expect(knuckles).toHaveLength(2);
    const [a, b] = knuckles.map(angleOf);
    expect(Math.abs(a)).toBeGreaterThan(0.05);
    expect(b).toBeCloseTo(a, 3);
  });
});
