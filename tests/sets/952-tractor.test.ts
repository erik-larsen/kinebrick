import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { Kinematics } from '../../src/kinematics.ts';
import { inferMechanism, meshesChanged } from '../../src/mechanism.ts';
import { load, roles, table } from './load.ts';

describe('952 Tractor', () => {
  const { parts, mech, kin, bodyOf, turn, motor, angleOf, frameMoved, turntables } = load('models/952-Tractor.mpd');

  it('is fully attached: its big rear wheels are tyres, and two plates stand on edge between studs', () => {
    expect(mech.loose).toEqual([]);
    expect(kin.groundY).not.toBeNull();
    expect(mech.treads.filter((t) => t.radius > 100)).toHaveLength(2); // the big rear tyres
  });

  it('its lever raises and lowers the hitch, which hangs on both rear half axles, and the tractor stays where it is', () => {
    kin.reset();
    // The lever: a Technic brick pinned beside the seat, with a plate up from it for a handle.
    const lever = mech.bodyOf[parts.findIndex((p) => p.name === '3702.dat' && new Vector3().setFromMatrixPosition(p.matrix).distanceTo(new Vector3(-50, -109, 39)) < 1)];
    // The hitch: what turns on both rear wheels' axles, but the frame.
    const wheels = mech.treads.filter((t) => t.radius > 100).map((t) => t.body);
    const hitch = mech.bodies.findIndex((_, b) => b !== 0 && wheels.every((w) => mech.joints.some((j) => (j.bodyA === w && j.bodyB === b) || (j.bodyA === b && j.bodyB === w))));
    const tilt = () => new Vector3(0, 0, 1).transformDirection(kin.poses[hitch]).y;
    expect(Math.abs(turn(lever, 0.3))).toBeCloseTo(0.3, 6);
    const up = tilt();
    expect(Math.abs(up)).toBeGreaterThan(0.05);
    expect(Math.abs(turn(lever, -0.6))).toBeCloseTo(0.6, 6);
    expect(Math.sign(tilt())).toBe(-Math.sign(up));
    expect(frameMoved()).toBeLessThan(1e-6);
  });

  it('turning the steering column turns both front wheels the same way, and the tractor stays where it is', () => {
    kin.reset();
    expect(Math.abs(turn(bodyOf('3712.dat'), 0.5))).toBeCloseTo(0.5, 6);
    const [a, b] = turntables().map(angleOf);
    expect(Math.abs(a)).toBeGreaterThan(0.05);
    expect(b).toBeCloseTo(a, 3);
    expect(frameMoved()).toBeLessThan(1e-6);
  });

  it('a turn of the rear wheels rolls it one big tyre round, and the assembly hung on the rear axle stays level', () => {
    kin.reset();
    const wheel = bodyOf('952-3739c01.dat');
    const joint = kin.parentLink(wheel)!.joint;
    kin.holdWhatTheDragDoesntNeed(wheel, () => kin.jointMotion(joint) !== null);
    let turned = 0;
    for (let i = 0; i < 60; i++) turned += kin.turnJoint(joint, (2 * Math.PI) / 60);
    kin.letGoAfterDrag();
    expect(turned).toBeCloseTo(2 * Math.PI, 6);
    expect(frameMoved()).toBeCloseTo(2 * Math.PI * 102.7, 0);
    const hung = bodyOf('3021.dat', 0);
    expect(new Vector3(0, 1, 0).transformDirection(kin.poses[hung]).y).toBeCloseTo(1, 3); // not carried round
  });

  it('steered 40 degrees either way, a turn of the rear wheels still takes it round, its tyres scrubbing sideways by up to the 10% KineBrick allows', () => {
    expect(kin.scrub).toBe(0.1);
    for (const way of [1, -1]) {
      kin.reset();
      turn(bodyOf('3712.dat'), way * 4); // the steering column
      const [a] = turntables().map(angleOf);
      expect(Math.abs(a) * (180 / Math.PI)).toBeGreaterThan(40);
      const wheel = bodyOf('952-3739c01.dat');
      const joint = kin.parentLink(wheel)!.joint;
      kin.holdWhatTheDragDoesntNeed(wheel, () => kin.jointMotion(joint) !== null);
      let turned = 0;
      for (let i = 0; i < 20; i++) turned += kin.turnJoint(joint, 0.05);
      kin.letGoAfterDrag();
      expect(Math.abs(turned)).toBeCloseTo(1, 6);
    }
  });

  it('steered a little, a rear wheel kept turning by the motor takes it round and round, with its steering left where it was', () => {
    kin.reset();
    const column = bodyOf('3712.dat');
    turn(column, -0.5);
    const heading = Math.atan2(kin.poses[0].elements[8], kin.poses[0].elements[0]);
    // 150 steps: further on, its hitch, a loop with its lever that rolling nudges round, has
    // crept down until the thresher's wheels touch the ground, and the tractor lurches over.
    expect(motor(bodyOf('952-3739c01.dat', 1), 150)).toBeCloseTo(150 * ((15 * Math.PI) / 180), 6);
    expect(angleOf(column)).toBeCloseTo(-0.5, 6);
    // It went round a corner: over 45 degrees.
    const turned = Math.atan2(kin.poses[0].elements[8], kin.poses[0].elements[0]) - heading;
    expect(Math.abs(turned) * (180 / Math.PI)).toBeGreaterThan(45);
    expect(Math.abs(turned) * (180 / Math.PI)).toBeLessThan(90);
  });

  it("lowered by its lever onto the power take-off, the harrow's 40 tooth gear meshes with the crown gear the rear axle drives, and worked out afresh there, a turn of the rear wheels spins the harrow", () => {
    kin.reset();
    const lever = mech.bodyOf[parts.findIndex((p) => p.name === '3702.dat' && new Vector3().setFromMatrixPosition(p.matrix).distanceTo(new Vector3(-50, -109, 39)) < 1)];
    const joint = kin.parentLink(lever)!.joint;
    expect(meshesChanged(mech, kin.poses)).toBe(false);
    kin.holdWhatTheDragDoesntNeed(lever, () => kin.jointMotion(joint) !== null, joint);
    expect(kin.turnJoint(joint, -1.396)).toBeCloseTo(-1.396, 6); // as far down as the viewer lets it go (80 degrees), where the harrow's wheels reach the ground
    kin.letGoAfterDrag();
    expect(meshesChanged(mech, kin.poses)).toBe(true);
    const lowered = parts.map((p, i) => ({ ...p, matrix: kin.poses[mech.bodyOf[i]].clone().multiply(p.matrix) }));
    const after = inferMechanism(lowered, table, roles);
    const pto = after.meshes.find((m) => [after.gears[m.gearA].part, after.gears[m.gearB].part].sort().join() === [27, 286].sort().join());
    expect(pto?.kind).toBe('crown');
    const kin2 = new Kinematics(after);
    kin2.scrub = kin.scrub;
    const wheel = after.bodyOf[parts.findIndex((p) => p.name === '952-3739c01.dat')];
    expect(parts[305].name).toBe('3649.dat');
    const harrow = after.bodyOf[305]; // the middle of its three 40 tooth gears
    const wheelJoint = kin2.parentLink(wheel)!.joint;
    kin2.holdWhatTheDragDoesntNeed(wheel, () => kin2.jointMotion(wheelJoint) !== null, wheelJoint);
    expect(Math.abs(kin2.turnJoint(wheelJoint, 1))).toBeCloseTo(1, 6);
    kin2.letGoAfterDrag();
    expect(Math.abs(kin2.jointAngles[kin2.parentLink(harrow)!.joint])).toBeGreaterThan(0.5);
  });
});
