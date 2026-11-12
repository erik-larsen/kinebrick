// Gears and which of them mesh: spur, worm, rack, crown and bevel meshes.

import { Matrix4, Vector3 } from 'three';
import type { Gear, Mechanism, Mesh } from '../mechanism.ts';
import { ANGLE_TOLERANCE, AXIS_TOLERANCE, MIN_OVERLAP, type WorldCylinder } from './shared.ts';

// How far meshing gears' axles (or a gear and a rack's pitch line) may be from exactly their
// pitch radii apart, in LDU. Real teeth still engage a little closer or further, and models
// built by hand often have them so: an official model may put a gear 2 LDU into a rack.
const MESH_TOLERANCE = 2;
// The same for a gear and a rack's pitch line. A rack's straight teeth engage over more than a
// gear's do, and official models set gears further from them: the 8859 Tractor's 24 tooth
// gear sits 4 LDU off its steering rack, the 8849 Tractor's 8 tooth gears 3 LDU into theirs.
const RACK_TOLERANCE = 4.5;
// How far a gear's axle may tip about the way a rack runs, from square to its teeth, and still
// mesh (radians): the 1972 Go-Kart's steering column meets its rack at 26 degrees.
const RACK_TILT = 0.55;
// How far a bevel gear's cone tip may be from where its axle crosses the other gear's, in LDU.
// Teeth still overlap a tooth's depth (4 LDU, on the old 14 tooth bevel gear) apart: an
// official model sets one of a pair 20 LDU from where the axles cross, the other at 17.
const BEVEL_TOLERANCE = 3.5;
// How far a spur gear meshing with a crown gear may be from over its pitch circle, in LDU: the
// crown teeth stand in a band across its face (from 26 to 33 LDU out on the 24 tooth crown gear,
// round its 30 LDU pitch radius), and a spur gear over any of it engages (an official crane's
// boom drive has one 2 LDU out).
const CROWN_BAND = 3.5;

export function findGears(cyls: WorldCylinder[], bodyOf: number[]): Gear[] {
  const gears: Gear[] = [];
  for (const c of cyls) {
    const sec = c.secs[0];
    if (c.secs.length !== 1 || sec.shape !== 'G') continue;
    const center = c.start.clone().addScaledVector(c.dir, sec.length / 2);
    const width = sec.rack ? (sec.width ?? 0) : sec.length;
    gears.push({
      part: c.part,
      body: bodyOf[c.part],
      center,
      axis: c.dir.clone(),
      radius: sec.radius,
      width,
      teeth: sec.teeth ?? 0,
      spur: sec.spur !== false && !sec.rack,
      bevel: sec.bevel ?? '',
      apex: sec.apex ?? 0,
      crown: sec.crown === '+' ? 1 : sec.crown === '-' ? -1 : 0,
      worm: sec.worm ?? 0,
      face: c.face ?? null,
      length: sec.rack ? sec.length : 0,
    });
  }
  return gears;
}

// Whether gears now mesh that didn't, or no longer do, with each body moved by its pose (the
// 952 Tractor's harrow lowered onto its power take-off): if so, the mechanism wants working out
// afresh from where everything now is.
export function meshesChanged(mech: Mechanism, poses: Matrix4[]): boolean {
  const moved = mech.gears.map((g) => {
    const pose = poses[g.body];
    return { ...g, center: g.center.clone().applyMatrix4(pose), axis: g.axis.clone().transformDirection(pose), face: g.face ? g.face.clone().transformDirection(pose) : null };
  });
  const key = (m: Mesh) => `${m.gearA} ${m.gearB} ${m.kind}`;
  const now = new Set(findMeshes(moved).map(key));
  const before = new Set(mech.meshes.map(key));
  return now.size !== before.size || [...now].some((k) => !before.has(k));
}

// Which gears mesh, by where each is (gears on one body never do).
export function findMeshes(gears: Gear[]): Mesh[] {
  const meshes: Mesh[] = [];
  for (let a = 0; a < gears.length; a++) {
    for (let b = a + 1; b < gears.length; b++) {
      const ga = gears[a];
      const gb = gears[b];
      if (ga.body === gb.body) continue;
      const parallel = new Vector3().crossVectors(ga.axis, gb.axis).length() < 0.01;
      if (ga.face || gb.face) {
        if (gb.face && rackMesh(ga, gb)) meshes.push({ gearA: a, gearB: b, kind: 'rack' });
        if (ga.face && rackMesh(gb, ga)) meshes.push({ gearA: b, gearB: a, kind: 'rack' });
        continue;
      }
      if (ga.worm || gb.worm) {
        if (ga.worm && wormMesh(ga, gb)) meshes.push({ gearA: a, gearB: b, kind: 'worm' });
        if (gb.worm && wormMesh(gb, ga)) meshes.push({ gearA: b, gearB: a, kind: 'worm' });
        continue;
      }
      if (parallel && spurMesh(ga, gb)) meshes.push({ gearA: a, gearB: b, kind: 'spur' });
      if (!parallel && bevelMesh(ga, gb)) meshes.push({ gearA: a, gearB: b, kind: 'bevel' });
      if (!parallel && crownMesh(ga, gb)) meshes.push({ gearA: a, gearB: b, kind: 'crown' });
      if (!parallel && crownMesh(gb, ga)) meshes.push({ gearA: b, gearB: a, kind: 'crown' });
    }
  }
  // Racks lined up end to end on one body (two 1x4 racks on a plate) make one long row of
  // teeth: a gear meshing with one of them also meshes with the rest, though it isn't over
  // them yet, so it can roll from one to the next.
  for (const mesh of meshes.slice()) {
    if (mesh.kind !== 'rack') continue;
    gears.forEach((other, r) => {
      if (!other.face || other.body !== gears[mesh.gearB].body) return;
      if (meshes.some((m) => m.gearA === mesh.gearA && m.gearB === r)) return;
      if (rackMesh(gears[mesh.gearA], other, false)) meshes.push({ gearA: mesh.gearA, gearB: r, kind: 'rack' });
    });
  }
  return meshes;
}

