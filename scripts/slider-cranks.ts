// Where an engine's pistons should be as its crankshaft turns, worked out from the parts' places
// alone, as a slider-crank's geometry gives it, without the solver: so the function check can
// tell whether a piston ran the stroke it should for how far its crankshaft turned.
//
// A slider-crank is a piston sliding in a cylinder, a connecting rod joined to the piston (by a
// ball or a pin) and turning on a crank pin, and the crank turning in what the cylinder is part
// of: its housing (see line). As the crank turns by θ, the crank pin goes round the crank's axis,
// and the piston is where the rod, its length unchanged, reaches the cylinder's line. Its stroke
// is twice the crank's throw (or a little more, if the cylinder's line misses the crank's axis).

import { Vector3 } from 'three';
import { Mechanism } from '../src/mechanism.ts';
import { line } from './gear-rates.ts';

export interface SliderCrank {
  piston: number; // the bodies: the piston, sliding in the cylinder
  cylinder: number;
  crank: number; // turning in the cylinder, on joints on one line (see line)
  center: Vector3; // a point on the crank's axis
  axis: Vector3; // the way the crank's angle against its housing grows (see line)
  pin: Vector3; // the crank pin's middle, in the rod's plane, as built
  wrist: Vector3; // where the rod joins the piston, as built
  slide: Vector3; // the cylinder's line's direction
  rod: number; // the rod's length, pin to wrist
}

// The model's slider-cranks.
export function sliderCranks(mech: Mechanism, parentLink: (body: number) => { parent: number; joint: number } | null): SliderCrank[] {
  const found: SliderCrank[] = [];
  const jointsOf = (b: number) => mech.joints.filter((j) => j.bodyA === b || j.bodyB === b);
  const other = (j: Mechanism['joints'][number], b: number) => (j.bodyA === b ? j.bodyB : j.bodyA);
  for (const s of mech.joints) {
    if (s.kind !== 'slide') continue;
    for (const [cylinder, piston] of [[s.bodyA, s.bodyB], [s.bodyB, s.bodyA]]) {
      for (const w of jointsOf(piston)) {
        if (w === s || w.kind === 'slide') continue;
        const rod = other(w, piston);
        if (rod === cylinder) continue;
        for (const p of jointsOf(rod)) {
          if (p === w || p.kind !== 'revolute') continue;
          const crank = other(p, rod);
          const l = line(mech, parentLink, crank);
          if (crank === piston || !l || l.housing !== cylinder) continue;
          const c = mech.joints[l.joints[0].joint];
          const axis = l.joints[0].axis.clone();
          const pinAxis = p.to.clone().sub(p.from).normalize();
          if (Math.abs(pinAxis.dot(axis)) < 0.999) continue;
          const wrist = w.from.clone().add(w.to).multiplyScalar(0.5);
          // The crank pin's middle in the rod's plane: the point on its axis nearest the wrist.
          const pin = p.from.clone().addScaledVector(pinAxis, wrist.clone().sub(p.from).dot(pinAxis));
          const off = pin.clone().sub(c.from);
          if (off.addScaledVector(axis, -off.dot(axis)).length() < 0.5) continue;
          const slide = s.to.clone().sub(s.from).normalize();
          found.push({ piston, cylinder, crank, center: c.from.clone(), axis, pin, wrist, slide, rod: wrist.distanceTo(pin) });
        }
      }
    }
  }
  return found;
}

// How far the piston should have slid along the cylinder's line (LDU, signed along `slide`) with
// the crank turned θ (radians, about `axis`) from where it was built; null where the rod can't
// reach the cylinder's line.
export function pistonAt(sc: SliderCrank, theta: number): number | null {
  // The crank pin, turned θ about the crank's axis (Rodrigues' formula).
  const v = sc.pin.clone().sub(sc.center);
  const k = sc.axis;
  const turned = v.clone().multiplyScalar(Math.cos(theta)).add(k.clone().cross(v).multiplyScalar(Math.sin(theta))).addScaledVector(k, k.dot(v) * (1 - Math.cos(theta)));
  const pin = sc.center.clone().add(turned);
  // The wrist at wrist + s slide, rod's length from the pin: s² + 2 s (slide·d) + |d|² - rod² = 0.
  const d = sc.wrist.clone().sub(pin);
  const b = sc.slide.dot(d);
  const disc = b * b - d.lengthSq() + sc.rod * sc.rod;
  if (disc < 0) return null;
  // The root that's 0 as built: the one on the side the wrist is of the pin, along the line.
  const way = sc.slide.dot(sc.wrist.clone().sub(sc.pin)) >= 0 ? 1 : -1;
  return -b + way * Math.sqrt(disc);
}
