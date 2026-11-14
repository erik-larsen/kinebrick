// A spike, not part of Kinebrick: writes a set's mechanism as a MuJoCo model (MJCF), to measure
// whether MuJoCo could move a set with every friction pin a real hinge with dry friction (see
// docs/mujoco-spike.md). Run it with every friction pin read as a joint:
//
//   KINEBRICK_FRICTION_RIGID=0 npx tsx scripts/export-mjcf.ts 8880 [--frictionloss 0.005]
//
// It writes mjcf-out/<set>.xml and mjcf-out/<set>.json (what scripts/mujoco-spike.py needs: which
// body each listed part is in, the controls and the rates the check stored).
//
// What becomes what:
// - Each rigid body: a MuJoCo body, its mass PART_MASS for each part, its inertia that of a solid
//   box round its parts' origins, PAD wider each way.
// - The joints: a spanning tree from the frame (which gets a free joint, to stand on its wheels):
//   the joints ties are written over first, then other joints, then balls, then universal
//   joints. A joint in the tree is a hinge, slide or ball in its child body. A joint that closes a
//   loop is a small "ghost" body hung on one side by the same joint, welded to the other side, so
//   a friction pin closing a loop keeps its friction. A ball closing a loop is a connect.
// - A friction pin's joint (and a motor's: `stiff`): a hinge with frictionloss.
// - Gear meshes, chains and belts, linear actuators' screws: each a linear tie between joint
//   coordinates, worked out from the tree as built (each gear's pitch point facing the other
//   moves at the same speed along the teeth's push). A tie with two joints is a joint equality
//   with the ratio; with more (a differential, a gear on a turning carrier), a fixed tendon held
//   at its length.
// - Universal joints: a ghost cross on two hinges, welded to the far shaft.
// - Wheels: a cylinder for each tyre's tread, the only geometry that collides, against a ground
//   plane. Gravity on.
// Left out: strings, rests, rails and train riders, sliders and gear shifts, and anything that
// changes the mechanism while it moves (see the report).

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Vector3 } from 'three';
import { loadModel } from './load-model.ts';
import type { Joint, Mechanism } from '../src/mechanism.ts';

const S = 0.0004; // metres per LDU
const PART_MASS = 0.0025; // kg: about the mean of a Technic part
const PAD = 10; // LDU round the parts' origins
const GHOST_MASS = 1e-4;
const GHOST_INERTIA = 1e-10;

const args = process.argv.slice(2);
const option = (name: string, fallback: number) => {
  const i = args.indexOf(name);
  return i >= 0 ? Number(args[i + 1]) : fallback;
};
const setName = args.find((a) => /^\d/.test(a));
if (!setName) throw new Error('usage: export-mjcf.ts <set> [--frictionloss N]');
const FRICTION = option('--frictionloss', 0.005); // N m, on each friction pin's hinge
const DAMPING = option('--damping', 1e-5); // N m s, on every other joint
// Rotor inertia added to every joint (kg m2): without it, light bodies on friction pins blow up.
const ARMATURE = option('--armature', 1e-7);
// How quickly a loop or tie that has come apart is pulled back (s): MuJoCo's default, 0.02,
// lets the gears slip. Dry friction is as soft by default, and a friction pin under a steady load
// creeps round; it gets the stiffest MuJoCo allows at the time step, 2 steps (see the report).
const SOLREF = `${option('--solref', 0.002)} 1`;

const setFile = `data/sets/${setName.includes('-') ? setName : setName + '-1'}.json`;
const set = JSON.parse(readFileSync(setFile, 'utf-8'));
const modelFile: string = set.curated.model;
console.log(`reading ${modelFile}`);
const loaded = loadModel(modelFile, modelFile.startsWith('omr/'));
const mech: Mechanism = loaded.mech;
const parts = loaded.parts;

// LDraw to MuJoCo: LDraw's -y is up; turned a quarter turn about x, so z is up, and scaled.
const mj = (v: Vector3) => [v.x * S, v.z * S, -v.y * S];
const mjDir = (v: Vector3) => [v.x, v.z, -v.y];
const fmt = (a: number[]) => a.map((x) => (Math.abs(x) < 1e-12 ? 0 : +x.toPrecision(7))).join(' ');
const sub = (a: number[], b: number[]) => a.map((x, i) => x - b[i]);

