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
    const whole = new Kinematics(mech, { reach: false });
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

  // Rolled on a road wheel, the crane can't reach its hook block, which hangs from the boom on a
  // string. The string's rows are a hundred-thousandth out when the whole crane moves as one, so
  // with the block held, they were left to hold back the rolling: the car turned a little as it
  // went, and stopped at 0.93 of 1.5. Rows on nothing but what's held are left out.
  it('rolls the crane on a road wheel as the whole solve does, its hook block held', () => {
    const wheel = mech.treads[0].body;
    const block = mech.strings[0].hook!.body;
    const roll = (kin: Kinematics) => {
      const joint = kin.parentLink(wheel)!.joint;
      kin.holdWhatTheDragDoesntNeed(wheel, () => kin.jointMotion(joint) !== null, joint);
      const out = [...kin.drag.outOfReach];
      let turned = 0;
      for (let i = 0; i < 15; i++) turned += kin.turnJoint(joint, 0.1, () => kin.atLimit() === null);
      kin.letGoAfterDrag();
      return { out, turned };
    };
    const whole = new Kinematics(mech, { reach: false });
    const reach = new Kinematics(mech, { reach: true });
    const a = roll(whole);
    const b = roll(reach);
    expect(b.out).toContain(block);
    expect(a.turned).toBeCloseTo(1.5, 9);
    expect(b.turned).toBeCloseTo(1.5, 9);
    // Taking up the string's rounding, the whole solve turns the block's pulley a few thousandths
    // of a radian; held, it doesn't turn. Everything in reach comes out the same.
    whole.poses.forEach((pose, body) => pose.elements.forEach((x, i) => expect(Math.abs(x - reach.poses[body].elements[i])).toBeLessThan(b.out.includes(body) ? 1e-2 : 1e-6)));
  });
});

// Those rows left out, what's out of reach is held whole on the frame, not just on its joint: held
// only on their joints, the 8859 Tractor's cab, hitch and cultivator came loose, and rolling the
// tractor back on a front wheel stopped at a dead point after a fifteenth of a radian.
describe("a drag holding what it can't reach whole", () => {
  const { mech, parts, kin } = load('models/8859-Tractor.mpd');
  const wheel = mech.bodyOf[596];

  it('rolls the tractor back on a front wheel, everything out of reach standing still on the frame', () => {
    expect(parts[596].name).toBe('3740.dat');
    const reach = new Kinematics(mech, { reach: true });
    reach.scrub = kin.scrub;
    const joint = reach.parentLink(wheel)!.joint;
    reach.holdWhatTheDragDoesntNeed(wheel, () => reach.jointMotion(joint) !== null, joint);
    const out = [...reach.drag.outOfReach];
    const onFrame = (body: number) => reach.poses[0].clone().invert().multiply(reach.poses[body]);
    const before = out.map(onFrame);
    let turned = 0;
    for (let i = 0; i < 15; i++) turned += reach.turnJoint(joint, -0.1, () => reach.atLimit() === null);
    expect(out.length).toBeGreaterThan(40);
    expect(turned).toBeCloseTo(-1.5, 9);
    out.forEach((body, k) => onFrame(body).elements.forEach((x, i) => expect(Math.abs(x - before[k].elements[i])).toBeLessThan(1e-9)));
  });
});
