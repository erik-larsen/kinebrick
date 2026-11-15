import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { libraryConnections } from '../src/connections.ts';
import { parseLdr } from '../src/ldr.ts';
import { inferMechanism, pinsToFree } from '../src/mechanism.ts';

const library = libraryConnections(JSON.parse(readFileSync('data/library-connections.json', 'utf-8')));
const roles: Record<string, string> = JSON.parse(readFileSync('data/roles.json', 'utf-8'));

describe('pins on demand: only friction pins are freed', () => {
  it("a gear on a motor's output: the output turns stiffly, but it is the motor's, not a pin to free (42109 fn 3)", () => {
    // A Power Functions Medium Motor, an axle in its output, and a gear on the axle.
    const parts = parseLdr('1 71 0 0 0 1 0 0 0 1 0 0 0 1 58120.dat\n1 7 0 0 -40 0 0 -1 0 1 0 1 0 0 3706.dat\n1 7 0 0 -80 1 0 0 0 1 0 0 0 1 3648.dat');
    const allFree = inferMechanism(parts, library, roles, [], new Set(), true);
    const output = allFree.joints.find((j) => j.motor);
    expect(output?.stiff).toBe(true);
    expect(pinsToFree(allFree, 2)).toEqual([]);
  });
});
