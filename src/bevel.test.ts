import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ConnectionTable } from './connections.ts';
import { Kinematics } from './kinematics.ts';
import { parseLdr, PlacedPart } from './ldr.ts';
import { inferMechanism, Mechanism } from './mechanism.ts';

const table: ConnectionTable = JSON.parse(readFileSync('data/connections.json', 'utf-8'));
const roles: Record<string, string> = JSON.parse(readFileSync('data/roles.json', 'utf-8'));

function load(file: string) {
  const parts = parseLdr(readFileSync(file, 'utf-8'));
  const mech = inferMechanism(parts, table, roles);
  return { parts, mech, kin: new Kinematics(mech) };
}

// The body holding the n-th copy of a part.
function bodyOf(parts: PlacedPart[], mech: Mechanism, partName: string, n = 0): number {
  const part = parts.map((p, i) => (p.name === partName ? i : -1)).filter((i) => i >= 0)[n];
  return mech.bodyOf[part];
}

describe('right-angle drive: two 12 tooth double bevel gears', () => {
  const { parts, mech, kin } = load('models/right-angle.ldr');

  it('finds one bevel mesh between the horizontal and vertical gears', () => {
    expect(mech.meshes).toHaveLength(1);
    expect(mech.meshes[0].kind).toBe('bevel');
    expect(kin.freeMotions()).toHaveLength(1);
  });

  it('turns the vertical gear as far as the horizontal one (12 teeth to 12)', () => {
    const horizontal = kin.parentLink(bodyOf(parts, mech, '3705.dat'))!.joint;
    const vertical = kin.parentLink(bodyOf(parts, mech, '3704.dat'))!.joint;
    kin.turnJoint(horizontal, 1);
    expect(Math.abs(kin.jointAngles[vertical])).toBeCloseTo(1, 6);
  });
});

describe('differential', () => {
  const { parts, mech, kin } = load('models/differential.ldr');
  const housing = bodyOf(parts, mech, '6573.dat');
  const left = bodyOf(parts, mech, '32073.dat', 0);
  const right = bodyOf(parts, mech, '32073.dat', 1);
  const input = bodyOf(parts, mech, '3707.dat');
  const planet = bodyOf(parts, mech, '6589.dat', 2);

  // How far a body has turned about the z axis (the outputs' and housing's axis), relative to the frame.
  const turnAboutZ = (body: number) => Math.atan2(kin.poses[body].elements[1], kin.poses[body].elements[0]);
  const jointOf = (body: number) => kin.parentLink(body)!.joint;

  it('has a housing, two outputs, a planet gear and an input, and two free motions', () => {
    expect(new Set([housing, left, right, input, planet]).size).toBe(5);
    expect(mech.meshes.map((m) => m.kind).sort()).toEqual(['bevel', 'bevel', 'spur']);
    expect(kin.freeMotions()).toHaveLength(2);
  });

  it('turning the input turns the housing a third as far, and both outputs with it', () => {
    kin.reset();
    kin.letGoOfAll();
    kin.turnJoint(jointOf(input), 1.5);
    const h = turnAboutZ(housing);
    expect(Math.abs(h)).toBeCloseTo(0.5, 6); // 8 teeth driving 24
    expect(turnAboutZ(left)).toBeCloseTo(h, 6);
    expect(turnAboutZ(right)).toBeCloseTo(h, 6);
  });

  it('with the input held, turning one output turns the other the opposite way', () => {
    kin.reset();
    kin.letGoOfAll();
    kin.toggleHold(input);
    kin.turnJoint(jointOf(left), 0.8);
    const l = turnAboutZ(left);
    expect(Math.abs(l)).toBeCloseTo(0.8, 6);
    expect(turnAboutZ(right)).toBeCloseTo(-l, 6);
    expect(turnAboutZ(housing)).toBeCloseTo(0, 6);
  });

  it('with one output held, turning the other turns the housing half as far', () => {
    kin.reset();
    kin.letGoOfAll();
    kin.toggleHold(right);
    kin.turnJoint(jointOf(left), 0.8);
    expect(turnAboutZ(right)).toBeCloseTo(0, 6);
    expect(turnAboutZ(housing)).toBeCloseTo(turnAboutZ(left) / 2, 6);
    expect(Math.abs(turnAboutZ(housing))).toBeCloseTo(0.4, 6);
  });

  it('jams when the input and one output are both held', () => {
    kin.reset();
    kin.letGoOfAll();
    kin.toggleHold(input);
    kin.toggleHold(right);
    expect(kin.freeMotions()).toHaveLength(0);
  });
});
