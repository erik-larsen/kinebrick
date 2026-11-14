// Joints: how bodies may move against each other, from the connections between them.

import { Vector3 } from 'three';
import type { Connection, Joint } from '../mechanism.ts';
import { ANGLE_TOLERANCE, AXIS_TOLERANCE } from './shared.ts';

// A part pinned to two arms that turn on one body, all on parallel axes (a steering rack
// pinned to both steering arms), is the coupler of a four-bar linkage: that sets its path, a
// curve as the arms swing. So it doesn't also slide straight on that body, as a plate on tiles
// under it, or a guide for a rack, would have it: the two together would only fit as the model
// was built, and it would jam a step further on (the 8841 Dune Buggy's and the 8063 Tractor's
// steering, whose arms turn on the frame). Such slides are left out. A slide on any other body
// is kept, the frame too, when the arms don't turn on it: the 42081's front chassis is the
// coupler of arms that turn on its rear body, and its rack slides in a housing in the frame,
// which holds it sideways.
export function withoutSlidesOnCouplers(joints: Joint[]): Joint[] {
  const axis = (j: Joint) => new Vector3().subVectors(j.to, j.from).normalize();
  const parallel = (a: Joint, b: Joint) => new Vector3().crossVectors(axis(a), axis(b)).length() < ANGLE_TOLERANCE;
  const other = (j: Joint, body: number) => (j.bodyA === body ? j.bodyB : j.bodyA);
  const pins = (body: number) => joints.filter((j) => j.kind === 'revolute' && (j.bodyA === body || j.bodyB === body));
  // The bodies a part's four-bars turn on, if it's a coupler (never the frame).
  const bases = (body: number): number[] => {
    if (body === 0) return [];
    const found: number[] = [];
    const own = pins(body);
    // What an arm turns on, about an axis parallel to the pin joining it to the part.
    const turnsOn = (arm: number, pin: Joint) => pins(arm).filter((j) => j !== pin && other(j, arm) !== body && parallel(j, pin)).map((j) => other(j, arm));
    own.forEach((a, i) => {
      for (const b of own.slice(i + 1)) {
        const [armA, armB] = [other(a, body), other(b, body)];
        if (armA === armB || !parallel(a, b)) continue;
        const onA = turnsOn(armA, a);
        for (const g of turnsOn(armB, b)) if (g !== armA && g !== armB && onA.includes(g)) found.push(g);
      }
    });
    return found;
  };
  return joints.filter((j) => {
    if (j.kind !== 'slide' || j.turns) return true;
    const onA = bases(j.bodyA);
    const onB = bases(j.bodyB);
    return !onA.includes(j.bodyB) && !onB.includes(j.bodyA);
  });
}

// How far a slide's male part may slide from where it is, relative to the female: for as long
// as they still overlap by `overlap`, as a plate may overhang the end of its row of tiles, and
// a piston's skirt come out of the bottom of its cylinder.
function slideRange(e: { male: [number, number]; female: [number, number]; overlap: number }): [number, number] {
  const [mLo, mHi] = e.male;
  const [fLo, fHi] = e.female;
  return [fLo - mHi + e.overlap, fHi - mLo - e.overlap];
}

