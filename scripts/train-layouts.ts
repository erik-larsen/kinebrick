// Makes each train set's model for the viewer, from its OMR file (npm run omr -- --trains), in
// models/trains/: the track as a layout, with the trains set on it.
//
// Where the file lays its track out (every piece joined to the next, in one piece), the track
// stays as it is. Where it doesn't (OMR files follow the building instructions, which often give
// the track as a pile of pieces), a layout is made from the set's own track pieces (see
// layOut): an oval if it has curves enough for one, else a line, with its switches and crossings
// in it.
//
// Then each train is set on the track: its cars in order along the track, each moved, level, so
// that its wheelsets are on the track's centre line and its wheels on the rail heads, and closed
// up magnet to magnet (cars a file couples already keep their gap). A train on the track keeps
// its place along it; cars beside the track (or standing where a layout made here doesn't run)
// are set on after the trains on it, as one train. The viewer then closes what gaps are left
// (see setOnRails in src/kinematics.ts).
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
import { buildTrack, layOutTrack, railPieces, Track, trackPiece } from '../src/track.ts';
import { loadModel } from './load-model.ts';
import { trainFunctions } from './train-checks.ts';

const CSV = 'models/train-sets.csv';
// The sleepers that single rails (see railPieces) lie on: taken out with them where a layout is
// made afresh, the whole pieces it lays bringing their own.
const SLEEPERS = /^(4166a?b?|767|3034)\.dat$/i;
// Sets whose model starts from a corrected file of Kinebrick's own rather than the OMR's: the
// Metroliner (4558, and its re-release 10001) places its couplings 1 to 3 LDU off their hinges,
// as no rule could set right, and models/ has it corrected (see docs/ldraw-errata.md).
const CORRECTED: Record<string, string> = { '4558-1': 'models/10001-Metroliner.mpd', '10001-1': 'models/10001-Metroliner.mpd' };
// Lines of an OMR file that are wrong, or that Kinebrick changes for its layouts, and what they should be, by set: [why, the line
// as the file has it, the line as it should be].
const ERRATA: Record<string, [string, string, string][]> = {
  '4565-1': [
    [
      "The locomotive's front bogie is placed 8 LDU lower than its motor, though both turn in the same train base: its wheels would stand 10 LDU lower than the motor's",
      '1 0 -120 8 -0.008 0 0 -1 0 1 0 1 0 0 4565 - locomotive - wheels 2.ldr',
      '1 0 -120 0 -0.008 0 0 -1 0 1 0 1 0 0 4565 - locomotive - wheels 2.ldr',
    ],
  ],
  // Not errors, but changes for Kinebrick's layouts.
  'test-1': [
    [
      "The test layout lays the 4563's track out afresh, larger: its speed regulator, where the 4563 has it, would stand across the new oval's straight; moved outside the oval",
      '1 0 270 -128 -1400 1 0 0 0 1 0 0 0 1 2869C02.DAT',
      '1 0 270 -128 -1720 1 0 0 0 1 0 0 0 1 2869C02.DAT',
    ],
  ],
  '10277-1': [
    [
      "The display stand's two bricks between the rails hold the locomotive's middle section up, clipped to it: left out, it stands on its wheels",
      '1 0 0 -56 -1560 1 0 0 0 1 0 0 0 1 3010.dat\n1 0 0 -56 -1360 1 0 0 0 1 0 0 0 1 3010.dat\n',
      '0 // Kinebrick: the display stand\'s two bricks under the middle section left out\n',
    ],
  ],
};
const OUT_DIR = join('models', 'trains');
const SETS_DIR = join('data', 'trains');
// A train whose wheelsets are all within this distance (LDU) of the track is on it already: a
// file may place a train on a curve 2 studs off, its rotations rounded.
const NEAR = 60;
// Cars on the track whose ends are less than this far apart (LDU) are of one train, which is
// closed up, magnet to magnet; and how far apart two magnets' middles are when their faces meet.
const TRAIN_GAP = 200;
const COUPLE = 16;
// Magnets this far apart (LDU, between their middles) couple as they are (see magnetCouplings in
// src/mechanism.ts, whose reach is between their faces).
const REACH = 40;
// A figure this close (LDU) to a car's part, as built, rides in or on it.
const RIDING = 40;
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

