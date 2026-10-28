// Builds data/connections.json, Kinebrick's connection table.
//
// For every part used by the test models in models/, it collects the part's connection
// points (holes, axles, pins, studs) from three sources:
//   1. the LDraw parts library (ldraw/): which primitives and subparts each part is built from
//   2. the LDCad shadow library (ldcad-shadow/): snap lines attached to parts and primitives
//   3. Kinebrick's corrections (data/corrections.ldr): snap lines for what 1 and 2 miss
// It also builds data/library-connections.json, the same for every part in the LDraw library,
// for models opened from your own computer.
//
// Run with: npm run connections

import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Cylinder, Groove, Section, Slide, Vec3, normalizePartName } from '../src/connections.ts';
import { embeddedParts, parseLdr } from '../src/ldr.ts';

const LDRAW_DIR = 'ldraw';
const SHADOW_DIR = 'ldcad-shadow';
const MODELS_DIR = 'models';
const ROLES_FILE = 'data/roles.json';
const CORRECTIONS_FILE = 'data/corrections.ldr';
const OUTPUT_FILE = 'data/connections.json';
const LIBRARY_OUTPUT_FILE = 'data/library-connections.json';

// ---------------------------------------------------------------------------
// Small 3D helpers. A transform is a 3x3 matrix (row by row, as in LDraw) plus a translation.

interface Transform {
  m: number[]; // a b c d e f g h i
  t: Vec3;
}

const IDENTITY: Transform = { m: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] };

function applyMatrix(m: number[], v: Vec3): Vec3 {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

function applyTransform(tr: Transform, p: Vec3): Vec3 {
  const v = applyMatrix(tr.m, p);
  return [v[0] + tr.t[0], v[1] + tr.t[1], v[2] + tr.t[2]];
}

function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scaleVec(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s];
}

function length(a: Vec3): number {
  return Math.hypot(a[0], a[1], a[2]);
}

function determinant(m: number[]): number {
  return m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);
}

// Any unit vector perpendicular to `d`.
function perpendicular(d: Vec3): Vec3 {
  const other: Vec3 = Math.abs(d[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const c: Vec3 = [d[1] * other[2] - d[2] * other[1], d[2] * other[0] - d[0] * other[2], d[0] * other[1] - d[1] * other[0]];
  return scaleVec(c, 1 / length(c));
}

// ---------------------------------------------------------------------------
// Reading files

function readText(path: string): string | null {
  return existsSync(path) ? readFileSync(path, 'utf-8') : null;
}

// LDraw looks up a referenced file in parts/ first, then p/ (primitives), and failing those,
// among the parts a model file brings with it.
function readLdrawFile(name: string): string | null {
  return readText(join(LDRAW_DIR, 'parts', name)) ?? readText(join(LDRAW_DIR, 'p', name)) ?? embedded.get(name) ?? null;
}

function readShadowFile(name: string): string | null {
  return readText(join(SHADOW_DIR, 'parts', name)) ?? readText(join(SHADOW_DIR, 'p', name));
}

// data/corrections.ldr holds blocks of "0 FILE <part>" followed by snap lines for that part.
function readCorrections(): Map<string, string[]> {
  const result = new Map<string, string[]>();
  let current: string[] | null = null;
  for (const line of (readText(CORRECTIONS_FILE) ?? '').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith('0 FILE ')) {
      current = [];
      result.set(normalizePartName(trimmed.slice(7)), current);
    } else if (current && (trimmed.startsWith('0 !LDCAD') || trimmed.startsWith('0 !KINEBRICK'))) {
      current.push(trimmed);
    }
  }
  return result;
}

// A type 1 line: "1 colour x y z a b c d e f g h i file"
function parseReference(line: string): { name: string; transform: Transform } | null {
  const tokens = line.trim().split(/\s+/);
  if (tokens[0] !== '1' || tokens.length < 15) return null;
  const n = tokens.slice(2, 14).map(Number);
  return {
    name: normalizePartName(tokens.slice(14).join(' ')),
    transform: { m: n.slice(3, 12), t: [n[0], n[1], n[2]] },
  };
}

// ---------------------------------------------------------------------------
// Snap meta lines, e.g. "0 !LDCAD SNAP_CYL [gender=F] [secs=R 8 2 R 6 16 R 8 2] [center=true]"

interface Meta {
  kind: string; // SNAP_CYL, SNAP_INCL, SNAP_CLEAR, ...
  params: Map<string, string>;
}

function parseMeta(line: string): Meta | null {
  const match = line.match(/^0\s+!(?:LDCAD|KINEBRICK)\s+(\w+)(.*)$/);
  if (!match) return null;
  const params = new Map<string, string>();
  for (const p of match[2].matchAll(/\[(\w+)=([^\]]*)\]/g)) {
    params.set(p[1].toLowerCase(), p[2].trim());
  }
  return { kind: match[1], params };
}

