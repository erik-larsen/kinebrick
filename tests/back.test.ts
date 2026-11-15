import { Matrix4, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { turnOffAxis } from '../scripts/back.ts';

describe('turnOffAxis', () => {
  const x = new Vector3(1, 0, 0);
  const at = new Matrix4().makeTranslation(10, -129, -181);

  it('leaves out a turn about the axis', () => {
    // A pin left turned 147.7 degrees in its holes (the 42037's p5 and p6).
    const now = at.clone().multiply(new Matrix4().makeRotationX((147.7 * Math.PI) / 180));
    expect(turnOffAxis(at, now, x)).toBeCloseTo(0, 9);
  });

  it('keeps a turn about another line', () => {
    const now = at.clone().multiply(new Matrix4().makeRotationY(0.3));
    expect(turnOffAxis(at, now, x)).toBeCloseTo(0.3, 9);
  });

  it('keeps only what is off the axis of a mixed turn', () => {
    const now = at.clone().multiply(new Matrix4().makeRotationX(2)).multiply(new Matrix4().makeRotationY(0.1));
    expect(turnOffAxis(at, now, x)).toBeCloseTo(0.1, 6);
  });
});
