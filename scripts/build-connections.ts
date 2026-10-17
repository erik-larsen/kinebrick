// Builds data/connections.json, KineBrick's connection table.
//
// For every part used by the test models in models/, it collects the part's connection
// points (holes, axles, pins, studs) from three sources:
//   1. the LDraw parts library (ldraw/): which primitives and subparts each part is built from
//   2. the LDCad shadow library (ldcad-shadow/): snap lines attached to parts and primitives
//   3. KineBrick's corrections (data/corrections.ldr): snap lines for what 1 and 2 miss
//
// Run with: npm run connections

import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Cylinder, Section, Slide, Vec3, normalizePartName } from '../src/connections.ts';

const LDRAW_DIR = 'ldraw';
const SHADOW_DIR = 'ldcad-shadow';
const MODELS_DIR = 'models';
const ROLES_FILE = 'data/roles.json';
const CORRECTIONS_FILE = 'data/corrections.ldr';
const OUTPUT_FILE = 'data/connections.json';

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

// LDraw looks up a referenced file in parts/ first, then p/ (primitives).
function readLdrawFile(name: string): string | null {
  return readText(join(LDRAW_DIR, 'parts', name)) ?? readText(join(LDRAW_DIR, 'p', name));
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
  }
  return cyls;
}

// A SNAP_GEN line shaped as a sphere ([bounding=sph 8]): a towball (M) or a ball socket (F).
// Stored as a cylinder with one O section, as long as the ball is wide and centred on it,
// so it can be placed like any other cylinder. Other SNAP_GEN shapes aren't used yet.
function ballFromMeta(meta: Meta): WorkingCylinder[] {
  const p = meta.params;
  const bounding = (p.get('bounding') ?? '').split(/\s+/);
  if (bounding[0] !== 'sph') return [];
  const radius = Number(bounding[1]);
  p.set('secs', `O ${radius} ${2 * radius}`);
  p.set('center', 'true');
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

// "C 3 1 20 0" -> offsets in the meta's own X/Z plane. A "C" centres that axis on pos.
function parseGrid(text: string | undefined): Vec3[] {
  if (!text) return [[0, 0, 0]];
  const tokens = text.split(/\s+/);
  let i = 0;
  const centerX = tokens[i] === 'C' ? (i++, true) : false;
  const countX = Number(tokens[i++]);
  const centerZ = tokens[i] === 'C' ? (i++, true) : false;
  const countZ = Number(tokens[i++]);
  const stepX = Number(tokens[i++]);
  const stepZ = Number(tokens[i++]);
  const offsets: Vec3[] = [];
  for (let x = 0; x < countX; x++) {
    for (let z = 0; z < countZ; z++) {
      const ox = centerX ? (x - (countX - 1) / 2) * stepX : x * stepX;
      const oz = centerZ ? (z - (countZ - 1) / 2) * stepZ : z * stepZ;
      offsets.push([ox, 0, oz]);
    }
  }
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
      secs: secs.map((s) => ({ ...s })),
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
    if (meta && meta.kind === 'SNAP_GEN') result.push(...ballFromMeta(meta));
  }
  return result;
}

// All cylinders of an LDraw file: inherited from the files it references, then changed by
// its shadow lines and KineBrick's corrections, in order.
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
    } else if (meta.kind === 'SNAP_GEN') {
      result.push(...ballFromMeta(meta));
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
    // SNAP_CLP, SNAP_FGR and SNAP_SPH (clips, hinge fingers, and so on) aren't used yet.
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

// Every part referenced by the models in models/, looking inside multi-part (MPD) files.
function partsInModels(): string[] {
  const parts = new Set<string>();
  for (const file of readdirSync(MODELS_DIR)) {
    if (!/\.(ldr|mpd)$/i.test(file)) continue;
    const text = readFileSync(join(MODELS_DIR, file), 'utf-8');
    const submodels = new Set<string>();
    for (const m of text.matchAll(/^\s*0\s+FILE\s+(.+)$/gim)) submodels.add(normalizePartName(m[1]));
    for (const line of text.split(/\r?\n/)) {
      const ref = parseReference(line);
      if (ref && !submodels.has(ref.name)) parts.add(ref.name);
    }
  }
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
const about =
  'Generated by scripts/build-connections.ts from the LDraw parts library, the LDCad shadow library and data/corrections.ldr. Do not edit by hand. Licensed CC BY-SA 4.0, see data/LICENSE.md.';
let out = '{\n  "about": ' + JSON.stringify(about) + ',\n  "parts": {';
let first = true;
for (const name of partsInModels()) {
  const cyls: Cylinder[] = [...fileCylinders(name)];
  if (roles[name] === 'tyre') {
    const seat = cyls.find((c) => c.gender === 'F' && c.secs.some((sec) => sec.shape === 'T'));
    if (seat) cyls.push(treadCylinder(name, seat));
    else console.warn(`${name}: tyre without a tyre seat in data/corrections.ldr`);
  }
  out += (first ? '\n' : ',\n') + '    ' + JSON.stringify(name) + ': [';
  out += cyls.map((c) => '\n      ' + cylinderJson(c)).join(',');
  out += cyls.length ? '\n    ]' : ']';
  first = false;
  console.log(`${name}: ${cyls.length} connection points`);
}
out += '\n  },\n  "slides": ' + JSON.stringify(slidesFromCorrections()) + '\n}\n';
writeFileSync(OUTPUT_FILE, out);
console.log(`Wrote ${OUTPUT_FILE}`);
