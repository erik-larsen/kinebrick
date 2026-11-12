// The equations each kind of connection writes (see Kinematics.buildEquations, and "Connections
// become equations" in ARCHITECTURE.md): one file for each kind in this folder, each a function
// that adds its rows, each with its gap and its weight. The helpers they share are here too.

import { Vector3 } from 'three';
import type { Kinematics, Slip } from '../kinematics.ts';
import type { Row } from '../linalg.ts';

// Where a kind of connection writes its rows.
export interface Equations {
  n: number; // a row's length: 6 numbers for each body (see Kinematics)
  gaps: boolean; // whether each row's gap is wanted, for closing the loops (see closeLoops): some take work to find
  skipTree: boolean; // the tree's joints left out, for solving in the tree's coordinates (see treeBasis), which keep them together anyway
  slip: Slip | null; // if given, gets the tyres' rows for scrubbing, travel, lift and rise, which then aren't equations (see freeMotions)
  // Adds a row, all equal to zero, with its gap: what its motion should be to close how far the
  // connection has come apart (0 for a connection that can't come apart); its weight: how much
  // it counts in closing the loops (1, or DRIVE_WEIGHT); and its play: how much it counts in
  // taking up play (see playMotion), 0 for a row that may not open.
  add(row: Row, gap?: number, weight?: number, play?: number): void;
}

// A kind of connection: adds its rows to the equations, where the bodies are now.
export type Connection = (solver: Kinematics, eq: Equations) => void;

// How much more a rule that passes turning on (a gear mesh, a universal joint, a chain) counts
// than any other in closing loops. These rules are about speeds, so nothing would ever undo a
// slip: where the rules can't all hold (a step past a dead point), a joint is left apart
// instead, which shows (see turnJoint).
export const DRIVE_WEIGHT = 1000;
// A stud, in LDU.
export const STUD = 20;

export const DOWN = new Vector3(0, 1, 0); // LDraw's y axis points down
export const UP = new Vector3(0, -1, 0);

export function axisOf(from: Vector3, to: Vector3): Vector3 {
  return new Vector3().subVectors(to, from).normalize();
}

// Two directions at right angles to `d` and to each other.
export function acrossDirections(d: Vector3): Vector3[] {
  const helper = Math.abs(d.x) < 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
  const a = new Vector3().crossVectors(d, helper).normalize();
  const b = new Vector3().crossVectors(d, a).normalize();
  return [a, b];
}

// Adds (sign ×) component k of a body's point velocity, v + ω × p, to an equation row.
export function addPointVelocity(row: Row, body: number, p: Vector3, k: number, sign: number) {
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
