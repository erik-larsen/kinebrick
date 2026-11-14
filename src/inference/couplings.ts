// Couplings: joins that pass turning from one shaft to another, not hinges. Universal joints,
// grooved and nudged balls in wheel hubs, crank webs, and a planetary wheel hub's reduction.

import { Vector3 } from 'three';
import type { ConnectionTable } from '../connections.ts';
import { PlacedPart } from '../ldr.ts';
import type { Connection, Coupling, Joint } from '../mechanism.ts';
import { BALL_LINE, type WorldCylinder } from './shared.ts';

// A nudged ball (see groovedBalls) keeps its ball joint only where it's needed: where its shaft,
// or the part it sits in, has nothing else to hold it (a half shaft, a universal joint at its
// other end). Where both turn in bearings of their own, on axes through the ball (a drive shaft
// joined at an angle to another, as an official bucket wheel excavator's are), the joint would
// tie them a second way, which shafts built a hair out of line can't keep: they locked.
export function dropBallsInBearings(joints: Joint[], joined: { partA: number; partB: number; center: Vector3 }[], roles: string[], bodyOf: number[]) {
  const turnsThrough = (body: number, center: Vector3) =>
    joints.some((j) => {
      if (j.kind !== 'revolute' || (j.bodyA !== body && j.bodyB !== body)) return false;
      const dir = new Vector3().subVectors(j.to, j.from).normalize();
      const rel = new Vector3().subVectors(center, j.from);
      return rel.addScaledVector(dir, -rel.dot(dir)).length() < BALL_LINE;
    });
  for (const { partA, partB, center } of joined) {
    if (roles[partA] !== 'nudged ball') continue;
    const [a, b] = [bodyOf[partA], bodyOf[partB]];
    if (!turnsThrough(a, center) || !turnsThrough(b, center)) continue;
    const k = joints.findIndex((j) => j.kind === 'ball' && [j.bodyA, j.bodyB].includes(a) && [j.bodyA, j.bodyB].includes(b) && j.from.distanceTo(center) < BALL_LINE);
    if (k >= 0) joints.splice(k, 1);
  }
}

// A universal joint's centre is a cross whose two arms turn in the ends of two shafts. As two
// hinges, the cross would lock the joint solid if the model's shafts miss its middle by a
// fraction of an LDU, as built models do. What the joint does is pass turning from one shaft
// to the other, so that's what Kinebrick models: the cross is fixed to the first end, its
// other arm lets go of the second end, and the two shafts turn together (see Coupling).
// Replaces those connections in `connections` with a coupling (which only says the two ends
// are attached); returns the pairs of ends it couples.
export function universalJoints(parts: PlacedPart[], roles: string[], cyls: WorldCylinder[], connections: Connection[]) {
  const joined: { partA: number; partB: number; center: Vector3; axisA: Vector3; axisB: Vector3 }[] = [];
  const axisOfEnd = (end: number) => cyls.find((c) => c.part === end && c.secs.some((s) => s.shape === 'A'))?.dir.clone() ?? new Vector3(0, 0, 1);
  roles.forEach((role, cross) => {
    if (role !== 'universal joint') return;
    const arms = connections.filter((c) => c.kind === 'revolute' && (c.male === cross || c.female === cross));
    const ends = [...new Set(arms.map((c) => (c.male === cross ? c.female : c.male)))];
    if (ends.length !== 2) return;
    for (const c of arms) {
      const end = c.male === cross ? c.female : c.male;
      if (end === ends[0]) c.kind = 'rigid';
      else connections.splice(connections.indexOf(c), 1);
    }
    const center = new Vector3().setFromMatrixPosition(parts[cross].matrix);
    connections.push({ male: ends[0], female: ends[1], kind: 'coupling', from: center, to: center.clone() });
    joined.push({ partA: ends[0], partB: ends[1], center, axisA: axisOfEnd(ends[0]), axisB: axisOfEnd(ends[1]) });
  });
  return joined;
}

