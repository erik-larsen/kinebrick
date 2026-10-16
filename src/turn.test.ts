import { Ray, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { knobTurn } from './turn.ts';

// An axle along z through the origin, seen from in front (looking along -z).
const hub = new Vector3(0, 0, 0);
const dir = new Vector3(0, 0, 1);
const pointerAt = (x: number, y: number) => new Ray(new Vector3(x, y, 100), new Vector3(0, 0, -1));
const pointerAtAngle = (r: number, angle: number) => pointerAt(r * Math.cos(angle), r * Math.sin(angle));

describe('turning a part like a knob', () => {
  it('turns by the angle the pointer sweeps around the axle', () => {
    const angle = knobTurn({ hub, dir, from: pointerAtAngle(40, 0.2), to: pointerAtAngle(40, 0.5), minRadius: 20 })!;
    expect(angle).toBeCloseTo(0.3, 6);
  });

  it('keeps in step with the pointer over several full turns, even on a small gear', () => {
    // The pointer circles an 8 tooth gear's teeth (radius 12) three times in jumps of
    // 0.8 radians, as a quick mouse might.
    const r = 12;
    const steps = Math.ceil((3 * 2 * Math.PI) / 0.8);
    const stepAngle = (3 * 2 * Math.PI) / steps;
    let total = 0;
    for (let i = 0; i < steps; i++) {
      total += knobTurn({ hub, dir, from: pointerAtAngle(r, i * stepAngle), to: pointerAtAngle(r, (i + 1) * stepAngle), minRadius: r / 2 })!;
    }
    expect(total).toBeCloseTo(3 * 2 * Math.PI, 6);
  });

  it("doesn't turn when the pointer doesn't move, wherever the axle is", () => {
    // Even if the axle has moved since (a rolling car), the same pointer gives no turn.
    const moved = new Vector3(25, 0, 0);
    const turn = knobTurn({ hub: moved, dir, from: pointerAt(10, -31), to: pointerAt(10, -31), minRadius: 15 });
    expect(turn).toBeCloseTo(0, 9);
  });

  it('gives a short turn for a short drag right next to the axle', () => {
    // A 2 LDU move passing within 1 LDU of the axle would sweep about 127 degrees around it.
    const angle = knobTurn({ hub, dir, from: pointerAt(-1, 1), to: pointerAt(1, 1), minRadius: 5 })!;
    expect(Math.abs(angle)).toBeLessThanOrEqual(2 / 5 + 1e-9);
  });

  it('turns the right way: anticlockwise about +z is positive', () => {
    expect(knobTurn({ hub, dir, from: pointerAt(40, 0), to: pointerAt(40, 5), minRadius: 20 })!).toBeGreaterThan(0);
    expect(knobTurn({ hub, dir, from: pointerAt(40, 0), to: pointerAt(40, -5), minRadius: 20 })!).toBeLessThan(0);
  });

  it('gives up when the plane of turning is seen edge-on', () => {
    const sideOn = (y: number) => new Ray(new Vector3(100, y, 0), new Vector3(-1, 0, 0));
    expect(knobTurn({ hub, dir, from: sideOn(0), to: sideOn(5), minRadius: 20 })).toBeNull();
  });
});
