// A loose part rides with a part it touches as built (decision 259 of 2026-11-20): not with
// whatever connection point starts nearest its origin. The 9397 Logging Truck's battery box has a
// case (919, p1284) with connection points, and two lids (918, p1285 and p1286) and a switch (920,
// p1287) that connect to nothing; the lid p1286 rode on the steering shaft (p1001, whose axle
// starts 23 LDU from the lid's origin, the case's nearest point 80), and swung as the wheels
// were steered.
import { existsSync } from 'node:fs';
import { Matrix4, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { loadModel } from '../scripts/load-model.ts';
import { rideAlong } from '../src/inference/rideAlong.ts';
import type { WorldCylinder } from '../src/inference/shared.ts';
import type { PlacedPart } from '../src/ldr.ts';

const truck = 'omr/9397-1 Logging Truck.mpd';

describe('a loose part rides with what it touches as built', () => {
  it.skipIf(!existsSync(truck))("the 9397's battery box lids and switch ride with the box's case, not the steering shaft", async () => {
    const { mech } = await loadModel(truck, true);
    const caseBody = mech.bodyOf[1284];
    expect([1285, 1286, 1287].map((p) => mech.bodyOf[p])).toEqual([caseBody, caseBody, caseBody]);
    expect(mech.bodyOf[1001]).not.toBe(caseBody);
  });

  // Three parts on a line: a loose part at x 0, a part with a connection point at x 5 that it
  // doesn't touch, and one at x 50 that it touches.
  const placed = (x: number): PlacedPart => ({ name: '3001.dat', color: 16, matrix: new Matrix4().makeTranslation(x, 0, 0) });
  const parts = [placed(0), placed(5), placed(50)];
  const point = (part: number, x: number) => ({ part, start: new Vector3(x, 0, 0) }) as unknown as WorldCylinder;
  const cyls = [point(1, 5), point(2, 50)];
  const anchorOf = (touches: Map<number, number[]> | null) => rideAlong(parts, cyls, [], [0], undefined, [], touches)[0].female;
  it('with what it touches, however far that connection point is', () => {
    expect(anchorOf(new Map([[0, [2]]]))).toBe(2);
  });
  it('touching nothing, with the nearest connection point, as before', () => {
    expect(anchorOf(new Map([[0, []]]))).toBe(1);
    expect(anchorOf(null)).toBe(1);
  });
  it('touching only a part with no connection point, with that part', () => {
    expect(rideAlong([...parts, placed(80)], cyls, [], [0], undefined, [], new Map([[0, [3]]]))[0].female).toBe(3);
  });
});
