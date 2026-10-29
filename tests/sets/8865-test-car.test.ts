import { describe, expect, it } from 'vitest';
import { load } from './load.ts';

describe('8865 Test Car', () => {
  const { parts, mech, kin, angleOf, frameMoved } = load('models/8865-Test Car.mpd');
  const rearWheel = mech.bodyOf[900];
  expect(parts[900].name).toBe('3739.dat');
  const crankshaft = mech.bodyOf[514]; // the front web's 24 tooth gear, on the 3708 main axle
  const rearWeb = mech.bodyOf[519];
  const pistons = mech.joints.flatMap((j, i) => (j.kind === 'slide' && mech.bodies[j.bodyB].name.startsWith('piston') ? [i] : []));
  // The 3707 axle through the tops of the two cylinder banks, between two bushes.
  const topAxle = mech.joints.flatMap((j, i) => (j.kind === 'slide' && j.bodyB === mech.bodyOf[624] ? [i] : []));
  expect(parts[624].name).toBe('3707.dat');

  it('slides each of its four 2 x 2 pistons in its cylinder bank, and ties the turning of its crankshaft webs, held only by crank pins at dead centre, together', () => {
    expect(pistons.map((p) => mech.joints[p].bodyA)).toEqual([0, 0, 0, 0]);
    expect(mech.couplings.filter((c) => [c.bodyA, c.bodyB].includes(crankshaft) && [c.bodyA, c.bodyB].includes(rearWeb))).toHaveLength(1);
  });

  it('pushed along, a turn of a rear wheel turns the V4 engine: its crankshaft 4/3 of a turn, each piston through its 28 LDU stroke, and the axle through its cylinder banks stays in them', () => {
    kin.reset();
    const joint = kin.parentLink(rearWheel)!.joint;
    kin.holdWhatTheDragDoesntNeed(rearWheel, () => kin.jointMotion(joint) !== null, joint);
    const low = pistons.map(() => Infinity);
    const high = pistons.map(() => -Infinity);
    let turned = 0;
    let topSlid = 0;
    for (let i = 0; i < 30; i++) {
      turned += kin.turnJoint(joint, (2 * Math.PI) / 30, () => kin.atLimit() === null);
      pistons.forEach((p, k) => {
        low[k] = Math.min(low[k], kin.slideOffset(p));
        high[k] = Math.max(high[k], kin.slideOffset(p));
      });
      for (const t of topAxle) topSlid = Math.max(topSlid, Math.abs(kin.slideOffset(t)));
    }
    kin.letGoAfterDrag();
    expect(turned).toBeCloseTo(2 * Math.PI, 6);
    expect(frameMoved()).toBeCloseTo(2 * Math.PI * 102.7, 0);
    expect(Math.abs(angleOf(crankshaft))).toBeCloseTo((4 / 3) * 2 * Math.PI, 3);
    expect(angleOf(rearWeb)).toBeCloseTo(angleOf(crankshaft), 6);
    expect(pistons).toHaveLength(4);
    pistons.forEach((_, k) => expect(high[k] - low[k]).toBeCloseTo(20 * Math.SQRT2, 0)); // the crank pins are 10 LDU across and 10 up from the main axle
    expect(topAxle).toHaveLength(4);
    expect(topSlid).toBeLessThan(1e-6);
  });
});
