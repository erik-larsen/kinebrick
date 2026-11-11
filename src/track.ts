// Train track as a path: each piece of track gives its centre lines, the pieces' ends are
// joined into a graph, and a train's wheelsets follow it, each keeping to the line it is on.
// A switch has two lines that share one end, and its state picks which of them a train takes
// from that end. A crossing has two lines that cross, and a train keeps to the one it is on.
//
// The 9V track and the plastic track after it (6 studs wide, for RC and Power Functions) share
// one geometry: a straight is 16 studs long, a curve is a sixteenth of a circle of 40 studs
// radius, a switch is 32 studs long with its branch ending 16 studs to the side after one more
// curve, and a crossing is 16 studs each way.

import { Matrix4, Vector3 } from 'three';
import type { Rail } from './mechanism.ts';

const UP = new Vector3(0, -1, 0);
// The rail heads' height above the sleepers' base (LDraw y, which points down).
export const HEAD = -16;
// How close two pieces' ends must come to join (LDU): half a stud, since a layout's pieces are
// laid by hand and an oval may not quite close.
const JOIN = 10;
// A wheelset found this far (LDU) from the line it was on has jumped (the model was reset), and
// takes the nearest line afresh.
const JUMP = 40;
// The 9V curve's radius, and the angle each curve turns.
const RADIUS = 800;
const CURVE = Math.PI / 8;

// A piece of centre line in a part's own coordinates, as [x, z] at the rail heads: straight from
// `from` to `to`, or an arc that also passes through `mid`.
interface Segment {
  from: [number, number];
  to: [number, number];
  mid?: [number, number];
}

// A kind of track piece: its centre lines, each a run of segments from one end to the other.
// For a switch, the first line is the straight one and the second the branch, both starting at
// the same end; its state is 0 for straight and 1 for the branch, as the part's file draws it.
export interface PieceShape {
  system: string;
  kind: 'straight' | 'curve' | 'switch' | 'crossing';
  lines: Segment[][];
  state?: number;
}

// An arc of the 9V curve's circle in one segment: from `start`, heading `heading` (the direction
// (cos, -sin) in x and z), turning `angle` (towards -z for a positive angle at heading 0).
function arc(start: [number, number], heading: number, angle: number, radius = RADIUS): Segment {
  const turn = Math.sign(angle);
  // The circle's centre is to the side the arc turns to.
  const cx = start[0] - Math.sin(heading) * radius * turn;
  const cz = start[1] - Math.cos(heading) * radius * turn;
  const at = (h: number): [number, number] => [cx + Math.sin(h) * radius * turn, cz + Math.cos(h) * radius * turn];
  return { from: at(heading), mid: at(heading + angle / 2), to: at(heading + angle) };
}

// A smooth line from one end to another in two arcs (a biarc), each end with its heading: for a
// switch's branch, whose exact shape matters less than where it ends and which way it heads.
function biarc(p0: [number, number], h0: number, p1: [number, number], h1: number): Segment[] {
  const t0 = [Math.cos(h0), -Math.sin(h0)];
  const t1 = [Math.cos(h1), -Math.sin(h1)];
  const v = [p1[0] - p0[0], p1[1] - p0[1]];
  const t = [t0[0] + t1[0], t0[1] + t1[1]];
  const vt = v[0] * t[0] + v[1] * t[1];
  const vv = v[0] * v[0] + v[1] * v[1];
  const k = 2 * (1 - (t0[0] * t1[0] + t0[1] * t1[1]));
  const d = (-vt + Math.sqrt(vt * vt + k * vv)) / k;
  const m: [number, number] = [(p0[0] + d * t0[0] + p1[0] - d * t1[0]) / 2, (p0[1] + d * t0[1] + p1[1] - d * t1[1]) / 2];
  return [arcTo(p0, t0, m), arcTo(m, [-t1[0], -t1[1]], p1, true)];
}