function numbers(text: string | undefined, fallback: number[]): number[] {
  if (!text) return fallback;
  return text.split(/\s+/).map(Number);
}

// A GEAR line from data/corrections.ldr, e.g.
//   "0 !KINEBRICK GEAR [teeth=24] [radius=30] [width=9.5] [center=true] [ori=...]"
// as a cylinder with one G section, placed the same way as a SNAP_CYL. Bevel gears add
// [bevel=+|-|both] [apex=...], and [spur=false] if they have no straight teeth.
function gearFromMeta(meta: Meta): WorkingCylinder[] {
  const p = meta.params;
  p.set('secs', `G ${p.get('radius')} ${p.get('width')}`);
  p.set('gender', 'M');
  p.set('caps', 'none');
  const cyls = cylindersFromMeta(meta);
  for (const c of cyls) {
    const sec = c.secs[0];
    sec.teeth = Number(p.get('teeth'));
    if (p.get('spur') === 'false') sec.spur = false;
    if (p.has('bevel')) {
      sec.bevel = p.get('bevel');
      sec.apex = Number(p.get('apex'));
    }
    if (p.has('worm')) sec.worm = Number(p.get('worm'));
    if (p.has('crown')) sec.crown = p.get('crown');
  }
  return cyls;
}

// A RACK line from data/corrections.ldr: a rack's pitch line, given directly in the part's
// coordinates, e.g.
//   "0 !KINEBRICK RACK [teeth=32] [length=256] [width=20] [pos=-116 -25 0] [dir=1 0 0] [face=0 -1 0]"
// A round rack, its teeth rings round a bar, gives the bar's axis and [radius], the rings' pitch
// radius about it.
// Stored as a cylinder along the pitch line with one G section of radius 0: its length is the
// pitch line's, and it also keeps the tooth count, the way the teeth face, and their width.
function rackFromMeta(meta: Meta): WorkingCylinder[] {
  const p = meta.params;
  const length = Number(p.get('length'));
  return [
    {
      id: '',
      gender: 'M',
      caps: 'none',
      start: numbers(p.get('pos'), [0, 0, 0]) as Vec3,
      dir: numbers(p.get('dir'), [1, 0, 0]) as Vec3,
      secs: [{ shape: 'G', radius: Number(p.get('radius') ?? 0), length, teeth: Number(p.get('teeth')), rack: numbers(p.get('face'), [0, -1, 0]) as Vec3, width: Number(p.get('width')) }],
      scaleRule: 'none',
      mirrorRule: 'none',
    },
  ];
}

// A SNAP_GEN line, by its shape:
//   sphere ([bounding=sph 8])     a towball (M) or a ball socket (F), stored as a cylinder with
//                                 one O section, as long as the ball is wide and centred on it,
//                                 so it can be placed like any other cylinder
//   cylinder ([bounding=cyl 6 16]) a hinge's pin (M) or the hole it turns in (F), such as the
//                                 old hinge plates': a round section, centred; but a click
//                                 wheel connection ([group=techWhlCon1], a rim clicked onto a
//                                 hub, 2998 on 2999) is keyed, the rim turning with the hub, so
//                                 it's stored axle-shaped
// Other shapes aren't used yet.
function genFromMeta(meta: Meta): WorkingCylinder[] {
  const p = meta.params;
  const bounding = (p.get('bounding') ?? '').split(/\s+/);
  if (bounding[0] === 'sph') {
    const radius = Number(bounding[1]);
    p.set('secs', `O ${radius} ${2 * radius}`);
  } else if (bounding[0] === 'cyl') {
    p.set('secs', `${p.get('group') === 'techWhlCon1' ? 'A' : 'R'} ${bounding[1]} ${bounding[2]}`);
  } else {
    return [];
  }
  p.set('center', 'true');
  p.set('caps', 'none');
  return cylindersFromMeta(meta);
}

