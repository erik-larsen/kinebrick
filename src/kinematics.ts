// Moves a mechanism: works out which motions its joints and ground contacts allow, and
// carries them out. See "How it works" in the README, step 7.
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
// Positions are kept as one pose per *root* body (the frame) plus an angle per turning joint,
// and every other body's pose is rebuilt from those, following a tree of turning joints out
// from the root. That keeps those joints exactly together however long the model is dragged.
// The joints the tree doesn't follow (one per closed loop of parts, and every slide and ball
// joint) are pulled back together after each step (see closeLoops). A body reached only
// through those, such as a piston, is a root of its own.

import { Matrix4, Quaternion, Vector3 } from 'three';
import { axesCrossing, closestPoints, Gear, Joint, Mechanism, Mesh, StringLine } from './mechanism.ts';
import { StringCircle, stringLayout } from './paths.ts';

// How close a tyre must be to the ground to count as touching it, in LDU. Models are often
// built half an LDU out (an official tractor's front tyres sit half an LDU above its rear ones).
const GROUND_TOLERANCE = 1;
// Numbers smaller than this count as zero when solving the equations.
const EPSILON = 1e-9;
// How far a tyre may scrub sideways, as a fraction of how far it rolls, unless a model says
// otherwise (see Kinematics.scrub and freeMotions): real steering only approximates every
// wheel turning round one centre, and real tyres scrub.
export const DEFAULT_SCRUB = 0.02;
// How far a tyre may rise or sink, as a fraction of how far it moves across the ground. A
// wheel steered on a pivot that leans a little (as real cars' do, and as models are often
// built) rises or sinks a little as it turns; an axle rocking with the car standing still
// would push one tyre into the ground, and isn't allowed.
const LIFT = 0.05;
// Largest turn per step in turnJoint, in radians (about 2 degrees).
const MAX_TURN_STEP = 0.035;
// How far apart a loop's joints may drift before closeLoops pulls them back, in LDU (or radians).
const LOOP_TOLERANCE = 1e-11;
// When solving for the free motions, an equation counts as already implied by the others if
// what's left of it after elimination is smaller than this. It must be well above how far
// apart closeLoops leaves a loop's joints: a planar linkage moves only because some of its
// joints' equations repeat each other, and a tiny misalignment would make them look
// independent, jamming it.
const RANK_TOLERANCE = 1e-6;

const DOWN = new Vector3(0, 1, 0); // LDraw's y axis points down

// A row of the equations: coefficients for the motion vector, all equal to zero.
type Row = number[];

// Everything that says where the mechanism is (see Kinematics.snapshot).
export interface KinematicsState {
  roots: Map<number, Matrix4>;
  jointAngles: number[];
  treadTravel: number[];
  treadScrub: number[];
}

// For each tyre on the ground, a row for how fast it scrubs sideways, and one for how fast it
// travels (see Kinematics.freeMotions).
// One shaft of a universal joint (see findCouplings).
interface Shaft {
  body: number;
  joint: number; // the joint it turns on, or -1 for a shaft that floats between two joints
  mount: number; // the body it turns in (the frame, for a floating shaft)
  axis: Vector3; // its axis at the start (model coordinates)
  away: number; // +1 if its axis points away from the joint's middle, else -1
  near: Vector3; // the point on its axis nearest the joint's middle, at the start
}

interface Slip {
  sideways: Row[]; // how fast each tyre scrubs sideways
  travel: Row[]; // how fast each tyre's hub travels along the way it rolls
  lift: Row[]; // how fast each tyre's contact point rises or sinks
}

export class Kinematics {
  // Each body's pose: from its starting position (model coordinates) to where it is now.
  poses: Matrix4[] = [];
  // Each joint's angle in radians, measured from the start. Only joints in the tree are used.
  jointAngles: number[] = [];
  // How far each tyre's hub has rolled since the start, in LDU, forwards positive (forwards is
  // the way the tyre rolls when it turns positive about its axis). Rolling without slipping,
  // the tyre turns by this ÷ its radius.
  treadTravel: number[] = [];
  // How far each tyre has scrubbed sideways since the start, in LDU (see freeMotions).
  treadScrub: number[] = [];
  // The ground's height (LDraw y), or null if no tyre touches it.
  groundY: number | null = null;
  // How far a tyre may scrub sideways, as a fraction of how far it rolls (see freeMotions).
  // More lets a car whose steering is further from every wheel turning round one centre (both
  // front wheels turned alike, say) roll at a bigger steering angle; but too much would let a
  // car with no steering at all turn, its tyres scrubbing round.
  scrub = DEFAULT_SCRUB;

  private mech: Mechanism;
  private bodyCount: number;
  // The tree that rebuilds poses: for each body, the joint that connects it to its parent
  // body, or -1 for a root body.
  private parentJoint: number[] = [];
  private order: number[] = []; // bodies, parents before children
  private rootPoses = new Map<number, Matrix4>();
  // The tree's coordinates, in which the solver works (see treeBasis): six for each root body
  // (how it turns and moves), then one for each joint in the tree (how fast it turns).
  private rootColumn = new Map<number, number>(); // a root body's first coordinate
  private jointColumn: number[] = []; // a joint's coordinate, or -1 if it's not in the tree
  private columns = 0; // how many coordinates
  private fixedBody = -1; // kept still when the model has no tyres on the ground
  private frozen = new Set<number>(); // bodies the user has frozen (Alt-click)
  private dragHeld = new Set<number>(); // bodies held still for the length of one drag
  // Bodies held for a drag against the frame rather than against what they turn on (which the
  // drag turns): an assembly hanging on a driven axle stays level, not carried round.
  private heldToFrame = new Set<number>();
  private contactTreads: number[] = []; // indices into mech.treads
  private contactHeights: number[] = []; // for each tyre, where it touched the ground at the start (LDraw y)
  // Bodies held only by a ball joint at each end (a steering link), and those two joints.
  private links: { body: number; balls: [number, number] }[] = [];
  // Universal joints: for each shaft, the joint it turns on (whose axis runs through the joint's
  // middle), which way along that axis points away from the middle (+1 or -1), and the point
  // on that axis nearest the middle (model coordinates, at the start).
  private couplings: { shafts: Shaft[] }[] = [];
  // For each string (see Mechanism.strings): its free length at the start, and where its hook
  // hung then, relative to the middle of the two pulleys it hangs from (model coordinates).
  private strings: { length: number; hookOffset: Vector3 | null }[] = [];

  constructor(mech: Mechanism) {
    this.mech = mech;
    this.bodyCount = mech.bodies.length;
    this.findLinks();
    this.findCouplings();
    this.findGround();
    this.buildTree();
    this.reset();
    this.strings = (mech.strings ?? []).map((s) => ({
      length: this.stringNow(s).layout.length,
      hookOffset: s.hook ? this.hookOffset(s) : null,
    }));
  }

  // ---------------------------------------------------------------------------
  // Strings

  // A string where it is now: the circles it goes round (its drum, or where it's tied at its
  // start; its pulleys; where it's tied at its end), each with the body carrying its middle,
  // and its layout (see stringLayout). `moved` gives the bodies' poses to use instead (to see
  // how the layout changes as a body moves).
  private stringNow(s: StringLine, poseOf = (body: number) => this.poses[body]): { circles: StringCircle[]; bodies: number[]; axis: Vector3; layout: ReturnType<typeof stringLayout> } {
    const circles: StringCircle[] = [];
    const bodies: number[] = [];
    const point = (index: number) => s.path.points[index];
    if (s.drum) {
      const p = point(s.drum.point);
      circles.push({ center: p.center.clone().applyMatrix4(poseOf(s.drum.mount)), radius: p.radius, turn: p.turn });
      bodies.push(s.drum.mount);
    } else {
      circles.push({ center: s.start!.at.clone().applyMatrix4(poseOf(s.start!.body)), radius: 0, turn: 1 });
      bodies.push(s.start!.body);
    }
    for (const w of s.pulleys) {
      const p = point(w.point);
      circles.push({ center: p.center.clone().applyMatrix4(poseOf(w.mount)), radius: p.radius, turn: p.turn });
      bodies.push(w.mount);
    }
    circles.push({ center: s.end.at.clone().applyMatrix4(poseOf(s.end.body)), radius: 0, turn: 1 });
    bodies.push(s.end.body);
    const first = s.drum ?? s.pulleys[0];
    const axis = point(first.point).axis.clone().transformDirection(poseOf(first.mount));
    return { circles, bodies, axis, layout: stringLayout(circles, axis) };
  }

  // How much string its drum has paid out since the start, in LDU (0 if it isn't wound on one):
  // as far as the drum's rim has turned, the way the string goes round it.
  private payout(s: StringLine): number {
    if (!s.drum) return 0;
    const p = s.path.points[s.drum.point];
    const j = this.mech.joints[s.drum.joint];
    const angle = (j.bodyB === s.drum.body ? 1 : -1) * Math.sign(axisOf(j.from, j.to).dot(p.axis)) * this.jointAngles[s.drum.joint];
    return p.turn * p.radius * angle;
  }

