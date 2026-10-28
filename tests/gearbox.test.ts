import { readFileSync } from 'node:fs';
import { Matrix4, Quaternion } from 'three';
import { describe, expect, it } from 'vitest';
import { ConnectionTable, libraryConnections } from '../src/connections.ts';
import { Kinematics } from '../src/kinematics.ts';
import { parseLdr, PlacedPart } from '../src/ldr.ts';
import { inferMechanism } from '../src/mechanism.ts';
import { catchShifts, findCatches, findSliders, findSticks, nearestPosition, sliderMovedTo, sliderPosition, stickPositionNow, stickPositions } from '../src/shift.ts';

const table: ConnectionTable = JSON.parse(readFileSync('data/connections.json', 'utf-8'));
const roles: Record<string, string> = JSON.parse(readFileSync('data/roles.json', 'utf-8'));
const QUARTER = Math.PI / 2;

// The gearbox with its driving ring shifted to `position` (-10 first gear, 0 neutral, +10 second).
function gearbox(position: number) {
  const parts: PlacedPart[] = parseLdr(readFileSync('models/gearbox.ldr', 'utf-8'));
  const [slider] = findSliders(parts, inferMechanism(parts, table, roles), table);
  parts[slider.part] = { ...parts[slider.part], matrix: sliderMovedTo(parts, table, slider, position) };
  return { ...turnInput(parts), slider };
}

// The gearbox's mechanism, as its parts now are, and how far its output shaft turns for a
// quarter turn of the input.
function turnInput(parts: PlacedPart[]) {
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
  return { parts, mech, outputTurned: 2 * Math.acos(Math.min(1, Math.abs(turned.w))) };
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

  it("its gear lever clicks into its gate: tilted into the slots on the input axle's side, its foot slides the ring into first and second; in the middle, and in the two slots on the other side, which swing its foot away from the ring, neutral; and it knows which place it's in", () => {
    const parts = parseLdr(readFileSync('models/gearbox.ldr', 'utf-8'));
    const mech = inferMechanism(parts, table, roles);
    const sticks = findSticks(parts, roles, findSliders(parts, mech, table));
    expect(sticks).toHaveLength(1);
    const [stick] = sticks;
    expect(parts[stick.part].name).toBe('6549.dat');
    expect(stick.rings.map((r) => parts[r.part].name)).toEqual(['18947.dat']);
    const positions = stickPositions(parts, table, stick);
    expect(positions).toHaveLength(5);
    expect(stickPositionNow(parts, table, stick, positions)).toBe(0); // built in neutral
    const [ring] = stick.rings;
    const lever = mech.bodies[mech.bodyOf[stick.part]].parts;
    const outputs = positions.map((position, k) => {
      const shifted = parts.map((p, i) => (lever.includes(i) ? { ...p, matrix: position.turn.clone().multiply(p.matrix) } : p));
      shifted[ring.part] = { ...shifted[ring.part], matrix: sliderMovedTo(shifted, table, ring, position.rings.get(ring.part)!) };
      // Read afresh, as the viewer does after a shift, it's still a gear lever, and knows which
      // place it's in, even in a slot that swings its foot out of the ring's reach and leaves the
      // ring in its middle, as neutral does: so it can be dragged back from there.
      const { mech: m, outputTurned } = turnInput(shifted);
      const [again] = findSticks(shifted, roles, findSliders(shifted, m, table));
      expect(again?.part).toBe(stick.part);
      expect(stickPositionNow(shifted, table, again, stickPositions(shifted, table, again))).toBe(k);
      expect(m.loose).toEqual([]);
      return outputTurned / QUARTER;
    });
    // How far the output turns for each turn of the input: neutral in the middle, then each slot.
    expect(outputs[0]).toBeCloseTo(0, 9);
    expect(outputs.slice(1).sort((a, b) => a - b).map((x) => +x.toFixed(6))).toEqual([0, 0, +(1 / 3).toFixed(6), 1]);
  });
});

// A changeover catch, its pin, and the driving ring its fork sits in, between two clutch gears on
// its axle joiner, as the 42038 Arctic Truck has them, read with the whole library's table.
describe('a changeover catch', () => {
  const library = libraryConnections(JSON.parse(readFileSync('data/library-connections.json', 'utf-8')));
  const parts: PlacedPart[] = parseLdr(
    [
      '1 16 0 0 0 -1 0 0 0 0 -1 0 -1 0 6641.dat',
      '1 16 2 20 0 -1 0 0 0 -1 0 0 0 1 18651.dat',
      '1 16 0 60 0 0 1 0 1 0 0 0 0 -1 18947.dat',
      '1 16 0 60 0 0 1 0 1 0 0 0 0 -1 18948.dat',
      '1 16 0 60 40 0 1 0 1 0 0 0 0 -1 18946.dat',
      '1 16 0 60 -40 0 1 0 1 0 0 0 0 -1 18946.dat',
    ].join('\n'),
  );
  const mech = inferMechanism(parts, library, roles);
  const sliders = findSliders(parts, mech, library);
  const catches = findCatches(parts, sliders);
  // The parts with the catch turned by `angle` about its pin, which runs along x, 20 LDU below it.
  const turned = (angle: number) => {
    const turn = new Matrix4().makeTranslation(0, 20, 0).multiply(new Matrix4().makeRotationX(angle)).multiply(new Matrix4().makeTranslation(0, -20, 0));
    return parts.map((p, i) => (i === 0 ? { ...p, matrix: turn.clone().multiply(p.matrix) } : p));
  };

  it('finds the ring its fork sits in', () => {
    expect(catches).toHaveLength(1);
    expect(catches[0].ring.part).toBe(2);
  });

  it("leaves the ring where it is while the fork's nearest its click-in position", () => {
    expect(catchShifts(parts, library, catches).size).toBe(0);
    expect(catchShifts(turned(0.1), library, catches).size).toBe(0);
  });

  it('slides the ring to the click-in position either side as the catch turns a quarter radian either way: 40 LDU a radian', () => {
    const ways = [0.25, -0.25].map((angle) => catchShifts(turned(angle), library, catches).get(2));
    expect(ways.map((x) => Math.abs(x!))).toEqual([10, 10]);
    expect(ways[0]).toBe(-ways[1]!);
  });

  it('and so locks one clutch gear or the other to the axle joiner', () => {
    for (const to of [-10, 10]) {
      const placed = parts.map((p) => ({ ...p }));
      placed[2] = { ...placed[2], matrix: sliderMovedTo(placed, library, sliders[0], to) };
      const after = inferMechanism(placed, library, roles);
      const locked = [4, 5].filter((g) => after.connections.some((c) => c.kind === 'rigid' && [c.male, c.female].includes(2) && [c.male, c.female].includes(g)));
      expect(locked).toHaveLength(1);
    }
  });
});
