// Which connection points fit together: axles and pins in holes, studs in anti-studs, balls in
// sockets, tyres on rims. Each fit is a connection between two parts.

import { Vector3 } from 'three';
import { Section } from '../connections.ts';
import type { Connection, ConnectionKind } from '../mechanism.ts';
import { ALIGN_TOLERANCE, ANGLE_TOLERANCE, axialOverlap, AXIS_TOLERANCE, BORE_OVERLAP, closedAtOneEnd, isAntiStud, isStud, MIN_OVERLAP, SURFACE_OVERLAP, type WorldCylinder } from './shared.ts';

// How far a rim may reach past its tyre's bore, in LDU: its flanges, either side of where the
// tyre sits (14 LDU on the 8880 Super Car's rim, as measured from its shape).
const RIM_FLANGE = 16;
// How far a ball's middle may be from its socket's, in LDU. Some sockets are deeper than the
// shadow library's sphere for them says (a wheel hub's, 2999's, is a bore an official model
// seats its driveshaft's ball 1 LDU further into).
const BALL_TOLERANCE = 2.5;
// The same for a steering link or connecting rod that would otherwise hang by one end (see
// looseFits): the 42037's left steering link is built 3 LDU behind its mirror image, its
// end 3.8 LDU from the rack's towball.
const LOOSE_BALL_TOLERANCE = 4.5;

// What happens when a male section sits inside a female section, or null if they don't fit.
// Most fits need the same radius; a thinner round pin turns loosely inside an axle hole.
function sectionFit(male: Section, female: Section): ConnectionKind | null {
  const same = Math.abs(male.radius - female.radius) < AXIS_TOLERANCE;
  if (male.shape === 'A' && female.shape === 'A' && same) return 'rigid'; // axle in axle hole
  // Tyre on rim: a seat measured from their shapes is at the rim's largest radius, which may reach
  // past the tyre's bore by a flange's height (see shapeSeat in scripts/build-connections.ts).
  if (male.shape === 'T' && female.shape === 'T' && female.radius < male.radius + AXIS_TOLERANCE && male.radius < female.radius + RIM_FLANGE) return 'rigid';
  if (male.shape === 'K' && female.shape === 'K' && same) return 'rigid'; // driving ring in a clutch gear
  if (male.shape === 'N' && female.shape === 'N' && same) return 'rigid'; // a window's glass in its frame
  if (male.shape === 'A' && female.shape === 'R' && same) return 'revolute'; // axle in round hole
  if (male.shape === 'R' && female.shape === 'R' && same) return 'revolute'; // pin in round hole
  if (male.shape === 'H' && female.shape === 'H' && same) return 'revolute'; // hinge fingers
  if ((male.shape === 'R' || male.shape === 'S') && (female.shape === 'B' || female.shape === 'P') && same) return 'slide'; // piston in its bore, plate on a tile
  if (male.shape === 'S' && female.shape === 'S' && same) return 'slide'; // square peg in a square socket
  if (male.shape === 'R' && female.shape === 'A' && male.radius < female.radius) return 'revolute'; // thin pin in axle hole
  return null;
}

// Step 4: pairs of connection points that line up.
// Open-ended cylinders (Technic holes, axles, pins, tyre seats) make rigid and revolute
// connections; studs in anti-studs make stud connections.
// `freed`: pins whose hinges turn stiffly even when `frictionRigid` (see pinsToFree).
export function findConnections(cyls: WorldCylinder[], frictionRigid: boolean, freed: Set<number>, align = ALIGN_TOLERANCE, links = new Set<number>()): Connection[] {
  const connections: Connection[] = [];
  const males = cyls.filter((c) => c.gender === 'M');
  const females = cyls.filter((c) => c.gender === 'F');
  const near = nearbyFemales(females);
  for (const m of males) {
    for (const f of near(m)) {
      if (f.part === m.part) continue;
      let c: Connection | null = null;
      if (isBall(m) && isBall(f)) c = ballConnect(m, f, links.has(m.part) || links.has(f.part) ? LOOSE_BALL_TOLERANCE : BALL_TOLERANCE);
      else if (goesInForTechnic(m) && opensForTechnic(f)) c = connect(m, f, align);
      else if (goesInForTechnic(m) && hasRound(m, 6) && isAntiStud(f)) c = studConnect(m, f, align);
      else if ((isStud(m) && (isAntiStud(f) || endsInAntiStud(f))) || (isBottomPin(m) && isHollowStud(f))) c = studConnect(m, f, align);
      else if (isStud(m) && isTechnicHole(f)) c = studInHole(m, f, align);
      else if (isSwivelPin(m) && isSwivelHole(f)) c = studInHole(m, f, align);
      else if ((isRoundSocket(m) && isRoundSocket(f)) || (isSquareSocket(m) && isSquareSocket(f))) c = connect(m, f, align);
      if (c && (isSwivelPin(m) || m.secs[0].shape === 'H')) turnsStiffly(c, frictionRigid && !freed.has(c.male));
      if (c) connections.push(c);
    }
  }
  // A pin that turns in a part's round hole isn't also a stud in it: a hole the data gives twice,
  // open (a hole a pin turns in) and closed at one end (read as an anti-stud), as a plate with a
  // hole's (3176) is, holds a pin through it only as the hole does (the 8466's strut cylinder, on a
  // long pin through two such plates). A stud joint between a pin and a part with no turn between
  // the two on the same axis (a half pin's end in the underside of a plate) still holds.
  return connections.filter((s) => s.kind !== 'stud' || !connections.some((r) => r.kind === 'revolute' && r.male === s.male && r.female === s.female && onOneAxis(r, s, align)));
}

