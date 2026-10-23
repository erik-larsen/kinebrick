import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { Joint, lineUpBalls } from '../src/mechanism.ts';

// A constant velocity joint's socket part (body 1) turning on the frame about z, and a ball
// (body 2's) in it, as the 8110 Unimog has them: the model sets the ball 0.23 LDU off the
// socket's axis, and as the socket part turned, the ball went round with it, which the
// driveshaft it ends, held by a universal joint at its other end, couldn't follow.
function socket(ballAt: Vector3): Joint[] {
  const turning: Joint = { kind: 'revolute', bodyA: 0, bodyB: 1, from: new Vector3(20, 0, 10), to: new Vector3(20, 0, 20), stiff: false };
  const ball: Joint = { kind: 'ball', bodyA: 1, bodyB: 2, from: ballAt.clone(), to: ballAt.clone(), stiff: false };
  return [turning, ball];
}

describe('a ball set a hair off the axis of the part it sits in', () => {
  it('is put on that axis', () => {
    const joints = socket(new Vector3(19.77, 0, 0));
    lineUpBalls(joints);
    expect(joints[1].from.x).toBeCloseTo(20, 9);
    expect(joints[1].to.x).toBeCloseTo(20, 9);
    expect(joints[1].from.z).toBeCloseTo(0, 9);
  });

  it("is put on that axis from a couple of LDU off too, as the 42110 Land Rover's drooped half shafts set their balls in the front hubs", () => {
    const joints = socket(new Vector3(17.8, 0, 0));
    lineUpBalls(joints);
    expect(joints[1].from.x).toBeCloseTo(20, 9);
  });

  it("is left where it is if it sits well off the axis (a crank's)", () => {
    const joints = socket(new Vector3(10, 0, 0));
    lineUpBalls(joints);
    expect(joints[1].from.x).toBe(10);
  });

  it('is left where it is if it sits on the axis but far past the turning joint (another part altogether)', () => {
    const joints = socket(new Vector3(19.77, 0, 200));
    lineUpBalls(joints);
    expect(joints[1].from.x).toBe(19.77);
  });
});

describe('a ball where two axes cross, one each side of a constant velocity joint', () => {
  // As the 42056 Porsche 911 GT3 RS's steering column has it: a shaft (body 1) turning on the
  // frame about z, and another (body 2) at an angle to it, sliding and turning in a joint 110
  // LDU further along it, the two axes crossing at the origin. The ball between them is built
  // 0.1 LDU along the first axis from there: on it, but a hair off the second, which as body 2
  // turned took the ball round with it.
  const d = new Vector3(0, 0.28, -0.96).normalize();
  const joints = (): Joint[] => [
    { kind: 'revolute', bodyA: 0, bodyB: 1, from: new Vector3(0, 0, -10), to: new Vector3(0, 0, -150), stiff: false },
    { kind: 'slide', bodyA: 3, bodyB: 2, from: d.clone().multiplyScalar(-110), to: d.clone().multiplyScalar(-126), stiff: false, turns: true },
    { kind: 'ball', bodyA: 1, bodyB: 2, from: new Vector3(0, 0, -0.1), to: new Vector3(0, 0, -0.1), stiff: false },
  ];

  it('is put where they cross, on both', () => {
    const js = joints();
    lineUpBalls(js);
    expect(js[2].from.length()).toBeCloseTo(0, 9);
  });

  it("is left on the first axis if the second only slides past it, crossing nowhere near", () => {
    const js = joints();
    js[1].from.add(new Vector3(5, 0, 0));
    js[1].to.add(new Vector3(5, 0, 0));
    lineUpBalls(js);
    expect(js[2].from.z).toBeCloseTo(-0.1, 9);
  });
});
