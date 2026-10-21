import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ConnectionTable, libraryConnections } from '../src/connections.ts';
import { Kinematics } from '../src/kinematics.ts';
import { parseLdr } from '../src/ldr.ts';
import { inferMechanism } from '../src/mechanism.ts';

const table: ConnectionTable = JSON.parse(readFileSync('data/connections.json', 'utf-8'));
const roles: Record<string, string> = JSON.parse(readFileSync('data/roles.json', 'utf-8'));
const TURN = 2 * Math.PI;

describe('V8 engine from LEGO 8448', () => {
  const parts = parseLdr(readFileSync('models/8448-Super Car-V8 engine.mpd', 'utf-8'));
  const mech = inferMechanism(parts, table, roles);
  const kin = new Kinematics(mech);
  const bodyOf = (name: string) => mech.bodyOf[parts.findIndex((p) => p.name === name)];
  const crank = bodyOf('2854.dat');
  const crankJoint = kin.parentLink(crank)!.joint;
  const slides = mech.joints.flatMap((j, i) => (j.kind === 'slide' ? [i] : []));

  it('is fully attached: lipped axle holes, axle stubs on parts, and tiles on hollow studs all connect', () => {
    expect(mech.loose).toEqual([]);
  });

  it('holds its block together with friction pins: the cylinder banks, stands and intake are one frame', () => {
    for (const name of ['2850a.dat', '3701.dat', '32209.dat', '4162.dat']) {
      for (const [i, p] of parts.entries()) if (p.name === name) expect(mech.bodyOf[i]).toBe(0);
    }
  });

  it('has one crankshaft, eight connecting rods and eight pistons', () => {
    const names = mech.bodies.map((b) => b.name.replace(/ \d+$/, ''));
    expect(names.filter((n) => n === 'crankshaft')).toHaveLength(1);
    expect(names.filter((n) => n === 'connecting rod')).toHaveLength(8);
    expect(names.filter((n) => n === 'piston')).toHaveLength(8);
    expect(mech.bodyOf[parts.findIndex((p) => p.name === '2853.dat')]).toBe(crank);
    expect(slides).toHaveLength(8);
  });

  it('turning the crankshaft once takes every piston through its 20 LDU stroke and back', () => {
    kin.reset();
    kin.holdWhatTheDragDoesntNeed(crank, () => kin.jointMotion(crankJoint) !== null);
    expect(kin.freeMotions()).toHaveLength(1);
    const low = slides.map(() => Infinity);
    const high = slides.map(() => -Infinity);
    for (let i = 0; i < 72; i++) {
      kin.turnJoint(crankJoint, TURN / 72, () => kin.atLimit() === null);
      slides.forEach((s, k) => {
        low[k] = Math.min(low[k], kin.slideOffset(s));
        high[k] = Math.max(high[k], kin.slideOffset(s));
      });
    }
    kin.letGoAfterDrag();
    slides.forEach((s, k) => {
      expect(high[k] - low[k]).toBeCloseTo(20, 0);
      expect(kin.slideOffset(s)).toBeCloseTo(0, 3);
    });
  });
});

describe('the same V8 with the newer cylinder heads, with bottom slots (2850b), read with the whole library\'s table', () => {
  const library = libraryConnections(JSON.parse(readFileSync('data/library-connections.json', 'utf-8')));
  const parts = parseLdr(readFileSync('models/8448-Super Car-V8 engine.mpd', 'utf-8').replaceAll('2850a.dat', '2850b.dat'));
  const mech = inferMechanism(parts, library, roles);
  const kin = new Kinematics(mech);
  const crank = mech.bodyOf[parts.findIndex((p) => p.name === '2854.dat')];
  const crankJoint = kin.parentLink(crank)!.joint;
  const slides = mech.joints.flatMap((j, i) => (j.kind === 'slide' ? [i] : []));

  it('slides each piston in its own cylinder, so turning the crankshaft runs the engine', () => {
    expect(slides).toHaveLength(8);
    for (const s of slides) expect(mech.joints[s].bodyA).toBe(0); // the cylinders, part of the frame
    kin.reset();
    kin.holdWhatTheDragDoesntNeed(crank, () => kin.jointMotion(crankJoint) !== null);
    let turned = 0;
    for (let i = 0; i < 36; i++) turned += kin.turnJoint(crankJoint, TURN / 36, () => kin.atLimit() === null);
    kin.letGoAfterDrag();
    expect(Math.abs(turned)).toBeCloseTo(TURN, 6);
  });
});

describe('friction pins', () => {
  it("stay joints when they're the only way a model can move: a four-bar linkage on friction pins still turns", () => {
    const text = readFileSync('models/four-bar.ldr', 'utf-8').replaceAll('3673.dat', '2780.dat');
    const parts = parseLdr(text);
    const mech = inferMechanism(parts, table, roles);
    expect(mech.bodies).toHaveLength(4);
    expect(mech.joints.some((j) => j.stiff)).toBe(true);
    expect(new Kinematics(mech).freeMotions()).toHaveLength(1);
  });

  it("are known in the shape studless sets use (Type 2): on them, the four-bar is still four bodies, not one for each pin spinning in its holes", () => {
    const library = libraryConnections(JSON.parse(readFileSync('data/library-connections.json', 'utf-8')));
    const parts = parseLdr(readFileSync('models/four-bar.ldr', 'utf-8').replaceAll('3673.dat', '61332.dat'));
    const mech = inferMechanism(parts, library, roles);
    expect(mech.bodies).toHaveLength(4);
    expect(mech.joints.some((j) => j.stiff)).toBe(true);
    expect(new Kinematics(mech).freeMotions()).toHaveLength(1);
  });
});
