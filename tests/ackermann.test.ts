import { readFileSync } from 'node:fs';
import { Matrix4, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { ConnectionTable } from '../src/connections.ts';
import { Kinematics } from '../src/kinematics.ts';
import { parseLdr, PlacedPart } from '../src/ldr.ts';
import { inferMechanism } from '../src/mechanism.ts';

const table: ConnectionTable = JSON.parse(readFileSync('data/connections.json', 'utf-8'));
const roles: Record<string, string> = JSON.parse(readFileSync('data/roles.json', 'utf-8'));
const WHEELBASE = 400;
const HALF_TRACK = 243.5; // where the tyres touch the ground, either side of the middle
const DEGREE = Math.PI / 180;

function load(parts: PlacedPart[]) {
  const mech = inferMechanism(parts, table, roles);
  const kin = new Kinematics(mech);
  // The body of the n-th copy of a part.
  const bodyOf = (name: string, n = 0) => mech.bodyOf[parts.map((p, i) => (p.name === name ? i : -1)).filter((i) => i >= 0)[n]];
  const column = bodyOf('2819.dat');
  const columnJoint = kin.parentLink(column)!.joint;
  const rearAxle = bodyOf('3708.dat');
  const treadOf = (body: number) => mech.treads.findIndex((t) => t.body === body);
  // Turns the steering wheel as far as it goes (or `angle`), holding what that doesn't need, as
  // a drag does: the car stays where it is.
  const steer = (angle: number) => {
    kin.holdWhatTheDragDoesntNeed(column, () => kin.jointMotion(columnJoint) !== null);
    const turned = kin.turnJoint(columnJoint, angle, () => kin.atLimit() === null);
    kin.letGoAfterDrag();
    return turned;
  };
  // Turns a rear wheel with the steering frozen, as a drag does. Returns how far it turned.
  const roll = (angle: number) => {
    kin.toggleFreeze(column);
    const j = kin.parentLink(rearAxle)!.joint;
    kin.holdWhatTheDragDoesntNeed(rearAxle, () => kin.jointMotion(j) !== null);
    const turned = kin.turnJoint(j, angle);
    kin.letGoAfterDrag();
    kin.toggleFreeze(column);
    return turned;
  };
  return { mech, kin, bodyOf, treadOf, steer, roll };
}

const parts = parseLdr(readFileSync('models/ackermann-car.ldr', 'utf-8'));

describe('Ackermann car', () => {
  const { mech, kin, bodyOf, treadOf, steer, roll } = load(parts);
  const knuckles = [bodyOf('4032a.dat', 0), bodyOf('4032a.dat', 1)];
  const steerAngles = () => knuckles.map((b) => Math.abs(kin.jointAngles[kin.parentLink(b)!.joint]));
  const slide = mech.joints.findIndex((j) => j.kind === 'slide');

  it('is fully attached: the towballs in Technic plate holes, the steering links on them', () => {
    expect(mech.loose).toEqual([]);
    expect(mech.joints.filter((j) => j.kind === 'ball')).toHaveLength(4);
    expect(mech.bodies.filter((b) => b.name.startsWith('steering link'))).toHaveLength(2);
    expect(mech.treads).toHaveLength(4);
  });

  it("can move two ways, steer and roll: a steering link doesn't spin about its own length", () => {
    kin.reset();
    expect(kin.freeMotions()).toHaveLength(2);
  });

  it('turning the steering wheel slides the rack until the slide plate would overhang its tile: 30 LDU either way', () => {
    for (const way of [1, -1]) {
      kin.reset();
      const turned = steer(way * 4);
      expect(Math.abs(kin.slideOffset(slide))).toBeCloseTo(30, 0); // to within a step
      expect(Math.abs(turned)).toBeCloseTo(30 / 10, 1); // radians: the pinion's pitch radius is 10 LDU
    }
  });

  it('at full lock the inner wheel turns 30° and the outer one 20°, and the car stays where it is', () => {
    kin.reset();
    steer(4);
    const [inner, outer] = steerAngles().sort((a, b) => b - a);
    expect(inner / DEGREE).toBeCloseTo(30.4, 0);
    expect(outer / DEGREE).toBeCloseTo(19.9, 0);
    const moved = kin.poses[0].elements.slice(12, 15);
    for (const x of moved) expect(Math.abs(x)).toBeLessThan(1e-6);
  });

  it('steered, it drives round a centre on the rear axle line, with each front wheel turned about as far as that centre needs', () => {
    for (const lock of [1.5, 4]) {
      kin.reset();
      steer(lock);
      expect(roll(4)).toBeCloseTo(4, 9);
      // The rear wheels roll in proportion to their distance from the centre.
      const rear = [bodyOf('3708.dat', 0), bodyOf('3708.dat', 1)].map((b) => Math.abs(kin.treadTravel[treadOf(b)]));
      const ratio = Math.min(...rear) / Math.max(...rear);
      const radius = (HALF_TRACK * (1 + ratio)) / (1 - ratio); // of the middle of the rear axle
      const [inner, outer] = steerAngles().sort((a, b) => b - a);
      expect(Math.abs(inner - Math.atan(WHEELBASE / (radius - HALF_TRACK))) / DEGREE).toBeLessThan(1.5);
      expect(Math.abs(outer - Math.atan(WHEELBASE / (radius + HALF_TRACK))) / DEGREE).toBeLessThan(1.5);
      // So the tyres hardly scrub: well under 1% of how far they roll.
      mech.treads.forEach((_, t) => expect(kin.treadScrub[t]).toBeLessThan(0.01 * Math.abs(kin.treadTravel[t])));
    }
  });
});

describe('scrub', () => {
  // The same car with the rear axle (and everything on it) moved forward to half the wheelbase:
  // the steering arms no longer point at its middle, so steered, its tyres scrub.
  const rear = (p: PlacedPart) => p.name !== '3026.dat' && p.matrix.elements[12] < 100;
  const shorter = parts.map((p) => (rear(p) ? { ...p, matrix: new Matrix4().makeTranslation(WHEELBASE / 2, 0, 0).multiply(p.matrix) } : p));
  const { mech, kin, steer, roll } = load(shorter);

  it('a little scrub is allowed: steered a little, the shorter car still rolls, its tyres scrubbing under 2% of how far they roll', () => {
    expect(mech.loose).toEqual([]);
    kin.reset();
    steer(1);
    expect(roll(4)).toBeCloseTo(4, 9);
    const scrub = Math.hypot(...kin.treadScrub);
    const travel = Math.hypot(...kin.treadTravel);
    expect(scrub).toBeGreaterThan(0.001 * travel);
    expect(scrub).toBeLessThan(0.02 * travel);
  });

  it('more is not: at full lock the shorter car can steer but not roll', () => {
    kin.reset();
    steer(4);
    const frame = new Vector3().applyMatrix4(kin.poses[0]);
    expect(roll(4)).toBe(0);
    expect(new Vector3().applyMatrix4(kin.poses[0]).distanceTo(frame)).toBeLessThan(1e-9);
  });
});
