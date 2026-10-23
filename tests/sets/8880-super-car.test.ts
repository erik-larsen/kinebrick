import { Matrix4, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { Kinematics } from '../../src/kinematics.ts';
import { inferMechanism } from '../../src/mechanism.ts';
import { findSliders, findSticks, sliderMovedTo, stickPositionNow, stickPositions } from '../../src/shift.ts';
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

  it('its steering knob, a small tyre on its back, steers it as its steering wheel does, the car staying where it is', () => {
    // Turned as a drag does: what it doesn't need held, then turned a little at a time. Being a
    // wheel, it once let the car roll, and stopped after a few steps (0.125) as if at a dead point.
    const steerBy = (body: number, angle: number) => {
      kin.reset();
      const joint = kin.parentLink(body)!.joint;
      kin.holdWhatTheDragDoesntNeed(body, () => kin.jointMotion(joint) !== null, joint);
      let turned = 0;
      for (let i = 0; i < Math.round(Math.abs(angle) / 0.05); i++) turned += kin.turnJoint(joint, Math.sign(angle) * 0.05);
      kin.letGoAfterDrag();
      return { turned, steered: knuckles.map(steered), steeringWheel: kin.jointAngles[kin.parentLink(bodyOf('2741.dat'))!.joint] };
    };
    const knob = bodyOf('3482.dat');
    const byKnob = steerBy(knob, 0.5);
    expect(byKnob.turned).toBeCloseTo(0.5, 6);
    expect(Math.abs(byKnob.steeringWheel)).toBeCloseTo(0.5, 4); // through two 24 tooth gears and two bevel gears
    expect(frameMoved()).toBeLessThan(1e-6);
    const byWheel = steerBy(bodyOf('2741.dat'), byKnob.steeringWheel);
    byKnob.steered.forEach((a, i) => expect(a).toBeCloseTo(byWheel.steered[i], 3));
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

  it('its gear lever clicks into its gate: in the middle, neutral; tilted into each slot, its foot slides one driving ring, putting the engine in each of its four gears', () => {
    const sticks = findSticks(parts, roles, findSliders(parts, mech, table));
    expect(sticks).toHaveLength(1);
    const [stick] = sticks;
    expect(parts[stick.part].name).toBe('6549.dat');
    expect(stick.rings.map((r) => parts[r.part].name)).toEqual(['6539.dat', '6539.dat']);
    const positions = stickPositions(parts, table, stick);
    expect(positions).toHaveLength(5);
    expect(stickPositionNow(parts, table, stick, positions)).toBe(0); // built in neutral
    const ratios: number[] = [];
    positions.forEach((position, k) => {
      const lever = mech.bodies[mech.bodyOf[stick.part]].parts;
      const shifted = parts.map((p, i) => (lever.includes(i) ? { ...p, matrix: position.turn.clone().multiply(p.matrix) } : p));
      for (const ring of stick.rings) shifted[ring.part] = { ...shifted[ring.part], matrix: sliderMovedTo(shifted, table, ring, position.rings.get(ring.part)!) };
      // Each gear slides one ring, and only one; neutral none.
      expect([...position.rings.values()].filter((at) => at !== 0)).toHaveLength(k === 0 ? 0 : 1);
      const m = inferMechanism(shifted, table, roles, mech.loops.map((l) => l.path));
      expect(m.loose).toEqual([]);
      const k2 = new Kinematics(m);
      const wheel = m.bodyOf[shifted.findIndex((p) => p.name === '2998.dat')];
      const joint = k2.parentLink(wheel)!.joint;
      k2.holdWhatTheDragDoesntNeed(wheel, () => k2.jointMotion(joint) !== null, joint);
      const turned = k2.turnJoint(joint, 0.25);
      ratios.push(+Math.abs(k2.jointAngles[k2.parentLink(m.bodyOf[shifted.findIndex((p) => p.name === '2853.dat')])!.joint] / turned).toFixed(3));
    });
    // Engine turns per turn of the wheels: neutral, then each gear.
    expect(ratios[0]).toBe(0);
    expect(ratios.slice(1).sort((a, b) => b - a)).toEqual([2.25, 1.5, 0.75, 0.5]);
  });

  it('steered near full lock, a front wheel kept turning by the motor takes it round a corner through its three differentials, its steering left where it was and its tyres scrubbing sideways by up to the 10% KineBrick allows', () => {
    expect(kin.scrub).toBe(0.1);
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
