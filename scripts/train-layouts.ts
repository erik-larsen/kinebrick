// Makes each train set's model for the viewer, from its OMR file (npm run omr -- --trains), in
// models/trains/: the track as a layout, with the trains set on it.
//
// Where the file lays its track out (every piece joined to the next, in one piece), the track
// stays as it is. Where it doesn't (OMR files follow the building instructions, which often give
// the track as a pile of pieces), a layout is made from the set's own track pieces (see
// layOut): an oval if it has curves enough for one, else a line, with its switches and crossings
// in it.
//
// Then each train is set on the track. A train already near the track keeps its place, each car
// only raised or lowered so that its wheels stand on the rail heads. One beside the track (or
// standing where a layout made here doesn't run) is set on at the start of the track: every car
// moved, level, so that its wheelsets are on the track's centre line, their wheels on the rail
// heads, the cars in the order and at the spacing the file gives them. The viewer then closes
// what gaps are left (see setOnRails in src/kinematics.ts).
//
// Each set's function list, what the check checks (see scripts/train-checks.ts), is written to
// data/trains/<set>.json, keeping the results already there.
//
// Only the track Kinebrick knows the shape of (see trackPiece in src/track.ts) is laid out; a
// set with no such track is left out.
//
//   npx tsx scripts/train-layouts.ts          every train set
//   npx tsx scripts/train-layouts.ts 4563     only sets whose number has this in it

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Matrix4, Vector3 } from 'three';
import { parseModel } from '../src/ldr.ts';
import { drawnDirectly } from '../src/pack.ts';
import { buildTrack, trackPiece } from '../src/track.ts';
import { loadModel } from './load-model.ts';
import { trainFunctions } from './train-checks.ts';

const CSV = 'models/train-sets.csv';
// Sets whose model starts from a corrected file of Kinebrick's own rather than the OMR's: the
// Metroliner (4558, and its re-release 10001) places its couplings 1 to 3 LDU off their hinges,
// as no rule could set right, and models/ has it corrected (see docs/ldraw-errata.md).
const CORRECTED: Record<string, string> = { '4558-1': 'models/10001-Metroliner.mpd', '10001-1': 'models/10001-Metroliner.mpd' };
// Lines of an OMR file that are wrong, and what they should be, by set: [what's wrong, the line
// as the file has it, the line as it should be].
const ERRATA: Record<string, [string, string, string][]> = {
  '4565-1': [
    [
      "The locomotive's front bogie is placed 8 LDU lower than its motor, though both turn in the same train base: its wheels would stand 10 LDU lower than the motor's",
      '1 0 -120 8 -0.008 0 0 -1 0 1 0 1 0 0 4565 - locomotive - wheels 2.ldr',
      '1 0 -120 0 -0.008 0 0 -1 0 1 0 1 0 0 4565 - locomotive - wheels 2.ldr',
    ],
  ],
};
const OUT_DIR = join('models', 'trains');
const SETS_DIR = join('data', 'trains');
// A train whose wheelsets are all within this distance (LDU) of the track is on it already: a
// file may place a train on a curve 2 studs off, its rotations rounded.
const NEAR = 60;
// The gap left between trains set on at the start of the track, and before the first (LDU).
const GAP = 80;

