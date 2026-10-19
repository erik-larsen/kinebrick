import { Matrix4, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { Kinematics } from '../../src/kinematics.ts';
import { inferMechanism } from '../../src/mechanism.ts';
import { load, roles, table } from './load.ts';

describe('8880 Super Car', () => {
  const { parts, mech, kin, bodyOf, turn, motor, frameMoved } = load('models/8880-Super Car.mpd');
  // Its wheels' steering knuckles (6540b), front ones first, and how far each has turned about
  // the upright, in degrees.
  const knuckles = mech.bodies.flatMap((b, i) => (b.parts.some((p) => parts[p].name === '6540b.dat') ? [i] : []));
  const at = (body: number) => new Vector3().setFromMatrixPosition(parts[mech.bodies[body].parts[0]].matrix); // where it was built
  const steered = (body: number) => (Math.atan2(kin.poses[body].elements[8], kin.poses[body].elements[0]) * 180) / Math.PI;
  const crank = () => kin.jointAngles[kin.parentLink(bodyOf('2853.dat'))!.joint];

  it('is fully attached: hinge plates hold its bodywork at its angles, and its driveshafts turn its steered wheels through grooved balls', () => {
    expect(mech.loose).toEqual([]);
    expect(mech.couplings).toHaveLength(6); // two universal joints in the steering, four grooved balls
    expect(mech.loops).toHaveLength(1); // the chain from the gearbox to the engine
    expect(knuckles).toHaveLength(4);
  });

  it('a turn of a wheel rolls it one big tyre round, through its three differentials; in neutral its V8 stays still', () => {
    kin.reset();
    expect(Math.abs(turn(bodyOf('2998.dat'), 1))).toBeCloseTo(1, 6);
    expect(frameMoved()).toBeCloseTo(101.4, 0); // the tyre's radius
    expect(crank()).toBeCloseTo(0, 6);
  });

  it('turning the steering wheel steers the front wheels one way and the rear ones the other, about half as far, and the car stays where it is', () => {
    kin.reset();
    const front = knuckles.filter((b) => at(b).z < 0);
    const rear = knuckles.filter((b) => at(b).z > 0);
    expect(turn(bodyOf('2741.dat'), 1.5)).toBeCloseTo(1.5, 6);
    const [f1, f2] = front.map(steered);
    const [r1, r2] = rear.map(steered);
    expect(Math.sign(f1)).toBe(Math.sign(f2));
    expect(Math.sign(r1)).toBe(Math.sign(r2));
    expect(Math.sign(r1)).toBe(-Math.sign(f1));
    const ratio = (Math.abs(r1) + Math.abs(r2)) / (Math.abs(f1) + Math.abs(f2));
    expect(ratio).toBeGreaterThan(0.35);
    expect(ratio).toBeLessThan(0.65);
    expect(frameMoved()).toBeLessThan(1e-6);
  });

  it('its four-speed gearbox: each driving ring, shifted either way, puts the engine in gear with the wheels', () => {
    const rings = parts.flatMap((p, i) => (p.name === '6539.dat' ? [i] : []));
    const ratios: number[] = [];
    for (const ring of rings) {
      for (const by of [-5, 5]) {
        const shifted = parts.map((p, i) => {
          if (i !== ring) return p;
          const dir = new Vector3(0, 0, 1).transformDirection(p.matrix);
          return { ...p, matrix: new Matrix4().makeTranslation(dir.x * by, dir.y * by, dir.z * by).multiply(p.matrix) };
        });
        const m = inferMechanism(shifted, table, roles, mech.loops.map((l) => l.path));
        const k = new Kinematics(m);
        const wheel = m.bodyOf[shifted.findIndex((p) => p.name === '2998.dat')];
        const joint = k.parentLink(wheel)!.joint;
        k.holdWhatTheDragDoesntNeed(wheel, () => k.jointMotion(joint) !== null, joint);
        const turned = k.turnJoint(joint, 0.25);
        ratios.push(Math.abs(k.jointAngles[k.parentLink(m.bodyOf[shifted.findIndex((p) => p.name === '2853.dat')])!.joint] / turned));
      }
    }
    // Engine turns per turn of the wheels: 1st, 2nd, 3rd and 4th gear.
    expect(ratios.sort((a, b) => b - a).map((r) => +r.toFixed(3))).toEqual([2.25, 1.5, 0.75, 0.5]);
  });

  it('steered near full lock, a front wheel kept turning by the motor takes it round a corner through its three differentials, its steering left where it was and its tyres scrubbing sideways by up to the 4% its file allows', () => {
    expect(kin.scrub).toBe(0.04);
    kin.reset();
    const steeringWheel = bodyOf('2741.dat');
    turn(steeringWheel, 3); // it stops at 3.64
    const heading = Math.atan2(kin.poses[0].elements[8], kin.poses[0].elements[0]);
    expect(motor(bodyOf('2998.dat'), 24)).toBeCloseTo(2 * Math.PI, 6); // a turn of the wheel
    expect(kin.jointAngles[kin.parentLink(steeringWheel)!.joint]).toBeCloseTo(3, 6);
    const turned = Math.atan2(kin.poses[0].elements[8], kin.poses[0].elements[0]) - heading;
    expect(Math.abs(turned) * (180 / Math.PI)).toBeGreaterThan(15);
  });
});
