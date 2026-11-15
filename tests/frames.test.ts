import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { Kinematics } from '../src/kinematics.ts';
import type { Joint, Mechanism, Tread } from '../src/mechanism.ts';

// Two cars built by hand in one file (see Mechanism.frames): the main one's frame is body 0, the
// second's body 5, each with four wheels turning on it about x, so each rolls along z. The second
// stands 50 LDU higher (LDraw's y points down), as the 42062 Container Yard's reach stacker stands
// on its base plate. With `box`, a third model with no tyres at all: body 10, on its own.
const segment = (at: Vector3, dir: Vector3): [Vector3, Vector3] => [at.clone().addScaledVector(dir, -5), at.clone().addScaledVector(dir, 5)];
const X = new Vector3(1, 0, 0);

function twoCars(box = false): { mech: Mechanism; wheels: number[][] } {
  const joints: Joint[] = [];
  const treads: Tread[] = [];
  const wheels: number[][] = [];
  for (const [frame, x, y] of [
    [0, 0, 0],
    [5, 300, -50],
  ]) {
    const own: number[] = [];
    let body = frame + 1;
    for (const sx of [1, -1]) {
      for (const sz of [1, -1]) {
        const center = new Vector3(x + sx * 60, y, sz * 100);
        const [from, to] = segment(center, X);
        joints.push({ kind: 'revolute', bodyA: frame, bodyB: body, from, to, stiff: false });
        own.push(joints.length - 1);
        treads.push({ part: body, body, center, axis: new Vector3(sx, 0, 0), radius: 30 });
        body++;
      }
    }
    wheels.push(own);
  }
  const count = box ? 11 : 10;
  const bodies = Array.from({ length: count }, (_, i) => ({ name: `body ${i}`, parts: [i] }));
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
    frames: box ? [0, 5, 10] : [0, 5],
    frameParts: box ? [[5, 6, 7, 8, 9], [10]] : [[5, 6, 7, 8, 9]],
  };
  return { mech, wheels };
}

const at = (kin: Kinematics, body: number) => new Vector3().setFromMatrixPosition(kin.poses[body]);
const turn = (kin: Kinematics, joint: number, angle: number) => {
  const wheel = kin.mech.joints[joint].bodyB;
  kin.holdWhatTheDragDoesntNeed(wheel, () => kin.jointMotion(joint) !== null, joint);
  const turned = kin.turnJoint(joint, angle, () => kin.atLimit() === null);
  kin.letGoAfterDrag();
  return turned;
};

describe('two models in one file, each a frame of its own', () => {
  it('stands each on its own tyres, though one stands higher than the other', () => {
    const kin = new Kinematics(twoCars().mech);
    expect(kin.contactTreads).toHaveLength(8);
    expect(kin.fixedBody).toBe(-1);
    expect(kin.frameOf).toEqual([0, 0, 0, 0, 0, 5, 5, 5, 5, 5]);
    expect(kin.parentLink(5)).toBeNull();
  });

  it('rolls the second car on its wheel, and the main car stays where it is; and back', () => {
    const { mech, wheels } = twoCars();
    const kin = new Kinematics(mech);
    expect(turn(kin, wheels[1][0], 2)).toBeCloseTo(2, 6);
    expect(at(kin, 5).length()).toBeGreaterThan(50);
    expect(at(kin, 0).length()).toBeCloseTo(0, 6);
    expect(turn(kin, wheels[1][0], -2)).toBeCloseTo(-2, 6);
    expect(at(kin, 5).length()).toBeCloseTo(0, 6);
  });

  it('rolls the main car, and the second stays where it is', () => {
    const { mech, wheels } = twoCars();
    const kin = new Kinematics(mech);
    expect(turn(kin, wheels[0][0], 2)).toBeCloseTo(2, 6);
    expect(at(kin, 0).length()).toBeGreaterThan(50);
    expect(at(kin, 5).length()).toBeCloseTo(0, 6);
  });

  it('lifted, holds both frames still: a wheel turned turns alone', () => {
    const { mech, wheels } = twoCars();
    const kin = new Kinematics(mech, { lifted: true });
    expect([...kin.stillFrames]).toEqual([5]);
    expect(turn(kin, wheels[1][0], 1)).toBeCloseTo(1, 6);
    expect(at(kin, 5).length()).toBeCloseTo(0, 6);
    expect(at(kin, 0).length()).toBeCloseTo(0, 6);
  });

  it('keeps still a further model with no tyres, while a car rolls', () => {
    const { mech, wheels } = twoCars(true);
    const kin = new Kinematics(mech);
    expect([...kin.stillFrames]).toEqual([10]);
    expect(turn(kin, wheels[0][0], 2)).toBeCloseTo(2, 6);
    expect(at(kin, 10).length()).toBeCloseTo(0, 6);
  });
});
