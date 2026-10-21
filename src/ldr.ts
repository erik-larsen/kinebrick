// Reads the parts of an LDraw model file: which part, which colour, and where.
//
// A model file is either a plain .ldr, or a multi-part file (.mpd) of several files one after
// another, each starting with "0 FILE <name>". The first is the main model. The others are
// submodels (a gearbox, a wheel assembly), placed by type 1 lines like parts, or parts that
// aren't in the LDraw library (the official model repository embeds unofficial parts this
// way). Submodels are flattened: each part they hold is placed where the submodel puts it.

import { Matrix4, Vector3 } from 'three';
import { normalizePartName } from './connections.ts';

export interface PlacedPart {
  name: string; // normalized file name, e.g. "3701.dat"
  color: number; // LDraw colour code
  matrix: Matrix4; // part coordinates -> model coordinates, in LDU
  submodel?: string; // the submodel it's in (the innermost one), if not the main model
  path?: PlacedPath; // the path it's a link (or segment) of, if a path's submodel placed it
}

// Something flexible drawn along a path, as the LDCad program generates it: a chain or track
// looped round its wheels, a rubber band, a string, a hose bent to fit. The path's submodel
// says where it runs ("0 !LDCAD PATH_POINT" lines) and what it's made of ("PATH_SKIN"), and
// places the links (or segments) LDCad made of it.
export interface PlacedPath {
  looped: boolean; // round and back to its start, as a chain is
  skin: string; // the part it's made of, e.g. "3873.dat"
  points: PathPoint[]; // in order along the path
}

export interface PathPoint {
  circle: boolean; // round a circle (a wheel, say), or through a point (a bend in a string)
  center: Vector3; // model coordinates
  axis: Vector3; // the circle's axis (unit, model coordinates)
  radius: number; // LDU
  // Which way the path goes round the circle, about `axis`: 1 or -1. (LDCad's "xyCW", with
  // LDraw's y pointing down, goes round anticlockwise about its +z, as the links it places
  // show.)
  turn: number;
}

// A path's points from its submodel's lines, placed by `placement` (submodel coordinates ->
// model coordinates), or null if the submodel isn't a path.
function pathOf(lines: string[], placement: Matrix4): PlacedPath | null {
  const param = (line: string, key: string) => new RegExp(`\\[${key}=([^\\]]*)\\]`).exec(line)?.[1].trim();
  const content = lines.find((line) => /^\s*0\s+!LDCAD\s+CONTENT\b/.test(line));
  if (!content || param(content, 'type') !== 'path') return null;
  const skin = lines.find((line) => /^\s*0\s+!LDCAD\s+PATH_SKIN\b/.test(line));
  const points = lines
    .filter((line) => /^\s*0\s+!LDCAD\s+PATH_POINT\b/.test(line))
    .map((line): PathPoint => {
      const [x, y, z, , , c, , , f, , , i] = (param(line, 'posOri') ?? '').split(/\s+/).map(Number);
      return {
        circle: param(line, 'type') === 'circle',
        center: new Vector3(x, y, z).applyMatrix4(placement),
        axis: new Vector3(c, f, i).transformDirection(placement),
        radius: Number(param(line, 'cirR') ?? 0),
        turn: param(line, 'cirDir') === 'xyCCW' ? -1 : 1,
      };
    });
  return { looped: param(content, 'looped') === 'true', skin: normalizePartName(skin ? param(skin, 'donPart') ?? '' : ''), points };
}

