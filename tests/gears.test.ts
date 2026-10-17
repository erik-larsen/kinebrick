import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ConnectionTable } from '../src/connections.ts';
import { Kinematics } from '../src/kinematics.ts';
import { parseLdr, PlacedPart } from '../src/ldr.ts';
import { inferMechanism, Mechanism } from '../src/mechanism.ts';

const table: ConnectionTable = JSON.parse(readFileSync('data/connections.json', 'utf-8'));
const roles: Record<string, string> = JSON.parse(readFileSync('data/roles.json', 'utf-8'));
const TURN = 2 * Math.PI;

function load(file: string) {
  const parts = parseLdr(readFileSync(file, 'utf-8'));
  const mech = inferMechanism(parts, table, roles);
  return { parts, mech, kin: new Kinematics(mech) };
}

// The joint that the body holding the n-th copy of `partName` turns on.
function jointOf(parts: PlacedPart[], mech: Mechanism, partName: string, n = 0): number {
  const part = parts.map((p, i) => (p.name === partName ? i : -1)).filter((i) => i >= 0)[n];
  const body = mech.bodyOf[part];
  return mech.joints.findIndex((j) => j.bodyA === body || j.bodyB === body);
}

describe('gear train: 8 tooth, 24 tooth, 40 tooth', () => {
  const { parts, mech, kin } = load('models/gear-train.ldr');
  const small = jointOf(parts, mech, '3647.dat');
  const middle = jointOf(parts, mech, '3648.dat');
  const large = jointOf(parts, mech, '3649.dat');

  it('finds three gear bodies, three axle joints and two meshes', () => {
    expect(mech.bodies).toHaveLength(4); // frame + three axle-and-gear bodies
    expect(mech.joints).toHaveLength(3);
    expect(mech.meshes).toHaveLength(2);
  });

  it('can move one way only, since the gears lock the axles together', () => {
    expect(kin.freeMotions()).toHaveLength(1);
  });

  it('turns at the right ratios: 24 tooth at -1/3, 40 tooth at +1/5', () => {
    kin.reset();
    kin.turnJoint(small, TURN);
    expect(kin.jointAngles[small]).toBeCloseTo(TURN, 6);
    expect(kin.jointAngles[middle]).toBeCloseTo(-TURN / 3, 6);
    expect(kin.jointAngles[large]).toBeCloseTo(TURN / 5, 6);
  });

  it('drives backwards too: turning the 40 tooth gear turns the 8 tooth gear 5 times as far', () => {
    kin.reset();
    kin.turnJoint(large, TURN / 5);
    expect(kin.jointAngles[small]).toBeCloseTo(TURN, 6);
  });
});

describe('geared car', () => {
  const { parts, mech, kin } = load('models/geared-car.ldr');
  const rearAxle = jointOf(parts, mech, '3647.dat', 0); // the gear on the rear wheel axle
  const driven = jointOf(parts, mech, '3647.dat', 1); // the gear on the extra axle

  it('still rolls one way only, with the extra axle driven by the gears', () => {
    expect(mech.meshes).toHaveLength(1);
    expect(kin.freeMotions()).toHaveLength(1);
  });

  it('spins the extra axle the other way as the car rolls (8 tooth to 8 tooth)', () => {
    kin.reset();
    kin.turnJoint(rearAxle, TURN);
    expect(kin.jointAngles[driven]).toBeCloseTo(-TURN, 6);
  });
});

describe('simple car, turning a wheel', () => {
  it('rolls the car one tyre circumference per turn', () => {
    const { kin } = load('models/simple-car.ldr');
    kin.turnJoint(0, TURN);
    const moved = kin.poses[0].elements[12]; // x translation of the frame
    expect(Math.abs(moved)).toBeCloseTo(TURN * 31.002, 3);
  });
});