// ---------------------------------------------------------------------------
// Bodies: a box round each body's parts' origins.
const origin = (i: number) => new Vector3().setFromMatrixPosition(parts[i].matrix);
const boxes = mech.bodies.map((b) => {
  const lo = new Vector3(Infinity, Infinity, Infinity);
  const hi = new Vector3(-Infinity, -Infinity, -Infinity);
  for (const p of b.parts) {
    lo.min(origin(p));
    hi.max(origin(p));
  }
  if (!b.parts.length) lo.set(0, 0, 0), hi.set(0, 0, 0);
  lo.subScalar(PAD);
  hi.addScalar(PAD);
  const center = lo.clone().add(hi).multiplyScalar(0.5);
  const size = mjDir(hi.clone().sub(lo)).map((x) => Math.abs(x) * S);
  const mass = Math.max(1, b.parts.length) * PART_MASS;
  const [a, bb, c] = size;
  const inertia = [(mass / 12) * (bb * bb + c * c), (mass / 12) * (a * a + c * c), (mass / 12) * (a * a + bb * bb)];
  return { center, mass, inertia };
});

// ---------------------------------------------------------------------------
// The spanning tree. Each body's link to its parent: the joint, and whether the child is the
// joint's bodyB (so the joint's sense as written is the joint's own).
type Dof = { name: string; type: 'hinge' | 'slide' | 'ball'; point: Vector3; axis: Vector3 };
const parent: number[] = mech.bodies.map(() => -1);
const treeJoint: number[] = mech.bodies.map(() => -1);
const childIsB: boolean[] = mech.bodies.map(() => true);
const treeCoupling: number[] = mech.bodies.map(() => -1); // a universal joint as the link instead
const reached = new Set<number>([0]);
const inTree = new Set<number>();
const couplingInTree = new Set<number>();
const adj: number[][] = mech.bodies.map(() => []);
mech.joints.forEach((j, k) => {
  adj[j.bodyA].push(k);
  adj[j.bodyB].push(k);
});
// The joints a tie is written over (below): a gear's axle, a rack's or a piston's slide, a screw's
// input, a chain wheel's axle. A tie is a linear sum over the joints between its two ends in the
// tree, so it is right as they move only if those are the parts' own joints; so the tree takes
// those first, then other joints, then balls, then universal joints (a shaft may hang on nothing
// but the universal joints at its ends). Otherwise breadth first.
const along = (k: number, axis: Vector3) => {
  const j = mech.joints[k];
  const d = j.to.clone().sub(j.from);
  return d.lengthSq() > 1e-12 && Math.abs(d.normalize().dot(axis.clone().normalize())) > 0.99;
};
const tieJoints = new Set<number>();
const ownJoints = (body: number, axis: Vector3, kind: 'revolute' | 'slide') => adj[body].filter((k) => mech.joints[k].kind === kind && along(k, axis)).forEach((k) => tieJoints.add(k));
for (const g of mech.gears) ownJoints(g.body, g.axis, g.face ? 'slide' : 'revolute');
for (const sc of mech.screws) ownJoints(sc.input, sc.axis, 'revolute'), ownJoints(sc.piston, sc.axis, 'slide');
for (const l of mech.loops) for (const w of l.wheels) if (w.joint >= 0) tieJoints.add(w.joint);
type Edge = { joint: number; coupling: number; from: number };
const buckets: Edge[][] = [[], [], [], []];
const classOf = (e: Edge) => (e.coupling >= 0 ? 3 : mech.joints[e.joint].kind === 'ball' ? 2 : tieJoints.has(e.joint) ? 0 : 1);
const couplingsOf: number[][] = mech.bodies.map(() => []);
mech.couplings.forEach((c, k) => {
  couplingsOf[c.bodyA].push(k);
  couplingsOf[c.bodyB].push(k);
});
const pushEdges = (b: number) => {
  for (const k of adj[b]) buckets[classOf({ joint: k, coupling: -1, from: b })].push({ joint: k, coupling: -1, from: b });
  for (const k of couplingsOf[b]) buckets[3].push({ joint: -1, coupling: k, from: b });
};
pushEdges(0);
for (;;) {
  const bucket = buckets.find((q) => q.length);
  if (!bucket) break;
  const e = bucket.shift()!;
  if (e.coupling >= 0) {
    const c = mech.couplings[e.coupling];
    const other = c.bodyA === e.from ? c.bodyB : c.bodyA;
    if (reached.has(other)) continue;
    reached.add(other);
    parent[other] = e.from;
    treeCoupling[other] = e.coupling;
    childIsB[other] = c.bodyB === other;
    couplingInTree.add(e.coupling);
    pushEdges(other);
    continue;
  }
  const j = mech.joints[e.joint];
  const other = j.bodyA === e.from ? j.bodyB : j.bodyA;
  if (reached.has(other)) continue;
  reached.add(other);
  parent[other] = e.from;
  treeJoint[other] = e.joint;
  childIsB[other] = j.bodyB === other;
  inTree.add(e.joint);
  pushEdges(other);
}
// Bodies nothing reaches (loose parts): fixed to the frame.
const loose = mech.bodies.map((_, b) => b).filter((b) => b !== 0 && !reached.has(b));
const tieCount = [tieJoints.size, [...tieJoints].filter((k) => inTree.has(k)).length];
for (const b of loose) parent[b] = 0;

