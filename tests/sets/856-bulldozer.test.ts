import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { loopLinks } from '../../src/paths.ts';
import { load } from './load.ts';

describe('856 Bulldozer', () => {
  const { parts, mech, kin, bodyOf } = load('models/856-Bulldozer.mpd');
  const gears = parts.flatMap((p, i) => (p.name === '3649.dat' ? [mech.bodyOf[i]] : []));
  const yaw = () => Math.atan2(kin.poses[0].elements[8], kin.poses[0].elements[0]);

  it("is fully attached: it runs on two tracks of 50 links, each round two 40 tooth gears, its bucket's plates slot into grooves in its tipper ends, and two connectors' ends wedge between its studs", () => {
    const tracks = mech.loops.filter((l) => l.depth !== null); // (its two rubber bands are loops too)
    expect(tracks).toHaveLength(2);
    for (const loop of tracks) {
      expect(loop.links).toHaveLength(50);
      expect(loop.depth).toBe(8);
      expect(loop.wheels.map((w) => w.body).every((b) => gears.includes(b))).toBe(true);
      expect(loop.wheels).toHaveLength(2);
    }
    expect(mech.loose).toEqual([]);
    const tipperEnd = mech.bodyOf[parts.findIndex((p) => p.name === '3145.dat')];
    for (const [i, p] of parts.entries()) if (p.name === '3029.dat') expect(mech.bodyOf[i]).toBe(tipperEnd);
    // Two Technic connectors that turn on an axle hold the bucket, their ends wedged between its studs.
    expect(parts.filter((p, i) => p.name === '3651.dat' && mech.bodyOf[i] === tipperEnd)).toHaveLength(2);
  });

  it('stands on its tracks: their links reach 8 LDU below the path round the gears', () => {
    expect(kin.groundY).toBeCloseTo(-14 + 51.2 + 8, 6); // the gears' axles, the path's radius, the links' depth
  });

  it("a turn of one track's gear moves that track 51.2 LDU round per radian, turning its other gear alike, and the bulldozer turns, its tracks skidding", () => {
    kin.reset();
    const loop = mech.loops[0];
    const [front, back] = loop.wheels;
    const joint = kin.parentLink(front.body)!.joint;
    kin.holdWhatTheDragDoesntNeed(front.body, () => kin.jointMotion(joint) !== null);
    expect(kin.turnJoint(joint, 1)).toBeCloseTo(1, 9);
    kin.letGoAfterDrag();
    expect(Math.abs(kin.loopTravel(0))).toBeCloseTo(51.2, 3);
    expect(kin.jointAngles[back.joint]).toBeCloseTo(kin.jointAngles[front.joint], 6);
    expect(Math.abs(yaw())).toBeGreaterThan(0.05);
  });

  it('its links go round with it: moved one link (16 LDU) along, each lands where its neighbour was', () => {
    const loop = mech.loops[0];
    const start = loop.links.map((i) => parts[i].matrix);
    const moved = loopLinks(loop.path.points, start)!(16);
    const at = (m: typeof start[0]) => new Vector3().setFromMatrixPosition(m);
    for (const m of moved) expect(Math.min(...start.map((s) => at(s).distanceTo(at(m))))).toBeLessThan(0.5);
  });

  it('driven round and round by one gear, as Ctrl-click does, it keeps going: nothing else drifts into its way', () => {
    kin.reset();
    const body = mech.loops[0].wheels[0].body;
    const joint = kin.parentLink(body)!.joint;
    kin.holdWhatTheDragDoesntNeed(body, () => kin.jointMotion(joint) !== null);
    const step = (15 * Math.PI) / 180;
    const others = mech.joints.flatMap((j, i) => (j.kind === 'revolute' && !mech.loops.some((l) => l.wheels.some((w) => w.joint === i)) ? [i] : []));
    let turned = 0;
    for (let i = 0; i < 24 * 5; i++) turned += kin.turnJoint(joint, step, undefined, step);
    kin.letGoAfterDrag();
    expect(turned).toBeCloseTo(24 * 5 * step, 6);
    expect(Math.abs(kin.loopTravel(0))).toBeCloseTo(turned * 51.2, 3);
    for (const j of others) expect(Math.abs(kin.jointAngles[j])).toBeLessThan(1e-3); // the bucket arm and the rest stay put
  });

  it('the wheels at its back work the bucket: one pulley wheel turns 3 radians and swings the bucket, and its gear knob turns 2 radians and more; neither locks after a fraction of a radian', () => {
    const bucket = mech.bodyOf[parts.findIndex((p) => p.name === '3145.dat')];
    // Turns a body's joint by up to `angle`, a drag's small steps at a time, and says how far it
    // turned and how far the bucket moved.
    const turnBy = (body: number, angle: number) => {
      kin.reset();
      const start = new Vector3().setFromMatrixPosition(kin.poses[bucket]);
      const joint = kin.parentLink(body)!.joint;
      kin.holdWhatTheDragDoesntNeed(body, () => kin.jointMotion(joint) !== null, joint);
      let turned = 0;
      for (let i = 0; i < Math.round(Math.abs(angle) / 0.05); i++) {
        const t = kin.turnJoint(joint, Math.sign(angle) * 0.05);
        turned += t;
        if (Math.abs(t) < 1e-9) break;
      }
      kin.letGoAfterDrag();
      return { turned, moved: new Vector3().setFromMatrixPosition(kin.poses[bucket]).distanceTo(start) };
    };
    const pulley = turnBy(bodyOf('3736.dat', 1), 3); // the second of its two pulley wheels
    expect(pulley.turned).toBeCloseTo(3, 6);
    expect(pulley.moved).toBeGreaterThan(100);
    const knob = turnBy(bodyOf('3737.dat'), -3);
    expect(Math.abs(knob.turned)).toBeGreaterThan(2);
    expect(knob.moved).toBeGreaterThan(100);
  });

  it("its two rubber bands are each hooked from a beam on its bucket arm to an axle on its frame, and stretch as the bucket rises, not left where the file drew them", () => {
    const bands = mech.loops.filter((l) => l.links.length === 0);
    expect(bands).toHaveLength(2);
    const stretch = (l: (typeof bands)[0]) => l.path.points[0].center.clone().applyMatrix4(kin.poses[l.carriers[0]]).distanceTo(l.path.points[1].center.clone().applyMatrix4(kin.poses[l.carriers[1]]));
    kin.reset();
    const before = bands.map(stretch);
    for (const l of bands) expect(new Set(l.carriers).size).toBe(2); // its two hooks are on different bodies
    const pulley = bodyOf('3736.dat', 1);
    const joint = kin.parentLink(pulley)!.joint;
    kin.holdWhatTheDragDoesntNeed(pulley, () => kin.jointMotion(joint) !== null, joint);
    for (let i = 0; i < 60; i++) kin.turnJoint(joint, 0.05);
    kin.letGoAfterDrag();
    bands.forEach((l, b) => expect(stretch(l)).toBeGreaterThan(before[b] + 5));
  });
});
