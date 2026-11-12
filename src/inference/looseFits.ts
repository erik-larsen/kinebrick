// A second chance for parts that would be loose: fits found with looser tolerances, and parts
// pressed on an axle's tip.

import { Vector3 } from 'three';
import type { Connection } from '../mechanism.ts';
import { findConnections } from './fits.ts';
import { ANGLE_TOLERANCE, AXIS_TOLERANCE, findLooseParts, LOOSE_ALIGN_TOLERANCE, type WorldCylinder } from './shared.ts';
import { anchorsOf } from './trains.ts';

const LINKS = ['steering link', 'connecting rod'];

// Parts that would be loose get a second chance, fitting with the looser LOOSE_ALIGN_TOLERANCE:
// connections that join a loose part to anything, found as findConnections finds them. So do
// parts held to the rest only by slides and balls, which hold nothing in place: the 42039 and
// 42041's V8 connecting rods, tied by balls to pistons sliding in their cylinders, are built
// 1.005 LDU off their crank pins. But not a universal joint's cross, which keeps only the arms
// universalJoints left it. Such a steering link or connecting rod's balls fit with the looser
// LOOSE_BALL_TOLERANCE too. A pin's new joints turn as fixPins has its others do: a friction
// pin's stiffly.
export function looseFits(roles: string[], cyls: WorldCylinder[], connections: Connection[], frictionRigid: boolean): Connection[] {
  const count = Math.max(0, ...cyls.map((c) => c.part)) + 1;
  // Every group but the biggest gets the chance, a train's bogies among them (a layout's cars
  // are placed by hand, and a bogie's pin may sit a hair over 1 LDU from its hole).
  const loose = new Set(findLooseParts(count, connections.filter((c) => c.kind !== 'slide' && c.kind !== 'ball')));
  if (loose.size === 0) return [];
  const known = new Set(connections.map((c) => `${c.male},${c.female}`));
  const settled = (c: Connection) => roles[c.male] === 'universal joint' || roles[c.female] === 'universal joint';
  const links = new Set([...loose].filter((p) => LINKS.includes(roles[p])));
  const found = findConnections(cyls, frictionRigid, LOOSE_ALIGN_TOLERANCE, links).filter((c) => (loose.has(c.male) || loose.has(c.female)) && !known.has(`${c.male},${c.female}`) && !settled(c));
  for (const c of found) {
    if (c.kind !== 'revolute' || roles[c.male] !== 'friction pin') continue;
    if (frictionRigid) [c.kind, c.held] = ['rigid', true];
    else c.stiff = true;
  }
  return found;
}

// A part that would be loose, its axle hole lined up with an axle's tip and starting right there,
// is pushed on that axle: real parts give a little, so a builder may press a part on an axle
// already filled by others, where in LDraw it can only sit against its tip (the 858 Auto Engines'
// fans, two round plates pressed on an axle pin past the bush their rubber band runs in).
export function onAxleTips(roles: string[], cyls: WorldCylinder[], connections: Connection[]): Connection[] {
  const count = Math.max(0, ...cyls.map((c) => c.part)) + 1;
  const loose = new Set(findLooseParts(count, connections, anchorsOf(roles)));
  if (loose.size === 0) return [];
  const pushed: Connection[] = [];
  for (const axle of cyls.filter((c) => c.gender === 'M' && c.secs[c.secs.length - 1].shape === 'A')) {
    const tip = axle.start.clone().addScaledVector(axle.dir, axle.secs.reduce((sum, sec) => sum + sec.length, 0));
    for (const hole of cyls) {
      if (hole.gender !== 'F' || hole.part === axle.part || !loose.has(hole.part) || loose.has(axle.part)) continue;
      if (new Vector3().crossVectors(axle.dir, hole.dir).length() > ANGLE_TOLERANCE) continue;
      // Where each of the hole's sections starts and ends, along the axle from its tip.
      let at = new Vector3().subVectors(hole.start, tip).dot(axle.dir);
      const sideways = new Vector3().subVectors(hole.start, tip).addScaledVector(axle.dir, -at).length();
      if (sideways > LOOSE_ALIGN_TOLERANCE) continue;
      const way = Math.sign(hole.dir.dot(axle.dir));
      for (const sec of hole.secs) {
        const end = at + way * sec.length;
        if (sec.shape === 'A' && Math.abs(Math.min(at, end)) < AXIS_TOLERANCE) pushed.push({ male: axle.part, female: hole.part, kind: 'rigid', from: tip.clone(), to: tip.clone() });
        at = end;
      }
    }
  }
  return pushed;
}
