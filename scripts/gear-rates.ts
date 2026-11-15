// How fast each part of a gear train should turn for each turn of its control, worked out from
// tooth counts alone, as a gear calculator would, without the solver: so the function check can
// tell whether a drag moved a part by the right amount, not only whether it moved.
//
// Each body's speed is taken against its housing (see line): what its shaft turns in, down
// joints all on one line (a differential's carrier, on one of its half shafts, turns in the
// frame), and gears tie only bodies in the same housing, whose speeds the gears alone set. Each
// speed is signed, about the body's joint axis (or along it, for a slide), so that a differential
// can be followed. Only bodies whose housing is the frame are given (as the function check
// measures them), but the speeds are followed through others (a wheel, turning in its upright,
// drives its half shaft through a universal joint). What ties two of them together:
//
//   spur, bevel and crown gears   each turns its partner's teeth by its own: B turns tA/tB as fast,
//                                 the way their teeth move together where they touch
//   a worm                        its gear turns one thread's advance at its pitch radius for each
//                                 turn of the worm (not back: a worm locks)
//   a gear on a rack              the rack slides the gear's pitch radius for each radian
//   a universal joint             both shafts turn as fast as each other (each in its own housing)
//   a linear actuator's screw     its piston slides one lead for each turn of its input (not back)
//   a chain, track or rubber band its wheels' rims move at its speed: each turns as fast as the
//                                 others in inverse ratio of their radii round it
//   a differential                its carrier turns at the average of its two side gears, each
//                                 weighed by its teeth: tA (a - c) + tB (b - c) = 0. Any two of the
//                                 three give the third (a planet, turning in the carrier, is
//                                 what ties them, and isn't counted itself)
//
// A body reached two ways at different speeds (the gears jam, or a loop of them runs through
// something else) gets no expected speed.

import { Vector3 } from 'three';
import { Gear, Mechanism } from '../src/mechanism.ts';

// For each body turning or sliding in the frame, how fast it should turn (radians) or slide (LDU)
// for each radian `control` turns against its housing, by size (which way aside). `parentLink` is the kinematics' tree:
// each body's parent and the joint it turns or slides on. `together`: bodies turned with the
// control, about the same axis and as fast (a vehicle's wheels, as pushing it turns them).
export function gearRates(mech: Mechanism, parentLink: (body: number) => { parent: number; joint: number } | null, control: number, together: number[] = []): Map<number, number> {
  const signed = signedGearRates(mech, parentLink, control, together);
  return new Map([...signed].filter(([b]) => line(mech, parentLink, b)!.housing === 0).map(([b, s]) => [b, Math.abs(s)]));
}

