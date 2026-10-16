// Moves a mechanism: works out which motions its joints and ground contacts allow, and
// carries them out. See "How it works" in the README, step 6.
//
// How the motion is described
// ---------------------------
// At any instant, each body's motion is a *twist*: an angular velocity ω (how fast it turns,
// about which axis) and a velocity v (how fast the point at the model's origin moves with it).
// Any point p on the body then moves at  v + ω × p.  That's 6 numbers per body, and all the
// bodies' numbers together form one long motion vector.
//
// Joints and ground contacts each say "these points must move together" or "this point must
// not move", which are linear equations on the motion vector. The motions that satisfy all of
// them (the equations' null space) are the motions the user can drive. The car has exactly
// one: rolling along its length.
//
// Positions are kept as one pose per *root* body (the frame) plus an angle per joint, and
// every other body's pose is rebuilt from those. That keeps joints exactly together however
// long the model is dragged.

import { Matrix4, Vector3 } from 'three';
import { Mechanism } from './mechanism.ts';

// How close a tyre must be to the ground to count as touching it, in LDU.
const GROUND_TOLERANCE = 0.5;
// Numbers smaller than this count as zero when solving the equations.
const EPSILON = 1e-9;
// Largest turn per step in turnJoint, in radians (about 2 degrees).
const MAX_TURN_STEP = 0.035;

const DOWN = new Vector3(0, 1, 0); // LDraw's y axis points down

// A row of the equations: coefficients for the motion vector, all equal to zero.
type Row = number[];

export class Kinematics {
  // Each body's pose: from its starting position (model coordinates) to where it is now.
  poses: Matrix4[] = [];
  // Each joint's angle in radians, measured from the start. Only joints in the tree are used.
  jointAngles: number[] = [];
  // The ground's height (LDraw y), or null if no tyre touches it.
  groundY: number | null = null;

  private mech: Mechanism;
  private bodyCount: number;
  // The tree that rebuilds poses: for each body, the joint that connects it to its parent
  // body, or -1 for a root body.
  private parentJoint: number[] = [];
  private order: number[] = []; // bodies, parents before children
  private rootPoses = new Map<number, Matrix4>();
  private fixedBody = -1; // held still when nothing touches the ground
  private contactTreads: number[] = []; // indices into mech.treads

  constructor(mech: Mechanism) {
    this.mech = mech;
    this.bodyCount = mech.bodies.length;
    this.findGround();
    this.buildTree();
    this.reset();
  }

  // Back to the starting position.
  reset() {
    this.jointAngles = this.mech.joints.map(() => 0);
    for (const root of this.rootPoses.keys()) this.rootPoses.set(root, new Matrix4());
    this.updatePoses();
  }

  // The ground is level with the lowest tyre. Tyres within GROUND_TOLERANCE of it touch it.
  // With no tyres, the frame (or the first body) is held still instead.
  private findGround() {
    let lowest = -Infinity;
    for (const t of this.mech.treads) {
      const p = lowestPoint(t.center, t.axis, t.radius);
      if (p) lowest = Math.max(lowest, p.y);
    }
    if (lowest === -Infinity) {
      this.fixedBody = 0;
      return;
    }
    this.groundY = lowest;
    this.mech.treads.forEach((t, i) => {
      const p = lowestPoint(t.center, t.axis, t.radius);
      if (p && Math.abs(p.y - lowest) < GROUND_TOLERANCE) this.contactTreads.push(i);
    });
  }

  // A spanning tree over the joints, starting from the frame (body 0). Joints that close a
  // loop aren't in the tree; they still constrain the motion, but nothing keeps them exactly
  // together yet (linkages, M6).
  private buildTree() {
    this.parentJoint = new Array(this.bodyCount).fill(-1);
    const visited = new Array(this.bodyCount).fill(false);
    for (let start = 0; start < this.bodyCount; start++) {
      if (visited[start]) continue;
      this.rootPoses.set(start, new Matrix4());
      visited[start] = true;
      const queue = [start];
      while (queue.length) {
        const body = queue.shift()!;
        this.order.push(body);
        this.mech.joints.forEach((j, index) => {
          const other = j.bodyA === body ? j.bodyB : j.bodyB === body ? j.bodyA : -1;
          if (other >= 0 && !visited[other]) {
            visited[other] = true;
            this.parentJoint[other] = index;
            queue.push(other);
          }
        });
      }
    }
  }

