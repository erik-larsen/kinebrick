import { describe, expect, it } from 'vitest';
import { Kinematics } from '../src/kinematics.ts';
import { load } from './sets/load.ts';

// A drag solved only over the parts it can reach (see Options.reach): the 855 Mobile Crane's winch,
// turned, can't reach its outriggers, which no connection joins to the winch but through the frame.
// Held where they are, they leave far fewer free motions to choose from, and the drag comes out
// as it does solved over the whole crane, to well under a thousandth of an LDU: not to the last
// bit, as the motions are found and mixed from a smaller set.
describe('a drag solved over what it can reach', () => {
  const { mech } = load('models/855-Mobile Crane.mpd');
  const drum = mech.strings[0].drum!.body;
  const outriggers = mech.joints.flatMap((j) => (j.kind === 'slide' && j.bodyA === 0 && (j.range![0] === -120 || j.range![0] === -40) ? [j.bodyB] : []));
  const wind = (kin: Kinematics) => {
    const joint = kin.parentLink(drum)!.joint;
    kin.holdWhatTheDragDoesntNeed(drum, () => kin.jointMotion(joint) !== null, joint);
    const free = kin.freeMotions().length;
    const out = [...kin.drag.outOfReach];
    const turned = kin.turnJoint(joint, 2);
    kin.letGoAfterDrag();
    return { free, out, turned };
  };

  it('holds the outriggers, has fewer motions to choose from, and comes out the same but for rounding', () => {
    const whole = new Kinematics(mech);
    const reach = new Kinematics(mech, { reach: true });
    const a = wind(whole);
    const b = wind(reach);
    expect(outriggers).toHaveLength(4);
    expect(a.out).toEqual([]);
    for (const body of outriggers) expect(b.out).toContain(body);
    expect(b.free).toBeLessThan(a.free);
    expect(b.turned).toBe(a.turned);
    whole.poses.forEach((pose, body) => pose.elements.forEach((x, i) => expect(Math.abs(x - reach.poses[body].elements[i])).toBeLessThan(1e-6)));
  });
});