  // Where a string's hook hangs, relative to the middle of the circles either side of its pulley
  // (the pulleys it hangs from).
  private hookOffset(s: StringLine): Vector3 {
    const { circles } = this.stringNow(s);
    const h = s.hook!.pulley + 1; // circles start with the drum (or where it's tied)
    return circles[h].center.clone().sub(circles[h - 1].center.clone().add(circles[h + 1].center).multiplyScalar(0.5));
  }

  // Rows saying how fast a length worked out from a string's layout (by `measure`) changes as
  // the bodies carrying its circles move: for each circle, the change of the length with its
  // middle (by finite differences), times how fast that middle moves.
  private stringRate(s: StringLine, measure: (layout: ReturnType<typeof stringLayout>) => number, n: number): Row {
    const { circles, axis, bodies } = this.stringNow(s);
    const row = new Array(n).fill(0);
    const base = measure(stringLayout(circles, axis));
    const h = 1e-3;
    circles.forEach((circle, i) => {
      const g = new Vector3();
      for (let k = 0; k < 3; k++) {
        const moved = circles.map((c, m) => (m === i ? { ...c, center: c.center.clone().setComponent(k, c.center.getComponent(k) + h) } : c));
        g.setComponent(k, (measure(stringLayout(moved, axis)) - base) / h);
      }
      // The middle moves at v + ω × c, so the length changes at g · v + (c × g) · ω.
      const turn = new Vector3().crossVectors(circle.center, g);
      for (let k = 0; k < 3; k++) {
        row[6 * bodies[i] + k] += turn.getComponent(k);
        row[6 * bodies[i] + 3 + k] += g.getComponent(k);
      }
    });
    return row;
  }

  // A row for how fast a wheel's rim turns relative to what it turns in, about a circle's axis,
  // the way the string goes round it.
  private rimRate(body: number, mount: number, point: { axis: Vector3; radius: number; turn: number }, n: number): Row {
    const row = new Array(n).fill(0);
    const z = point.axis.clone().transformDirection(this.poses[mount]).multiplyScalar(point.turn * point.radius);
    for (let k = 0; k < 3; k++) {
      row[6 * body + k] += z.getComponent(k);
      row[6 * mount + k] -= z.getComponent(k);
    }
    return row;
  }

  // Back to the starting position.
  reset() {
    this.jointAngles = this.mech.joints.map(() => 0);
    this.treadTravel = this.mech.treads.map(() => 0);
    this.treadScrub = this.mech.treads.map(() => 0);
    for (const root of this.rootPoses.keys()) this.rootPoses.set(root, new Matrix4());
    this.updatePoses();
  }

  // A body joined to the rest only by two ball joints could spin about the line through the
  // balls without moving anything else. Nothing would make it, so equations() doesn't let it.
  private findLinks() {
    for (let body = 1; body < this.bodyCount; body++) {
      const joints = this.mech.joints.flatMap((j, i) => (j.bodyA === body || j.bodyB === body ? [i] : []));
      const balls = joints.filter((i) => this.mech.joints[i].kind === 'ball');
      const geared = this.mech.gears.some((g) => g.body === body);
      const tyred = this.mech.treads.some((t) => t.body === body);
      if (joints.length === 2 && balls.length === 2 && !geared && !tyred) this.links.push({ body, balls: [balls[0], balls[1]] });
    }
  }

  // For each universal joint, the joint each shaft turns on: the one whose axis passes through
  // the universal joint's middle. A shaft that turns in nothing but the joints at its ends (the
  // middle of a double universal joint) turns about its end's axle hole, against the frame.
  private findCouplings() {
    for (const c of this.mech.couplings ?? []) {
      const shafts = [c.bodyA, c.bodyB].map((body, side): Shaft => {
        let best = -1;
        let bestDistance = 2; // LDU
        this.mech.joints.forEach((j, i) => {
          if (j.kind !== 'revolute' || (j.bodyA !== body && j.bodyB !== body)) return;
          const d = axisOf(j.from, j.to);
          const fromCenter = new Vector3().subVectors(j.from, c.center);
          const distance = fromCenter.clone().addScaledVector(d, -fromCenter.dot(d)).length();
          if (distance < bestDistance) [best, bestDistance] = [i, distance];
        });
        const end = side === 0 ? c.atA : c.atB;
        if (best < 0) {
          // A floating shaft, against the frame: about the line through the middles of the
          // joints at its two ends (so turning it leaves both where they are), or failing a
          // second joint, about its end's axle hole.
          const other = this.mech.couplings.find((o) => o !== c && (o.bodyA === body || o.bodyB === body));
          const axis = other ? new Vector3().subVectors(other.center, c.center).normalize() : (side === 0 ? c.axisA : c.axisB).clone();
          const away = other ? 1 : new Vector3().subVectors(end, c.center).dot(axis) >= 0 ? 1 : -1;
          return { body, joint: -1, mount: 0, axis, away, near: c.center.clone() };
        }
        const j = this.mech.joints[best];
        const d = axisOf(j.from, j.to);
        const near = j.from.clone().addScaledVector(d, new Vector3().subVectors(c.center, j.from).dot(d));
        const away = new Vector3().subVectors(end, c.center).dot(d) >= 0 ? 1 : -1;
        return { body, joint: best, mount: j.bodyA === body ? j.bodyB : j.bodyA, axis: d, away, near };
      });
      this.couplings.push({ shafts });
    }
  }

  // A shaft's axis now (the joint it turns on, or for a floating shaft its own axis), in model
  // coordinates.
  private shaftAxis(shaft: Shaft): Vector3 {
    if (shaft.joint < 0) return shaft.axis.clone().transformDirection(this.poses[shaft.body]);
    const j = this.mech.joints[shaft.joint];
    return axisOf(j.from, j.to).transformDirection(this.poses[j.bodyA]);
  }