  // Rebuilds every body's pose from the root poses and joint angles.
  private updatePoses() {
    for (const body of this.order) {
      const j = this.parentJoint[body];
      if (j < 0) {
        this.poses[body] = this.rootPoses.get(body)!.clone();
        continue;
      }
      const joint = this.mech.joints[j];
      const parent = joint.bodyA === body ? joint.bodyB : joint.bodyA;
      // The child turns about the joint axis, as it was at the start, relative to its parent.
      const angle = joint.bodyA === parent ? this.jointAngles[j] : -this.jointAngles[j];
      this.poses[body] = this.poses[parent].clone().multiply(rotationAbout(joint.from, axisOf(joint.from, joint.to), angle));
    }
  }

  // The body this body turns on (its parent in the tree) and the joint between them, or null
  // for a root body such as the frame.
  parentLink(body: number): { parent: number; joint: number } | null {
    const j = this.parentJoint[body];
    if (j < 0) return null;
    const joint = this.mech.joints[j];
    return { parent: joint.bodyA === body ? joint.bodyB : joint.bodyA, joint: j };
  }

  // The point on a joint's axis nearest to `p`, where the joint is now.
  nearestOnAxis(joint: number, p: Vector3): Vector3 {
    const j = this.mech.joints[joint];
    const pose = this.poses[j.bodyA];
    const from = j.from.clone().applyMatrix4(pose);
    const d = axisOf(j.from, j.to).transformDirection(pose);
    return from.addScaledVector(d, new Vector3().subVectors(p, from).dot(d));
  }

  // A joint's axis where it is now: a point on it and its direction (bodyB turns about it
  // relative to bodyA by the right-hand rule).
  jointAxisNow(joint: number): { point: Vector3; dir: Vector3 } {
    const j = this.mech.joints[joint];
    const pose = this.poses[j.bodyA];
    return { point: j.from.clone().applyMatrix4(pose), dir: axisOf(j.from, j.to).transformDirection(pose) };
  }

  // Whether the frame is held still (nothing touches the ground).
  frameHeld(): boolean {
    return this.fixedBody >= 0;
  }

  // ---------------------------------------------------------------------------
  // The equations

  private equations(): Row[] {
    const rows: Row[] = [];
    const n = 6 * this.bodyCount;

    if (this.fixedBody >= 0) {
      for (let k = 0; k < 6; k++) {
        const row = new Array(n).fill(0);
        row[6 * this.fixedBody + k] = 1;
        rows.push(row);
      }
    }

    // A turning joint: both bodies move the same at a point on the axis, and turn at the same
    // rate about any direction across the axis.
    for (const joint of this.mech.joints) {
      const pose = this.poses[joint.bodyA];
      const c = joint.from.clone().applyMatrix4(pose);
      const d = axisOf(joint.from, joint.to).transformDirection(pose);
      for (let k = 0; k < 3; k++) {
        const row = new Array(n).fill(0);
        addPointVelocity(row, joint.bodyA, c, k, 1);
        addPointVelocity(row, joint.bodyB, c, k, -1);
        rows.push(row);
      }
      for (const across of acrossDirections(d)) {
        const row = new Array(n).fill(0);
        for (let k = 0; k < 3; k++) {
          row[6 * joint.bodyA + k] += across.getComponent(k);
          row[6 * joint.bodyB + k] -= across.getComponent(k);
        }
        rows.push(row);
      }
    }

    // Meshing gears: where their pitch circles touch, both gears' teeth move at the same speed
    // across the line between their centres. (Moving along that line would pull the teeth apart,
    // which the joints already prevent.)
    for (const mesh of this.mech.meshes) {
      const a = this.mech.gears[mesh.gearA];
      const b = this.mech.gears[mesh.gearB];
      const ca = a.center.clone().applyMatrix4(this.poses[a.body]);
      const cb = b.center.clone().applyMatrix4(this.poses[b.body]);
      const axis = a.axis.clone().transformDirection(this.poses[a.body]);
      const pitchPoint = ca.clone().lerp(cb, a.radius / (a.radius + b.radius));
      const across = new Vector3().crossVectors(axis, new Vector3().subVectors(cb, ca)).normalize();
      const row = new Array(n).fill(0);
      for (let k = 0; k < 3; k++) {
        const ra = new Array(n).fill(0);
        const rb = new Array(n).fill(0);
        addPointVelocity(ra, a.body, pitchPoint, k, 1);
        addPointVelocity(rb, b.body, pitchPoint, k, -1);
        for (let i = 0; i < n; i++) row[i] += across.getComponent(k) * (ra[i] + rb[i]);
      }
      rows.push(row);
    }

    // A tyre on the ground rolls without slipping: the point touching the ground doesn't move.
    for (const i of this.contactTreads) {
      const p = this.contactPoint(i);
      if (!p) continue;
      const body = this.mech.treads[i].body;
      for (let k = 0; k < 3; k++) {
        const row = new Array(n).fill(0);
        addPointVelocity(row, body, p, k, 1);
        rows.push(row);
      }
    }
    return rows;
  }

