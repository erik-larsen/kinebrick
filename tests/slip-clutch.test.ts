import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import type { Connection } from '../src/mechanism.ts';
import { slipClutches } from '../src/inference/pins.ts';

// A slip clutch's halves turn on each other, held as a friction pin's joints are.
describe('a slip clutch', () => {
  const roles = ['slip clutch', 'slip clutch', 'axle'];
  const fit = (): Connection[] => [
    { male: 0, female: 1, kind: 'revolute', from: new Vector3(), to: new Vector3() },
    { male: 2, female: 1, kind: 'revolute', from: new Vector3(), to: new Vector3() },
  ];
  it('is held where friction holds', () => {
    const c = fit();
    slipClutches(c, roles, true, new Set());
    expect([c[0].kind, c[0].held]).toEqual(['rigid', true]);
    expect(c[1].kind).toBe('revolute');
  });
  it('slips, stiffly, where freed or with friction free', () => {
    const freed = fit();
    slipClutches(freed, roles, true, new Set([0]));
    expect([freed[0].kind, freed[0].stiff]).toEqual(['revolute', true]);
    const free = fit();
    slipClutches(free, roles, false, new Set());
    expect([free[0].kind, free[0].stiff]).toEqual(['revolute', true]);
  });
});
