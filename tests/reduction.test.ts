import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { Kinematics } from '../src/kinematics.ts';
import { Coupling, Joint, Mechanism } from '../src/mechanism.ts';

// A planetary wheel hub as Kinebrick reads it (46490c01's pieces): the bearing body is the frame
// (body 0), the driving shaft (body 1) turns in it on the z axis at the middle, and the wheel
// hub (body 2) turns in it on the same axis, 30 LDU along; the reduction ties the two turnings.
const onAxis = (z: number) => [new Vector3(0, 0, z + 3), new Vector3(0, 0, z - 3)] as const;
const revolute = (bodyA: number, bodyB: number, [from, to]: readonly [Vector3, Vector3]): Joint => ({ kind: 'revolute', bodyA, bodyB, from, to, stiff: false });

function hub(ratio?: number): Mechanism {
  const axis = new Vector3(0, 0, 1);
  const reduction: Coupling = { bodyA: 1, bodyB: 2, center: new Vector3(0, 0, -15), axisA: axis, axisB: axis, atA: new Vector3(0, 0, 0), atB: new Vector3(0, 0, -30), turningOnly: true, ...(ratio ? { ratio } : {}) };
  return {
    roles: ['structure', 'structure', 'structure'],
    bodyOf: [0, 1, 2],
    bodies: [0, 1, 2].map((i) => ({ name: i === 0 ? 'frame' : `body ${i}`, parts: [i] })),
    joints: [revolute(0, 1, onAxis(0)), revolute(0, 2, onAxis(-30))],
    connections: [],
    treads: [],
    gears: [],
    meshes: [],
    loose: [],
    couplings: [reduction],
    loops: [],
    strings: [],
    screws: [],
    rests: [],
  };
}

// How far the hub turns when the shaft is turned one turn against the body, in steps.
function hubTurns(ratio?: number): number {
  const kin = new Kinematics(hub(ratio));
  for (let i = 0; i < 40; i++) kin.turnJoint(0, (2 * Math.PI) / 40);
  return kin.jointAngles[1];
}

describe("a planetary wheel hub's reduction", () => {
  it('turns the hub one turn in 5.4 of the shaft, the same way round', () => {
    expect(hubTurns(5.4)).toBeCloseTo((2 * Math.PI) / 5.4, 4);
  });

  it('without a ratio, ties the two turnings one to one, as every coupling before did', () => {
    expect(hubTurns()).toBeCloseTo(2 * Math.PI, 4);
  });
});
