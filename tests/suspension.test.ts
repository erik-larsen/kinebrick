import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { Kinematics } from '../src/kinematics.ts';
import { Joint, Mechanism, Tread } from '../src/mechanism.ts';

// A car whose front wheels each hang on a swing arm, pivoted on the frame along the car's
// length and level as built, as the 42000 Grand Prix Racer's wishbones are. Its rear wheels
// turn on the frame. One part per body; tyres of radius 30, the ground at y = 0 (LDraw's y
// points down).
function swingArmCar(): { mech: Mechanism; arm: number; armJoint: number } {
  const revolute = (bodyA: number, bodyB: number, from: Vector3, to: Vector3): Joint => ({ kind: 'revolute', bodyA, bodyB, from, to, stiff: false });
  const across = (x: number, z: number) => [new Vector3(x - 10, -30, z), new Vector3(x + 10, -30, z)] as const;
  const along = (x: number) => [new Vector3(x, -30, 90), new Vector3(x, -30, 110)] as const;
  // Bodies: 0 frame, 1 and 2 rear wheels, 3 and 5 the arms, 4 and 6 the front wheels.
  const joints: Joint[] = [revolute(0, 1, ...across(-80, -100)), revolute(0, 2, ...across(80, -100)), revolute(0, 3, ...along(-20)), revolute(3, 4, ...across(-80, 100)), revolute(0, 5, ...along(20)), revolute(5, 6, ...across(80, 100))];
  const tread = (body: number, x: number, z: number): Tread => ({ part: body, body, center: new Vector3(x, -30, z), axis: new Vector3(1, 0, 0), radius: 30 });
  const treads = [tread(1, -80, -100), tread(2, 80, -100), tread(4, -80, 100), tread(6, 80, 100)];
  const count = 7;
  const mech: Mechanism = {
    roles: Array.from({ length: count }, (_, i) => (treads.some((t) => t.body === i) ? 'tyre' : 'structure')),
    bodyOf: Array.from({ length: count }, (_, i) => i),
    bodies: Array.from({ length: count }, (_, i) => ({ name: i === 0 ? 'frame' : `body ${i}`, parts: [i] })),
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
  };
  return { mech, arm: 3, armJoint: 2 };
}

describe('a car on swing arms', () => {
  it('can be raised and lowered on one of them, all its tyres staying on the ground, though its tyres scrub sideways as the arm swings its wheel out and in', () => {
    const { mech, arm, armJoint } = swingArmCar();
    for (const way of [1, -1]) {
      const kin = new Kinematics(mech);
      kin.holdWhatTheDragDoesntNeed(arm, () => kin.jointMotion(armJoint) !== null, armJoint);
      let turned = 0;
      for (let i = 0; i < 10; i++) turned += kin.turnJoint(armJoint, way * 0.025);
      kin.letGoAfterDrag();
      // It used to stop after a step: as built, the arm swings its wheel straight up and down,
      // but a step on it swings it out or in a little too, and the tyre has to scrub.
      expect(turned).toBeCloseTo(way * 0.25, 6);
      // The frame rises or sinks at the front, and the tyres stay on the ground: each one's
      // lowest point (a wheel leaning on its arm has its hub a little lower).
      expect(Math.abs(new Vector3(0, -30, 100).applyMatrix4(kin.poses[0]).y + 30)).toBeGreaterThan(10);
      for (const t of mech.treads) {
        const center = t.center.clone().applyMatrix4(kin.poses[t.body]);
        const axis = t.axis.clone().transformDirection(kin.poses[t.body]);
        const down = new Vector3(0, 1, 0).addScaledVector(axis, -axis.y).normalize();
        expect(center.addScaledVector(down, t.radius).y).toBeCloseTo(0, 1);
      }
    }
  });

  it("can't be slid across, though, nor lifted: with its arms held, it only rolls", () => {
    const { mech } = swingArmCar();
    const kin = new Kinematics(mech);
    kin.toggleFreeze(3);
    kin.toggleFreeze(5);
    const motions = kin.freeMotions();
    expect(motions).toHaveLength(1);
    // Rolling along its length: the frame goes along z, no other way.
    const frame = kin.pointVelocity(motions[0], 0, new Vector3());
    expect(Math.hypot(frame.x, frame.y)).toBeLessThan(1e-6 * Math.abs(frame.z));
  });
});
