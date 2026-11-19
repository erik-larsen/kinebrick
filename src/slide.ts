// A part slid along its axle, as a function's first step asks (decision 206 of 2026-11-18; see
// slidesAsked): pushed along its slide by the viewer's own push steps (see pushStep) until it has
// gone as far as asked, or something stops it.

import { Vector3 } from 'three';
import type { Kinematics } from './kinematics.ts';
import type { Mechanism } from './mechanism.ts';
import { pointDirections, pushStep } from './push.ts';

// The model as it now is, read with the part asked to slide.
export interface SlideState {
  kin: Kinematics;
  mech: Mechanism;
  place: (part: number) => { position: Vector3; axes: Vector3[] }; // where a part now is, and its own axes (unit), in the model's coordinates
}

// The steps a push is made of, and the smaller ones it goes on with where a step is refused, to
// come as close as it can to where it stops.
const STEPS = [1, 0.5, 0.25, 0.1];

// How far `part` went along its slide (LDU), and what stopped it short, if anything: 'met' (two
// parts' shapes met: `allowed` said no where the slide itself would have gone on), 'stuck', or
// 'no slide' (the part has no slide asked for). The way is along the part's own axis that runs
// along the slide, `by`'s sign saying which. A slide ends where an axle leaves a hole (see
// slidesAsked): there the model is read afresh from where it now is (`reread`; `state` then gives
// it as it is), so that hole no longer holds it, and the push goes on.
export function slidePart(state: () => SlideState, reread: () => void, part: number, by: number, allowed: () => boolean): { went: number; halt: '' | 'met' | 'stuck' | 'no slide' } {
  let went = 0;
  let way: Vector3 | null = null;
  for (let reads = 0; reads < 20; reads++) {
    const { kin, mech, place } = state();
    const body = mech.bodyOf[part];
    const joint = mech.joints.find((j) => j.kind === 'slide' && j.asked && (j.bodyA === body || j.bodyB === body));
    if (!joint) return { went, halt: reads ? 'stuck' : 'no slide' };
    const other = joint.bodyA === body ? joint.bodyB : joint.bodyA;
    const axis = joint.to.clone().sub(joint.from).normalize().transformDirection(kin.poses[other]);
    if (!way) {
      // The part's own axis that runs along the slide, and the way `by` points along it.
      const own = place(part).axes;
      const k = own.reduce((best, v, i) => (Math.abs(v.dot(axis)) > Math.abs(own[best].dot(axis)) ? i : best), 0);
      way = axis.clone().multiplyScalar(Math.sign(own[k].dot(axis)) * Math.sign(by));
    }
    const dir = axis.clone().multiplyScalar(Math.sign(axis.dot(way)));
    // The part's own slides, and those of what turns with it (the 42078's tan pin, on its lock
    // bar), are let go while it is pushed: held where they are, as friction holds them (see
    // Joint.springHeld), they'd only slide where nothing else could go. Others' stay held.
    const bodies = new Set([body]);
    for (const j of mech.joints) {
      if (j.asked || (j.bodyA !== body && j.bodyB !== body)) continue;
      const next = j.bodyA === body ? j.bodyB : j.bodyA;
      if (mech.joints.some((k) => k.asked && (k.bodyA === next || k.bodyB === next))) bodies.add(next);
    }
    const own = mech.joints.filter((j) => j.asked && j.springHeld && (bodies.has(j.bodyA) || bodies.has(j.bodyB)));
    for (const j of own) j.springHeld = false;
    // The part's middle, on its body as built.
    const grab = place(part).position.clone().applyMatrix4(kin.poses[body].clone().invert());
    const now = () => grab.clone().applyMatrix4(kin.poses[body]);
    const directions = pointDirections(kin, body, now());
    if (directions > 0) kin.holdWhatTheDragDoesntNeed(body, () => pointDirections(kin, body, now()) === directions);
    // Pushes in steps, smaller ones where a step is refused; why the last was refused, if one was.
    let refused: 'stuck' | 'blocked' | null = null;
    for (const size of STEPS) {
      refused = null;
      while (went < Math.abs(by) - 1e-9) {
        const before = now();
        const how = pushStep(kin, body, grab, dir.clone(), Math.min(size, Math.abs(by) - went), allowed);
        if (how !== 'moved') {
          refused = how;
          break;
        }
        went += now().sub(before).dot(dir);
      }
      if (!refused || refused === 'stuck') break;
    }
    // Refused for the end of the slide, or for parts meeting: tried again with only the slide's
    // end to say no.
    const atEnd = refused === 'blocked' && endOfSlide(kin, body, grab, dir);
    kin.letGoAfterDrag();
    for (const j of own) j.springHeld = true;
    if (!refused) return { went, halt: '' };
    if (refused === 'stuck') return { went, halt: 'stuck' };
    if (!atEnd) return { went, halt: 'met' };
    reread();
  }
  return { went, halt: 'stuck' };
}

// Whether a push of the smallest step would go past the end of a slide.
function endOfSlide(kin: Kinematics, body: number, grab: Vector3, dir: Vector3): boolean {
  const before = kin.snapshot();
  const how = pushStep(kin, body, grab, dir.clone(), STEPS[STEPS.length - 1], () => kin.atLimit() === null);
  kin.restore(before);
  return how === 'blocked';
}
