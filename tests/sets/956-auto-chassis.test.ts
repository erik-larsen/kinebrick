import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { load } from './load.ts';

describe('956 Auto Chassis', () => {
  const { mech, kin, bodyOf, turn, motor, angleOf, frameMoved, turntables } = load('models/956-Auto Chassis.mpd');
  // The rear axle: both rear tyres on one body, with no differential between them.
  const rearAxle = mech.treads.find((t) => mech.treads.filter((u) => u.body === t.body).length === 2)!.body;

  it('is fully attached: its steering column bends through a double universal joint, and its steering rack is guided', () => {
    expect(mech.loose).toEqual([]);
    expect(mech.couplings).toHaveLength(2);
    expect(mech.joints.filter((j) => j.kind === 'slide')).toHaveLength(7); // two seats, the steering rack, four pistons
  });

  it('turning the steering wheel turns both front wheels the same way, and the car stays where it is', () => {
    kin.reset();
    expect(Math.abs(turn(bodyOf('3736.dat'), 0.5))).toBeCloseTo(0.5, 6);
    const [a, b] = turntables().map(angleOf);
    expect(Math.abs(a)).toBeGreaterThan(0.05);
    expect(b).toBeCloseTo(a, 3);
    expect(frameMoved()).toBeLessThan(1e-6);
  });

  it('turning the steering wheel 3 radians slides its rack 10 LDU for each radian its 8 tooth gear turns, without slipping', () => {
    kin.reset();
    // Each rack's gear's joint, and the rack's slide joint.
    const racks = mech.meshes.flatMap((m) => {
      if (m.kind !== 'rack') return [];
      const rack = mech.gears[m.gearB].body;
      return [{ gear: kin.parentLink(mech.gears[m.gearA].body)!.joint, slide: mech.joints.findIndex((j) => j.kind === 'slide' && j.bodyB === rack) }];
    });
    expect(Math.abs(turn(bodyOf('3736.dat'), 3))).toBeCloseTo(3, 6);
    const steering = racks.filter((r) => Math.abs(kin.jointAngles[r.gear]) > 1);
    expect(steering).toHaveLength(1);
    const { gear, slide } = steering[0];
    expect(Math.abs(kin.slideOffset(slide) / kin.jointAngles[gear])).toBeCloseTo(10, 6);
  });

  it('a turn of a front wheel rolls it one big tyre round, and runs its four-cylinder engine: each piston through its 32 LDU stroke', () => {
    kin.reset();
    const wheel = bodyOf('3740.dat');
    const joint = kin.parentLink(wheel)!.joint;
    const pistons = mech.joints.flatMap((j, i) => (j.kind === 'slide' && mech.bodies[j.bodyB].name.startsWith('piston') ? [i] : []));
    kin.holdWhatTheDragDoesntNeed(wheel, () => kin.jointMotion(joint) !== null);
    const low = pistons.map(() => Infinity);
    const high = pistons.map(() => -Infinity);
    let turned = 0;
    for (let i = 0; i < 60; i++) {
      turned += kin.turnJoint(joint, (2 * Math.PI) / 60);
      pistons.forEach((p, k) => {
        low[k] = Math.min(low[k], kin.slideOffset(p));
        high[k] = Math.max(high[k], kin.slideOffset(p));
      });
    }
    kin.letGoAfterDrag();
    expect(Math.abs(turned)).toBeCloseTo(2 * Math.PI, 6);
    expect(frameMoved()).toBeCloseTo(2 * Math.PI * 102.7, 0);
    expect(pistons).toHaveLength(4);
    pistons.forEach((_, k) => expect(high[k] - low[k]).toBeCloseTo(32, 0));
  });

  it('at full lock either way, where its tyres meet its chassis, a turn of the rear axle still takes it round, its tyres scrubbing sideways more than the usual 2%', () => {
    expect(kin.scrub).toBe(0.06);
    const [left, right] = turntables();
    for (const way of [1, -1]) {
      kin.reset();
      // 2.19 radians of the steering wheel, as far as it turns in the viewer, which stops the
      // front tyres where they meet the chassis (the tests can't: that needs the parts' shapes).
      expect(Math.abs(turn(bodyOf('3736.dat'), way * 2.19))).toBeCloseTo(2.19, 6);
      for (const tt of [left, right]) expect(Math.abs(angleOf(tt)) * (180 / Math.PI)).toBeGreaterThan(30);
      const wheel = rearAxle;
      const joint = kin.parentLink(wheel)!.joint;
      const roll = (scrub: number) => {
        const start = kin.snapshot();
        kin.scrub = scrub;
        kin.holdWhatTheDragDoesntNeed(wheel, () => kin.jointMotion(joint) !== null, joint);
        let turned = 0;
        for (let i = 0; i < 20; i++) turned += kin.turnJoint(joint, 0.05);
        kin.letGoAfterDrag();
        kin.restore(start);
        kin.scrub = 0.06;
        return Math.abs(turned);
      };
      expect(roll(0.06)).toBeCloseTo(1, 6);
      expect(roll(0.02)).toBeLessThan(0.1);
    }
  });

  it('turned on past that, its steering stops short of where its linkage locks, in the same place however it gets there, and turns back', () => {
    for (const way of [1, -1]) {
      kin.reset();
      const once = turn(bodyOf('3736.dat'), way * 10);
      expect(Math.abs(once)).toBeGreaterThan(3);
      expect(Math.abs(once)).toBeLessThan(3.25);
      kin.reset();
      let stepped = 0;
      for (let i = 0; i < 150; i++) stepped += turn(bodyOf('3736.dat'), way * 0.03);
      expect(Math.abs(stepped - once)).toBeLessThan(0.05);
      // Turned back half a radian, the front wheels are where that steering puts them, to
      // within a millionth of a radian: the rack hasn't slipped against its gear.
      expect(turn(bodyOf('3736.dat'), -way * 0.5)).toBeCloseTo(-way * 0.5, 6);
      const back = turntables().map(angleOf);
      kin.reset();
      turn(bodyOf('3736.dat'), stepped - way * 0.5);
      turntables().map(angleOf).forEach((a, k) => expect(Math.abs(a - back[k])).toBeLessThan(1e-6));
    }
  });

  it('driven round and round in a circle, as Ctrl-click does, it stays level on its tyres', () => {
    kin.reset();
    turn(bodyOf('3736.dat'), 0.5);
    const wheel = rearAxle;
    const joint = kin.parentLink(wheel)!.joint;
    kin.holdWhatTheDragDoesntNeed(wheel, () => kin.jointMotion(joint) !== null);
    const step = (15 * Math.PI) / 180; // a motor's step
    for (let i = 0; i < 24 * 6; i++) kin.turnJoint(joint, step, undefined, step); // six turns of the wheel
    kin.letGoAfterDrag();
    expect(frameMoved()).toBeGreaterThan(1000);
    const up = new Vector3(0, -1, 0).transformDirection(kin.poses[0]);
    expect(Math.acos(Math.min(1, -up.y)) * (180 / Math.PI)).toBeLessThan(0.5); // degrees from upright
  });

  it('steered, a turn of the rear axle takes it round a bend: with no differential, its rear tyres skid to make up the difference', () => {
    kin.reset();
    turn(bodyOf('3736.dat'), 0.5); // the front wheels about 7 degrees
    const wheel = rearAxle;
    const joint = kin.parentLink(wheel)!.joint;
    kin.holdWhatTheDragDoesntNeed(wheel, () => kin.jointMotion(joint) !== null);
    let turned = 0;
    for (let i = 0; i < 30; i++) turned += kin.turnJoint(joint, (2 * Math.PI) / 60);
    kin.letGoAfterDrag();
    expect(Math.abs(turned)).toBeCloseTo(Math.PI, 6);
    expect(Math.abs(Math.atan2(kin.poses[0].elements[8], kin.poses[0].elements[0]))).toBeGreaterThan(0.05);
  });

  it('at full lock either way, its rear axle kept turning by the motor takes it round and round: its connecting rods, swinging fast, are no dead point', () => {
    for (const way of [1, -1]) {
      kin.reset();
      turn(bodyOf('3736.dat'), way * 2.19);
      expect(motor(rearAxle, 200)).toBeCloseTo(200 * ((15 * Math.PI) / 180), 6);
    }
  });
});
