import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { loopLinks } from '../../src/paths.ts';
import { load } from './load.ts';

describe('856 Bulldozer', () => {
  const { parts, mech, kin } = load('models/856-Bulldozer.mpd');
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
});