// The paths LSynth drew: runs of its segments, one after another in a submodel (a crane's rope,
// a hose, a cable), which the official model repository's files place as parts (embedded as
// "<set> - LS60.dat"), with nothing to say where the path runs but the segments themselves.
// Each run becomes a path its segments are links of. A rope's (LS60's) turns round a drum or a
// pulley become its circles: each stretch where it keeps turning the same way through at least
// MIN_TURN, as the circle that fits it best. Other paths (hoses, cables) only show where they run.
const LSYNTH_SEGMENT = /(^|[ /])ls([2-9]\d)[a-z]?\.dat$/;
const LSYNTH_STRING = '60';
const LSYNTH_GAP = 6; // LDU: segments further apart than this are on different paths
const MIN_TURN = Math.PI / 6;
function lsynthPaths(parts: PlacedPart[]) {
  let start = 0;
  while (start < parts.length) {
    const kind = LSYNTH_SEGMENT.exec(parts[start].name)?.[2];
    let end = start + 1;
    const at = (i: number) => new Vector3().setFromMatrixPosition(parts[i].matrix);
    while (kind && end < parts.length && parts[end].name === parts[start].name && parts[end].submodel === parts[start].submodel && !parts[end].path && at(end).distanceTo(at(end - 1)) < LSYNTH_GAP) end++;
    if (kind && !parts[start].path && end - start > 1) {
      const points = parts.slice(start, end).map((p) => new Vector3().setFromMatrixPosition(p.matrix));
      const looped = points.length > 8 && points[0].distanceTo(points[points.length - 1]) < LSYNTH_GAP;
      const path: PlacedPath = { looped, skin: parts[start].name, points: kind === LSYNTH_STRING ? stringPoints(points) : points.map(throughPoint) };
      for (let i = start; i < end; i++) parts[i].path = path;
    }
    start = end;
  }
}

const throughPoint = (center: Vector3): PathPoint => ({ circle: false, center, axis: new Vector3(0, 0, 1), radius: 0, turn: 1 });

// A string's points from its segments' middles: where it starts, the circles it goes round (see
// lsynthPaths), and where it ends. A string that starts on a circle (wound on a drum) starts
// with it. All its circles' axes point the same way, the first's, as a string's layout needs
// (see stringLayout), each turn saying which way it goes round.
function stringPoints(points: Vector3[]): PathPoint[] {
  const dirs = points.slice(1).map((p, i) => p.clone().sub(points[i]).normalize());
  // How it turns at each point between two segments.
  const turns = dirs.slice(1).map((d, i) => new Vector3().crossVectors(dirs[i], d));
  const bend = (k: number) => Math.asin(Math.min(1, turns[k].length()));
  const circles: { from: number; point: PathPoint }[] = [];
  let i = 0;
  while (i < turns.length) {
    if (turns[i].length() < 0.003) {
      i++;
      continue;
    }
    const sum = turns[i].clone();
    let angle = bend(i);
    let j = i + 1;
    while (j < turns.length && turns[j].length() >= 0.003 && turns[j].dot(sum) > 0) {
      sum.add(turns[j]);
      angle += bend(j);
      j++;
    }
    // Turns i to j - 1 are where it turned (turn k is at point k + 1). Where it goes round less
    // than a whole turn, only the tightest stretch counts: LSynth eases a string into and out of
    // each circle.
    if (angle >= MIN_TURN) {
      let tightest = 0;
      for (let k = i; k < j; k++) tightest = Math.max(tightest, bend(k));
      // Wound round more than once (a drum), it's whole turns that count: a part turn would pull
      // the circle's middle its way.
      const whole = Math.floor(angle / (2 * Math.PI)) * 2 * Math.PI;
      const core = [];
      let wound = 0;
      for (let k = i; k < j; k++) {
        wound += bend(k);
        if (whole ? wound <= whole : bend(k) >= tightest / 1.5) core.push(k);
      }
      // Its axis: the way it turns, leaving out where it steps across (from one winding of a
      // drum to the next).
      const along = new Vector3();
      for (const k of core) along.add(turns[k]);
      for (let pass = 0; pass < 2; pass++) {
        const axis = along.clone().normalize();
        along.set(0, 0, 0);
        for (const k of core) if (turns[k].clone().normalize().dot(axis) > 0.98) along.add(turns[k]);
      }
      const near = [...new Set(core.flatMap((k) => [k, k + 1, k + 2]))].map((k) => points[k]);
      circles.push({ from: i, point: fitCircle(near, along.normalize()) });
    }
    i = j;
  }
  const result: PathPoint[] = [];
  if (!circles.length || circles[0].from > 2) result.push(throughPoint(points[0]));
  const axis = circles[0]?.point.axis;
  for (const c of circles) {
    if (c.point.axis.dot(axis) < 0) [c.point.axis, c.point.turn] = [axis.clone(), -1];
    result.push(c.point);
  }
  result.push(throughPoint(points[points.length - 1]));
  return result;
}

