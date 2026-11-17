import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import type { Connection } from '../src/mechanism.ts';
import { throughOutputs } from '../src/inference/motors.ts';

// A motor's output that goes through it turns an axle in each face alike.
describe('a motor whose output goes through it', () => {
  const v = (x: number) => new Vector3(x, 0, 0);
  const inMotor = (male: number, a: number, b: number): Connection => ({ male, female: 9, kind: 'revolute', from: v(a), to: v(b), stiff: true, motor: true });
  it('joins an axle in each face', () => {
    const added = throughOutputs([inMotor(1, -70, -50), inMotor(2, -130, -110)]);
    expect(added.map((c) => [c.male, c.female, c.kind])).toEqual([[1, 2, 'rigid']]);
  });
  it("doesn't join axles on other axes, or turning in other parts", () => {
    const aside: Connection = { male: 3, female: 9, kind: 'revolute', from: new Vector3(0, 20, 0), to: new Vector3(10, 20, 0), stiff: true, motor: true };
    const plain: Connection = { male: 4, female: 9, kind: 'revolute', from: v(-130), to: v(-110) };
    expect(throughOutputs([inMotor(1, -70, -50), aside, plain])).toEqual([]);
  });
});
