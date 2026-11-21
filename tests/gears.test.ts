import { readFileSync } from 'node:fs';
import { Quaternion } from 'three';
import { describe, expect, it } from 'vitest';
import { ConnectionTable } from '../src/connections.ts';
import { Kinematics } from '../src/kinematics.ts';
import { parseLdr, PlacedPart } from '../src/ldr.ts';
import { inferMechanism, Mechanism } from '../src/mechanism.ts';

const table: ConnectionTable = JSON.parse(readFileSync('data/connections.json', 'utf-8'));
const roles: Record<string, string> = JSON.parse(readFileSync('data/roles.json', 'utf-8'));
const TURN = 2 * Math.PI;

function load(file: string) {
  const parts = parseLdr(readFileSync(file, 'utf-8'));
  const mech = inferMechanism(parts, table, roles);
  return { parts, mech, kin: new Kinematics(mech) };
}

// The joint that the body holding the n-th copy of `partName` turns on.
function jointOf(parts: PlacedPart[], mech: Mechanism, partName: string, n = 0): number {
  const part = parts.map((p, i) => (p.name === partName ? i : -1)).filter((i) => i >= 0)[n];
  const body = mech.bodyOf[part];
  return mech.joints.findIndex((j) => j.bodyA === body || j.bodyB === body);
}

describe('gear train: 8 tooth, 24 tooth, 40 tooth', () => {
  const { parts, mech, kin } = load('models/gear-train.ldr');
  const small = jointOf(parts, mech, '3647.dat');
  const middle = jointOf(parts, mech, '3648.dat');
  const large = jointOf(parts, mech, '3649.dat');

  it('finds three gear bodies, three axle joints and two meshes', () => {
    expect(mech.bodies).toHaveLength(4); // frame + three axle-and-gear bodies
    expect(mech.joints).toHaveLength(3);
    expect(mech.meshes).toHaveLength(2);
  });

  it('can move one way only, since the gears lock the axles together', () => {
    expect(kin.freeMotions()).toHaveLength(1);
  });

  it('turns at the right ratios: 24 tooth at -1/3, 40 tooth at +1/5', () => {
    kin.reset();
    kin.turnJoint(small, TURN);
    expect(kin.jointAngles[small]).toBeCloseTo(TURN, 6);
    expect(kin.jointAngles[middle]).toBeCloseTo(-TURN / 3, 6);
    expect(kin.jointAngles[large]).toBeCloseTo(TURN / 5, 6);
  });

  it('drives backwards too: turning the 40 tooth gear turns the 8 tooth gear 5 times as far', () => {
    kin.reset();
    kin.turnJoint(large, TURN / 5);
    expect(kin.jointAngles[small]).toBeCloseTo(TURN, 6);
  });
});

describe('geared car', () => {
  const { parts, mech, kin } = load('models/geared-car.ldr');
  const rearAxle = jointOf(parts, mech, '3647.dat', 0); // the gear on the rear wheel axle
  const driven = jointOf(parts, mech, '3647.dat', 1); // the gear on the extra axle

  it('still rolls one way only, with the extra axle driven by the gears', () => {
    expect(mech.meshes).toHaveLength(1);
    expect(kin.freeMotions()).toHaveLength(1);
  });

  it('spins the extra axle the other way as the car rolls (8 tooth to 8 tooth)', () => {
    kin.reset();
    kin.turnJoint(rearAxle, TURN);
    expect(kin.jointAngles[driven]).toBeCloseTo(-TURN, 6);
  });
});

describe('simple car, turning a wheel', () => {
  it('rolls the car one tyre circumference per turn', () => {
    const { kin } = load('models/simple-car.ldr');
    kin.turnJoint(0, TURN);
    const moved = kin.poses[0].elements[12]; // x translation of the frame
    expect(Math.abs(moved)).toBeCloseTo(TURN * 31.002, 3);
  });
});