// The circle through points that best fits them, seen along `axis` (the way they turn round it,
// anticlockwise): its middle in the plane through their middle.
function fitCircle(points: Vector3[], axis: Vector3): PathPoint {
  const mid = points.reduce((sum, p) => sum.add(p), new Vector3()).divideScalar(points.length);
  let u = new Vector3(1, 0, 0).cross(axis);
  if (u.length() < 0.1) u = new Vector3(0, 1, 0).cross(axis);
  u.normalize();
  const v = new Vector3().crossVectors(axis, u);
  // Least squares: x² + y² + a x + b y + c = 0, solved by its normal equations.
  const m = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const r = [0, 0, 0];
  for (const p of points) {
    const d = p.clone().sub(mid);
    const row = [d.dot(u), d.dot(v), 1];
    const rhs = -(row[0] * row[0] + row[1] * row[1]);
    for (let a = 0; a < 3; a++) {
      r[a] += row[a] * rhs;
      for (let b = 0; b < 3; b++) m[a][b] += row[a] * row[b];
    }
  }
  const [a, b, c] = solve3(m, r);
  const x = -a / 2;
  const y = -b / 2;
  const center = mid.clone().addScaledVector(u, x).addScaledVector(v, y);
  return { circle: true, center, axis: axis.clone(), radius: Math.sqrt(Math.max(0, x * x + y * y - c)), turn: 1 };
}

// Solves the 3 x 3 linear equations m x = r (Cramer's rule).
function solve3(m: number[][], r: number[]): number[] {
  const det = (k: number[][]) => k[0][0] * (k[1][1] * k[2][2] - k[1][2] * k[2][1]) - k[0][1] * (k[1][0] * k[2][2] - k[1][2] * k[2][0]) + k[0][2] * (k[1][0] * k[2][1] - k[1][1] * k[2][0]);
  const d = det(m) || 1e-12;
  return [0, 1, 2].map((col) => det(m.map((row, i) => row.map((x, j) => (j === col ? r[i] : x)))) / d);
}

// Colour 16 means "the colour of whatever placed me".
const INHERIT = 16;

// The files in a model file, by normalized name, in order; the first is the main model. A
// file with no "0 FILE" lines is one file, named "".
export function modelFiles(text: string): Map<string, string[]> {
  const files = new Map<string, string[]>();
  let current: string[] | null = null;
  for (const line of text.split(/\r?\n/)) {
    const tokens = line.trim().split(/\s+/);
    if (tokens[0] === '0' && tokens[1] === 'FILE') {
      current = [];
      const name = normalizePartName(tokens.slice(2).join(' '));
      if (!files.has(name)) files.set(name, current);
      continue;
    }
    // Ends a file, or starts embedded data (a texture), which isn't part of any file.
    if (tokens[0] === '0' && (tokens[1] === 'NOFILE' || tokens[1] === '!DATA')) {
      current = null;
      continue;
    }
    if (!current && files.size === 0) files.set('', (current = []));
    current?.push(line);
  }
  return files;
}

// Whether a file in a model file is a part (or subpart or primitive), which its header says
// with "0 !LDRAW_ORG Unofficial_Part" and the like, rather than a submodel.
function isPart(lines: string[]): boolean {
  return lines.some((line) => /^\s*0\s+!LDRAW_ORG\s+(Unofficial_)?(Part|Subpart|Primitive|8_Primitive|48_Primitive|Shortcut)\b/i.test(line));
}

// The parts a model file brings with it (not submodels), by normalized name.
export function embeddedParts(text: string): Map<string, string> {
  const parts = new Map<string, string>();
  for (const [name, lines] of modelFiles(text)) if (name && isPart(lines)) parts.set(name, lines.join('\n'));
  return parts;
}