// Spur gears on parallel axes mesh when their teeth are the same size, line up along the
// axis, and their axes are exactly their two pitch radii apart.
function spurMesh(ga: Gear, gb: Gear): boolean {
  if (!ga.spur || !gb.spur) return false;
  if (Math.abs(ga.radius / ga.teeth - gb.radius / gb.teeth) > 0.01) return false; // different tooth sizes
  const offset = new Vector3().subVectors(gb.center, ga.center);
  const along = offset.dot(ga.axis);
  const across = offset.clone().addScaledVector(ga.axis, -along).length();
  if ((ga.width + gb.width) / 2 - Math.abs(along) < MIN_OVERLAP) return false; // teeth don't face each other
  return Math.abs(across - (ga.radius + gb.radius)) < MESH_TOLERANCE;
}

// A worm meshes with a spur gear of the same tooth size when their axes are at right angles,
// exactly their two pitch radii apart where they pass closest, and that closest point lies
// along both the worm and the gear's teeth.
function wormMesh(worm: Gear, gear: Gear): boolean {
  if (!gear.spur || gear.worm) return false;
  if (Math.abs(worm.axis.dot(gear.axis)) > 0.01) return false;
  if (Math.abs(worm.worm - 2 * Math.PI * (gear.radius / gear.teeth)) > 0.01) return false; // tooth size
  const closest = closestPoints(worm.center, worm.axis, gear.center, gear.axis);
  if (Math.abs(closest.distance - (worm.radius + gear.radius)) > AXIS_TOLERANCE) return false;
  const alongWorm = new Vector3().subVectors(closest.onA, worm.center).dot(worm.axis);
  const alongGear = new Vector3().subVectors(closest.onB, gear.center).dot(gear.axis);
  return Math.abs(alongWorm) <= worm.width / 2 && Math.abs(alongGear) <= gear.width / 2;
}

// A spur gear meshes with a rack of the same tooth size when its axis lies across the rack (at
// right angles to the way the rack runs, and to the way its teeth face or tipped from that by
// up to RACK_TILT, as a go-kart's slanted steering column meets its rack; a round rack's teeth
// face every way), its pitch circle touches the rack's pitch line, on the side its teeth face,
// within the rack's length (unless `within` is false), and their teeth overlap across their
// widths.
export function rackMesh(gear: Gear, rack: Gear, within = true): boolean {
  if (!gear.spur || gear.worm || gear.face) return false;
  const face = rack.face!;
  // Tooth size: the distance between teeth along the pitch line.
  if (Math.abs((2 * Math.PI * gear.radius) / gear.teeth - rack.length / rack.teeth) > 0.25) return false;
  if (Math.abs(gear.axis.dot(rack.axis)) > 0.01) return false;
  const offset = new Vector3().subVectors(gear.center, rack.center);
  if (within && Math.abs(offset.dot(rack.axis)) > rack.length / 2) return false;
  // From the pitch line (a round rack's axis) to the gear's axis, in the gear's own plane.
  const apart = offset.clone().addScaledVector(rack.axis, -offset.dot(rack.axis)).addScaledVector(gear.axis, -offset.dot(gear.axis));
  if (!rack.radius && apart.dot(face) < Math.cos(RACK_TILT) * apart.length()) return false;
  if (Math.abs(apart.length() - rack.radius - gear.radius) > RACK_TOLERANCE) return false;
  return (gear.width + rack.width) / 2 - Math.abs(offset.dot(gear.axis)) >= MIN_OVERLAP;
}

// The closest points of two lines (each a point and a unit direction), and how far apart they are.
export function closestPoints(pa: Vector3, da: Vector3, pb: Vector3, db: Vector3): { onA: Vector3; onB: Vector3; distance: number } {
  const w = new Vector3().subVectors(pa, pb);
  const b = da.dot(db);
  const d = da.dot(w);
  const e = db.dot(w);
  const denominator = 1 - b * b;
  const s = denominator > 1e-9 ? (b * e - d) / denominator : 0;
  const t = denominator > 1e-9 ? (e - b * d) / denominator : e;
  const onA = pa.clone().addScaledVector(da, s);
  const onB = pb.clone().addScaledVector(db, t);
  return { onA, onB, distance: onA.distanceTo(onB) };
}