// The arc that leaves `p` along `t` and reaches `q`; with `back`, the arc that arrives at `q`
// along -t (its tangent at q is t reversed), given from p to q.
function arcTo(p: [number, number], t: number[], q: [number, number], back = false): Segment {
  const [a, b] = back ? [q, p] : [p, q];
  const n = [-t[1], t[0]];
  const d = [b[0] - a[0], b[1] - a[1]];
  const r = (d[0] * d[0] + d[1] * d[1]) / (2 * (n[0] * d[0] + n[1] * d[1]));
  const c = [a[0] + n[0] * r, a[1] + n[1] * r];
  // The arc's middle: halfway round from a to b, on the side the arc runs.
  const half = [(a[0] + b[0]) / 2 - c[0], (a[1] + b[1]) / 2 - c[1]];
  const len = Math.hypot(half[0], half[1]);
  const mid: [number, number] = [c[0] + (half[0] / len) * Math.abs(r), c[1] + (half[1] / len) * Math.abs(r)];
  return { from: p, mid, to: q };
}

const straight = (length: number): Segment => ({ from: [-length / 2, 0], to: [length / 2, 0] });
const curve = (): Segment => arc([-RADIUS * Math.sin(CURVE / 2), RADIUS * Math.cos(CURVE / 2) - RADIUS], -CURVE / 2, CURVE);
// A 9V switch's lines: straight from (-320, 0) to (320, 0), and the branch to its end 16 studs
// to the side after one more curve (z negative for a right switch, as LDraw draws it).
const switchLines = (side: number): Segment[][] => [[straight(640)], biarc([-320, 0], 0, [333.853, -259.104 * side], CURVE * side)];

// Every kind of track piece Kinebrick knows, by part name (without .dat).
const SHAPES: Record<string, () => Omit<PieceShape, 'system'>> = {
  straight: () => ({ kind: 'straight', lines: [[straight(320)]] }),
  curve: () => ({ kind: 'curve', lines: [[curve()]] }),
  quarter: () => ({ kind: 'curve', lines: [[arc([0, 0], 0, Math.PI / 2)]] }),
  right: () => ({ kind: 'switch', lines: switchLines(1) }),
  left: () => ({ kind: 'switch', lines: switchLines(-1) }),
  crossing: () => ({ kind: 'crossing', lines: [[straight(320)], [{ from: [0, -160], to: [0, 160] }]] }),
};
const PIECES: Record<string, [string, string, number?]> = {
  '74746': ['9V', 'straight'],
  '2865': ['9V', 'straight'],
  '74747': ['9V', 'curve'],
  '2867': ['9V', 'curve'],
  '74747c04': ['9V', 'quarter'],
  '75541-f1': ['9V', 'right', 0],
  '75541-f2': ['9V', 'right', 1],
  '75541c01-f1': ['9V', 'right', 0],
  '75541c01-f2': ['9V', 'right', 1],
  '2859c00': ['9V', 'right', 0],
  '2859': ['9V', 'right', 0],
  '75542-f1': ['9V', 'left', 0],
  '75542-f2': ['9V', 'left', 1],
  '75542c01-f1': ['9V', 'left', 0],
  '75542c01-f2': ['9V', 'left', 1],
  '2861c00': ['9V', 'left', 0],
  '2861': ['9V', 'left', 0],
  '32087': ['9V', 'crossing'],
  '53401': ['plastic', 'straight'],
  '53400': ['plastic', 'curve'],
  '53400c04': ['plastic', 'quarter'],
};

// A part's shape as track, or null if it isn't track Kinebrick knows.
export function trackPiece(name: string): PieceShape | null {
  const key = name.toLowerCase().replace(/\.dat$/, '').replace(/^.*[\\/]/, '');
  const known = PIECES[key];
  if (!known) return null;
  const [system, shape, state] = known;
  return { system, ...SHAPES[shape](), ...(state !== undefined ? { state } : {}) };
}

// ---------------------------------------------------------------------------
// The track as a graph

// A centre line placed in the model: its rails (straights and arcs, see Rail) end to end, how
// long each is, and its two ends.
export interface TrackLine {
  part: number;
  rails: Rail[];
  lengths: number[];
  length: number;
  ends: { point: Vector3; out: Vector3 }[]; // its start and end, each with the way out of the line there (level)
}

// One end of a line: the line, and 0 for its start or 1 for its end.
type End = [number, number];

// A switch: its part, its two lines (straight and branch, sharing their starts), and its state
// (0 straight, 1 branch).
export interface TrackSwitch {
  part: number;
  lines: [number, number];
  state: number;
}

