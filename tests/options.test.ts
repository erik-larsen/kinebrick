import { describe, expect, it } from 'vitest';
import { Kinematics } from '../src/kinematics.ts';
import { load } from './sets/load.ts';

// The solver's switches are its own (see Options in kinematics.ts): two settings compared on one
// loaded model. The Ackermann car's differential, turned by its housing: least motion rolls the
// car to turn it; holds (the switch off) hold what the drag doesn't need, and with the car's
// wheels and steering held, the housing can't turn at all.
describe("the solver's switches", () => {
  const { mech } = load('models/ackermann-car.ldr');
  const housing = mech.bodies.findIndex((b) => b.parts.some((p) => mech.roles[p] === 'differential'));
  const turn = (kin: Kinematics) => {
    const joint = kin.parentLink(housing)!.joint;
    kin.holdWhatTheDragDoesntNeed(housing, () => kin.jointMotion(joint) !== null, joint);
    const turned = kin.turnJoint(joint, 0.5, () => kin.atLimit() === null);
    kin.letGoAfterDrag();
    return turned;
  };

  it('are given to each solver, which keeps its own', () => {
    const least = new Kinematics(mech);
    const holds = new Kinematics(mech, { leastMotion: false });
    expect(least.options.leastMotion).toBe(true);
    expect(holds.options.leastMotion).toBe(false);
    expect(turn(least)).toBeCloseTo(0.5, 9);
    expect(turn(holds)).toBe(0);
  });

  it('may be changed on a solver as it goes, and give what a solver made with them gives', () => {
    const kin = new Kinematics(mech);
    const start = kin.snapshot();
    kin.options.leastMotion = false;
    expect(turn(kin)).toBe(0);
    kin.options.leastMotion = true;
    kin.restore(start);
    expect(turn(kin)).toBeCloseTo(0.5, 9);
    const fresh = new Kinematics(mech);
    turn(fresh);
    kin.poses.forEach((pose, b) => expect(pose.equals(fresh.poses[b])).toBe(true));
  });
});
