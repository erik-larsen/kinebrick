// Shifting a gearbox: a driving ring slides along the part it sits on (an axle joiner) and
// clicks into set positions (see "slides" in the connection table). Moving it changes which
// gear it locks to the shaft, so after a shift the mechanism is worked out afresh from where
// everything now is.

import { Matrix4, Vector3 } from 'three';
import { ConnectionTable } from './connections.ts';
import { PlacedPart } from './ldr.ts';
import { Mechanism } from './mechanism.ts';

export interface Slider {
  part: number; // the part that slides (the driving ring)
  base: number; // the part it slides on (the axle joiner)
  positions: number[]; // where it can click in: distances of its middle from the base's, in LDU
}

// The parts in a model that slide into set positions, and what each sits on.
export function findSliders(parts: PlacedPart[], mech: Mechanism, table: ConnectionTable): Slider[] {
  const sliders: Slider[] = [];
  parts.forEach((p, i) => {
    const slide = table.slides?.[p.name];
    if (!slide) return;
    // It sits on whatever it's fitted rigidly over (it's the female side of the fit).
    const fit = mech.connections.find((c) => c.female === i && c.kind === 'rigid');
    if (fit) sliders.push({ part: i, base: fit.male, positions: slide.positions });
  });
  return sliders;
}

// The direction a slider slides, in model coordinates.
export function slideDirection(parts: PlacedPart[], table: ConnectionTable, slider: Slider): Vector3 {
  const dir = table.slides![parts[slider.part].name].dir;
  return new Vector3(...dir).transformDirection(parts[slider.part].matrix);
}

// Where a slider is now: its middle's distance from its base's middle, along the slide.
export function sliderPosition(parts: PlacedPart[], table: ConnectionTable, slider: Slider): number {
  const dir = slideDirection(parts, table, slider);
  const at = new Vector3().setFromMatrixPosition(parts[slider.part].matrix);
  const base = new Vector3().setFromMatrixPosition(parts[slider.base].matrix);
  return at.sub(base).dot(dir);
}

// The slider's part matrix moved to `position`.
export function sliderMovedTo(parts: PlacedPart[], table: ConnectionTable, slider: Slider, position: number): Matrix4 {
  const dir = slideDirection(parts, table, slider);
  const by = position - sliderPosition(parts, table, slider);
  return new Matrix4().makeTranslation(dir.x * by, dir.y * by, dir.z * by).multiply(parts[slider.part].matrix);
}

// The click-in position nearest `position`.
export function nearestPosition(slider: Slider, position: number): number {
  return slider.positions.reduce((best, p) => (Math.abs(p - position) < Math.abs(best - position) ? p : best));
}