// The set's track pieces laid out afresh (see layOutTrack in src/track.ts), as model lines.
function layOut(pieces: { name: string; color: string }[]): string[] {
  return layOutTrack(pieces.map((p) => p.name)).map((m, i) => partLine(['1', pieces[i].color, ...new Array(12).fill('0'), pieces[i].name], m));
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
  // Cars: what's joined together, the track, the magnets' couplings and figures aside (a figure
  // stands on a platform or rides in a car: it joins neither to the other).
  const lead = parts.map((_, i) => i);
  const find = (i: number): number => (lead[i] === i ? i : (lead[i] = find(lead[i])));
  const coupled: [number, number][] = [];
  for (const c of mech.connections) {
    if (['rail', 'figure'].includes(mech.roles[c.male]) || ['rail', 'figure'].includes(mech.roles[c.female])) continue;
    if (mech.roles[c.male] === 'magnet' && mech.roles[c.female] === 'magnet') coupled.push([c.male, c.female]);
    else lead[find(c.male)] = find(c.female);
  }
  const carOf = (body: number) => find(mech.bodies[body].parts[0]);
  // Each rider's running radius: how far its wheels reach below the axle.
  const radius = (r: (typeof riders)[number]) => mech.treads.find((t) => t.body === r.body)?.radius ?? 22;
  const identity = new Matrix4();
  const run = trackRun(track);
  let key = -1;
  // How far along the run a point is nearest, or null if that's off the run (a siding).
  const along = (p: Vector3) => {
    track.near(p, identity, key);
    const place = track.placeOf(key--)!;
    const e = run.entries.find((x) => x.line === place.line);
    return e ? e.from + (e.dir > 0 ? place.s : track.lines[place.line].length - place.s) : null;
  };
  // The point at a distance along the run, and which way the run goes there.
  const at = (g: number) => {
    if (run.loop) g = ((g % run.length) + run.length) % run.length;
    else g = Math.max(run.start, Math.min(run.length, g));
    const e = run.entries.find((x) => g >= x.from - 1e-6 && g <= x.from + track.lines[x.line].length + 1e-6) ?? run.entries[0];
    const length = track.lines[e.line].length;
    const { point, t } = track.pointAt(e.line, e.dir > 0 ? g - e.from : length - (g - e.from));
    return { point, t: t.multiplyScalar(e.dir) };
  };
  // Each car with wheelsets: its wheelsets' middles and its magnets', where along the run its
  // middle is (null if it's off the track), which way along it it points, and where its ends are
  // and each wheelset is, measured along it from its middle.
  const magnets = mech.roles.flatMap((r, i) => (r === 'magnet' ? [i] : []));
  const partAt = (i: number) => new Vector3().setFromMatrixPosition(parts[i].matrix);
  // A magnet's car: the one it's joined to, or if it's joined to none (a file may place it, or
  // its coupling, a little off where it hangs), the car with a part nearest its coupling's pin
  // (or, with no coupling, nearest the magnet).
  const carParts = parts.flatMap((_, i) => (riders.some((r) => carOf(r.body) === find(i)) ? [i] : []));
  const magnetCar = (m: number) => {
    const group = find(m);
    if (riders.some((r) => carOf(r.body) === group)) return group;
    const pin = mech.roles.findIndex((r, i) => r === 'coupling' && find(i) === group);
    const from = partAt(pin >= 0 ? pin : m);
    const near = carParts.reduce((best, i) => (partAt(i).distanceTo(from) < partAt(best).distanceTo(from) ? i : best), carParts[0]);
    return find(near);
  };
  const row = riders[riders.length - 1].center.clone().sub(riders[0].center).setY(0).normalize();
  const cars = [...new Set(riders.map((r) => carOf(r.body)))].map((car) => {
    const mine = riders.filter((r) => carOf(r.body) === car);
    const centers = mine.map((r) => r.center.clone());
    const mean = centers.reduce((sum, c) => sum.add(c), new Vector3()).multiplyScalar(1 / centers.length);
    let u = new Vector3().crossVectors(new Vector3(0, -1, 0), mine[0].axis).normalize();
    let far = 0;
    for (const a of centers) for (const b of centers) if (a.distanceTo(b) > far) [far, u] = [a.distanceTo(b), b.clone().sub(a).setY(0).normalize()];
    const on = mine.every((r) => Math.abs(track.near(r.center, identity, key--)?.offset ?? Infinity) < NEAR);
    const g = on ? along(mean) : null;
    // Pointing the way the run goes; off the track, the way the cars stand in a row (from the
    // first car's wheelsets to the last's, as the file lists them).
    if (g !== null && u.dot(at(g).t) < 0) u.negate();
    if (g === null && u.dot(row) < 0) u.negate();
    const ends = [...centers, ...magnets.filter((m) => magnetCar(m) === car).map(partAt)].map((p) => p.clone().sub(mean).dot(u));
    return { car, mine, centers, mean, u, g, front: Math.min(...ends), rear: Math.max(...ends), wheels: centers.map((c) => c.clone().sub(mean).dot(u)) };
  });
  // The trains: the cars on the track in order along it, a car joining the one before it if
  // their ends are less than TRAIN_GAP apart; and the cars off the track, in the order they stand
  // in, as one more.
  const onTrack = cars.filter((c) => c.g !== null).sort((a, b) => a.g! - b.g!);
  const trains: (typeof cars)[] = [];
  for (const c of onTrack) {
    const last = trains[trains.length - 1]?.at(-1);
    if (last && c.g! + c.front - (last.g! + last.rear) < TRAIN_GAP) trains[trains.length - 1].push(c);
    else trains.push([c]);
  }
  // On a loop, a train may stand across where the run starts: its two parts are one.
  if (run.loop && trains.length > 1) {
    const [first, last] = [trains[0], trains[trains.length - 1]];
    const end = last[last.length - 1];
    if (first[0].g! + first[0].front + run.length - (end.g! + end.rear) < TRAIN_GAP) {
      for (const c of first) c.g! += run.length;
      last.push(...trains.shift()!);
    }
  }
  const off = cars.filter((c) => c.g === null);
  if (off.length) trains.push(off.sort((a, b) => a.mean.dot(row) - b.mean.dot(row)));
  // Each train laid along the track from where its first car's front end is (or, off the track,
  // after the trains on it), car after car, magnet to magnet: two cars coupled as built keep
  // the gap they have; the rest close up.
  const moves = new Map<number, Matrix4>(); // by car
  let free = onTrack.length ? Math.max(...onTrack.map((c) => c.g! + c.rear)) + GAP : (run.loop ? 0 : run.start) + GAP;
  const coupledAsBuilt = (c: (typeof cars)[number], next: (typeof cars)[number]) => coupled.some(([a, b]) => [find(a), find(b)].includes(c.car) && [find(a), find(b)].includes(next.car));
  // Where along the run, from `from` on, a stretch this long has the fewest other parts on it
  // (a figure or a platform standing on the track), for a train set on from beside it.
  const others = parts.flatMap((p, i) => (mech.roles[i] !== 'rail' && !SLEEPERS.test(p.name) && !carParts.includes(i) && magnets.every((m) => find(m) !== find(i)) ? [new Vector3().setFromMatrixPosition(p.matrix)] : []));
  const clearStretch = (from: number, length: number) => {
    const end = run.loop ? from + run.length : run.length - length;
    let best = { g: from, count: Infinity };
    for (let g = from; g <= Math.max(from, end); g += 40) {
      let count = 0;
      for (let d = 0; d <= length; d += 40) {
        const p = at(g + d).point;
        count += others.filter((o) => Math.hypot(o.x - p.x, o.z - p.z) < 80).length;
      }
      if (count < best.count) best = { g, count };
    }
    return best.g;
  };
  // A kept car's lift, one move for each lift (to a tenth of an LDU), so that a submodel holding
  // several cars lifted alike moves as one.
  const lifts = new Map<number, Matrix4>();
  const lifted = (dy: number) => {
    const key = Math.round(dy * 10);
    if (!lifts.has(key)) lifts.set(key, new Matrix4().makeTranslation(0, key / 10, 0));
    return lifts.get(key)!;
  };
  for (const train of trains) {
    // A train on the track whose cars' magnets all come within reach of each other keeps its
    // place: each car only raised or lowered, its wheels to the rail heads (the viewer sets it on
    // the line and couples it, see setOnRails).
    const kept = train[0].g !== null && train.every((c, k) => k === 0 || c.g! + c.front - (train[k - 1].g! + train[k - 1].rear) < REACH);
    let cursor = train[0].g !== null ? train[0].g! + train[0].front : clearStretch(free, train.reduce((n, c) => n + c.rear - c.front + COUPLE, 0));
    train.forEach((c, k) => {
      const middle = cursor - c.front;
      const targets = kept ? c.mine.map((r, i) => c.centers[i].clone().setY(track.head() - radius(r))) : c.wheels.map((w, i) => at(middle + w).point.addScaledVector(new Vector3(0, 1, 0), -radius(c.mine[i])));
      const next = train[k + 1];
      const coupledToNext = next && coupledAsBuilt(c, next);
      // The gap to the next car's front end: as built, if they're coupled (measured between their
      // middles), else magnet to magnet.
      cursor = middle + c.rear + (coupledToNext ? Math.abs(next.mean.clone().sub(c.mean).dot(c.u)) - c.rear + next.front : COUPLE);
      // Turned about the upright and moved, as one, to put its wheelsets on their places.
      const ct = targets.reduce((sum, t) => sum.add(t), new Vector3()).multiplyScalar(1 / targets.length);
      let angle: number;
      if (targets.length > 1) {
        let [cross, dot] = [0, 0];
        c.centers.forEach((src, i) => {
          const [a, b] = [src.clone().sub(c.mean), targets[i].clone().sub(ct)];
          cross += a.z * b.x - a.x * b.z;
          dot += a.x * b.x + a.z * b.z;
        });
        angle = Math.atan2(cross, dot);
      } else angle = heading(at(middle).t) - heading(c.u);
      const turned = c.mean.clone().applyMatrix4(levelMove(angle, new Vector3()));
      moves.set(c.car, kept ? lifted(ct.y - c.centers.reduce((sum, p) => sum + p.y, 0) / c.centers.length) : levelMove(angle, ct.clone().sub(turned)));
    });
    free = Math.max(free, cursor + GAP);
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
  // A figure's line moves with the car it stood in or on: the one with a part nearest it, within
  // RIDING.
  const carPartsAt = parts.flatMap((p, i) => (moves.has(find(i)) && mech.roles[i] !== 'figure' ? [{ car: find(i), at: new Vector3().setFromMatrixPosition(p.matrix) }] : []));
  parts.forEach((p, i) => {
    if (mech.roles[i] !== 'figure' || votes.has(lineOf[i])) return;
    const at = new Vector3().setFromMatrixPosition(p.matrix);
    const near = carPartsAt.reduce((best, c) => (c.at.distanceTo(at) < (best?.at.distanceTo(at) ?? Infinity) ? c : best), null as (typeof carPartsAt)[number] | null);
    if (!near || near.at.distanceTo(at) > RIDING) return;
    const lineParts = lineOf.filter((l) => l === lineOf[i]).length;
    votes.set(lineOf[i], new Map([[near.car, lineParts]]));
  });
  // The parts on each line, those joined to nothing aside (they don't hold a line back: a
  // road-rail vehicle's loose road wheels).
  const partsOnLine = new Map<number, number>();
  lineOf.forEach((l, i) => {
    if (!mech.loose.includes(i)) partsOnLine.set(l, (partsOnLine.get(l) ?? 0) + 1);
  });
  let moved = 0;
  for (const [line, v] of votes) {
    // Cars that move alike count together (a kept train's, all lifted as one).
    const byMove = new Map<Matrix4, number>();
    for (const [car, n] of v) byMove.set(moves.get(car)!, (byMove.get(moves.get(car)!) ?? 0) + n);
    const [move, n] = [...byMove].sort((a, b) => b[1] - a[1])[0];
    if (n * 2 < (partsOnLine.get(line) ?? 0)) continue;
    const tokens = lines[line].trim().split(/\s+/);
    lines[line] = partLine(tokens, move.clone().multiply(lineMatrix(tokens)));
    moved++;
  }
  return { text: lines.join('\n'), trains: trains.length, moved };
}

// The track as one run, for laying trains along it: from the start of its first line, on through
// the lines that follow, to a buffer or (a loop) back to the start; and for a line rather than a
// loop, back from that start the other way too. Each line on it: where along the run it starts,
// and which way along the run it goes (1 from its start to its end).
function trackRun(track: Track) {
  const entries: { line: number; dir: number; from: number }[] = [];
  let [line, dir, from] = [0, 1, 0];
  for (;;) {
    entries.push({ line, dir, from });
    from += track.lines[line].length;
    const next = track.beyond(line, dir > 0 ? 1 : 0);
    if (!next) break;
    [line, dir] = [next[0], next[1] === 0 ? 1 : -1];
    if (line === 0 && dir === 1) return { entries, length: from, loop: true, start: 0 };
    if (entries.some((e) => e.line === line)) break;
  }
  let [l, d, back] = [0, -1, 0];
  for (;;) {
    const next = track.beyond(l, d > 0 ? 1 : 0);
    if (!next) break;
    [l, d] = [next[0], next[1] === 0 ? 1 : -1];
    if (entries.some((e) => e.line === l)) break;
    back += track.lines[l].length;
    entries.unshift({ line: l, dir: -d, from: -back });
  }
  return { entries, length: from, loop: false, start: -back };
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

// Kinebrick's own test layouts, made as a set's are: a set's model with track pieces added, laid
// out afresh. No OMR set with 9V track has a switch or a crossing, so the first runs the 4563's
// train on its oval with a switch and a crossing added, a siding on the switch's branch.
const TESTS: { set: string; name: string; from: string; add: string[] }[] = [
  { set: 'test-1', name: 'Switch and crossing', from: '4563-1', add: ['75542-f1.dat', '32087.dat', ...new Array(6).fill('74746.dat')] },
];

// Makes one set's model, and its function list (see the top of this file). `add`: track pieces
// to add, which has the track laid out afresh.
function makeModel(set: string, name: string, source: string, add: string[] = []) {
  let text: string;
  try {
    text = readFileSync(source, 'utf-8');
  } catch {
    console.log(`${set}: no ${source} (npm run omr -- --trains downloads it)`);
    return;
  }
  text = text.replace(/\r\n/g, '\n');
  for (const [why, wrong, right] of ERRATA[set] ?? []) {
    if (!text.includes(wrong)) throw new Error(`${set}: no line ${wrong} to correct (${why})`);
    text = text.replace(wrong, right);
  }
  text = splitBogies(text);
  // A coupling's magnet turned up, out of use (4022c02, 4023c02), is turned down, so that the
  // train runs coupled (4022c01, 4023c01).
  text = text.replace(/\b(4022|4023)c02\.dat\b/gi, '$1c01.dat');
  const parts = readText(text);
  // Laid out: every piece joined to the rest, in one piece.
  const track = buildTrack(parts);
  if (!track) return;
  const known = [...new Set(track.lines.map((l) => l.part))];
  const lead = track.lines.map((_, i) => i);
  const find = (i: number): number => (lead[i] === i ? i : (lead[i] = find(lead[i])));
  track.links.forEach((ends, l) => ends.forEach((e) => e.forEach(([m]) => (lead[find(l)] = find(m)))));
  track.lines.forEach((line, l) => track.lines.forEach((other, m) => line.part === other.part && (lead[find(l)] = find(m))));
  const laid = new Set(track.lines.map((_, i) => find(i))).size === 1 && add.length === 0;
  let lines = text.split(/\r?\n/);
  let note = 'the track as the OMR file lays it out';
  if (!laid) {
    // Every track piece taken out, wherever it was, and laid out afresh in the main model. Single
    // rails go as the whole pieces they make (see railPieces), with their sleepers.
    const pieces: { name: string; color: string }[] = railPieces(parts).map((p) => ({ name: p.name, color: '7' }));
    lines = lines.filter((l) => {
      const tokens = l.trim().split(/\s+/);
      const name = tokens.slice(14).join(' ');
      if (tokens[0] !== '1' || tokens.length < 15) return true;
      if (SLEEPERS.test(name) || railPieces([{ name, matrix: new Matrix4() }, { name, matrix: new Matrix4().makeTranslation(0, 0, 100) }]).length) return false;
      if (!trackPiece(name)) return true;
      pieces.push({ name, color: tokens[1] });
      return false;
    });
    pieces.push(...add.map((name) => ({ name, color: '7' })));
    const [, end] = mainRange(lines);
    lines.splice(end, 0, ...layOut(pieces));
    note = add.length ? `a test layout: the track of ${set.replace(/^test-\d+$/, 'a set')}, with pieces added, laid out afresh` : "the track laid out afresh from the set's own pieces";
  }
  // Kinebrick's note, after the main model's header.
  const [start] = mainRange(lines);
  const firstPart = lines.findIndex((l, i) => i > start && !/^\s*0\s/.test(l) && l.trim() !== '');
  lines.splice(firstPart < 0 ? start + 1 : firstPart, 0, `0 // Kinebrick: ${note}, with the trains set on it (scripts/train-layouts.ts)`);
  const made = setTrainsOnTrack(lines.join('\n'));
  const out = join(OUT_DIR, `${set.startsWith('test') ? 'Test' : set.replace(/-1$/, '')}-${name}`.replace(/[/\\:]/g, '-') + '.mpd');
  writeFileSync(out, made.text.replace(/\n*$/, '\n'));
  const json = join(SETS_DIR, `${set}.json`);
  const was = existsSync(json) ? JSON.parse(readFileSync(json, 'utf-8')) : {};
  const functions = trainFunctions(out);
  writeFileSync(json, JSON.stringify({ set, curated: { model: out, functions }, generated: was.generated ?? {} }, null, 2) + '\n');
  console.log(`${out}: ${laid ? 'laid out' : 'layout made'}, ${known.length + add.length} track pieces, ${made.trains} trains, ${made.moved} lines moved, ${functions.length} functions`);
}

const only = process.argv.slice(2);
const csv = readFileSync(CSV, 'utf-8').trim().split(/\r?\n/);
const header = csvFields(csv[0]);
mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(SETS_DIR, { recursive: true });
const sourceOf = (row: Record<string, string>) => CORRECTED[row.set_num] ?? join('omr', 'trains', `${row.set_num} ${row.name}`.replace(/[/\\:]/g, '-') + '.mpd');
const rows = csv.slice(1).map((l) => Object.fromEntries(header.map((h, i) => [h, csvFields(l)[i] ?? ''])));
for (const row of rows) {
  if (only.length && !only.some((o) => row.set_num.includes(o))) continue;
  makeModel(row.set_num, row.name, sourceOf(row));
}
for (const test of TESTS) {
  if (only.length && !only.some((o) => test.set.includes(o))) continue;
  makeModel(test.set, test.name, sourceOf(rows.find((r) => r.set_num === test.from)!), test.add);
}