// A SNAP_FGR line: a finger hinge, a row of fingers along an axis, alternately pins (M) and
// gaps the other part's fingers fill (F), starting with [genderOfs], [seq] long each, of
// [radius], centred on [pos]. Stored as a cylinder per finger (section H), so a shutter's
// finger turns between its holder's (3582 in 3581), as do hinge plates'.
function fingersFromMeta(meta: Meta): WorkingCylinder[] {
  const p = meta.params;
  const lengths = (p.get('seq') ?? '').split(/\s+/).filter((x) => x).map(Number);
  if (lengths.length === 0) return [];
  const total = lengths.reduce((sum, l) => sum + l, 0);
  const radius = p.get('radius') ?? '4';
  const first = p.get('genderofs') === 'F' ? 'F' : 'M';
  const pos = numbers(p.get('pos'), [0, 0, 0]) as Vec3;
  const ori = numbers(p.get('ori'), IDENTITY.m);
  const dir = applyMatrix(ori, [0, -1, 0]); // LDCad cylinders run along the meta's -Y axis
  const result: WorkingCylinder[] = [];
  let at = -total / 2;
  lengths.forEach((length, i) => {
    const gender = i % 2 === 0 ? first : first === 'M' ? 'F' : 'M';
    result.push({ id: p.get('id') ?? '', gender, caps: 'none', start: add(pos, scaleVec(dir, at)), dir, secs: [{ shape: 'H', radius: Number(radius), length }], scaleRule: p.get('scale') ?? 'none', mirrorRule: p.get('mirror') ?? 'cor' });
    at += length;
  });
  return result;
}

// A SNAP_CLP line: a clip, which grips a bar or pin of its radius and lets it turn (a
// universal joint's ends grip its centre's arms so). Stored as a round hole.
function clipFromMeta(meta: Meta): WorkingCylinder[] {
  const p = meta.params;
  p.set('secs', `R ${p.get('radius') ?? '4'} ${p.get('length') ?? '8'}`);
  p.set('gender', 'F');
  p.set('caps', 'none');
  return cylindersFromMeta(meta);
}

// "R 8 2 R 6 16 R 8 2" -> three sections. "_L" and "L_" (a flexible bit, such as a pin's
// springy tip or a driving ring's click-bump) keep their length but become shape "L", which
// fits nothing.
function parseSections(text: string): Section[] {
  const tokens = text.split(/\s+/);
  const secs: Section[] = [];
  for (let i = 0; i + 2 < tokens.length; i += 3) {
    const shape = tokens[i] === '_L' || tokens[i] === 'L_' ? 'L' : tokens[i];
    secs.push({ shape, radius: Number(tokens[i + 1]), length: Number(tokens[i + 2]) });
  }
  return secs;
}

// "C 3 1 20 0" -> offsets in the meta's own X/Z plane, or, with three counts and three steps
// ("2 C 2 1 20 50 0"), along its X, Y and Z: a Y grid repeats a cylinder along its own axis
// (the two lugs of a linear actuator's bracket). A "C" centres that axis on pos.
function parseGrid(text: string | undefined): Vec3[] {
  if (!text) return [[0, 0, 0]];
  const tokens = text.split(/\s+/);
  const axes = tokens.filter((t) => t !== 'C').length === 6 ? 3 : 2;
  let i = 0;
  const counts: { center: boolean; count: number }[] = [];
  for (let a = 0; a < axes; a++) {
    const center = tokens[i] === 'C' ? (i++, true) : false;
    counts.push({ center, count: Number(tokens[i++]) });
  }
  const steps = counts.map(() => Number(tokens[i++]));
  // Each axis's offsets, then every combination of them.
  const along = counts.map(({ center, count }, a) => Array.from({ length: count }, (_, k) => (center ? k - (count - 1) / 2 : k) * steps[a]));
  const [xs, ys, zs] = axes === 3 ? along : [along[0], [0], along[1]];
  const offsets: Vec3[] = [];
  for (const ox of xs) for (const oy of ys) for (const oz of zs) offsets.push([ox, oy, oz]);
  return offsets;
}

