import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ConnectionTable } from './connections.ts';
import { parseLdr } from './ldr.ts';
import { inferMechanism } from './mechanism.ts';

const table: ConnectionTable = JSON.parse(readFileSync('data/connections.json', 'utf-8'));
const roles: Record<string, string> = JSON.parse(readFileSync('data/roles.json', 'utf-8'));

describe('simple car', () => {
  const parts = parseLdr(readFileSync('models/simple-car.ldr', 'utf-8'));
  const mech = inferMechanism(parts, table, roles);
  const partNames = (body: number) => mech.bodies[body].parts.map((i) => parts[i].name).sort();

  it('has a frame and two wheel-and-axle bodies', () => {
    expect(mech.bodies.map((b) => b.name)).toEqual(['frame', 'body 1', 'body 2']);
    expect(partNames(0)).toEqual(['3035.dat', '3701.dat', '3701.dat', '3894.dat', '3894.dat']);
    for (const body of [1, 2]) {
      expect(partNames(body)).toEqual(['3482.dat', '3482.dat', '3483.dat', '3483.dat', '3706.dat']);
    }
  });

  it('has one turning joint per axle, through the 1x6 bricks', () => {
    expect(mech.joints).toHaveLength(2);
    const axleXs = mech.joints.map((j) => j.from.x).sort((a, b) => a - b);
    expect(axleXs).toEqual([-40, 40]);
    for (const j of mech.joints) {
      expect(j.bodyA).toBe(0);
      expect(j.from.y).toBeCloseTo(-14);
      expect(j.to.y).toBeCloseTo(-14);
      expect(j.from.x).toBeCloseTo(j.to.x); // axis runs across the car, along z
      // The axle turns in the inner 16 LDU of each 1x6 brick's hole: z from 22 to 38 on each side.
      expect(Math.min(j.from.z, j.to.z)).toBeCloseTo(-38);
      expect(Math.max(j.from.z, j.to.z)).toBeCloseTo(38);
    }
  });
});
