// Joints built a hair out of line, put on one line: axles on axles, balls on the axes they turn
// about.

import { Vector3 } from 'three';
import type { Joint } from '../mechanism.ts';
import { BALL_LINE } from './shared.ts';

// Turning joints whose axes are parallel and all but on one line (within AXLE_LINE) are put on
// one line, the first one's: a model built by hand may set two half axles a hair apart (an
// official tractor's are 0.02 LDU apart), and an assembly hung on both (its hitch) would
// otherwise be held fast, as if on two axles side by side.
export function lineUpAxles(joints: Joint[]) {
  const AXLE_LINE = 0.1; // LDU
  const lines: { from: Vector3; dir: Vector3 }[] = [];
  for (const joint of joints) {
    if (joint.kind !== 'revolute') continue;
    const dir = new Vector3().subVectors(joint.to, joint.from).normalize();
    const line = lines.find((l) => {
      if (new Vector3().crossVectors(l.dir, dir).length() > 1e-3) return false;
      const off = new Vector3().subVectors(joint.from, l.from);
      return off.addScaledVector(l.dir, -off.dot(l.dir)).length() < AXLE_LINE;
    });
    if (!line) {
      lines.push({ from: joint.from.clone(), dir });
      continue;
    }
    for (const end of [joint.from, joint.to]) {
      const along = new Vector3().subVectors(end, line.from).dot(line.dir);
      end.copy(line.from).addScaledVector(line.dir, along);
    }
  }
}

// A ball joint whose middle sits all but on an axis one of its bodies turns about (within
// BALL_LINE of it, and no further along it than a stud past the turning joint's ends) is put on
// that axis: a model built by hand may set a ball a little off the axis of the part
// it's socketed in (an official Unimog's driveshaft ends in a ball 0.23 LDU off its constant
// velocity joint's axis, the 42110 Land Rover's half shafts, drawn drooped a little too far, 2 LDU
// off its steering hubs'), and as that part turned, the ball would go round its axis, which the
// shaft, held at its other end, couldn't follow: the drivetrain locked after a step. (No ball in
// the OMR sits between 2 and 15 LDU off such an axis: a crank's is a stud or more out.)
//
// Where two such axes cross at the ball, one each side of a constant velocity joint, it's put
// where they cross, so it's on both: on one, a hair off the other, it went round as that one
// turned (an official Porsche 911 GT3 RS's steering column, a ball 0.03 LDU off the axis of the
// shaft it ends, which slides and turns in a toggle joint, stopped the steering a few degrees on).
// Such a shaft's axis counts, if it crosses another's: a joint it slides on as it turns.
export function lineUpBalls(joints: Joint[]) {
  const REACH = 20; // LDU
  const CROSS = 0.5; // LDU: how near two axes must pass each other to count as crossing
  for (const ball of joints) {
    if (ball.kind !== 'ball') continue;
    // The axes the ball's bodies turn about, near it: where on each it's nearest the ball, and
    // whether that's within REACH of the joint (a crossing needs no reach: a shaft's axis runs on
    // past the joint it turns in, to the ball at its end).
    const axes: { from: Vector3; dir: Vector3; at: Vector3; off: number; slides: boolean; reaches: boolean }[] = [];
    for (const j of joints) {
      if ((j.kind !== 'revolute' && !(j.kind === 'slide' && j.turns)) || ![j.bodyA, j.bodyB].some((b) => b === ball.bodyA || b === ball.bodyB)) continue;
      const length = j.from.distanceTo(j.to);
      const dir = new Vector3().subVectors(j.to, j.from).normalize();
      const rel = new Vector3().subVectors(ball.from, j.from);
      const along = rel.dot(dir);
      const off = rel.addScaledVector(dir, -along).length();
      if (off >= BALL_LINE) continue;
      axes.push({ from: j.from, dir, at: j.from.clone().addScaledVector(dir, along), off, slides: j.kind === 'slide', reaches: along >= -REACH && along <= length + REACH });
    }
    // Two that cross near the ball: where they pass nearest each other.
    let crossing: { at: Vector3; off: number } | null = null;
    for (let a = 0; a < axes.length; a++) {
      for (let b = a + 1; b < axes.length; b++) {
        const [p, q] = [axes[a], axes[b]];
        const normal = new Vector3().crossVectors(p.dir, q.dir);
        if (normal.length() < 0.05) continue; // all but parallel
        const w = new Vector3().subVectors(p.from, q.from);
        const [dd, pq, qq] = [p.dir.dot(q.dir), p.dir.dot(w), q.dir.dot(w)];
        const den = 1 - dd * dd;
        const onP = p.from.clone().addScaledVector(p.dir, (dd * qq - pq) / den);
        const onQ = q.from.clone().addScaledVector(q.dir, (qq - dd * pq) / den);
        if (onP.distanceTo(onQ) >= CROSS) continue;
        const at = onP.add(onQ).multiplyScalar(0.5);
        const off = at.distanceTo(ball.from);
        if (off < BALL_LINE && (!crossing || off < crossing.off)) crossing = { at, off };
      }
    }
    // Failing that, the nearest axis it turns about (not one it slides on: a towball on a
    // sliding part may well sit off it).
    const nearest = axes.filter((x) => x.reaches && !x.slides && x.off > 1e-9).sort((x, y) => x.off - y.off)[0];
    const at = crossing?.at ?? nearest?.at;
    if (at) {
      ball.from.copy(at);
      ball.to.copy(at);
    }
  }
}