// As gearRates, but for every body reached, each speed signed: about (or along) the body's joint
// axis, the way that joint's angle (or slide) grows as the body turns against its housing.
export function signedGearRates(mech: Mechanism, parentLink: (body: number) => { parent: number; joint: number } | null, control: number, together: number[] = []): Map<number, number> {
  const counted = (b: number) => line(mech, parentLink, b) !== null;
  const rates = new Map<number, number>();
  if (!counted(control)) return rates;
  // Each counted body's axis, the way its joint's angle grows as the body turns against its
  // housing; and its housing.
  const axisOf = (b: number) => line(mech, parentLink, b)!.joints[0].axis;
  const housing = (b: number) => line(mech, parentLink, b)!.housing;
  const housed = (a: number, b: number) => housing(a) === housing(b);
  // How fast a point at `p` moves, for each radian its body turns about its axis.
  const along = (b: number, g: Gear, p: Vector3) => axisOf(b).cross(p.clone().sub(g.center));
  // Where two gears' teeth touch: the point of a's pitch circle nearest b.
  const touch = (a: Gear, b: Gear) => {
    const q = b.center.clone().sub(a.center);
    q.addScaledVector(a.axis, -q.dot(a.axis));
    return a.center.clone().addScaledVector(q.normalize(), a.radius);
  };
  const way = (x: number) => (x < 0 ? -1 : 1);

  // Each tie, both ways where it goes both ways: from a body, to another, at this many times
  // its speed.
  const ties = new Map<number, { to: number; times: number }[]>();
  const tie = (from: number, to: number, times: number, across = false) => {
    if (from === to || !(times !== 0) || !Number.isFinite(times)) return;
    if (!counted(from) || !counted(to) || (!across && !housed(from, to))) return;
    if (!ties.has(from)) ties.set(from, []);
    ties.get(from)!.push({ to, times });
  };
  for (const mesh of mech.meshes) {
    const [a, b] = [mech.gears[mesh.gearA], mech.gears[mesh.gearB]];
    if (!counted(a.body) || !counted(b.body)) continue;
    if (mesh.kind === 'rack') {
      // Where the rack's pitch line passes the gear.
      const q = b.center.clone().addScaledVector(b.axis, a.center.clone().sub(b.center).dot(b.axis));
      const p = a.center.clone().addScaledVector(q.sub(a.center).addScaledVector(a.axis, -q.dot(a.axis)).normalize(), a.radius);
      const times = a.radius * way(along(a.body, a, p).dot(axisOf(b.body)));
      tie(a.body, b.body, times);
      tie(b.body, a.body, 1 / times);
    } else if (mesh.kind === 'worm') {
      // The gear's teeth go along the worm's axis, one advance a turn, the way a nut on it
      // would, kept from turning.
      const p = touch(b, a);
      const thread = a.axis.clone().multiplyScalar((-a.worm / (2 * Math.PI)) * axisOf(a.body).dot(a.axis));
      tie(a.body, b.body, (Math.abs(a.worm) / (2 * Math.PI * b.radius)) * way(thread.dot(along(b.body, b, p))));
    } else {
      const p = touch(a, b);
      tie(a.body, b.body, (a.teeth / b.teeth) * way(along(a.body, a, p).dot(along(b.body, b, p))));
      tie(b.body, a.body, (b.teeth / a.teeth) * way(along(a.body, a, p).dot(along(b.body, b, p))));
    }
  }
  // A universal joint's two shafts, or, through a middle that isn't counted (a CV joint's, on a
  // ball joint), the shafts at either end.
  const shafts = new Map<number, number[]>();
  for (const c of mech.couplings) {
    // A reduction (a planetary wheel hub's): the hub turns `ratio` times slower than its
    // driving shaft, the same way round, both in the one bearing body.
    if (c.ratio !== undefined) {
      if (!counted(c.bodyA) || !counted(c.bodyB)) continue;
      const same = way(axisOf(c.bodyA).dot(axisOf(c.bodyB)));
      tie(c.bodyA, c.bodyB, same / c.ratio);
      tie(c.bodyB, c.bodyA, same * c.ratio);
      continue;
    }
    for (const [x, y] of [[c.bodyA, c.bodyB], [c.bodyB, c.bodyA]]) shafts.set(x, [...(shafts.get(x) ?? []), y]);
  }
  for (const [x, ys] of shafts) {
    const ends = counted(x) ? [[x, ...ys]] : ys.flatMap((a) => ys.map((b) => [a, b]));
    for (const [a, ...bs] of ends) for (const b of bs) if (a !== b && counted(a) && counted(b)) tie(a, b, way(axisOf(a).dot(axisOf(b))), true);
  }
  for (const s of mech.screws) if (counted(s.input) && counted(s.piston)) tie(s.input, s.piston, (s.lead / (2 * Math.PI)) * way(axisOf(s.input).dot(s.axis)) * way(axisOf(s.piston).dot(s.axis)));
  for (const loop of mech.loops) {
    const radius = (w: (typeof loop.wheels)[number]) => loop.path.points[w.point].radius;
    for (const a of loop.wheels) for (const b of loop.wheels) if (a !== b && counted(a.body) && counted(b.body)) tie(a.body, b.body, (radius(a) / radius(b)) * way(axisOf(a.body).dot(axisOf(b.body))));
  }

  // The differentials: a planet, turning in a counted carrier, meshing bevel gears on two
  // counted bodies on the carrier's axis.
  const differentials: { carrier: number; sides: [number, number]; teeth: [number, number] }[] = [];
  for (const mesh of mech.meshes) {
    if (mesh.kind !== 'bevel') continue;
    for (const [planet, side] of [[mesh.gearA, mesh.gearB], [mesh.gearB, mesh.gearA]]) {
      const p = mech.gears[planet];
      const link = parentLink(p.body);
      if (!link || !counted(link.parent) || !counted(p.body) || housing(p.body) !== link.parent) continue;
      const carrier = link.parent;
      const s = mech.gears[side];
      if (!counted(s.body) || s.body === carrier || !housed(s.body, carrier) || Math.abs(axisOf(s.body).dot(axisOf(carrier))) < 0.99) continue;
      for (const other of mech.meshes) {
        if (other === mesh || other.kind !== 'bevel' || (other.gearA !== planet && other.gearB !== planet)) continue;
        const t = mech.gears[other.gearA === planet ? other.gearB : other.gearA];
        if (!counted(t.body) || t.body === carrier || t.body === s.body || !housed(t.body, carrier) || Math.abs(axisOf(t.body).dot(axisOf(carrier))) < 0.99) continue;
        if (!differentials.some((d) => d.carrier === carrier && d.sides.includes(s.body) && d.sides.includes(t.body))) differentials.push({ carrier, sides: [s.body, t.body], teeth: [s.teeth, t.teeth] });
      }
    }
  }

  // Out from the control, a body at a time, and through a differential once two of its three
  // are known; one reached again at a different speed is left out.
  const torn = new Set<number>();
  const queue: number[] = [];
  const reach = (b: number, rate: number) => {
    const had = rates.get(b);
    if (had === undefined) {
      rates.set(b, rate);
      queue.push(b);
    } else if (Math.abs(had - rate) > 0.01 * Math.max(Math.abs(had), Math.abs(rate))) torn.add(b);
  };
  reach(control, 1);
  for (const b of together) if (b !== control && counted(b)) reach(b, way(axisOf(b).dot(axisOf(control))));
  const used = new Set<number>();
  for (;;) {
    while (queue.length) {
      const from = queue.shift()!;
      for (const { to, times } of ties.get(from) ?? []) reach(to, rates.get(from)! * times);
    }
    // A differential with two of its three known gives the third, each side's speed taken
    // about the carrier's axis.
    const k = differentials.findIndex((d, i) => !used.has(i) && [d.carrier, ...d.sides].filter((b) => rates.has(b)).length >= 2);
    if (k < 0) break;
    used.add(k);
    const d = differentials[k];
    const [s, t] = d.sides;
    const [ws, wt] = [way(axisOf(s).dot(axisOf(d.carrier))), way(axisOf(t).dot(axisOf(d.carrier)))];
    const [ts, tt] = d.teeth;
    if (!rates.has(d.carrier)) reach(d.carrier, (ts * ws * rates.get(s)! + tt * wt * rates.get(t)!) / (ts + tt));
    else if (!rates.has(s)) reach(s, ws * (((ts + tt) * rates.get(d.carrier)! - tt * wt * rates.get(t)!) / ts));
    else if (!rates.has(t)) reach(t, wt * (((ts + tt) * rates.get(d.carrier)! - ts * ws * rates.get(s)!) / tt));
  }
  for (const b of torn) rates.delete(b);
  return rates;
}