// The degrees of freedom a mechanism joint gives, written with the child on the side given.
// Hinge and slide axes run from -> to, flipped when the child is bodyA (so the child's motion
// relative to its parent is positive along the axis as written).
const isFriction = (j: Joint) => j.stiff && !j.motor;
function dofsOf(k: number, childB: boolean, prefix = 'j'): Dof[] {
  const j = mech.joints[k];
  const dir = j.to.clone().sub(j.from);
  if (dir.lengthSq() < 1e-12) dir.set(0, -1, 0);
  dir.normalize();
  if (!childB) dir.negate();
  const name = `${prefix}${k}`;
  if (j.kind === 'ball') return [{ name, type: 'ball', point: j.from, axis: dir }];
  if (j.kind === 'revolute') return [{ name: (j.motor ? 'mo' : isFriction(j) ? 'fp' : '') + name, type: 'hinge', point: j.from, axis: dir }];
  const slide: Dof = { name: name + 's', type: 'slide', point: j.from, axis: dir };
  return j.turns ? [slide, { name: name + 'r', type: 'hinge', point: j.from, axis: dir }] : [slide];
}
// A universal joint's cross: a hinge across the parent's shaft, then one across the child's (and,
// where only their turning is tied, three slides first, so the ends needn't meet).
function crossDofs(k: number, childB: boolean): { free: Dof[]; h1: Dof; h2: Dof } {
  const c = mech.couplings[k];
  const a = (childB ? c.axisA : c.axisB).clone().normalize();
  const b = (childB ? c.axisB : c.axisA).clone().normalize();
  let h1 = a.clone().cross(b);
  if (h1.lengthSq() < 1e-6) h1 = a.clone().cross(Math.abs(a.x) < 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0));
  h1.normalize();
  const h2 = h1.clone().cross(b).normalize();
  const free: Dof[] = c.turningOnly ? [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)].map((ax, i) => ({ name: `u${k}t${i}`, type: 'slide', point: c.center, axis: ax })) : [];
  return { free, h1: { name: `u${k}a`, type: 'hinge', point: c.center, axis: h1 }, h2: { name: `u${k}b`, type: 'hinge', point: c.center, axis: h2 } };
}
const dofsOfBody: Dof[][] = mech.bodies.map((_, b) => {
  if (treeJoint[b] >= 0) return dofsOf(treeJoint[b], childIsB[b]);
  if (treeCoupling[b] >= 0) {
    const { free, h1, h2 } = crossDofs(treeCoupling[b], childIsB[b]);
    return [...free, h1, h2];
  }
  return [];
});