  // The ground is level with the lowest tyre. Tyres within GROUND_TOLERANCE of it touch it.
  // With no tyres, the frame (or the first body) is kept still instead.
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
      this.contactHeights[i] = p ? p.y : 0;
      if (p && Math.abs(p.y - lowest) < GROUND_TOLERANCE) this.contactTreads.push(i);
    });
  }

  // A spanning tree over the turning joints, starting from the frame (body 0). Joints that
  // close a loop aren't in the tree, nor are slide and ball joints: closeLoops keeps those
  // together.
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
          if (j.kind !== 'revolute') return;
          const other = j.bodyA === body ? j.bodyB : j.bodyB === body ? j.bodyA : -1;
          if (other >= 0 && !visited[other]) {
            visited[other] = true;
            this.parentJoint[other] = index;
            queue.push(other);
          }
        });
      }
    }
    for (const root of this.rootPoses.keys()) {
      this.rootColumn.set(root, this.columns);
      this.columns += 6;
    }
    this.jointColumn = this.mech.joints.map((_, j) => (this.inTree(j) ? this.columns++ : -1));
  }

  // An orthonormal basis for the motions the tree allows, as motion vectors: the rows of the
  // result are the motion vector's places (6 per body), its columns the basis vectors.
  //
  // Every motion that keeps the tree's joints together is the bodies turning and moving as the
  // root bodies and the tree's joint speeds say, so solving for those (one number per joint,
  // rather than six per body) gives the same answers from a far smaller system of equations,
  // with the tree's joints dropped from it. The basis is made orthonormal, so that the
  // smallest motion in its coordinates is the smallest motion of the bodies too.
  private treeBasis(): number[][] {
    // Each body's motion, as a list of coordinates and what one unit of each does to it
    // (6 numbers: turning, then the velocity of the origin).
    const chains: { column: number; twist: number[] }[][] = [];
    for (const body of this.order) {
      const j = this.parentJoint[body];
      if (j < 0) {
        const first = this.rootColumn.get(body)!;
        chains[body] = Array.from({ length: 6 }, (_, k) => ({ column: first + k, twist: Array.from({ length: 6 }, (_, i) => (i === k ? 1 : 0)) }));
        continue;
      }
      // Turning about the joint's axis d through point c, at rate 1, bodyB relative to bodyA:
      // turn d, velocity of the origin c × d.
      const joint = this.mech.joints[j];
      const parent = joint.bodyA === body ? joint.bodyB : joint.bodyA;
      const d = axisOf(joint.from, joint.to).transformDirection(this.poses[joint.bodyA]);
      const c = joint.from.clone().applyMatrix4(this.poses[joint.bodyA]);
      const v = new Vector3().crossVectors(c, d);
      const sign = joint.bodyB === body ? 1 : -1;
      const twist = [d.x, d.y, d.z, v.x, v.y, v.z].map((x) => sign * x);
      chains[body] = [...chains[parent], { column: this.jointColumn[j], twist }];
    }
    // The columns of J, which turns coordinates into a motion vector, made orthonormal by
    // Gram-Schmidt, twice over for accuracy (some columns are nearly alike, such as two joints
    // on one axle). Plain loops: this runs every step.
    const n = 6 * this.bodyCount;
    const columns: Float64Array[] = Array.from({ length: this.columns }, () => new Float64Array(n));
    chains.forEach((chain, body) => {
      for (const { column, twist } of chain) for (let k = 0; k < 6; k++) columns[column][6 * body + k] = twist[k];
    });
    for (let c = 0; c < columns.length; c++) {
      const u = columns[c];
      for (let pass = 0; pass < 2; pass++) {
        for (let b = 0; b < c; b++) {
          const e = columns[b];
          let d = 0;
          for (let i = 0; i < n; i++) d += u[i] * e[i];
          for (let i = 0; i < n; i++) u[i] -= d * e[i];
        }
      }
      let length = 0;
      for (let i = 0; i < n; i++) length += u[i] * u[i];
      length = Math.sqrt(length);
      for (let i = 0; i < n; i++) u[i] /= length;
    }
    const basis = Array.from({ length: n }, (_, i) => columns.map((col) => col[i]));
    return basis;
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

  // Whether a joint is in the tree that places the bodies.
  private inTree(joint: number): boolean {
    const j = this.mech.joints[joint];
    return this.parentJoint[j.bodyA] === joint || this.parentJoint[j.bodyB] === joint;
  }

  // Whether a joint is part of a closed loop of joints: its two bodies are joined some other
  // way too.
  private inLoop(joint: number): boolean {
    const { bodyA, bodyB } = this.mech.joints[joint];
    const seen = new Set([bodyA]);
    const queue = [bodyA];
    while (queue.length) {
      const body = queue.shift()!;
      this.mech.joints.forEach((j, index) => {
        if (index === joint) return;
        const other = j.bodyA === body ? j.bodyB : j.bodyB === body ? j.bodyA : -1;
        if (other >= 0 && !seen.has(other)) {
          seen.add(other);
          queue.push(other);
        }
      });
    }
    return seen.has(bodyB);
  }

  // Whether a body turns like a knob: on a joint whose axis stays put in what it's mounted on
  // (a gear, a crank, a wheel), rather than turning and travelling at once as part of a loop
  // (a connecting rod, the middle beam of a linkage). Drags turn the first kind and push the rest.
  // A body in a loop still turns like a knob if all its joints are turning ones on one axis: a
  // shaft held in several places (a crane's winch drum, whose axle also passes through bricks
  // pinned to the cab; the axle at the top of its boom, which drives the boom's luffing), not a
  // link pinned at two (a connecting rod).
  turnsLikeAKnob(body: number): boolean {
    const link = this.parentLink(body);
    if (!link) return false;
    if (this.parentJoint[link.parent] < 0 || !this.inLoop(link.joint)) return true;
    const own = this.mech.joints[link.joint];
    const d = axisOf(own.from, own.to);
    return this.mech.joints.every((j) => {
      if (j.bodyA !== body && j.bodyB !== body) return true;
      if (j.kind !== 'revolute' || new Vector3().crossVectors(d, axisOf(j.from, j.to)).length() > 0.01) return false;
      const off = new Vector3().subVectors(j.from, own.from);
      return off.addScaledVector(d, -off.dot(d)).length() < 1;
    });
  }

  // How far a slide joint's bodyB has slid along it, relative to bodyA, since the start, in LDU.
  slideOffset(joint: number): number {
    const j = this.mech.joints[joint];
    const onA = j.from.clone().applyMatrix4(this.poses[j.bodyA]);
    const onB = j.from.clone().applyMatrix4(this.poses[j.bodyB]);
    return onB.sub(onA).dot(axisOf(j.from, j.to).transformDirection(this.poses[j.bodyA]));
  }

  // Two parts that have gone past the end of their travel, or null if none have: a slide
  // joint slid past either end (a plate run off its row of tiles), or a gear run off the end of
  // a rack's teeth.
  atLimit(): [number, number] | null {
    for (let j = 0; j < this.mech.joints.length; j++) {
      const { range, sliding } = this.mech.joints[j];
      if (!range || !sliding) continue;
      const offset = this.slideOffset(j);
      if (offset < range[0] - 1e-9 || offset > range[1] + 1e-9) return sliding;
    }
    // A gear on a rack (or on a row of racks): where it touches must be within the teeth of
    // one of them.
    const rackMeshes = this.mech.meshes.filter((m) => m.kind === 'rack');
    for (const gearIndex of new Set(rackMeshes.map((m) => m.gearA))) {
      let nearest: [number, number] | null = null;
      let onTeeth = false;
      for (const mesh of rackMeshes.filter((m) => m.gearA === gearIndex)) {
        const contact = this.meshContact(mesh)!;
        const rack = contact.b;
        const middle = rack.center.clone().applyMatrix4(this.poses[rack.body]);
        const along = Math.abs(new Vector3().subVectors(contact.pitchPoint, middle).dot(contact.across));
        if (along <= rack.length / 2 + 1e-9) onTeeth = true;
        nearest = nearest ?? [contact.a.part, rack.part];
      }
      if (!onTeeth && nearest) return nearest;
    }
    return null;
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

  // Whether the frame is kept still (the model has no tyres on the ground).
  frameFixed(): boolean {
    return this.fixedBody >= 0;
  }

  // Freezing a body: a body that turns on a joint stops turning on it; a root body (the
  // frame) stops moving altogether. Everything else moves only in ways that allow that.
  toggleFreeze(body: number) {
    if (this.frozen.has(body)) this.frozen.delete(body);
    else this.frozen.add(body);
  }

  isFrozen(body: number): boolean {
    return this.frozen.has(body);
  }

  frozenBodies(): number[] {
    return [...this.frozen];
  }

  unfreezeAll() {
    this.frozen.clear();
  }

  // Before a drag: holds still everything the drag doesn't need to move, so that pushing a
  // car leaves its steering alone and turning its steering wheel leaves the car where it is.
  // Tries holding each body that turns on a joint, those on friction pins first, then the
  // deepest in the mechanism (a planet gear before its differential), and keeps each hold for
  // which `stillPossible` says the drag
  // can still happen. `grabbed` is never held, and nor are wheels with tyres: rolling is their
  // job (holding one front wheel would let the car pivot round it while the steering moves).
  // These holds last only for the drag, and are separate from the bodies the user freezes.
  //
  // Worms lock: a worm gear can't be driven from its gear. So first, any worm the drag would
  // drive from its gear's side is held still. Returns true if that was needed, so the caller
  // can say why a part won't move.
  holdWhatTheDragDoesntNeed(grabbed: number, stillPossible: () => boolean): boolean {
    this.dragHeld.clear();
    this.heldToFrame.clear();
    let wormLocked = false;
    for (const worm of this.wormsAgainst(grabbed)) {
      this.dragHeld.add(worm);
      wormLocked = true;
    }
    const depth = (body: number): number => {
      const link = this.parentLink(body);
      return link ? 1 + depth(link.parent) : 0;
    };
    const wheels = new Set(this.mech.treads.map((t) => t.body));
    // A car stays where it is unless the drag needs it to move: pushing it, or turning a wheel
    // (which drives it). Steering doesn't.
    if (this.contactTreads.length > 0 && grabbed !== 0 && !wheels.has(grabbed)) {
      this.dragHeld.add(0);
      if (!stillPossible()) this.dragHeld.delete(0);
    }
    // A string's pulleys aren't held either: they turn as it runs round them.
    const pulleys = new Set((this.mech.strings ?? []).flatMap((s) => s.pulleys.map((w) => w.body)));
    const candidates = this.order.filter((b) => b !== grabbed && this.parentJoint[b] >= 0 && !this.frozen.has(b) && !wheels.has(b) && !pulleys.has(b));
    // Friction pins first, then the deepest parts.
    const stiff = (body: number) => (this.mech.joints[this.parentJoint[body]].stiff ? 1 : 0);
    candidates.sort((a, b) => stiff(b) - stiff(a) || depth(b) - depth(a) || a - b);
    for (const body of candidates) {
      if (this.dragHeld.has(body)) continue;
      // A hold mustn't carry along what the body turns on, if that could have stayed still:
      // locking a gear that freewheels on a shaft would turn the shaft.
      const link = this.parentLink(body)!;
      const shaft = link.parent;
      const shaftCouldStay = this.couldStayStill(shaft, stillPossible);
      // Nor carry the body round with the shaft it turns on, if that shaft has to turn (an
      // assembly hanging on a driven axle): hold it against the frame instead, if the drag
      // allows.
      if (!shaftCouldStay && this.sharesAxisWithShaft(body)) {
        this.heldToFrame.add(body);
        if (stillPossible()) continue;
        this.heldToFrame.delete(body);
      }
      // Parts of a closed loop aren't held: whether one is needed can't be told from this
      // instant alone (a steering tie rod doesn't turn at all at straight ahead, but must as
      // soon as the wheels do).
      if (this.inLoop(link.joint)) continue;
      this.dragHeld.add(body);
      if (!stillPossible() || (shaftCouldStay && !this.couldStayStill(shaft, stillPossible))) this.dragHeld.delete(body);
    }
    return wormLocked;
  }

  // Whether a body turns on the same axis as the shaft it turns on turns on its own (an
  // assembly on a wheel's axle), so turning the shaft would carry the body round.
  private sharesAxisWithShaft(body: number): boolean {
    const link = this.parentLink(body)!;
    const shaftJoint = this.parentJoint[link.parent];
    if (shaftJoint < 0) return false;
    const a = this.mech.joints[link.joint];
    const b = this.mech.joints[shaftJoint];
    const da = axisOf(a.from, a.to);
    const db = axisOf(b.from, b.to);
    if (new Vector3().crossVectors(da, db).length() > 0.01) return false;
    const offset = new Vector3().subVectors(b.from, a.from);
    return offset.addScaledVector(da, -offset.dot(da)).length() < 1;
  }

  // Whether the drag could still happen with `body` not turning on its joint.
  private couldStayStill(body: number, stillPossible: () => boolean): boolean {
    if (this.parentJoint[body] < 0 || this.dragHeld.has(body) || this.heldToFrame.has(body) || this.frozen.has(body)) return true;
    this.dragHeld.add(body);
    const possible = stillPossible();
    this.dragHeld.delete(body);
    return possible;
  }

  // The worms that a drag of `grabbed` would drive from the gear side. The worm's side is
  // everything geared to the worm without going through its worm mesh (a crank geared to the
  // worm's axle, say); a drag from anywhere else can only reach the worm through its gear.
  private wormsAgainst(grabbed: number): number[] {
    const worms: number[] = [];
    for (const mesh of this.mech.meshes) {
      if (mesh.kind !== 'worm') continue;
      const wormBody = this.mech.gears[mesh.gearA].body;
      if (!this.gearedTo(wormBody).has(grabbed)) worms.push(wormBody);
    }
    return worms;
  }

  // Bodies connected to `body` through gear meshes other than worm meshes.
  private gearedTo(body: number): Set<number> {
    const found = new Set([body]);
    const queue = [body];
    while (queue.length) {
      const b = queue.shift()!;
      for (const mesh of this.mech.meshes) {
        if (mesh.kind === 'worm') continue;
        const x = this.mech.gears[mesh.gearA].body;
        const y = this.mech.gears[mesh.gearB].body;
        const other = x === b ? y : y === b ? x : -1;
        if (other >= 0 && !found.has(other)) {
          found.add(other);
          queue.push(other);
        }
      }
    }
    return found;
  }

  letGoAfterDrag() {
    this.dragHeld.clear();
    this.heldToFrame.clear();
  }

  // ---------------------------------------------------------------------------
  // The equations

  private equations(): Row[] {
    return this.buildEquations(null, null);
  }


  // The equations, as rows. If `gaps` is given, it also gets, for each row, the value its
  // motion should take to close the gap in a joint the tree doesn't follow (how far the joint
  // has come apart), or 0 for every other row (see closeLoops).
  // If `slip` is given, it gets, for each tyre on the ground, a row for how fast it scrubs
  // sideways and one for how fast it travels.
  // With `skipTree`, the tree's joints are left out, for solving in the tree's coordinates
  // (see treeBasis), which keep them together anyway.
  private buildEquations(gaps: number[] | null, slip: Slip | null, skipTree = false): Row[] {
    const rows: Row[] = [];
    const n = 6 * this.bodyCount;
    const add = (row: Row, gap = 0) => {
      rows.push(row);
      gaps?.push(gap);
    };

    const fixed = new Set([...this.frozen, ...this.dragHeld]);
    if (this.fixedBody >= 0) fixed.add(this.fixedBody);
    for (const body of this.heldToFrame) {
      // Held against the frame: no turning about its joint's axis relative to the frame.
      const joint = this.mech.joints[this.parentJoint[body]];
      const d = axisOf(joint.from, joint.to).transformDirection(this.poses[joint.bodyA]);
      const row = new Array(n).fill(0);
      for (let k = 0; k < 3; k++) {
        row[6 * body + k] += d.getComponent(k);
        row[6 * 0 + k] -= d.getComponent(k);
      }
      add(row);
    }
    for (const body of fixed) {
      const j = this.parentJoint[body];
      if (j >= 0 && body !== this.fixedBody) {
        // Frozen, or held for a drag, on its joint: no turning relative to the body it turns on.
        const joint = this.mech.joints[j];
        const d = axisOf(joint.from, joint.to).transformDirection(this.poses[joint.bodyA]);
        const row = new Array(n).fill(0);
        for (let k = 0; k < 3; k++) {
          row[6 * joint.bodyB + k] += d.getComponent(k);
          row[6 * joint.bodyA + k] -= d.getComponent(k);
        }
        add(row);
      } else {
        for (let k = 0; k < 6; k++) {
          const row = new Array(n).fill(0);
          row[6 * body + k] = 1;
          add(row);
        }
      }
    }

    // Joints. Each row says how bodyA moves relative to bodyB in some way must be zero:
    //   revolute  the same at a point on the axis, and no turning about any direction across it
    //   slide     the same across the axis, and no turning at all
    //   ball      the same at the ball's centre
    this.mech.joints.forEach((joint, index) => {
      if (skipTree && this.inTree(index)) return;
      const poseA = this.poses[joint.bodyA];
      const c = joint.from.clone().applyMatrix4(poseA);
      const d = joint.kind === 'ball' ? new Vector3(0, 1, 0) : axisOf(joint.from, joint.to).transformDirection(poseA);
      // How far the joint has come apart, if it's not in the tree (else it can't have).
      const loose = gaps !== null && !this.inTree(index);
      const gap = loose ? joint.from.clone().applyMatrix4(this.poses[joint.bodyB]).sub(c) : new Vector3();
      const twist = loose ? this.misalignment(joint) : new Vector3();

      const pointRow = (dir: Vector3) => {
        const row = new Array(n).fill(0);
        for (let k = 0; k < 3; k++) {
          addPointVelocity(row, joint.bodyA, c, k, dir.getComponent(k));
          addPointVelocity(row, joint.bodyB, c, k, -dir.getComponent(k));
        }
        add(row, gap.dot(dir));
      };
      const turnRow = (dir: Vector3) => {
        const row = new Array(n).fill(0);
        for (let k = 0; k < 3; k++) {
          row[6 * joint.bodyA + k] += dir.getComponent(k);
          row[6 * joint.bodyB + k] -= dir.getComponent(k);
        }
        add(row, -twist.dot(dir));
      };
      const xyz = [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)];

      if (joint.kind === 'revolute' || joint.kind === 'ball') for (const dir of xyz) pointRow(dir);
      if (joint.kind === 'slide') for (const dir of acrossDirections(d)) pointRow(dir);
      if (joint.kind === 'revolute') for (const dir of acrossDirections(d)) turnRow(dir);
      if (joint.kind === 'slide') for (const dir of xyz) turnRow(dir);
    });

    // A universal joint: its two shafts turn at the same rate, each relative to what it turns
    // in, about its own axis pointing away from the joint's middle (so a straight joint turns
    // both the same way). And its two ends stay together, where each shaft's axis passes the
    // joint's middle (points on the axes, so turning the shafts doesn't move them).
    for (const { shafts } of this.couplings) {
      const [a, b] = shafts.map((sh) => ({ body: sh.body, at: sh.near.clone().applyMatrix4(this.poses[sh.body]) }));
      for (let k = 0; k < 3; k++) {
        const row = new Array(n).fill(0);
        addPointVelocity(row, a.body, a.at, k, 1);
        addPointVelocity(row, b.body, b.at, k, -1);
        add(row);
      }
    }
    for (const { shafts } of this.couplings) {
      const row = new Array(n).fill(0);
      for (const shaft of shafts) {
        const d = this.shaftAxis(shaft);
        for (let k = 0; k < 3; k++) {
          row[6 * shaft.body + k] += shaft.away * d.getComponent(k);
          row[6 * shaft.mount + k] -= shaft.away * d.getComponent(k);
        }
      }
      add(row);
    }

    // A link between two balls turns about its length as the bodies at its ends do, on average.
    for (const { body, balls } of this.links) {
      const [a, b] = balls.map((i) => this.mech.joints[i]);
      const ends = [a, b].map((j) => j.from.clone().applyMatrix4(this.poses[j.bodyA]));
      const d = ends[1].sub(ends[0]).normalize();
      const row = new Array(n).fill(0);
      for (const j of [a, b]) {
        const other = j.bodyA === body ? j.bodyB : j.bodyA;
        for (let k = 0; k < 3; k++) row[6 * other + k] -= d.getComponent(k) / 2;
      }
      for (let k = 0; k < 3; k++) row[6 * body + k] += d.getComponent(k);
      add(row);
    }

    // Meshing gears: where their teeth touch (the pitch point), both gears' teeth move at the
    // same speed across the mesh. (Moving the other ways would pull the teeth apart, which the
    // joints already prevent.)
    for (const mesh of this.mech.meshes) {
      const contact = this.meshContact(mesh);
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
      add(row);
    }

    // A tyre on the ground rolls without slipping: the point touching the ground doesn't move
    // along the way the tyre rolls, nor up or down. Sideways it may scrub a little, and up or
    // down it may move a very little, which freeMotions sees to, from the rows in `slip`.
    // Tyres on one body (a solid axle, with no differential between its wheels) roll without
    // slipping on average, but each may skid along the way it rolls: going round a corner, the
    // inside one travels less than the outside one, though both turn alike, so one skids back
    // and the other forward, as on a real car.
    // (Each tyre's forward is taken with its axis turned to point the way the body's first
    // tyre's does: tyres either side of a car face opposite ways.)
    // A track (a tyre whose `track` is set, see trackTreads) skids sideways freely where it
    // touches the ground under each of its wheels, as a tracked vehicle does to turn, but its
    // middle doesn't slide sideways: the average of its wheels' sideways speeds is 0.
    const rolling = new Map<number, { axis: Vector3; rows: Row[] }>(); // for each body, its tyres' rows
    const tracks = new Map<number, { axis: Vector3; rows: Row[] }>(); // for each track, its sideways rows
    for (const i of this.contactTreads) {
      const p = this.contactPoint(i);
      if (!p) continue;
      const tread = this.mech.treads[i];
      const pose = this.poses[tread.body];
      const axis = tread.axis.clone().transformDirection(pose);
      const first = tread.track === undefined ? rolling.get(tread.body)?.axis : tracks.get(tread.track)?.axis;
      if (first && axis.dot(first) < 0) axis.negate();
      const forward = new Vector3().crossVectors(DOWN, axis).normalize();
      const sideways = new Vector3().crossVectors(forward, DOWN).normalize();
      const along = (point: Vector3, dir: Vector3) => {
        const row = new Array(n).fill(0);
        for (let k = 0; k < 3; k++) addPointVelocity(row, tread.body, point, k, dir.getComponent(k));
        return row;
      };
      if (!rolling.has(tread.body)) rolling.set(tread.body, { axis, rows: [] });
      // (A track rolls at its path's radius, nearer the axle than where it touches; see Tread.)
      const hub = tread.center.clone().applyMatrix4(pose);
      const rollAt = tread.rollRadius === undefined ? p : hub.clone().lerp(p, tread.rollRadius / tread.radius);
      rolling.get(tread.body)!.rows.push(along(rollAt, forward));
      if (tread.track !== undefined) {
        if (!tracks.has(tread.track)) tracks.set(tread.track, { axis, rows: [] });
        tracks.get(tread.track)!.rows.push(along(p, sideways));
      }
      if (slip) {
        if (tread.track === undefined) slip.sideways.push(along(p, sideways));
        slip.travel.push(along(tread.center.clone().applyMatrix4(pose), forward));
        slip.lift.push(along(p, DOWN));
      } else {
        add(along(p, DOWN));
      }
    }
    for (const { rows: tyres } of [...rolling.values(), ...tracks.values()]) {
      const average = new Array(n).fill(0);
      for (const row of tyres) for (let k = 0; k < n; k++) average[k] += row[k] / tyres.length;
      add(average);
    }

    // A chain, track or rubber band looped round wheels: each wheel's rim moves at the loop's
    // speed, relative to what the wheel turns in, the way the loop goes round it.
    for (const loop of this.mech.loops ?? []) {
      const rims = loop.wheels.map((w) => {
        const point = loop.path.points[w.point];
        const z = point.axis.clone().transformDirection(this.poses[w.mount]).multiplyScalar(point.turn * point.radius);
        const row = new Array(n).fill(0);
        for (let k = 0; k < 3; k++) {
          row[6 * w.body + k] += z.getComponent(k);
          row[6 * w.mount + k] -= z.getComponent(k);
        }
        return row;
      });
      for (let r = 1; r < rims.length; r++) add(rims[0].map((x, k) => x - rims[r][k]));
    }

    // A string keeps its length: as the bodies carrying its circles move, its free length
    // changes by just what its drum pays out (or winds in). A pulley turns as the string runs
    // round it, without slipping, unless it shares its body with another of the string's
    // pulleys (two pulleys side by side on one axle, which the string runs round at different
    // speeds: one of them must slip). The body hanging on the string (its hook) hangs
    // beneath the middle of the two pulleys either side of its own, as it did at the start,
    // and stays upright, turning with what it hangs from only about the vertical.
    (this.mech.strings ?? []).forEach((s, i) => {
      const start = this.strings[i];
      if (!start) return; // still being set up
      const { circles, bodies, layout } = this.stringNow(s);
      const payout = s.drum ? this.rimRate(s.drum.body, s.drum.mount, s.path.points[s.drum.point], n) : new Array(n).fill(0);
      const length = this.stringRate(s, (l) => l.length, n);
      add(
        length.map((x, k) => x - payout[k]),
        -(layout.length - start.length - this.payout(s)),
      );
      s.pulleys.forEach((w, k) => {
        if (s.pulleys.some((o) => o !== w && o.body === w.body) || s.drum?.body === w.body) return;
        // The string runs past at what the drum pays out, less how fast the string up to here
        // is getting longer.
        const upTo = this.stringRate(s, (l) => l.upTo[k + 1], n);
        const rim = this.rimRate(w.body, w.mount, s.path.points[w.point], n);
        add(rim.map((x, m) => x - payout[m] + upTo[m]));
      });
      if (!s.hook || !start.hookOffset) return;
      const h = s.hook.pulley + 1; // circles start with the drum (or where it's tied)
      const hook = s.hook.body;
      const middle = circles[h - 1].center.clone().add(circles[h + 1].center).multiplyScalar(0.5);
      const off = circles[h].center.clone().sub(middle).sub(start.hookOffset);
      const level = [new Vector3(1, 0, 0), new Vector3(0, 0, 1)];
      for (const dir of level) {
        const row = new Array(n).fill(0);
        for (let k = 0; k < 3; k++) {
          addPointVelocity(row, hook, circles[h].center, k, dir.getComponent(k));
          addPointVelocity(row, bodies[h - 1], circles[h - 1].center, k, -0.5 * dir.getComponent(k));
          addPointVelocity(row, bodies[h + 1], circles[h + 1].center, k, -0.5 * dir.getComponent(k));
        }
        add(row, -off.dot(dir));
      }
      // Upright: turned from the start only about the vertical, as far as what it hangs from
      // has turned about it.
      const above = bodies[h - 1];
      let heading = new Vector3(1, 0, 0).transformDirection(this.poses[above]);
      if (Math.hypot(heading.x, heading.z) < 0.1) heading = new Vector3(0, 0, 1).transformDirection(this.poses[above]).applyAxisAngle(DOWN, -Math.PI / 2);
      const target = new Matrix4().makeRotationY(Math.atan2(-heading.z, heading.x));
      const q = new Quaternion().setFromRotationMatrix(new Matrix4().extractRotation(this.poses[hook]).multiply(target.transpose()));
      const tilt = new Vector3(q.x, q.y, q.z).multiplyScalar(2 * (q.w < 0 ? -1 : 1));
      for (const dir of [...level, DOWN]) {
        const row = new Array(n).fill(0);
        for (let k = 0; k < 3; k++) {
          row[6 * hook + k] += dir.getComponent(k);
          if (dir === DOWN) row[6 * above + k] -= dir.getComponent(k);
        }
        add(row, -tilt.dot(dir));
      }
    });
    return rows;
  }

  // A string's layout where it is now, for drawing it (see stringLayout).
  stringPoints(string: number): Vector3[] {
    return this.stringNow(this.mech.strings[string]).layout.points;
  }

  // How far a loop (a chain or track, an index into Mechanism.loops) has moved round since the
  // start, in LDU, the way its path goes: as far as its first wheel's rim has turned.
  loopTravel(loop: number): number {
    const { path, wheels } = this.mech.loops[loop];
    const w = wheels[0];
    if (!w) return 0;
    const point = path.points[w.point];
    const j = this.mech.joints[w.joint];
    // The joint turns bodyB relative to bodyA about its own axis; the wheel turns about the
    // circle's.
    const angle = (j.bodyB === w.body ? 1 : -1) * Math.sign(axisOf(j.from, j.to).dot(point.axis)) * this.jointAngles[w.joint];
    return point.turn * point.radius * angle;
  }

  // How far bodyA has turned out of line with bodyB at a joint, as a small turn (its axis is
  // the direction, its length the angle in radians): for a revolute joint, how far its axis
  // as carried by bodyA has tipped away from its axis as carried by bodyB; for a slide joint,
  // which mustn't turn at all, bodyA's whole turn relative to bodyB.
  private misalignment(joint: Joint): Vector3 {
    const poseA = this.poses[joint.bodyA];
    const poseB = this.poses[joint.bodyB];
    if (joint.kind === 'revolute') {
      const dA = axisOf(joint.from, joint.to).transformDirection(poseA);
      const dB = axisOf(joint.from, joint.to).transformDirection(poseB);
      return new Vector3().crossVectors(dB, dA);
    }
    if (joint.kind === 'slide') {
      const relative = new Matrix4().extractRotation(poseA).multiply(new Matrix4().extractRotation(poseB).transpose());
      const q = new Quaternion().setFromRotationMatrix(relative);
      const sign = q.w < 0 ? -1 : 1;
      return new Vector3(q.x, q.y, q.z).multiplyScalar(2 * sign);
    }
    return new Vector3();
  }

  // After a step: pulls the joints the tree doesn't follow (one per closed loop, and every
  // slide and ball joint) back together. Small steps let them drift apart; this moves every
  // body by the smallest motion that closes the gaps while keeping every other equation, and
  // without turning `keep` (the joint a drag is turning, so it turns by exactly what the drag
  // asked). A few rounds, since each is only exact for small gaps; it stops early once a round
  // no longer halves the biggest gap (a model whose positions are rounded off, as LDraw files
  // are, can't always close its loops quite exactly), undoing that round if it made the gap
  // bigger.
  private closeLoops(keep: number) {
    if (this.mech.joints.every((_, j) => this.inTree(j))) return;
    let previous = Infinity;
    let before: KinematicsState | null = null;
    for (let round = 0; round < 8; round++) {
      const gaps: number[] = [];
      const rows = this.buildEquations(gaps, null, true);
      const biggest = gaps.reduce((max, g) => Math.max(max, Math.abs(g)), 0);
      // A round that opened the gaps up, rather than closing them, is undone.
      if (before && biggest > previous) this.restore(before);
      if (biggest < LOOP_TOLERANCE || biggest > previous / 2) return;
      previous = biggest;
      before = this.snapshot();
      const basis = this.treeBasis();
      if (keep >= 0) {
        const row = new Array(6 * this.bodyCount).fill(0);
        const j = this.mech.joints[keep];
        const d = axisOf(j.from, j.to).transformDirection(this.poses[j.bodyA]);
        for (let k = 0; k < 3; k++) {
          row[6 * j.bodyB + k] += d.getComponent(k);
          row[6 * j.bodyA + k] -= d.getComponent(k);
        }
        rows.push(row);
        gaps.push(0);
      }
      const solution = dampedSolution(inBasis(rows, basis), gaps);
      if (!solution) return;
      this.move(fromBasis(solution, basis), 1);
    }
  }

  // Where two meshing gears' teeth touch now (the pitch point), and the direction their teeth
  // move there. Recomputed from where the gears are, since in a differential the gears'
  // axles themselves go round.
  private meshContact(mesh: Mesh): { a: Gear; b: Gear; pitchPoint: Vector3; across: Vector3 } | null {
    const a = this.mech.gears[mesh.gearA];
    const b = this.mech.gears[mesh.gearB];
    const ca = a.center.clone().applyMatrix4(this.poses[a.body]);
    const cb = b.center.clone().applyMatrix4(this.poses[b.body]);
    const axisA = a.axis.clone().transformDirection(this.poses[a.body]);
    const axisB = b.axis.clone().transformDirection(this.poses[b.body]);
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
      // teeth and the rack move at the same speed along the rack.
      const face = b.face!.clone().transformDirection(this.poses[b.body]);
      const pitchPoint = ca.clone().addScaledVector(face, -a.radius);
      return { a, b, pitchPoint, across: axisB };
    }
    if (mesh.kind === 'crown') {
      // a is the crown gear. Where the spur gear's pitch circle touches the crown gear's pitch
      // plane, both gears' teeth move at the same speed round the crown gear's axis.
      const toward = axisA.clone().multiplyScalar(-a.crown);
      const pitchPoint = cb.clone().addScaledVector(toward, b.radius);
      const across = new Vector3().crossVectors(axisA, new Vector3().subVectors(pitchPoint, ca)).normalize();
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
    const crossing = axesCrossing(ca, axisA, cb, axisB);
    if (!crossing) return null;
    const towardA = new Vector3().subVectors(ca, crossing).normalize();
    const towardB = new Vector3().subVectors(cb, crossing).normalize();
    const pitchPoint = crossing.clone().addScaledVector(towardA, b.teeth).addScaledVector(towardB, a.teeth);
    const across = new Vector3().crossVectors(towardA, towardB).normalize();
    return { a, b, pitchPoint, across };
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
  // They're made orthonormal, so that mixing them by least squares gives the smallest overall
  // motion (turning the steering wheel shouldn't also roll the car).
  //
  // Tyres on the ground may scrub sideways a little: of the motions the equations allow, the
  // ones kept are those where the tyres scrub sideways by at most `scrub` of how fast they
  // travel (rolling straight, steering on its own, and a steered car turning round the centre
  // that needs the least scrub), and not, say, sliding the car across its length. Motions that
  // leave the frame where it is are kept however much the tyres scrub: steering a parked car
  // whose wheels sit off their pivots drags its tyres round, as on a real car.
  //
  // A tyre's contact point may also rise or sink, very little: by at most LIFT of how far it
  // moves across the ground, so a wheel steered on a leaning pivot can turn. Rolling the car
  // counts that against the scrub allowance; a parked car's motions (steering) have only it
  // to keep to.
  freeMotions(): number[][] {
    const slip: Slip = { sideways: [], travel: [], lift: [] };
    const n = 6 * this.bodyCount;
    const basis = this.treeBasis();
    const rows = inBasis(this.buildEquations(null, slip, true), basis);
    const motions = orthonormalize(nullSpace(rows, basis[0].length).map((z) => fromBasis(z, basis)));
    if (slip.sideways.length === 0 || motions.length === 0) return motions;
    const frameStill = Array.from({ length: 6 }, (_, k) => {
      const row = new Array(n).fill(0);
      row[k] = 1;
      return row;
    });
    const parked = orthonormalize(nullSpace([...rows, ...inBasis(frameStill, basis)], basis[0].length).map((z) => fromBasis(z, basis)));
    const keptParked = parked.length ? orthonormalize(leastScrub(parked, { sideways: slip.lift, travel: [...slip.travel, ...slip.sideways], lift: [] }, LIFT)) : [];
    // The rest of the motions, with the parked ones taken out, judged as rolling. Taking them
    // out first keeps the two sets apart: joined afterwards, a rolling motion that's nearly a
    // parked one would leave a sliver that, scaled up, is a bogus motion (lifting the car).
    const rest = orthonormalize(
      motions.map((m) => {
        const u = m.slice();
        for (const p of keptParked) {
          const d = u.reduce((sum, x, i) => sum + x * p[i], 0);
          for (let i = 0; i < u.length; i++) u[i] -= d * p[i];
        }
        return u;
      }),
      1e-6,
    );
    // Lift counts as scrub, LIFT of it as much as the usual allowance (however much more scrub
    // the model allows: that's for scrubbing sideways, not rising or sinking).
    const usual = Math.min(this.scrub, DEFAULT_SCRUB);
    const liftAsScrub = slip.lift.map((row) => row.map((x) => (x * usual) / LIFT));
    const rolling = rest.length ? leastScrub(rest, { sideways: [...slip.sideways, ...liftAsScrub], travel: slip.travel, lift: [] }, this.scrub, usual) : [];
    return orthonormalize([...keptParked, ...rolling]);
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
  // mechanism follow, in steps of at most `maxStep` (MAX_TURN_STEP unless given). Returns how
  // far it actually turned, which is less if the joint can't turn (jammed).
  //
  // If `allowed` is given, it's asked after each step whether the mechanism may be where it
  // now is (no parts passing through each other); if not, that step is undone and the turn
  // stops there.
  turnJoint(joint: number, angle: number, allowed?: () => boolean, maxStep = MAX_TURN_STEP): number {
    let turned = 0;
    const steps = Math.ceil(Math.abs(angle) / maxStep);
    for (let i = 0; i < steps; i++) {
      const motion = this.jointMotion(joint);
      if (!motion) break;
      const before = this.snapshot();
      this.advance(motion, angle / steps, joint);
      if (allowed && !allowed()) {
        this.restore(before);
        break;
      }
      turned += angle / steps;
    }
    return turned;
  }

  // Where everything is, so it can be put back (to undo a step).
  snapshot(): KinematicsState {
    const roots = new Map<number, Matrix4>();
    for (const [root, pose] of this.rootPoses) roots.set(root, pose.clone());
    return { roots, jointAngles: this.jointAngles.slice(), treadTravel: this.treadTravel.slice(), treadScrub: this.treadScrub.slice() };
  }

  restore(state: KinematicsState) {
    for (const [root, pose] of state.roots) this.rootPoses.set(root, pose.clone());
    this.jointAngles = state.jointAngles.slice();
    this.treadTravel = state.treadTravel.slice();
    this.treadScrub = state.treadScrub.slice();
    this.updatePoses();
  }

  // The motion vector that turns a joint at rate 1 (one radian per unit), with the rest of
  // the mechanism following. If the joint can turn with the frame standing still, it does
  // (turning a steering wheel turns the front axle without rolling the car); otherwise the
  // frame moves too. Among the motions that qualify, it picks the smallest, measured by how
  // fast the joints turn, and nothing else: measured by how fast the bodies move, it would nudge
  // a linkage nobody asked to move (a bulldozer's bucket arm) against the way the whole model
  // turns, to make that a little smaller, and step after step the linkage would drift; and a
  // body with a position of its own (a crane's hook) moves only as it must, rather than other
  // joints turning (the crane slewing) to spare it. The pulleys a string turns don't count
  // either, for the same reason. Null if the joint can't turn.
  jointMotion(joint: number): number[] | null {
    const all = this.freeMotions();
    const rate = (m: number[]) => this.jointRate(m, joint);
    const pulleys = new Set((this.mech.strings ?? []).flatMap((s) => s.pulleys.map((w) => w.joint)));
    const size = (m: number[]) =>
      this.mech.joints.flatMap((j, i) => (pulleys.has(i) ? [] : j.kind === 'revolute' ? [this.jointRate(m, i)] : []));
    return smallestTurning(this.frameStill(all), rate, size) ?? smallestTurning(all, rate, size);
  }

  // The radius of the circle the frame's origin is driving round right now, Infinity when
  // it's driving straight, or null if the frame can't move. (Only steering and rolling move a
  // car's frame, so this takes the free motion that moves the frame, if there's one.)
  frameTurningRadius(): number | null {
    const all = this.freeMotions();
    const still = this.frameStill(all);
    let best: number[] | null = null;
    let bestSpeed = EPSILON;
    for (const m of all) {
      // Take out any part of it that leaves the frame where it is.
      const moving = m.slice();
      for (const b of still) {
        const d = moving.reduce((sum, x, i) => sum + x * b[i], 0);
        for (let i = 0; i < moving.length; i++) moving[i] -= d * b[i];
      }
      const speed = this.pointVelocity(moving, 0, new Vector3().applyMatrix4(this.poses[0])).length();
      if (speed > bestSpeed) {
        best = moving;
        bestSpeed = speed;
      }
    }
    if (!best) return null;
    const turnRate = new Vector3(best[0], best[1], best[2]).length();
    return turnRate < EPSILON ? Infinity : bestSpeed / turnRate;
  }

  // The free motions that leave the frame (body 0) where it is, made orthonormal.
  private frameStill(motions: number[][]): number[][] {
    if (motions.length === 0) return [];
    // Mixes a of the motions with  Σ a_k · (frame part of m_k) = 0.
    const rows: number[][] = [];
    for (let c = 0; c < 6; c++) rows.push(motions.map((m) => m[c]));
    const mixes = nullSpace(rows, motions.length);
    const combined = mixes.map((a) => {
      const v = new Array(motions[0].length).fill(0);
      a.forEach((ak, k) => motions[k].forEach((x, i) => (v[i] += ak * x)));
      return v;
    });
    return orthonormalize(combined);
  }

  // Moves the mechanism along a motion vector, scaled by `amount`, then closes any loops
  // (without turning the joint `keep`, if given). Keep steps small (a few LDU, a few
  // degrees): the motion is only exact at the start of the step.
  advance(motion: number[], amount: number, keep = -1) {
    this.move(motion, amount);
    this.closeLoops(keep);
    this.settle();
  }

  // Sets the model back down on its tyres. The solver lets a tyre rise or sink a very little
  // (see freeMotions), and a car's rolling makes use of that to scrub less; step after step,
  // that would add up, and a car driving round in circles would slowly tip over. So after each
  // step, the whole model is moved as one, up or down and tipped about level directions,
  // as little as puts its tyres on the ground back where they touched it at the start (least
  // squares, since four tyres on a frame that can't twist may not all fit). Moving it all as
  // one opens no joint. A car held still (steering it, or frozen) isn't moved.
  private settle() {
    if (this.contactTreads.length < 3 || this.fixedBody >= 0 || this.frozen.has(0) || this.dragHeld.has(0)) return;
    for (let round = 0; round < 3; round++) {
      // For each tyre, how its contact point would rise or sink (LDraw y) for each of: the
      // model moving down, turning about x, turning about z (about the origin); and how far it
      // has to go.
      const rows: number[][] = [];
      const wanted: number[] = [];
      for (const i of this.contactTreads) {
        const p = this.contactPoint(i);
        if (!p) continue;
        rows.push([1, -p.z, p.x]);
        wanted.push(this.contactHeights[i] - p.y);
      }
      if (Math.max(...wanted.map(Math.abs)) < LOOP_TOLERANCE) return;
      const gram = [0, 1, 2].map((a) => [0, 1, 2].map((b) => rows.reduce((sum, r) => sum + r[a] * r[b], 0)));
      const [down, tipX, tipZ] = solveSymmetric(gram, [0, 1, 2].map((a) => rows.reduce((sum, r, k) => sum + r[a] * wanted[k], 0)), EPSILON);
      const tip = screwMotion(new Vector3(tipX, 0, tipZ), new Vector3(0, down, 0));
      for (const pose of this.rootPoses.values()) pose.premultiply(tip);
      this.updatePoses();
    }
  }

  private move(motion: number[], amount: number) {
    this.mech.treads.forEach((t, i) => {
      const pose = this.poses[t.body];
      const hub = t.center.clone().applyMatrix4(pose);
      // Turning positive about the axis a, with the ground below, carries the hub along down × a.
      const forward = new Vector3().crossVectors(DOWN, t.axis.clone().transformDirection(pose)).normalize();
      this.treadTravel[i] += this.pointVelocity(motion, t.body, hub).dot(forward) * amount;
      const contact = this.contactTreads.includes(i) ? this.contactPoint(i) : null;
      if (contact) {
        const sideways = new Vector3().crossVectors(forward, DOWN).normalize();
        this.treadScrub[i] += Math.abs(this.pointVelocity(motion, t.body, contact).dot(sideways) * amount);
      }
    });
    this.mech.joints.forEach((joint, j) => {
      if (joint.kind === 'revolute') this.jointAngles[j] += this.jointRate(motion, j) * amount;
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
  if (angle === 0) return new Matrix4().makeTranslation(v.x, v.y, v.z);
  // A tiny turn: its axis can't be found accurately, but turning about the origin then moving
  // by v is the same to within angle². (Leaving out the turn would move a body far from the
  // origin by as much as angle × its distance, which closeLoops couldn't then close.)
  if (angle < EPSILON) return new Matrix4().makeTranslation(v.x, v.y, v.z).multiply(new Matrix4().makeRotationAxis(w.clone().divideScalar(angle), angle));
  const axis = w.clone().divideScalar(angle);
  const pointOnAxis = new Vector3().crossVectors(w, v).divideScalar(angle * angle);
  const slide = axis.clone().multiplyScalar(v.dot(axis));
  return new Matrix4().makeTranslation(slide.x, slide.y, slide.z).multiply(rotationAbout(pointOnAxis, axis, angle));
}

// Of orthonormal motions, the smallest mix that turns at rate 1 (by `rate`), or null if none
// of them turns at all, its size measured by the length of `size` of it: the mix a minimizing
// aᵀ G a with Σ a_k rate_k = 1, where G holds each pair of motions' sizes multiplied together,
// is a = G⁻¹ rates / (ratesᵀ G⁻¹ rates).
function smallestTurning(motions: number[][], rate: (m: number[]) => number, size: (m: number[]) => number[]): number[] | null {
  const rates = motions.map(rate);
  if (rates.reduce((sum, r) => sum + r * r, 0) < EPSILON) return null;
  const sizes = motions.map(size);
  const gram = sizes.map((a) => sizes.map((b) => a.reduce((sum, x, i) => sum + x * b[i], 0)));
  const scale = Math.max(...gram.map((row, i) => row[i]));
  const mix = solveSymmetric(gram, rates, EPSILON * scale);
  const turns = mix.reduce((sum, a, k) => sum + a * rates[k], 0);
  if (Math.abs(turns) < EPSILON) return null;
  return combine(motions, mix.map((a) => a / turns));
}

// Of orthonormal motions, the mixes in which the tyres scrub sideways by at most `limit` of how
// far they travel, as orthonormal motions. Worked out in the motions' own coordinates:
//   - mixes in which no tyre travels are kept only if no tyre scrubs (steering on its own);
//   - mixes in which tyres travel may add any of those, to scrub as little as they can; then
//     the directions whose scrub per unit of travel is at most `usual` are kept (rolling
//     straight, and a steered car turning round the centre that needs the least scrub). If
//     none is, but the one that scrubs least is within `limit`, that one alone is kept: a model
//     may allow its tyres more scrub (`limit`, more than `usual`) so that it can roll where it
//     otherwise couldn't, but not so that it may also roll in other ways that scrub more than
//     needed (a steered car scrubbing straight on, rather than following its steering).
function leastScrub(motions: number[][], slip: Slip, limit: number, usual = limit): number[][] {
  const k = motions.length;
  const dot = (a: number[], b: number[]) => a.reduce((sum, x, i) => sum + x * b[i], 0);
  // Each row applied to each motion: rows × k.
  const scrub = slip.sideways.map((row) => motions.map((m) => dot(row, m)));
  const travel = slip.travel.map((row) => motions.map((m) => dot(row, m)));
  const gram = (a: number[][]) => Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => a.reduce((sum, row) => sum + row[i] * row[j], 0)));
  const travelGram = gram(travel);
  const scale = Math.max(1, ...travelGram.map((row, i) => row[i]), ...gram(scrub).map((row, i) => row[i]));
  const tiny = 1e-9 * scale;

  // Directions (in the motions' coordinates) with no travel, Z, and with unit travel, C.
  const { values: tv, vectors: tvecs } = symmetricEigen(travelGram);
  const still = tvecs.filter((_, e) => tv[e] <= tiny);
  const moving = tvecs.flatMap((v, e) => (tv[e] > tiny ? [v.map((x) => x / Math.sqrt(tv[e]))] : []));
  // How much each tyre scrubs under a direction (in the motions' coordinates).
  const scrubOf = (d: number[]) => scrub.map((row) => dot(row, d));
  const kept: number[][] = [];

  // Still directions that don't scrub.
  const stillScrub = still.map(scrubOf);
  const stillGram = still.map((_, i) => still.map((_, j) => dot(stillScrub[i], stillScrub[j])));
  const { values: sv, vectors: svecs } = symmetricEigen(stillGram);
  svecs.forEach((y, e) => {
    if (sv[e] <= tiny) kept.push(combine(still, y));
  });

  // Moving directions, each with the still mix that cancels most of its scrub: z = -(YᵀY)⁻¹ Yᵀ x.
  const best = moving.map((c) => {
    if (still.length === 0) return c;
    const x = scrubOf(c);
    const z = combine(still, solveSymmetric(stillGram, still.map((_, i) => -dot(stillScrub[i], x)), tiny));
    return c.map((value, i) => value + z[i]);
  });
  const left = best.map(scrubOf);
  const leftGram = best.map((_, i) => best.map((_, j) => dot(left[i], left[j])));
  const { values: mv, vectors: mvecs } = symmetricEigen(leftGram);
  const least = Math.min(...mv);
  const threshold = least <= limit * limit ? Math.max(usual * usual, least) : -Infinity;
  mvecs.forEach((y, e) => {
    if (mv[e] <= threshold) kept.push(combine(best, y));
  });

  return orthonormalize(kept.map((a) => combine(motions, a)));
}

// The mix of `vectors` with these amounts.
function combine(vectors: number[][], amounts: number[]): number[] {
  const out = new Array(vectors[0]?.length ?? 0).fill(0);
  vectors.forEach((v, i) => v.forEach((x, j) => (out[j] += amounts[i] * x)));
  return out;
}

// The x with  a · x = b  for a small symmetric a, ignoring directions with eigenvalues below
// `tiny` (least squares, if a is singular).
function solveSymmetric(a: number[][], b: number[], tiny: number): number[] {
  if (a.length === 0) return [];
  const { values, vectors } = symmetricEigen(a);
  const x = new Array(a.length).fill(0);
  vectors.forEach((v, e) => {
    if (values[e] <= tiny) return;
    const amount = v.reduce((sum, vi, i) => sum + vi * b[i], 0) / values[e];
    v.forEach((vi, i) => (x[i] += amount * vi));
  });
  return x;
}

// The eigenvalues and eigenvectors of a small symmetric matrix (Jacobi's method: rotate away
// the off-diagonal entries one pair at a time until they're negligible).
export function symmetricEigen(matrix: number[][]): { values: number[]; vectors: number[][] } {
  const n = matrix.length;
  const a = matrix.map((row) => row.slice());
  const v: number[][] = a.map((_, i) => a.map((_, j) => (i === j ? 1 : 0))); // columns are eigenvectors
  for (let sweep = 0; sweep < 50; sweep++) {
    let off = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += a[i][j] * a[i][j];
    if (off < 1e-24) break;
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(a[p][q]) < 1e-30) continue;
        const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < n; k++) {
          const akp = a[k][p];
          const akq = a[k][q];
          a[k][p] = c * akp - s * akq;
          a[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = a[p][k];
          const aqk = a[q][k];
          a[p][k] = c * apk - s * aqk;
          a[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = v[k][p];
          const vkq = v[k][q];
          v[k][p] = c * vkp - s * vkq;
          v[k][q] = s * vkp + c * vkq;
        }
      }
    }
  }
  return { values: a.map((row, i) => row[i]), vectors: a.map((_, e) => v.map((row) => row[e])) };
}

// The smallest x with  rows · x = values, or if they can't all hold (a model whose positions
// are rounded off can't always close its loops exactly), close to the smallest that comes
// closest: the x minimizing |rows · x - values|² + δ|x|², with δ tiny, which keeps rows that
// nearly repeat others (two joints in a loop that each keep the same body from tipping) from
// asking for huge motions. Each row is scaled to length 1 first, so that where rows can't all
// hold, rows about turning count as much as rows about moving (in LDU, whose numbers run
// larger); weighed by their raw sizes, a single-cylinder engine's piston tips a little further
// out of line with every step. Solved by QR on the rows themselves, rather than on rows · rowsᵀ,
// which would square their rounding errors.
function dampedSolution(rows: Row[], values: number[]): number[] | null {
  if (rows.length === 0) return null;
  const n = rows[0].length;
  // Each row scaled to length 1, so that rows of turning and of moving count alike. Rows next
  // to nothing long are left out: the tree already keeps them (their length is rounding).
  const lengths = rows.map((row) => Math.sqrt(row.reduce((sum, x) => sum + x * x, 0)));
  const longest = Math.max(...lengths);
  const kept = rows.flatMap((_, i) => (lengths[i] > 1e-9 * longest ? [i] : []));
  if (kept.length === 0) return null;
  const damping = Math.sqrt(1e-13);
  const identity = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? damping : 0)));
  return leastSquares(
    [...kept.map((i) => rows[i].map((x) => x / lengths[i])), ...identity],
    [...kept.map((i) => values[i] / lengths[i]), ...new Array(n).fill(0)],
  );
}

