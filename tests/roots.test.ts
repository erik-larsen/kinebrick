import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { Kinematics } from '../src/kinematics.ts';
import type { Joint, Mechanism } from '../src/mechanism.ts';
import { pushStep } from '../src/push.ts';

// A group of bodies the frame's tree of turning joints doesn't reach is a tree of its own, and
// its root is chosen by what holds the group (see buildTree), not by the bodies' numbers. As in
// the 8258 Crane Truck's outrigger: a beam (body 1, three parts) hangs by a hinge on a bent beam
// (body 2, one part) that slides along x in the frame (body 0).
const joint = (kind: Joint['kind'], bodyA: number, bodyB: number, from: Vector3, to: Vector3): Joint => ({ kind, bodyA, bodyB, from, to, stiff: false });
const hinge = (a: number, b: number) => joint('revolute', a, b, new Vector3(40, 0, 0), new Vector3(40, 0, 20));
const slide = (a: number, b: number) => joint('slide', a, b, new Vector3(0, 0, 0), new Vector3(1, 0, 0));
const ball = (a: number, b: number) => joint('ball', a, b, new Vector3(0, 0, 0), new Vector3(0, 0, 0));

function model(sizes: number[], joints: Joint[]): Mechanism {
  let next = 0;
  const bodies = sizes.map((n, i) => ({ name: i === 0 ? 'frame' : `body ${i}`, parts: Array.from({ length: n }, () => next++) }));
  return {
    roles: Array(next).fill('structure'),
    bodyOf: bodies.flatMap((b, i) => b.parts.map(() => i)),
    bodies,
    joints,
    connections: [],
    treads: [],
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

describe('the root of a group the frame reaches only by a slide or a ball', () => {
  it('is the body that slides on the frame, not the lowest-numbered one', () => {
    const kin = new Kinematics(model([5, 3, 1], [hinge(1, 2), slide(0, 2)]));
    expect(kin.parentLink(2)).toBeNull();
    expect(kin.parentLink(1)!.parent).toBe(2);
  });

  it('of several bodies that slide on the frame, is the one with the most parts', () => {
    const kin = new Kinematics(model([5, 1, 3], [hinge(1, 2), slide(0, 1), slide(0, 2)]));
    expect(kin.parentLink(2)).toBeNull();
    expect(kin.parentLink(1)!.parent).toBe(2);
  });

  it('with no slide, is the body that hangs by a ball on the frame', () => {
    const kin = new Kinematics(model([5, 3, 1], [hinge(1, 2), ball(0, 2)]));
    expect(kin.parentLink(2)).toBeNull();
    expect(kin.parentLink(1)!.parent).toBe(2);
  });

  it('held by nothing, is its body with no gear: a knob gear turns on its pin', () => {
    const mech = model([5, 1, 3], [hinge(1, 2)]);
    mech.gears = [{ body: 2 } as Mechanism['gears'][number]];
    const kin = new Kinematics(mech);
    expect(kin.parentLink(1)).toBeNull();
    expect(kin.parentLink(2)!.parent).toBe(1);
  });

  it('held by nothing, is its body with the most parts', () => {
    const kin = new Kinematics(model([5, 1, 3], [hinge(1, 2)]));
    expect(kin.parentLink(2)).toBeNull();
    expect(kin.parentLink(1)!.parent).toBe(2);
  });

  it('pushed along the slide, slides with what hangs on it, and the hinge does not turn', () => {
    const kin = new Kinematics(model([5, 3, 1], [hinge(1, 2), slide(0, 2)]));
    kin.fixedBody = 0;
    const grab = new Vector3(0, 0, 0);
    for (let i = 0; i < 5; i++) expect(pushStep(kin, 2, grab, new Vector3(1, 0, 0), 1)).toBe('moved');
    const moved = (b: number) => new Vector3().setFromMatrixPosition(kin.poses[b]);
    expect(moved(2).x).toBeCloseTo(5, 6);
    expect(moved(1).x).toBeCloseTo(5, 6);
    expect(kin.jointAngles[0]).toBeCloseTo(0, 6);
  });
});
