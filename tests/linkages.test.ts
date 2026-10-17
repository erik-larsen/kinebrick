import { readFileSync } from 'node:fs';
import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { ConnectionTable } from '../src/connections.ts';
import { Kinematics } from '../src/kinematics.ts';
import { parseLdr, PlacedPart } from '../src/ldr.ts';
import { inferMechanism, Mechanism } from '../src/mechanism.ts';

const table: ConnectionTable = JSON.parse(readFileSync('data/connections.json', 'utf-8'));
const roles: Record<string, string> = JSON.parse(readFileSync('data/roles.json', 'utf-8'));
const TURN = 2 * Math.PI;

function load(file: string) {
  const parts: PlacedPart[] = parseLdr(readFileSync(file, 'utf-8'));
  const mech = inferMechanism(parts, table, roles);
  const kin = new Kinematics(mech);
  // The body of the n-th copy of a part.
  const bodyOf = (name: string, n = 0) => mech.bodyOf[parts.map((p, i) => (p.name === name ? i : -1)).filter((i) => i >= 0)[n]];
  return { parts, mech, kin, bodyOf };
}

// How far apart a joint's two bodies have drifted at the joint, in LDU.
function jointGap(mech: Mechanism, kin: Kinematics, joint: number): number {
  const j = mech.joints[joint];
  return j.from.clone().applyMatrix4(kin.poses[j.bodyA]).distanceTo(j.from.clone().applyMatrix4(kin.poses[j.bodyB]));
}

describe('single-cylinder engine', () => {
  const { mech, kin, bodyOf } = load('models/engine.ldr');
  const crank = bodyOf('2853a.dat');
  const rod = bodyOf('2852.dat');
  const piston = bodyOf('2851.dat');
  const crankJoint = kin.parentLink(crank)!.joint;
  // How far the piston has moved down from the top of its stroke, in LDU (LDraw's y points down).
  const pistonDown = () => new Vector3().applyMatrix4(kin.poses[piston]).y;

  it('has the frame (the cylinder head pinned on at two places), crankshaft, connecting rod and piston', () => {
    expect(mech.bodies.map((b) => b.name)).toEqual(['frame', 'crankshaft 1', 'connecting rod 1', 'piston 1']);
    expect(mech.bodyOf[mech.bodies[0].parts[0]]).toBe(0);
    expect(mech.joints.map((j) => j.kind).sort()).toEqual(['ball', 'revolute', 'revolute', 'slide']);
    expect(mech.loose).toEqual([]);
  });

  it('can move one way only', () => {
    kin.reset();
    expect(kin.freeMotions()).toHaveLength(1);
  });

  it('turning the crank once moves the piston down its 20 LDU stroke and back up', () => {
    kin.reset();
    const heights: number[] = [];
    for (let i = 0; i < 36; i++) {
      kin.turnJoint(crankJoint, TURN / 36);
      heights.push(pistonDown());
    }
    expect(Math.max(...heights)).toBeCloseTo(20, 6);
    expect(heights[35]).toBeCloseTo(0, 6);
    // A quarter turn in, by the geometry of a crank (10 LDU) and rod (40 LDU): 40 - √(40² - 10²) + 10.
    expect(Math.abs(heights[8])).toBeCloseTo(40 - Math.sqrt(40 * 40 - 10 * 10) + 10, 6);
  });

  it('stays together: after 10 turns no joint has drifted apart', () => {
    kin.reset();
    for (let i = 0; i < 10; i++) kin.turnJoint(crankJoint, TURN);
    mech.joints.forEach((_, j) => expect(jointGap(mech, kin, j)).toBeLessThan(1e-6));
    expect(pistonDown()).toBeCloseTo(0, 6);
  });

  it('turns the crank like a knob, and pushes the rod and piston', () => {
    expect(kin.turnsLikeAKnob(crank)).toBe(true);
    expect(kin.turnsLikeAKnob(rod)).toBe(false);
    expect(kin.turnsLikeAKnob(piston)).toBe(false);
  });

  it('can push the piston mid-stroke, but not at the top of its stroke (dead centre)', () => {
    const pistonSpeed = () => {
      const [motion] = kin.freeMotions();
      const turnRate = Math.abs(kin.jointRate(motion, crankJoint));
      return kin.pointVelocity(motion, piston, new Vector3().applyMatrix4(kin.poses[piston])).length() / turnRate;
    };
    kin.reset();
    expect(pistonSpeed()).toBeLessThan(1e-6);
    kin.turnJoint(crankJoint, TURN / 4);
    expect(pistonSpeed()).toBeGreaterThan(5);
  });
});

describe('four-bar linkage', () => {
  const { mech, kin, bodyOf } = load('models/four-bar.ldr');
  const crank = bodyOf('32523.dat');
  const rocker = bodyOf('32316.dat');
  const coupler = bodyOf('32524.dat');
  const crankJoint = kin.parentLink(crank)!.joint;
  const rockerJoint = kin.parentLink(rocker)!.joint;

  it('has four bodies, each pin locked to one of the parts it joins, and four turning joints', () => {
    expect(mech.bodies).toHaveLength(4);
    for (const body of mech.bodies) expect(body.parts.some((p) => mech.roles[p] !== 'pin')).toBe(true);
    expect(mech.joints.map((j) => j.kind)).toEqual(['revolute', 'revolute', 'revolute', 'revolute']);
    expect(mech.loose).toEqual([]);
  });

  it('can move one way only', () => {
    kin.reset();
    expect(kin.freeMotions()).toHaveLength(1);
  });

  it('the crank turns all the way round, rocking the rocker about 63 degrees', () => {
    kin.reset();
    const angles: number[] = [];
    let turned = 0;
    for (let i = 0; i < 72; i++) {
      turned += kin.turnJoint(crankJoint, TURN / 72);
      angles.push((kin.jointAngles[rockerJoint] * 180) / Math.PI);
    }
    expect(turned).toBeCloseTo(TURN, 9);
    expect(Math.max(...angles) - Math.min(...angles)).toBeCloseTo(63.1, 0);
    expect(angles[71]).toBeCloseTo(0, 4); // degrees
  });

  it('stays together: after 10 turns no joint has drifted apart', () => {
    kin.reset();
    for (let i = 0; i < 10; i++) kin.turnJoint(crankJoint, TURN);
    mech.joints.forEach((_, j) => expect(jointGap(mech, kin, j)).toBeLessThan(1e-6));
  });

  it('turns the crank and the rocker like knobs, and pushes the coupler', () => {
    expect(kin.turnsLikeAKnob(crank)).toBe(true);
    expect(kin.turnsLikeAKnob(rocker)).toBe(true);
    expect(kin.turnsLikeAKnob(coupler)).toBe(false);
  });
});