// Revolute, slide and ball connections between different bodies, merged when they're the
// same kind and share both bodies and an axis (an axle passing through two holes of the
// frame is one joint) or, for balls, a centre.
export function findJoints(connections: Connection[], bodyOf: number[]): Joint[] {
  const joints: Joint[] = [];
  for (const c of connections) {
    if (c.kind !== 'revolute' && c.kind !== 'slide' && c.kind !== 'ball') continue;
    const a = bodyOf[c.male];
    const b = bodyOf[c.female];
    if (a === b) continue;
    const kind = c.kind;
    // Slides between the same two bodies along parallel lines are one joint too (an outrigger
    // riding on two rows of tiles side by side).
    const along = (j: Joint) => (kind === 'ball' ? j.from.distanceTo(c.from) < AXIS_TOLERANCE : kind === 'slide' ? parallel(j, c) : onSameAxis(j, c));
    const existing = joints.find((j) => j.kind === kind && j.turns === c.turns && sameBodies(j, a, b) && along(j));
    if (existing) {
      if (kind !== 'ball') extendJoint(existing, c);
      existing.stiff = existing.stiff || c.stiff === true;
      if (c.motor) existing.motor = true;
    } else {
      joints.push({ kind, bodyA: Math.min(a, b), bodyB: Math.max(a, b), from: c.from.clone(), to: c.to.clone(), stiff: c.stiff === true, ...(c.motor ? { motor: true } : {}), ...(c.turns ? { turns: true } : {}), ...(c.springHeld ? { springHeld: true } : {}) });
    }
  }

  // A slide joint's travel, from all the slide connections behind it together. Along one line
  // they add up (a plate on a row of tiles may slide as far as it stays over the row, not over
  // each tile); lines side by side each allow their own travel, and the joint may slide as far
  // as any of them allows (an outrigger may leave a short tile at its end behind).
  for (const joint of joints) {
    if (joint.kind !== 'slide') continue;
    const dir = new Vector3().subVectors(joint.to, joint.from).normalize();
    const lines: Connection[][] = [];
    for (const c of connections) {
      if (c.kind !== 'slide' || c.turns !== joint.turns || !c.extents || !sameBodies(joint, bodyOf[c.male], bodyOf[c.female]) || !parallel(joint, c)) continue;
      const line = lines.find((l) => onSameLine(l[0], c));
      if (line) line.push(c);
      else lines.push([c]);
    }
    let range: [number, number] | null = null;
    for (const line of lines) {
      let male: [number, number] = [Infinity, -Infinity];
      let female: [number, number] = [Infinity, -Infinity];
      let maleBody = -1;
      let overlap = 0;
      for (const c of line) {
        // Move the connection's extents to be measured from the joint's `from`, along its axis.
        const sign = new Vector3().subVectors(c.to, c.from).dot(dir) >= 0 ? 1 : -1;
        const shift = new Vector3().subVectors(c.from, joint.from).dot(dir);
        const place = ([lo, hi]: [number, number]): [number, number] => [Math.min(shift + sign * lo, shift + sign * hi), Math.max(shift + sign * lo, shift + sign * hi)];
        const [m0, m1] = place(c.extents!.male);
        const [f0, f1] = place(c.extents!.female);
        male = [Math.min(male[0], m0), Math.max(male[1], m1)];
        female = [Math.min(female[0], f0), Math.max(female[1], f1)];
        maleBody = bodyOf[c.male];
        overlap = c.extents!.overlap;
        joint.sliding = [c.male, c.female];
      }
      // How far the male may slide; the joint measures bodyB relative to bodyA.
      const r = slideRange({ male, female, overlap });
      const lineRange: [number, number] = joint.bodyB === maleBody ? r : [-r[1], -r[0]];
      range = range ? [Math.min(range[0], lineRange[0]), Math.max(range[1], lineRange[1])] : lineRange;
    }
    if (range) joint.range = range;
  }
  return joints;
}

function sameBodies(j: Joint, a: number, b: number): boolean {
  return (j.bodyA === a && j.bodyB === b) || (j.bodyA === b && j.bodyB === a);
}

// Whether a connection's axis runs the same way as a joint's.
function parallel(j: Joint, c: Connection): boolean {
  const dj = new Vector3().subVectors(j.to, j.from).normalize();
  const dc = new Vector3().subVectors(c.to, c.from).normalize();
  return new Vector3().crossVectors(dj, dc).length() < 0.01;
}

// Whether two connections lie on one line.
function onSameLine(a: Connection, b: Connection): boolean {
  const dir = new Vector3().subVectors(a.to, a.from).normalize();
  const offset = new Vector3().subVectors(b.from, a.from);
  return offset.addScaledVector(dir, -offset.dot(dir)).length() < AXIS_TOLERANCE;
}

function onSameAxis(j: Joint, c: Connection): boolean {
  const dir = new Vector3().subVectors(j.to, j.from).normalize();
  const distance = (p: Vector3) => {
    const offset = new Vector3().subVectors(p, j.from);
    return offset.addScaledVector(dir, -offset.dot(dir)).length();
  };
  return distance(c.from) < AXIS_TOLERANCE && distance(c.to) < AXIS_TOLERANCE;
}

// Stretch the joint's segment so it also covers the connection's overlap.
function extendJoint(j: Joint, c: Connection) {
  const dir = new Vector3().subVectors(j.to, j.from).normalize();
  const origin = j.from.clone();
  const ts = [0, j.to.clone().sub(origin).dot(dir), c.from.clone().sub(origin).dot(dir), c.to.clone().sub(origin).dot(dir)];
  j.from = origin.clone().addScaledVector(dir, Math.min(...ts));
  j.to = origin.clone().addScaledVector(dir, Math.max(...ts));
}
