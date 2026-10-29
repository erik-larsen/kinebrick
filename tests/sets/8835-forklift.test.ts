import { Matrix4, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { load } from './load.ts';

describe('8835 Forklift', () => {
  const { parts, mech, kin, bodyOf, turn, frameMoved } = load('models/8835-Forklift.mpd');
  const crank = bodyOf('3736.dat');
  const forks = bodyOf('2823.dat');
  const mast = bodyOf('3703.dat');
  // How far the forks have moved up, and whether they're still upright.
  const raised = () => -new Vector3().applyMatrix4(kin.poses[forks]).y;
  const upright = () => new Vector3().setFromMatrixColumn(new Matrix4().extractRotation(kin.poses[forks]), 1).y;

  it('hooks its fork carriage to both ends of its chain, sliding up and down the mast', () => {
    expect(mech.loops).toHaveLength(1);
    const [chain] = mech.loops;
    expect(chain.hooks).toHaveLength(1);
    const slide = mech.joints[chain.hooks![0].joint];
    expect(slide.kind).toBe('slide');
    expect([slide.bodyA, slide.bodyB]).toEqual([mast, forks]);
    // The carriage is attached. Only the chain tread closing the chain's gap, which the real model
    // holds between four bushes on the carriage, rides along with it, with the chain links on it.
    const tread = mech.loose.filter((i) => parts[i].name !== '3711.dat');
    expect(tread.map((i) => parts[i].name)).toEqual(['3873.dat']);
    expect(mech.bodyOf[tread[0]]).toBe(forks);
  });

  it('turning the crank raises the forks up the mast as far as the chain moves, and lowers them again', () => {
    for (const way of [-1, 1]) {
      kin.reset();
      expect(turn(crank, way * 20)).toBeCloseTo(way * 20, 6);
      // The chain's travel round its loop, which goes up the mast on the side the carriage is on.
      expect(raised()).toBeCloseTo(kin.loopTravel(0), 3);
      expect(-way * raised()).toBeGreaterThan(30);
      const moved = new Vector3().applyMatrix4(kin.poses[forks]);
      expect(Math.hypot(moved.x, moved.z)).toBeLessThan(1e-6);
      expect(upright()).toBeCloseTo(1, 9);
      expect(frameMoved()).toBeLessThan(1e-6);
    }
  });

  it('the forks rise until the chain tread reaches the top sprocket, 150 LDU up', () => {
    kin.reset();
    const turned = turn(crank, -200);
    expect(turned).toBeGreaterThan(-200);
    expect(raised()).toBeCloseTo(150, 0);
    expect(raised()).toBeCloseTo(kin.loopTravel(0), 3);
  });
});
