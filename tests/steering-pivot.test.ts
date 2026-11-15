import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { Kinematics } from '../src/kinematics.ts';
import type { Joint, Mechanism } from '../src/mechanism.ts';

// A frame on three tyres, and a front wheel that steers on an upright kingpin: the frame is body
// 0, the knuckle body 1 on the kingpin, the wheel body 2 on its axle in the knuckle. LDraw's y
// points down; the tyres stand on the ground at y = 30. The kingpin is `trail` LDU ahead of the
// wheel's middle, along z, the way the wheel rolls.
function car(trail: number): Mechanism {
  const revolute = (a: number, b: number, from: Vector3, to: Vector3): Joint => ({ kind: 'revolute', bodyA: a, bodyB: b, from, to, stiff: false });
  const joints: Joint[] = [
    revolute(0, 1, new Vector3(40, -10, trail), new Vector3(40, 10, trail)),
    revolute(1, 2, new Vector3(50, 0, 0), new Vector3(60, 0, 0)),
    revolute(0, 3, new Vector3(-50, 0, 0), new Vector3(-60, 0, 0)),
    revolute(0, 4, new Vector3(0, 0, 150), new Vector3(10, 0, 150)),
  ];
  const tread = (body: number, center: Vector3) => ({ part: body, body, center, axis: new Vector3(1, 0, 0), radius: 30 });
  const bodies = Array.from({ length: 5 }, (_, i) => ({ name: `body ${i}`, parts: [i] }));
  return {
    roles: bodies.map(() => 'structure'),
    bodyOf: bodies.map((_, i) => i),
    bodies,
    joints,
    connections: [],
    treads: [tread(2, new Vector3(60, 0, 0)), tread(3, new Vector3(-60, 0, 0)), tread(4, new Vector3(5, 0, 150))],
    gears: [],
    meshes: [],
    loose: [],
    couplings: [],
    loops: [],
    strings: [],
    screws: [],
    rests: [],
  };
}

describe('a steered tyre pivots on the ground about its kingpin', () => {
  it('within a stud of trail, pivots about the kingpin; further off, not', () => {
    for (const [trail, pivots] of [[5, true], [25, false]] as [number, boolean][]) {
      const kin = new Kinematics(car(trail));
      expect(kin.contactTreads).toHaveLength(3);
      const p = kin.contactPoint(0)!;
      const pivot = kin.steeringPivot(0, p, new Vector3(0, 0, 1));
      expect(pivot !== null).toBe(pivots);
      if (pivot) expect(pivot.joint).toBe(0);
    }
  });
  it('a wheel that only turns on its axle has no pivot', () => {
    const kin = new Kinematics(car(5));
    expect(kin.steeringPivot(1, kin.contactPoint(1)!, new Vector3(0, 0, 1))).toBeNull();
  });
});
