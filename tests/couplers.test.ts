import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { Kinematics } from '../src/kinematics.ts';
import { Joint, Mechanism, withoutSlidesOnCouplers } from '../src/mechanism.ts';

// Steering as the 8841 Dune Buggy has it: two steering arms turning on upright pins in the
// frame (body 0), and a rack pinned to both, 40 LDU in front of their pins, so the four make a
// four-bar linkage. The rack also rests on smooth tiles, which would have it slide straight
// across. Bodies: 1 and 2 the arms, 3 the rack.
const upright = (x: number, z: number) => [new Vector3(x, -90, z), new Vector3(x, -80, z)] as const;
const revolute = (bodyA: number, bodyB: number, [from, to]: readonly [Vector3, Vector3]): Joint => ({ kind: 'revolute', bodyA, bodyB, from, to, stiff: false });
const ball = (bodyA: number, bodyB: number, at: Vector3): Joint => ({ kind: 'ball', bodyA, bodyB, from: at, to: at.clone(), stiff: false });
const onTiles: Joint = { kind: 'slide', bodyA: 0, bodyB: 3, from: new Vector3(-60, -72, -150), to: new Vector3(60, -72, -150), stiff: false };
const steering = [revolute(0, 1, upright(-110, -190)), revolute(0, 2, upright(110, -190)), revolute(1, 3, upright(-110, -150)), revolute(2, 3, upright(110, -150)), onTiles];

function mechanism(joints: Joint[], count: number): Mechanism {
  return {
    roles: Array.from({ length: count }, () => 'structure'),
    bodyOf: Array.from({ length: count }, (_, i) => i),
    bodies: Array.from({ length: count }, (_, i) => ({ name: i === 0 ? 'frame' : `body ${i}`, parts: [i] })),
    joints,
    connections: [],
    treads: [],
    gears: [],
    meshes: [],
    loose: [],
    couplings: [],
    loops: [],
    strings: [],
  };
}

// How far a steering arm turns, tried in ten steps.
function steer(joints: Joint[], count: number): number {
  const kin = new Kinematics(mechanism(joints, count));
  let turned = 0;
  for (let i = 0; i < 10; i++) turned += kin.turnJoint(0, 0.025);
  return turned;
}

describe('a rack pinned to both steering arms', () => {
  it('jams a step on, if it slides straight on the tiles too: the arms swing it round a curve', () => {
    expect(steer(steering, 4)).toBeLessThan(0.05);
  });

  it("doesn't slide on them: its arms set its path, and it steers", () => {
    const joints = withoutSlidesOnCouplers(steering);
    expect(joints).not.toContain(onTiles);
    expect(joints).toHaveLength(4);
    expect(steer(joints, 4)).toBeCloseTo(0.25, 6);
  });
});

describe('a rack on tie rods', () => {
  it('keeps its slide: the tie rods, on balls, leave it free to wander but for that', () => {
    // Bodies: 1 and 2 the arms, 3 the rack, 4 and 5 the tie rods.
    const joints = [revolute(0, 1, upright(-110, -190)), revolute(0, 2, upright(110, -190)), ball(1, 4, new Vector3(-110, -85, -150)), ball(4, 3, new Vector3(-60, -85, -150)), ball(2, 5, new Vector3(110, -85, -150)), ball(5, 3, new Vector3(60, -85, -150)), onTiles];
    expect(withoutSlidesOnCouplers(joints)).toContain(onTiles);
  });
});

describe('a frame pinned to two arms that turn on one body', () => {
  it('keeps its slides: the frame is no coupler, whatever hangs on it', () => {
    // An upright (3) on two arms (1 and 2) hinged on the frame, and a piston (4) sliding in it.
    const piston: Joint = { kind: 'slide', bodyA: 0, bodyB: 4, from: new Vector3(0, -40, 0), to: new Vector3(0, -20, 0), stiff: false };
    const joints = [revolute(0, 1, upright(-20, 0)), revolute(0, 2, upright(-20, 40)), revolute(1, 3, upright(-60, 0)), revolute(2, 3, upright(-60, 40)), piston];
    expect(withoutSlidesOnCouplers(joints)).toContain(piston);
  });
});
