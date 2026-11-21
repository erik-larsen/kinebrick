import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadModel } from '../../scripts/load-model.ts';

// The 8826 ATX Sport Cycle, from the OMR: checked only where omr/ has been downloaded.
const file = 'omr/8826-1 ATX Sport Cycle.mpd';

describe.skipIf(!existsSync(file))('8826 ATX Sport Cycle', () => {
  // Its steering, as read, goes one step and then some joint would turn more than 50 times as
  // fast (a wild rate, the same both ways): the drag stopped there, in a pose it couldn't leave,
  // and the handlebars couldn't be turned back. A step into such a pose is undone, so whatever
  // the drag turns, it can turn back (decision 84 of 2026-11-15).
  it('whatever the handlebars turn, they turn back', async () => {
    const { parts, mech, kin } = await loadModel(file, true);
    expect(parts[76].name).toBe('2905.dat');
    const body = mech.bodyOf[76];
    const joint = kin.parentLink(body)!.joint;
    for (const way of [1, -1]) {
      kin.reset();
      kin.holdWhatTheDragDoesntNeed(body, () => kin.jointMotion(joint) !== null, joint);
      const out = kin.turnJoint(joint, way * 0.3);
      const back = kin.turnJoint(joint, -out);
      kin.letGoAfterDrag();
      expect(back).toBeCloseTo(-out, 9);
    }
  }, 120000);
});
