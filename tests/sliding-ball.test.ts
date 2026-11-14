import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { Kinematics } from '../src/kinematics.ts';
import { Coupling, Joint, Mechanism } from '../src/mechanism.ts';

// A constant velocity ball running along a portal hub's bore (92909's, see Coupling.slidesAlong):
// the shaft (body 1) turns in the frame on the z axis; the hub (body 3) turns on a carrier
// (body 2) that slides along z in the frame, as a wheel's upright rises on its suspension; the
// ball at the shaft's end sits in the hub's bore at the origin.
const along = (z: number) => [new Vector3(0, 0, z + 5), new Vector3(0, 0, z - 5)] as const;
const joint = (kind: 'revolute' | 'slide', bodyA: number, bodyB: number, [from, to]: readonly [Vector3, Vector3]): Joint => ({ kind, bodyA, bodyB, from, to, stiff: false, ...(kind === 'slide' ? { range: [-40, 40] as [number, number] } : {}) });

function mechanism(slides: boolean): Mechanism {
  const z = new Vector3(0, 0, 1);
  const ball: Coupling = { bodyA: 1, bodyB: 3, center: new Vector3(), axisA: z, axisB: z, atA: new Vector3(0, 0, -50), atB: new Vector3(0, 0, 20), turningOnly: false, ...(slides ? { slidesAlong: z } : {}) };
  return {
    roles: ['structure', 'structure', 'structure', 'structure'],
    bodyOf: [0, 1, 2, 3],
    bodies: [0, 1, 2, 3].map((i) => ({ name: i === 0 ? 'frame' : `body ${i}`, parts: [i] })),
    joints: [joint('revolute', 0, 1, along(-50)), joint('slide', 0, 2, along(20)), joint('revolute', 2, 3, along(20))],
    connections: [],
    treads: [],
    gears: [],
    meshes: [],
    loose: [],
    couplings: [ball],
    loops: [],
    strings: [],
    screws: [],
    rests: [],
  };
}

// The free motions in which the carrier moves along the bore with the shaft still: how far along
// z the carrier goes, for the largest such motion (0 if there is none).
function slideAlongBore(kin: Kinematics): number {
  let best = 0;
  for (const m of kin.freeMotions()) {
    const shaft = Math.hypot(m[6], m[7], m[8], m[9], m[10], m[11]);
    if (shaft > 1e-6) continue;
    const carrier = m.slice(12, 18);
    best = Math.max(best, Math.abs(carrier[5]) / Math.max(1e-12, Math.hypot(...carrier)));
  }
  return best;
}

describe('a ball sliding along its socket\'s bore', () => {
  it('lets the hub slide along the bore with the shaft still, and still turns the hub 1 to 1', () => {
    const kin = new Kinematics(mechanism(true));
    expect(slideAlongBore(kin)).toBeCloseTo(1, 6);
    let turned = 0;
    for (let i = 0; i < 20; i++) turned += kin.turnJoint(0, Math.PI / 20);
    expect(turned).toBeCloseTo(Math.PI, 6);
    expect(Math.abs(kin.jointAngles[2])).toBeCloseTo(Math.PI, 4);
    // The shaft's end, where the ball is, stays on the axis.
    const end = new Vector3(0, 0, 0).applyMatrix4(kin.poses[1]);
    expect(Math.hypot(end.x, end.y)).toBeLessThan(1e-6);
  });

  it('without the mark, holds the ends together along the bore too, so the hub cannot slide', () => {
    expect(slideAlongBore(new Kinematics(mechanism(false)))).toBeLessThan(1e-6);
  });
});
