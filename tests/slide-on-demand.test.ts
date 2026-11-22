import { readFileSync } from 'node:fs';
import { BoxGeometry, Matrix4, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { collisionGeometry, Collisions, connectedPairs, type PartMesh } from '../src/collisions.ts';
import { libraryConnections } from '../src/connections.ts';
import { Kinematics } from '../src/kinematics.ts';
import type { PlacedPart } from '../src/ldr.ts';
import { inferMechanism, type Mechanism } from '../src/mechanism.ts';
import { pushStep } from '../src/push.ts';
import { slidePart } from '../src/slide.ts';

const table = libraryConnections(JSON.parse(readFileSync('data/library-connections.json', 'utf-8')));
const roles: Record<string, string> = JSON.parse(readFileSync('data/roles.json', 'utf-8'));
// A part placed as an LDraw line places it: position, then the orientation's rows.
const placed = (name: string, x: number, y: number, z: number, rows = [1, 0, 0, 0, 1, 0, 0, 0, 1]): PlacedPart => ({ name, color: 16, matrix: new Matrix4().set(rows[0], rows[1], rows[2], x, rows[3], rows[4], rows[5], y, rows[6], rows[7], rows[8], z, 0, 0, 0, 1) });
// A beam's length (its z) along x, its holes (its y) upright; an axle's length (its x) upright; a
// bush's axis (its z) upright.
const BEAM = [0, 0, 1, 0, 1, 0, -1, 0, 0];
const UPRIGHT = [0, -1, 0, 1, 0, 0, 0, 0, 1];
const BUSH = [1, 0, 0, 0, 0, 1, 0, -1, 0];

// A frame beam (15L, 32278) at y 0, holes from x -140 to 140, and a door beam above it at y -70,
// hinged on an axle 5 (32073) through both at x -140. A latch, an axle 6 (3706) through both at
// x 100, holds the door shut: it reaches 20 LDU into the frame beam (y -110 to 10). A bush (3713) on
// it rests on the frame beam (y -30 to -10), 30 LDU below the door beam. Lifted 20 LDU, the latch
// leaves the frame beam and the door is free; lifted 30, its bush meets the door beam.
const [FRAME, DOOR, HINGE, LATCH, BUSH_PART] = [0, 1, 2, 3, 4];
const model = (): PlacedPart[] => [
  placed('32278.dat', 0, 0, 0, BEAM),
  placed('32278.dat', 0, -70, 0, BEAM),
  placed('32073.dat', -140, -35, 0, UPRIGHT),
  placed('3706.dat', 100, -50, 0, UPRIGHT),
  placed('3713.dat', 100, -20, 0, BUSH),
];
// The parts' shapes, as boxes in their own coordinates: a beam 20 x 20 x 300, an axle 6 thick, a
// bush 16 across and 20 long.
const box = (x: number, y: number, z: number): PartMesh[] => [{ geometry: collisionGeometry(new BoxGeometry(x, y, z)), matrix: new Matrix4() }];
const shapes = () => [box(20, 20, 300), box(20, 20, 300), box(100, 6, 6), box(120, 6, 6), box(16, 16, 20)];

const read = (parts: PlacedPart[], slid = new Set<number>()) => inferMechanism(parts, table, roles, [], new Set(), false, null, slid);
// How far the door's far end (x 140) goes, pushed sideways 5 LDU, 1 LDU a step, as the viewer
// pushes it (see pushStep).
const doorGoes = (mech: Mechanism) => {
  const kin = new Kinematics(mech);
  const body = mech.bodyOf[DOOR];
  if (body === mech.bodyOf[FRAME]) return 0;
  const grab = new Vector3(140, -70, 0);
  for (let k = 0; k < 5; k++) if (pushStep(kin, body, grab, new Vector3(0, 0, 1), 1) !== 'moved') break;
  return grab.clone().applyMatrix4(kin.poses[body]).distanceTo(grab);
};

describe('a part slid on its axle when asked (decision 206)', () => {
  it('leaves the reading as it was when nothing is asked', () => {
    const parts = model();
    const plain = inferMechanism(parts, table, roles, []);
    const asked = read(parts);
    expect(asked.bodyOf).toEqual(plain.bodyOf);
    expect(asked.joints.map((j) => j.kind)).toEqual(plain.joints.map((j) => j.kind));
    expect(asked.slid).toBeUndefined();
  });

  it('keeps the door locked as built', () => {
    expect(doorGoes(read(model()))).toBeLessThan(1e-6);
  });

  it('slides the latch, with its bush, along its axle when asked: the door is still locked until it moves', () => {
    const mech = read(model(), new Set([LATCH]));
    expect(mech.slid).toEqual([LATCH]);
    expect(mech.bodyOf[BUSH_PART]).toBe(mech.bodyOf[LATCH]);
    const slides = mech.joints.filter((j) => j.kind === 'slide' && j.asked);
    expect(slides.length).toBeGreaterThan(0);
    expect(slides.every((j) => Math.abs(j.to.x - 100) < 1 && Math.abs(j.from.x - 100) < 1)).toBe(true);
    expect(doorGoes(mech)).toBeLessThan(1e-6);
  });

  it("says why a part can't slide: a beam pinned to another by a pin, not an axle", () => {
    // A second beam on the frame beam, joined by a frictionless pin (3673, its x upright) at x 0.
    const parts = [placed('32278.dat', 0, 0, 0, BEAM), placed('32278.dat', 0, -20, 0, BEAM), placed('3673.dat', 0, -10, 0, UPRIGHT)];
    const mech = read(parts, new Set([1]));
    expect(mech.slid).toEqual([]);
    expect(mech.slideWhy?.[1]).toBe('not carried by an axle in a round hole');
  });

  it('lifts the latch until its bush meets the door beam, and then the door turns', () => {
    const slid = new Set([LATCH]);
    let parts = model();
    const built = parts.map((p) => p.matrix.clone());
    let mech = read(parts, slid);
    let kin = new Kinematics(mech);
    const now = () => parts.map((p, i) => kin.poses[mech.bodyOf[i]].clone().multiply(p.matrix));
    const collisions = new Collisions(shapes(), mech.bodyOf, connectedPairs(mech), built);
    let met: [number, number] | null = null;
    const allowed = () => {
      if (kin.atLimit() !== null) return false;
      const hit = collisions.check(now());
      if (hit) met = hit;
      return hit === null;
    };
    const reread = () => {
      parts = parts.map((p, i) => ({ ...p, matrix: now()[i] }));
      mech = read(parts, slid);
      kin = new Kinematics(mech);
      collisions.watch(mech.bodyOf, connectedPairs(mech), now());
    };
    const place = (i: number) => {
      const m = now()[i];
      return { position: new Vector3().setFromMatrixPosition(m), axes: [0, 1, 2].map((k) => new Vector3().setFromMatrixColumn(m, k).normalize()) };
    };
    // Up is -y; the latch's own x is upright, so up is -x along it.
    const { went, halt } = slidePart(() => ({ kin, mech, place }), reread, LATCH, -40, allowed);
    expect(halt).toBe('met');
    expect([...(met ?? [])].sort()).toEqual([DOOR, BUSH_PART]);
    // The bush's box and the door beam's, each pulled in 0.25 LDU at its faces, meet 30.5 LDU up.
    expect(went).toBeGreaterThan(30);
    expect(went).toBeLessThan(31);
    expect(new Vector3().setFromMatrixPosition(now()[LATCH]).y).toBeCloseTo(-50 - went, 3);
    reread();
    expect(doorGoes(mech)).toBeGreaterThan(4.9);
  });
});