// A grooved ball (2907) on the end of a driveshaft, in a wheel hub's socket (2999's): ridges
// in the socket fit its grooves, so the hub turns with the shaft, at any angle the ball sits
// at (a constant velocity joint: steered wheels are driven through it). Like a universal
// joint, the ball's connection is replaced with a coupling at the ball's middle, between the
// shaft (the ball's axle hole's axis) and the hub (the axis of its holes through the socket: a
// socket, a sphere, has none of its own), tying only their turning (see Coupling): shaft and
// hub each turn in holes of their own.
//
// A nudged ball (32494) does the same in a portal axle's steering hub (92909), nudges on it
// fitting slots in the socket; but its shaft often hangs on nothing else (a half shaft, a
// universal joint at its other end), so its ball joint is kept as well, where it's needed
// (see dropBallsInBearings).
//
// A socket with no hole of its own through the ball's middle has no axis to turn on, and so
// nothing to couple: the ball turns in it freely, a plain ball joint. The 8mm constant velocity
// joint's ball (52731) is coupled in its own female (52730), whose axle runs through the
// ball's middle, but is plain in the planetary wheel hub's socket (46490c01), which turns with
// its steering upright: a coupling there would tie the half shaft to the upright.
export function groovedBalls(parts: PlacedPart[], roles: string[], cyls: WorldCylinder[], connections: Connection[]) {
  const joined: { partA: number; partB: number; center: Vector3; axisA: Vector3; axisB: Vector3 }[] = [];
  const axisOf = (part: number, shape: string) => cyls.find((c) => c.part === part && c.secs.some((s) => s.shape === shape))?.dir.clone() ?? new Vector3(0, 0, 1);
  // The hole whose axis passes nearest the ball's middle, within BALL_LINE (a model may set
  // the ball a little off it, as lineUpBalls allows).
  const through = (part: number, center: Vector3) => {
    let best: { dir: Vector3; off: number } | null = null;
    for (const c of cyls) {
      if (c.part !== part || c.secs.some((s) => s.shape === 'O')) continue;
      const rel = new Vector3().subVectors(center, c.start);
      const off = rel.addScaledVector(c.dir, -rel.dot(c.dir)).length();
      if (off < BALL_LINE && (!best || off < best.off)) best = { dir: c.dir, off };
    }
    return best ? best.dir.clone() : null;
  };
  for (const c of connections) {
    if (c.kind !== 'ball' || (roles[c.male] !== 'grooved ball' && roles[c.male] !== 'nudged ball')) continue;
    const axisB = through(c.female, c.from);
    if (!axisB) continue;
    if (roles[c.male] === 'grooved ball') c.kind = 'coupling';
    joined.push({ partA: c.male, partB: c.female, center: c.from.clone(), axisA: axisOf(c.male, 'A'), axisB });
  }
  return joined;
}

// A crankshaft built of webs on crank pins (the 8865 Test Car's: 24 tooth gears, joined by axles
// in their round holes), whose middle web is held only by two pins on opposite sides of the main
// axis, is at dead centre always: as the webs either side of it turn on the main axis, the pins
// don't tie their turning together, as in the real crankshaft they do. So those two turn together
// (a coupling, of their turning only). Only so: the middle web has no other joint, and the webs
// either side of it turn on the main axis in one body.
export function crankWebs(joints: Joint[]): Coupling[] {
  const LINE = 1; // LDU
  const dirOf = (j: Joint) => new Vector3().subVectors(j.to, j.from).normalize();
  const parallel = (a: Joint, b: Joint) => Math.abs(dirOf(a).dot(dirOf(b))) > 0.999;
  // How far a point is from a joint's axis.
  const offAxis = (j: Joint, p: Vector3) => {
    const off = new Vector3().subVectors(p, j.from);
    return off.addScaledVector(dirOf(j), -off.dot(dirOf(j))).length();
  };
  const middleOf = (j: Joint) => j.from.clone().add(j.to).multiplyScalar(0.5);
  const jointsOf = (body: number) => joints.filter((j) => j.bodyA === body || j.bodyB === body);
  const other = (j: Joint, body: number) => (j.bodyA === body ? j.bodyB : j.bodyA);
  const found: Coupling[] = [];
  const bodies = new Set(joints.flatMap((j) => [j.bodyA, j.bodyB]));
  for (const middle of bodies) {
    const pins = jointsOf(middle);
    if (middle === 0 || pins.length !== 2 || pins.some((j) => j.kind !== 'revolute') || !parallel(pins[0], pins[1])) continue;
    if (other(pins[0], middle) === other(pins[1], middle) || offAxis(pins[0], pins[1].from) < LINE) continue;
    // The main axis: midway between the two pins.
    const center = middleOf(pins[0]).add(middleOf(pins[1])).multiplyScalar(0.5);
    const d = dirOf(pins[0]);
    const off = new Vector3().subVectors(middleOf(pins[1]), middleOf(pins[0]));
    center.addScaledVector(d, -off.dot(d) / 2);
    // Each pin's web beside the middle one: on the pin, and turning on the main axis.
    const webs = pins.map((pin) => {
      const p = other(pin, middle);
      for (const onPin of jointsOf(p)) {
        const web = other(onPin, p);
        if (web === middle || onPin.kind !== 'revolute' || !parallel(onPin, pin) || offAxis(pin, onPin.from) > LINE) continue;
        const main = jointsOf(web).find((j) => j.kind === 'revolute' && parallel(j, pin) && offAxis(j, center) < LINE);
        if (main) return { web, main };
      }
      return null;
    });
    const [a, b] = webs;
    if (!a || !b || a.web === b.web || other(a.main, a.web) !== other(b.main, b.web)) continue;
    found.push({ bodyA: a.web, bodyB: b.web, center, axisA: dirOf(a.main), axisB: dirOf(b.main), atA: middleOf(a.main), atB: middleOf(b.main), turningOnly: true });
  }
  return found;
}

