import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { loadModel } from '../scripts/load-model.ts';

// The motion a step picks depends on the pose alone, not on where the turn began (decision 224 of
// 2026-11-19): a turn moves the model's frame back to the origin before each of its steps (see
// Kinematics.recenter). So a model that rolls, turned there and back, retraces itself, in one long
// turn as in many short ones. The 8851 Excavator's track sprocket p908, turned 1.5 radians and
// back, rolls the model about 9.6 LDU: with the origin set once for each turn, it came back 1.435
// LDU off in turns of 1.5 radians, and 0.243 in turns of 0.1.
describe('the origin before each step', () => {
  // The frame's place after p908 is turned 1.5 radians and back, in turns of `call` radians, each
  // a drag as the check makes it; and how far the frame went.
  const roll = (call: number) => {
    const { kin, mech } = loadModel('models/8851-Excavator.mpd', false);
    const body = mech.bodyOf[908];
    const joint = kin.parentLink(body)!.joint;
    const start = new Vector3().setFromMatrixPosition(kin.poses[0]);
    const turn = (by: number) => {
      kin.holdWhatTheDragDoesntNeed(body, () => kin.jointMotion(joint) !== null, joint);
      let done = 0;
      while (Math.abs(done) < Math.abs(by) - 1e-9) done += kin.turnJoint(joint, Math.sign(by) * Math.min(call, Math.abs(by) - Math.abs(done)));
      kin.letGoAfterDrag();
      return done;
    };
    turn(1.5);
    const went = new Vector3().setFromMatrixPosition(kin.poses[0]).distanceTo(start);
    turn(-1.5);
    return { went, end: new Vector3().setFromMatrixPosition(kin.poses[0]), start };
  };

  it('rolls the 8851 there and back to where it started, in one turn or in many', () => {
    const long = roll(1.5);
    const short = roll(0.1);
    expect(long.went).toBeGreaterThan(5);
    expect(long.end.distanceTo(long.start)).toBeLessThan(0.01);
    expect(short.end.distanceTo(short.start)).toBeLessThan(0.01);
    expect(long.end.distanceTo(short.end)).toBeLessThan(0.01);
  });
});