// The velocity of a point fixed in `body`, and the body's angular velocity, as linear in the
// tree's joint rates at the build: for each dof on the body's path to the root, its column. The
// free joint at the root and every dof the two ends share cancel when two such are subtracted.
type Cols = Map<string, { lin: Vector3; ang: Vector3; dof: Dof }>;
function columns(body: number, point: Vector3): Cols {
  const cols: Cols = new Map();
  for (let b = body; b > 0 && parent[b] >= 0; b = parent[b])
    for (const d of dofsOfBody[b]) {
      if (d.type === 'hinge') cols.set(d.name, { lin: d.axis.clone().cross(point.clone().sub(d.point)), ang: d.axis.clone(), dof: d });
      else if (d.type === 'slide') cols.set(d.name, { lin: d.axis.clone(), ang: new Vector3(), dof: d });
      // A ball: three turns about x, y and z, which must cancel (a tie can't hold a ball's turn).
      else
        [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)].forEach((ax, i) =>
          cols.set(`${d.name}#${i}`, { lin: ax.clone().cross(point.clone().sub(d.point)), ang: ax, dof: d }),
        );
    }
  return cols;
}
// A tie: sum over dofs of coef * rate = 0, from a row given as a linear map of each body's
// (lin, ang) columns. `terms`: [body, point, weight on lin (a vector), weight on ang (a vector)].
type Term = { body: number; point: Vector3; lin: Vector3; ang: Vector3 };
function tie(terms: Term[]): Map<string, number> | 'ball' {
  const coef = new Map<string, number>();
  for (const t of terms)
    for (const [name, c] of columns(t.body, t.point)) {
      const v = c.lin.dot(t.lin) + c.ang.dot(t.ang);
      // Slides: LDU per LDU; hinges: LDU per radian. In MuJoCo's units (metres), a slide's
      // coordinate is S times as large.
      coef.set(name, (coef.get(name) ?? 0) + (c.dof.type === 'slide' ? v / S : v));
    }
  for (const [n, v] of coef) if (Math.abs(v) < 1e-9) coef.delete(n);
  if ([...coef.keys()].some((n) => n.includes('#'))) return 'ball';
  return coef;
}

// ---------------------------------------------------------------------------
// The XML.
const xml: string[] = [];
const equality: string[] = [];
const tendons: string[] = [];
const counts = { tieJoints: 0, tieJointsInTree: 0, bodies: 0, ghosts: 0, treeJoints: 0, closures: 0, frictionHinges: 0, frictionInTree: 0, meshes: 0, meshesTied: 0, meshesLeftOut: [] as string[], couplings: 0, couplingsInTree: 0, loopTies: 0, screwTies: 0, jointEqualities: 0, tendonEqualities: 0, welds: 0, connects: 0, treads: 0, loose: loose.length };
const jointXml = (d: Dof, relTo: Vector3, mechJoint: Joint | null, range?: [number, number]) => {
  const pos = fmt(sub(mj(d.point), mj(relTo)));
  if (d.type === 'ball') return `<joint name="${d.name}" type="ball" pos="${pos}" damping="${DAMPING}"/>`;
  const friction = mechJoint && mechJoint.stiff && d.type === 'hinge' ? ` frictionloss="${FRICTION}"` : ` damping="${DAMPING}"`;
  const limit = range ? ` range="${fmt(range)}"` : '';
  return `<joint name="${d.name}" type="${d.type}" pos="${pos}" axis="${fmt(mjDir(d.axis))}"${friction}${limit}/>`;
};
const slideRange = (j: Joint, childB: boolean): [number, number] | undefined => {
  if (!j.range) return undefined;
  const [lo, hi] = j.range;
  return childB ? [lo * S, hi * S] : [-hi * S, -lo * S];
};
const inertial = (b: number) => `<inertial pos="0 0 0" mass="${fmt([boxes[b].mass])}" diaginertia="${fmt(boxes[b].inertia)}"/>`;
const ghostInertial = `<inertial pos="0 0 0" mass="${GHOST_MASS}" diaginertia="${GHOST_INERTIA} ${GHOST_INERTIA} ${GHOST_INERTIA}"/>`;
// Ghost bodies, by the body they hang in.
const ghostsIn: string[][] = mech.bodies.map(() => []);

// Joints that close a loop: a ghost hung in bodyA by the joint, welded to bodyB.
mech.joints.forEach((j, k) => {
  if (inTree.has(k)) return;
  if (!reached.has(j.bodyA) || !reached.has(j.bodyB)) return;
  counts.closures++;
  if (j.kind === 'ball') {
    equality.push(`<connect name="c${k}" body1="b${j.bodyA}" body2="b${j.bodyB}" anchor="${fmt(sub(mj(j.from), mj(boxes[j.bodyA].center)))}"/>`);
    counts.connects++;
    return;
  }
  const ds = dofsOf(k, true);
  const at = j.from;
  const lines = [`<body name="g${k}" pos="${fmt(sub(mj(at), mj(boxes[j.bodyA].center)))}">`, ghostInertial];
  for (const d of ds) lines.push(jointXml(d, at, j, d.type === 'slide' ? slideRange(j, true) : undefined));
  lines.push('</body>');
  ghostsIn[j.bodyA].push(lines.join(''));
  equality.push(`<weld name="w${k}" body1="g${k}" body2="b${j.bodyB}"/>`);
  counts.ghosts++;
  counts.welds++;
  if (isFriction(j)) counts.frictionHinges++;
});

