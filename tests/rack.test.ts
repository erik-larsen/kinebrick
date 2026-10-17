import { readFileSync } from 'node:fs';
import { Matrix4, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { ConnectionTable } from '../src/connections.ts';
import { Kinematics } from '../src/kinematics.ts';
import { parseLdr } from '../src/ldr.ts';
import { inferMechanism } from '../src/mechanism.ts';

const table: ConnectionTable = JSON.parse(readFileSync('data/connections.json', 'utf-8'));
const roles: Record<string, string> = JSON.parse(readFileSync('data/roles.json', 'utf-8'));
const TOOTH = 2 * Math.PI * 1.25; // the distance between two teeth, on a gear's pitch circle or a rack

describe('rack and pinion: an 8 tooth gear on two 1x4 racks, on a plate sliding along tiles', () => {
  const parts = parseLdr(readFileSync('models/rack-and-pinion.ldr', 'utf-8'));
  const mech = inferMechanism(parts, table, roles);
  const kin = new Kinematics(mech);
  const gear = mech.bodyOf[parts.findIndex((p) => p.name === '3647.dat')];
  const rack = mech.bodyOf[parts.findIndex((p) => p.name === '3743.dat')];
  const gearJoint = kin.parentLink(gear)!.joint;
  const slide = mech.joints.findIndex((j) => j.kind === 'slide');

  it('finds the plate and racks sliding on the tiles, the gear meshing with the racks, and one way to move', () => {
    expect(mech.bodies.map((b) => b.name)).toEqual(['frame', 'rack 1', 'gear 1']);
    expect(mech.bodyOf[parts.findIndex((p) => p.name === '3460.dat')]).toBe(rack);
    expect(mech.joints[slide].bodyB).toBe(rack);
    expect(mech.meshes.map((m) => m.kind)).toEqual(['rack', 'rack']);
    expect(mech.loose).toEqual([]);
    expect(kin.freeMotions()).toHaveLength(1);
  });

  it('turning the gear a quarter turn slides the rack 2 teeth', () => {
    kin.reset();
    kin.turnJoint(gearJoint, Math.PI / 2);
    expect(Math.abs(kin.slideOffset(slide))).toBeCloseTo(2 * TOOTH, 6);
  });

  it('pushing the rack turns the gear: the rack can be pushed along its length', () => {
    kin.reset();
    const [motion] = kin.freeMotions();
    const velocity = kin.pointVelocity(motion, rack, new Vector3().applyMatrix4(kin.poses[rack]));
    expect(Math.abs(velocity.normalize().x)).toBeCloseTo(1, 9); // the rack runs along x
    expect(Math.abs(kin.jointRate(motion, gearJoint))).toBeGreaterThan(0);
  });

  it('may overhang the tiles: the plate slides as long as it still overlaps them by a stud', () => {
    // A 1x8 plate (160 LDU) on a row of three 1x4 tiles (240 LDU): 120 + 80 - 20 either way.
    expect(mech.joints[slide].range).toEqual([-180, 180]);
  });

  it('stops where the gear reaches the end of the teeth: 80 LDU either way, about 1¼ turns of the gear', () => {
    for (const way of [1, -1]) {
      kin.reset();
      const turned = kin.turnJoint(gearJoint, way * 4 * Math.PI, () => kin.atLimit() === null);
      expect(Math.abs(turned)).toBeCloseTo(80 / 10, 1); // radians: 80 LDU at the gear's pitch radius, 10 LDU
      expect(Math.abs(kin.slideOffset(slide))).toBeLessThanOrEqual(80);
      expect(kin.atLimit()).toBeNull();
    }
  });

  it('rolls from one rack onto the next: starting over one rack, the gear meshes with both', () => {
    // The same model with the gear and its axle moved 40 LDU along, over the middle of one rack.
    const moved = parts.map((p) => (p.name === '3647.dat' || p.name === '4519.dat' ? { ...p, matrix: new Matrix4().makeTranslation(40, 0, 0).multiply(p.matrix) } : p));
    const m = inferMechanism(moved, table, roles);
    expect(m.meshes.map((x) => x.kind)).toEqual(['rack', 'rack']);
    const k = new Kinematics(m);
    const joint = k.parentLink(m.bodyOf[moved.findIndex((p) => p.name === '3647.dat')])!.joint;
    const s = m.joints.findIndex((j) => j.kind === 'slide');
    const reach = [1, -1].map((way) => {
      k.reset();
      k.turnJoint(joint, way * 6 * Math.PI, () => k.atLimit() === null);
      return Math.abs(k.slideOffset(s));
    });
    // To the far end of the other rack one way (120 LDU), the near end of this one the other (40).
    expect(Math.max(...reach)).toBeCloseTo(120, 0);
    expect(Math.min(...reach)).toBeCloseTo(40, 0);
  });
});
