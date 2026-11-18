import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadModel } from '../scripts/load-model.ts';
import { pinsForShift } from '../src/pinSearch.ts';

// The pins a press with Shift frees: those that hold a part in its body, where that body comes
// apart with every friction pin free (decision 173 of 2026-11-17). The viewer's pin helper and the
// check both ask pinsForShift.
describe('the pins a press with Shift frees', () => {
  const crane = 'omr/42082-1 Rough Terrain Crane.mpd';
  it.skipIf(!existsSync(crane))("frees the hinge pins of the 42082 Rough Terrain Crane's cab door, which friction pins fuse to the cab", () => {
    const loaded = loadModel(crane, true);
    const allFree = loaded.allFree(loaded.parts);
    expect(pinsForShift(loaded.mech, allFree, 3789)).toEqual({ pins: [3792, 3793], why: null });
    // The cab itself (p2649, measured against in function 9): nothing but its joints holds it in
    // its body.
    expect(pinsForShift(loaded.mech, allFree, 2649).why).not.toBeNull();
  }, 180_000);
  const forest = 'omr/42080-1 Forest Machine.mpd';
  it.skipIf(!existsSync(forest))("frees none for the 42080 Forest Machine's boom knob, in the frame even with every pin free", () => {
    const loaded = loadModel(forest, true);
    expect(pinsForShift(loaded.mech, loaded.allFree(loaded.parts), 1893)).toEqual({ pins: [], why: 'more' });
  }, 180_000);
});
