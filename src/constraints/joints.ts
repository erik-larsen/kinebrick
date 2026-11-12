// Joints: a turning joint, a sliding joint and a ball joint.

import { Matrix4, Quaternion, Vector3 } from 'three';
import type { Joint } from '../mechanism.ts';
import type { Kinematics } from '../kinematics.ts';
import { addPointVelocity, acrossDirections, axisOf, STUD, type Equations } from './equations.ts';

export function joints(solver: Kinematics, eq: Equations) {
  const { n, add, gaps, skipTree } = eq;
  // Joints. Each row says how bodyA moves relative to bodyB in some way must be zero:
  //   revolute  the same at a point on the axis, and no turning about any direction across it
  //   slide     the same across the axis, and no turning at all (or, if it turns, none
  //             about any direction across it)
  //   ball      the same at the ball's centre
  solver.mech.joints.forEach((joint, index) => {
    if (skipTree && solver.inTree(index)) return;
    const poseA = solver.poses[joint.bodyA];
    const c = joint.from.clone().applyMatrix4(poseA);
    const d = joint.kind === 'ball' ? new Vector3(0, 1, 0) : axisOf(joint.from, joint.to).transformDirection(poseA);
    // How far the joint has come apart, if it's not in the tree (else it can't have).
    const closesLoop = !solver.inTree(index);
    const loose = gaps && closesLoop;
    const gap = loose ? joint.from.clone().applyMatrix4(solver.poses[joint.bodyB]).sub(c) : new Vector3();
    const twist = loose ? misalignment(solver, joint) : new Vector3();

    const pointRow = (dir: Vector3) => {
      const row = new Array(n).fill(0);
      for (let k = 0; k < 3; k++) {
        addPointVelocity(row, joint.bodyA, c, k, dir.getComponent(k));
        addPointVelocity(row, joint.bodyB, c, k, -dir.getComponent(k));
      }
      add(row, gap.dot(dir), 1, closesLoop ? 1 : 0);
    };
    const turnRow = (dir: Vector3) => {
      const row = new Array(n).fill(0);
      for (let k = 0; k < 3; k++) {
        row[6 * joint.bodyA + k] += dir.getComponent(k);
        row[6 * joint.bodyB + k] -= dir.getComponent(k);
      }
      add(row, -twist.dot(dir), 1, closesLoop ? STUD : 0);
    };
    const xyz = [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)];

    if (joint.kind === 'revolute' || joint.kind === 'ball') for (const dir of xyz) pointRow(dir);
    if (joint.kind === 'slide') for (const dir of acrossDirections(d)) pointRow(dir);
    if (joint.kind === 'revolute') for (const dir of acrossDirections(d)) turnRow(dir);
    if (joint.kind === 'slide') for (const dir of joint.turns ? acrossDirections(d) : xyz) turnRow(dir);
  });
}

// How far bodyA has turned out of line with bodyB at a joint, as a small turn (its axis is
// the direction, its length the angle in radians): for a revolute joint (or a slide joint
// that turns), how far its axis as carried by bodyA has tipped away from its axis as carried
// by bodyB; for a slide joint, which mustn't turn at all, bodyA's whole turn relative to bodyB.
function misalignment(solver: Kinematics, joint: Joint): Vector3 {
  const poseA = solver.poses[joint.bodyA];
  const poseB = solver.poses[joint.bodyB];
  if (joint.kind === 'revolute' || joint.turns) {
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
