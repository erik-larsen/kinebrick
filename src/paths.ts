// Where a chain's or track's links go as it moves round its wheels (see Loop in mechanism.ts).
//
// A loop's path goes round the circle of each wheel it wraps, in turn, and along the straight
// runs between them, each run leaving one circle and meeting the next at a tangent. A link
// moved along the path by a distance keeps its place relative to the path: it's carried from
// where the path was at its start to where the path is that far on, turned with it.

import { Matrix4, Vector2, Vector3 } from 'three';
import { PathPoint } from './ldr.ts';

// One piece of the path: an arc round a circle, or a straight run.
interface Piece {
  length: number;
  // For an arc: its circle's middle, radius, which way it goes round (1 or -1, about the
  // path's axis) and the angle it starts at. For a straight run: where it starts and its
  // direction.
  center?: Vector2;
  radius?: number;
  turn?: number;
  start?: number;
  from?: Vector2;
  dir?: Vector2;
}

export class LoopPath {
  readonly length: number;
  private pieces: Piece[];
  private origin: Vector3; // the plane the path lies in: a point on it, and two directions in it
  private u: Vector3;
  private v: Vector3;
  private axis: Vector3;

  // The path round circles (all with parallel axes, in one plane), or throws if they aren't.
  constructor(points: PathPoint[]) {
    this.axis = points[0].axis.clone().normalize();
    this.origin = points[0].center.clone();
    this.u = new Vector3(1, 0, 0).cross(this.axis);
    if (this.u.length() < 0.1) this.u = new Vector3(0, 1, 0).cross(this.axis);
    this.u.normalize();
    this.v = new Vector3().crossVectors(this.axis, this.u);
    const circles = points.map((p) => {
      const d = p.center.clone().sub(this.origin);
      if (Math.abs(d.dot(this.axis)) > 1 || Math.abs(Math.abs(p.axis.dot(this.axis)) - 1) > 1e-3) throw new Error('A loop whose circles are not in one plane');
      // Which way the path goes round, about the path's axis rather than the circle's own.
      return { c: new Vector2(d.dot(this.u), d.dot(this.v)), r: p.radius, turn: p.turn * Math.sign(p.axis.dot(this.axis)) };
    });
    // The straight run from each circle to the next: its direction t, leaving circle 1 at
    // c1 + turn1 r1 m and meeting circle 2 at c2 + turn2 r2 m, where m is t turned a right angle
    // clockwise (a point going round anticlockwise has its direction a right angle anticlockwise
    // of where it is from the middle).
    const runs = circles.map((a, i) => {
      const b = circles[(i + 1) % circles.length];
      const d = b.c.clone().sub(a.c);
      const k = a.turn * a.r - b.turn * b.r;
      const theta = Math.atan2(d.y, d.x);
      const spread = Math.acos(Math.max(-1, Math.min(1, k / d.length())));
      for (const phi of [theta + spread, theta - spread]) {
        const m = new Vector2(Math.cos(phi), Math.sin(phi));
        const t = new Vector2(-m.y, m.x);
        if (d.dot(t) > 0) return { from: a.c.clone().addScaledVector(m, a.turn * a.r), to: b.c.clone().addScaledVector(m, b.turn * b.r), t };
      }
      throw new Error('No straight run between two circles of a loop');
    });
    this.pieces = [];
    circles.forEach((circle, i) => {
      const arrive = runs[(i + circles.length - 1) % circles.length].to;
      const leave = runs[i].from;
      const start = Math.atan2(arrive.y - circle.c.y, arrive.x - circle.c.x);
      const end = Math.atan2(leave.y - circle.c.y, leave.x - circle.c.x);
      let sweep = circle.turn * (end - start);
      while (sweep < 0) sweep += 2 * Math.PI;
      while (sweep >= 2 * Math.PI) sweep -= 2 * Math.PI;
      this.pieces.push({ length: sweep * circle.r, center: circle.c, radius: circle.r, turn: circle.turn, start });
      const run = runs[i];
      this.pieces.push({ length: run.to.distanceTo(run.from), from: run.from, dir: run.t });
    });
    this.length = this.pieces.reduce((sum, p) => sum + p.length, 0);
  }

  // Where the path is `s` LDU along (round and round), as a placement: its origin on the path,
  // its x along the path, its z along the path's axis.
  frameAt(s: number): Matrix4 {
    let rest = ((s % this.length) + this.length) % this.length;
    let piece = this.pieces[0];
    for (piece of this.pieces) {
      if (rest <= piece.length) break;
      rest -= piece.length;
    }
    let at: Vector2;
    let dir: Vector2;
    if (piece.center) {
      const angle = piece.start! + (piece.turn! * rest) / piece.radius!;
      const out = new Vector2(Math.cos(angle), Math.sin(angle));
      at = piece.center.clone().addScaledVector(out, piece.radius!);
      dir = new Vector2(-out.y, out.x).multiplyScalar(piece.turn!);
    } else {
      at = piece.from!.clone().addScaledVector(piece.dir!, rest);
      dir = piece.dir!.clone();
    }
    const x = this.u.clone().multiplyScalar(dir.x).addScaledVector(this.v, dir.y);
    const y = new Vector3().crossVectors(this.axis, x);
    const p = this.origin.clone().addScaledVector(this.u, at.x).addScaledVector(this.v, at.y);
    return new Matrix4().makeBasis(x, y, this.axis).setPosition(p);
  }