// Whether two connections lie on one axis: parallel, and each one's line through the other's.
function onOneAxis(a: Connection, b: Connection, align: number): boolean {
  const dir = new Vector3().subVectors(a.to, a.from);
  if (dir.length() === 0) return false;
  dir.normalize();
  const other = new Vector3().subVectors(b.to, b.from);
  if (other.length() > 0 && other.normalize().cross(dir).length() > ANGLE_TOLERANCE) return false;
  const offset = new Vector3().subVectors(b.from, a.from);
  return offset.addScaledVector(dir, -offset.dot(dir)).length() <= align;
}

// Which female connection points are near enough a male one to connect to it, in the order
// they were given: those whose boxes (round the cylinder, a little bigger than it) share a
// cube of a grid with its box. Far quicker than trying every pair in a big model.
function nearbyFemales(females: WorldCylinder[]): (m: WorldCylinder) => WorldCylinder[] {
  const CELL = 40; // LDU
  const MARGIN = 5; // LDU, more than any tolerance
  const cellsOf = (c: WorldCylinder): string[] => {
    const length = c.secs.reduce((sum, sec) => sum + sec.length, 0);
    const reach = Math.max(...c.secs.map((sec) => sec.radius)) + MARGIN;
    const end = c.start.clone().addScaledVector(c.dir, length);
    const lo = [0, 1, 2].map((k) => Math.floor((Math.min(c.start.getComponent(k), end.getComponent(k)) - reach) / CELL));
    const hi = [0, 1, 2].map((k) => Math.floor((Math.max(c.start.getComponent(k), end.getComponent(k)) + reach) / CELL));
    const keys: string[] = [];
    for (let x = lo[0]; x <= hi[0]; x++) for (let y = lo[1]; y <= hi[1]; y++) for (let z = lo[2]; z <= hi[2]; z++) keys.push(`${x},${y},${z}`);
    return keys;
  };
  const grid = new Map<string, number[]>();
  females.forEach((f, i) => {
    for (const key of cellsOf(f)) grid.set(key, [...(grid.get(key) ?? []), i]);
  });
  return (m) => {
    const found = new Set<number>();
    for (const key of cellsOf(m)) for (const i of grid.get(key) ?? []) found.add(i);
    return [...found].sort((a, b) => a - b).map((i) => females[i]);
  };
}

// A towball or a ball socket.
function isBall(c: WorldCylinder): boolean {
  return c.secs.length === 1 && c.secs[0].shape === 'O';
}

// A towball in a ball socket: same size, centred on the same point.
function ballConnect(m: WorldCylinder, f: WorldCylinder, tolerance: number): Connection | null {
  if (Math.abs(m.secs[0].radius - f.secs[0].radius) > AXIS_TOLERANCE) return null;
  const centre = (c: WorldCylinder) => c.start.clone().addScaledVector(c.dir, c.secs[0].length / 2);
  const point = centre(m);
  if (point.distanceTo(centre(f)) > tolerance) return null;
  return { male: m.part, female: f.part, kind: 'ball', from: point, to: point.clone() };
}

