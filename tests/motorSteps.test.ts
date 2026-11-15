// The motor's steps (motorSteps in src/interaction.ts): 15 degree steps while a model keeps up,
// fewer and larger ones (up to 45 degrees) when its steps are slow.

import { describe, expect, it } from 'vitest';
import { motorSteps } from '../src/interaction.ts';

const deg = (d: number) => (d * Math.PI) / 180;

describe('motor steps', () => {
  it('keeps 15 degree steps while they fit in the frame budget, or before any step is timed', () => {
    expect(motorSteps(deg(40), 5)).toEqual({ angle: deg(40), maxStep: deg(15) }); // 3 steps, 15 ms
    expect(motorSteps(deg(40), null)).toEqual({ angle: deg(40), maxStep: deg(15) });
  });

  it('takes fewer, larger steps on a slow model (the 6990, 36 ms a step): one step a frame', () => {
    const { angle, maxStep } = motorSteps(deg(24), 36);
    expect(angle).toBeCloseTo(deg(24), 12);
    expect(Math.ceil(angle / maxStep)).toBe(1);
  });

  it('turns no more than its largest steps go, the way it was asked, and runs slower than asked', () => {
    const { angle, maxStep } = motorSteps(-deg(70), 20); // a step fits in 30 ms, at most 45 degrees
    expect(angle).toBeCloseTo(-deg(45), 12);
    expect(Math.ceil(-angle / maxStep)).toBe(1);
  });

  it('splits a turn into as many larger steps as fit', () => {
    const { angle, maxStep } = motorSteps(deg(60), 12); // 2 steps fit in 30 ms
    expect(angle).toBeCloseTo(deg(60), 12);
    expect(Math.ceil(angle / maxStep)).toBe(2);
  });
});