// ---------------------------------------------------------------------------
// Collecting a file's cylinders

// While building, each cylinder also remembers the LDCad rules for how it may be inherited.
interface WorkingCylinder extends Cylinder {
  id: string;
  scaleRule: string; // none, YOnly, ROnly, YandR
  mirrorRule: string; // none, cor
}

// A SNAP_CYL line, expanded over its grid, in the coordinates of the file it appears in.
function cylindersFromMeta(meta: Meta): WorkingCylinder[] {
  const p = meta.params;
  const secs = parseSections(p.get('secs') ?? '');
  if (secs.length === 0) return [];
  let total = 0;
  for (const s of secs) total += s.length;

  const pos = numbers(p.get('pos'), [0, 0, 0]) as Vec3;
  const ori = numbers(p.get('ori'), IDENTITY.m);
  const center = p.get('center') === 'true';
  // An engine cylinder's bore (the shadow library groups it with the piston as "techEngine")
  // is one a piston may slide along, not a round hole for it to turn in.
  const bore = p.get('group') === 'techEngine' && p.get('gender') === 'F';
  // LDCad cylinders run along the meta's -Y axis.
  const dir = applyMatrix(ori, [0, -1, 0]);
  const firstEnd = center ? add(pos, scaleVec(dir, -total / 2)) : pos;

  const result: WorkingCylinder[] = [];
  for (const offset of parseGrid(p.get('grid'))) {
    result.push({
      id: p.get('id') ?? '',
      gender: p.get('gender') === 'F' ? 'F' : 'M',
      caps: p.get('caps') ?? 'one',
      start: add(firstEnd, applyMatrix(ori, offset)),
      dir,
      secs: secs.map((s) => ({ ...s, shape: bore && s.shape === 'R' ? 'B' : s.shape })),
      scaleRule: p.get('scale') ?? 'none',
      mirrorRule: p.get('mirror') ?? 'cor',
    });
  }
  return result;
}

// Moves a cylinder into a parent file's coordinates, following LDCad's scale and mirror
// rules. Returns null when the rules say the parent doesn't inherit it.
function transformCylinder(cyl: WorkingCylinder, tr: Transform): WorkingCylinder | null {
  const total = cyl.secs.reduce((sum, s) => sum + s.length, 0);
  const along = applyMatrix(tr.m, scaleVec(cyl.dir, total));
  const newTotal = length(along);
  const alongScale = newTotal / total;
  const radialScale = length(applyMatrix(tr.m, perpendicular(cyl.dir)));
  const near = (a: number, b: number) => Math.abs(a - b) < 0.001;

  const scaledAlong = !near(alongScale, 1);
  const scaledRadius = !near(radialScale, 1);
  if (cyl.scaleRule === 'none' && (scaledAlong || scaledRadius)) return null;
  if (cyl.scaleRule === 'YOnly' && scaledRadius) return null;
  if (cyl.scaleRule === 'ROnly' && scaledAlong) return null;
  if (cyl.mirrorRule === 'none' && determinant(tr.m) < 0) return null;

  return {
    ...cyl,
    start: applyTransform(tr, cyl.start),
    dir: scaleVec(along, 1 / newTotal),
    secs: cyl.secs.map((s) => ({ ...s, radius: s.radius * radialScale, length: s.length * alongScale })),
  };
}

const corrections = readCorrections();
const cache = new Map<string, WorkingCylinder[]>();

// The SNAP_CYL and SNAP_GEN lines in a file's shadow file, without anything inherited (used
// by SNAP_INCL).
function ownShadowCylinders(name: string): WorkingCylinder[] {
  const result: WorkingCylinder[] = [];
  for (const line of (readShadowFile(name) ?? '').split(/\r?\n/)) {
    const meta = parseMeta(line.trim());
    if (meta && meta.kind === 'SNAP_CYL') result.push(...cylindersFromMeta(meta));
    if (meta && meta.kind === 'SNAP_GEN') result.push(...genFromMeta(meta));
    if (meta && meta.kind === 'SNAP_CLP') result.push(...clipFromMeta(meta));
    if (meta && meta.kind === 'SNAP_FGR') result.push(...fingersFromMeta(meta));
  }
  return result;
}

