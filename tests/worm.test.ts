import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ConnectionTable } from '../src/connections.ts';
import { Kinematics } from '../src/kinematics.ts';
import { parseLdr, parseModel } from '../src/ldr.ts';
import { inferMechanism } from '../src/mechanism.ts';

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

describe("the 8849 Tractor's hitch: a worm driving a 24 tooth gear on the long shaft under the tractor", () => {
  // The model's gear was off the shaft its hole is on; corrected (see docs/ldraw-errata.md).
  const packed = JSON.parse(readFileSync('packed/models.json', 'utf-8'))['8849-Tractor'];
  const { parts, paths } = parseModel(readFileSync('models/8849-Tractor.mpd', 'utf-8'), (n) => packed.primitives.includes(n), (n) => packed.pieces[n] ?? null);
  const mech = inferMechanism(parts, table, roles, paths);
  const worm = mech.gears.findIndex((g) => g.part === 55); // p55 4716
  const gear = mech.gears.findIndex((g) => g.part === 79); // p79 3648a

  it('finds the worm meshing with the gear, which is on the long shaft (p77)', () => {
    expect(mech.meshes.filter((m) => m.kind === 'worm')).toEqual([{ gearA: worm, gearB: gear, kind: 'worm' }]);
    expect(mech.bodyOf[79]).toBe(mech.bodyOf[77]);
  });

  it('turns the long shaft one tooth (1/24 of a turn) per turn of the worm', () => {
    const kin = new Kinematics(mech);
    const wormJoint = kin.parentLink(mech.gears[worm].body)!.joint;
    const shaftJoint = kin.parentLink(mech.gears[gear].body)!.joint;
    kin.turnJoint(wormJoint, TURN);
    expect(Math.abs(kin.jointAngles[shaftJoint])).toBeCloseTo(TURN / 24, 3);
  });
});