  // Where a tyre touches the ground now.
  private contactPoint(treadIndex: number): Vector3 | null {
    const t = this.mech.treads[treadIndex];
    const pose = this.poses[t.body];
    return lowestPoint(t.center.clone().applyMatrix4(pose), t.axis.clone().transformDirection(pose), t.radius);
  }

  // ---------------------------------------------------------------------------
  // Motions

  // The motions the mechanism allows right now, as motion vectors (6 numbers per body).
  // An empty list means it's jammed.
  freeMotions(): number[][] {
    return nullSpace(this.equations(), 6 * this.bodyCount);
  }

  // How fast a point on a body moves under a motion vector.
  pointVelocity(motion: number[], body: number, point: Vector3): Vector3 {
    const w = new Vector3(motion[6 * body], motion[6 * body + 1], motion[6 * body + 2]);
    const v = new Vector3(motion[6 * body + 3], motion[6 * body + 4], motion[6 * body + 5]);
    return v.add(w.cross(point));
  }

  // How fast a joint turns under a motion vector: how much faster bodyB turns than bodyA
  // about the joint's axis.
  jointRate(motion: number[], joint: number): number {
    const j = this.mech.joints[joint];
    const d = axisOf(j.from, j.to).transformDirection(this.poses[j.bodyA]);
    const wA = new Vector3(motion[6 * j.bodyA], motion[6 * j.bodyA + 1], motion[6 * j.bodyA + 2]);
    const wB = new Vector3(motion[6 * j.bodyB], motion[6 * j.bodyB + 1], motion[6 * j.bodyB + 2]);
    return wB.sub(wA).dot(d);
  }

  // Turns a joint by `angle` radians (bodyB relative to bodyA), letting the rest of the
  // mechanism follow, in steps of at most MAX_TURN_STEP. Returns how far it actually turned,
  // which is less if the joint can't turn (jammed).
  turnJoint(joint: number, angle: number): number {
    let turned = 0;
    const steps = Math.ceil(Math.abs(angle) / MAX_TURN_STEP);
    for (let i = 0; i < steps; i++) {
      const motion = this.jointMotion(joint);
      if (!motion) break;
      this.advance(motion, angle / steps);
      turned += angle / steps;
    }
    return turned;
  }

  // The motion vector that turns a joint at rate 1 (one radian per unit), with the rest of
  // the mechanism following: the smallest mix of the free motions that does it. Null if the
  // joint can't turn.
  jointMotion(joint: number): number[] | null {
    const motions = this.freeMotions();
    // Each motion's share is proportional to how fast it turns the joint.
    const rates = motions.map((m) => this.jointRate(m, joint));
    const total = rates.reduce((sum, r) => sum + r * r, 0);
    if (total < EPSILON) return null;
    const combined = new Array(6 * this.bodyCount).fill(0);
    motions.forEach((m, k) => m.forEach((x, idx) => (combined[idx] += (x * rates[k]) / total)));
    return combined;
  }

  // Moves the mechanism along a motion vector, scaled by `amount`. Keep steps small (a few
  // LDU, a few degrees): the motion is only exact at the start of the step.
  advance(motion: number[], amount: number) {
    this.mech.joints.forEach((_, j) => {
      this.jointAngles[j] += this.jointRate(motion, j) * amount;
    });
    for (const [root, pose] of this.rootPoses) {
      const w = new Vector3(motion[6 * root], motion[6 * root + 1], motion[6 * root + 2]).multiplyScalar(amount);
      const v = new Vector3(motion[6 * root + 3], motion[6 * root + 4], motion[6 * root + 5]).multiplyScalar(amount);
      pose.premultiply(screwMotion(w, v));
    }
    this.updatePoses();
  }
}

