import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ConnectionTable, libraryConnections } from '../src/connections.ts';
import { parseLdr } from '../src/ldr.ts';
import { inferMechanism } from '../src/mechanism.ts';

const table: ConnectionTable = JSON.parse(readFileSync('data/connections.json', 'utf-8'));
const roles: Record<string, string> = JSON.parse(readFileSync('data/roles.json', 'utf-8'));

describe('simple car', () => {
  const parts = parseLdr(readFileSync('models/simple-car.ldr', 'utf-8'));
  const mech = inferMechanism(parts, table, roles);
  const partNames = (body: number) => mech.bodies[body].parts.map((i) => parts[i].name).sort();

  it('has a frame and two wheel-and-axle bodies', () => {
    expect(mech.bodies.map((b) => b.name)).toEqual(['frame', 'wheels 1', 'wheels 2']);
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

describe("a constant velocity joint's nudged ball in a portal axle's steering hub", () => {
  // As official cars seat them (the 42037 Formula Off-Roader's, the 42077 Rally Car's): the
  // ball (32494) in the hub's socket (92909's, on its axis, z, 30 LDU in), its axle hole
  // pointing out of the hub along the same axis.
  const library = libraryConnections(JSON.parse(readFileSync('data/library-connections.json', 'utf-8')));
  const parts = parseLdr('1 72 0 0 0 1 0 0 0 1 0 0 0 1 92909.dat\n1 71 0 0 30 1 0 0 0 1 0 0 0 1 32494.dat');
  const mech = inferMechanism(parts, library, roles);
  const [hub, ball] = [mech.bodyOf[0], mech.bodyOf[1]];

  it('drives the hub: their turning is tied, about the hub\'s own axis', () => {
    const coupling = mech.couplings.find((c) => [c.bodyA, c.bodyB].includes(hub) && [c.bodyA, c.bodyB].includes(ball));
    expect(coupling?.turningOnly).toBe(true);
    const hubAxis = coupling!.bodyA === hub ? coupling!.axisA : coupling!.axisB;
    expect(Math.abs(hubAxis.z)).toBeCloseTo(1, 6);
  });

  it('still holds the ball in its socket, as nothing else may hold a half shaft\'s end', () => {
    expect(mech.joints.some((j) => j.kind === 'ball' && [j.bodyA, j.bodyB].includes(hub) && [j.bodyA, j.bodyB].includes(ball))).toBe(true);
  });
});
