import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { libraryConnections } from '../src/connections.ts';
import { Kinematics } from '../src/kinematics.ts';
import { parseLdr } from '../src/ldr.ts';
import { inferMechanism } from '../src/mechanism.ts';

const library = libraryConnections(JSON.parse(readFileSync('data/library-connections.json', 'utf-8')));
const roles: Record<string, string> = JSON.parse(readFileSync('data/roles.json', 'utf-8'));

// A motor, and what's on its output: whether that turns in the motor, rather than being fixed to it.
function onOutput(lines: string) {
  const parts = parseLdr(lines);
  const mech = inferMechanism(parts, library, roles);
  const [motor, ...rest] = parts.map((_, i) => mech.bodyOf[i]);
  const joint = mech.joints.find((j) => j.kind === 'revolute' && [j.bodyA, j.bodyB].includes(motor) && [j.bodyA, j.bodyB].includes(rest[0]));
  return { mech, motor, rest, joint };
}

describe('motors: what is fixed on the output turns in the motor', () => {
  it('a Power Functions Medium Motor: an axle in its output, a gear on the axle, turn together in it', () => {
    const { mech, motor, rest, joint } = onOutput('1 71 0 0 0 1 0 0 0 1 0 0 0 1 58120.dat\n1 7 0 0 -40 0 0 -1 0 1 0 1 0 0 3706.dat\n1 7 0 0 -80 1 0 0 0 1 0 0 0 1 3648.dat');
    const [axle, gear] = rest;
    expect(mech.loose).toEqual([]);
    expect(axle).not.toBe(motor);
    expect(gear).toBe(axle);
    expect(joint).toBeDefined();
    // Stiffly: a drag holds it, the motor's gearbox holding it, unless nothing else can move.
    expect(joint!.stiff).toBe(true);
    expect(joint!.motor).toBe(true);
  });

  it('a Control+ L Motor, as the OMR embeds it under its set\'s name, read as the library\'s', () => {
    const { motor, rest, joint } = onOutput('1 71 0 0 0 1 0 0 0 1 0 0 0 1 42100 - 22169.dat\n1 7 0 0 -50 0 0 -1 0 1 0 1 0 0 3706.dat');
    expect(rest[0]).not.toBe(motor);
    expect(joint).toBeDefined();
  });

  it("a 9V Mini-Motor: a gear on its axle stub turns on it, and a turn of the gear doesn't turn the motor", () => {
    const { mech, motor, rest, joint } = onOutput('1 71 0 0 0 1 0 0 0 1 0 0 0 1 71427.dat\n1 7 0 42 -50 1 0 0 0 1 0 0 0 1 3648.dat');
    expect(rest[0]).not.toBe(motor);
    expect(joint).toBeDefined();
    const kin = new Kinematics(mech);
    const link = kin.parentLink(rest[0]) ?? kin.parentLink(motor)!;
    kin.turnJoint(link.joint, Math.PI / 2);
    expect(Math.abs(kin.jointAngles[link.joint])).toBeCloseTo(Math.PI / 2, 6);
  });

  it("a pull-back motor: the axle through it turns in it, its spring waiting for forces (42026)", () => {
    const { motor, rest, joint } = onOutput('1 16 0 0 0 1 0 0 0 1 0 0 0 1 12799.dat\n1 16 0 0 0 1 0 0 0 0 -1 0 1 0 3708.dat');
    expect(rest[0]).not.toBe(motor);
    expect(joint).toBeDefined();
    expect(joint!.motor).toBe(true);
  });
});
