import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadModel } from '../scripts/load-model.ts';
import { motorOutput, motorRunPart } from '../src/mechanism.ts';
import { catchShiftDue, catchShifts, findCatches, findSliders } from '../src/shift.ts';

// The model is read from the OMR files, which a checkout on GitHub does not have (omr/ is not in
// the repository): there the tests are skipped.
const FILE = 'omr/42114-1 6x6 Volvo Articulated Hauler.mpd';
if (existsSync(FILE)) withTheModel();
else describe.skip('a motor spun in the viewer (the 42114)', () => it('needs the OMR files', () => {}));

function withTheModel() {
  // A motor spun in the viewer, and a ring shifted while it runs (decision 152 of 2026-11-17), on
  // the 42114 6x6 Volvo Articulated Hauler: its L motor p602 shifts the gearbox through a rotary
  // catch p129, which slides three driving rings in turn.
  const loaded = loadModel(FILE, true);
  const { parts, mech, kin, table } = loaded;
  const MOTOR = 602;
  const CATCH = 129;

  describe('a motor spun in the viewer', () => {
    it('turns its output, the body the function check works for it, not the body it is built into', () => {
      const run = motorRunPart(mech, MOTOR);
      expect(mech.bodyOf[run]).toBe(motorOutput(mech, MOTOR));
      expect(mech.bodyOf[run]).not.toBe(mech.bodyOf[MOTOR]);
      // The output is the catch's shaft.
      expect(mech.bodyOf[run]).toBe(mech.bodyOf[CATCH]);
    });

    it('leaves any other part as it is', () => {
      expect(motorRunPart(mech, CATCH)).toBe(CATCH);
    });
  });

  describe('a ring shifted while a motor runs', () => {
    const catches = findCatches(parts, findSliders(parts, mech, table, loaded.slides), mech.roles);
    const placeOf = (i: number) => kin.poses[0].clone().invert().multiply(kin.poses[mech.bodyOf[i]]).multiply(parts[i].matrix);

    it('is not due as built', () => {
      expect(catches.filter((c) => c.part === CATCH).length).toBe(3);
      expect(catchShiftDue(parts, placeOf, table, catches)).toBe(false);
    });

    it('is due once the motor has turned the catch past its shift angle, as catchShifts would shift it', () => {
      const body = motorOutput(mech, MOTOR);
      const joint = kin.parentLink(body)!.joint;
      const before = kin.snapshot();
      kin.holdWhatTheDragDoesntNeed(body, () => kin.jointMotion(joint) !== null, joint);
      // A quarter turn and a little: past the 38 degrees at which the cam holds a ring half way.
      kin.turnJoint(joint, 0.8);
      kin.letGoAfterDrag();
      const due = catchShiftDue(parts, placeOf, table, catches);
      const all = catchShifts(parts.map((p, i) => ({ ...p, matrix: placeOf(i) })), table, catches);
      kin.restore(before);
      expect(due).toBe(true);
      expect(all.size).toBeGreaterThan(0);
    });
  });
}
