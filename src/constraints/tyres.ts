// Tyres and tracks on the ground.

import { Vector3 } from 'three';
import type { Kinematics } from '../kinematics.ts';
import { BodyRow, addPointVelocity, DOWN, type Equations } from './equations.ts';

export function tyres(solver: Kinematics, eq: Equations) {
  const { n, add, slip } = eq;
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
  const rolling = new Map<number, { axis: Vector3; rows: BodyRow[] }>(); // for each body, its tyres' rows
  const tracks = new Map<number, { axis: Vector3; rows: BodyRow[] }>(); // for each track, its sideways rows
  const riderBodies = new Set((solver.mech.riders ?? []).map((r) => r.body));
  // Whether a steered tyre pivots on the ground (see below): only for a drag that works the
  // steering (see dragSteers).
  const pivots = solver.contactTreads.length > 0 && solver.dragSteers();
  for (const i of solver.contactTreads) {
    const p = solver.contactPoint(i);
    if (!p) continue;
    const tread = solver.mech.treads[i];
    const pose = solver.poses[tread.body];
    const axis = tread.axis.clone().transformDirection(pose);
    const first = tread.track === undefined ? rolling.get(tread.body)?.axis : tracks.get(tread.track)?.axis;
    if (first && axis.dot(first) < 0) axis.negate();
    const forward = new Vector3().crossVectors(DOWN, axis).normalize();
    const sideways = new Vector3().crossVectors(forward, DOWN).normalize();
    const along = (point: Vector3, dir: Vector3) => {
      const row = new BodyRow(n);
      for (let k = 0; k < 3; k++) addPointVelocity(row, tread.body, point, k, dir.getComponent(k));
      return row;
    };
    // A steered tyre pivots on the ground about the upright axis its wheel steers on, as a parked
    // car's does, for a drag that works the steering: its contact, carried round that axis as part of the wheel, isn't counted as
    // scrubbing sideways or lifting (see steeringPivot). What the steering joint's turning moves
    // the contact by is taken out of those rows.
    const pivot = pivots ? solver.steeringPivot(i, p, forward) : null;
    const pivoting = (row: BodyRow, dir: Vector3) => {
      if (!pivot) return row;
      const j = solver.mech.joints[pivot.joint];
      const c = new Vector3().crossVectors(pivot.axis, p.clone().sub(pivot.at)).dot(dir);
      for (let k = 0; k < 3; k++) {
        row.sub(6 * j.bodyB + k, c * pivot.axis.getComponent(k));
        row.add(6 * j.bodyA + k, c * pivot.axis.getComponent(k));
      }
      return row;
    };
    if (!rolling.has(tread.body)) rolling.set(tread.body, { axis, rows: [] });
    // (A track rolls at its path's radius, nearer the axle than where it touches; see Tread.)
    const hub = solver.onAxis(tread.body, tread.center.clone().applyMatrix4(pose), axis);
    const rollAt = tread.rollRadius === undefined ? p : hub.clone().lerp(p, tread.rollRadius / tread.radius);
    // A train motor's wheels are part of it and can't turn: it slides along the rails.
    if (!tread.fixed) rolling.get(tread.body)!.rows.push(along(rollAt, forward));
    const onRails = riderBodies.has(tread.body);
    if (tread.track !== undefined) {
      if (!tracks.has(tread.track)) tracks.set(tread.track, { axis, rows: [] });
      tracks.get(tread.track)!.rows.push(along(p, sideways));
    }
    if (onRails) {
      // A train wheel neither lifts off its rail nor sinks into it, exactly; its flanges keep
      // it across the track (the riders' rows below, for the axle as a whole). Its gap, for
      // closing the loops: how far it stands off the rail head.
      add(along(p, DOWN), (solver.groundY ?? p.y) - p.y);
    } else if (slip) {
      if (tread.track === undefined) slip.sideways.push(pivoting(along(p, sideways), sideways));
      slip.travel.push(along(hub, forward));
      slip.lift.push(pivoting(along(p, DOWN), DOWN));
      const rise = new BodyRow(n);
      for (let k = 0; k < 3; k++) {
        addPointVelocity(rise, solver.frameOf[tread.body], hub, k, DOWN.getComponent(k));
        addPointVelocity(rise, tread.body, hub, k, -DOWN.getComponent(k));
      }
      slip.rise.push(rise);
    } else {
      add(pivoting(along(p, DOWN), DOWN));
    }
  }
  for (const { rows: tyres } of [...rolling.values(), ...tracks.values()]) {
    if (tyres.length === 0) continue;
    const average = new BodyRow(n);
    // Each row's places, in the rows' order (where a row has none, it added 0).
    for (const row of tyres) for (const [k, v] of row.entries()) average.add(k, v / tyres.length);
    add(average);
  }
}
