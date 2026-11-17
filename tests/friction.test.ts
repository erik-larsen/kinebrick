import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { libraryConnections } from '../src/connections.ts';
import { parseLdr } from '../src/ldr.ts';
import { inferMechanism, pinsToFree } from '../src/mechanism.ts';
import { loadModel } from '../scripts/load-model.ts';

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

// An axle pin (the 43093) is held by its axle end in an axle hole: its pin end is a friction
// joint, held while the model can move otherwise and freed on demand, not locked rigid as a
// pin's first hole is (see fixPins).
describe('an axle pin with friction', () => {
  const model = 'omr/42093-1 Chevrolet Corvette ZR1.mpd';
  it.skipIf(!existsSync(model))("turns, once its pin is freed, the steering wheel on its pin end (42093 fn 4: the wheel p293 on the 43093 p292)", () => {
    const loaded = loadModel(model, true);
    const moves = (read: { mech: { bodyOf: number[] }; kin: { frames: number[]; parentLink: (b: number) => { joint: number } | null; jointMotion: (j: number) => unknown } }) => {
      const body = read.mech.bodyOf[293];
      const link = read.kin.parentLink(body);
      return !!link && !read.kin.frames.includes(body) && read.kin.jointMotion(link.joint) !== null;
    };
    expect(moves(loaded)).toBe(false);
    const pins = pinsToFree(loaded.allFree(loaded.parts), 293);
    expect(pins).toEqual([292]);
    expect(moves(loaded.read(loaded.parts, new Set(pins)))).toBe(true);
  }, 60000);
});
