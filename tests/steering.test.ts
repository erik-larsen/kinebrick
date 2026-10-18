import { readFileSync } from 'node:fs';
import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { ConnectionTable } from '../src/connections.ts';
import { Kinematics } from '../src/kinematics.ts';
import { parseLdr, PlacedPart } from '../src/ldr.ts';
import { inferMechanism, Mechanism } from '../src/mechanism.ts';

const table: ConnectionTable = JSON.parse(readFileSync('data/connections.json', 'utf-8'));
const roles: Record<string, string> = JSON.parse(readFileSync('data/roles.json', 'utf-8'));
const CAR = readFileSync('models/steering-car.ldr', 'utf-8');
const WHEELBASE = 160;

function load(text: string) {
  const parts = parseLdr(text);
  const mech = inferMechanism(parts, table, roles);
  return { parts, mech, kin: new Kinematics(mech) };
}

function bodyOf(parts: PlacedPart[], mech: Mechanism, partName: string, n = 0): number {
  const part = parts.map((p, i) => (p.name === partName ? i : -1)).filter((i) => i >= 0)[n];
  return mech.bodyOf[part];
}

// How far the frame has turned about the vertical axis.
const yaw = (kin: Kinematics) => Math.atan2(kin.poses[0].elements[8], kin.poses[0].elements[0]);

