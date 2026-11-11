// The train check (scripts/train-checks.ts) on Kinebrick's test layout: the 4563's train on an
// oval with a switch and a crossing added (made by scripts/train-layouts.ts).

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { checkTrainSet } from '../scripts/train-checks.ts';

describe('trains on track', () => {
  it('runs the test layout\'s train a full lap through a switch and a crossing, and the switch, flipped, sends it onto its branch', () => {
    const set = JSON.parse(readFileSync('data/trains/test-1.json', 'utf-8'));
    const found = checkTrainSet(set);
    expect(found.functions.map((f) => f.result)).toEqual(['works', 'works', 'works']);
    const run = found.functions[1];
    // A lap of 16 curves, 10 straights, a switch and a crossing, in LDU.
    expect(run.travelled).toBeGreaterThan(8200);
    expect(run.offTrack).toBeLessThan(1);
    expect(run.rolled).toBeCloseTo(22, 0);
  });
});
