// Chains, tracks and rubber bands looped round wheels, and moving paths with their parts.

import { Matrix4, Vector3 } from 'three';
import { ConnectionTable } from '../connections.ts';
import { PathPoint, PlacedPart, PlacedPath } from '../ldr.ts';
import { type Joint, libraryName, type Loop, type LoopWheel } from '../mechanism.ts';
import { AXIS_TOLERANCE } from './shared.ts';

// How far the middle of a circle a chain placed link by link goes round may be from its wheel's
// axis, in LDU (see findLoops): a chain sits on its gear's teeth, so the middle of its circle can
// be off the gear's axis by no more than a tooth's whole depth, or its links wouldn't be on the
// teeth at all. LEGO's gears have a module of 1 mm, 2.5 LDU (an 8 tooth gear's pitch radius is
// 10 LDU, 8 x 2.5 / 2), and a tooth's whole depth is 2.25 modules: 5.6 LDU. The 8835 Forklift's
// chain is 0.7 LDU off its sprockets, the 9392 Quad Bike's 2.2 and 3.0 off its two 16 tooth gears.
const MODULE = 2.5;
const CHAIN_REACH = 2.25 * MODULE;

// A track's sprockets, measured from their LDraw shapes (every edge of every polygon, about the
// part's axle, z): how many teeth they have and how deep a tooth is, from its tip to the root
// between two teeth. 57519 (Technic Sprocket Wheel 40.4): 10 teeth, tips 51.0 LDU out, roots 44.5,
// 6.6 deep. 57520 (25.4): 6 teeth, 32.0 and 26.1, 5.9 deep. 32007 (Tread Sprocket Wheel): 10
// teeth, 30.0 and 26.8, 3.2 deep. A track's pins sit between the teeth, on the circle where a
// pitch (see PlacedPath's pitch) spans one tooth: of radius pitch / (2 sin(180 / teeth)), 48.5 for
// the 57519 and 30.0 for the 57520 with the 5 wide links (pitch 30), 25.9 for the 32007 with the
// 3873 (pitch 16), each between the roots and the tips.
export const SPROCKETS: Record<string, { teeth: number; depth: number }> = {
  '57519.dat': { teeth: 10, depth: 6.6 },
  '57520.dat': { teeth: 6, depth: 5.9 },
  '32007.dat': { teeth: 10, depth: 3.2 },
};
// The chains, tracks and rubber bands looped round wheels: each looped path, with the wheels
// it goes round. A circle of the path is on a wheel if a turning joint's axis runs along the
// circle's axis, through its middle (within AXIS_TOLERANCE); of the joint's two bodies, the
// wheel is the one with a part nearest the circle's middle (a 40 tooth gear a track runs
// round, say), and the other is what it turns in. A circle on nothing that turns (a peg a
// rubber band is hooked round) is left out: the band slides round it. A chain placed link by
// link (see PlacedPath's byHand) is only roughly round its wheels: each of its circles is on the
// wheel whose axis is within CHAIN_REACH of its middle, and is moved onto that axis. A track
// placed link by link is on its sprockets (see SPROCKETS): its pins sit on a sprocket's pin
// circle within a tooth's depth, but the circle that best fits its links takes in the links
// running on and off the sprocket too, and where few links wrap a sprocket it comes out larger
// (the 42069 Extreme Adventure's, 56 LDU round a sprocket whose pins are at 48.5, its middle 7.1
// off the axle). So a circle of a track is on a sprocket whose axle is within the difference of
// the two radii and a tooth's depth of its middle, and under it: within its links' half width
// (see PlacedPath's halfWidth) of its middle along the axle, as a gear a track runs on is (two
// gears side by side on one pin under the 42021 Excavator's).
export function findLoops(parts: PlacedPart[], roles: string[], bodyOf: number[], joints: Joint[], table: ConnectionTable, paths: PlacedPath[]): Loop[] {
  return paths
    .filter((path) => path.looped)
    .map((path) => {
      // The sprockets a circle of a track placed by hand may be on, and how far from its middle
      // each one's axle may be.
      const sprockets = (point: PathPoint) =>
        !path.byHand || !path.pitch
          ? []
          : parts.flatMap((p, i) => {
              const s = SPROCKETS[libraryName(p.name, table)];
              if (!s) return [];
              const axis = new Vector3(0, 0, 1).transformDirection(p.matrix);
              if (Math.abs(Math.abs(axis.dot(point.axis)) - 1) > 0.01) return [];
              const offset = new Vector3().setFromMatrixPosition(p.matrix).sub(point.center);
              const along = offset.dot(point.axis);
              const reach = Math.abs(point.radius - path.pitch! / (2 * Math.sin(Math.PI / s.teeth))) + s.depth;
              if (Math.abs(along) > (path.halfWidth ?? 0) || offset.addScaledVector(point.axis, -along).length() > reach) return [];
              return [{ part: i, reach }];
            });
      // A chain placed link by link runs on toothed wheels: a circle of it is on a wheel only if
      // that wheel has a gear within the circle, in its plane, not on whatever turns near there
      // (the 9392 Quad Bike's chain bends round its swinging arm's pivot, which it doesn't turn),
      // or a sprocket a track's circle may be on.
      // (Only such a wheel is looked for: where two gears turn side by side on one pin, the pin
      // is nearest the circle's middle, and the 42021 Excavator's track runs on the gears.)
      const toothed = (body: number, point: PathPoint) => {
        return (
          sprockets(point).some((s) => bodyOf[s.part] === body) ||
          parts.some((p, i) => {
            if (bodyOf[i] !== body || roles[i] !== 'gear') return false;
            const offset = new Vector3().setFromMatrixPosition(p.matrix).sub(point.center);
            return Math.abs(offset.dot(point.axis)) <= (path.halfWidth ?? CHAIN_REACH) && offset.addScaledVector(point.axis, -offset.dot(point.axis)).length() <= CHAIN_REACH;
          })
        );
      };
      const reach = (point: PathPoint) => (path.byHand ? Math.max(CHAIN_REACH, ...sprockets(point).map((s) => s.reach)) : AXIS_TOLERANCE);
      const wheels = path.points.flatMap((point, index) => findWheel(point, index, parts, roles, bodyOf, joints, reach(point), path.byHand ? (body) => toothed(body, point) : undefined) ?? []);
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
export function findWheel(point: PathPoint, index: number, parts: PlacedPart[], roles: string[], bodyOf: number[], joints: Joint[], reach = AXIS_TOLERANCE, accept?: (body: number) => boolean): LoopWheel | null {
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
      if (roles[i] === 'path' || (bodyOf[i] !== joint.bodyA && bodyOf[i] !== joint.bodyB) || (accept && !accept(bodyOf[i]))) return;
      const offset = new Vector3().setFromMatrixPosition(part.matrix).sub(point.center);
      const distance = Math.abs(offset.dot(point.axis));
      if (offset.addScaledVector(point.axis, -offset.dot(point.axis)).length() > point.radius || distance >= bestDistance) return;
      bestDistance = distance;
      const mount = bodyOf[i] === joint.bodyA ? joint.bodyB : joint.bodyA;
      best = { body: bodyOf[i], joint: j, mount, point: index };
    });
  });
  if (!best) return null;
  const wheel: LoopWheel = best;
  const steps = stepsFromFrame(joints);
  // A wheel turns in its mount, the nearer the frame of the two: where the part nearest the middle
  // is in the nearer (an axle fixed in the frame, a roller turning on it either side of the
  // middle), the roller is the wheel. Read the other way, the 42100 Liebherr's top rollers (bevel
  // gears on an axle fixed in the undercarriage) had the undercarriage, 1,084 parts, as their
  // wheel, so its tipping drove the tracks.
  if ((steps[wheel.mount] ?? Infinity) > (steps[wheel.body] ?? Infinity)) [wheel.body, wheel.mount] = [wheel.mount, wheel.body];
  // Of the joints it turns on along the circle's axis, the one in what's nearest the frame:
  // a gearbox's output shaft turns in the frame, and in the clutch gears freewheeling on it,
  // and it's how it turns in the frame that drives the chain.
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
