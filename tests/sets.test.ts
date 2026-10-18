import { readFileSync } from 'node:fs';
import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { ConnectionTable } from '../src/connections.ts';
import { Kinematics } from '../src/kinematics.ts';
import { parseLdr } from '../src/ldr.ts';
import { inferMechanism } from '../src/mechanism.ts';

// Real LEGO Technic sets from the LDraw Official Model Repository, oldest first.

const table: ConnectionTable = JSON.parse(readFileSync('data/connections.json', 'utf-8'));
const roles: Record<string, string> = JSON.parse(readFileSync('data/roles.json', 'utf-8'));
// Which files each model places are LDraw primitives (drawn shapes, not parts), and which parts
// are read as their pieces, as the packer found.
const packed: Record<string, { primitives: string[]; pieces: Record<string, string[]> }> = JSON.parse(readFileSync('packed/models.json', 'utf-8'));

function load(file: string) {
  const model = packed[file.replace(/^models\//, '').replace(/\.(ldr|mpd)$/, '')];
  const primitives = new Set(model?.primitives ?? []);
  const parts = parseLdr(readFileSync(file, 'utf-8'), (name) => primitives.has(name), (name) => model?.pieces[name] ?? null);
  const mech = inferMechanism(parts, table, roles);
  const kin = new Kinematics(mech);
  // The body of the n-th copy of a part.
  const bodyOf = (name: string, n = 0) => mech.bodyOf[parts.map((p, i) => (p.name === name ? i : -1)).filter((i) => i >= 0)[n]];
  // Turns a body on its joint as a drag does (holding what that doesn't need), as far as it
  // goes, up to `angle`. Returns how far it turned.
  const turn = (body: number, angle: number) => {
    const joint = kin.parentLink(body)!.joint;
    kin.holdWhatTheDragDoesntNeed(body, () => kin.jointMotion(joint) !== null);
    const turned = kin.turnJoint(joint, angle, () => kin.atLimit() === null);
    kin.letGoAfterDrag();
    return turned;
  };
  const angleOf = (body: number) => kin.jointAngles[kin.parentLink(body)!.joint];
  const frameMoved = () => new Vector3().applyMatrix4(kin.poses[0]).length();
  // The bodies that turn on the frame on a 2x2 turntable (whose top, 3679, they carry).
  const turntables = () =>
    mech.joints.flatMap((j) => (j.kind === 'revolute' && j.bodyA === 0 && mech.bodies[j.bodyB].parts.some((p) => parts[p].name === '3679.dat') ? [j.bodyB] : []));
  return { parts, mech, kin, bodyOf, turn, angleOf, frameMoved, turntables };
}

describe('854 Go-Kart', () => {
  const { mech, kin, bodyOf, turn, angleOf, frameMoved, turntables } = load('models/854 - Go Kart.mpd');
  const knuckles = turntables();

  it('is fully attached: its hoses are decoration, its seat sits on a hinge, its steering column bends through a universal joint', () => {
    expect(mech.loose).toEqual([]);
    expect(mech.couplings).toHaveLength(1);
    expect(knuckles).toHaveLength(2);
  });

  it('turning the steering wheel turns both front wheels the same way, on their turntables, and the kart stays where it is', () => {
    kin.reset();
    expect(Math.abs(turn(bodyOf('3736.dat'), 1))).toBeCloseTo(1, 6);
    const [a, b] = knuckles.map(angleOf);
    expect(Math.abs(a)).toBeGreaterThan(0.1);
    expect(b).toBeCloseTo(a, 3);
    expect(frameMoved()).toBeLessThan(1e-6);
  });

  it('a turn of a rear wheel rolls the kart one tyre round, and runs the engine: its piston slides up and down its 28 LDU stroke', () => {
    kin.reset();
    const piston = mech.joints.findIndex((j) => j.kind === 'slide');
    const wheel = bodyOf('3634.dat', 2);
    const joint = kin.parentLink(wheel)!.joint;
    kin.holdWhatTheDragDoesntNeed(wheel, () => kin.jointMotion(joint) !== null);
    const offsets: number[] = [];
    let turned = 0;
    for (let i = 0; i < 60; i++) {
      turned += kin.turnJoint(joint, (2 * Math.PI) / 60);
      offsets.push(kin.slideOffset(piston));
    }
    kin.letGoAfterDrag();
    expect(Math.abs(turned)).toBeCloseTo(2 * Math.PI, 6);
    expect(frameMoved()).toBeCloseTo(2 * Math.PI * 54.2, 0); // the big tyre's radius
    expect(Math.max(...offsets) - Math.min(...offsets)).toBeCloseTo(28, 0); // twice the crank's throw
  });
});

describe('855 Mobile Crane', () => {
  const { parts, mech, kin, bodyOf, turn, frameMoved } = load('models/855 - Mobile Crane.mpd');
  const outriggers = mech.joints.flatMap((j, i) => (j.kind === 'slide' && j.bodyA === 0 && (j.range![0] === -120 || j.range![0] === -40) ? [i] : []));
  const cab = bodyOf('3404.dat');

  it("is attached except its hook, which hangs on a string (M9): the cab turns on a 4x4 turntable, read as its base and top, and the outriggers slide out on tiles", () => {
    expect(new Set(mech.loose.map((i) => parts[i].submodel))).toEqual(new Set(['855 - hook.ldr']));
    expect(mech.joints.some((j) => j.kind === 'revolute' && j.bodyA === 0 && j.bodyB === cab)).toBe(true);
    expect(outriggers).toHaveLength(4);
  });

  it('the cab slews on its turntable, boom and all, and the crane stays where it is', () => {
    kin.reset();
    expect(Math.abs(turn(cab, 1))).toBeCloseTo(1, 6);
    expect(frameMoved()).toBeLessThan(1e-6);
  });

  // Pushes a slide joint's bodyB along it, as a drag does, by `distance` or as far as it goes.
  const push = (joint: number, distance: number) => {
    const j = mech.joints[joint];
    const rate = (m: number[]) => {
      const at = j.from.clone().applyMatrix4(kin.poses[j.bodyA]);
      const dir = j.to.clone().sub(j.from).normalize().transformDirection(kin.poses[j.bodyA]);
      return kin.pointVelocity(m, j.bodyB, at).sub(kin.pointVelocity(m, j.bodyA, at)).dot(dir);
    };
    kin.holdWhatTheDragDoesntNeed(j.bodyB, () => kin.freeMotions().some((m) => Math.abs(rate(m)) > 1e-9));
    for (let i = 0; i < Math.abs(distance) / 5; i++) {
      const m = kin.freeMotions().find((m) => Math.abs(rate(m)) > 1e-9);
      if (!m) break;
      const before = kin.snapshot();
      kin.advance(m, (5 * Math.sign(distance)) / rate(m));
      if (kin.atLimit()) {
        kin.restore(before);
        break;
      }
    }
    kin.letGoAfterDrag();
  };

  it('each outrigger slides 160 LDU along its tiles, and no further', () => {
    for (const joint of outriggers) {
      for (const end of mech.joints[joint].range!) {
        kin.reset();
        push(joint, end + 40 * Math.sign(end));
        expect(kin.slideOffset(joint)).toBeCloseTo(end, 3);
      }
    }
  });
});

describe('950 Fork-Lift Truck', () => {
  const { mech, kin, bodyOf, turn, angleOf, frameMoved, turntables } = load('models/950 - Fork Lift.mpd');
  const carriage = bodyOf('3703.dat', 2);
  const shaft = bodyOf('3737.dat', 1);

  it('is fully attached: the forks ride up the mast on their racks, and the steering wheel drives a crown gear', () => {
    expect(mech.loose).toEqual([]);
    expect(mech.joints.some((j) => j.kind === 'slide' && (j.bodyA === carriage || j.bodyB === carriage))).toBe(true);
    expect(mech.meshes.filter((m) => m.kind === 'crown')).toHaveLength(1);
  });

  it('turning the lift shaft raises the forks 10 LDU per radian, until its gears reach the end of the racks', () => {
    for (const [way, reach] of [
      [1, 83.9],
      [-1, 155.9],
    ]) {
      kin.reset();
      const turned = turn(shaft, way * 30);
      const moved = new Vector3().applyMatrix4(kin.poses[carriage]).y;
      expect(Math.abs(moved)).toBeCloseTo(Math.abs(turned) * 10, 3); // the 8 tooth gears' pitch radius
      expect(Math.abs(moved)).toBeCloseTo(reach, 0);
      expect(frameMoved()).toBeLessThan(1e-6);
    }
  });

  it('turning the steering wheel turns both front wheels the same way, through the crown gear and a rack', () => {
    kin.reset();
    expect(Math.abs(turn(bodyOf('3736.dat'), 0.5))).toBeCloseTo(0.5, 6);
    const knuckles = turntables();
    expect(knuckles).toHaveLength(2);
    const [a, b] = knuckles.map(angleOf);
    expect(Math.abs(a)).toBeGreaterThan(0.05);
    expect(b).toBeCloseTo(a, 3);
  });
});

describe('952 Tractor', () => {
  const { mech, kin, bodyOf, turn, angleOf, frameMoved, turntables } = load('models/952 - Tractor.mpd');

  it('is fully attached: its big rear wheels are tyres, and two plates stand on edge between studs', () => {
    expect(mech.loose).toEqual([]);
    expect(kin.groundY).not.toBeNull();
    expect(mech.treads.filter((t) => t.radius > 100)).toHaveLength(2); // the big rear tyres
  });

  it('turning the steering column turns both front wheels the same way, and the tractor stays where it is', () => {
    kin.reset();
    expect(Math.abs(turn(bodyOf('3712.dat'), 0.5))).toBeCloseTo(0.5, 6);
    const [a, b] = turntables().map(angleOf);
    expect(Math.abs(a)).toBeGreaterThan(0.05);
    expect(b).toBeCloseTo(a, 3);
    expect(frameMoved()).toBeLessThan(1e-6);
  });

  it('a turn of the rear wheels rolls it one big tyre round, and the assembly hung on the rear axle stays level', () => {
    kin.reset();
    const wheel = bodyOf('952 - 3739c01.dat');
    const joint = kin.parentLink(wheel)!.joint;
    kin.holdWhatTheDragDoesntNeed(wheel, () => kin.jointMotion(joint) !== null);
    let turned = 0;
    for (let i = 0; i < 60; i++) turned += kin.turnJoint(joint, (2 * Math.PI) / 60);
    kin.letGoAfterDrag();
    expect(turned).toBeCloseTo(2 * Math.PI, 6);
    expect(frameMoved()).toBeCloseTo(2 * Math.PI * 102.7, 0);
    const hung = bodyOf('3021.dat', 0);
    expect(new Vector3(0, 1, 0).transformDirection(kin.poses[hung]).y).toBeCloseTo(1, 3); // not carried round
  });
});

describe('956 Auto Chassis', () => {
  const { mech, kin, bodyOf, turn, angleOf, frameMoved, turntables } = load('models/956 - Auto Chassis.mpd');

  it('is fully attached: its steering column bends through a double universal joint, and its steering rack is guided', () => {
    expect(mech.loose).toEqual([]);
    expect(mech.couplings).toHaveLength(2);
    expect(mech.joints.filter((j) => j.kind === 'slide')).toHaveLength(7); // two seats, the steering rack, four pistons
  });

  it('turning the steering wheel turns both front wheels the same way, and the car stays where it is', () => {
    kin.reset();
    expect(Math.abs(turn(bodyOf('3736.dat'), 0.5))).toBeCloseTo(0.5, 6);
    const [a, b] = turntables().map(angleOf);
    expect(Math.abs(a)).toBeGreaterThan(0.05);
    expect(b).toBeCloseTo(a, 3);
    expect(frameMoved()).toBeLessThan(1e-6);
  });

  it('a turn of a wheel rolls it one big tyre round, and runs its four-cylinder engine: each piston through its 32 LDU stroke', () => {
    kin.reset();
    const wheel = bodyOf('3740.dat');
    const joint = kin.parentLink(wheel)!.joint;
    const pistons = mech.joints.flatMap((j, i) => (j.kind === 'slide' && mech.bodies[j.bodyB].name.startsWith('piston') ? [i] : []));
    kin.holdWhatTheDragDoesntNeed(wheel, () => kin.jointMotion(joint) !== null);
    const low = pistons.map(() => Infinity);
    const high = pistons.map(() => -Infinity);
    let turned = 0;
    for (let i = 0; i < 60; i++) {
      turned += kin.turnJoint(joint, (2 * Math.PI) / 60);
      pistons.forEach((p, k) => {
        low[k] = Math.min(low[k], kin.slideOffset(p));
        high[k] = Math.max(high[k], kin.slideOffset(p));
      });
    }
    kin.letGoAfterDrag();
    expect(Math.abs(turned)).toBeCloseTo(2 * Math.PI, 6);
    expect(frameMoved()).toBeCloseTo(2 * Math.PI * 102.7, 0);
    expect(pistons).toHaveLength(4);
    pistons.forEach((_, k) => expect(high[k] - low[k]).toBeCloseTo(32, 0));
  });
});