// All cylinders of an LDraw file: inherited from the files it references, then changed by
// its shadow lines and Kinebrick's corrections, in order.
function fileCylinders(name: string): WorkingCylinder[] {
  const cached = cache.get(name);
  if (cached) return cached;
  cache.set(name, []); // guards against reference loops

  let result: WorkingCylinder[] = [];
  for (const line of (readLdrawFile(name) ?? '').split(/\r?\n/)) {
    const ref = parseReference(line);
    if (!ref) continue;
    for (const cyl of fileCylinders(ref.name)) {
      const moved = transformCylinder(cyl, ref.transform);
      if (moved) result.push(moved);
    }
  }

  const snapLines = [...(readShadowFile(name) ?? '').split(/\r?\n/), ...(corrections.get(name) ?? [])];
  for (const line of snapLines) {
    const meta = parseMeta(line.trim());
    if (!meta) continue;
    if (meta.kind === 'SNAP_CLEAR') {
      const id = meta.params.get('id') ?? '';
      result = id ? result.filter((c) => c.id.toLowerCase() !== id.toLowerCase()) : [];
    } else if (meta.kind === 'SNAP_CYL') {
      result.push(...cylindersFromMeta(meta));
    } else if (meta.kind === 'GEAR') {
      result.push(...gearFromMeta(meta));
    } else if (meta.kind === 'RACK') {
      result.push(...rackFromMeta(meta));
    } else if (meta.kind === 'SNAP_GEN') {
      result.push(...genFromMeta(meta));
    } else if (meta.kind === 'SNAP_CLP') {
      result.push(...clipFromMeta(meta));
    } else if (meta.kind === 'SNAP_FGR') {
      result.push(...fingersFromMeta(meta));
    } else if (meta.kind === 'SNAP_INCL') {
      const ref = normalizePartName(meta.params.get('ref') ?? '');
      const pos = numbers(meta.params.get('pos'), [0, 0, 0]) as Vec3;
      const ori = numbers(meta.params.get('ori'), IDENTITY.m);
      for (const offset of parseGrid(meta.params.get('grid'))) {
        const tr: Transform = { m: ori, t: add(pos, applyMatrix(ori, offset)) };
        for (const cyl of ownShadowCylinders(ref)) {
          const moved = transformCylinder(cyl, tr);
          if (moved) result.push(moved);
        }
      }
    }
    // SNAP_SPH and other kinds aren't used yet.
  }

  // A tyre or rim the corrections give no tyre seat (most of the library's): one measured from
  // its shape.
  const kind = wheelKind(name);
  if (kind && !result.some((c) => c.secs.some((sec) => sec.shape === 'T'))) {
    const seat = shapeSeat(name, kind);
    if (seat) result.push({ ...seat, id: '', scaleRule: 'none', mirrorRule: 'cor' });
  }

  // A tyre's tread, measured from its shape. Part of the tyre's own connection points, so a
  // file made of a wheel and its tyre (a shortcut) has the tread too.
  if (roles[name] === 'tyre' || kind === 'tyre') {
    const seat = result.find((c) => c.gender === 'F' && c.secs.some((sec) => sec.shape === 'T'));
    if (seat) result.push({ ...treadCylinder(name, seat), id: '', scaleRule: 'none', mirrorRule: 'cor' });
    else console.warn(`${name}: tyre without a tyre seat in data/corrections.ldr`);
  }

  cache.set(name, result);
  return result;
}

// ---------------------------------------------------------------------------
// Tyre treads, worked out from the tyre's shape

function compose(parent: Transform, child: Transform): Transform {
  const a = parent.m;
  const b = child.m;
  const m = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      m[row * 3 + col] = a[row * 3] * b[col] + a[row * 3 + 1] * b[3 + col] + a[row * 3 + 2] * b[6 + col];
    }
  }
  return { m, t: applyTransform(parent, child.t) };
}

