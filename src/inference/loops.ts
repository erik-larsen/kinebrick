// Chains, tracks and rubber bands looped round wheels, and moving paths with their parts.

import { Matrix4, Vector3 } from 'three';
import { ConnectionTable } from '../connections.ts';
import { PathPoint, PlacedPart, PlacedPath } from '../ldr.ts';
import { type Joint, libraryName, type Loop, type LoopWheel } from '../mechanism.ts';
import { AXIS_TOLERANCE } from './shared.ts';

// How far the middle of a circle a chain placed link by link goes round may be from its wheel's
// axis, in LDU (see findLoops): the 8835 Forklift's chain is 0.7 LDU off its sprockets.
const CHAIN_REACH = 2;

// The chains, tracks and rubber bands looped round wheels: each looped path, with the wheels
// it goes round. A circle of the path is on a wheel if a turning joint's axis runs along the
// circle's axis, through its middle (within AXIS_TOLERANCE); of the joint's two bodies, the
// wheel is the one with a part nearest the circle's middle (a 40 tooth gear a track runs
// round, say), and the other is what it turns in. A circle on nothing that turns (a peg a
// rubber band is hooked round) is left out: the band slides round it. A chain placed link by
// link (see PlacedPath's byHand) is only roughly round its wheels: each of its circles is on the
// wheel whose axis is within CHAIN_REACH of its middle, and is moved onto that axis.
export function findLoops(parts: PlacedPart[], roles: string[], bodyOf: number[], joints: Joint[], table: ConnectionTable, paths: PlacedPath[]): Loop[] {
  return paths
    .filter((path) => path.looped)
    .map((path) => {
      const wheels = path.points.flatMap((point, index) => findWheel(point, index, parts, roles, bodyOf, joints, path.byHand ? CHAIN_REACH : AXIS_TOLERANCE) ?? []);
      if (path.byHand) {
        for (const w of wheels) {
          const { from, to } = joints[w.joint];
          const d = new Vector3().subVectors(to, from).normalize();
          const point = path.points[w.point];
          point.center = from.clone().addScaledVector(d, new Vector3().subVectors(point.center, from).dot(d));
        }
      }
      const links = parts.flatMap((p, i) => (p.path === path ? [i] : []));
      const carriers = path.points.map((point, index) => wheels.find((w) => w.point === index)?.body ?? bodyOf[nearestPart(point.center, parts, roles)]);
      return { path, wheels, links, depth: table.tracks?.[libraryName(path.skin, table)]?.depth ?? null, carriers };
    });
}

// The part nearest a point (not a path's link), by where the part is placed, or -1 if none.
function nearestPart(point: Vector3, parts: PlacedPart[], roles: string[]): number {
  let best = -1;
  let bestDistance = Infinity;
  parts.forEach((part, i) => {
    if (roles[i] === 'path') return;
    const distance = new Vector3().setFromMatrixPosition(part.matrix).distanceTo(point);
    if (distance < bestDistance) [best, bestDistance] = [i, distance];
  });
  return best;
}

// The wheel a path's circle is on, if any (see findLoops): the body turning on a joint whose
// axis runs along the circle's, through its middle, with a part on that axis (within the
// circle's radius of it) nearest the middle along it. (A drum is often just an axle, its
// middle well along from where the string is wound.)
export function findWheel(point: PathPoint, index: number, parts: PlacedPart[], roles: string[], bodyOf: number[], joints: Joint[], reach = AXIS_TOLERANCE): LoopWheel | null {
  if (!point.circle) return null;
  let best: LoopWheel | null = null;
  let bestDistance = Infinity;
  joints.forEach((joint, j) => {
    if (joint.kind !== 'revolute') return;
    const d = new Vector3().subVectors(joint.to, joint.from).normalize();
    if (Math.abs(Math.abs(d.dot(point.axis)) - 1) > 0.01) return;
    const off = new Vector3().subVectors(point.center, joint.from);
    if (off.addScaledVector(d, -off.dot(d)).length() > reach) return;
    parts.forEach((part, i) => {
      if (roles[i] === 'path' || (bodyOf[i] !== joint.bodyA && bodyOf[i] !== joint.bodyB)) return;
      const offset = new Vector3().setFromMatrixPosition(part.matrix).sub(point.center);
      const distance = Math.abs(offset.dot(point.axis));
      if (offset.addScaledVector(point.axis, -offset.dot(point.axis)).length() > point.radius || distance >= bestDistance) return;
      bestDistance = distance;
      const mount = bodyOf[i] === joint.bodyA ? joint.bodyB : joint.bodyA;
      best = { body: bodyOf[i], joint: j, mount, point: index };
    });
  });
  if (!best) return null;
  // Of the joints it turns on along the circle's axis, the one in what's nearest the frame:
  // a gearbox's output shaft turns in the frame, and in the clutch gears freewheeling on it,
  // and it's how it turns in the frame that drives the chain.
  const wheel: LoopWheel = best;
  const steps = stepsFromFrame(joints);
  joints.forEach((joint, j) => {
    if (joint.kind !== 'revolute' || (joint.bodyA !== wheel.body && joint.bodyB !== wheel.body)) return;
    const d = new Vector3().subVectors(joint.to, joint.from).normalize();
    if (Math.abs(Math.abs(d.dot(point.axis)) - 1) > 0.01) return;
    const off = new Vector3().subVectors(point.center, joint.from);
    if (off.addScaledVector(d, -off.dot(d)).length() > reach) return;
    const mount = joint.bodyA === wheel.body ? joint.bodyB : joint.bodyA;
    if (steps[mount] < steps[wheel.mount]) [wheel.joint, wheel.mount] = [j, mount];
  });
  return wheel;
}

// How many joints away from the frame (body 0) each body is.
export function stepsFromFrame(joints: Joint[]): number[] {
  const steps: number[] = [0];
  const queue = [0];
  while (queue.length) {
    const body = queue.shift()!;
    for (const j of joints) {
      const other = j.bodyA === body ? j.bodyB : j.bodyB === body ? j.bodyA : -1;
      if (other >= 0 && steps[other] === undefined) {
        steps[other] = steps[body] + 1;
        queue.push(other);
      }
    }
  }
  return steps.map((s) => s ?? Infinity);
}

// Moves each point of each path (a string, chain or rubber band) with the part nearest it (not
// one of the path's own links), each part moved by its body's pose: so a mechanism worked out
// afresh from where everything now is (see meshesChanged) finds them where the parts they run
// round now are, not where the model file drew them (the 855 Mobile Crane's string, its boom
// extended). In place, so the shapes LDCad drew each path with still match it.
export function movePaths(paths: PlacedPath[], parts: PlacedPart[], bodyOf: number[], poses: Matrix4[]) {
  const at = parts.map((p) => new Vector3().setFromMatrixPosition(p.matrix));
  const moved = paths.map((path) =>
    path.points.map((point) => {
      const near = parts.reduce((best, part, i) => (!part.path && (best < 0 || at[i].distanceTo(point.center) < at[best].distanceTo(point.center)) ? i : best), -1);
      const pose = near < 0 ? new Matrix4() : poses[bodyOf[near]];
      return { center: point.center.clone().applyMatrix4(pose), axis: point.axis.clone().transformDirection(pose) };
    }),
  );
  paths.forEach((path, i) => path.points.forEach((point, k) => Object.assign(point, moved[i][k])));
}