// Universal joints: a ghost cross hung in bodyA on a hinge across its shaft, a second ghost on
// the cross on a hinge across the other shaft, welded to bodyB. Where only their turning is tied,
// the cross may also slide every way.
mech.couplings.forEach((c, k) => {
  counts.couplings++;
  if (couplingInTree.has(k) || !reached.has(c.bodyA) || !reached.has(c.bodyB)) return;
  const { free, h1, h2 } = crossDofs(k, true);
  const slides = free.map((d) => `<joint name="${d.name}" type="slide" axis="${fmt(mjDir(d.axis))}" damping="${DAMPING}"/>`).join('');
  ghostsIn[c.bodyA].push(
    `<body name="u${k}" pos="${fmt(sub(mj(c.center), mj(boxes[c.bodyA].center)))}">${ghostInertial}${slides}<joint name="${h1.name}" type="hinge" axis="${fmt(mjDir(h1.axis))}" damping="${DAMPING}"/>` +
      `<body name="u${k}b" pos="0 0 0">${ghostInertial}<joint name="${h2.name}" type="hinge" axis="${fmt(mjDir(h2.axis))}" damping="${DAMPING}"/></body></body>`,
  );
  equality.push(`<weld name="uw${k}" body1="u${k}b" body2="b${c.bodyB}"/>`);
  counts.ghosts += 2;
  counts.welds++;
});

// A tie between joint coordinates, as a joint equality (two joints) or a held fixed tendon.
function writeTie(name: string, coef: Map<string, number>) {
  const entries = [...coef.entries()];
  const big = Math.max(...entries.map(([, v]) => Math.abs(v)));
  if (entries.length === 2) {
    const [[n1, c1], [n2, c2]] = entries;
    equality.push(`<joint name="${name}" joint1="${n1}" joint2="${n2}" polycoef="0 ${fmt([-c2 / c1])} 0 0 0"/>`);
    counts.jointEqualities++;
  } else {
    tendons.push(`<fixed name="${name}">${entries.map(([n, v]) => `<joint joint="${n}" coef="${fmt([v / big])}"/>`).join('')}</fixed>`);
    equality.push(`<tendon name="${name}e" tendon1="${name}"/>`);
    counts.tendonEqualities++;
  }
}