// Every corner of every triangle and quad in an LDraw file, in that file's coordinates.
function collectVertices(name: string, tr: Transform, out: Vec3[]) {
  for (const line of (readLdrawFile(name) ?? '').split(/\r?\n/)) {
    const tokens = line.trim().split(/\s+/);
    if (tokens[0] === '1') {
      const ref = parseReference(line);
      if (ref) collectVertices(ref.name, compose(tr, ref.transform), out);
    } else if (tokens[0] === '3' || tokens[0] === '4') {
      const n = tokens.slice(2).map(Number);
      for (let i = 0; i + 2 < n.length; i += 3) out.push(applyTransform(tr, [n[i], n[i + 1], n[i + 2]]));
    }
  }
}

// What kind of wheel part a file is, by its title: a tyre ("Tyre 44/ 58 x 56 R Tractor"), a rim
// ("Wheel Rim 8 x 18 with Deep Centre Groove", "Wheel 12 x 20 with Technic Axle Hole"), or
// neither (a wheel cover, a subpart).
function wheelKind(name: string): 'tyre' | 'rim' | null {
  const title = (readLdrawFile(name) ?? '').split(/\r?\n/, 1)[0].replace(/^0\s+/, '');
  if (/^=?Tyre\b/.test(title)) return 'tyre';
  if (/^=?Wheel (Rim\b|\d)/.test(title)) return 'rim';
  return null;
}

// A tyre seat measured from a tyre's or rim's shape: around the axis it's round about (the
// coordinate axis it's thinnest along, through the middle of it), as long as the part is wide,
// at a rim's largest radius (its flanges too) or a tyre's smallest (its bore). Measured on the
// rims and tyres the corrections give seats, a rim reaches 2 to 14 LDU past its tyre's bore, so
// a tyre fits any rim it's on that reaches its bore (see sectionFit in src/mechanism.ts). Null
// for a part that isn't round.
function shapeSeat(name: string, kind: 'tyre' | 'rim'): Cylinder | null {
  const vertices: Vec3[] = [];
  collectVertices(name, IDENTITY, vertices);
  if (vertices.length === 0) return null;
  const lo: Vec3 = [Infinity, Infinity, Infinity];
  const hi: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const v of vertices) {
    for (let k = 0; k < 3; k++) {
      lo[k] = Math.min(lo[k], v[k]);
      hi[k] = Math.max(hi[k], v[k]);
    }
  }
  const extent = [0, 1, 2].map((k) => hi[k] - lo[k]);
  const axis = extent.indexOf(Math.min(...extent));
  const [a, b] = [0, 1, 2].filter((k) => k !== axis);
  if (Math.abs(extent[a] - extent[b]) > 2) return null;
  const center: Vec3 = [0, 0, 0];
  center[a] = (lo[a] + hi[a]) / 2;
  center[b] = (lo[b] + hi[b]) / 2;
  let smallest = Infinity;
  let largest = 0;
  for (const v of vertices) {
    const r = Math.hypot(v[a] - center[a], v[b] - center[b]);
    smallest = Math.min(smallest, r);
    largest = Math.max(largest, r);
  }
  const start: Vec3 = [...center];
  start[axis] = lo[axis];
  const dir: Vec3 = [0, 0, 0];
  dir[axis] = 1;
  return { gender: kind === 'rim' ? 'M' : 'F', caps: 'none', start, dir, secs: [{ shape: 'T', radius: kind === 'rim' ? largest : smallest, length: extent[axis] }] };
}

// A tyre's tread: the cylinder around its seat axis that encloses the whole tyre. Its radius
// is how far the tyre reaches from its axle, which sets how far the tyre rolls per turn.
function treadCylinder(name: string, seat: Cylinder): Cylinder {
  const vertices: Vec3[] = [];
  collectVertices(name, IDENTITY, vertices);
  let radius = 0;
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of vertices) {
    const offset: Vec3 = [v[0] - seat.start[0], v[1] - seat.start[1], v[2] - seat.start[2]];
    const along = offset[0] * seat.dir[0] + offset[1] * seat.dir[1] + offset[2] * seat.dir[2];
    radius = Math.max(radius, length(add(offset, scaleVec(seat.dir, -along))));
    lo = Math.min(lo, along);
    hi = Math.max(hi, along);
  }
  return {
    gender: 'M',
    caps: 'none',
    start: add(seat.start, scaleVec(seat.dir, lo)),
    dir: seat.dir,
    secs: [{ shape: 'W', radius, length: hi - lo }],
  };
}