// Where a wheelset is on the track: the line, and how far along it.
interface Place {
  line: number;
  s: number;
}

export class Track {
  lines: TrackLine[] = [];
  switches: TrackSwitch[] = [];
  // For each line's start and end, the ends of other pieces' lines it meets.
  links: End[][][] = [];
  // Where each wheelset was last found, by its key (see near).
  places = new Map<number, Place>();

  // Every rail of every line: the track's centreline piece by piece (see Rail).
  rails(): Rail[] {
    return this.lines.flatMap((l) => l.rails);
  }

  // The rail heads' height (LDraw y), where most of the track is.
  head(): number {
    const ys = this.lines.map((l) => l.rails[0].from.y).sort((a, b) => a - b);
    return ys[Math.floor(ys.length / 2)];
  }

  // The switch whose part this is, or undefined.
  switchOf(part: number): TrackSwitch | undefined {
    return this.switches.find((s) => s.part === part);
  }

  // Flips a switch to its other state: a train taking it from its shared end then goes the
  // other way. A wheelset already on one of its lines stays on it.
  flip(part: number) {
    const s = this.switchOf(part);
    if (s) s.state = 1 - s.state;
  }

  // Where along a line a point is nearest, measured level, with the line's direction there, as
  // `s` beyond the line's ends if the point lies past them (along the end's tangent).
  // (Past its ends only if `open`: else the nearest point is on the line itself.)
  private project(line: number, point: Vector3, frame: Matrix4, open = true) {
    const l = this.lines[line];
    let best = { s: 0, q: new Vector3(), t: new Vector3(), curvature: 0, distance: Infinity };
    let before = 0;
    for (let i = 0; i < l.rails.length; i++) {
      const found = onRail(l.rails[i], point, frame, open && i === 0, open && i === l.rails.length - 1);
      const off = new Vector3().subVectors(point, found.q);
      off.addScaledVector(UP, -off.dot(UP));
      const distance = off.length();
      if (distance < best.distance - 1e-9) best = { ...found, s: before + found.s, distance };
      before += l.lengths[i];
    }
    return best;
  }

  // The point at `s` along a line (on the rail heads), and the direction along it there.
  pointAt(line: number, s: number): { point: Vector3; t: Vector3 } {
    const l = this.lines[line];
    let left = Math.max(0, Math.min(l.length, s));
    for (let i = 0; i < l.rails.length; i++) {
      const rail = l.rails[i];
      if (left > l.lengths[i] && i < l.rails.length - 1) {
        left -= l.lengths[i];
        continue;
      }
      if (rail.center === undefined) {
        const t = new Vector3().subVectors(rail.to, rail.from).normalize();
        return { point: rail.from.clone().addScaledVector(t, left), t };
      }
      const a = new Vector3().subVectors(rail.from, rail.center);
      const b = new Vector3().subVectors(rail.to, rail.center);
      const turn = Math.sign(new Vector3().crossVectors(a, b).dot(UP)) || 1;
      const radial = a.clone().applyAxisAngle(UP, (turn * left) / rail.radius!);
      const t = new Vector3().crossVectors(UP, radial).multiplyScalar(turn).normalize();
      return { point: rail.center.clone().add(radial), t };
    }
    return { point: l.ends[0].point.clone(), t: l.ends[0].out.clone().negate() };
  }

  // Goes `distance` along the track from `s` along a line, forwards (along the line) or back if
  // `distance` is negative, on through the lines that meet its ends (taking each switch the way
  // its state picks). Where it ends up: the line, how far along it, and which way along it is
  // still forwards (1 or -1). Stops at a buffer, `short` of the distance by what it couldn't go.
  walk(line: number, s: number, distance: number): { line: number; s: number; dir: number; short: number } {
    let dir = Math.sign(distance) || 1;
    let left = Math.abs(distance);
    for (let hop = 0; hop < 1000; hop++) {
      const length = this.lines[line].length;
      const room = dir > 0 ? length - s : s;
      if (left <= room) return { line, s: s + dir * left, dir, short: 0 };
      const next = this.beyond(line, dir > 0 ? 1 : 0);
      if (!next) return { line, s: dir > 0 ? length : 0, dir, short: left - room };
      left -= room;
      line = next[0];
      // Entering a line at its start goes along it; at its end, back along it.
      dir = next[1] === 0 ? 1 : -1;
      s = dir > 0 ? 0 : this.lines[line].length;
    }
    return { line, s, dir, short: 0 };
  }

