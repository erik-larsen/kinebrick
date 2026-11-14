import { readFileSync } from 'node:fs';
import { Quaternion } from 'three';
import { describe, expect, it } from 'vitest';
import { ConnectionTable } from '../src/connections.ts';
import { Kinematics } from '../src/kinematics.ts';
import { parseModel } from '../src/ldr.ts';
import { inferMechanism } from '../src/mechanism.ts';
import { load } from './sets/load.ts';

const table: ConnectionTable = JSON.parse(readFileSync('data/connections.json', 'utf-8'));
const roles: Record<string, string> = JSON.parse(readFileSync('data/roles.json', 'utf-8'));

// A model lifted off the ground, as held in the hand (see Options.lifted in kinematics.ts): the
// 8865 Test Car, its engine held (the pinion's shaft, p175, frozen). Turning one rear wheel
// (p900) turns the other (p904) the opposite way through the differential, and the car stays
// where it is, as a car held in the hand does.
describe('a model lifted off the ground', () => {
  const packed = JSON.parse(readFileSync('packed/models.json', 'utf-8'))['8865-Test Car'];
  const { parts, paths } = parseModel(readFileSync('models/8865-Test Car.mpd', 'utf-8'), (n) => packed.primitives.includes(n), (n) => packed.pieces[n] ?? null);
  const mech = inferMechanism(parts, table, roles, paths);

  it('has no ground and keeps its frame still', () => {
    const kin = new Kinematics(mech, { lifted: true });
    expect(kin.groundY).toBeNull();
    expect(kin.contactTreads).toHaveLength(0);
    expect(kin.fixedBody).toBe(0);
    expect(new Kinematics(mech).groundY).not.toBeNull();
  });

  it('with the engine held, turns the other rear wheel the opposite way, and the car stays put', () => {
    const kin = new Kinematics(mech, { lifted: true });
    const frame = kin.poses[0].clone();
    kin.toggleFreeze(mech.bodyOf[175]);
    const wheel = (part: number) => kin.parentLink(mech.bodyOf[part])!.joint;
    expect(kin.turnJoint(wheel(900), 0.8)).toBeCloseTo(0.8, 6);
    expect(kin.jointAngles[wheel(904)]).toBeCloseTo(-0.8, 3);
    expect(kin.poses[0].equals(frame)).toBe(true);
  });
});

// A frozen part is held against what its shaft turns in, not on its own joint (see holds in
// constraints/holds.ts). The Ackermann car's differential housing turns on a rear half shaft in
// the tree of joints; frozen, it's held against the frame, and the differential still works.
describe('a frozen differential housing', () => {
  const { mech } = load('models/ackermann-car.ldr');
  const housing = mech.bodies.findIndex((b) => b.parts.some((p) => mech.roles[p] === 'differential'));
  // The rear wheels: the two tyres furthest back (front is +x).
  const [left, right] = [...mech.treads].sort((a, b) => a.center.x - b.center.x).slice(0, 2).map((t) => t.body);
  // How far a body has turned against the frame about the rear axle's line (z), in radians.
  const turn = (kin: Kinematics, body: number) => {
    const q = new Quaternion().setFromRotationMatrix(kin.poses[0].clone().invert().multiply(kin.poses[body]));
    return 2 * Math.atan2(q.z, q.w);
  };
  const work = (kin: Kinematics) => {
    kin.toggleFreeze(housing);
    const joint = kin.parentLink(left)!.joint;
    kin.holdWhatTheDragDoesntNeed(left, () => kin.jointMotion(joint) !== null, joint);
    const turned = kin.turnJoint(joint, 0.5, () => kin.atLimit() === null);
    kin.letGoAfterDrag();
    return turned;
  };

  it('turns on a rear half shaft in the tree, not on the frame', () => {
    expect(new Kinematics(mech).parentLink(housing)!.parent).not.toBe(0);
  });

  it('lifted: stays still, and one rear wheel turns the other back as far', () => {
    const kin = new Kinematics(mech, { lifted: true });
    expect(work(kin)).toBeCloseTo(0.5, 6);
    expect(turn(kin, housing)).toBeCloseTo(0, 6);
    expect(Math.abs(turn(kin, left))).toBeCloseTo(0.5, 3);
    expect(turn(kin, right)).toBeCloseTo(-turn(kin, left), 3);
  });

  it('on the ground: the car would have to pivot on the spot, so nothing moves', () => {
    expect(work(new Kinematics(mech))).toBeCloseTo(0, 6);
  });
});