// A crown gear meshes with a spur gear (or a bevel gear, as the old differential's crown wheel's
// pinion is) of the same tooth size whose axle crosses its own at right angles, the spur gear's middle over its band of teeth (a pitch radius out from the
// crown gear's axis, within CROWN_BAND), and its pitch circle touching the crown gear's pitch
// plane on the side its teeth face.
function crownMesh(crown: Gear, gear: Gear): boolean {
  if (!crown.crown || !(gear.spur || gear.bevel) || gear.crown || gear.worm || gear.face) return false;
  if (Math.abs(crown.radius / crown.teeth - gear.radius / gear.teeth) > 0.01) return false;
  if (Math.abs(crown.axis.dot(gear.axis)) > 0.01) return false;
  const offset = new Vector3().subVectors(gear.center, crown.center);
  const along = offset.dot(crown.axis);
  const out = offset.clone().addScaledVector(crown.axis, -along);
  if (Math.abs(out.length() - crown.radius) > CROWN_BAND) return false;
  if (Math.abs(out.normalize().dot(gear.axis)) < 0.99) return false; // the gear's axle points at the crown gear's
  // A bevel gear's teeth slope back along its cone, engaging over its depth: the 8850 Rally Support
  // Truck's 14 tooth pinion sits 15 LDU from its crown wheel's pitch plane, its pitch radius 17.5.
  return Math.abs(along - crown.crown * gear.radius) <= (gear.bevel ? BEVEL_TOLERANCE : MESH_TOLERANCE);
}

// Bevel gears on crossing axes mesh when the tips of their bevel cones meet where the axes cross
// (to within BEVEL_TOLERANCE). On axes at right angles, two 45 degree cones also touch all along
// a line when their tips are either side of the crossing, as far from it as each other; gears with
// teeth of the same size mesh there if their pitch circles meet on that line. (An official
// model's differential has a 28 tooth ring whose tip is 10 LDU one side of the crossing, and the
// 20 tooth gear it meshes with has its tip 10 LDU the other side.)
function bevelMesh(ga: Gear, gb: Gear): boolean {
  if (!ga.bevel || !gb.bevel) return false;
  const crossing = axesCrossing(ga.center, ga.axis, gb.center, gb.axis);
  if (!crossing) return false;
  if (Math.abs(ga.radius / ga.teeth - gb.radius / gb.teeth) > 0.01) return false; // different tooth sizes (a knob wheel's knobs and a bevel gear's teeth)
  if (coneTipAt(ga, crossing) && coneTipAt(gb, crossing)) return true;
  if (Math.abs(ga.axis.dot(gb.axis)) > ANGLE_TOLERANCE) return false; // not at right angles
  // Where a gear's pitch circle is on the line along which its cone touches the other's: as far
  // from its tip along its own axis as along the other's.
  const pitchPoint = (cone: Cone, other: Cone, radius: number) => cone.tip.clone().addScaledVector(cone.out, radius).addScaledVector(other.out, radius);
  return cones(ga).some((a) => cones(gb).some((b) => pitchPoint(a, b, ga.radius).distanceTo(pitchPoint(b, a, gb.radius)) < BEVEL_TOLERANCE));
}

// A bevel cone: its tip, and the way it opens from there towards the teeth.
interface Cone {
  tip: Vector3;
  out: Vector3;
}

// A gear's bevel cones (two for a double bevel gear).
function cones(g: Gear): Cone[] {
  const sides = g.bevel === 'both' ? [1, -1] : g.bevel === '+' ? [1] : [-1];
  return sides.map((side) => ({ tip: g.center.clone().addScaledVector(g.axis, side * g.apex), out: g.axis.clone().multiplyScalar(-side) }));
}

// Whether one of a gear's bevel cones has its tip at `point`.
function coneTipAt(g: Gear, point: Vector3): boolean {
  return cones(g).some((cone) => cone.tip.distanceTo(point) < BEVEL_TOLERANCE);
}

// Where two axes cross: the midpoint of their closest approach, or null if they're parallel
// or pass more than AXIS_TOLERANCE apart.
export function axesCrossing(pa: Vector3, da: Vector3, pb: Vector3, db: Vector3): Vector3 | null {
  const n = new Vector3().crossVectors(da, db);
  const nn = n.lengthSq();
  if (nn < 1e-6) return null;
  const w = new Vector3().subVectors(pb, pa);
  if (Math.abs(w.dot(n)) / Math.sqrt(nn) > AXIS_TOLERANCE) return null;
  // Closest points pa + s·da and pb + t·db.
  const s = new Vector3().crossVectors(w, db).dot(n) / nn;
  const t = new Vector3().crossVectors(w, da).dot(n) / nn;
  const onA = pa.clone().addScaledVector(da, s);
  const onB = pb.clone().addScaledVector(db, t);
  return onA.add(onB).multiplyScalar(0.5);
}
