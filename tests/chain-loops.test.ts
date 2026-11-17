import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadModel } from '../scripts/load-model.ts';

// A chain placed link by link (see findLoops) is only roughly round its wheels, and runs on
// toothed ones only.
describe('a chain placed link by link', () => {
  const quad = 'omr/9392-1 Quad Bike.mpd';
  it.skipIf(!existsSync(quad))("runs on the 9392 Quad Bike's two 16 tooth gears, 2.2 and 3.0 LDU off its circles, and not round its swinging arm's pivot", () => {
    const { mech } = loadModel(quad, true);
    const wheels = mech.loops[0].wheels.map((w) => w.body).sort((a, b) => a - b);
    expect(wheels).toEqual([mech.bodyOf[17], mech.bodyOf[146]].sort((a, b) => a - b));
  });
});
