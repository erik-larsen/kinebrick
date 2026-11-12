import { existsSync } from 'node:fs';
import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { loadModel } from '../../scripts/load-model.ts';

// The 42110 Land Rover Defender, from the OMR: checked only where omr/ has been downloaded.
const file = 'omr/42110-1 Land Rover Defender.mpd';

describe.skipIf(!existsSync(file))('42110 Land Rover Defender', () => {
  // Pushed along on its four wheels, all turning together, closing the loops slid it sideways on
  // its tyres to keep its steering still, which its free motions turn only by rounding: rolled
  // forward and back, it came back 116 LDU to one side.
  it('rolled forward on its four wheels and back, it comes back where it started', () => {
    const { parts, mech, kin } = loadModel(file, true);
    const wheels = [2606, 2613, 2608, 2611];
    for (const i of wheels) expect(parts[i].name).toBe('42110 - 49294.dat');
    const [grabbed, ...others] = wheels.map((i) => mech.bodyOf[i]);
    const joint = kin.parentLink(grabbed)!.joint;
    const roll = (angle: number) => {
      kin.turnTogether(grabbed, others);
      kin.holdWhatTheDragDoesntNeed(grabbed, () => kin.jointMotion(joint) !== null, joint);
      const turned = kin.turnJoint(joint, angle, () => kin.atLimit() === null);
      kin.letGoAfterDrag();
      return turned;
    };
    const where = () => new Vector3().setFromMatrixPosition(kin.poses[0]);
    const start = where();
    expect(roll(0.4)).toBeCloseTo(0.4, 9);
    expect(where().distanceTo(start)).toBeGreaterThan(30);
    expect(roll(-0.4)).toBeCloseTo(-0.4, 9);
    expect(where().distanceTo(start)).toBeLessThan(0.01);
  }, 60000);
});
