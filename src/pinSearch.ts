// Which friction pins to free so that a part a drag holds can move: the viewer's answer (see
// pinWorker.ts), in a function of its own so that a test can ask it as the viewer does.

import { motorOutput, pinsToFree, type Mechanism } from './mechanism.ts';
import { freeWithEveryPin, heldPins, pinsByTrial } from './inference/friction.ts';
import { Kinematics } from './kinematics.ts';
import { Vector3 } from 'three';

// Whether `part` can move in `mech`: it isn't part of a frame, and the joint it turns on has a
// motion, exact or, as a drag holds it, on play (see Kinematics.dragMoves); a part a drag would
// push, by the point `at` (on it as built), unless its hinge is stuck there (see
// Kinematics.hingeStuck). With the model lifted off the ground if `lifted` (as the function, or the
// viewer's option, has it). A motor is taken by its output, as pinsToFree takes it.
export function canMove(mech: Mechanism, part: number, at: Vector3, lifted = false): boolean {
  const kin = new Kinematics(mech, { lifted });
  const body = mech.roles[part] === 'motor' ? motorOutput(mech, part) : mech.bodyOf[part];
  const link = kin.parentLink(body);
  if (kin.frames.includes(body) || !link || kin.hingeStuck(body, [at])) return false;
  return kin.jointMotion(link.joint, false) !== null || kin.dragMoves(body, true);
}

// The pins to free, besides `freed`, so that `part` can move, grabbed at `at` (on it as built): those pinsToFree names in `allFree`
// (the model built with every friction pin free), or where they don't let it move, and `search`
// says so, those the trial search finds (see pinsByTrial) in the model as read. `build` builds
// the model as read with a set of pins freed. None if freeing pins wouldn't let it move, or if the
// part sits in the frame even with every pin free (see freeWithEveryPin).
export function pinsForDrag(build: (freed: Set<number>) => Mechanism, allFree: Mechanism, part: number, at: Vector3, freed: Set<number>, search: boolean, lifted = false): number[] {
  if (!freeWithEveryPin(allFree, part)) return [];
  const pins = pinsToFree(allFree, part).filter((p) => !freed.has(p));
  if (!search || (pins.length && canMove(build(new Set([...freed, ...pins])), part, at, lifted))) return pins;
  return pinsByTrial(heldPins(build(freed), part, freed), (more) => canMove(build(new Set([...freed, ...more])), part, at, lifted));
}
