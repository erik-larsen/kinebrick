// Racks guided along their length past their gear.

import { Kinematics, nullSpace } from '../kinematics.ts';
import type { Connection, Mechanism } from '../mechanism.ts';
import { findGears, rackMesh } from './gears.ts';
import { findLooseParts, type WorldCylinder } from './shared.ts';

// Racks that need guiding: a rack that can still move with its gear held still, held by
// nothing that sets its path but the gear (a steering rack on tie rods, which in the real
// model slides in a channel of bricks). A rack whose linkage sets its path already (a tie bar
// fixed to the tops of two turntables) needs no guide, and a straight one would jam it.
// Returns the rack parts to guide.
export function racksToGuide(mech: Mechanism): Set<number> {
  const guide = new Set<number>();
  const kin = new Kinematics(mech);
  for (const mesh of mech.meshes) {
    if (mesh.kind !== 'rack') continue;
    const gear = mech.gears[mesh.gearA];
    const rack = mech.gears[mesh.gearB];
    if (mech.joints.some((j) => j.kind === 'slide' && (j.bodyA === rack.body || j.bodyB === rack.body))) continue;
    if (!kin.parentLink(gear.body)) continue;
    kin.toggleFreeze(gear.body);
    const motions = kin.freeMotions();
    kin.toggleFreeze(gear.body);
    // Against the gear, in the motions that leave everything its shaft turns in still on it: the
    // 8849 Tractor's front axle, which holds its steering shaft beside the rack, rocks on that
    // shaft, the rack sliding along it as it goes, which doesn't need a guide.
    const apart = (m: number[], a: number, b: number, k: number) => m[6 * a + k] - m[6 * b + k];
    const six = [0, 1, 2, 3, 4, 5];
    const bearings = [...new Set(mountsOf(gear.part, mech.connections).map((p) => mech.bodyOf[p]))];
    const still = nullSpace(bearings.flatMap((b) => six.map((k) => motions.map((m) => apart(m, b, gear.body, k)))), motions.length);
    const moves = still.some((c) => six.some((k) => Math.abs(c.reduce((sum, x, i) => sum + x * apart(motions[i], rack.body, gear.body, k), 0)) > 1e-6));
    if (moves) for (const g of mech.gears) if (g.face && g.body === rack.body) guide.add(g.part);
  }
  return guide;
}

// A rack held by nothing but the gear it meshes with, such as a fork-lift's carriage riding up
// its mast, slides along its length past the gear, as if guided (the bricks either side that
// keep it in line are taken as read, as for a plate sliding on tiles). Its parts connect to the
// part the gear's axle turns in by a slide; it stops where the gear reaches the end of its
// teeth.
// `guide` names more racks to guide so, though attached (see racksToGuide).
export function guidedRacks(count: number, cyls: WorldCylinder[], connections: Connection[], guide: Set<number>): Connection[] {
  const loose = new Set(findLooseParts(count, connections));
  if (loose.size === 0 && guide.size === 0) return [];
  const gears = findGears(cyls, Array.from({ length: count }, (_, i) => i));
  const guided: Connection[] = [];
  for (const rack of gears) {
    if (!rack.face || !(loose.has(rack.part) || guide.has(rack.part))) continue;
    for (const gear of gears) {
      if (gear.face || loose.has(gear.part) || !rackMesh(gear, rack)) continue;
      const [mount] = mountsOf(gear.part, connections);
      if (mount === undefined) continue;
      const from = rack.center.clone();
      guided.push({ male: rack.part, female: mount, kind: 'slide', from, to: from.clone().add(rack.axis) });
      break;
    }
  }
  return guided;
}

// The parts a gear's axle turns in: from the gear, through what's rigidly fixed to it, to the
// other side of each turning connection.
function mountsOf(gear: number, connections: Connection[]): number[] {
  const fixed = new Set([gear]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const c of connections) {
      if (c.kind !== 'rigid') continue;
      for (const [a, b] of [[c.male, c.female], [c.female, c.male]]) {
        if (fixed.has(a) && !fixed.has(b)) {
          fixed.add(b);
          grew = true;
        }
      }
    }
  }
  return connections.flatMap((c) => (c.kind !== 'revolute' || fixed.has(c.male) === fixed.has(c.female) ? [] : [fixed.has(c.male) ? c.female : c.male]));
}
