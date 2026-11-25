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
// viewer's option, has it). A motor is taken by its output, as pinsToFree takes it. With `exact`,
// only an exact motion counts (see pinsForDrag).
export function canMove(mech: Mechanism, part: number, at: Vector3, lifted = false, exact = false): boolean {
  const kin = new Kinematics(mech, { lifted });
  const body = mech.roles[part] === 'motor' ? motorOutput(mech, part) : mech.bodyOf[part];
  const link = kin.parentLink(body);
  if (kin.frames.includes(body) || !link || kin.hingeStuck(body, [at])) return false;
  return kin.jointMotion(link.joint, false) !== null || kin.dragMoves(body, !exact);
}

// The pins to free, besides `freed`, so that `part` can move, grabbed at `at` (on it as built): those pinsToFree names in `allFree`
// (the model built with every friction pin free), or where they don't let it move, and `search`
// says so, those the trial search finds (see pinsByTrial) in the model as read. `build` builds
// the model as read with a set of pins freed. None if freeing pins wouldn't let it move, or if the
// part sits in the frame even with every pin free (see freeWithEveryPin).
// With `exact`, for a drag that went on play and stopped short (see the viewer's turnOwed), only
// pins that give it an exact motion count, tried as the others are, the trial search too if
// `search`: freeing pins after which it still moves only on play gains it nothing, and the drag
// keeps what it turned (the 8272 Snowmobile's ski arm, turned 0.28 rad on play, its shock near the
// end of its travel: each drag freed one more pin, went back to its start, and ended there).
export function pinsForDrag(build: (freed: Set<number>) => Mechanism, allFree: Mechanism, part: number, at: Vector3, freed: Set<number>, search: boolean, lifted = false, exact = false): number[] {
  if (!freeWithEveryPin(allFree, part)) return [];
  const pins = pinsToFree(allFree, part).filter((p) => !freed.has(p));
  if (!search && !exact) return pins;
  if (pins.length && canMove(build(new Set([...freed, ...pins])), part, at, lifted, exact)) return pins;
  if (!search) return [];
  return pinsByTrial(heldPins(build(freed), part, freed), (more) => canMove(build(new Set([...freed, ...more])), part, at, lifted, exact));
}

// The friction pins a press with Shift frees (decision 173 of 2026-11-17): those that hold `part`
// in its body as read (`read`), where that body comes apart with every friction pin free
// (`allFree`): pinsToFree's, from that build. The 42082 Rough Terrain Crane's cab door: friction
// pins fuse it to the cab, so a drag of it slews the whole superstructure; with every pin free it's
// a body of its own on its hinge, and its two hinge pins are named. With `why`, and no pins, what
// holds it instead: 'more' if it sits in the frame even with every pin free, or no pin would let it
// move (see freeWithEveryPin); 'joints' if nothing but its joints holds it in its body (the body is
// the same with every pin free). A motor is taken by its output, as pinsToFree takes it.
export function pinsForShift(read: Mechanism, allFree: Mechanism, part: number): { pins: number[]; why: 'more' | 'joints' | null } {
  if (!freeWithEveryPin(allFree, part)) return { pins: [], why: 'more' };
  if (!heldInBodyByPins(read, allFree, part)) return { pins: [], why: 'joints' };
  const pins = pinsToFree(allFree, part);
  return { pins, why: pins.length ? null : 'more' };
}

// Whether friction pins hold `part` in its body as read: some part of that body is on another body
// with every friction pin free (see pinsForShift).
export function heldInBodyByPins(read: Mechanism, allFree: Mechanism, part: number): boolean {
  const body = read.roles[part] === 'motor' ? motorOutput(read, part) : read.bodyOf[part];
  const free = allFree.roles[part] === 'motor' ? motorOutput(allFree, part) : allFree.bodyOf[part];
  return read.bodyOf.some((b, i) => b === body && allFree.bodyOf[i] !== free);
}