describe('steering car', () => {
  const { parts, mech, kin } = load(CAR);
  const column = bodyOf(parts, mech, '2819.dat');
  const carrier = bodyOf(parts, mech, '4032a.dat');
  const rearLeft = bodyOf(parts, mech, '32073.dat', 0);
  const rearRight = bodyOf(parts, mech, '32073.dat', 1);
  const jointOf = (body: number) => kin.parentLink(body)!.joint;
  const treadOf = (body: number) => mech.treads.findIndex((t) => t.body === body);

  it('stands on all four tyres and can move two ways: steer and roll', () => {
    expect(mech.treads).toHaveLength(4);
    expect(kin.groundY).toBeCloseTo(-38 + 54.2, 0);
    expect(kin.freeMotions()).toHaveLength(2);
    expect(mech.loose).toEqual([]);
  });

  it('turning the steering wheel turns the front axle a third as far, without moving the car', () => {
    kin.reset();
    kin.unfreezeAll();
    kin.turnJoint(jointOf(column), 1.5);
    expect(Math.abs(kin.jointAngles[jointOf(carrier)])).toBeCloseTo(0.5, 6); // 8 teeth driving 24
    const moved = kin.poses[0].elements.slice(12, 15);
    for (const x of moved) expect(Math.abs(x)).toBeLessThan(1e-6);
  });

  it('driving straight, both rear wheels turn the same', () => {
    kin.reset();
    kin.unfreezeAll();
    kin.toggleFreeze(column);
    kin.turnJoint(jointOf(rearLeft), 1);
    expect(Math.abs(kin.treadTravel[treadOf(rearLeft)])).toBeCloseTo(Math.abs(kin.treadTravel[treadOf(rearRight)]), 6);
    expect(yaw(kin)).toBeCloseTo(0, 6);
    expect(kin.frameTurningRadius()).toBe(Infinity);
  });

  it('steered, it drives round a circle, the outer rear wheel rolling further than the inner one', () => {
    kin.reset();
    kin.unfreezeAll();
    kin.turnJoint(jointOf(column), 1.5); // front axle turned 0.5 radians
    const steer = Math.abs(kin.jointAngles[jointOf(carrier)]);
    kin.toggleFreeze(column);
    // The car's centre (the frame's origin, 80 LDU ahead of the rear axle) drives round a
    // circle of radius √(R² + 80²), where R is the rear axle's radius.
    const rearRadius = WHEELBASE / Math.tan(steer);
    expect(kin.frameTurningRadius()).toBeCloseTo(Math.hypot(rearRadius, 80), 3);
    kin.turnJoint(jointOf(rearLeft), 2);

    // The middle of the rear axle goes round a circle of radius wheelbase / tan(steering angle),
    // and the rear tyres touch the ground half a track either side of it. (The big tyres' treads
    // are offset 3.5 LDU outwards from the rims, so that's 93.5 LDU, not 90.)
    const radius = WHEELBASE / Math.tan(steer);
    const halfTrack = Math.abs(mech.treads[treadOf(rearLeft)].center.z);
    expect(halfTrack).toBeCloseTo(93.5, 1);
    const left = Math.abs(kin.treadTravel[treadOf(rearLeft)]);
    const right = Math.abs(kin.treadTravel[treadOf(rearRight)]);
    const inner = Math.min(left, right);
    const outer = Math.max(left, right);
    expect(inner / outer).toBeCloseTo((radius - halfTrack) / (radius + halfTrack), 4);
    // And the car turns by (distance travelled by the middle of the axle) ÷ radius.
    expect(Math.abs(yaw(kin))).toBeCloseTo((inner + outer) / 2 / radius, 4);
  });

  it('pushing the steered car rolls it without changing the steering', () => {
    kin.reset();
    kin.unfreezeAll();
    kin.turnJoint(jointOf(column), 1.5);
    const steer = kin.jointAngles[jointOf(carrier)];
    // As a push on the frame does: hold whatever the push doesn't need, then move the frame.
    const frameMoves = () => kin.freeMotions().some((m) => kin.pointVelocity(m, 0, new Vector3().applyMatrix4(kin.poses[0])).length() > 1e-6);
    kin.holdWhatTheDragDoesntNeed(0, frameMoves);
    expect(kin.freeMotions()).toHaveLength(1);
    for (let i = 0; i < 50; i++) kin.advance(kin.freeMotions()[0], 1);
    kin.letGoAfterDrag();
    expect(Math.abs(yaw(kin))).toBeGreaterThan(0.01); // it went round a bend
    expect(kin.jointAngles[jointOf(carrier)]).toBeCloseTo(steer, 9);
  });

  it('turning a rear wheel rolls the car without changing the steering', () => {
    kin.reset();
    kin.unfreezeAll();
    kin.turnJoint(jointOf(column), 1.5);
    const steer = kin.jointAngles[jointOf(carrier)];
    const j = jointOf(rearLeft);
    kin.holdWhatTheDragDoesntNeed(rearLeft, () => kin.jointMotion(j) !== null);
    kin.turnJoint(j, 1);
    kin.letGoAfterDrag();
    expect(Math.abs(yaw(kin))).toBeGreaterThan(0.01);
    expect(kin.jointAngles[jointOf(carrier)]).toBeCloseTo(steer, 9);
  });

  it('with a solid rear axle instead of the differential, it rolls round a bend once steered, its rear tyres skidding to make up the difference', () => {
    const car = load(readFileSync('models/steering-car-solid.ldr', 'utf-8'));
    const col = bodyOf(car.parts, car.mech, '2819.dat');
    expect(car.kin.freeMotions()).toHaveLength(2); // steer, and roll
    car.kin.turnJoint(car.kin.parentLink(col)!.joint, 1.5);
    car.kin.toggleFreeze(col);
    expect(car.kin.freeMotions()).toHaveLength(1); // steered and frozen: it can still roll
    const rear = car.mech.treads.flatMap((t, i) => (car.mech.treads.filter((u) => u.body === t.body).length === 2 ? [i] : []));
    const axle = car.mech.treads[rear[0]].body;
    const j = car.kin.parentLink(axle)!.joint;
    car.kin.holdWhatTheDragDoesntNeed(axle, () => car.kin.jointMotion(j) !== null);
    const turned = car.kin.turnJoint(j, 1);
    car.kin.letGoAfterDrag();
    expect(Math.abs(turned)).toBeCloseTo(1, 9);
    expect(Math.abs(yaw(car.kin))).toBeGreaterThan(0.01); // it went round a bend
    // The axle turned both tyres alike, but the outer one travelled further: they skidded, one
    // back and one forward, and on average rolled as far as the axle turned.
    const [a, b] = rear.map((i) => Math.abs(car.kin.treadTravel[i]));
    const radius = car.mech.treads[rear[0]].radius;
    expect(Math.abs(a - b)).toBeGreaterThan(1);
    expect((a + b) / 2).toBeCloseTo(radius * Math.abs(turned), 3);
  });
});
