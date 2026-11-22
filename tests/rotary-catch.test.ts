import { describe, expect, it } from 'vitest';
import { camAt } from '../src/shift.ts';

// A rotary changeover catch's cam (35188, see CAM in src/shift.ts): where it holds a driving ring
// that faces it at an angle, along its own axis.
describe("a rotary catch's cam", () => {
  it('holds a ring in its middle at 0 and 180 degrees, 10 LDU along at 90, 10 back at -90 and 270', () => {
    expect(camAt(0)).toBe(0);
    expect(camAt(180)).toBe(0);
    expect(camAt(90)).toBe(10);
    expect(camAt(-90)).toBe(-10);
    expect(camAt(270)).toBe(-10);
  });
  it('is the same at angles a whole turn apart, and odd: the other way at the opposite angle', () => {
    for (const a of [5, 30, 45, 60, 120, 170]) {
      expect(camAt(a + 360)).toBeCloseTo(camAt(a), 9);
      expect(camAt(-a)).toBeCloseTo(-camAt(a), 9);
    }
  });
  it('gives a number for an angle a hair below 0 or 180 (it once recursed without end)', () => {
    expect(Number.isFinite(camAt(-1e-15))).toBe(true);
    expect(Number.isFinite(camAt(-180))).toBe(true);
  });
});
