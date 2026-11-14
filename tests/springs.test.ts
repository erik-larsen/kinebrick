import { Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { Kinematics } from '../src/kinematics.ts';
import type { Joint, Mechanism, Tread } from '../src/mechanism.ts';

// A car built by hand on four swing arms, each held by a shock absorber whose rod slides in its
// cylinder: a slide that a spring holds at rest (see Joint.springHeld). The car runs along z; at
// each corner an arm hinges on the frame about z, a wheel turns on the arm about x, and the shock's
// cylinder hangs on the frame and its rod on the arm, both on pins along z, the rod sliding in the
// cylinder up and down. LDraw's y points down; the tyres stand on the ground at y = 30.
const segment = (at: Vector3, dir: Vector3): [Vector3, Vector3] => [at.clone().addScaledVector(dir, -5), at.clone().addScaledVector(dir, 5)];
const Z = new Vector3(0, 0, 1);
const X = new Vector3(1, 0, 0);

function car(sprung: boolean): { mech: Mechanism; wheels: number[]; arms: number[]; shocks: number[] } {
  const joints: Joint[] = [];
  const treads: Tread[] = [];
  const wheels: number[] = [];
  const arms: number[] = [];
  const shocks: number[] = [];
  let body = 1;
  const revolute = (a: number, b: number, at: Vector3, dir: Vector3) => {
    const [from, to] = segment(at, dir);
    joints.push({ kind: 'revolute', bodyA: a, bodyB: b, from, to, stiff: false });
    return joints.length - 1;
  };
  for (const sx of [1, -1]) {
    for (const sz of [1, -1]) {
      const [arm, wheel, cylinder, rod] = [body, body + 1, body + 2, body + 3];
      body += 4;
      arms.push(revolute(0, arm, new Vector3(sx * 20, 0, sz * 100), Z));
      wheels.push(revolute(arm, wheel, new Vector3(sx * 60, 0, sz * 100), X));
      treads.push({ part: wheel, body: wheel, center: new Vector3(sx * 60, 0, sz * 100), axis: new Vector3(sx, 0, 0), radius: 30 });
      revolute(0, cylinder, new Vector3(sx * 40, -40, sz * 100), Z);
      revolute(arm, rod, new Vector3(sx * 40, 0, sz * 100), Z);
      joints.push({ kind: 'slide', bodyA: cylinder, bodyB: rod, from: new Vector3(sx * 40, -40, sz * 100), to: new Vector3(sx * 40, 0, sz * 100), stiff: false, ...(sprung ? { springHeld: true } : {}) });
      shocks.push(joints.length - 1);
    }
  }
  const bodies = Array.from({ length: body }, (_, i) => ({ name: i === 0 ? 'frame' : `body ${i}`, parts: [i] }));
  const mech: Mechanism = {
    roles: bodies.map(() => 'structure'),
    bodyOf: bodies.map((_, i) => i),
    bodies,
    joints,
    connections: [],
    treads,
    gears: [],
    meshes: [],
    loose: [],
    couplings: [],
    loops: [],
    strings: [],
    screws: [],
    rests: [],
  };
  return { mech, wheels, arms, shocks };
}

// How far a slide has slid from where it was built, in LDU.
const slid = (kin: Kinematics, j: Joint) => {
  const d = j.to.clone().sub(j.from).normalize();
  const a = j.from.clone().applyMatrix4(kin.poses[j.bodyA]);
  const b = j.from.clone().applyMatrix4(kin.poses[j.bodyB]);
  return b.sub(a).dot(d.transformDirection(kin.poses[j.bodyA]));
};
const tilt = (kin: Kinematics) => new Quaternion().setFromRotationMatrix(kin.poses[0]).angleTo(new Quaternion());

describe('a car on shock absorbers that springs hold at rest', () => {
  it('stands on its four tyres, its suspension free to move', () => {
    const { mech, arms } = car(true);
    const kin = new Kinematics(mech);
    expect(kin.contactTreads).toHaveLength(4);
    expect(kin.jointMotion(arms[0])).not.toBeNull();
  });

  it('rolled along by a wheel and back, keeps its shocks where they were and comes back level', () => {
    const { mech, wheels, shocks } = car(true);
    const kin = new Kinematics(mech);
    const wheel = mech.joints[wheels[0]].bodyB;
    const turn = (angle: number) => {
      kin.holdWhatTheDragDoesntNeed(wheel, () => kin.jointMotion(wheels[0]) !== null, wheels[0]);
      const turned = kin.turnJoint(wheels[0], angle, () => kin.atLimit() === null);
      kin.letGoAfterDrag();
      return turned;
    };
    expect(turn(2)).toBeCloseTo(2, 6);
    expect(new Vector3().setFromMatrixPosition(kin.poses[0]).length()).toBeGreaterThan(50);
    for (const j of shocks) expect(slid(kin, mech.joints[j])).toBeCloseTo(0, 6);
    expect(turn(-2)).toBeCloseTo(-2, 6);
    expect(new Vector3().setFromMatrixPosition(kin.poses[0]).length()).toBeCloseTo(0, 6);
    expect(tilt(kin)).toBeCloseTo(0, 6);
  });

  it('gives where it must: an arm turned by hand slides its shock', () => {
    const { mech, arms, shocks } = car(true);
    const kin = new Kinematics(mech);
    const arm = mech.joints[arms[0]].bodyB;
    kin.holdWhatTheDragDoesntNeed(arm, () => kin.jointMotion(arms[0]) !== null, arms[0]);
    expect(kin.turnJoint(arms[0], 0.1, () => kin.atLimit() === null)).toBeCloseTo(0.1, 6);
    kin.letGoAfterDrag();
    expect(Math.abs(slid(kin, mech.joints[shocks[0]]))).toBeGreaterThan(1);
  });

  it("has one way to roll, and its suspension's three apart (rise, pitch, roll); with its shocks only free, a fifth: rolling mixed with tipping", () => {
    const sprung = new Kinematics(car(true).mech);
    const plain = new Kinematics(car(false).mech);
    expect(sprung.springRows()).toHaveLength(4);
    expect(plain.springRows()).toHaveLength(0);
    expect(sprung.freeMotions()).toHaveLength(4);
    expect(plain.freeMotions()).toHaveLength(5);
  });
});
