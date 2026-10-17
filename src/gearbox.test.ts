import { readFileSync } from 'node:fs';
import { Quaternion } from 'three';
import { describe, expect, it } from 'vitest';
import { ConnectionTable } from './connections.ts';
import { Kinematics } from './kinematics.ts';
import { parseLdr, PlacedPart } from './ldr.ts';
import { inferMechanism } from './mechanism.ts';
import { findSliders, nearestPosition, sliderMovedTo, sliderPosition } from './shift.ts';

const table: ConnectionTable = JSON.parse(readFileSync('data/connections.json', 'utf-8'));
const roles: Record<string, string> = JSON.parse(readFileSync('data/roles.json', 'utf-8'));
const QUARTER = Math.PI / 2;

// The gearbox with its driving ring shifted to `position` (-10 first gear, 0 neutral, +10 second).
function gearbox(position: number) {
  const parts: PlacedPart[] = parseLdr(readFileSync('models/gearbox.ldr', 'utf-8'));
  const [slider] = findSliders(parts, inferMechanism(parts, table, roles), table);
  parts[slider.part] = { ...parts[slider.part], matrix: sliderMovedTo(parts, table, slider, position) };
  const mech = inferMechanism(parts, table, roles);
  const kin = new Kinematics(mech);
  const bodyOf = (name: string) => mech.bodyOf[parts.findIndex((p) => p.name === name)];
  const input = kin.parentLink(bodyOf('3707.dat'))!.joint;
  // Turn the input a quarter turn, as a drag would, and see how far the output shaft turned in
  // the frame (from its pose: its joint angle may be measured against a freewheeling gear).
  kin.holdWhatTheDragDoesntNeed(bodyOf('3707.dat'), () => kin.jointMotion(input) !== null);
  kin.turnJoint(input, QUARTER);
  kin.letGoAfterDrag();
  const turned = new Quaternion().setFromRotationMatrix(kin.poses[bodyOf('18948.dat')]);
  return { parts, mech, slider, outputTurned: 2 * Math.acos(Math.min(1, Math.abs(turned.w))) };
}

describe('two-speed gearbox', () => {
  it('has one driving ring, sitting on the axle joiner, centred, with three places to click into', () => {
    const parts = parseLdr(readFileSync('models/gearbox.ldr', 'utf-8'));
    const sliders = findSliders(parts, inferMechanism(parts, table, roles), table);
    expect(sliders).toHaveLength(1);
    expect(parts[sliders[0].part].name).toBe('18947.dat');
    expect(parts[sliders[0].base].name).toBe('18948.dat');
    expect(sliderPosition(parts, table, sliders[0])).toBeCloseTo(0, 9);
    expect(sliders[0].positions).toEqual([-10, 0, 10]);
    expect(nearestPosition(sliders[0], 6)).toBe(10);
  });

  it('in neutral, turning the input leaves the output still', () => {
    expect(gearbox(0).outputTurned).toBeCloseTo(0, 9);
  });

  it('in first gear (towards the 24 tooth gear), the output turns a third as far: 8 teeth to 24', () => {
    expect(gearbox(-10).outputTurned).toBeCloseTo(QUARTER / 3, 6);
  });

  it('in second gear (towards the 16 tooth gear), the output turns as far as the input: 16 to 16', () => {
    expect(gearbox(10).outputTurned).toBeCloseTo(QUARTER, 6);
  });

  it('is fully attached in every position', () => {
    for (const p of [-10, 0, 10]) expect(gearbox(p).mech.loose).toEqual([]);
  });
});
