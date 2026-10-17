import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ConnectionTable } from './connections.ts';
import { Kinematics } from './kinematics.ts';
import { parseLdr } from './ldr.ts';
import { inferMechanism } from './mechanism.ts';

const table: ConnectionTable = JSON.parse(readFileSync('data/connections.json', 'utf-8'));
const roles: Record<string, string> = JSON.parse(readFileSync('data/roles.json', 'utf-8'));
const TURN = 2 * Math.PI;

describe('worm drive: a worm driving a 24 tooth gear', () => {
  const parts = parseLdr(readFileSync('models/worm-drive.ldr', 'utf-8'));
  const mech = inferMechanism(parts, table, roles);
  const kin = new Kinematics(mech);
  const worm = mech.bodyOf[parts.findIndex((p) => p.name === '4716.dat')];
  const gear = mech.bodyOf[parts.findIndex((p) => p.name === '3648.dat')];
  const wormJoint = kin.parentLink(worm)!.joint;
  const gearJoint = kin.parentLink(gear)!.joint;

  it('finds the worm meshing with the gear, leaving one way to move', () => {
    expect(mech.meshes.map((m) => m.kind)).toEqual(['worm']);
    expect(kin.freeMotions()).toHaveLength(1);
  });

  it('turns the gear one tooth (1/24 of a turn) per turn of the worm', () => {
    kin.reset();
    kin.turnJoint(wormJoint, TURN);
    expect(Math.abs(kin.jointAngles[gearJoint])).toBeCloseTo(TURN / 24, 6);
    kin.turnJoint(wormJoint, -TURN);
    expect(kin.jointAngles[gearJoint]).toBeCloseTo(0, 6);
  });

  it('can be turned from the worm', () => {
    kin.reset();
    const locked = kin.holdWhatTheDragDoesntNeed(worm, () => kin.jointMotion(wormJoint) !== null);
    expect(locked).toBe(false);
    expect(kin.jointMotion(wormJoint)).not.toBeNull();
    kin.letGoAfterDrag();
  });

  it("locks when turned from the gear: a worm can't be driven by its gear", () => {
    kin.reset();
    const locked = kin.holdWhatTheDragDoesntNeed(gear, () => kin.jointMotion(gearJoint) !== null);
    expect(locked).toBe(true);
    expect(kin.jointMotion(gearJoint)).toBeNull();
    kin.letGoAfterDrag();
  });
});
