// Shared description of a connection point, as stored in data/connections.json.
//
// Every connection point is a cylinder: a hole, an axle, a pin, a stud. It runs from
// `start` along `dir` and is made of sections laid end to end, each with its own
// cross-section shape and radius. All numbers are in LDraw units (LDU), in the part's
// own coordinates.

export type Vec3 = [number, number, number];

// Cross-section shapes. R, A and S come from the LDCad shadow library; T is kinebrick's own.
//   R  round (Technic hole, pin, stud)
//   A  axle-shaped (cross)
//   S  square
//   T  tyre seat (where a tyre sits on a rim)
export interface Section {
  shape: string;
  radius: number;
  length: number;
}

export interface Cylinder {
  gender: 'M' | 'F'; // M = sticks out (axle, pin, stud), F = receives (hole)
  caps: string; // 'none' = open at both ends, as for Technic holes, axles and pins
  start: Vec3;
  dir: Vec3; // unit vector
  secs: Section[];
}

export interface ConnectionTable {
  about: string;
  parts: Record<string, Cylinder[]>;
}

export function cylinderLength(cyl: Cylinder): number {
  let total = 0;
  for (const sec of cyl.secs) total += sec.length;
  return total;
}

// LDraw file references are case-insensitive and may use backslashes.
export function normalizePartName(name: string): string {
  return name.trim().toLowerCase().replace(/\\/g, '/');
}
