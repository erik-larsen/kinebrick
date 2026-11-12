// Linear actuators: an input that turns a screw, which drives a piston in and out.

import { Vector3 } from 'three';
import { PlacedPart } from '../ldr.ts';
import type { Connection, Screw } from '../mechanism.ts';

// How far off where it should be on its body's axis a linear actuator's input or piston may be
// built, and still be taken for it, in LDU (see linearActuators).
const ACTUATOR_REACH = 3;

// Linear actuators, by their body's part: the parts its input and piston may be, where the input
// sits along the body's axis (its z, from the input end), how far along it the piston's head may
// be (contracted and extended, as the LDraw library's -f1 and -f2 shortcuts place it), and how
// far the piston goes for each turn of the input, from builders' measurements of the turns from
// one end of the stroke to the other: 19.9 for the small one's 60 LDU, 26.8 for the large one's
// 100, and 43.75 for the extra large one's 160 (the later large one, which shares its base, taken
// to be geared alike).
const ACTUATORS: Record<string, { inputs: string[]; input: number; pistons: string[]; stroke: [number, number]; lead: number }> = {
  '92693c01.dat': { inputs: ['92695.dat'], input: 30, pistons: ['92696.dat'], stroke: [120, 180], lead: 60 / 19.9 },
  '62271c01.dat': { inputs: ['47157.dat', '62273.dat'], input: 0, pistons: ['62274c01.dat'], stroke: [170, 270], lead: 100 / 26.8 },
  'u9487c01.dat': { inputs: ['47157.dat'], input: 0, pistons: ['62274c02.dat'], stroke: [250, 410], lead: 160 / 43.75 },
  'u9559c01.dat': { inputs: ['47157.dat'], input: 0, pistons: ['62274c01.dat'], stroke: [170, 270], lead: 160 / 43.75 },
};

// A linear actuator's three parts: its body, the input that turns in its back end, and the piston
// that a screw inside drives in and out of its front end as the input turns. The input turns in
// the body and the piston slides in it, as far as its stroke, in place of whatever their shapes
// connect them by (the piston's rod sits in the body's bore like a stud in a hole). Returns each
// actuator, its parts and screw, for buildMechanism to make a Screw of.
export function linearActuators(parts: PlacedPart[], connections: Connection[]): { body: number; input: number; piston: number; center: Vector3; axis: Vector3; lead: number }[] {
  const found: { body: number; input: number; piston: number; center: Vector3; axis: Vector3; lead: number }[] = [];
  parts.forEach((p, body) => {
    const kind = ACTUATORS[p.name];
    if (!kind) return;
    const toBody = p.matrix.clone().invert();
    // The part of one of these names nearest to the axis, between lo and hi along it.
    const onAxis = (names: string[], lo: number, hi: number) => {
      let best = -1;
      let bestOff = ACTUATOR_REACH;
      parts.forEach((q, i) => {
        if (!names.includes(q.name)) return;
        const at = new Vector3().setFromMatrixPosition(q.matrix).applyMatrix4(toBody);
        const off = Math.hypot(at.x, at.y) + Math.max(0, lo - at.z, at.z - hi);
        if (off < bestOff) [best, bestOff] = [i, off];
      });
      return best;
    };
    const input = onAxis(kind.inputs, kind.input, kind.input);
    const piston = onAxis(kind.pistons, kind.stroke[0], kind.stroke[1]);
    if (input < 0 || piston < 0) return;
    const center = new Vector3().setFromMatrixPosition(p.matrix);
    const axis = new Vector3(0, 0, 1).transformDirection(p.matrix);
    const trio = new Set([body, input, piston]);
    for (let k = connections.length - 1; k >= 0; k--) if (trio.has(connections[k].male) && trio.has(connections[k].female)) connections.splice(k, 1);
    const along = (z: number) => center.clone().addScaledVector(axis, z);
    connections.push({ male: input, female: body, kind: 'revolute', from: along(kind.input), to: along(kind.input + 20) });
    // Where the piston's head is now, and so how far it may go each way (a hair more, if it's
    // built a little past either end).
    const head = new Vector3().setFromMatrixPosition(parts[piston].matrix).sub(center).dot(axis);
    const female: [number, number] = [Math.min(0, kind.stroke[0] - head), Math.max(0, kind.stroke[1] - head)];
    connections.push({ male: piston, female: body, kind: 'slide', from: along(head), to: along(head + 20), extents: { male: [0, 0], female, overlap: 0 } });
    found.push({ body, input, piston, center: along(kind.input), axis, lead: kind.lead });
  });
  return found;
}

// The screws of the actuators linearActuators found, between bodies. An actuator whose input or
// piston is fixed to its body (by what's built round it) can't work.
export function actuatorScrews(actuators: { body: number; input: number; piston: number; center: Vector3; axis: Vector3; lead: number }[], bodyOf: number[]): Screw[] {
  return actuators.filter((a) => new Set([a.body, a.input, a.piston].map((i) => bodyOf[i])).size === 3).map((a) => ({ input: bodyOf[a.input], piston: bodyOf[a.piston], center: a.center, axis: a.axis, lead: a.lead }));
}
