// Parts resting on others under gravity: push rods and rockers.

import { Matrix4, Vector3 } from 'three';
import { acrossDirections } from '../kinematics.ts';
import { PlacedPart } from '../ldr.ts';
import type { Connection, Rest, RestContact } from '../mechanism.ts';
import { ALIGN_TOLERANCE, ANGLE_TOLERANCE, AXIS_TOLERANCE, LOOSE_ALIGN_TOLERANCE, type WorldCylinder } from './shared.ts';

// Where a resting face touches what it rests on, each placed by its pose (model -> where it is
// now): the point, the way the face would have to move to reach it, and how far (negative if
// they overlap); or null if the shape isn't under the face.
export function restTouch(contact: RestContact, facePose: Matrix4, shapePose: Matrix4): { point: Vector3; dir: Vector3; clearance: number } | null {
  const { face, shape } = contact;
  const o = face.point.clone().applyMatrix4(facePose);
  const n = face.normal.clone().transformDirection(facePose);
  const across = face.across.clone().transformDirection(facePose);
  const along = face.along.clone().transformDirection(facePose);
  const p = shape.point.clone().applyMatrix4(shapePose);
  const u = shape.axis.clone().transformDirection(shapePose);
  // How far the face reaches from its middle along a direction in it.
  const reach = (d: Vector3) => face.half[0] * Math.abs(d.dot(across)) + face.half[1] * Math.abs(d.dot(along));
  // Whether a point is over the face, or within `margin` of it.
  const within = (q: Vector3, margin = 0) => {
    const off = new Vector3().subVectors(q, o);
    return Math.abs(off.dot(across)) <= face.half[0] + margin + 1e-9 && Math.abs(off.dot(along)) <= face.half[1] + margin + 1e-9;
  };
  if (shape.kind === 'plane') return { point: o, dir: n, clearance: new Vector3().subVectors(p, o).dot(n) };
  if (shape.kind === 'disc') {
    // The disc's rim, where it reaches furthest towards the face. Within a few degrees of facing
    // the face square (SQUARE, as the sine of the angle), it's taken partly in from the rim:
    // there the whole disc nearly touches, and the nearest point of its rim would otherwise jump
    // from one side to the other as the face tips through square, which no loop could follow
    // (a rocker lying level on a push rod).
    const SQUARE = 0.05;
    const out = n.clone().addScaledVector(u, -n.dot(u));
    let q = p.clone().addScaledVector(out, -shape.radius / Math.sqrt(out.lengthSq() + SQUARE * SQUARE));
    // Only the part of the disc under the face counts (a brick's edge coming down on the rim of a
    // stud just beyond it): the point pulled in over the face, then back onto the disc, twice.
    for (let k = 0; k < 2 && !within(q); k++) {
      const off = new Vector3().subVectors(q, o);
      const over = o.clone().addScaledVector(across, Math.min(Math.max(off.dot(across), -face.half[0]), face.half[0])).addScaledVector(along, Math.min(Math.max(off.dot(along), -face.half[1]), face.half[1])).addScaledVector(n, off.dot(n));
      const d = new Vector3().subVectors(over, p);
      d.addScaledVector(u, -d.dot(u));
      if (d.length() > shape.radius) d.setLength(shape.radius);
      q = p.clone().add(d);
    }
    return within(q, 0.5) ? { point: q, dir: n, clearance: new Vector3().subVectors(q, o).dot(n) } : null;
  }
  // A cylinder lying across the face: where along it the face is, if it reaches the face at all.
  const t = new Vector3().subVectors(o, p).dot(u);
  if (t < -reach(u) || t > shape.length + reach(u)) return null;
  const middle = p.clone().addScaledVector(u, Math.min(Math.max(t, 0), shape.length));
  // Across the cylinder, the face is a strip: the cylinder's highest point over it (towards the
  // face), straight under the strip's edge if its axis is beside the strip, which the face rests
  // on however high the axis is. (A pin coming round beside a push rod's foot, above it, lifts
  // the rod as soon as it reaches under the foot, rather than running into its side.)
  const side = new Vector3().crossVectors(n, u).normalize();
  const off = new Vector3().subVectors(middle, o);
  const across0 = off.dot(side);
  const edge = Math.min(Math.max(across0, -reach(side)), reach(side));
  const beside = Math.abs(across0 - edge);
  if (beside >= shape.radius) return null;
  const up = Math.sqrt(shape.radius * shape.radius - beside * beside);
  const top = middle.clone().addScaledVector(side, edge - across0).addScaledVector(n, -up);
  return { point: top, dir: n, clearance: off.dot(n) - up };
}

