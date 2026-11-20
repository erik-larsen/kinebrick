import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadModel } from '../scripts/load-model.ts';
import { Kinematics } from '../src/kinematics.ts';
import { motorOutput } from '../src/mechanism.ts';

// A turn keeps the motion it found for the step after its last, for the next turn of the same joint
// the same way (see Kinematics.turnJoint, keepAhead). Turned in the viewer's steps (0.035 rad, a
// call each), every pose and joint angle comes out the same, number for number, with the motion
// kept and without (decision 174 of 2026-11-17); on play, within 1e-4 (see `same`).
describe('the motion kept for the next turn', () => {
  const turned = async (model: string, part: number, amount: number, keepAhead: boolean) => {
    const loaded = await loadModel(model, true);
    const kin = new Kinematics(loaded.mech, { keepAhead });
    kin.scrub = loaded.kin.scrub;
    const body = loaded.mech.roles[part] === 'motor' ? motorOutput(loaded.mech, part) : loaded.mech.bodyOf[part];
    const joint = kin.parentLink(body)!.joint;
    kin.holdWhatTheDragDoesntNeed(body, () => kin.jointMotion(joint) !== null, joint);
    let went = 0;
    for (let i = 0; i < Math.round(Math.abs(amount) / 0.035); i++) went += kin.turnJoint(joint, Math.sign(amount) * 0.035);
    return { went, onPlay: kin.onPlay, angles: kin.jointAngles.slice(), poses: kin.poses.flatMap((m) => [...m.elements]) };
  };
  // `near`: within this, not number for number. On play, a motion worked out afresh at the next
  // turn's start differs from the one kept by about 2e-6 of its size: between the two, the turn
  // moved the model to the origin and back (see nearOrigin), which rounds the frame's place in its
  // last bits, and a play motion's solve magnifies that about 1e10 times. The kept one is the motion
  // found where the step ended, before that rounding.
  const same = async (model: string, part: number, amount: number, near = 0) => {
    const kept = await turned(model, part, amount, true);
    const afresh = await turned(model, part, amount, false);
    expect(Math.abs(kept.went)).toBeGreaterThan(0.1);
    expect(kept.went).toBe(afresh.went);
    if (near === 0) {
      expect(kept.angles).toEqual(afresh.angles);
      expect(kept.poses).toEqual(afresh.poses);
    } else {
      expect(Math.max(...kept.angles.map((a, i) => Math.abs(a - afresh.angles[i])))).toBeLessThan(near);
      expect(Math.max(...kept.poses.map((a, i) => Math.abs(a - afresh.poses[i])))).toBeLessThan(near);
    }
    return kept;
  };
  const forklift = 'omr/42079-1 Heavy Duty Forklift.mpd';
  it.skipIf(!existsSync(forklift))("the 42079 Heavy Duty Forklift's mast tilt, on play", async () => {
    expect((await same(forklift, 448, 0.21, 1e-4)).onPlay).toBeGreaterThan(0);
  }, 300_000);
  const telehandler = 'omr/42061-1 Telehandler.mpd';
  it.skipIf(!existsSync(telehandler))("the 42061 Telehandler's boom, exact", async () => {
    expect((await same(telehandler, 142, 0.21)).onPlay).toBe(0);
  }, 300_000);
  const arocs = 'omr/42043-1 Mercedes-Benz Arocs 3245.mpd';
  it.skipIf(!existsSync(arocs))("the 42043 Arocs's motor", async () => {
    await same(arocs, 169, 0.21);
  }, 300_000);
});
