import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { onALoop } from '../scripts/causes.ts';
import { loadModel } from '../scripts/load-model.ts';

// A turn that stops at a dead point is at the end of its travel (see farEnough in
// check-functions.ts) only for a control that turns a link of the loop itself. One that reaches
// the loop only through gears, a worm, a chain or a motor turns on in the real set, and its stop
// stays a dead point.
describe('a dead point as the end of travel', () => {
  const controlOnALoop = (model: string, control: number) => {
    const { mech, kin } = loadModel(model, true);
    const link = kin.parentLink(mech.bodyOf[control]);
    return link !== null && onALoop(mech, link.joint);
  };
  const quad = 'omr/9392-1 Quad Bike.mpd';
  it.skipIf(!existsSync(quad))("is for the 9392 Quad Bike's handlebars, which turn the steering arm's loop themselves", () => {
    expect(controlOnALoop(quad, 194)).toBe(true);
  });
  const truck = 'omr/8273-1 Off Road Truck.mpd';
  it.skipIf(!existsSync(truck))("isn't for the 8273 Off Road Truck's winch knob, which turns the winch through gears", () => {
    expect(controlOnALoop(truck, 3956)).toBe(false);
  });
});
