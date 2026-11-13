// Bodies: the parts that move as one, and their names.

import { Vector3 } from 'three';
import { PlacedPart } from '../ldr.ts';
import type { Body, Connection } from '../mechanism.ts';
import { AXIS_TOLERANCE } from './shared.ts';

// Step 6: parts that are rigidly connected (an axle in an axle hole, a tyre on a rim) or
// attached by studs move as one body. The frame is the body with the most structure parts
// (bricks, plates, beams), and is numbered 0. Returns the body index of each part.
export function groupIntoBodies(count: number, roles: string[], connections: Connection[]): number[] {
  // Union-find: each part points towards a representative part of its group.
  const leader = Array.from({ length: count }, (_, i) => i);
  const find = (i: number): number => {
    while (leader[i] !== i) i = leader[i] = leader[leader[i]];
    return i;
  };
  for (const c of connections) {
    if (c.kind === 'rigid' || c.kind === 'stud') leader[find(c.male)] = find(c.female);
  }
  // Two groups joined on two different axes can't turn on either, so they're one body (a
  // part pinned on at two places). Repeat, since each merge can make more. Which groups end up
  // merged doesn't depend on the order (a merge only adds to what joins two groups), so each
  // round merges every pair of groups so joined, found by sorting the turning connections by the
  // groups they join: comparing every connection with every other after each merge took minutes
  // on a big model with its friction pins free (see pinsToFree).
  let merged = true;
  while (merged) {
    merged = false;
    const between = new Map<string, Connection[]>();
    for (const c of connections) {
      if (c.kind !== 'revolute') continue;
      const [g, h] = [find(c.male), find(c.female)];
      if (g === h) continue;
      const key = g < h ? `${g} ${h}` : `${h} ${g}`;
      if (!between.has(key)) between.set(key, []);
      between.get(key)!.push(c);
    }
    for (const joining of between.values()) {
      if (!joining.some((a) => joining.some((b) => b !== a && !coaxial(a, b)))) continue;
      const [g, h] = [find(joining[0].male), find(joining[0].female)];
      if (g === h) continue;
      leader[g] = h;
      merged = true;
    }
  }

  // The frame: the group with the most structure parts, or on a train layout the track, which
  // stays put while the trains run on it.
  const structureCount = new Map<number, number>();
  const layout = roles.includes('rail');
  for (let i = 0; i < count; i++) {
    if (roles[i] === (layout ? 'rail' : 'structure')) structureCount.set(find(i), (structureCount.get(find(i)) ?? 0) + 1);
  }
  let frame = -1;
  for (const [group, n] of structureCount) if (frame < 0 || n > structureCount.get(frame)!) frame = group;

  // Number the groups 0, 1, 2, ... with the frame (if any) first.
  const bodyOfLeader = new Map<number, number>();
  if (frame >= 0) bodyOfLeader.set(frame, 0);
  const bodyOf: number[] = [];
  for (let i = 0; i < count; i++) {
    const l = find(i);
    if (!bodyOfLeader.has(l)) bodyOfLeader.set(l, bodyOfLeader.size);
    bodyOf.push(bodyOfLeader.get(l)!);
  }
  return bodyOf;
}

// Bodies are named after their most telling part: "frame", "wheels 1", "gear 2", ...
const BODY_NOUNS: [string, string][] = [
  ['steering wheel', 'steering wheel'],
  ['piston', 'piston'],
  ['connecting rod', 'connecting rod'],
  ['crankshaft', 'crankshaft'],
  ['rack', 'rack'],
  ['steering link', 'steering link'],
  ['tyre', 'wheels'],
  ['rim', 'wheels'],
  ['differential', 'differential'],
  ['worm', 'worm'],
  ['gear', 'gear'],
  ['axle', 'axle'],
];

export function nameBodies(bodyOf: number[], roles: string[]): Body[] {
  const bodies: Body[] = [];
  bodyOf.forEach((b, part) => {
    if (!bodies[b]) bodies[b] = { name: '', parts: [] };
    bodies[b].parts.push(part);
  });
  const counts = new Map<string, number>();
  bodies.forEach((body, i) => {
    const bodyRoles = body.parts.map((p) => roles[p]);
    if (i === 0 && bodyRoles.includes('structure')) {
      body.name = 'frame';
      return;
    }
    // Other bodies with bricks or beams in them are assemblies (a steering axle's carrier),
    // unless they carry a rack (racks on a plate) or a crankshaft (with a fan on it).
    let noun = BODY_NOUNS.find(([role]) => bodyRoles.includes(role))?.[1] ?? 'body';
    if (bodyRoles.includes('structure') && !bodyRoles.includes('rack') && !bodyRoles.includes('crankshaft')) noun = 'assembly';
    counts.set(noun, (counts.get(noun) ?? 0) + 1);
    body.name = `${noun} ${counts.get(noun)}`;
  });
  return bodies;
}

// Whether two connections lie on the same axis.
function coaxial(a: Connection, b: Connection): boolean {
  const dir = new Vector3().subVectors(a.to, a.from).normalize();
  const distance = (p: Vector3) => {
    const offset = new Vector3().subVectors(p, a.from);
    return offset.addScaledVector(dir, -offset.dot(dir)).length();
  };
  return distance(b.from) < AXIS_TOLERANCE && distance(b.to) < AXIS_TOLERANCE;
}

// Each body's middle as built: the mean of its parts' origins.
export function bodyCenters(bodies: Body[], parts: PlacedPart[]): Vector3[] {
  return bodies.map((b) => b.parts.reduce((sum, i) => sum.add(new Vector3().setFromMatrixPosition(parts[i].matrix)), new Vector3()).multiplyScalar(1 / Math.max(1, b.parts.length)));
}
