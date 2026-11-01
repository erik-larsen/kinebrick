import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { load } from './load.ts';

// The 10001 Metroliner: an oval of 9V track, a platform, and three cars coupled by magnets, one
// of them the motor car. The layout's cars are placed a little off the rails and the magnets a
// little apart, and set on the rails as the kinematics is built (see ARCHITECTURE.md, Trains).
describe('10001 Metroliner', () => {
  const { parts, mech, kin, motor } = load('models/10001-Metroliner.mpd');
  const cars = mech.bodies.flatMap((b, i) => (i > 0 && b.parts.length > 100 ? [i] : []));
  const at = (body: number) => new Vector3().setFromMatrixPosition(kin.poses[body]);
  // The track's centreline where a point is: how far the point is off it, level.
  const offTrack = (p: Vector3) => {
    let least = Infinity;
    for (const rail of mech.rails!) {
      let d: number;
      if (rail.center) {
        const r = new Vector3(p.x - rail.center.x, 0, p.z - rail.center.z).length();
        d = Math.abs(r - rail.radius!);
      } else {
        const dir = new Vector3().subVectors(rail.to, rail.from).normalize();
        const off = new Vector3().subVectors(p, rail.from);
        off.y = 0;
        d = off.addScaledVector(dir, -off.dot(dir)).length();
      }
      least = Math.min(least, d);
    }
    return least;
  };
  const wheelsets = parts.flatMap((p, i) => (p.name === '70720c01.dat' ? [i] : []));

  it('is a layout: the track is the frame, with the platform riding on it, and each car an assembly of its own on wheelsets that turn in their bogies', () => {
    expect(mech.rails).toHaveLength(20);
    expect(mech.bodies[0].parts.map((p) => parts[p].name)).toContain('2865.dat');
    expect(mech.bodies[0].parts.map((p) => parts[p].submodel)).toContain('10001-platform.ldr');
    expect(cars).toHaveLength(3);
    expect(mech.riders).toHaveLength(12);
    for (const w of wheelsets) expect(kin.parentLink(mech.bodyOf[w]), `wheelset p${w}`).not.toBeNull();
    // Its figures are posed, not on studs: they ride along, and count as loose.
    expect(mech.loose.length).toBeLessThan(150);
  });

  it('is set on the rails and coupled as it starts: every wheelset on the track, the magnets together, and one way to move', () => {
    kin.reset();
    for (const r of mech.riders!) expect(offTrack(r.center.clone().applyMatrix4(kin.poses[r.body]))).toBeLessThan(1e-4);
    for (const j of mech.joints.filter((j) => j.kind === 'ball')) {
      const [a, b] = [j.from.clone().applyMatrix4(kin.poses[j.bodyA]), j.from.clone().applyMatrix4(kin.poses[j.bodyB])];
      expect(a.distanceTo(b)).toBeLessThan(1e-4);
    }
    expect(mech.joints.filter((j) => j.kind === 'ball')).toHaveLength(2);
    // The platform's doors swing, and the motor car's free coupling swivels; the rest is the train.
    expect(kin.freeMotions().length).toBeLessThanOrEqual(7);
  });

  it('runs on in the small turns the viewer makes a frame at a time, 15 rpm at 60 frames a second, across the joins between pieces of track', () => {
    kin.reset();
    const wheelset = mech.bodyOf[wheelsets[2]];
    const joint = kin.parentLink(wheelset)!.joint;
    kin.holdWhatTheDragDoesntNeed(wheelset, () => kin.jointMotion(joint) !== null, joint);
    const frame = (15 / 60) * 2 * Math.PI / 60;
    let total = 0;
    for (let i = 0; i < 600; i++) total += kin.turnJoint(joint, frame, () => kin.atLimit() === null, (15 * Math.PI) / 180);
    kin.letGoAfterDrag();
    expect(total).toBeCloseTo(600 * frame, 6);
  });

  it('runs round the oval: a wheelset kept turning by the motor takes all three cars through the curves, every axle on the track', () => {
    kin.reset();
    const wheelset = mech.bodyOf[wheelsets[2]];
    const before = cars.map(at);
    const turned = motor(wheelset, 300);
    expect(turned).toBeCloseTo((300 * 15 * Math.PI) / 180, 6);
    const after = cars.map(at);
    // 300 steps of 15 degrees at 22 LDU a radian: 1728 LDU along the track, round a curve.
    for (let i = 0; i < cars.length; i++) expect(after[i].distanceTo(before[i])).toBeGreaterThan(1000);
    for (const r of mech.riders!) expect(offTrack(r.center.clone().applyMatrix4(kin.poses[r.body]))).toBeLessThan(1e-3);
    for (const j of mech.joints.filter((j) => j.kind === 'ball')) {
      const [a, b] = [j.from.clone().applyMatrix4(kin.poses[j.bodyA]), j.from.clone().applyMatrix4(kin.poses[j.bodyB])];
      expect(a.distanceTo(b)).toBeLessThan(1e-3);
    }
  });
});
