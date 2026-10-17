import { readFileSync } from 'node:fs';
import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { ConnectionTable } from '../src/connections.ts';
import { Kinematics } from '../src/kinematics.ts';
import { parseLdr } from '../src/ldr.ts';
import { inferMechanism } from '../src/mechanism.ts';

const table: ConnectionTable = JSON.parse(readFileSync('data/connections.json', 'utf-8'));
const roles: Record<string, string> = JSON.parse(readFileSync('data/roles.json', 'utf-8'));
const TYRE_RADIUS = 31; // 3483's tread radius, rounded

function simpleCar() {
  const parts = parseLdr(readFileSync('models/simple-car.ldr', 'utf-8'));
  const mech = inferMechanism(parts, table, roles);
  return { mech, kin: new Kinematics(mech) };
}

// Rolls the car `distance` LDU along +x in small steps, the way dragging does.
function roll(kin: Kinematics, distance: number) {
  const steps = Math.ceil(Math.abs(distance) / 1);
  const origin = new Vector3(0, 0, 0);
  for (let i = 0; i < steps; i++) {
    const [motion] = kin.freeMotions();
    const frameVelocity = kin.pointVelocity(motion, 0, origin.clone().applyMatrix4(kin.poses[0]));
    kin.advance(motion, distance / steps / frameVelocity.x);
  }
}

describe('simple car on the ground', () => {
  it('sits on the ground with all four tyres touching it', () => {
    const { kin } = simpleCar();
    expect(kin.groundY).toBeCloseTo(17, 2); // axles at y = -14, tyre radius 31
  });

  it('can move exactly one way', () => {
    const { kin } = simpleCar();
    expect(kin.freeMotions()).toHaveLength(1);
  });

  it('rolls along its length, wheels turning by distance ÷ tyre radius', () => {
    const { kin } = simpleCar();
    const distance = 2 * Math.PI * TYRE_RADIUS; // one full turn of the wheels
    roll(kin, distance);

    const moved = new Vector3(0, 0, 0).applyMatrix4(kin.poses[0]);
    expect(moved.x).toBeCloseTo(distance, 1);
    expect(moved.y).toBeCloseTo(0, 6); // stays on the ground
    expect(moved.z).toBeCloseTo(0, 6); // doesn't drift sideways

    for (const angle of kin.jointAngles) {
      expect(Math.abs(angle)).toBeCloseTo(distance / 31.002, 3);
    }
    // Both axles turn the same way.
    expect(Math.sign(kin.jointAngles[0])).toBe(Math.sign(kin.jointAngles[1]));
  });

  it('keeps the wheels on their axles and the tyres on the ground', () => {
    const { mech, kin } = simpleCar();
    roll(kin, 123);
    for (const joint of mech.joints) {
      // The joint axis moves with both bodies: same place whichever body we follow.
      const viaA = joint.from.clone().applyMatrix4(kin.poses[joint.bodyA]);
      const viaB = joint.from.clone().applyMatrix4(kin.poses[joint.bodyB]);
      expect(viaA.distanceTo(viaB)).toBeLessThan(1e-6);
      expect(viaA.y).toBeCloseTo(-14, 6);
    }
    for (const tread of mech.treads) {
      const center = tread.center.clone().applyMatrix4(kin.poses[tread.body]);
      expect(center.y).toBeCloseTo(-14, 6);
    }
  });

  it('hangs each axle body from the frame, and the axles move as the car rolls', () => {
    const { mech, kin } = simpleCar();
    const [motion] = kin.freeMotions();
    for (let body = 1; body < mech.bodies.length; body++) {
      const link = kin.parentLink(body)!;
      expect(link.parent).toBe(0);
      const hub = kin.nearestOnAxis(link.joint, new Vector3(0, 30, 0));
      expect(hub.y).toBeCloseTo(-14, 6); // on the axle, level with its centre
      expect(kin.pointVelocity(motion, body, hub).length()).toBeGreaterThan(0);
    }
    expect(kin.parentLink(0)).toBeNull();
  });

  it('rolls back to where it started', () => {
    const { kin } = simpleCar();
    roll(kin, 80);
    roll(kin, -80);
    expect(new Vector3(0, 0, 0).applyMatrix4(kin.poses[0]).length()).toBeLessThan(1e-6);
    for (const angle of kin.jointAngles) expect(angle).toBeCloseTo(0, 6);
  });
});

describe('the same parts with no tyres', () => {
  it('holds the frame still, leaving only the axles free to turn', () => {
    const parts = parseLdr(readFileSync('models/simple-car.ldr', 'utf-8')).filter((p) => p.name !== '3483.dat');
    const mech = inferMechanism(parts, table, roles);
    const kin = new Kinematics(mech);
    expect(kin.groundY).toBeNull();
    expect(kin.freeMotions()).toHaveLength(2); // each axle turns on its own
  });
});
