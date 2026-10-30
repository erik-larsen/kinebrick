// How fast each part of a gear train should turn for each turn of its control, worked out from
// tooth counts alone, as a gear calculator would, without the solver: so the function check can
// tell whether a drag moved a part by the right amount, not only whether it moved.
//
// Only bodies that turn or slide on a joint straight off the frame count, since only their speed
// is set by the gears alone: a differential's planets turn in its carrier, so its two outputs
// aren't counted. What ties two of them together:
//
//   spur, bevel and crown gears   each turns its partner's teeth by its own: B turns tA/tB as fast
//   a worm                        its gear turns one thread's advance at its pitch radius for each
//                                 turn of the worm (not back: a worm locks)
//   a gear on a rack              the rack slides the gear's pitch radius for each radian
//   a universal joint             both shafts turn as fast as each other
//   a linear actuator's screw     its piston slides one lead for each turn of its input (not back)
//   a chain, track or rubber band its wheels' rims move at its speed: each turns as fast as the
//                                 others in inverse ratio of their radii round it
//
// A body reached two ways at different speeds (the gears jam, or a loop of them runs through
// something else) gets no expected speed.

import { Mechanism } from '../src/mechanism.ts';

// For each body that can be counted, how fast it should turn (radians) or slide (LDU) for each
// radian `control` turns, by size (which way aside). `parentLink` is the kinematics' tree:
// each body's parent and the joint it turns or slides on.
export function gearRates(mech: Mechanism, parentLink: (body: number) => { parent: number; joint: number } | null, control: number): Map<number, number> {
  const counted = (b: number) => {
    const link = parentLink(b);
    return link !== null && link.parent === 0 && mech.joints[link.joint].kind !== 'ball';
  };
  const rates = new Map<number, number>();
  if (!counted(control)) return rates;

  // Each tie, both ways where it goes both ways: from a body, to another, at this many times
  // its speed.
  const ties = new Map<number, { to: number; times: number }[]>();
  const tie = (from: number, to: number, times: number) => {
    if (from === to || !(times > 0) || !Number.isFinite(times)) return;
    if (!ties.has(from)) ties.set(from, []);
    ties.get(from)!.push({ to, times });
  };
  for (const mesh of mech.meshes) {
    const [a, b] = [mech.gears[mesh.gearA], mech.gears[mesh.gearB]];
    if (mesh.kind === 'rack') {
      tie(a.body, b.body, a.radius);
      tie(b.body, a.body, 1 / a.radius);
    } else if (mesh.kind === 'worm') tie(a.body, b.body, Math.abs(a.worm) / (2 * Math.PI * b.radius));
    else {
      tie(a.body, b.body, a.teeth / b.teeth);
      tie(b.body, a.body, b.teeth / a.teeth);
    }
  }
  for (const c of mech.couplings) {
    tie(c.bodyA, c.bodyB, 1);
    tie(c.bodyB, c.bodyA, 1);
  }
  for (const s of mech.screws) tie(s.input, s.piston, s.lead / (2 * Math.PI));
  for (const loop of mech.loops) {
    const radius = (w: (typeof loop.wheels)[number]) => loop.path.points[w.point].radius;
    for (const a of loop.wheels) for (const b of loop.wheels) if (a !== b) tie(a.body, b.body, radius(a) / radius(b));
  }

  // Out from the control, a body at a time; one reached again at a different speed is left out.
  const torn = new Set<number>();
  rates.set(control, 1);
  const queue = [control];
  while (queue.length) {
    const from = queue.shift()!;
    for (const { to, times } of ties.get(from) ?? []) {
      if (!counted(to)) continue;
      const rate = rates.get(from)! * times;
      const had = rates.get(to);
      if (had === undefined) {
        rates.set(to, rate);
        queue.push(to);
      } else if (Math.abs(had - rate) > 0.01 * Math.max(had, rate)) torn.add(to);
    }
  }
  for (const b of torn) rates.delete(b);
  return rates;
}