// A male connection point that goes into Technic holes: open at both ends (an axle, a pin),
// closed at both (a bar, or a universal joint's centre's arms, which clips grip from the
// side), or an axle stub or a pin fixed to a part at one end (a connector's axle, a crankshaft's;
// a cross block's pins, a long pin's beyond its stop bush, an old steering arm's pivots), or a
// bar (a beam's angled bar, a tile's bottom pin, a minifig's sword), which goes into a pin's
// hollow or a bar hole, or a wheel hub's boss (see isHubBoss). Studs, closed at one end too,
// have neither an axle's shape nor a pin's collar or tip, are wider than a bar, and are a single
// section, so they don't count.
function goesInForTechnic(m: WorldCylinder): boolean {
  return m.caps === 'none' || m.caps === 'two' || (closedAtOneEnd(m) && (m.secs.some((s) => s.shape === 'A') || hasPinCollar(m) || hasPinTip(m) || isBar(m) || isHubBoss(m)));
}

// A wheel hub's boss, closed at its outer end: round, wider than a pin, in more than one
// section (the hub with a brake disc, 35189, which turns in a steering bearing as the open
// hub of a portal axle, 92909, does). A stud is a single section.
function isHubBoss(m: WorldCylinder): boolean {
  return m.secs.length > 1 && m.secs.every((s) => s.shape === 'R' || s.shape === 'L') && Math.max(...m.secs.map((s) => s.radius)) >= 9;
}

// A female connection point that takes Technic axles and pins: open at both ends, or an axle
// hole or a pin hole closed at the far end (the ends of an axle joiner, or an angle
// connector's, which have a thin round lip at the mouth; a panel's pin holes). Anti-studs,
// closed at one end too, have neither an axle's shape nor a pin hole's collar, so they don't
// count.
function opensForTechnic(f: WorldCylinder): boolean {
  return f.caps === 'none' || (closedAtOneEnd(f) && (f.secs.some((s) => s.shape === 'A') || hasPinCollar(f)));
}

// A Technic pin's collar and shaft, or a pin hole's counterbore and bore: round sections of
// radius 8 and 6 LDU.
function hasPinCollar(c: WorldCylinder): boolean {
  return hasRound(c, 8) && hasRound(c, 6);
}

// A Technic pin's shaft and its springy tip, with no collar (an old steering arm's pivots).
function hasPinTip(c: WorldCylinder): boolean {
  return hasRound(c, 6) && c.secs.some((s) => s.shape === 'L');
}

// A bar: round, of radius 4 LDU all along.
function isBar(c: WorldCylinder): boolean {
  return c.secs.every((s) => s.shape === 'R' && Math.abs(s.radius - 4) < AXIS_TOLERANCE);
}

function hasRound(c: WorldCylinder, radius: number): boolean {
  return c.secs.some((s) => s.shape === 'R' && Math.abs(s.radius - radius) < AXIS_TOLERANCE);
}

// A bottom pin: the small peg under a 1-wide plate or tile, between its anti-studs.
function isBottomPin(c: WorldCylinder): boolean {
  return c.caps === 'one' && c.secs.length === 1 && c.secs[0].shape === 'R' && Math.abs(c.secs[0].radius - 4) < AXIS_TOLERANCE;
}

// The hole inside a hollow stud (on Technic bricks): a bottom pin plugs into it, so a 1-wide
// tile can sit half a stud off the grid, crosswise over a row of Technic bricks.
function isHollowStud(c: WorldCylinder): boolean {
  return c.caps === 'one' && c.secs.length === 1 && c.secs[0].shape === 'R' && Math.abs(c.secs[0].radius - 4) < AXIS_TOLERANCE;
}

// A swivel hinge's pin: a thin round peg with a lip at its end (a 1 x 4 swivel hinge plate's
// top half, 2430), which clicks into the thin hole of the other half (2429) and turns in it.
function isSwivelPin(c: WorldCylinder): boolean {
  const [first, ...rest] = c.secs;
  return c.caps === 'one' && first.shape === 'R' && Math.abs(first.radius - 4) < AXIS_TOLERANCE && rest.length > 0 && rest.every((s) => s.shape === 'L');
}

function isSwivelHole(c: WorldCylinder): boolean {
  return c.caps === 'none' && c.secs.length === 1 && c.secs[0].shape === 'R' && Math.abs(c.secs[0].radius - 4) < AXIS_TOLERANCE;
}

// Hinges (a swivel hinge, hinge plates' fingers) turn stiffly, like a friction pin (see
// fixPins): they hold what they're set at an angle (a seat back, a spoiler, a bumper's
// corners), unless they're the only way the model can move.
function turnsStiffly(c: Connection, frictionRigid: boolean) {
  if (frictionRigid) [c.kind, c.held] = ['rigid', true];
  else c.stiff = true;
}

// A round peg or socket closed at one end and wider than a stud, the peg turning in a socket
// its size: a turntable's two halves, a linear actuator's end in its bracket.
function isRoundSocket(c: WorldCylinder): boolean {
  return closedAtOneEnd(c) && c.secs.length === 1 && c.secs[0].shape === 'R' && c.secs[0].radius > 10;
}