// Parts resting on others under gravity, which Kinebrick has no forces for, so keeps touching
// what they rest on (see Rest). Two kinds, both in the 858 inline engine's valve train:
//
//   push rods  an upright axle with bushes on it and nothing else, turning in round holes in one
//              other body, that stands by its bottom bush on a shaft turning across it below (the
//              pins on an engine's camshaft, or the camshaft itself between them), or by a bush
//              higher up on the hole under it. It rests on whichever is higher, so pins lift it as
//              they come round under it, and it drops back after them. Its holes become slides
//              that turn, as far up as its bushes let it go (see slideRange).
//   rockers    a part turning on an axle across a push rod whose underside lies on the rod's top
//              bush, so it tips as the rod rises and falls (a valve's rocker).
//
// Taken only where the rod (and the rocker) is built resting, within ALIGN_TOLERANCE.
export function restingParts(parts: PlacedPart[], roles: string[], cyls: WorldCylinder[], connections: Connection[], bodyOf: number[]): Rest[] {
  const BUSH_RADIUS = 9; // a Technic bush's flanges (3713), round its axle
  const REACH = 30; // how far below a push rod's foot what it may stand on may be, in LDU
  const TOUCH = 0.5; // LDU: parts along an axle this close touch
  const identity = new Matrix4();
  const clearance = (c: RestContact) => restTouch(c, identity, identity)?.clearance ?? Infinity;
  // The axes a body turns about (in a round hole, on an axle).
  const axesOf = (body: number) => connections.filter((c) => c.kind === 'revolute' && bodyOf[c.male] !== bodyOf[c.female] && (bodyOf[c.male] === body || bodyOf[c.female] === body)).map((c) => new Vector3().subVectors(c.to, c.from).normalize());
  const turnsAbout = (body: number, d: Vector3) => axesOf(body).some((a) => a.clone().cross(d).length() < ANGLE_TOLERANCE);
  // Each part's underside, facing down: where its anti-studs open, as a face reaching half a stud
  // beyond their middles. And the studs pointing up, which an underside may rest on.
  const mouths = new Map<number, WorldCylinder[]>();
  for (const c of cyls) {
    if (c.gender !== 'F' || c.caps !== 'one' || c.secs.length !== 1 || !['S', 'R'].includes(c.secs[0].shape) || Math.abs(c.secs[0].radius - 6) > AXIS_TOLERANCE || -c.dir.y < 0.5) continue;
    mouths.set(c.part, [...(mouths.get(c.part) ?? []), c]);
  }
  const undersides = new Map<number, RestContact['face']>();
  for (const [part, list] of mouths) {
    if (list.some((m) => m.dir.dot(list[0].dir) < 1 - ANGLE_TOLERANCE)) continue;
    const normal = list[0].dir.clone().negate();
    const middle = list.reduce((sum, m) => sum.add(m.start), new Vector3()).divideScalar(list.length);
    // Its two ways, along its row of anti-studs (or any way, for one) and across it.
    const far = list.reduce((best, m) => (m.start.distanceTo(middle) > best.distanceTo(middle) ? m.start : best), middle);
    const lengthways = far.distanceTo(middle) > 1e-6 ? new Vector3().subVectors(far, middle).normalize() : acrossDirections(normal)[0];
    const sideways = new Vector3().crossVectors(normal, lengthways).normalize();
    const halfOf = (d: Vector3) => Math.max(...list.map((m) => Math.abs(new Vector3().subVectors(m.start, middle).dot(d)))) + 10;
    undersides.set(part, { point: middle, normal, across: sideways, along: lengthways, half: [halfOf(sideways), halfOf(lengthways)] });
  }
  const studs = cyls.filter((c) => c.gender === 'M' && c.caps === 'one' && c.secs.length === 1 && c.secs[0].shape === 'R' && Math.abs(c.secs[0].radius - 6) < AXIS_TOLERANCE && -c.dir.y > 0.5);
  const rests: Rest[] = [];
  for (const axle of cyls.filter((c) => c.gender === 'M' && roles[c.part] === 'axle' && Math.abs(c.dir.y) > 1 - ANGLE_TOLERANCE)) {
    const rod = bodyOf[axle.part];
    const own = parts.flatMap((_, i) => (bodyOf[i] === rod ? [i] : []));
    if (rod === 0 || own.some((i) => i !== axle.part && roles[i] !== 'bush')) continue;
    const holes = connections.filter((c) => c.kind === 'revolute' && c.male === axle.part && bodyOf[c.female] !== rod);
    if (!holes.length || new Set(holes.map((c) => bodyOf[c.female])).size > 1) continue;
    if (connections.some((c) => !holes.includes(c) && bodyOf[c.male] !== bodyOf[c.female] && (bodyOf[c.male] === rod || bodyOf[c.female] === rod))) continue;
    const mount = bodyOf[holes[0].female];
    // Up the axle, and how high a point is along it.
    const up = axle.dir.y < 0 ? axle.dir.clone() : axle.dir.clone().negate();
    const height = (p: Vector3) => p.dot(up);
    const point = (h: number) => axle.start.clone().addScaledVector(up, h - height(axle.start));
    const span = (c: Connection): [number, number] => [Math.min(height(c.from), height(c.to)), Math.max(height(c.from), height(c.to))];
    const bushes = connections.filter((c) => c.kind === 'rigid' && c.male === axle.part && roles[c.female] === 'bush').map(span);
    if (!bushes.length) continue;
    const [across, along] = acrossDirections(up);
    const foot = (h: number) => ({ point: point(h), normal: up.clone().negate(), across, along, half: [BUSH_RADIUS, BUSH_RADIUS] as [number, number] });
    // The bottom bush on what's below it, or may come round below it: the cylinders, near it
    // and lying across under it, of a body that turns about them.
    const bottom = bushes.reduce((low, b) => (b[0] < low[0] ? b : low));
    const footAt = point(bottom[0]);
    const on: RestContact[] = [];
    for (const c of cyls) {
      const body = bodyOf[c.part];
      if (c.gender !== 'M' || body === rod || body === mount || Math.abs(c.dir.dot(up)) > ANGLE_TOLERANCE || !turnsAbout(body, c.dir)) continue;
      let at = 0;
      for (const sec of c.secs) {
        const start = c.start.clone().addScaledVector(c.dir, at);
        at += sec.length;
        const t = new Vector3().subVectors(footAt, start).dot(c.dir);
        if (t < -BUSH_RADIUS || t > sec.length + BUSH_RADIUS) continue; // not across under it
        const off = new Vector3().subVectors(start.clone().addScaledVector(c.dir, t), footAt);
        if (Math.abs(off.dot(up)) > REACH || off.addScaledVector(up, -off.dot(up)).length() > BUSH_RADIUS + REACH) continue;
        on.push({ face: foot(bottom[0]), body, shape: { kind: 'cylinder', point: start, axis: c.dir.clone(), length: sec.length, radius: sec.radius } });
      }
    }
    if (!on.length) continue;
    // Each bush on the top of a hole under it.
    const holeSpans = holes.map(span);
    let [drop, rise] = [Infinity, Infinity];
    for (const b of bushes) {
      for (const h of holeSpans) {
        if (b[0] >= h[1] - TOUCH) {
          drop = Math.min(drop, b[0] - h[1]);
          on.push({ face: foot(b[0]), body: mount, shape: { kind: 'plane', point: point(h[1]), axis: up.clone(), length: 0, radius: 0 } });
        } else if (b[1] <= h[0] + TOUCH) rise = Math.min(rise, h[0] - b[1]);
      }
    }
    if (Math.abs(Math.min(...on.map(clearance))) > ALIGN_TOLERANCE) continue; // not resting as built
    // Its holes become slides: up as far as its bushes let it, down (beyond where it rests) a
    // little, so resting on the hole's top doesn't count as the end of its travel.
    for (const c of holes) {
      const room: [number, number] = [-(Math.min(drop, REACH) + 1), Math.min(rise, REACH)];
      const way = new Vector3().subVectors(c.to, c.from).dot(up) >= 0 ? 1 : -1;
      c.kind = 'slide';
      c.turns = true;
      c.extents = { male: [0, 0], female: way > 0 ? [-room[1], -room[0]] : room, overlap: 0 };
    }
    rests.push({ body: rod, on });
    // A rocker lying on its top bush: a part's underside (its anti-studs' mouths) over the bush's
    // rim, on a body turning about an axis across the rod. It rests on the rod, or on whatever
    // studs are under its parts' undersides, whichever is higher: when the rod drops, a valve's
    // rocker comes down on the plate the rod stands through.
    const top = bushes.reduce((high, b) => (b[1] > high[1] ? b : high));
    const disc = { kind: 'disc' as const, point: point(top[1]), axis: up.clone(), length: 0, radius: BUSH_RADIUS };
    for (const [part, face] of undersides) {
      const body = bodyOf[part];
      if ([rod, mount, 0].includes(body) || rests.some((r) => r.body === body)) continue;
      const contact: RestContact = { face, body: rod, shape: disc };
      if (Math.abs(clearance(contact)) > ALIGN_TOLERANCE || !axesOf(body).some((a) => Math.abs(a.dot(up)) < ANGLE_TOLERANCE)) continue;
      const on = [contact];
      for (const [other, f] of undersides) {
        if (bodyOf[other] !== body) continue;
        for (const stud of studs) {
          if (bodyOf[stud.part] === body || bodyOf[stud.part] === rod) continue;
          const onStud: RestContact = { face: f, body: bodyOf[stud.part], shape: { kind: 'disc', point: stud.start.clone().addScaledVector(stud.dir, stud.secs[0].length), axis: stud.dir.clone(), length: 0, radius: stud.secs[0].radius } };
          if (clearance(onStud) < REACH) on.push(onStud);
        }
      }
      rests.push({ body, on });
    }
  }
  // A part built a little into a flat thing it rests on rests where it's built: that's taken
  // as much lower (the 858 inline engine's rockers sink 1.6 LDU into the studs under them).
  // Not a pin coming round under a push rod: it turns, so it's that far in at only one turn.
  for (const rest of rests) {
    for (const c of rest.on) {
      const into = -clearance(c);
      if (c.shape.kind !== 'cylinder' && into > 0 && into <= LOOSE_ALIGN_TOLERANCE) c.shape.point.addScaledVector(c.face.normal, into);
    }
  }
  return rests;
}