function leastSquares(a: number[][], b: number[]): number[] {
  const m = a.length;
  const k = a[0].length;
  const r = a.map((row) => row.slice());
  const y = b.slice();
  for (let j = 0; j < k; j++) {
    // Reflect column j below the diagonal onto the diagonal.
    let norm = 0;
    for (let i = j; i < m; i++) norm += r[i][j] * r[i][j];
    norm = Math.sqrt(norm);
    if (norm === 0) continue;
    const alpha = r[j][j] > 0 ? -norm : norm;
    const v = new Array(m).fill(0);
    for (let i = j; i < m; i++) v[i] = r[i][j];
    v[j] -= alpha;
    const vv = v.reduce((sum, x) => sum + x * x, 0);
    if (vv === 0) continue;
    for (let col = j; col < k; col++) {
      let d = 0;
      for (let i = j; i < m; i++) d += v[i] * r[i][col];
      const f = (2 * d) / vv;
      for (let i = j; i < m; i++) r[i][col] -= f * v[i];
    }
    let d = 0;
    for (let i = j; i < m; i++) d += v[i] * y[i];
    const f = (2 * d) / vv;
    for (let i = j; i < m; i++) y[i] -= f * v[i];
  }
  const x = new Array(k).fill(0);
  for (let j = k - 1; j >= 0; j--) {
    let sum = y[j];
    for (let col = j + 1; col < k; col++) sum -= r[j][col] * x[col];
    x[j] = r[j][j] === 0 ? 0 : sum / r[j][j];
  }
  return x;
}

