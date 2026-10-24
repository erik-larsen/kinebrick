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
//   B  bore: a bore a part may slide along (an engine cylinder's, which a piston slides in)
//   P  plain surface: a smooth surface a part may slide along (a tile's top, which a plate
//      slides on). A part may slide in a bore for as long as the two still overlap by half a
//      stud, and on a surface by a stud. KineBrick only lets parts slide where its corrections
//      say so.
//   O  ball: a towball (M) or ball socket (F), from the shadow library's spheres; the
//      cylinder is as long as the ball is wide, centred on the ball
//   K  clutch: a driving ring's clutch teeth (M) and a clutch gear's clutch face (F); where
//      they overlap, the gear turns with the ring
//   H  hinge finger: a hinge plate's finger (M) or the gap between its fingers (F), from the
//      shadow library's finger hinges; fingers of two parts that interleave turn on each other
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
  crown?: string; // has crown teeth on one face, pointing along the axis: '+' (the way dir points)
  //                or '-'. Their pitch plane goes through the gear's middle. Meshes with a spur
  //                gear whose axle crosses its own at right angles.
  worm?: number; // a worm: how far its thread advances along the axis per turn (positive for a
  //               right-handed thread about dir). Meshes with a spur gear at right angles.
  rack?: Vec3; // a rack: the way its teeth face, in the part's own coordinates. The cylinder
  //              is its pitch line, the section's length the length of its teeth, radius 0; or
  //              for a round rack (its teeth rings round a bar, facing every way), the bar's
  //              axis, and the rings' pitch radius about it.
  width?: number; // a rack: how wide its teeth are
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
  // Track links (a chain tread's): how far each reaches out beyond the line through its pins,
  // which a track runs round its wheels along, in LDU. A track touches the ground that much
  // further out than its path.
  tracks?: Record<string, { depth: number }>;
  // Grooves a plate slides into edge first (a tipper end's): boxes in the part's own
  // coordinates. A plate whose anti-studs lie in one, its thickness across the groove, is held
  // there (see inGrooves in mechanism.ts).
  grooves?: Record<string, Groove[]>;
  // Stickers (parts the LDraw library describes as one), and flexible sections (a ribbed hose's
  // or a cable's segments): decoration, moving with what they're stuck on or lie next to (see
  // decorations in mechanism.ts).
  stickers?: string[];
}

export interface Groove {
  center: Vec3;
  along: Vec3; // unit: the groove's length
  across: Vec3; // unit: across it, the way a plate in it faces
  size: Vec3; // its length, its width across (a plate's thickness), and how deep it goes
}

export interface Slide {
  dir: Vec3;
  positions: number[];
}

// data/library-connections.json, the table for every part in the LDraw library: each cylinder
// is written once, in `cylinders`, and each part lists its cylinders by their place there.
export interface LibraryTable extends Omit<ConnectionTable, 'parts'> {
  cylinders: Cylinder[];
  parts: Record<string, number[]>;
}

// The library table as a connection table, each part with its own cylinders.
export function libraryConnections(library: LibraryTable): ConnectionTable {
  const parts: Record<string, Cylinder[]> = {};
  for (const [name, indices] of Object.entries(library.parts)) parts[name] = indices.map((i) => library.cylinders[i]);
  return { ...library, parts };
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
