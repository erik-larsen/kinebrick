import { existsSync } from 'node:fs';
import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { loadModel } from '../scripts/load-model.ts';
import { Kinematics } from '../src/kinematics.ts';

// A half shaft between a universal joint and a grooved ball in the wheel's hub, with no joint of
// its own (see Kinematics.plungingShafts): its ball is held at its place in the hub, and at the
// universal joint its line goes through the joint's middle, free to slide along itself. The 8880
// Super Car's front left: the suspension arm p105 turned 0.75 radian, the hub carries the ball
// p399 80 LDU, and the shaft from the joint's middle to the ball has to be 0.54 LDU shorter.
const MODEL = 'omr/8880-1 Super Car.mpd';

describe('plunging shafts', () => {
  it.skipIf(!existsSync(MODEL))('keep the 8880 shaft on its ball and through its universal joint while the wheel rises', () => {
    const { mech, parts } = loadModel(MODEL, true);
    const kin = new Kinematics(mech, { lifted: true });
    // The four universal joints of the half shafts each slide.
    expect(kin.couplings.filter((c) => c.plunges !== undefined)).toHaveLength(4);
    const shaft = mech.bodyOf[399];
    const hub = mech.bodyOf[429];
    const joint = mech.couplings.find((c) => !c.turningOnly && (c.bodyA === shaft || c.bodyB === shaft))!;
    const side = joint.bodyA === shaft ? joint.bodyB : joint.bodyA;
    const ball = new Vector3().setFromMatrixPosition(parts[399].matrix);
    const control = mech.bodyOf[105];
    const turn = kin.parentLink(control)!.joint;
    kin.holdWhatTheDragDoesntNeed(control, () => kin.jointMotion(turn) !== null, turn);
    let turned = 0;
    for (let k = 0; k < 15; k++) turned += kin.turnJoint(turn, -0.05);
    expect(turned).toBeLessThan(-0.7);
    const onHub = ball.clone().applyMatrix4(kin.poses[hub]);
    // The wheel rose, and the ball went with it, in the hub.
    expect(onHub.distanceTo(ball)).toBeGreaterThan(50);
    expect(ball.clone().applyMatrix4(kin.poses[shaft]).distanceTo(onHub)).toBeLessThan(0.01);
    // The joint's middle is on the shaft's line, the shaft slid in it.
    const end = joint.center.clone().applyMatrix4(kin.poses[shaft]);
    const line = ball.clone().applyMatrix4(kin.poses[shaft]).sub(end).normalize();
    const off = joint.center.clone().applyMatrix4(kin.poses[side]).sub(end);
    expect(off.clone().sub(line.clone().multiplyScalar(off.dot(line))).length()).toBeLessThan(0.01);
    expect(Math.abs(off.dot(line))).toBeGreaterThan(0.3);
  });
});
