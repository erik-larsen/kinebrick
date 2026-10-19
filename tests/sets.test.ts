import { readFileSync } from 'node:fs';
import { Matrix4, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { ConnectionTable } from '../src/connections.ts';
import { DEFAULT_SCRUB, Kinematics } from '../src/kinematics.ts';
import { modelSettings, parseModel } from '../src/ldr.ts';
import { inferMechanism } from '../src/mechanism.ts';
import { loopLinks } from '../src/paths.ts';

// Real LEGO Technic sets from the LDraw Official Model Repository, oldest first.

const table: ConnectionTable = JSON.parse(readFileSync('data/connections.json', 'utf-8'));
const roles: Record<string, string> = JSON.parse(readFileSync('data/roles.json', 'utf-8'));
// Which files each model places are LDraw primitives (drawn shapes, not parts), and which parts
// are read as their pieces, as the packer found.
const packed: Record<string, { primitives: string[]; pieces: Record<string, string[]> }> = JSON.parse(readFileSync('packed/models.json', 'utf-8'));

function load(file: string) {
  const model = packed[file.replace(/^models\//, '').replace(/\.(ldr|mpd)$/, '')];
  const primitives = new Set(model?.primitives ?? []);
  const text = readFileSync(file, 'utf-8');
  const { parts, paths } = parseModel(text, (name) => primitives.has(name), (name) => model?.pieces[name] ?? null);
  const mech = inferMechanism(parts, table, roles, paths);
  const kin = new Kinematics(mech);
  kin.scrub = (modelSettings(text).scrub ?? DEFAULT_SCRUB * 100) / 100; // as the viewer does
  // The body of the n-th copy of a part.
  const bodyOf = (name: string, n = 0) => mech.bodyOf[parts.map((p, i) => (p.name === name ? i : -1)).filter((i) => i >= 0)[n]];
  // Turns a body on its joint as a drag does (holding what that doesn't need, chosen as the
  // viewer chooses), as far as it goes, up to `angle`. Returns how far it turned.
  const turn = (body: number, angle: number) => {
    const joint = kin.parentLink(body)!.joint;
    kin.holdWhatTheDragDoesntNeed(body, () => kin.jointMotion(joint) !== null, joint);
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
  const { mech, kin, bodyOf, turn, angleOf, frameMoved, turntables } = load('models/854-Go Kart.mpd');
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
  const { parts, mech, kin, bodyOf, turn, frameMoved } = load('models/855-Mobile Crane.mpd');
  const outriggers = mech.joints.flatMap((j, i) => (j.kind === 'slide' && j.bodyA === 0 && (j.range![0] === -120 || j.range![0] === -40) ? [i] : []));
  const cab = bodyOf('3404.dat');

  it("is fully attached: its hook hangs on a string, the cab turns on a 4x4 turntable, read as its base and top, and the outriggers slide out on tiles", () => {
    expect(mech.loose).toEqual([]);
    expect(mech.strings).toHaveLength(1);
    const [string] = mech.strings;
    expect(string.drum).not.toBeNull();
    expect(string.pulleys).toHaveLength(3); // over the boom tip, round the hook, back over the boom tip
    expect(new Set(mech.bodies[string.hook!.body].parts.map((i) => parts[i].submodel))).toEqual(new Set(['855-hook.ldr']));
    expect(mech.joints.some((j) => j.kind === 'revolute' && j.bodyA === 0 && j.bodyB === cab)).toBe(true);
    expect(outriggers).toHaveLength(4);
  });

  // Where the hook's pulley is, and the middle of the two boom-tip pulleys it hangs from.
  const hook = () => {
    const [string] = mech.strings;
    const at = (w: (typeof string.pulleys)[0]) => string.path.points[w.point].center.clone().applyMatrix4(kin.poses[w.mount]);
    const [a, h, b] = string.pulleys.map(at);
    return { at: h, under: h.clone().sub(a.clone().add(b).multiplyScalar(0.5)), up: new Vector3(0, -1, 0).transformDirection(kin.poses[string.hook!.body]) };
  };

  it("a turn of the winch pays out 7.5 LDU of string per radian, its drum's radius, and the hook, on a pulley in the string's bight, drops half that, straight down", () => {
    kin.reset();
    const [string] = mech.strings;
    const start = hook().at;
    const joint = kin.parentLink(string.drum!.body)!.joint;
    kin.holdWhatTheDragDoesntNeed(string.drum!.body, () => kin.jointMotion(joint) !== null);
    const sign = mech.joints[joint].bodyB === string.drum!.body ? 1 : -1;
    expect(Math.abs(kin.turnJoint(joint, sign * 2))).toBeCloseTo(2, 9);
    kin.letGoAfterDrag();
    const moved = hook().at.sub(start);
    expect(Math.abs(moved.y)).toBeCloseTo(7.5, 6); // half of 2 x 7.5
    expect(Math.hypot(moved.x, moved.z)).toBeLessThan(1e-6);
    expect(frameMoved()).toBeLessThan(1e-6);
  });

  it('the hook hangs beneath the boom tip, upright, as the cab slews and the boom luffs', () => {
    for (const [body, angle] of [
      [bodyOf('3404.dat'), 1], // the cab
      [bodyOf('3736.dat', 2), 2], // the crank that luffs the boom
    ] as const) {
      kin.reset();
      const start = hook().under;
      turn(body, angle);
      const { under, up } = hook();
      expect(Math.hypot(under.x - start.x, under.z - start.z)).toBeLessThan(1e-6);
      expect(up.y).toBeCloseTo(-1, 9);
    }
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

describe('856 Bulldozer', () => {
  const { parts, mech, kin } = load('models/856-Bulldozer.mpd');
  const gears = parts.flatMap((p, i) => (p.name === '3649.dat' ? [mech.bodyOf[i]] : []));
  const yaw = () => Math.atan2(kin.poses[0].elements[8], kin.poses[0].elements[0]);

  it("is fully attached: it runs on two tracks of 50 links, each round two 40 tooth gears, its bucket's plates slot into grooves in its tipper ends, and two connectors' ends wedge between its studs", () => {
    const tracks = mech.loops.filter((l) => l.depth !== null); // (its two rubber bands are loops too)
    expect(tracks).toHaveLength(2);
    for (const loop of tracks) {
      expect(loop.links).toHaveLength(50);
      expect(loop.depth).toBe(8);
      expect(loop.wheels.map((w) => w.body).every((b) => gears.includes(b))).toBe(true);
      expect(loop.wheels).toHaveLength(2);
    }
    expect(mech.loose).toEqual([]);
    const tipperEnd = mech.bodyOf[parts.findIndex((p) => p.name === '3145.dat')];
    for (const [i, p] of parts.entries()) if (p.name === '3029.dat') expect(mech.bodyOf[i]).toBe(tipperEnd);
    // Two Technic connectors that turn on an axle hold the bucket, their ends wedged between its studs.
    expect(parts.filter((p, i) => p.name === '3651.dat' && mech.bodyOf[i] === tipperEnd)).toHaveLength(2);
  });

  it('stands on its tracks: their links reach 8 LDU below the path round the gears', () => {
    expect(kin.groundY).toBeCloseTo(-14 + 51.2 + 8, 6); // the gears' axles, the path's radius, the links' depth
  });

  it("a turn of one track's gear moves that track 51.2 LDU round per radian, turning its other gear alike, and the bulldozer turns, its tracks skidding", () => {
    kin.reset();
    const loop = mech.loops[0];
    const [front, back] = loop.wheels;
    const joint = kin.parentLink(front.body)!.joint;
    kin.holdWhatTheDragDoesntNeed(front.body, () => kin.jointMotion(joint) !== null);
    expect(kin.turnJoint(joint, 1)).toBeCloseTo(1, 9);
    kin.letGoAfterDrag();
    expect(Math.abs(kin.loopTravel(0))).toBeCloseTo(51.2, 3);
    expect(kin.jointAngles[back.joint]).toBeCloseTo(kin.jointAngles[front.joint], 6);
    expect(Math.abs(yaw())).toBeGreaterThan(0.05);
  });

  it('its links go round with it: moved one link (16 LDU) along, each lands where its neighbour was', () => {
    const loop = mech.loops[0];
    const start = loop.links.map((i) => parts[i].matrix);
    const moved = loopLinks(loop.path.points, start)!(16);
    const at = (m: typeof start[0]) => new Vector3().setFromMatrixPosition(m);
    for (const m of moved) expect(Math.min(...start.map((s) => at(s).distanceTo(at(m))))).toBeLessThan(0.5);
  });

  it('driven round and round by one gear, as Ctrl-click does, it keeps going: nothing else drifts into its way', () => {
    kin.reset();
    const body = mech.loops[0].wheels[0].body;
    const joint = kin.parentLink(body)!.joint;
    kin.holdWhatTheDragDoesntNeed(body, () => kin.jointMotion(joint) !== null);
    const step = (15 * Math.PI) / 180;
    const others = mech.joints.flatMap((j, i) => (j.kind === 'revolute' && !mech.loops.some((l) => l.wheels.some((w) => w.joint === i)) ? [i] : []));
    let turned = 0;
    for (let i = 0; i < 24 * 5; i++) turned += kin.turnJoint(joint, step, undefined, step);
    kin.letGoAfterDrag();
    expect(turned).toBeCloseTo(24 * 5 * step, 6);
    expect(Math.abs(kin.loopTravel(0))).toBeCloseTo(turned * 51.2, 3);
    for (const j of others) expect(Math.abs(kin.jointAngles[j])).toBeLessThan(1e-3); // the bucket arm and the rest stay put
  });
});

describe('950 Fork-Lift Truck', () => {
  const { mech, kin, bodyOf, turn, angleOf, frameMoved, turntables } = load('models/950-Fork Lift.mpd');
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
  const { parts, mech, kin, bodyOf, turn, angleOf, frameMoved, turntables } = load('models/952-Tractor.mpd');

  it('is fully attached: its big rear wheels are tyres, and two plates stand on edge between studs', () => {
    expect(mech.loose).toEqual([]);
    expect(kin.groundY).not.toBeNull();
    expect(mech.treads.filter((t) => t.radius > 100)).toHaveLength(2); // the big rear tyres
  });

  it('its lever raises and lowers the hitch, which hangs on both rear half axles, and the tractor stays where it is', () => {
    kin.reset();
    // The lever: a Technic brick pinned beside the seat, with a plate up from it for a handle.
    const lever = mech.bodyOf[parts.findIndex((p) => p.name === '3702.dat' && new Vector3().setFromMatrixPosition(p.matrix).distanceTo(new Vector3(-50, -109, 39)) < 1)];
    // The hitch: what turns on both rear wheels' axles, but the frame.
    const wheels = mech.treads.filter((t) => t.radius > 100).map((t) => t.body);
    const hitch = mech.bodies.findIndex((_, b) => b !== 0 && wheels.every((w) => mech.joints.some((j) => (j.bodyA === w && j.bodyB === b) || (j.bodyA === b && j.bodyB === w))));
    const tilt = () => new Vector3(0, 0, 1).transformDirection(kin.poses[hitch]).y;
    expect(Math.abs(turn(lever, 0.3))).toBeCloseTo(0.3, 6);
    const up = tilt();
    expect(Math.abs(up)).toBeGreaterThan(0.05);
    expect(Math.abs(turn(lever, -0.6))).toBeCloseTo(0.6, 6);
    expect(Math.sign(tilt())).toBe(-Math.sign(up));
    expect(frameMoved()).toBeLessThan(1e-6);
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
    const wheel = bodyOf('952-3739c01.dat');
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

  it('steered 40 degrees either way, a turn of the rear wheels still takes it round, its tyres scrubbing sideways by up to the 20% its file allows', () => {
    expect(kin.scrub).toBe(0.2);
    for (const way of [1, -1]) {
      kin.reset();
      turn(bodyOf('3712.dat'), way * 4); // the steering column
      const [a] = turntables().map(angleOf);
      expect(Math.abs(a) * (180 / Math.PI)).toBeGreaterThan(40);
      const wheel = bodyOf('952-3739c01.dat');
      const joint = kin.parentLink(wheel)!.joint;
      kin.holdWhatTheDragDoesntNeed(wheel, () => kin.jointMotion(joint) !== null);
      let turned = 0;
      for (let i = 0; i < 20; i++) turned += kin.turnJoint(joint, 0.05);
      kin.letGoAfterDrag();
      expect(Math.abs(turned)).toBeCloseTo(1, 6);
    }
  });
});

describe('956 Auto Chassis', () => {
  const { mech, kin, bodyOf, turn, angleOf, frameMoved, turntables } = load('models/956-Auto Chassis.mpd');
  // The rear axle: both rear tyres on one body, with no differential between them.
  const rearAxle = mech.treads.find((t) => mech.treads.filter((u) => u.body === t.body).length === 2)!.body;

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

  it('a turn of a front wheel rolls it one big tyre round, and runs its four-cylinder engine: each piston through its 32 LDU stroke', () => {
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

  it('at full lock either way, a turn of the rear axle still takes it round, its tyres scrubbing sideways by up to the 25% its file allows', () => {
    expect(kin.scrub).toBe(0.25);
    for (const way of [1, -1]) {
      kin.reset();
      turn(bodyOf('3736.dat'), way * 10); // as far as the steering rack goes
      const wheel = rearAxle;
      const joint = kin.parentLink(wheel)!.joint;
      kin.holdWhatTheDragDoesntNeed(wheel, () => kin.jointMotion(joint) !== null);
      let turned = 0;
      for (let i = 0; i < 20; i++) turned += kin.turnJoint(joint, 0.05);
      kin.letGoAfterDrag();
      expect(Math.abs(turned)).toBeCloseTo(1, 6);
    }
  });

  it('driven round and round in a circle, as Ctrl-click does, it stays level on its tyres', () => {
    kin.reset();
    turn(bodyOf('3736.dat'), 0.5);
    const wheel = rearAxle;
    const joint = kin.parentLink(wheel)!.joint;
    kin.holdWhatTheDragDoesntNeed(wheel, () => kin.jointMotion(joint) !== null);
    const step = (15 * Math.PI) / 180; // a motor's step
    for (let i = 0; i < 24 * 6; i++) kin.turnJoint(joint, step, undefined, step); // six turns of the wheel
    kin.letGoAfterDrag();
    expect(frameMoved()).toBeGreaterThan(1000);
    const up = new Vector3(0, -1, 0).transformDirection(kin.poses[0]);
    expect(Math.acos(Math.min(1, -up.y)) * (180 / Math.PI)).toBeLessThan(0.5); // degrees from upright
  });

  it('steered, a turn of the rear axle takes it round a bend: with no differential, its rear tyres skid to make up the difference', () => {
    kin.reset();
    turn(bodyOf('3736.dat'), 0.5); // the front wheels about 7 degrees
    const wheel = rearAxle;
    const joint = kin.parentLink(wheel)!.joint;
    kin.holdWhatTheDragDoesntNeed(wheel, () => kin.jointMotion(joint) !== null);
    let turned = 0;
    for (let i = 0; i < 30; i++) turned += kin.turnJoint(joint, (2 * Math.PI) / 60);
    kin.letGoAfterDrag();
    expect(Math.abs(turned)).toBeCloseTo(Math.PI, 6);
    expect(Math.abs(Math.atan2(kin.poses[0].elements[8], kin.poses[0].elements[0]))).toBeGreaterThan(0.05);
  });
});

describe('8880 Super Car', () => {
  const { parts, mech, kin, bodyOf, turn, frameMoved } = load('models/8880-Super Car.mpd');
  // Its wheels' steering knuckles (6540b), front ones first, and how far each has turned about
  // the upright, in degrees.
  const knuckles = mech.bodies.flatMap((b, i) => (b.parts.some((p) => parts[p].name === '6540b.dat') ? [i] : []));
  const at = (body: number) => new Vector3().setFromMatrixPosition(parts[mech.bodies[body].parts[0]].matrix); // where it was built
  const steered = (body: number) => (Math.atan2(kin.poses[body].elements[8], kin.poses[body].elements[0]) * 180) / Math.PI;
  const crank = () => kin.jointAngles[kin.parentLink(bodyOf('2853.dat'))!.joint];

  it('is fully attached: hinge plates hold its bodywork at its angles, and its driveshafts turn its steered wheels through grooved balls', () => {
    expect(mech.loose).toEqual([]);
    expect(mech.couplings).toHaveLength(6); // two universal joints in the steering, four grooved balls
    expect(mech.loops).toHaveLength(1); // the chain from the gearbox to the engine
    expect(knuckles).toHaveLength(4);
  });

  it('a turn of a wheel rolls it one big tyre round, through its three differentials; in neutral its V8 stays still', () => {
    kin.reset();
    expect(Math.abs(turn(bodyOf('2998.dat'), 1))).toBeCloseTo(1, 6);
    expect(frameMoved()).toBeCloseTo(101.4, 0); // the tyre's radius
    expect(crank()).toBeCloseTo(0, 6);
  });

  it('turning the steering wheel steers the front wheels one way and the rear ones the other, about half as far, and the car stays where it is', () => {
    kin.reset();
    const front = knuckles.filter((b) => at(b).z < 0);
    const rear = knuckles.filter((b) => at(b).z > 0);
    expect(turn(bodyOf('2741.dat'), 1.5)).toBeCloseTo(1.5, 6);
    const [f1, f2] = front.map(steered);
    const [r1, r2] = rear.map(steered);
    expect(Math.sign(f1)).toBe(Math.sign(f2));
    expect(Math.sign(r1)).toBe(Math.sign(r2));
    expect(Math.sign(r1)).toBe(-Math.sign(f1));
    const ratio = (Math.abs(r1) + Math.abs(r2)) / (Math.abs(f1) + Math.abs(f2));
    expect(ratio).toBeGreaterThan(0.35);
    expect(ratio).toBeLessThan(0.65);
    expect(frameMoved()).toBeLessThan(1e-6);
  });

  it('its four-speed gearbox: each driving ring, shifted either way, puts the engine in gear with the wheels', () => {
    const rings = parts.flatMap((p, i) => (p.name === '6539.dat' ? [i] : []));
    const ratios: number[] = [];
    for (const ring of rings) {
      for (const by of [-5, 5]) {
        const shifted = parts.map((p, i) => {
          if (i !== ring) return p;
          const dir = new Vector3(0, 0, 1).transformDirection(p.matrix);
          return { ...p, matrix: new Matrix4().makeTranslation(dir.x * by, dir.y * by, dir.z * by).multiply(p.matrix) };
        });
        const m = inferMechanism(shifted, table, roles, mech.loops.map((l) => l.path));
        const k = new Kinematics(m);
        const wheel = m.bodyOf[shifted.findIndex((p) => p.name === '2998.dat')];
        const joint = k.parentLink(wheel)!.joint;
        k.holdWhatTheDragDoesntNeed(wheel, () => k.jointMotion(joint) !== null, joint);
        const turned = k.turnJoint(joint, 0.25);
        ratios.push(Math.abs(k.jointAngles[k.parentLink(m.bodyOf[shifted.findIndex((p) => p.name === '2853.dat')])!.joint] / turned));
      }
    }
    // Engine turns per turn of the wheels: 1st, 2nd, 3rd and 4th gear.
    expect(ratios.sort((a, b) => b - a).map((r) => +r.toFixed(3))).toEqual([2.25, 1.5, 0.75, 0.5]);
  });
});
