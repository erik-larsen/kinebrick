import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ConnectionTable } from '../src/connections.ts';
import { Kinematics } from '../src/kinematics.ts';
import { parseModel } from '../src/ldr.ts';
import { inferMechanism } from '../src/mechanism.ts';

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