// ---------------------------------------------------------------------------
// Which parts go in the table

// The model files in models/.
function modelTexts(): string[] {
  return readdirSync(MODELS_DIR)
    .filter((file) => /\.(ldr|mpd)$/i.test(file))
    .map((file) => readFileSync(join(MODELS_DIR, file), 'utf-8'));
}

// Parts that model files bring with them (unofficial parts, in the official model repository).
const embedded = new Map(modelTexts().flatMap((text) => [...embeddedParts(text)]));

// Every part used by the models in models/, with their submodels flattened.
function partsInModels(): string[] {
  const parts = new Set<string>();
  const isPrimitive = (name: string) => !existsSync(join(LDRAW_DIR, 'parts', name)) && existsSync(join(LDRAW_DIR, 'p', name));
  // A part read as its pieces (role "split") brings those instead.
  const piecesOf = (name: string) => (roles[name] === 'split' ? (readLdrawFile(name) ?? '').split(/\r?\n/).filter((line) => /^\s*1\s/.test(line)) : null);
  for (const text of modelTexts()) for (const p of parseLdr(text, isPrimitive, piecesOf)) parts.add(p.name);
  return [...parts].sort();
}

// SLIDE lines in data/corrections.ldr: parts that slide into set positions, e.g.
//   "0 !KINEBRICK SLIDE [positions=-10 0 10] [ori=...]"   (the part slides along the meta's -y)
function slidesFromCorrections(): Record<string, Slide> {
  const slides: Record<string, Slide> = {};
  for (const [name, lines] of corrections) {
    for (const line of lines) {
      const meta = parseMeta(line);
      if (!meta || meta.kind !== 'SLIDE') continue;
      const ori = numbers(meta.params.get('ori'), IDENTITY.m);
      slides[name] = { dir: applyMatrix(ori, [0, -1, 0]).map(round) as Vec3, positions: numbers(meta.params.get('positions'), [0]) };
    }
  }
  return slides;
}

// TRACK lines in data/corrections.ldr: track links, and how far each reaches out beyond the
// line through its pins, e.g. "0 !KINEBRICK TRACK [depth=8]".
function tracksFromCorrections(): Record<string, { depth: number }> {
  const tracks: Record<string, { depth: number }> = {};
  for (const [name, lines] of corrections) {
    for (const line of lines) {
      const meta = parseMeta(line);
      if (meta && meta.kind === 'TRACK') tracks[name] = { depth: Number(meta.params.get('depth')) };
    }
  }
  return tracks;
}

// GROOVE lines in data/corrections.ldr: grooves a plate slides into edge first, as boxes, e.g.
// "0 !KINEBRICK GROOVE [pos=-43.4 36.6 0] [ori=...] [size=80 8 12]": the box's middle, its
// axes (the ori matrix's columns: along the groove, across it, into it) and its size along
// each.
function groovesFromCorrections(): Record<string, Groove[]> {
  const grooves: Record<string, Groove[]> = {};
  for (const [name, lines] of corrections) {
    for (const line of lines) {
      const meta = parseMeta(line);
      if (!meta || meta.kind !== 'GROOVE') continue;
      const ori = numbers(meta.params.get('ori'), IDENTITY.m);
      (grooves[name] ??= []).push({
        center: numbers(meta.params.get('pos'), [0, 0, 0]) as Vec3,
        along: applyMatrix(ori, [1, 0, 0]).map(round) as Vec3,
        across: applyMatrix(ori, [0, 1, 0]).map(round) as Vec3,
        size: numbers(meta.params.get('size'), [0, 0, 0]) as Vec3,
      });
    }
  }
  return grooves;
}

// ---------------------------------------------------------------------------
// Writing the table, one cylinder per line so diffs stay readable.

function round(n: number): number {
  const r = Math.round(n * 1000) / 1000;
  return r === 0 ? 0 : r; // no "-0"
}

