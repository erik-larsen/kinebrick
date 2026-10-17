import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ConnectionTable } from '../src/connections.ts';
import { parseLdr } from '../src/ldr.ts';
import { inferMechanism } from '../src/mechanism.ts';

const table: ConnectionTable = JSON.parse(readFileSync('data/connections.json', 'utf-8'));
const roles: Record<string, string> = JSON.parse(readFileSync('data/roles.json', 'utf-8'));

function looseParts(text: string): string[] {
  const parts = parseLdr(text);
  return inferMechanism(parts, table, roles).loose.map((i) => parts[i].name);
}

describe('every test model is fully attached', () => {
  for (const file of readdirSync('models').filter((f) => f.endsWith('.ldr'))) {
    it(file, () => {
      expect(looseParts(readFileSync(`models/${file}`, 'utf-8'))).toEqual([]);
    });
  }
});

describe('a part that is in the wrong place', () => {
  const car = readFileSync('models/simple-car.ldr', 'utf-8');

  it('is caught when a brick sits between the studs instead of on them', () => {
    // Move the front 1x4 brick half a stud along the car: its anti-studs no longer meet the
    // plate's studs, and nothing else holds it.
    const shifted = car.replace('1 14 70 -24 0 0 0 1 0 1 0 -1 0 0 3701.dat', '1 14 70 -24 10 0 0 1 0 1 0 -1 0 0 3701.dat');
    expect(shifted).not.toEqual(car);
    expect(looseParts(shifted)).toEqual(['3701.dat']);
  });

  it('is caught when a brick floats above the plate', () => {
    const lifted = car.replace('1 14 70 -24 0 0 0 1 0 1 0 -1 0 0 3701.dat', '1 14 70 -40 0 0 0 1 0 1 0 -1 0 0 3701.dat');
    expect(looseParts(lifted)).toEqual(['3701.dat']);
  });
});