  // The line a train goes on to past one end of a line, or null at a buffer (a dead end): the
  // other piece's line that meets it there, or of a switch's two, the one its state picks.
  beyond(line: number, end: number): [number, number] | null {
    const ends = this.links[line][end];
    if (ends.length === 0) return null;
    if (ends.length === 1) return ends[0];
    const sw = this.switches.find((s) => s.lines.includes(ends[0][0]));
    return ends.find(([l]) => sw && l === sw.lines[sw.state]) ?? ends[0];
  }

  // Where the track's centreline passes nearest a wheelset's middle (see nearestRail in
  // kinematics.ts), with the track placed by `frame`: the wheelset keeps to the line it was on,
  // going on to the next where it passes an end. `key` names the wheelset; the first time, it
  // takes the nearest line.
  near(point: Vector3, frame: Matrix4, key: number): { t: Vector3; n: Vector3; offset: number; curvature: number } | null {
    if (this.lines.length === 0) return null;
    let place = this.places.get(key);
    let found = place ? this.project(place.line, point, frame) : null;
    // The first time, or after a jump (the model reset), the nearest line; where a switch's two
    // lines lie together, the one its state picks.
    if (!place || !found || found.distance > JUMP) {
      let best: { line: number; distance: number } | null = null;
      for (let line = 0; line < this.lines.length; line++) {
        const sw = this.switches.find((s) => s.lines.includes(line));
        const distance = this.project(line, point, frame, false).distance + (!sw || sw.lines[sw.state] === line ? 0 : 0.5);
        if (!best || distance < best.distance) best = { line, distance };
      }
      place = { line: best!.line, s: 0 };
      found = this.project(place.line, point, frame);
    }
    // Past an end, on to the next line, as many times as it takes (a step may cross a short
    // piece). At a buffer (a dead end), the line runs on along its end's tangent.
    for (let hop = 0; hop < 8; hop++) {
      const end = found.s < 0 ? 0 : found.s > this.lines[place.line].length ? 1 : -1;
      if (end < 0) break;
      const next = this.beyond(place.line, end);
      if (!next) break;
      place = { line: next[0], s: 0 };
      found = this.project(place.line, point, frame);
    }
    place.s = found.s;
    this.places.set(key, place);
    const n = new Vector3().crossVectors(UP, found.t).normalize();
    const off = new Vector3().subVectors(point, found.q);
    off.addScaledVector(UP, -off.dot(UP));
    return { t: found.t, n, offset: off.dot(n), curvature: found.curvature };
  }

  // Whether any of these wheelsets (each its key and middle) has gone past a buffer: the end of
  // a line that meets no other.
  pastBuffer(wheelsets: [number, Vector3][], frame: Matrix4): boolean {
    return wheelsets.some(([key, point]) => {
      this.near(point, frame, key);
      const place = this.places.get(key)!;
      return (place.s < 0 && !this.beyond(place.line, 0)) || (place.s > this.lines[place.line].length && !this.beyond(place.line, 1));
    });
  }

  // Where a wheelset is now, as last found (see near): its line and how far along it.
  placeOf(key: number): { line: number; s: number } | undefined {
    return this.places.get(key);
  }

  // Forgets where the wheelsets were, so each takes the nearest line again (after the model is
  // reset or reloaded).
  forget() {
    this.places.clear();
  }
}