describe('every gear in the LDraw library', () => {
  // LEGO's gears all share one tooth size: a pitch radius of 1.25 LDU (half a millimetre) per
  // tooth, 10 LDU for an 8 tooth gear, 30 for a 24. Gears of different sizes mesh only if their
  // radii say so (a 12 tooth bevel gear with a 20 tooth one, a 14 tooth bevel pinion with the old
  // differential's crown wheel), so a radius measured off a gear's shape breaks those meshes.
  // The knob wheel (32072) is the one exception: its four knobs aren't teeth of LEGO's size, and
  // its size keeps it meshing only with another knob wheel.
  const OWN_SIZE = ['32072.dat'];
  it("has LEGO's tooth size", () => {
    const library = JSON.parse(readFileSync('data/library-connections.json', 'utf-8'));
    const wrong = Object.entries(library.parts as Record<string, number[]>).filter(([part]) => !OWN_SIZE.includes(part)).flatMap(([part, cylinders]) =>
      cylinders.flatMap((i) => library.cylinders[i].secs.filter((s: { shape: string; teeth?: number; rack?: unknown; worm?: number; radius: number }) => s.shape === 'G' && s.teeth && !s.rack && !s.worm && Math.abs(s.radius / s.teeth - 1.25) > 0.01).map(() => part)),
    );
    expect(wrong).toEqual([]);
  });
});

// The free-parts rule (decision 309; Options.freeParts): a gear free on a turning shaft (2471, a round
// hole), meshing with a train of two in neutral, slips on its shaft, one joint, rather than run the
// train, two. Without the rule the solver mixes the two (the gear slips two thirds, the train runs a
// third). The same whichever way the tree of joints grows: the model as written, and with the gear
// listed first.
describe('an idle gear on a turning shaft, beside a train in neutral', () => {
  const turnOf = (text: string, freeParts: 'off' | 'all') => {
    const parts = parseLdr(text);
    const mech = inferMechanism(parts, table, roles);
    const kin = new Kinematics(mech, { freeParts });
    const shaft = mech.bodyOf[parts.findIndex((p) => p.name === '3704.dat')];
    const gear = mech.bodyOf[parts.findIndex((p) => p.name === '2471.dat')];
    const train = parts.flatMap((p, i) => (p.name === '3648.dat' ? [mech.bodyOf[i]] : []));
    const link = kin.parentLink(shaft)!;
    const before = kin.poses.map((m) => m.clone());
    kin.holdWhatTheDragDoesntNeed(shaft, () => kin.jointMotion(link.joint) !== null, link.joint);
    expect(kin.turnJoint(link.joint, 0.5)).toBeCloseTo(0.5, 9);
    kin.letGoAfterDrag();
    // How far a body turned against the frame.
    const turned = (b: number) => {
      const q = new Quaternion().setFromRotationMatrix(before[b].clone().invert().multiply(kin.poses[b]));
      return 2 * Math.acos(Math.min(1, Math.abs(q.w)));
    };
    return { gear: turned(gear), train: train.map(turned) };
  };
  const written = readFileSync('tests/fixtures/idle-gear.ldr', 'utf-8');
  const lines = written.split('\n');
  const gearLine = lines.findIndex((l) => l.includes('2471.dat'));
  const gearFirst = [lines[gearLine], ...lines.filter((_, i) => i !== gearLine)].join('\n');
  for (const [what, text] of [['as written', written], ['with the gear listed first', gearFirst]] as const) {
    it(`slips the gear and leaves the train still with the rule on (${what})`, () => {
      const { gear, train } = turnOf(text, 'all');
      expect(gear).toBeLessThan(1e-6);
      for (const t of train) expect(t).toBeLessThan(1e-6);
    });
  }
  it('mixes the two without it', () => {
    const { train } = turnOf(written, 'off');
    expect(Math.max(...train)).toBeGreaterThan(0.1);
  });
});
