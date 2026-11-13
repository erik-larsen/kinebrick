// Meshing gears: spur, bevel, crown and worm gears, and a gear on a rack.

import { Vector3 } from 'three';
import { axesCrossing, closestPoints, type Gear, type Mesh } from '../mechanism.ts';
import type { Kinematics } from '../kinematics.ts';
import { addPointVelocity, axisOf, DRIVE_WEIGHT, type Equations } from './equations.ts';

export function gears(solver: Kinematics, eq: Equations) {
  const { n, add, gaps } = eq;
  // Meshing gears: where their teeth touch (the pitch point), both gears' teeth move at the
  // same speed across the mesh. (Moving the other ways would pull the teeth apart, which the
  // joints already prevent.) A rack that slides in what its gear turns in has its own gap: how
  // far it has slid short of what its gear has turned (see rackSlip).
  for (const mesh of solver.mech.meshes) {
    const contact = meshContact(solver, mesh);
    if (!contact) continue;
    const { a, b, pitchPoint, across } = contact;
    const row = new Array(n).fill(0);
    for (let k = 0; k < 3; k++) {
      const ra = new Array(n).fill(0);
      const rb = new Array(n).fill(0);
      addPointVelocity(ra, a.body, pitchPoint, k, 1);
      addPointVelocity(rb, b.body, pitchPoint, k, -1);
      for (let i = 0; i < n; i++) row[i] += across.getComponent(k) * (ra[i] + rb[i]);
    }
    add(row, gaps && mesh.kind === 'rack' ? -rackSlip(solver, contact) : 0, DRIVE_WEIGHT);
  }
}

// Where two meshing gears' teeth touch now (the pitch point), and the direction their teeth
// move there. Recomputed from where the gears are, since in a differential the gears'
// axles themselves go round.
export function meshContact(solver: Kinematics, mesh: Mesh): { a: Gear; b: Gear; pitchPoint: Vector3; across: Vector3 } | null {
  const a = solver.mech.gears[mesh.gearA];
  const b = solver.mech.gears[mesh.gearB];
  const axisA = a.axis.clone().transformDirection(solver.poses[a.body]);
  const axisB = b.axis.clone().transformDirection(solver.poses[b.body]);
  // With the centres option, each gear's centre is taken on the axis of the joint it turns on
  // (see Kinematics.onAxis), for every kind of mesh.
  const ca = solver.onAxis(a.body, a.center.clone().applyMatrix4(solver.poses[a.body]), axisA);
  const cb = solver.onAxis(b.body, b.center.clone().applyMatrix4(solver.poses[b.body]), axisB);
  if (mesh.kind === 'worm') {
    // a is the worm. Where it meets the gear: from the worm's axis towards the gear's, out
    // by the worm's pitch radius. There the worm's thread surface and the gear's tooth must
    // move together across that surface. The thread is a helix leaning at the lead angle λ
    // (tan λ = lead ÷ circumference), so the surface faces mostly along the worm's axis,
    // tipped by λ towards the way the worm's surface moves: as the worm turns once, the gear's
    // tooth is pushed one lead along.
    const closest = closestPoints(ca, axisA, cb, axisB);
    const out = new Vector3().subVectors(closest.onB, closest.onA).normalize();
    const pitchPoint = closest.onA.clone().addScaledVector(out, a.radius);
    const surface = new Vector3().crossVectors(axisA, out); // how the worm's surface moves there
    const lean = Math.atan(a.worm / (2 * Math.PI * a.radius));
    const across = axisA.clone().multiplyScalar(Math.cos(lean)).addScaledVector(surface, -Math.sin(lean));
    return { a, b, pitchPoint, across };
  }
  if (mesh.kind === 'rack') {
    // b is the rack. Where the gear's pitch circle touches the rack's pitch line, the gear's
    // teeth and the rack move at the same speed along the rack. That's towards the rack's
    // teeth, in the gear's plane (a slanted gear's axle tips from square to them; see rackMesh),
    // or for a round rack, whose teeth face every way, towards the gear from the rack's axis.
    const face = b.radius ? new Vector3().subVectors(ca, cb).addScaledVector(axisB, -new Vector3().subVectors(ca, cb).dot(axisB)) : b.face!.clone().transformDirection(solver.poses[b.body]);
    const toward = face.addScaledVector(axisA, -face.dot(axisA)).normalize();
    const pitchPoint = ca.clone().addScaledVector(toward, -a.radius);
    return { a, b, pitchPoint, across: axisB };
  }
  if (mesh.kind === 'crown') {
    // a is the crown gear. Where the spur gear's pitch circle touches the crown gear's pitch
    // plane, both gears' teeth move at the same speed round the crown gear's axis. Their teeth
    // mesh one for one wherever the spur gear sits along the crown's radius (its teeth run
    // radially), so the crown's are taken at its pitch radius, in line with the spur gear (out
    // along the spur gear's axis, which doesn't change how fast the spur gear's teeth move):
    // their speeds come out in the ratio of their tooth counts, as built (a helicopter's spur
    // gear sits 2 LDU in from it) or not.
    const toward = axisA.clone().multiplyScalar(-a.crown);
    const touch = cb.clone().addScaledVector(toward, b.radius);
    const height = new Vector3().subVectors(touch, ca).dot(axisA);
    const out = new Vector3().subVectors(touch, ca).addScaledVector(axisA, -height).normalize();
    const pitchPoint = ca.clone().addScaledVector(axisA, height).addScaledVector(out, a.radius);
    const across = new Vector3().crossVectors(axisA, out).normalize();
    return { a, b, pitchPoint, across };
  }
  if (mesh.kind === 'spur') {
    // On the line between the centres, split in the ratio of the pitch radii.
    const pitchPoint = ca.clone().lerp(cb, a.radius / (a.radius + b.radius));
    const across = new Vector3().crossVectors(axisA, new Vector3().subVectors(cb, ca)).normalize();
    return { a, b, pitchPoint, across };
  }
  // Bevel: from where the axes cross, out towards each gear in the ratio of the *other*
  // gear's teeth, so that each gear's teeth move at (its turning speed) x (its tooth count)
  // there, which makes the speeds come out in the ratio of the tooth counts.
  // The mesh was found with the axes no further apart than a tolerance, but a pair built right at
  // it may drift a hair past it as it turns (the 8859 Tractor's differential, its half shafts'
  // bevels half an LDU off the spider's axis: after one step, the spider lost both its meshes,
  // and the engine stopped as the tractor rolled on). So a mesh found keeps its crossing: the
  // middle of the shortest line between the axes, unless they've come into line.
  let crossing = axesCrossing(ca, axisA, cb, axisB);
  if (!crossing) {
    if (new Vector3().crossVectors(axisA, axisB).lengthSq() < 1e-6) return null;
    const { onA, onB } = closestPoints(ca, axisA, cb, axisB);
    crossing = onA.add(onB).multiplyScalar(0.5);
  }
  const towardA = new Vector3().subVectors(ca, crossing).normalize();
  const towardB = new Vector3().subVectors(cb, crossing).normalize();
  const pitchPoint = crossing.clone().addScaledVector(towardA, b.teeth).addScaledVector(towardB, a.teeth);
  const across = new Vector3().crossVectors(towardA, towardB).normalize();
  return { a, b, pitchPoint, across };
}

