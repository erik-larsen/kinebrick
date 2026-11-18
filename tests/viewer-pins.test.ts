import { existsSync } from 'node:fs';
import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { loadModel } from '../scripts/load-model.ts';
import { Kinematics } from '../src/kinematics.ts';
import { canMove, pinsForDrag } from '../src/pinSearch.ts';

// The viewer's answer to a drag of a part held by friction pins (pinsForDrag, which its pin
// helper runs), asked as the viewer asks it: the part grabbed at its middle as built, and the pins
// it names freed. The check frees the same pins for these functions (decision 141 of 2026-11-17).
describe("the viewer's friction pins for a drag", () => {
  const ask = (model: string, part: number, lifted: boolean) => {
    const loaded = loadModel(model, true);
    const build = (freed: Set<number>) => loaded.read(loaded.parts, freed).mech;
    const at = new Vector3().setFromMatrixPosition(loaded.parts[part].matrix);
    const kin = new Kinematics(loaded.mech, { lifted });
    const stuck = kin.hingeStuck(loaded.mech.bodyOf[part], [at]);
    const before = canMove(loaded.mech, part, at, lifted);
    const pins = pinsForDrag(build, loaded.allFree(loaded.parts), part, at, new Set(), true, lifted);
    return { stuck, before, pins, after: canMove(build(new Set(pins)), part, at, lifted) };
  };
  const crawler = 'omr/41999-1 4 x 4 Crawler Exclusive Edition.mpd';
  it.skipIf(!existsSync(crawler))("frees the pins of the 41999 Crawler's body shell, a push whose hinge only swings the model round it as read", () => {
    const { stuck, before, pins, after } = ask(crawler, 50, false);
    expect(stuck).toBe(true);
    expect(before).toBe(false);
    expect(pins).toContain(587);
    expect(after).toBe(true);
  });
  const snowmobile = 'omr/8272-1 Snowmobile.mpd';
  it.skipIf(!existsSync(snowmobile))("frees the hinge pin of the 8272 Snowmobile's left ski, lifted, for a drag of the ski's wishbone", () => {
    const { pins, after } = ask(snowmobile, 43, true);
    expect(pins).toEqual([20]);
    expect(after).toBe(true);
  });
});