// Gear meshes: where the teeth touch, both move at the same speed along the teeth's push.
const perpUnit = (v: Vector3, axis: Vector3) => v.clone().addScaledVector(axis, -v.dot(axis)).normalize();
mech.meshes.forEach((m, k) => {
  counts.meshes++;
  const A = mech.gears[m.gearA];
  const B = mech.gears[m.gearB];
  if (!reached.has(A.body) || !reached.has(B.body) || A.body === B.body) return void counts.meshesLeftOut.push(`${k} ${m.kind}: unreached or same body`);
  const aA = A.axis.clone().normalize();
  const aB = B.axis.clone().normalize();
  // Each gear's pitch point facing the other, and the way the teeth push there: both pitch points
  // move at the same speed along it, so the gears turn at their pitch radii's ratio, whatever
  // small gap LDraw's placing leaves between them.
  let cA: Vector3;
  let cB: Vector3;
  let n: Vector3;
  if (m.kind === 'worm') {
    // The gear's pitch point nearest the worm's axis; the push is along the worm's axis, leaning
    // with its thread.
    cB = B.center.clone().addScaledVector(perpUnit(A.center.clone().sub(B.center), aB), B.radius);
    const fromAxis = cB.clone().sub(A.center);
    const radial = perpUnit(fromAxis, aA);
    const r = fromAxis.clone().addScaledVector(aA, -fromAxis.dot(aA)).length() || A.radius || 1;
    const tangent = aA.clone().cross(radial);
    n = aA.clone().addScaledVector(tangent, -A.worm / (2 * Math.PI * r));
    cA = cB;
  } else if (m.kind === 'crown') {
    cB = B.center.clone().addScaledVector(aA, B.radius * Math.sign(A.center.clone().sub(B.center).dot(aA) || 1));
    n = aB.clone().cross(cB.clone().sub(B.center)).normalize();
    cA = A.center.clone().addScaledVector(perpUnit(cB.clone().sub(A.center), aA), A.radius);
  } else if (m.kind === 'rack') {
    // The pinion's pitch point facing the rack's teeth.
    const toward = B.face ? B.face.clone().negate() : B.center.clone().sub(A.center);
    cA = A.center.clone().addScaledVector(perpUnit(toward, aA), A.radius);
    n = aA.clone().cross(cA.clone().sub(A.center)).normalize();
    cB = cA;
  } else {
    cA = A.center.clone().addScaledVector(perpUnit(B.center.clone().sub(A.center), aA), A.radius);
    n = aA.clone().cross(cA.clone().sub(A.center)).normalize();
    cB = B.center.clone().addScaledVector(perpUnit(cA.clone().sub(B.center), aB), B.radius);
  }
  if (!Number.isFinite(n.x) || n.lengthSq() < 1e-9) return void counts.meshesLeftOut.push(`${k} ${m.kind}: no direction`);
  const t = tie([
    { body: A.body, point: cA, lin: n, ang: new Vector3() },
    { body: B.body, point: cB, lin: n.clone().negate(), ang: new Vector3() },
  ]);
  if (t === 'ball') return void counts.meshesLeftOut.push(`${k} ${m.kind}: a ball joint between the gears`);
  if (t.size === 0) return void counts.meshesLeftOut.push(`${k} ${m.kind}: no joint between the gears`);
  writeTie(`m${k}`, t);
  counts.meshesTied++;
});

// Universal joints tie positions only (the cross does the rest). Chains, tracks and belts: each
// wheel's rim moves at the loop's speed, relative to its mount, round its circle's axis.
mech.loops.forEach((loop, k) => {
  const wheels = loop.wheels.filter((w) => w.joint >= 0 && reached.has(w.body) && reached.has(w.mount));
  for (let i = 1; i < wheels.length; i++) {
    const rim = (w: (typeof wheels)[number], sign: number): Term[] => {
      const p = loop.path.points[w.point];
      const ang = p.axis.clone().normalize().multiplyScalar(sign * p.radius * p.turn);
      return [
        { body: w.body, point: p.center, lin: new Vector3(), ang },
        { body: w.mount, point: p.center, lin: new Vector3(), ang: ang.clone().negate() },
      ];
    };
    const t = tie([...rim(wheels[i - 1], 1), ...rim(wheels[i], -1)]);
    if (t !== 'ball' && t.size) {
      writeTie(`l${k}_${i}`, t);
      counts.loopTies++;
    }
  }
});

// Linear actuators: the piston slides `lead` along the axis for each turn of the input, relative
// to each other (a right-handed screw).
mech.screws.forEach((s, k) => {
  const a = s.axis.clone().normalize();
  const lead = s.lead / (2 * Math.PI);
  const t = tie([
    { body: s.piston, point: s.center, lin: a, ang: a.clone().multiplyScalar(-lead) },
    { body: s.input, point: s.center, lin: a.clone().negate(), ang: a.clone().multiplyScalar(lead) },
  ]);
  if (t !== 'ball' && t.size) {
    writeTie(`s${k}`, t);
    counts.screwTies++;
  }
});

// Wheels: a cylinder on each tread, the only thing that collides with the ground.
const treadsOf: string[][] = mech.bodies.map(() => []);
let lowest = Infinity;
mech.treads.forEach((t, k) => {
  if (!reached.has(t.body) && t.body !== 0) return;
  const axis = t.axis.clone().normalize();
  const half = Math.max(6, t.radius * 0.35);
  const c = mj(t.center);
  const up = mjDir(axis)[2];
  lowest = Math.min(lowest, c[2] - t.radius * S * Math.sqrt(Math.max(0, 1 - up * up)));
  const rel = sub(c, mj(boxes[t.body].center));
  const d = mjDir(axis).map((x) => x * half * S);
  treadsOf[t.body].push(`<geom name="t${k}" type="cylinder" size="${fmt([t.radius * S])}" fromto="${fmt(sub(rel, d))} ${fmt(rel.map((x, i) => x + d[i]))}" contype="0" conaffinity="1" condim="3" friction="1 0.005 0.0001" mass="0"/>`);
  counts.treads++;
});
if (!Number.isFinite(lowest)) lowest = Math.min(...boxes.map((b) => mj(b.center)[2]));