// What a body turns or slides in, its housing: down from it, past joints all on one line, the
// first body whose joint isn't on that line, or the frame (as Kinematics.housing has it); and
// those joints, each with its axis the way its angle grows as the body turns. How fast the body
// turns against its housing, about the first's axis, is the sum of their rates, each times its
// axis's way along the first's. A slide is only ever the first. Null for a body on a ball joint
// or no joint.
export function line(mech: Mechanism, parentLink: (body: number) => { parent: number; joint: number } | null, body: number): { joints: { joint: number; axis: Vector3 }[]; housing: number } | null {
  const joints: { joint: number; axis: Vector3 }[] = [];
  for (let b = body; b !== 0; ) {
    const link = parentLink(b);
    if (!link) return joints.length ? { joints, housing: b } : null;
    const j = mech.joints[link.joint];
    if (j.kind === 'ball') return joints.length ? { joints, housing: b } : null;
    const d = j.to.clone().sub(j.from).normalize();
    // The way the joint's angle grows as what's beyond it, towards the body, turns.
    const axis = j.bodyB === b ? d : d.negate();
    if (joints.length) {
      const first = mech.joints[joints[0].joint];
      const off = j.from.clone().sub(first.from);
      const onLine = j.kind === 'revolute' && first.kind === 'revolute' && Math.abs(axis.dot(joints[0].axis)) >= 0.999 && off.addScaledVector(joints[0].axis, -off.dot(joints[0].axis)).length() <= 0.5;
      if (!onLine) return { joints, housing: b };
    }
    joints.push({ joint: link.joint, axis });
    b = link.parent;
  }
  return joints.length ? { joints, housing: 0 } : null;
}