// Equation rows (on motion vectors) as rows on coordinates in a basis (see treeBasis).
function inBasis(rows: Row[], basis: number[][]): Row[] {
  const q = basis[0]?.length ?? 0;
  return rows.map((row) => {
    const out = new Array(q).fill(0);
    for (let i = 0; i < row.length; i++) {
      const x = row[i];
      if (x === 0) continue;
      const b = basis[i];
      for (let c = 0; c < q; c++) out[c] += x * b[c];
    }
    return out;
  });
}

// The motion vector with these coordinates in a basis (see treeBasis).
function fromBasis(z: number[], basis: number[][]): number[] {
  return basis.map((b) => {
    let sum = 0;
    for (let c = 0; c < z.length; c++) sum += b[c] * z[c];
    return sum;
  });
}

// The same vectors made orthonormal (unit length, at right angles to each other), by
// Gram-Schmidt.
function orthonormalize(vectors: number[][], tiny = EPSILON): number[][] {
  const result: number[][] = [];
  for (const v of vectors) {
    const u = v.slice();
    for (const b of result) {
      const d = u.reduce((sum, x, i) => sum + x * b[i], 0);
      for (let i = 0; i < u.length; i++) u[i] -= d * b[i];
    }
    const len = Math.sqrt(u.reduce((sum, x) => sum + x * x, 0));
    if (len > tiny) result.push(u.map((x) => x / len));
  }
  return result;
}