// The tree, written depth first.
const children: number[][] = mech.bodies.map(() => []);
mech.bodies.forEach((_, b) => {
  if (b !== 0 && parent[b] >= 0) children[parent[b]].push(b);
});
function writeBody(b: number, indent: string) {
  counts.bodies++;
  let rel = b === 0 ? mj(boxes[0].center) : sub(mj(boxes[b].center), mj(boxes[parent[b]].center));
  let close = '';
  if (treeCoupling[b] >= 0) {
    // The cross, a ghost in the parent, on its hinge; the body in the cross, on the other.
    const k = treeCoupling[b];
    const { free, h1, h2 } = crossDofs(k, childIsB[b]);
    const c = mech.couplings[k];
    xml.push(`${indent}<body name="u${k}" pos="${fmt(sub(mj(c.center), mj(boxes[parent[b]].center)))}">${ghostInertial}`);
    for (const d of [...free, h1]) xml.push(`${indent}  <joint name="${d.name}" type="${d.type}" axis="${fmt(mjDir(d.axis))}" damping="${DAMPING}"/>`);
    rel = sub(mj(boxes[b].center), mj(c.center));
    xml.push(`${indent}  <body name="b${b}" pos="${fmt(rel)}">`);
    xml.push(`${indent}    ${inertial(b)}`);
    xml.push(`${indent}    <joint name="${h2.name}" type="hinge" pos="${fmt(sub(mj(c.center), mj(boxes[b].center)))}" axis="${fmt(mjDir(h2.axis))}" damping="${DAMPING}"/>`);
    counts.treeJoints++;
    counts.couplingsInTree++;
    close = `${indent}</body>`;
    indent += '  ';
  } else {
    xml.push(`${indent}<body name="b${b}" pos="${fmt(rel)}">`);
    xml.push(`${indent}  ${inertial(b)}`);
  }
  if (b === 0) xml.push(`${indent}  <freejoint name="root"/>`);
  else if (treeJoint[b] >= 0) {
    const j = mech.joints[treeJoint[b]];
    for (const d of dofsOfBody[b]) xml.push(`${indent}  ${jointXml(d, boxes[b].center, j, d.type === 'slide' ? slideRange(j, childIsB[b]) : undefined)}`);
    counts.treeJoints++;
    if (isFriction(j)) counts.frictionHinges++, counts.frictionInTree++;
  }
  for (const g of treadsOf[b]) xml.push(`${indent}  ${g}`);
  for (const g of ghostsIn[b]) xml.push(`${indent}  ${g}`);
  for (const c of children[b]) writeBody(c, indent + '  ');
  xml.push(`${indent}</body>`);
  if (close) xml.push(close);
}
writeBody(0, '    ');
[counts.tieJoints, counts.tieJointsInTree] = tieCount;

const doc = `<mujoco model="${set.set}">
  <compiler angle="radian" autolimits="true" inertiafromgeom="false"/>
  <size memory="1G"/>
  <option timestep="0.0005" gravity="0 0 -9.81" integrator="implicitfast" solver="Newton" iterations="50" tolerance="1e-10"/>
  <default>
    <joint armature="${ARMATURE}" solreffriction="0.001 1" solimpfriction="0.99 0.999 0.0001"/>
    <equality solref="${SOLREF}" solimp="0.99 0.999 0.0001"/>
  </default>
  <worldbody>
    <light pos="0 0 2" dir="0 0 -1"/>
    <geom name="ground" type="plane" size="5 5 0.1" pos="0 0 ${fmt([lowest - 0.0002])}" contype="1" conaffinity="0" friction="1 0.005 0.0001"/>
${xml.join('\n')}
  </worldbody>
  <tendon>
${tendons.map((t) => '    ' + t).join('\n')}
  </tendon>
  <equality>
${equality.map((e) => '    ' + e).join('\n')}
  </equality>
</mujoco>
`;

