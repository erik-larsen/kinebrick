import { existsSync } from 'node:fs';
import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { loadModel } from '../../scripts/load-model.ts';

// The 42099 4x4 X-treme Off-Roader, from the OMR: checked only where omr/ has been downloaded.
const file = 'omr/42099-1 4x4 X-treme Off-Roader.mpd';

describe.skipIf(!existsSync(file))('42099 4x4 X-treme Off-Roader', () => {
  // Its four drive shafts hang on nothing but a constant velocity joint's ball (52731) at each
  // end, in its differential's socket and its hub's. Tied by their turning only, the shafts
  // turned about the model's origin, 240 LDU away, as the motor drove them. Each is held at its
  // differential's end, and on its hub socket's axis at the other (decision 74).
  it("the front motor turns each front drive shaft with both its balls in their sockets", () => {
    const { parts, mech, kin } = loadModel(file, true);
    expect(parts[878].name).toBe('42099 - 18575.dat');
    const joint = kin.parentLink(mech.bodyOf[878])!.joint;
    const hanging = kin.couplings.flatMap((c, i) => (c.hangs ? [i] : []));
    expect(hanging.length).toBe(8);
    expect(hanging.filter((i) => kin.couplings[i].hangs === 'point').length).toBe(4);
    const motion = kin.jointMotion(joint)!;
    expect(motion).not.toBeNull();
    let turning = 0;
    for (const i of hanging) {
      const c = mech.couplings[i];
      const shaft = kin.pointVelocity(motion, c.bodyA, c.center);
      const socket = kin.pointVelocity(motion, c.bodyB, c.center);
      const axis = c.axisB.clone().normalize();
      const off = shaft.clone().sub(socket);
      // Held at its place: no motion against the socket. On the axis: none across it.
      const across = kin.couplings[i].hangs === 'point' ? off.length() : off.clone().addScaledVector(axis, -off.dot(axis)).length();
      expect(across).toBeLessThan(1e-6);
      turning = Math.max(turning, new Vector3(motion[6 * c.bodyA], motion[6 * c.bodyA + 1], motion[6 * c.bodyA + 2]).length());
    }
    expect(turning).toBeGreaterThan(0.1);
  }, 120000);
});