// ---------------------------------------------------------------------------
// Helpers

function axisOf(from: Vector3, to: Vector3): Vector3 {
  return new Vector3().subVectors(to, from).normalize();
}

// The lowest point of a circle (a tyre's tread at its middle), or null if the circle lies flat.
function lowestPoint(center: Vector3, axis: Vector3, radius: number): Vector3 | null {
  const down = DOWN.clone().addScaledVector(axis, -DOWN.dot(axis));
  if (down.length() < 0.01) return null;
  return center.clone().addScaledVector(down.normalize(), radius);
}

// Two directions at right angles to `d` and to each other.
function acrossDirections(d: Vector3): Vector3[] {
  const helper = Math.abs(d.x) < 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
  const a = new Vector3().crossVectors(d, helper).normalize();
  const b = new Vector3().crossVectors(d, a).normalize();
  return [a, b];
}

// Adds (sign ×) component k of a body's point velocity, v + ω × p, to an equation row.
function addPointVelocity(row: Row, body: number, p: Vector3, k: number, sign: number) {
  const w = 6 * body;
  const v = w + 3;
  if (k === 0) {
    row[w + 1] += sign * p.z;
    row[w + 2] -= sign * p.y;
  } else if (k === 1) {
    row[w + 2] += sign * p.x;
    row[w + 0] -= sign * p.z;
  } else {
    row[w + 0] += sign * p.y;
    row[w + 1] -= sign * p.x;
  }
  row[v + k] += sign;
}

// Rotation by `angle` about the line through `point` along unit vector `axis`.
function rotationAbout(point: Vector3, axis: Vector3, angle: number): Matrix4 {
  const toOrigin = new Matrix4().makeTranslation(-point.x, -point.y, -point.z);
  const rotate = new Matrix4().makeRotationAxis(axis, angle);
  const back = new Matrix4().makeTranslation(point.x, point.y, point.z);
  return back.multiply(rotate).multiply(toOrigin);
}

// The rigid motion produced by keeping a twist (turn w, velocity v of the origin) for one
// unit of time: a turn about the twist's axis plus a slide along it.
function screwMotion(w: Vector3, v: Vector3): Matrix4 {
  const angle = w.length();
  if (angle < EPSILON) return new Matrix4().makeTranslation(v.x, v.y, v.z);
  const axis = w.clone().divideScalar(angle);
  const pointOnAxis = new Vector3().crossVectors(w, v).divideScalar(angle * angle);
  const slide = axis.clone().multiplyScalar(v.dot(axis));
  return new Matrix4().makeTranslation(slide.x, slide.y, slide.z).multiply(rotationAbout(pointOnAxis, axis, angle));
}

// The solutions x of  rows · x = 0,  as a list of independent vectors (Gauss-Jordan elimination).
export function nullSpace(rows: Row[], n: number): number[][] {
  const a = rows.map((r) => r.slice());
  const pivotColumns: number[] = [];
  let r = 0;
  for (let c = 0; c < n && r < a.length; c++) {
    // Use the row with the largest entry in this column, for accuracy.
    let best = r;
    for (let i = r + 1; i < a.length; i++) if (Math.abs(a[i][c]) > Math.abs(a[best][c])) best = i;
    if (Math.abs(a[best][c]) < EPSILON) continue;
    [a[r], a[best]] = [a[best], a[r]];
    const pivot = a[r][c];
    for (let k = 0; k < n; k++) a[r][k] /= pivot;
    for (let i = 0; i < a.length; i++) {
      if (i === r || a[i][c] === 0) continue;
      const factor = a[i][c];
      for (let k = 0; k < n; k++) a[i][k] -= factor * a[r][k];
    }
    pivotColumns.push(c);
    r++;
  }
  const basis: number[][] = [];
  for (let free = 0; free < n; free++) {
    if (pivotColumns.includes(free)) continue;
    const x = new Array(n).fill(0);
    x[free] = 1;
    pivotColumns.forEach((pc, row) => {
      x[pc] = -a[row][free];
    });
    basis.push(x);
  }
  return basis;
}