  // The straight run `s` LDU along the path is on, or null if it's going round a circle: how far
  // the run reaches back from there and on from there, and the circles (indices into the path's
  // points) it runs from and to.
  runAt(s: number): { back: number; on: number; from: number; to: number } | null {
    let rest = ((s % this.length) + this.length) % this.length;
    for (let i = 0; i < this.pieces.length; i++) {
      const piece = this.pieces[i];
      if (rest <= piece.length) {
        if (piece.center) return null;
        const circles = this.pieces.length / 2;
        return { back: rest, on: piece.length - rest, from: (i - 1) / 2, to: ((i + 1) / 2) % circles };
      }
      rest -= piece.length;
    }
    return null;
  }

  // How far along the path the point nearest `p` is (to within a quarter of an LDU).
  nearest(p: Vector3): number {
    let best = 0;
    let bestDistance = Infinity;
    for (let s = 0; s < this.length; s += 0.25) {
      const distance = new Vector3().setFromMatrixPosition(this.frameAt(s)).distanceToSquared(p);
      if (distance < bestDistance) [best, bestDistance] = [s, distance];
    }
    return best;
  }
}

// A loop's links, and where each goes as the loop moves round: placeLinks(travel) gives each
// link's placement (link -> model coordinates, as the model was loaded) once the loop has moved
// `travel` LDU along its path.
export function loopLinks(points: PathPoint[], links: Matrix4[]): ((travel: number) => Matrix4[]) | null {
  let path: LoopPath;
  try {
    path = new LoopPath(points);
  } catch {
    return null;
  }
  const along = links.map((m) => path.nearest(new Vector3().setFromMatrixPosition(m)));
  // Each link relative to the path where it starts.
  const relative = links.map((m, i) => path.frameAt(along[i]).invert().multiply(m));
  return (travel) => relative.map((rel, i) => path.frameAt(along[i] + travel).multiply(rel));
}

// A circle a string goes round (or, with radius 0, a point it's tied to), where it is now.
export interface StringCircle {
  center: Vector3;
  radius: number;
  turn: number; // which way the string goes round, about `axis` (see PathPoint)
}

// A string's shape (see Mechanism.strings): from where it leaves the first circle (the drum it
// winds on), round each circle after in turn, and straight between them, to the last (where
// it's tied, radius 0). All in one plane, the one `axis` (the circles' shared axis) is square
// to. Its free length, from the drum, and the length up to where it meets each circle.
export function stringLayout(circles: StringCircle[], axis: Vector3): { points: Vector3[]; length: number; upTo: number[] } {
  const z = axis.clone().normalize();
  const origin = circles[0].center;
  let u = new Vector3(1, 0, 0).cross(z);
  if (u.length() < 0.1) u = new Vector3(0, 1, 0).cross(z);
  u.normalize();
  const v = new Vector3().crossVectors(z, u);
  const flat = circles.map((c) => {
    const d = c.center.clone().sub(origin);
    return { c: new Vector2(d.dot(u), d.dot(v)), r: c.radius, turn: c.turn };
  });
  const lift = (p: Vector2) => origin.clone().addScaledVector(u, p.x).addScaledVector(v, p.y);
  // The straight run from each circle to the next (as for a loop, see LoopPath).
  const runs = flat.slice(0, -1).map((a, i) => {
    const b = flat[i + 1];
    const d = b.c.clone().sub(a.c);
    const k = a.turn * a.r - b.turn * b.r;
    const theta = Math.atan2(d.y, d.x);
    const spread = Math.acos(Math.max(-1, Math.min(1, k / Math.max(d.length(), 1e-9))));
    for (const phi of [theta + spread, theta - spread]) {
      const m = new Vector2(Math.cos(phi), Math.sin(phi));
      const t = new Vector2(-m.y, m.x);
      if (d.dot(t) > 0) return { from: a.c.clone().addScaledVector(m, a.turn * a.r), to: b.c.clone().addScaledVector(m, b.turn * b.r) };
    }
    return { from: a.c.clone(), to: b.c.clone() };
  });
  const points: Vector3[] = [lift(runs[0].from)];
  const upTo = [0];
  let length = 0;
  runs.forEach((run, i) => {
    length += run.to.distanceTo(run.from);
    points.push(lift(run.to));
    upTo.push(length);
    const next = runs[i + 1];
    if (!next) return;
    // Round circle i + 1, from where this run meets it to where the next run leaves it.
    const circle = flat[i + 1];
    const start = Math.atan2(run.to.y - circle.c.y, run.to.x - circle.c.x);
    const end = Math.atan2(next.from.y - circle.c.y, next.from.x - circle.c.x);
    let sweep = circle.turn * (end - start);
    while (sweep < 0) sweep += 2 * Math.PI;
    while (sweep >= 2 * Math.PI) sweep -= 2 * Math.PI;
    length += sweep * circle.r;
    const steps = Math.max(1, Math.ceil(sweep / 0.2));
    for (let s = 1; s <= steps; s++) {
      const angle = start + (circle.turn * sweep * s) / steps;
      points.push(lift(circle.c.clone().add(new Vector2(Math.cos(angle), Math.sin(angle)).multiplyScalar(circle.r))));
    }
  });
  return { points, length, upTo };
}
