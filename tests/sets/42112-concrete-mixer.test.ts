import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadModel } from '../../scripts/load-model.ts';

// The 42112 Concrete Mixer Truck, from the OMR: checked only where omr/ has been downloaded. Read
// with its errata: three of its four pistons hung 2 LDU above their plate (signed by Erik on
// 2026-11-21).
const file = 'omr/42112-1 Concrete Mixer Truck.mpd';

describe.skipIf(!existsSync(file))('42112 Concrete Mixer Truck', () => {
  // Its engine's four pistons stand on liftarm ends round the camshaft (p134 to p137, a 1 x 2
  // thick liftarm each), as the 858's push rods stand on pins. One lobe points down as built,
  // beyond reach of its piston's foot, and was taken only once lobes were judged by the circle
  // they sweep; and a piston's slide range was the wrong way round, so the camshaft stopped at
  // 0.45 rad, where the lifted piston reached the end of a 2 LDU drop.
  it("turns its camshaft the whole way round: each piston rises 12 LDU on its lobe, once a turn, and stands on its plate between", async () => {
    const { mech, kin } = await loadModel(file, true);
    const pistons = [170, 173, 176, 179].map((p) => mech.bodyOf[p]);
    expect(mech.rests.map((r) => r.body).sort((a, b) => a - b)).toEqual([...pistons].sort((a, b) => a - b));
    const height = (body: number) => -kin.poses[body].elements[13]; // how far it has risen
    const plate = pistons.map(height);
    plate[2] -= 12; // p176 is built lifted on its lobe, which points up
    const body = mech.bodyOf[133];
    const joint = kin.parentLink(body)!.joint;
    kin.holdWhatTheDragDoesntNeed(body, () => kin.jointMotion(joint) !== null, joint);
    const lifts = pistons.map(() => [] as number[]);
    let turned = 0;
    for (let i = 0; i < 73; i++) {
      turned += kin.turnJoint(joint, (2 * Math.PI) / 72, () => kin.atLimit() === null);
      pistons.forEach((b, k) => lifts[k].push(height(b) - plate[k]));
    }
    kin.letGoAfterDrag();
    expect(turned).toBeCloseTo((73 / 72) * 2 * Math.PI, 6);
    for (const xs of lifts) {
      expect(Math.min(...xs)).toBeCloseTo(0, 3); // down on its plate
      expect(Math.max(...xs)).toBeCloseTo(12, 1); // up on its lobe
      // On its plate for a part of the turn, while the cam turns on under it.
      expect(xs.filter((h) => Math.abs(h) < 1e-3).length).toBeGreaterThan(10);
      // Lifted once a turn.
      expect(xs.slice(0, 72).filter((h, i) => h > 6 && xs[(i + 71) % 72] <= 6).length).toBe(1);
      // A turn later, back where it was.
      expect(xs[72]).toBeCloseTo(xs[0], 3);
    }
  });
});