function cylinderJson(c: Cylinder): string {
  const clean: Cylinder = {
    gender: c.gender,
    caps: c.caps,
    start: c.start.map(round) as Vec3,
    dir: c.dir.map(round) as Vec3,
    secs: c.secs.map((s) => ({ ...s, radius: round(s.radius), length: round(s.length) })),
  };
  return JSON.stringify(clean);
}

const roles: Record<string, string> = JSON.parse(readFileSync(ROLES_FILE, 'utf-8'));

// Parts that are decoration by what the LDraw library says of them: stickers, and flexible
// sections (a ribbed hose's or a cable's segments, which LDCad strings along a path; their
// header says "!LDRAW_ORG Part Flexible_Section"), or a file moved to one of those.
function isDecoration(name: string): boolean {
  const text = readLdrawFile(name) ?? '';
  const moved = /^0\s+~Moved to\s+(\S+)/.exec(text);
  if (moved) return isDecoration(normalizePartName(moved[1].replace(/(\.dat)?$/i, '.dat')));
  return /^0\s+~?Sticker\b/.test(text) || /^0\s+!LDRAW_ORG\s+\S+\s+Flexible_Section\b/m.test(text);
}

const about =
  'Generated by scripts/build-connections.ts from the LDraw parts library, the LDCad shadow library and data/corrections.ldr. Do not edit by hand. Licensed CC BY-SA 4.0, see data/LICENSE.md.';
let out = '{\n  "about": ' + JSON.stringify(about) + ',\n  "parts": {';
let first = true;
const stickers: string[] = [];
for (const name of partsInModels()) {
  if (isDecoration(name)) stickers.push(name);
  const cyls: Cylinder[] = [...fileCylinders(name)];
  out += (first ? '\n' : ',\n') + '    ' + JSON.stringify(name) + ': [';
  out += cyls.map((c) => '\n      ' + cylinderJson(c)).join(',');
  out += cyls.length ? '\n    ]' : ']';
  first = false;
  console.log(`${name}: ${cyls.length} connection points`);
}
const extras = () => ',\n  "slides": ' + JSON.stringify(slidesFromCorrections()) + ',\n  "tracks": ' + JSON.stringify(tracksFromCorrections()) + ',\n  "grooves": ' + JSON.stringify(groovesFromCorrections());
out += '\n  }' + extras() + ',\n  "stickers": ' + JSON.stringify(stickers) + '\n}\n';
writeFileSync(OUTPUT_FILE, out);
console.log(`Wrote ${OUTPUT_FILE}`);

// The same for every part in the LDraw library (and every part the models in models/ bring
// with them), for models opened from your own computer: data/library-connections.json. Most
// parts share their connection points with others (a part's printed versions all have the
// same), so each cylinder is written once, in "cylinders", and each part lists its cylinders
// by their place there. Parts with no connection points are left out.
const libraryParts = [...new Set([...readdirSync(join(LDRAW_DIR, 'parts')).filter((f) => f.endsWith('.dat')).map(normalizePartName), ...embedded.keys(), ...partsInModels()])].sort();
const cylinderIndex = new Map<string, number>();
const libraryStickers: string[] = [];
let partLines = '';
for (const name of libraryParts) {
  if (isDecoration(name)) libraryStickers.push(name);
  const indices = fileCylinders(name).map((c) => {
    const json = cylinderJson(c);
    if (!cylinderIndex.has(json)) cylinderIndex.set(json, cylinderIndex.size);
    return cylinderIndex.get(json)!;
  });
  if (indices.length) partLines += (partLines ? ',\n' : '\n') + '    ' + JSON.stringify(name) + ': ' + JSON.stringify(indices);
}
let library = '{\n  "about": ' + JSON.stringify(about) + ',\n  "cylinders": [';
library += [...cylinderIndex.keys()].map((json) => '\n    ' + json).join(',');
library += '\n  ],\n  "parts": {' + partLines + '\n  }' + extras() + ',\n  "stickers": ' + JSON.stringify(libraryStickers) + '\n}\n';
writeFileSync(LIBRARY_OUTPUT_FILE, library);
console.log(`Wrote ${LIBRARY_OUTPUT_FILE}: ${libraryParts.length} parts, ${cylinderIndex.size} different cylinders`);