// The couplings of the universal joints and balls `joined` found, as Couplings between bodies.
// A nudged ball's coupling is at its ball joint's middle, where lineUpBalls has put it.
export function findCouplings(joined: { partA: number; partB: number; center: Vector3; axisA: Vector3; axisB: Vector3 }[], joints: Joint[], parts: PlacedPart[], roles: string[], bodyOf: number[]): Coupling[] {
  const at = (part: number) => new Vector3().setFromMatrixPosition(parts[part].matrix);
  const ballAt = (partA: number, partB: number, center: Vector3) => joints.find((j) => j.kind === 'ball' && [j.bodyA, j.bodyB].includes(bodyOf[partA]) && [j.bodyA, j.bodyB].includes(bodyOf[partB]) && j.from.distanceTo(center) < BALL_LINE)?.from.clone() ?? center;
  return joined.map(({ partA, partB, center, axisA, axisB }) => ({ bodyA: bodyOf[partA], bodyB: bodyOf[partB], center: roles[partA] === 'nudged ball' ? ballAt(partA, partB, center) : center, axisA, axisB, atA: at(partA), atB: at(partB), turningOnly: roles[partA] === 'grooved ball' || roles[partA] === 'nudged ball' }));
}

// A reduction inside a part read as its pieces (see ConnectionTable.reductions): the planetary
// wheel hub 46490c01's driving shaft (u9477) turns its hub (46434) through gears the LDraw part
// doesn't draw, the hub turning `ratio` times slower and the same way round, both against the
// bearing body (46490c02) they turn in. Each driving shaft is matched with the hub and body of
// its own part: the body at the shaft's place, the hub on the body's axis nearest it. Only their
// turning is tied, each turning in the body on its own axis.
export function reductions(parts: PlacedPart[], table: ConnectionTable, bodyOf: number[], nameOf: (name: string) => string): Coupling[] {
  const found: Coupling[] = [];
  const at = (part: number) => new Vector3().setFromMatrixPosition(parts[part].matrix);
  for (const r of Object.values(table.reductions ?? {})) {
    const named = (name: string) => parts.flatMap((p, i) => (nameOf(p.name) === name ? [i] : []));
    const bodies = named(r.against);
    const hubs = named(r.to);
    for (const from of named(r.from)) {
      const against = bodies.find((b) => at(b).distanceTo(at(from)) < 1);
      if (against === undefined) continue;
      const axis = new Vector3().setFromMatrixColumn(parts[against].matrix, 2).normalize();
      const offAxis = (p: number) => {
        const off = at(p).sub(at(against));
        return off.addScaledVector(axis, -off.dot(axis)).length();
      };
      const to = hubs.filter((h) => offAxis(h) < 1).sort((a, b) => at(a).distanceTo(at(from)) - at(b).distanceTo(at(from)))[0];
      if (to === undefined || at(to).distanceTo(at(from)) > 60) continue;
      const center = at(from).add(at(to)).multiplyScalar(0.5);
      found.push({ bodyA: bodyOf[from], bodyB: bodyOf[to], center, axisA: axis.clone(), axisB: axis.clone(), atA: at(from), atB: at(to), turningOnly: true, ratio: r.ratio });
    }
  }
  return found;
}
