import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { Kinematics } from '../src/kinematics.ts';
import { Joint, Mechanism } from '../src/mechanism.ts';

// Joints on axes along z, at points in the x-y plane.
const pin = (bodyA: number, bodyB: number, x: number, y: number): Joint => ({ kind: 'revolute', bodyA, bodyB, from: new Vector3(x, y, 0), to: new Vector3(x, y, 10), stiff: false });

function mechanism(joints: Joint[], count: number): Mechanism {
  return {
    roles: Array.from({ length: count }, () => 'structure'),
    bodyOf: Array.from({ length: count }, (_, i) => i),
    bodies: Array.from({ length: count }, (_, i) => ({ name: i === 0 ? 'frame' : `body ${i}`, parts: [i] })),
    joints,
    connections: [],
    treads: [],
    gears: [],
    meshes: [],
    loose: [],
    couplings: [],
    loops: [],
    strings: [],
    screws: [],
  };
}

// How far joint 0 turns, tried in steps of 0.025.
function turn(kin: Kinematics, angle: number): number {
  let turned = 0;
  for (let i = 0; i < Math.round(Math.abs(angle) / 0.025); i++) {
    const t = kin.turnJoint(0, Math.sign(angle) * 0.025);
    turned += t;
    if (Math.abs(t) < 1e-9) break;
  }
  return turned;
}

// Two arms (bodies 1 and 2) on the frame, 80 LDU apart, both 40 long, joined at their ends by a
// link (3): a parallelogram. And joined again halfway along by a second link (4), pinned to the
// lower arm 1 LDU further out than the parallelogram has room for: it fits as built, and a turn
// of θ later is about θ²/2 LDU too short, as the 42039 Race Car's front corners are (an upright
// on two towballs 81 LDU apart, against arms 80 apart).
const nearlyFitting = [pin(0, 1, 0, 0), pin(0, 2, 0, 80), pin(1, 3, 40, 0), pin(2, 3, 40, 80), pin(1, 4, 20, 0), pin(2, 4, 20, 81)];

describe('a loop of rigid parts that fits only as built', () => {
  it('turns on its play: a quarter radian, where the misfit is about 0.03 LDU', () => {
    expect(turn(new Kinematics(mechanism(nearlyFitting, 5)), 0.25)).toBeCloseTo(0.25, 6);
  });

  it('stops once the misfit outgrows the play (0.1 LDU, at about 0.45 radians), and turns back', () => {
    const kin = new Kinematics(mechanism(nearlyFitting, 5));
    const out = turn(kin, 1);
    expect(out).toBeGreaterThan(0.3);
    expect(out).toBeLessThan(0.6);
    expect(turn(kin, -out)).toBeCloseTo(-out, 6);
  });
});

describe('play', () => {
  it("doesn't free a beam on two pins: it opens 20 LDU a radian, far more than play takes up", () => {
    const kin = new Kinematics(mechanism([pin(0, 1, 0, 0), pin(0, 1, 20, 0)], 2));
    expect(turn(kin, 0.25)).toBe(0);
  });

  it("doesn't take a four-bar past its dead point", () => {
    // Ground 60 (crank pivot A at the origin, rocker pivot D at x = 60), crank 20, coupler 50,
    // rocker 40, built with the crank straight up. Turned by its rocker, it stops where the
    // crank and coupler come into line, the rocker's tip 70 from A.
    const A = new Vector3(0, 0, 0);
    const D = new Vector3(60, 0, 0);
    const B = new Vector3(0, 20, 0);
    // The rocker's tip: 40 from D and 50 from B, the upper of the two.
    const tipAt = (p: Vector3, r: number, q: Vector3, s: number) => {
      const d = p.distanceTo(q);
      const a = (r * r - s * s + d * d) / (2 * d);
      const h = Math.sqrt(r * r - a * a);
      const mid = p.clone().lerp(q, a / d);
      const across = new Vector3(-(q.y - p.y), q.x - p.x, 0).normalize();
      const one = mid.clone().addScaledVector(across, h);
      const two = mid.clone().addScaledVector(across, -h);
      return one.y > two.y ? one : two;
    };
    const C = tipAt(D, 40, B, 50);
    const fourBar = [pin(0, 3, D.x, D.y), pin(0, 1, A.x, A.y), pin(1, 2, B.x, B.y), pin(2, 3, C.x, C.y)];
    // Where the rocker's tip is 70 from A: its angle about D, against where it was built.
    const limit = tipAt(D, 40, A, 70);
    const angle = (p: Vector3) => Math.atan2(p.y - D.y, p.x - D.x);
    const room = Math.abs(angle(limit) - angle(C));
    const kin = new Kinematics(mechanism(fourBar, 4));
    const way = Math.sign(angle(limit) - angle(C));
    const turned = Math.abs(turn(kin, way * Math.PI));
    expect(turned).toBeLessThan(room + 0.03);
    expect(turned).toBeGreaterThan(room - 0.15);
  });
});
