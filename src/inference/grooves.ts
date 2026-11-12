// A plate slid edge first into a groove is held there.

import { Vector3 } from 'three';
import { ConnectionTable } from '../connections.ts';
import { PlacedPart } from '../ldr.ts';
import type { Connection } from '../mechanism.ts';
import { ALIGN_TOLERANCE, ANGLE_TOLERANCE, isAntiStud, type WorldCylinder } from './shared.ts';

// A plate slid edge first into a groove (a tipper end's, see ConnectionTable.grooves) is held
// there: one of its anti-studs lies in the groove (within ALIGN_TOLERANCE of its box), the
// plate facing across the groove.
export function inGrooves(parts: PlacedPart[], cyls: WorldCylinder[], table: ConnectionTable): Connection[] {
  const result: Connection[] = [];
  parts.forEach((part, g) => {
    for (const groove of table.grooves?.[part.name] ?? []) {
      const center = new Vector3(...groove.center).applyMatrix4(part.matrix);
      const along = new Vector3(...groove.along).transformDirection(part.matrix);
      const across = new Vector3(...groove.across).transformDirection(part.matrix);
      const into = new Vector3().crossVectors(along, across);
      const held = new Set<number>();
      for (const c of cyls) {
        if (c.part === g || held.has(c.part) || c.gender !== 'F' || !isAntiStud(c)) continue;
        if (new Vector3().crossVectors(c.dir, across).length() > ANGLE_TOLERANCE) continue;
        const d = new Vector3().subVectors(c.start, center);
        const inside = [along, across, into].every((axis, k) => Math.abs(d.dot(axis)) <= groove.size[k] / 2 + ALIGN_TOLERANCE);
        if (!inside) continue;
        held.add(c.part);
        result.push({ male: g, female: c.part, kind: 'rigid', from: c.start.clone(), to: c.start.clone() });
      }
    }
  });
  return result;
}
