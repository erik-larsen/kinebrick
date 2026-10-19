import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ConnectionTable } from '../src/connections.ts';
import { parseModel } from '../src/ldr.ts';
import { inferMechanism } from '../src/mechanism.ts';

const table: ConnectionTable = JSON.parse(readFileSync('data/connections.json', 'utf-8'));
const roles: Record<string, string> = JSON.parse(readFileSync('data/roles.json', 'utf-8'));

// Which files each model places are LDraw primitives (drawn shapes, not parts), and which parts
// are read as their pieces, as the packer found.
const packed: Record<string, { primitives: string[]; pieces: Record<string, string[]> }> = JSON.parse(readFileSync('packed/models.json', 'utf-8'));

// The names of a model's loose parts, read as the viewer reads it (`name` is its file's, without
// .ldr or .mpd, if it's in models/).
function looseParts(text: string, name = ''): string[] {
  const model = packed[name];
  const { parts, paths } = parseModel(text, (n) => model?.primitives.includes(n) ?? false, (n) => model?.pieces[n] ?? null);
  return inferMechanism(parts, table, roles, paths).loose.map((i) => parts[i].name);
}

// Real models KineBrick can't fully read yet, and what they need (M7 works through them).
const NOT_YET = [
  '8448-Super Car.mpd', // hinges, universal joints, its tyres
  '852-Helicopter.mpd', // pin connectors and axles in its rotor linkage
];

describe('every test model is fully attached', () => {
  for (const file of readdirSync('models').filter((f) => /\.(ldr|mpd)$/.test(f) && !NOT_YET.includes(f))) {
    it(file, () => {
      expect(looseParts(readFileSync(`models/${file}`, 'utf-8'), file.replace(/\.(ldr|mpd)$/, ''))).toEqual([]);
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