// The solutions x of  rows · x = 0,  as a list of independent vectors (Gauss-Jordan elimination).
export function nullSpace(rows: Row[], n: number): number[][] {
  const a = rows.map((r) => r.slice());
  const pivotColumns: number[] = [];
  const used = new Array(n).fill(false);
  for (let r = 0; r < a.length; r++) {
    // Pivot on an entry that's the largest in both its row and its column ("rook pivoting"),
    // for accuracy: picking only down a column lets rounding errors grow until an equation
    // implied by the others looks independent. If that finds nothing, look everywhere left.
    const largestInRow = (i: number) => {
      let best = -1;
      for (let k = 0; k < n; k++) if (!used[k] && (best < 0 || Math.abs(a[i][k]) > Math.abs(a[i][best]))) best = k;
      return best;
    };
    const largestInColumn = (k: number) => {
      let best = r;
      for (let i = r + 1; i < a.length; i++) if (Math.abs(a[i][k]) > Math.abs(a[best][k])) best = i;
      return best;
    };
    let best = r;
    let c = largestInRow(r);
    if (c < 0) break;
    for (;;) {
      const i = largestInColumn(c);
      const k = largestInRow(i);
      const done = Math.abs(a[i][k]) <= Math.abs(a[i][c]);
      best = i;
      if (done) break;
      c = k;
    }
    if (Math.abs(a[best][c]) < RANK_TOLERANCE) {
      for (let i = r; i < a.length; i++) {
        const k = largestInRow(i);
        if (Math.abs(a[i][k]) > Math.abs(a[best][c])) [best, c] = [i, k];
      }
      if (Math.abs(a[best][c]) < RANK_TOLERANCE) break;
    }
    used[c] = true;
    [a[r], a[best]] = [a[best], a[r]];
    const pivot = a[r][c];
    for (let k = 0; k < n; k++) a[r][k] /= pivot;
    for (let i = 0; i < a.length; i++) {
      if (i === r || a[i][c] === 0) continue;
      const factor = a[i][c];
      for (let k = 0; k < n; k++) a[i][k] -= factor * a[r][k];
    }
    pivotColumns.push(c);
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
