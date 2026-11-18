import { existsSync } from 'node:fs';
import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { loadModel } from '../scripts/load-model.ts';
import { catchShifts, findCatches, findSliders, nearestPosition, sliderMovedTo, sliderPosition } from '../src/shift.ts';

// The model is read from the OMR files, which a checkout on GitHub does not have (omr/ is not in
// the repository): there the tests are skipped.
const FILE = 'omr/42054-1 CLAAS XERION 5000 TRAC VC.mpd';
if (existsSync(FILE)) withTheModel();
else describe.skip('a changeover catch keeps its ring after a shift (the 42054)', () => it('needs the OMR files', () => {}));

function withTheModel() {
  // The 42054 CLAAS Xerion's lever A: its changeover catch p305 (6641) shifts the driving ring
  // p303, its fork drawn 2 LDU off the ring's middle, so that slid one way the ring stands 61.2 LDU
  // from the catch, more than the 1 LDU findCatches allows about CATCH_REACH (60).
  const { parts, mech, table, slides } = loadModel(FILE, true);
  const CATCH = 305;
  const RING = 303;
  const sliders = findSliders(parts, mech, table, slides);
  const catches = findCatches(parts, sliders, mech.roles);
  const ring = sliders.find((s) => s.part === RING)!;
  const at = new Vector3().setFromMatrixPosition(parts[CATCH].matrix);

  // The model with the ring slid to `to`, as the viewer reads it after a shift (readAsBuilt).
  const slidTo = (to: number) => {
    const slid = parts.map((p) => ({ ...p }));
    slid[RING] = { ...slid[RING], matrix: sliderMovedTo(slid, table, ring, to) };
    return slid;
  };
  const middle = nearestPosition(ring, sliderPosition(parts, table, ring));
  // The click-in place on the side where the ring stands furthest from the catch.
  const far = [-10, 10]
    .map((by) => nearestPosition(ring, middle + by))
    .sort((a, b) => new Vector3().setFromMatrixPosition(slidTo(b)[RING].matrix).distanceTo(at) - new Vector3().setFromMatrixPosition(slidTo(a)[RING].matrix).distanceTo(at))[0];

  describe("a changeover catch keeps its ring after a shift (the 42054's lever A)", () => {
    it('slid to the far side, the ring stands more than 1 LDU off the catch\'s reach', () => {
      expect(catches.some((c) => c.part === CATCH && c.ring.part === RING)).toBe(true);
      const distance = new Vector3().setFromMatrixPosition(slidTo(far)[RING].matrix).distanceTo(at);
      expect(Math.abs(distance - 60)).toBeGreaterThan(1);
    });

    it('read again with the ring there, the catch is still found with its ring', () => {
      const slid = slidTo(far);
      const again = findCatches(slid, findSliders(slid, mech, table, slides), mech.roles, catches);
      expect(again.some((c) => c.part === CATCH && c.ring.part === RING)).toBe(true);
    });

    it('and with the lever back in its middle, the ring comes back to its middle', () => {
      const slid = slidTo(far);
      const again = findCatches(slid, findSliders(slid, mech, table, slides), mech.roles, catches);
      expect(catchShifts(slid, table, again).get(RING)).toBe(middle);
    });
  });
}