// Where on one rail a point is nearest, measured level: how far along it (`s`, beyond its ends
// along their tangents if `openStart` or `openEnd`, else clamped), the point on it, its
// direction there (from `from` to `to`) and its curvature (turning to the left of the direction,
// positive).
function onRail(rail: Rail, point: Vector3, frame: Matrix4, openStart: boolean, openEnd: boolean) {
  const from = rail.from.clone().applyMatrix4(frame);
  const to = rail.to.clone().applyMatrix4(frame);
  const level = (v: Vector3) => v.clone().addScaledVector(UP, -v.dot(UP));
  if (rail.center === undefined) {
    const d = level(new Vector3().subVectors(to, from));
    const length = d.length();
    d.divideScalar(length);
    let s = level(new Vector3().subVectors(point, from)).dot(d);
    if (!openStart) s = Math.max(0, s);
    if (!openEnd) s = Math.min(length, s);
    return { s, q: from.clone().addScaledVector(d, s), t: d, curvature: 0 };
  }
  const center = rail.center.clone().applyMatrix4(frame);
  const r = level(new Vector3().subVectors(point, center));
  const a = level(new Vector3().subVectors(from, center));
  const b = level(new Vector3().subVectors(to, center));
  const turn = Math.sign(new Vector3().crossVectors(a, b).dot(UP)) || 1;
  const angle = (u: Vector3, v: Vector3) => Math.atan2(new Vector3().crossVectors(u, v).dot(UP) * turn, u.dot(v));
  const sweep = angle(a, b);
  const radius = rail.radius!;
  let at = angle(a, r);
  // Past an end, along its tangent.
  const tangentAt = (radial: Vector3) => new Vector3().crossVectors(UP, radial).multiplyScalar(turn).normalize();
  const middle = sweep / 2;
  // The angle measured from the arc's middle, so a point behind the start reads as before it.
  if (at - middle > Math.PI) at -= 2 * Math.PI;
  if (at - middle < -Math.PI) at += 2 * Math.PI;
  if (at < 0) {
    const t = tangentAt(a.clone().normalize());
    const q = center.clone().addScaledVector(a.clone().normalize(), radius);
    q.y = from.y;
    const s = level(new Vector3().subVectors(point, q)).dot(t);
    return openStart ? { s: Math.min(0, s), q: q.clone().addScaledVector(t, Math.min(0, s)), t, curvature: 0 } : { s: 0, q, t, curvature: turn / radius };
  }
  if (at > sweep) {
    const t = tangentAt(b.clone().normalize());
    const q = center.clone().addScaledVector(b.clone().normalize(), radius);
    q.y = from.y;
    const s = level(new Vector3().subVectors(point, q)).dot(t);
    const length = radius * sweep;
    return openEnd ? { s: length + Math.max(0, s), q: q.clone().addScaledVector(t, Math.max(0, s)), t, curvature: 0 } : { s: length, q, t, curvature: turn / radius };
  }
  const radial = r.clone().normalize();
  const q = center.clone().addScaledVector(radial, radius);
  q.y = from.y;
  return { s: radius * at, q, t: tangentAt(radial), curvature: turn / radius };
}

