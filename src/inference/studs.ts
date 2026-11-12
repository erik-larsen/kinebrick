// Parts held between studs: a plate on its edge between two rows, a round opening or a bush
// centred between four.

import { Vector3 } from 'three';
import { anchorsOf, type Connection } from '../mechanism.ts';
import { ALIGN_TOLERANCE, AXIS_TOLERANCE, findLooseParts, isAntiStud, isStud, type WorldCylinder } from './shared.ts';

// A part with a single round opening underneath (a 1x1 round brick's or plate's anti-stud,
// or the open end of an axle hole, as on a Technic connector) sitting centred between four
// studs grips them: its round end fits between them, a classic way to set a part half a stud
// off the grid (an official crane's outrigger legs stand so on their pads, and an official
// bulldozer's bucket is wedged so on the connectors that hold it). At any angle: the four
// studs point the way the opening does, at its level, each half a stud's diagonal (14.1 LDU)
// off its axis.
export function onFourStuds(cyls: WorldCylinder[]): Connection[] {
  const openings = cyls.filter((c) => c.gender === 'F' && c.caps === 'one' && c.secs.length === 1 && ['R', 'S', 'A'].includes(c.secs[0].shape) && Math.abs(c.secs[0].radius - 6) < AXIS_TOLERANCE);
  const perPart = new Map<number, number>();
  for (const a of openings) perPart.set(a.part, (perPart.get(a.part) ?? 0) + 1);
  const studs = cyls.filter((c) => c.gender === 'M' && isStud(c));
  const held: Connection[] = [];
  for (const a of openings) {
    if (perPart.get(a.part) !== 1) continue;
    for (const part of fourStudsAround(studs, a.start, a.dir, a.part)) held.push({ male: part, female: a.part, kind: 'stud', from: a.start.clone(), to: a.start.clone() });
  }
  return held;
}

// A Technic bush standing on end between four studs grips them too, as a 2 x 2 brick's tube does
// (the 858 Auto Engines' round caps stand so, each on an axle with a bush under it). Only a bush
// that would otherwise be loose: a bush on an axle that turns in a Technic plate's hole may sit
// between the plate's studs as well, and mustn't hold the axle still.
export function bushesOnFourStuds(roles: string[], cyls: WorldCylinder[], connections: Connection[]): Connection[] {
  const count = Math.max(0, ...cyls.map((c) => c.part)) + 1;
  const loose = new Set(findLooseParts(count, connections, anchorsOf(roles)));
  if (loose.size === 0) return [];
  const studs = cyls.filter((c) => c.gender === 'M' && isStud(c));
  const held: Connection[] = [];
  for (const bush of cyls.filter((c) => loose.has(c.part) && roles[c.part] === 'bush' && c.gender === 'F' && c.secs.some((s) => s.shape === 'A'))) {
    const length = bush.secs.reduce((sum, sec) => sum + sec.length, 0);
    // Either end, with the way into the bush from it.
    const ends: [Vector3, Vector3][] = [
      [bush.start, bush.dir],
      [bush.start.clone().addScaledVector(bush.dir, length), bush.dir.clone().negate()],
    ];
    for (const [end, inwards] of ends) {
      for (const part of fourStudsAround(studs, end, inwards, bush.part)) held.push({ male: part, female: bush.part, kind: 'stud', from: end.clone(), to: end.clone() });
    }
  }
  return held;
}

// The parts (other than `part`) with four studs round `at`: each pointing `dir`, its base at the
// level of `at`, half a stud's diagonal (14.1 LDU) off the line through it.
function fourStudsAround(studs: WorldCylinder[], at: Vector3, dir: Vector3, part: number): number[] {
  const around = studs.filter((st) => {
    if (st.part === part || st.dir.dot(dir) < 0.99) return false;
    const d = new Vector3().subVectors(st.start, at);
    const level = d.dot(dir);
    return Math.abs(level) < AXIS_TOLERANCE && Math.abs(d.addScaledVector(dir, -level).length() - 10 * Math.SQRT2) < ALIGN_TOLERANCE;
  });
  return [...new Set(around.map((st) => st.part))].filter((p) => around.filter((st) => st.part === p).length >= 4);
}

// A plate standing on its edge between two rows of studs is held there: a plate is 8 LDU thick,
// just the gap between neighbouring studs (an old trick, used on an official tractor's cab).
// Found from connection points alone: an upright plate's studs all point the same way across,
// its anti-studs lie 8 LDU behind them, and its bottom edge is half a stud below its lowest
// studs. It's held by a part whose studs stand on the surface that edge rests on, half a stud
// either side of the plate's middle.
export function platesOnEdge(cyls: WorldCylinder[]): Connection[] {
  const UP = new Vector3(0, -1, 0); // LDraw's y points down
  const isStudCyl = (c: WorldCylinder) => c.gender === 'M' && isStud(c);
  const byPart = new Map<number, WorldCylinder[]>();
  for (const c of cyls) byPart.set(c.part, [...(byPart.get(c.part) ?? []), c]);
  const upStuds = cyls.filter((c) => isStudCyl(c) && c.dir.dot(UP) > 0.99);
  const held: Connection[] = [];
  for (const [part, own] of byPart) {
    const studs = own.filter(isStudCyl);
    if (studs.length === 0) continue;
    const across = studs[0].dir;
    if (Math.abs(across.dot(UP)) > 0.1 || studs.some((st) => st.dir.dot(across) < 0.99)) continue; // not upright
    const antiStuds = own.filter((c) => c.gender === 'F' && isAntiStud(c));
    const face = studs[0].start.dot(across);
    if (!antiStuds.some((a) => Math.abs(face - a.start.dot(across) - 8) < AXIS_TOLERANCE)) continue; // not a plate
    const middle = face - 4;
    const edge = Math.max(...studs.map((st) => st.start.y)) + 10; // y points down
    const sideways = new Vector3().crossVectors(across, UP).normalize();
    const along = studs.map((st) => st.start.dot(sideways));
    const [lo, hi] = [Math.min(...along) - 10, Math.max(...along) + 10];
    const sides = new Map<number, Set<number>>();
    for (const st of upStuds) {
      if (st.part === part || Math.abs(st.start.y - edge) > AXIS_TOLERANCE) continue;
      const off = st.start.dot(across) - middle;
      const at = st.start.dot(sideways);
      if (Math.abs(Math.abs(off) - 10) > AXIS_TOLERANCE || at < lo || at > hi) continue;
      sides.set(st.part, (sides.get(st.part) ?? new Set()).add(Math.sign(off)));
    }
    for (const [other, signs] of sides) {
      if (signs.size < 2) continue; // studs on both sides grip it
      const at = studs[0].start.clone().addScaledVector(across, -4);
      held.push({ male: other, female: part, kind: 'stud', from: at, to: at.clone() });
    }
  }
  return held;
}
