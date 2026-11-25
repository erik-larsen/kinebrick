import { existsSync } from 'node:fs';
import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { loadModel } from '../scripts/load-model.ts';
import { Kinematics } from '../src/kinematics.ts';
import { canMove, pinsForDrag } from '../src/pinSearch.ts';
import { freeWithEveryPin } from '../src/inference/friction.ts';

// The viewer's answer to a drag of a part held by friction pins (pinsForDrag, which its pin
// helper runs), asked as the viewer asks it: the part grabbed at its middle as built, and the pins
// it names freed. The check frees the same pins for these functions (decision 141 of 2026-11-17).
describe("the viewer's friction pins for a drag", () => {
  const ask = async (model: string, part: number, lifted: boolean) => {
    const loaded = await loadModel(model, true);
    const build = (freed: Set<number>) => loaded.read(loaded.parts, freed).mech;
    const at = new Vector3().setFromMatrixPosition(loaded.parts[part].matrix);
    const kin = new Kinematics(loaded.mech, { lifted });
    const stuck = kin.hingeStuck(loaded.mech.bodyOf[part], [at]);
    const before = canMove(loaded.mech, part, at, lifted);
    const pins = pinsForDrag(build, loaded.allFree(loaded.parts), part, at, new Set(), true, lifted);
    return { stuck, before, pins, after: canMove(build(new Set(pins)), part, at, lifted) };
  };
  const crawler = 'omr/41999-1 4 x 4 Crawler Exclusive Edition.mpd';
  it.skipIf(!existsSync(crawler))("frees the pins of the 41999 Crawler's body shell, a push whose hinge only swings the model round it as read", async () => {
    const { stuck, before, pins, after } = await ask(crawler, 50, false);
    expect(stuck).toBe(true);
    expect(before).toBe(false);
    expect(pins).toContain(587);
    expect(after).toBe(true);
  });
  const snowmobile = 'omr/8272-1 Snowmobile.mpd';
  it.skipIf(!existsSync(snowmobile))("frees the hinge pin of the 8272 Snowmobile's left ski, lifted, for a drag of the ski's wishbone", async () => {
    const { pins, after } = await ask(snowmobile, 43, true);
    expect(pins).toEqual([20]);
    expect(after).toBe(true);
  });
  // A drag that went on play and stopped short asks only for pins that give it an exact motion
  // (the viewer's turnOwed, decision 331). The 42004 Mini Backhoe's knob, which a pin in the boom
  // holds to play, gets that pin; the 8272 Snowmobile's ski arm on the ground, which moves only on
  // play with its hinge pin free too, gets none, and keeps what it turned.
  const exactly = async (model: string, part: number) => {
    const loaded = await loadModel(model, true);
    const build = (freed: Set<number>) => loaded.read(loaded.parts, freed).mech;
    const at = new Vector3().setFromMatrixPosition(loaded.parts[part].matrix);
    return pinsForDrag(build, loaded.allFree(loaded.parts), part, at, new Set(), true, false, true);
  };
  const backhoe = 'omr/42004-1 Mini Backhoe.mpd';
  it.skipIf(!existsSync(backhoe))("frees the boom's pin for the 42004 Mini Backhoe's knob stopped on play, as it then turns exactly", async () => {
    expect(await exactly(backhoe, 147)).toEqual([153]);
  });
  it.skipIf(!existsSync(snowmobile))("frees no pin for the 8272 Snowmobile's right ski arm stopped on play, as it would still move only on play", async () => {
    expect(await exactly(snowmobile, 9)).toEqual([]);
  });
  // Its knobs sit in the frame even with every friction pin free. The trial search would free
  // p348, which joins the machine's two halves, so that each knob swings a half (decision 166).
  const forest = 'omr/42080-1 Forest Machine.mpd';
  it.skipIf(!existsSync(forest))("frees no pin for the 42080 Forest Machine's boom knob, which sits in the frame with every pin free", async () => {
    const loaded = await loadModel(forest, true);
    expect(freeWithEveryPin(loaded.allFree(loaded.parts), 1893)).toBe(false);
    const { before, pins } = await ask(forest, 1893, false);
    expect(before).toBe(false);
    expect(pins).toEqual([]);
  }, 120_000);
});