// The fields of a CSV line. Fields may be quoted, with commas inside.
function csvFields(line: string): string[] {
  return [...line.matchAll(/("([^"]*(?:""[^"]*)*)"|[^,]*)(,|$)/g)].slice(0, -1).map((m) => (m[2] !== undefined ? m[2].replaceAll('""', '"') : m[1]));
}

// A number as a model file writes it: no more than 6 decimals, no trailing zeros.
const num = (x: number) => {
  const s = (Math.abs(x) < 5e-7 ? 0 : x).toFixed(6).replace(/\.?0+$/, '');
  return s === '-0' ? '0' : s;
};

// A part line placed afresh: its colour and name as they were, at `m` (part -> model).
function partLine(tokens: string[], m: Matrix4): string {
  const e = m.elements; // column by column
  const values = [e[12], e[13], e[14], e[0], e[4], e[8], e[1], e[5], e[9], e[2], e[6], e[10]];
  return ['1', tokens[1], ...values.map(num), ...tokens.slice(14)].join(' ');
}

// A part line's placement (part -> model).
function lineMatrix(tokens: string[]): Matrix4 {
  const [x, y, z, a, b, c, d, e, f, g, h, i] = tokens.slice(2, 14).map(Number);
  return new Matrix4().set(a, b, c, x, d, e, f, y, g, h, i, z, 0, 0, 0, 1);
}

// A turn about the upright by `angle` (a heading: x turns towards -z), then a shift.
function levelMove(angle: number, shift: Vector3): Matrix4 {
  const [c, s] = [Math.cos(angle), Math.sin(angle)];
  return new Matrix4().set(c, 0, s, shift.x, 0, 1, 0, shift.y, -s, 0, c, shift.z, 0, 0, 0, 1);
}
const heading = (v: Vector3) => Math.atan2(-v.z, v.x);

// The file's lines, and where its main model's lines are (from its first FILE line, if it has
// one, to the next).
function mainRange(lines: string[]): [number, number] {
  const files = lines.flatMap((l, i) => (/^\s*0\s+FILE\s/i.test(l) ? [i] : []));
  if (files.length === 0) return [0, lines.length];
  return [files[0], files[1] ?? lines.length];
}

// How the scripts read a set's parts from the OMR (see readParts in load-model.ts).
const primitives = new Set<string>(JSON.parse(readFileSync('packed/primitives.json', 'utf-8')));
const pieceLines: Record<string, string[]> = JSON.parse(readFileSync('packed/pieces.json', 'utf-8'));
const readText = (text: string) => parseModel(text, (n) => drawnDirectly(n, primitives), (n) => pieceLines[n] ?? null).parts;

// For each part the model places (in the order parseModel gives them), the line of the main
// model it comes from: its own, or the submodel's that places it.
function lineOfEachPart(lines: string[]): number[] {
  const [start, end] = mainRange(lines);
  const of: number[] = [];
  for (let i = start; i < end; i++) {
    if (!/^\s*1\s/.test(lines[i])) continue;
    const alone = [...lines.slice(0, start), ...(start < end && /FILE/i.test(lines[start]) ? [lines[start]] : []), lines[i], ...lines.slice(end)];
    const count = readText(alone.join('\n')).length;
    for (let k = 0; k < count; k++) of.push(i);
  }
  return of;
}

// The model's mechanism, read as the scripts read an OMR set.
function mechanismOf(text: string) {
  const file = join(tmpdir(), `kinebrick-train-${process.pid}.mpd`);
  writeFileSync(file, text);
  try {
    return loadModel(file, true);
  } finally {
    rmSync(file);
  }
}

// ---------------------------------------------------------------------------
// Laying the track out

// Places a set's track pieces end to end, from the origin along x, and gives their lines. With
// 16 curves or more (a full circle), an oval: half the curves at each end, the straights shared
// between its sides, the switches (their straight way) and crossings on one side and as much
// straight on the other. With fewer, a line: straights, then the curves, then straights. What
// doesn't fit (a straight left over from an odd number) goes on a switch's branch if there is
// one, else beside the layout.
function layOut(pieces: { name: string; color: string }[]): string[] {
  const kind = (p: { name: string }) => trackPiece(p.name)!.kind;
  const curveCount = (p: { name: string }) => (/c04\.dat$/i.test(p.name) ? 4 : 1);
  const straights = pieces.filter((p) => kind(p) === 'straight');
  const curves = pieces.filter((p) => kind(p) === 'curve');
  const others = pieces.filter((p) => kind(p) === 'switch' || kind(p) === 'crossing');
  const turns = curves.reduce((n, p) => n + curveCount(p), 0);
  const out: string[] = [];
  // The open end: where the next piece goes, and the way out of the track there.
  let at = new Vector3(0, 0, 0);
  let out_ = new Vector3(1, 0, 0);
  const place = (p: { name: string; color: string }, entry = 0, exit = 1, line = 0) => {
    const local = buildTrack([{ name: p.name, matrix: new Matrix4() }])!;
    const ends = local.lines[line].ends;
    const [e, x] = [ends[entry], ends[exit]];
    // Turned so that its entry faces back the way the open end faces out, and moved onto it.
    const angle = heading(out_.clone().negate()) - heading(e.out);
    const turn = levelMove(angle, new Vector3());
    const point = e.point.clone().setY(0).applyMatrix4(turn);
    const m = levelMove(angle, at.clone().sub(point));
    out.push(['1', p.color, ...[m.elements[12], 0, m.elements[14], m.elements[0], 0, m.elements[8], 0, 1, 0, m.elements[2], 0, m.elements[10]].map(num), p.name].join(' '));
    at = x.point.clone().setY(0).applyMatrix4(m);
    out_ = x.out.clone().transformDirection(m);
    return m;
  };
  const left: { name: string; color: string }[] = [];
  if (turns >= 16) {
    const half = Math.floor(straights.length / 2);
    // One side: the switches and crossings, then straights; the other as long, in straights.
    const sideA = [...others, ...straights.slice(0, half)];
    const sideB = straights.slice(half, 2 * half);
    left.push(...straights.slice(2 * half));
    const ends = [curves.slice(0, Math.ceil(curves.length / 2)), curves.slice(Math.ceil(curves.length / 2))];
    for (const p of sideA) place(p);
    for (const p of ends[0]) place(p);
    for (const p of sideB) place(p);
    for (const p of ends[1]) place(p);
  } else {
    const half = Math.floor(straights.length / 2);
    for (const p of [...straights.slice(0, half), ...others, ...curves, ...straights.slice(half)]) place(p);
  }
  // Left over: beside the layout, in a row.
  at = new Vector3(0, 0, 400);
  out_ = new Vector3(1, 0, 0);
  for (const p of left) place(p);
  return out;
}

// ---------------------------------------------------------------------------
// Setting the trains on the track

function setTrainsOnTrack(text: string): { text: string; trains: number; moved: number } {
  const lines = text.split(/\r?\n/);
  const { parts, mech } = mechanismOf(text);
  const track = mech.track;
  const riders = mech.riders ?? [];
  if (!track || riders.length === 0) return { text, trains: 0, moved: 0 };
  const lineOf = lineOfEachPart(lines);
  if (lineOf.length !== parts.length) throw new Error(`read ${lineOf.length} parts line by line, but ${parts.length} in all`);
  // Cars: what's joined together, the track and the magnets' couplings aside. Trains: cars
  // coupled by their magnets.
  const lead = parts.map((_, i) => i);
  const find = (i: number): number => (lead[i] === i ? i : (lead[i] = find(lead[i])));
  const coupled: [number, number][] = [];
  for (const c of mech.connections) {
    if (mech.roles[c.male] === 'rail' || mech.roles[c.female] === 'rail') continue;
    if (mech.roles[c.male] === 'magnet' && mech.roles[c.female] === 'magnet') coupled.push([c.male, c.female]);
    else lead[find(c.male)] = find(c.female);
  }
  const carOf = (body: number) => find(mech.bodies[body].parts[0]);
  const trainLead = new Map<number, number>();
  const trainOf = (car: number): number => (trainLead.has(car) && trainLead.get(car) !== car ? trainOf(trainLead.get(car)!) : car);
  for (const [a, b] of coupled) {
    const [ta, tb] = [trainOf(find(a)), trainOf(find(b))];
    if (ta !== tb) trainLead.set(ta, tb);
  }
  const trains = new Map<number, typeof riders>();
  for (const r of riders) {
    const t = trainOf(carOf(r.body));
    trains.set(t, [...(trains.get(t) ?? []), r]);
  }
  // Each rider's running radius: how far its wheels reach below the axle.
  const radius = (r: (typeof riders)[number]) => mech.treads.find((t) => t.body === r.body)?.radius ?? 22;
  const identity = new Matrix4();
  // Where the next train set on at the start of the track goes.
  let cursor = track.walk(0, 0, GAP);
  const moves = new Map<number, Matrix4>(); // by car
  let key = -1;
  for (const group of trains.values()) {
    // In order along the train: by how far along its length each is.
    const centers = group.map((r) => r.center.clone());
    const mean = centers.reduce((s, c) => s.add(c), new Vector3()).multiplyScalar(1 / centers.length);
    let along = new Vector3(1, 0, 0);
    if (group.length > 1) {
      // The way the wheelsets spread most, level: the two furthest apart.
      let best = 0;
      for (const a of centers) for (const b of centers) if (a.distanceTo(b) > best) [best, along] = [a.distanceTo(b), b.clone().sub(a).setY(0).normalize()];
    } else along = new Vector3().crossVectors(new Vector3(0, -1, 0), group[0].axis).normalize();
    const order = group.map((r, i) => ({ r, c: centers[i], at: centers[i].clone().sub(mean).dot(along) })).sort((a, b) => a.at - b.at);
    // How far along the track each is from the first: the distances between them as built.
    const spacing = order.map((o, i) => (i === 0 ? 0 : o.c.clone().sub(order[i - 1].c).setY(0).length()));
    const from = order.map((_, i) => spacing.slice(0, i + 1).reduce((a, b) => a + b, 0));
    const length = from[from.length - 1];
    // Near the track already: each car only raised or lowered, its wheels to the rail heads
    // (moved across, cars on a curve would come apart at their couplings; the viewer sets them
    // on the line, see setOnRails). Otherwise the train is set on at the cursor, in order, at
    // its spacing.
    const near = order.map((o) => track.near(o.c, identity, key--));
    let targets: Vector3[];
    let start = cursor;
    if (near.every((n) => n && Math.abs(n.offset) < NEAR)) {
      targets = order.map((o) => o.c.clone().setY(track.head() - radius(o.r)));
    } else {
      cursor = track.walk(start.line, start.s, start.dir * (length + GAP));
      targets = from.map((d, i) => {
        const w = track.walk(start.line, start.s, start.dir * d);
        return track.pointAt(w.line, w.s).point.addScaledVector(new Vector3(0, 1, 0), -radius(order[i].r));
      });
    }
    // Each car: turned about the upright and moved, as one, to put its wheelsets on theirs.
    const cars = new Set(order.map((o) => carOf(o.r.body)));
    for (const car of cars) {
      const mine = order.flatMap((o, i) => (carOf(o.r.body) === car ? [{ src: o.c, dst: targets[i], r: o.r }] : []));
      const cs = mine.reduce((s, m) => s.add(m.src), new Vector3()).multiplyScalar(1 / mine.length);
      const ct = mine.reduce((s, m) => s.add(m.dst), new Vector3()).multiplyScalar(1 / mine.length);
      let angle: number;
      if (mine.length > 1) {
        let [cross, dot] = [0, 0];
        for (const m of mine) {
          const [u, v] = [m.src.clone().sub(cs), m.dst.clone().sub(ct)];
          cross += u.z * v.x - u.x * v.z;
          dot += u.x * v.x + u.z * v.z;
        }
        angle = Math.atan2(cross, dot);
      } else {
        // A wheelset alone: its axle square to the track.
        const across = track.near(mine[0].dst, identity, key--)!.n;
        const axis = mine[0].r.axis.clone().setY(0).normalize();
        angle = heading(across) - heading(axis);
        if (Math.cos(angle) < 0) angle += Math.PI;
      }
      const turned = cs.clone().applyMatrix4(levelMove(angle, new Vector3()));
      moves.set(car, levelMove(angle, ct.clone().sub(turned)));
    }
  }
  // Every main line whose parts are mostly in a car that moves, moved with it.
  const votes = new Map<number, Map<number, number>>();
  parts.forEach((_, i) => {
    const car = find(i);
    if (!moves.has(car)) return;
    const v = votes.get(lineOf[i]) ?? new Map<number, number>();
    v.set(car, (v.get(car) ?? 0) + 1);
    votes.set(lineOf[i], v);
  });
  const partsOnLine = new Map<number, number>();
  for (const l of lineOf) partsOnLine.set(l, (partsOnLine.get(l) ?? 0) + 1);
  let moved = 0;
  for (const [line, v] of votes) {
    const [car, n] = [...v].sort((a, b) => b[1] - a[1])[0];
    if (n * 2 < partsOnLine.get(line)!) continue;
    const tokens = lines[line].trim().split(/\s+/);
    lines[line] = partLine(tokens, moves.get(car)!.clone().multiply(lineMatrix(tokens)));
    moved++;
  }
  return { text: lines.join('\n'), trains: trains.size, moved };
}

// The library's assembled wheel bogies (2878c01, 2878c02) seat their wheelset 34 LDU below the
// bogie's origin, 2 LDU lower than the 10001 Metroliner's file seats it in the bogie (2878), and
// than a 9V motor's wheels stand beside it: a locomotive with both (the 4565's) couldn't stand on
// all its wheels. Each is placed as its bogie and its wheelset, the wheelset 32 LDU down.
function splitBogies(text: string): string {
  const WHEELSETS: Record<string, string> = { '2878c01.dat': '70720c01.dat', '2878c02.dat': '57877c01.dat' };
  return text.replace(/^(\s*1\s+(\S+)((?:\s+\S+){12}))\s+(2878c0[12]\.dat)\s*$/gim, (_, _line, color: string, numbers: string, name: string) => {
    const tokens = ['1', color, ...numbers.trim().split(/\s+/)];
    const m = lineMatrix(tokens);
    return [`1 ${color}${numbers} 2878.dat`, partLine(['1', '0', ...tokens.slice(2), WHEELSETS[name.toLowerCase()]], m.clone().multiply(new Matrix4().makeTranslation(0, 32, 0)))].join('\n');
  });
}

// ---------------------------------------------------------------------------

const only = process.argv.slice(2);
const csv = readFileSync(CSV, 'utf-8').trim().split(/\r?\n/);
const header = csvFields(csv[0]);
mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(SETS_DIR, { recursive: true });
for (const row of csv.slice(1).map((l) => Object.fromEntries(header.map((h, i) => [h, csvFields(l)[i] ?? ''])))) {
  if (only.length && !only.some((o) => row.set_num.includes(o))) continue;
  const source = CORRECTED[row.set_num] ?? join('omr', 'trains', `${row.set_num} ${row.name}`.replace(/[/\\:]/g, '-') + '.mpd');
  let text: string;
  try {
    text = readFileSync(source, 'utf-8');
  } catch {
    console.log(`${row.set_num}: no ${source} (npm run omr -- --trains downloads it)`);
    continue;
  }
  text = text.replace(/\r\n/g, '\n');
  for (const [why, wrong, right] of ERRATA[row.set_num] ?? []) {
    if (!text.includes(wrong)) throw new Error(`${row.set_num}: no line ${wrong} to correct (${why})`);
    text = text.replace(wrong, right);
  }
  text = splitBogies(text);
  const parts = readText(text);
  const known = parts.filter((p) => trackPiece(p.name));
  if (known.length === 0) continue;
  // Laid out: every piece joined to the rest, in one piece.
  const track = buildTrack(parts)!;
  const lead = track.lines.map((_, i) => i);
  const find = (i: number): number => (lead[i] === i ? i : (lead[i] = find(lead[i])));
  track.links.forEach((ends, l) => ends.forEach((e) => e.forEach(([m]) => (lead[find(l)] = find(m)))));
  track.lines.forEach((line, l) => track.lines.forEach((other, m) => line.part === other.part && (lead[find(l)] = find(m))));
  const laid = new Set(track.lines.map((_, i) => find(i))).size === 1;
  let lines = text.split(/\r?\n/);
  let note = 'the track as the OMR file lays it out';
  if (!laid) {
    // Every track piece taken out, wherever it was, and laid out afresh in the main model.
    const pieces: { name: string; color: string }[] = [];
    lines = lines.filter((l) => {
      const tokens = l.trim().split(/\s+/);
      if (tokens[0] !== '1' || tokens.length < 15 || !trackPiece(tokens.slice(14).join(' '))) return true;
      pieces.push({ name: tokens.slice(14).join(' '), color: tokens[1] });
      return false;
    });
    const [, end] = mainRange(lines);
    lines.splice(end, 0, ...layOut(pieces));
    note = "the track laid out afresh from the set's own pieces";
  }
  // Kinebrick's note, after the main model's header.
  const [start] = mainRange(lines);
  const firstPart = lines.findIndex((l, i) => i > start && !/^\s*0\s/.test(l) && l.trim() !== '');
  lines.splice(firstPart < 0 ? start + 1 : firstPart, 0, `0 // Kinebrick: ${note}, with the trains set on it (scripts/train-layouts.ts)`);
  const set = setTrainsOnTrack(lines.join('\n'));
  const out = join(OUT_DIR, `${row.set_num.replace(/-1$/, '')}-${row.name}`.replace(/[/\\:]/g, '-') + '.mpd');
  writeFileSync(out, set.text.replace(/\n*$/, '\n'));
  const json = join(SETS_DIR, `${row.set_num}.json`);
  const was = existsSync(json) ? JSON.parse(readFileSync(json, 'utf-8')) : {};
  const functions = trainFunctions(out);
  writeFileSync(json, JSON.stringify({ set: row.set_num, curated: { model: out, functions }, generated: was.generated ?? {} }, null, 2) + '\n');
  console.log(`${out}: ${laid ? 'laid out' : 'layout made'}, ${known.length} track pieces, ${set.trains} trains, ${set.moved} lines moved, ${functions.length} functions`);
}
