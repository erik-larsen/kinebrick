// Shared description of a connection point, as stored in data/connections.json.
//
// Every connection point is a cylinder: a hole, an axle, a pin, a stud. It runs from
// `start` along `dir` and is made of sections laid end to end, each with its own
// cross-section shape and radius. All numbers are in LDraw units (LDU), in the part's
// own coordinates.

export type Vec3 = [number, number, number];

// Cross-section shapes. R, A and S come from the LDCad shadow library; the rest are KineBrick's own.
//   R  round (Technic hole, pin, stud)
//   A  axle-shaped (cross)
//   S  square
//   T  tyre seat (where a tyre sits on a rim)
//   W  tread (where a tyre touches the ground; worked out from the tyre's shape)
//   L  a flexible bit (a pin's springy tip, a driving ring's click-bump): fits nothing
//   B  bore: a round bore a part may slide along (an engine cylinder's, which a piston slides
//      in). KineBrick only lets parts slide where its corrections say so.
//   O  ball: a towball (M) or ball socket (F), from the shadow library's spheres; the
//      cylinder is as long as the ball is wide, centred on the ball
//   K  clutch: a driving ring's clutch teeth (M) and a clutch gear's clutch face (F); where
//      they overlap, the gear turns with the ring
//   G  gear: radius is the pitch radius (where the teeth of two meshing gears meet),
//      length is the width of the teeth
export interface Section {
  shape: string;
  radius: number;
  length: number;
  // Gears only:
  teeth?: number;
  spur?: boolean; // has straight teeth around its edge, for gears on parallel axles (default true)
  bevel?: string; // has bevel teeth facing along the axis: '+' (the way dir points), '-', or 'both'
  apex?: number; // for bevel teeth: how far from the gear's middle, along the axis, the
  //               tip of its 45 degree pitch cone is. Two bevel gears mesh when their tips meet.
  worm?: number; // a worm: how far its thread advances along the axis per turn (positive for a
  //               right-handed thread about dir). Meshes with a spur gear at right angles.
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
  // Parts that slide along something they sit on, into set positions (a gearbox's driving
  // ring): the direction they slide (in the part's own coordinates), and the positions, as
  // distances of the part's middle from the middle of what it sits on, along that direction.
  slides?: Record<string, Slide>;
}

export interface Slide {
  dir: Vec3;
  positions: number[];
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