// KineBrick's own settings for a model, from "0 !KINEBRICK" lines in its main file (LDraw
// programs skip meta-commands they don't know, so the file still opens anywhere), e.g.
//   0 !KINEBRICK SCRUB [percent=10]   tyres may scrub sideways by up to 10% of how far they roll
export interface ModelSettings {
  scrub?: number; // percent
}

export function modelSettings(text: string): ModelSettings {
  const settings: ModelSettings = {};
  for (const line of [...modelFiles(text).values()][0] ?? []) {
    const scrub = /^\s*0\s+!KINEBRICK\s+SCRUB\b.*\[percent=([\d.]+)\]/.exec(line);
    if (scrub) settings.scrub = Number(scrub[1]);
  }
  return settings;
}

// A real LEGO set's file from the LDraw Official Model Repository, as KineBrick keeps it in
// models/: the files in it drop the spaces round the dash after the set number ("956 - main.ldr"
// becomes "956-main.ldr", wherever it's named), and its main file gets KineBrick's own lines for
// it (from models/sets.json) straight after its "0 !LICENSE" line, in place of any "0 !KINEBRICK"
// or "0 // KineBrick" lines it had. Doing it again changes nothing.
export function importSet(text: string, set: string, lines: string[]): string {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const out: string[] = [];
  let files = 0;
  let added = false;
  for (const line of text.split(/\r?\n/)) {
    const renamed = line.replace(new RegExp(`\\b${set} - `, 'g'), `${set}-`);
    if (/^\s*0\s+FILE\b/.test(renamed)) files++;
    const inMain = files <= 1;
    if (inMain && /^\s*0\s+(!KINEBRICK\b|\/\/\s*KineBrick\b)/.test(renamed)) continue;
    out.push(renamed);
    if (inMain && !added && /^\s*0\s+!LICENSE\b/.test(renamed)) {
      out.push(...lines);
      added = true;
    }
  }
  if (lines.length && !added) throw new Error(`set ${set}: no "0 !LICENSE" line in its main file to put KineBrick's lines after`);
  return out.join(eol);
}

// Shapes a submodel draws directly, with lines of types 2 to 5, rather than with parts: a hose
// or a spring bent to fit, as CAD programs generate them. They have no connections, so they
// don't take part in the mechanism, but they're drawn.
export interface PlacedShape {
  submodel: string; // the submodel whose lines they are
  lines: string[]; // those lines, in the submodel's coordinates
  color: number;
  matrix: Matrix4; // submodel coordinates -> model coordinates
  nearPart: number; // a part placed by the same submodel line (it moves with that part), or -1
  path?: PlacedPath; // the path they're drawn along, if their submodel is a path's
}