// A square peg or socket closed at one end and wider than an anti-stud, the peg sliding along
// a socket its size: a rack with a beam under it, in its housing (a telescopic boom).
function isSquareSocket(c: WorldCylinder): boolean {
  return closedAtOneEnd(c) && c.secs.length === 1 && c.secs[0].shape === 'S' && c.secs[0].radius > 8;
}

// A Technic hole, round and open at both ends. A stud in one turns in it, like a pin (an old
// engine's piston turns on its connecting rod's stud), unless held on another axis too (a
// Technic plate's holes sit on studs, next to its anti-studs).
function isTechnicHole(c: WorldCylinder): boolean {
  return c.caps === 'none' && c.secs.some((s) => s.shape === 'R' && Math.abs(s.radius - 6) < AXIS_TOLERANCE);
}

// A hole that opens into an anti-stud: a headlight brick's (4070), through the brick from
// its underside, which sits on a stud as any brick does.
function endsInAntiStud(c: WorldCylinder): boolean {
  return c.secs.length > 1 && c.secs.some((s) => s.shape === 'S' && Math.abs(s.radius - 6) < AXIS_TOLERANCE);
}

// A stud sitting in an anti-stud: on the same axis, overlapping along it.
function studInHole(m: WorldCylinder, f: WorldCylinder, align = ALIGN_TOLERANCE): Connection | null {
  const overlap = axialOverlap(m, f, align);
  if (!overlap) return null;
  return { male: m.part, female: f.part, kind: 'revolute', from: overlap.from, to: overlap.to };
}

function studConnect(m: WorldCylinder, f: WorldCylinder, align = ALIGN_TOLERANCE): Connection | null {
  const overlap = axialOverlap(m, f, align);
  if (!overlap) return null;
  return { male: m.part, female: f.part, kind: 'stud', from: overlap.from, to: overlap.to };
}

function connect(m: WorldCylinder, f: WorldCylinder, align = ALIGN_TOLERANCE): Connection | null {
  // Same axis: parallel, and the female's start lies on the male's line.
  if (new Vector3().crossVectors(m.dir, f.dir).length() > ANGLE_TOLERANCE) return null;
  const offset = new Vector3().subVectors(f.start, m.start);
  const along = offset.dot(m.dir);
  const sideways = offset.clone().addScaledVector(m.dir, -along).length();
  if (sideways > align) return null;

  // Walk both cylinders' sections, measured as distances along the male's axis.
  const sign = f.dir.dot(m.dir) > 0 ? 1 : -1;
  let total = 0;
  let kind: ConnectionKind = 'revolute';
  let lo = Infinity;
  let hi = -Infinity;
  let mPos = 0;
  for (const ms of m.secs) {
    const mEnd = mPos + ms.length;
    let fPos = along;
    for (const fs of f.secs) {
      const fEnd = fPos + sign * fs.length;
      const overlap = Math.min(mEnd, Math.max(fPos, fEnd)) - Math.max(mPos, Math.min(fPos, fEnd));
      const fit = sectionFit(ms, fs);
      if (overlap > 0 && fit) {
        total += overlap;
        if (fit === 'rigid' || (fit === 'slide' && kind === 'revolute')) kind = fit;
        lo = Math.min(lo, Math.max(mPos, Math.min(fPos, fEnd)));
        hi = Math.max(hi, Math.min(mEnd, Math.max(fPos, fEnd)));
      }
      fPos = fEnd;
    }
    mPos = mEnd;
  }
  if (total < MIN_OVERLAP) return null;
  // A motor's output turns in it, stiffly: its gearbox holds it unless nothing else can move.
  const motor = kind === 'rigid' && (m.turns || f.turns);
  if (motor) kind = 'revolute';

  const from = m.start.clone().addScaledVector(m.dir, lo);
  let extents: Connection['extents'];
  if (kind === 'slide') {
    // Measured along from -> to, from `from`.
    const length = (c: WorldCylinder) => c.secs.reduce((sum, sec) => sum + sec.length, 0);
    const fEnd = along + sign * length(f);
    const overlap = f.secs.some((sec) => sec.shape === 'P') ? SURFACE_OVERLAP : BORE_OVERLAP;
    extents = { male: [-lo, length(m) - lo], female: [Math.min(along, fEnd) - lo, Math.max(along, fEnd) - lo], overlap };
  }
  return { male: m.part, female: f.part, kind, from, to: m.start.clone().addScaledVector(m.dir, hi), extents, ...(motor ? { stiff: true, motor: true } : {}) };
}
