import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ConnectionTable } from '../src/connections.ts';
import { Kinematics } from '../src/kinematics.ts';
import { parseLdr } from '../src/ldr.ts';
import { inferMechanism } from '../src/mechanism.ts';

const table: ConnectionTable = JSON.parse(readFileSync('data/connections.json', 'utf-8'));
const roles: Record<string, string> = JSON.parse(readFileSync('data/roles.json', 'utf-8'));
const pieces: Record<string, string[]> = JSON.parse(readFileSync('packed/pieces.json', 'utf-8'));
const TURN = 2 * Math.PI;
const LEAD = 100 / 26.8; // the large actuator's piston, per turn of its input

describe('linear actuator: a large linear actuator raising an arm', () => {
  const parts = parseLdr(readFileSync('models/linear-actuator.ldr', 'utf-8'));
  const mech = inferMechanism(parts, table, roles);
  const kin = new Kinematics(mech);
  const bodyOf = (name: string, color?: number) => mech.bodyOf[parts.findIndex((p) => p.name === name && (color === undefined || p.color === color))];
  const input = bodyOf('47157.dat');
  const arm = bodyOf('32523.dat', 4);
  const inputJoint = kin.parentLink(input)!.joint;
  const armJoint = kin.parentLink(arm)!.joint;
  const slide = mech.joints.findIndex((j) => j.kind === 'slide');

  it('turns its input in its body and slides its piston in it, as far as its stroke allows, the screw between them leaving one way to move', () => {
    expect(mech.loose).toEqual([]);
    expect(kin.parentLink(input)!.parent).toBe(bodyOf('62271c01.dat'));
    expect(input).toBe(bodyOf('3648.dat')); // the gear, on its axle in the input
    expect(mech.joints[slide]).toMatchObject({ bodyA: bodyOf('62271c01.dat'), bodyB: bodyOf('62274c01.dat') });
    // Built with its head 215.36 LDU out, between 170 and 270.
    expect(mech.joints[slide].range![0]).toBeCloseTo(-45.36, 2);
    expect(mech.joints[slide].range![1]).toBeCloseTo(54.64, 2);
    expect(mech.screws).toMatchObject([{ input, piston: bodyOf('62274c01.dat') }]);
    expect(kin.freeMotions()).toHaveLength(1);
  });

  it('a turn of the input slides the piston out one lead, swinging the arm up, and back again', () => {
    kin.reset();
    kin.turnJoint(inputJoint, TURN);
    expect(kin.slideOffset(slide)).toBeCloseTo(LEAD, 2);
    expect(Math.abs(kin.jointAngles[armJoint])).toBeGreaterThan(0.1);
    kin.turnJoint(inputJoint, -TURN);
    expect(kin.slideOffset(slide)).toBeCloseTo(0, 2);
  });

  it("stops at the end of its stroke going out, and coming in where the arm comes into line between the frame's pins (a dead point)", () => {
    kin.reset();
    kin.turnJoint(inputJoint, 20 * TURN, () => kin.atLimit() === null);
    expect(kin.slideOffset(slide)).toBeCloseTo(54.64, 0);
    // The pins 280 LDU apart less the arm's 40: the base's pin is 20 LDU off the axis and 10
    // behind the body's middle, the head's on the axis 20 beyond the piston's.
    kin.reset();
    kin.turnJoint(inputJoint, -20 * TURN, () => kin.atLimit() === null);
    expect(kin.slideOffset(slide)).toBeCloseTo(Math.sqrt(240 ** 2 - 20 ** 2) - 30 - 215.358984, 0);
  });

  it("can be worked from its input, but not from the arm: its piston can't drive its screw", () => {
    kin.reset();
    expect(kin.holdWhatTheDragDoesntNeed(input, () => kin.jointMotion(inputJoint) !== null, inputJoint)).toBe(false);
    expect(kin.jointMotion(inputJoint)).not.toBeNull();
    kin.letGoAfterDrag();
    expect(kin.holdWhatTheDragDoesntNeed(arm, () => kin.jointMotion(armJoint) !== null, armJoint)).toBe(true);
    expect(kin.jointMotion(armJoint)).toBeNull();
    expect(kin.lockedBy(arm)).toBe('actuator');
    kin.letGoAfterDrag();
  });

  it('is read from the LDraw library\'s shortcuts as its three parts, under its old names too', () => {
    const read = (name: string) => parseLdr(`1 16 0 0 0 1 0 0 0 1 0 0 0 1 ${name}`, () => false, (n) => pieces[n] ?? null).map((p) => p.name);
    expect(read('61927-f1.dat')).toEqual(['47157.dat', '62271c01.dat', '62274c01.dat']);
    expect(read('61927c01.dat')).toEqual(['47157.dat', '62271c01.dat', '62274c01.dat']);
    expect(read('92693c01-f2.dat')).toEqual(['92693c01.dat', '92695.dat', '92696.dat']);
    expect(read('40918-f1.dat')).toEqual(['47157.dat', 'u9487c01.dat', '62274c02.dat']);
  });
});