// Every part in the model, with submodels flattened, in the order their lines come (a
// submodel's parts where the submodel's line is), and the shapes drawn without parts.
// `isPrimitive` says which referenced files are LDraw primitives (pieces of shape, such as a
// cylinder, rather than parts): a submodel that places them is drawing a shape, as CAD
// programs draw a string or a hose. Only the LDraw library knows for sure, so the caller says.
// `piecesOf` gives the lines of a part that's read as the parts it's made of (a 4x4 turntable,
// one LDraw file, is a base and a top that turns on it), or null for any other part.
export function parseModel(
  text: string,
  isPrimitive: (name: string) => boolean = () => false,
  piecesOf: (name: string) => string[] | null = () => null,
): { parts: PlacedPart[]; shapes: PlacedShape[]; paths: PlacedPath[] } {
  const files = modelFiles(text);
  const submodels = new Map([...files].filter(([name, lines]) => name && !isPart(lines)));
  const referenced = (line: string) => normalizePartName(line.trim().split(/\s+/).slice(14).join(' '));
  const drawn = (line: string) => /^\s*[2-5]\s/.test(line) || (/^\s*1\s/.test(line) && isPrimitive(referenced(line)));
  const shapeLines = new Map([...submodels].map(([name, lines]) => [name, lines.filter(drawn)]));
  const parts: PlacedPart[] = [];
  const shapes: PlacedShape[] = [];
  // A path's caps (a cable's plugs, or the receiver it comes out of) are parts in their own
  // right, not links of it: by path, the parts its submodel names as caps.
  const capsOf = new Map<PlacedPath, Set<string>>();
  // `pieces`: the lines are a part's pieces, which go in the submodel the part is in. `path`:
  // the lines are a path's (see PlacedPath).
  const place = (lines: string[], placement: Matrix4, color: number, submodel: string | undefined, depth: number, pieces = false, path: PlacedPath | null = null) => {
    if (depth > 64) throw new Error(`Submodels nested too deep (does one place itself?): ${submodel}`);
    const first = parts.length;
    const caps = (path && capsOf.get(path)) ?? new Set<string>();
    for (const line of lines) {
      const tokens = line.trim().split(/\s+/);
      if (tokens[0] !== '1' || tokens.length < 15) continue;
      const [x, y, z, a, b, c, d, e, f, g, h, i] = tokens.slice(2, 14).map(Number);
      const matrix = placement.clone().multiply(new Matrix4().set(a, b, c, x, d, e, f, y, g, h, i, z, 0, 0, 0, 1));
      const ownColor = Number(tokens[1]);
      const partColor = ownColor === INHERIT ? color : ownColor;
      const name = normalizePartName(tokens.slice(14).join(' '));
      if (isPrimitive(name)) continue; // drawn with the submodel's shapes
      const sub = submodels.get(name);
      const ownPieces = sub ? null : piecesOf(name);
      // A submodel inside a path's is more of the path: LDCad puts the links it gives a colour
      // of their own in a subpart (the 42131 Cat D11's tracks).
      const subPath = sub ? pathOf(sub, matrix) : null;
      if (subPath) capsOf.set(subPath, new Set(sub!.filter((line) => /^\s*0\s+!LDCAD\s+PATH_CAP\b/.test(line)).map((line) => normalizePartName(/\[part=([^\]]*)\]/.exec(line)?.[1] ?? ''))));
      if (sub) place(sub, matrix, partColor, name, depth + 1, false, subPath ?? path);
      else if (ownPieces) place(ownPieces, matrix, partColor, submodel, depth + 1, true);
      else parts.push({ name, color: partColor, matrix, ...(submodel ? { submodel } : {}), ...(path && !caps.has(name) ? { path } : {}) });
    }
    const own = submodel && !pieces ? shapeLines.get(submodel)! : [];
    if (own.length) shapes.push({ submodel: submodel!, lines: own, color, matrix: placement, nearPart: parts.length > first ? first : -1, ...(path ? { path } : {}) });
  };
  place([...files.values()][0] ?? [], new Matrix4(), INHERIT, undefined, 0);
  lsynthPaths(parts);
  // Every path placed, whether drawn with parts (a chain's links) or shapes (a string's).
  const paths = [...new Set([...parts.flatMap((p) => (p.path ? [p.path] : [])), ...shapes.flatMap((s) => (s.path ? [s.path] : []))])];
  return { parts, shapes, paths };
}

// Every part in the model (see parseModel).
export function parseLdr(text: string, isPrimitive?: (name: string) => boolean, piecesOf?: (name: string) => string[] | null): PlacedPart[] {
  return parseModel(text, isPrimitive, piecesOf).parts;
}

// A part as a type 1 line, as the model would have it if it had no submodels.
export function partLine(p: PlacedPart): string {
  const m = p.matrix.elements; // column by column
  const n = (v: number) => {
    const s = (Math.abs(v) < 1e-9 ? 0 : v).toFixed(6).replace(/\.?0+$/, '');
    return s === '-0' ? '0' : s;
  };
  const numbers = [m[12], m[13], m[14], m[0], m[4], m[8], m[1], m[5], m[9], m[2], m[6], m[10]];
  return `1 ${p.color} ${numbers.map(n).join(' ')} ${p.name}`;
}