// The circle through three points, seen from above (in x and z), at the first point's height.
function circleThrough(a: Vector3, b: Vector3, c: Vector3): { center: Vector3; radius: number } {
  const d = 2 * (a.x * (b.z - c.z) + b.x * (c.z - a.z) + c.x * (a.z - b.z));
  const [a2, b2, c2] = [a.x * a.x + a.z * a.z, b.x * b.x + b.z * b.z, c.x * c.x + c.z * c.z];
  const x = (a2 * (b.z - c.z) + b2 * (c.z - a.z) + c2 * (a.z - b.z)) / d;
  const z = (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d;
  return { center: new Vector3(x, a.y, z), radius: Math.hypot(a.x - x, a.z - z) };
}

// The track of a model's parts: every piece of track Kinebrick knows, its lines placed, their
// ends joined. Ends that come within JOIN of each other, facing each other, are moved to meet
// halfway, so the centreline runs on without a step (a bogie's two axles, one each side of a
// step, couldn't both keep to it); then each arc is the circle through its ends and middle as
// placed (a layout often places a curve with its rotation rounded, which stretches it a little).
// Null if the model has no track.
export function buildTrack(parts: { name: string; matrix: Matrix4 }[]): Track | null {
  const track = new Track();
  // Each line's segments as placed: start, middle (for an arc) and end points.
  const placed: { part: number; points: { from: Vector3; mid?: Vector3; to: Vector3 }[] }[] = [];
  parts.forEach((p, part) => {
    const shape = trackPiece(p.name);
    if (!shape) return;
    const at = ([x, z]: [number, number]) => new Vector3(x, HEAD, z).applyMatrix4(p.matrix);
    const first = placed.length;
    for (const line of shape.lines) placed.push({ part, points: line.map((seg) => ({ from: at(seg.from), ...(seg.mid ? { mid: at(seg.mid) } : {}), to: at(seg.to) })) });
    if (shape.kind === 'switch') track.switches.push({ part, lines: [first, first + 1], state: shape.state ?? 0 });
  });
  if (placed.length === 0) return null;
  // Each line's ends, with the way out of the line there.
  const endOf = (line: number, end: number) => {
    const pts = placed[line].points;
    const seg = end === 0 ? pts[0] : pts[pts.length - 1];
    const point = end === 0 ? seg.from : seg.to;
    const inner = end === 0 ? (seg.mid ?? seg.to) : (seg.mid ?? seg.from);
    const out = new Vector3().subVectors(point, inner);
    out.addScaledVector(UP, -out.dot(UP)).normalize();
    // For an arc, the way out is along its tangent there.
    if (seg.mid) out.copy(tangentOut(seg.from, seg.mid, seg.to, end));
    return { point, out };
  };
  track.links = placed.map(() => [[], []]);
  const ends: { line: number; end: number; point: Vector3; out: Vector3 }[] = [];
  placed.forEach((_, line) => [0, 1].forEach((end) => ends.push({ line, end, ...endOf(line, end) })));
  // Ends that meet: other pieces', near, facing each other. Shared ends of a switch's lines are
  // moved together, as one.
  for (let i = 0; i < ends.length; i++) {
    for (let j = i + 1; j < ends.length; j++) {
      const [a, b] = [ends[i], ends[j]];
      if (placed[a.line].part === placed[b.line].part) continue;
      if (a.point.distanceTo(b.point) >= JOIN || a.out.dot(b.out) > -0.9) continue;
      track.links[a.line][a.end].push([b.line, b.end]);
      track.links[b.line][b.end].push([a.line, a.end]);
    }
  }
  // Meet halfway: each end goes to the middle of every end it meets (once each way round).
  for (const e of ends) {
    const others = track.links[e.line][e.end].map(([l, k]) => ends.find((x) => x.line === l && x.end === k)!.point);
    if (others.length === 0) continue;
    const meet = others.reduce((sum, p) => sum.add(p), e.point.clone()).multiplyScalar(1 / (others.length + 1));
    for (const p of others) p.copy(meet);
    e.point.copy(meet);
  }
  // A switch's lines share their start: wherever it moved, both go there.
  for (const s of track.switches) placed[s.lines[1]].points[0].from.copy(placed[s.lines[0]].points[0].from);
  track.lines = placed.map(({ part, points }, line) => {
    const rails: Rail[] = points.map(({ from, mid, to }) => {
      if (!mid) return { part, from, to };
      const circle = circleThrough(from, mid, to);
      return { part, from, to, center: circle.center, radius: circle.radius };
    });
    const lengths = rails.map((r) => {
      if (r.center === undefined) return r.from.distanceTo(r.to);
      const a = new Vector3().subVectors(r.from, r.center);
      const b = new Vector3().subVectors(r.to, r.center);
      return r.radius! * a.angleTo(b);
    });
    return { part, rails, lengths, length: lengths.reduce((a, b) => a + b, 0), ends: [0, 1].map((end) => ({ point: (end === 0 ? rails[0].from : rails[rails.length - 1].to).clone(), out: endOf(line, end).out })) };
  });
  return track;
}

// The way out of an arc through three points at one of its ends (0: `from`, 1: `to`), level.
function tangentOut(from: Vector3, mid: Vector3, to: Vector3, end: number): Vector3 {
  const { center } = circleThrough(from, mid, to);
  const point = end === 0 ? from : to;
  const radial = new Vector3().subVectors(point, center);
  radial.addScaledVector(UP, -radial.dot(UP));
  const t = new Vector3().crossVectors(UP, radial).normalize();
  // Of the two ways along the tangent, the one leading away from the arc's middle.
  const away = new Vector3().subVectors(point, mid);
  return t.dot(away) < 0 ? t.negate() : t;
}
