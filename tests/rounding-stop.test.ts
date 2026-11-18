import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadModel } from '../scripts/load-model.ts';
import { Kinematics } from '../src/kinematics.ts';

// Closing a step's loops ends at a round that fails to halve the gaps once they are within what
// double precision can hold (see closeLoops, roundingFloor, Options.roundingStop). The 42083 Bugatti
// Chiron's wheel, turned in the viewer's steps: its gaps close in two or three rounds, then sit at
// 1 to 2e-11 LDU, and every further round took a fresh basis until the rounds ran out. With the
// stop, fewer rounds, and every pose the same to well within what closing leaves.
describe('closing loops stops at the rounding floor', () => {
  const chiron = 'omr/42083-1 Bugatti Chiron.mpd';
  it.skipIf(!existsSync(chiron))("the 42083 Bugatti Chiron's wheel takes fewer rounds, to the same poses", () => {
    const run = (roundingStop: boolean) => {
      const loaded = loadModel(chiron, true);
      const kin = new Kinematics(loaded.mech, { roundingStop });
      kin.scrub = loaded.kin.scrub;
      const body = loaded.mech.bodyOf[3516];
      const joint = kin.parentLink(body)!.joint;
      kin.holdWhatTheDragDoesntNeed(body, () => kin.jointMotion(joint) !== null, joint);
      // Count the equation builds, closing loops and all, as the steps' cost.
      const proto = Object.getPrototypeOf(kin);
      const build = proto.buildEquations;
      let builds = 0;
      proto.buildEquations = function (...args: unknown[]) {
        builds++;
        return build.apply(this, args);
      };
      try {
        for (let i = 0; i < 3; i++) kin.turnJoint(joint, 0.035);
      } finally {
        proto.buildEquations = build;
      }
      return { builds, poses: kin.poses.flatMap((m) => [...m.elements]) };
    };
    const before = run(false);
    const after = run(true);
    expect(after.builds).toBeLessThan(before.builds);
    expect(Math.max(...after.poses.map((x, i) => Math.abs(x - before.poses[i])))).toBeLessThan(1e-9);
  }, 300_000);
});
