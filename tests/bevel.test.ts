import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ConnectionTable, libraryConnections } from '../src/connections.ts';
import { Kinematics } from '../src/kinematics.ts';
import { parseLdr, parseModel, PlacedPart } from '../src/ldr.ts';
import { findMeshes, inferMechanism, Mechanism } from '../src/mechanism.ts';

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
    kin.unfreezeAll();
    kin.turnJoint(jointOf(input), 1.5);
    const h = turnAboutZ(housing);
    expect(Math.abs(h)).toBeCloseTo(0.5, 6); // 8 teeth driving 24
    expect(turnAboutZ(left)).toBeCloseTo(h, 6);
    expect(turnAboutZ(right)).toBeCloseTo(h, 6);
  });

  it('with the input frozen, turning one output turns the other the opposite way', () => {
    kin.reset();
    kin.unfreezeAll();
    kin.toggleFreeze(input);
    kin.turnJoint(jointOf(left), 0.8);
    const l = turnAboutZ(left);
    expect(Math.abs(l)).toBeCloseTo(0.8, 6);
    expect(turnAboutZ(right)).toBeCloseTo(-l, 6);
    expect(turnAboutZ(housing)).toBeCloseTo(0, 6);
  });

  it('with one output frozen, turning the other turns the housing half as far', () => {
    kin.reset();
    kin.unfreezeAll();
    kin.toggleFreeze(right);
    kin.turnJoint(jointOf(left), 0.8);
    expect(turnAboutZ(right)).toBeCloseTo(0, 6);
    expect(turnAboutZ(housing)).toBeCloseTo(turnAboutZ(left) / 2, 6);
    expect(Math.abs(turnAboutZ(housing))).toBeCloseTo(0.4, 6);
  });

  it('as a drag would, turning the input with nothing frozen keeps the outputs together', () => {
    kin.reset();
    kin.unfreezeAll();
    const j = jointOf(input);
    kin.holdWhatTheDragDoesntNeed(input, () => kin.jointMotion(j) !== null);
    kin.turnJoint(j, 1.5);
    kin.letGoAfterDrag();
    expect(turnAboutZ(left)).toBeCloseTo(turnAboutZ(right), 6);
    expect(Math.abs(turnAboutZ(housing))).toBeCloseTo(0.5, 6);
  });

  it('jams when the input and one output are both frozen', () => {
    kin.reset();
    kin.unfreezeAll();
    kin.toggleFreeze(input);
    kin.toggleFreeze(right);
    expect(kin.freeMotions()).toHaveLength(0);
  });
});

describe("the 8865 Test Car's differential, the old one (73071), with its 28 tooth crown wheel", () => {
  const packed = JSON.parse(readFileSync('packed/models.json', 'utf-8'))['8865-Test Car'];
  const { parts, paths } = parseModel(readFileSync('models/8865-Test Car.mpd', 'utf-8'), (n) => packed.primitives.includes(n), (n) => packed.pieces[n] ?? null);
  const mech = inferMechanism(parts, table, roles, paths);
  const gear = (part: number) => mech.gears.findIndex((g) => g.part === part);
  const has = (a: number, b: number) => mech.meshes.some((m) => (m.gearA === gear(a) && m.gearB === gear(b)) || (m.gearA === gear(b) && m.gearB === gear(a)));

  it('is a differential: its crown wheel (p149) meshes with the pinion (p176), and its planet (p150) with both side gears (p147, p148)', () => {
    expect(mech.bodies[mech.bodyOf[149]].name).toMatch(/^differential/);
    expect(has(149, 176) && has(150, 147) && has(150, 148)).toBe(true);
  });

  it('with the engine held, turning one rear wheel turns the other the opposite way, the car standing on the ground', () => {
    const kin = new Kinematics(mech);
    kin.toggleFreeze(mech.bodyOf[175]); // the pinion's shaft, which the engine turns
    const wheel = (part: number) => kin.parentLink(mech.bodyOf[part])!.joint;
    expect(kin.turnJoint(wheel(900), 0.8)).toBeCloseTo(0.8, 6);
    expect(kin.jointAngles[wheel(904)]).toBeCloseTo(-kin.jointAngles[wheel(900)], 3);
  });
});

// Gears only real sets showed, placed as the OMR's sets place them, read with the whole library's
// table, as a model opened from your own computer is.
describe('gears only real sets showed', () => {
  const library = libraryConnections(JSON.parse(readFileSync('data/library-connections.json', 'utf-8')));
  const read = (text: string) => {
    const parts = parseLdr(text);
    return { parts, mech: inferMechanism(parts, library, roles) };
  };
  // How the gears of parts placed so would mesh, each on a body of its own (alone, they'd all be
  // one body: nothing holds them apart).
  const meshes = (text: string) => findMeshes(read(text).mech.gears.map((g, i) => ({ ...g, body: i + 1 }))).map((m) => m.kind);

  it('two knob wheels on axles crossing at right angles, each 20 LDU from the crossing, mesh (42022)', () => {
    expect(meshes('1 16 0 0 0 0.674 -0.738 0 -0.738 -0.674 0 0 0 -1 32072.dat\n1 16 20 0 -20 0 0 -1 -0.031 1 0 1 0.031 0 32072.dat')).toEqual(['bevel']);
  });

  it("a knob wheel doesn't mesh with a 12 tooth bevel gear set where another knob wheel would be: its knobs aren't teeth of LEGO's size", () => {
    expect(meshes('1 16 0 0 0 0.674 -0.738 0 -0.738 -0.674 0 0 0 -1 32072.dat\n1 16 20 0 -20 0 0 -1 -0.031 1 0 1 0.031 0 32270.dat')).toEqual([]);
  });

  it("a 28 tooth turntable's top turns on its bottom, and a 12 tooth bevel gear at its side turns it (42052)", () => {
    const turntable = '1 16 0 0 0 -1 0 0 0 1 0 0 0 -1 99009.dat\n1 16 0 0 0 1 0 0 0 1 0 0 0 1 99010.dat';
    const { mech } = read(turntable);
    expect(mech.loose).toEqual([]);
    expect(mech.joints.map((j) => j.kind)).toEqual(['revolute']);
    expect(meshes(turntable + '\n1 16 0 20 -40 0.966 -0.259 0 0.259 0.966 0 0 0 1 32270.dat')).toEqual(['bevel']);
  });
});
