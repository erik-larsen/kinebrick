import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { load } from './load.ts';

describe('855 Mobile Crane', () => {
  const { parts, mech, kin, bodyOf, turn, frameMoved } = load('models/855-Mobile Crane.mpd');
  const outriggers = mech.joints.flatMap((j, i) => (j.kind === 'slide' && j.bodyA === 0 && (j.range![0] === -120 || j.range![0] === -40) ? [i] : []));
  const cab = bodyOf('3404.dat');

  it("is fully attached: its hook hangs on a string, the cab turns on a 4x4 turntable, read as its base and top, and the outriggers slide out on tiles", () => {
    expect(mech.loose).toEqual([]);
    expect(mech.strings).toHaveLength(1);
    const [string] = mech.strings;
    expect(string.drum).not.toBeNull();
    expect(string.pulleys).toHaveLength(3); // over the boom tip, round the hook, back over the boom tip
    expect(new Set(mech.bodies[string.hook!.body].parts.map((i) => parts[i].submodel))).toEqual(new Set(['855-hook.ldr']));
    expect(mech.joints.some((j) => j.kind === 'revolute' && j.bodyA === 0 && j.bodyB === cab)).toBe(true);
    expect(outriggers).toHaveLength(4);
  });

  // Where the hook's pulley is, and the middle of the two boom-tip pulleys it hangs from.
  const hook = () => {
    const [string] = mech.strings;
    const at = (w: (typeof string.pulleys)[0]) => string.path.points[w.point].center.clone().applyMatrix4(kin.poses[w.mount]);
    const [a, h, b] = string.pulleys.map(at);
    return { at: h, under: h.clone().sub(a.clone().add(b).multiplyScalar(0.5)), up: new Vector3(0, -1, 0).transformDirection(kin.poses[string.hook!.body]) };
  };

  it("a turn of the winch pays out 7.5 LDU of string per radian, its drum's radius, and the hook, on a pulley in the string's bight, drops half that, straight down", () => {
    kin.reset();
    const [string] = mech.strings;
    const start = hook().at;
    const joint = kin.parentLink(string.drum!.body)!.joint;
    kin.holdWhatTheDragDoesntNeed(string.drum!.body, () => kin.jointMotion(joint) !== null);
    const sign = mech.joints[joint].bodyB === string.drum!.body ? 1 : -1;
    expect(Math.abs(kin.turnJoint(joint, sign * 2))).toBeCloseTo(2, 9);
    kin.letGoAfterDrag();
    const moved = hook().at.sub(start);
    expect(Math.abs(moved.y)).toBeCloseTo(7.5, 6); // half of 2 x 7.5
    expect(Math.hypot(moved.x, moved.z)).toBeLessThan(1e-6);
    expect(frameMoved()).toBeLessThan(1e-6);
  });

  it('the hook hangs beneath the boom tip, upright, as the cab slews and the boom luffs', () => {
    for (const [body, angle] of [
      [bodyOf('3404.dat'), 1], // the cab
      [bodyOf('3736.dat', 2), 2], // the crank that luffs the boom
    ] as const) {
      kin.reset();
      const start = hook().under;
      turn(body, angle);
      const { under, up } = hook();
      expect(Math.hypot(under.x - start.x, under.z - start.z)).toBeLessThan(1e-6);
      expect(up.y).toBeCloseTo(-1, 9);
    }
  });

  it('the cab slews on its turntable, boom and all, and the crane stays where it is', () => {
    kin.reset();
    expect(Math.abs(turn(cab, 1))).toBeCloseTo(1, 6);
    expect(frameMoved()).toBeLessThan(1e-6);
  });

  // Pushes a slide joint's bodyB along it, as a drag does, by `distance` or as far as it goes.
  const push = (joint: number, distance: number) => {
    const j = mech.joints[joint];
    const rate = (m: number[]) => {
      const at = j.from.clone().applyMatrix4(kin.poses[j.bodyA]);
      const dir = j.to.clone().sub(j.from).normalize().transformDirection(kin.poses[j.bodyA]);
      return kin.pointVelocity(m, j.bodyB, at).sub(kin.pointVelocity(m, j.bodyA, at)).dot(dir);
    };
    kin.holdWhatTheDragDoesntNeed(j.bodyB, () => kin.freeMotions().some((m) => Math.abs(rate(m)) > 1e-9));
    for (let i = 0; i < Math.abs(distance) / 5; i++) {
      const m = kin.freeMotions().find((m) => Math.abs(rate(m)) > 1e-9);
      if (!m) break;
      const before = kin.snapshot();
      kin.advance(m, (5 * Math.sign(distance)) / rate(m));
      if (kin.atLimit()) {
        kin.restore(before);
        break;
      }
    }
    kin.letGoAfterDrag();
  };

  it('each outrigger slides 160 LDU along its tiles, and no further', () => {
    for (const joint of outriggers) {
      for (const end of mech.joints[joint].range!) {
        kin.reset();
        push(joint, end + 40 * Math.sign(end));
        expect(kin.slideOffset(joint)).toBeCloseTo(end, 3);
      }
    }
  });

  it("its boom extension knob slides the boom's inner section out and in, through the crown gear it drives, leaving the boom's angle and its luffing knob where they were", () => {
    const [extend, luff] = [483, 272].map((i) => {
      expect(parts[i].name).toBe('3736.dat');
      return mech.bodyOf[i];
    });
    const rack = mech.bodyOf[430]; // a rack on the boom's inner section
    expect(parts[430].name).toBe('3743.dat');
    const slide = mech.joints.findIndex((j) => j.kind === 'slide' && (j.bodyA === rack || j.bodyB === rack));
    for (const way of [1, -1]) {
      kin.reset();
      expect(Math.abs(turn(extend, way * 1.5))).toBeCloseTo(1.5, 6);
      expect(Math.abs(kin.slideOffset(slide))).toBeGreaterThan(1);
      expect(kin.jointAngles[kin.parentLink(luff)!.joint]).toBeCloseTo(0, 6);
    }
  });
});