// How far a rack's gear has slipped along it since the start, in LDU: how far the gear's teeth
// have gone along the rack, for the turn of the joint it turns on, less how far the rack has
// slid on its slide joint, both relative to what the gear turns in. A gear mesh is a rule
// about speeds, and each step only keeps to it at the step's start, so a rack the tree reaches
// through a linkage (a steering rack on its tie rods) would slip a little every step, and
// nothing would undo it. 0 if the rack doesn't slide in what its gear turns in, or if the gear
// meshes another rack too: two racks on one gear, both in a linkage (the 856 Bulldozer's
// bucket), can't both be kept exactly in step, since the model's rounded-off positions leave
// them a hair apart, and taking up the slip of each would wrench the linkage until it couldn't
// move at all.
function rackSlip(solver: Kinematics, contact: { a: Gear; b: Gear; pitchPoint: Vector3; across: Vector3 }): number {
  const { a, b, pitchPoint, across } = contact;
  const racks = new Set(solver.mech.meshes.filter((m) => m.kind === 'rack' && solver.mech.gears[m.gearA].body === a.body).map((m) => solver.mech.gears[m.gearB].body));
  if (racks.size > 1) return 0;
  const link = solver.parentLink(a.body);
  if (!link) return 0;
  const mount = link.parent;
  const slide = solver.mech.joints.findIndex((j) => j.kind === 'slide' && ((j.bodyA === mount && j.bodyB === b.body) || (j.bodyA === b.body && j.bodyB === mount)));
  if (slide < 0) return 0;
  // Turning the joint by 1 moves the gear's teeth, at the pitch point, by d × (pitch point - c).
  const turn = solver.mech.joints[link.joint];
  const d = axisOf(turn.from, turn.to).transformDirection(solver.poses[turn.bodyA]);
  const c = turn.from.clone().applyMatrix4(solver.poses[turn.bodyA]);
  const teeth = new Vector3().crossVectors(d, new Vector3().subVectors(pitchPoint, c)).dot(across);
  const turned = (turn.bodyB === a.body ? 1 : -1) * solver.jointAngles[link.joint] * teeth;
  const s = solver.mech.joints[slide];
  const along = axisOf(s.from, s.to).transformDirection(solver.poses[s.bodyA]).dot(across);
  const slid = (s.bodyB === b.body ? 1 : -1) * solver.slideOffset(slide) * along;
  return turned - slid;
}
