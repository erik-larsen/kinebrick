import { existsSync } from 'node:fs';
import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { loadModel } from '../scripts/load-model.ts';
import { heldPins } from '../src/inference/friction.ts';
import { motorRunPart } from '../src/mechanism.ts';
import { canMove, pinsForDrag } from '../src/pinSearch.ts';

// A motor started in the viewer (Ctrl-click) whose output can't turn asks once for the friction
// pins that hold its output, as a drag of the output would (see startMotor in interaction.ts). The
// motor's own output joint is never one of them: it turns stiffly in the motor's gearbox, and is
// no friction pin (decision 155 of 2026-11-17).
describe("the pins a motor's start frees", () => {
  const towTruck = 'omr/42070-1 6x6 All Terrain Tow Truck.mpd';
  // The 42070's XL motor was stuck until its erratum (decision 333 of 2026-11-21) set it on the
  // gearbox's axle: its output now turns, and its start still names no pin of its own.
  it.skipIf(!existsSync(towTruck))("never names the motor's own joint, for the 42070 Tow Truck's motor", async () => {
    const loaded = await loadModel(towTruck, true);
    const output = motorRunPart(loaded.mech, 593);
    const at = new Vector3().setFromMatrixPosition(loaded.parts[output].matrix);
    expect(canMove(loaded.mech, output, at)).toBe(true);
    const motorParts = loaded.mech.connections.filter((c) => c.motor).flatMap((c) => [c.male, c.female]);
    expect(motorParts.length).toBeGreaterThan(0);
    expect(heldPins(loaded.mech, output).pins.filter((p) => motorParts.includes(p))).toEqual([]);
    const pins = pinsForDrag((freed) => loaded.read(loaded.parts, freed).mech, loaded.allFree(loaded.parts), output, at, new Set(), true);
    // The pin search for its output names no part of the motor's own joint (it names p433, a friction pin of the frame).
    expect(pins.filter((p) => motorParts.includes(p))).toEqual([]);
  }, 120_000);
});