// ---------------------------------------------------------------------------
// What the Python side needs: the body of each part a function names, the controls' axes, the
// stored rates, and the joints by kind.
const partRef = (ref: string) => Number(/^p(\d+)/.exec(ref)?.[1]);
const turnAxisOf = (body: number) => {
  // The joint the body turns on: its tree joint if a hinge, else any hinge it has.
  const ks = [treeJoint[body], ...adj[body]].filter((k) => k >= 0 && mech.joints[k].kind === 'revolute');
  if (!ks.length) return null;
  const j = mech.joints[ks[0]];
  return { joint: ks[0], point: mj(j.from), axis: mjDir(j.to.clone().sub(j.from).normalize()), other: j.bodyA === body ? j.bodyB : j.bodyA };
};
const refs = new Set<string>();
for (const fn of set.curated.functions) for (const r of [fn.control ?? [], fn.moves ?? [], fn.stays ?? []].flat()) refs.add(String(r).split(' against ')[0]);
const partInfo: Record<string, unknown> = {};
for (const r of refs) {
  const p = partRef(r);
  if (!Number.isFinite(p) || p >= parts.length) continue;
  const b = mech.bodyOf[p];
  partInfo[r] = { part: p, name: parts[p].name, body: `b${b}`, bodyIndex: b, turn: turnAxisOf(b), at: mj(origin(p)) };
}
const sidecar = {
  set: set.set,
  model: modelFile,
  frictionloss: FRICTION,
  counts: { ...counts, mechBodies: mech.bodies.length, mechJoints: mech.joints.length, revolute: mech.joints.filter((j) => j.kind === 'revolute').length, slide: mech.joints.filter((j) => j.kind === 'slide').length, ball: mech.joints.filter((j) => j.kind === 'ball').length, stiff: mech.joints.filter((j) => j.stiff).length, motor: mech.joints.filter((j) => j.motor).length, gears: mech.gears.length, meshKinds: count(mech.meshes.map((m) => m.kind)), couplingsAll: mech.couplings.length, turningOnly: mech.couplings.filter((c) => c.turningOnly).length, loops: mech.loops.length, strings: mech.strings.length, screws: mech.screws.length, rests: mech.rests.length, rails: mech.rails?.length ?? 0, riders: mech.riders?.length ?? 0, connections: count(mech.connections.map((c) => c.kind + (c.stiff ? ' stiff' : '') + (c.held ? ' held' : ''))) },
  frictionJoints: mech.joints.flatMap((j, k) => (isFriction(j) ? [k] : [])),
  couplings: mech.couplings.map((c) => ({ a: c.bodyA, b: c.bodyB, turningOnly: !!c.turningOnly, reached: reached.has(c.bodyA) && reached.has(c.bodyB) })),
  bodyOf: mech.bodyOf,
  joints: mech.joints.map((j, k) => ({ k, kind: j.kind, a: j.bodyA, b: j.bodyB, stiff: j.stiff, tree: inTree.has(k), axis: mjDir(j.to.clone().sub(j.from).normalize()), at: mj(j.from) })),
  partNames: parts.map((p) => p.name),
  bodyParts: Object.fromEntries(mech.bodies.map((b, i) => [`b${i}`, b.parts.length])),
  parts: partInfo,
  functions: set.curated.functions.map((fn: { control?: unknown; moves?: unknown; mechanisms?: unknown; together?: unknown }, i: number) => ({ index: i + 1, mechanisms: fn.mechanisms, control: fn.control, moves: fn.moves, together: fn.together, generated: set.generated?.functions?.[i] ? { result: set.generated.functions[i].result, rates: set.generated.functions[i].rates, expected: set.generated.functions[i].expected } : null })),
};
function count(xs: string[]) {
  const c: Record<string, number> = {};
  for (const x of xs) c[x] = (c[x] ?? 0) + 1;
  return c;
}
mkdirSync('mjcf-out', { recursive: true });
const base = `mjcf-out/${setName.replace(/-1$/, '')}`;
writeFileSync(`${base}.xml`, doc);
writeFileSync(`${base}.json`, JSON.stringify(sidecar, null, 1));
console.log(JSON.stringify(sidecar.counts));
console.log(`wrote ${base}.xml`);
