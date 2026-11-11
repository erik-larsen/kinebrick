// Checks a train set's functions (curated.functions in data/trains/<set>.json), as
// scripts/check-functions.ts does a Technic set's (npm run functions -- --trains runs them). There
// are three kinds, each with `kind` saying which (see trainFunctions, which lists them for a set):
//
//   track    the track's pieces join end to end into one layout
//   run      turning one of a train's wheels (`control`, as "p483 70720c01") runs the train the
//            full length of the track: on a loop, a full lap and back to where it started; on a
//            line, to one end and back to the other. All the way, every wheelset keeps to the
//            track's centre line, its wheels on the rail heads, the cars stay coupled, and the
//            train goes as far as its wheel's rim turns.
//   switch   a switch (`control`, its part) flips, and a train taking it from its shared end then
//            goes the other way
//
// A function works if all it asks for happens; a run partly works if the train moves but not
// all the way, or leaves the track or its coupling on the way.

import type { Mechanism } from '../src/mechanism.ts';
import type { Track } from '../src/track.ts';
import { loadModel } from './load-model.ts';

// How far the control is turned at a time (radians).
const STEP = 0.5;
// A wheelset counts as off the track if its middle is this far (LDU) across from the centre
// line, or its wheels this far above or below the rail heads.
const OFF = 3;
// Cars count as uncoupled if their magnets' meeting point comes this far (LDU) apart.
const APART = 4;
// A lap is back where it started if the wheel is this close (LDU) to where it was.
const BACK = 10;
// A run reaches an end of the track if a wheelset comes this close to it (LDU).
const AT_END = 40;
// The train goes as far as its wheel's rim turns, within this share.
const ROLL_OFF = 0.05;

export interface TrainFunction {
  kind: 'track' | 'run' | 'switch';
  does: string;
  control?: string;
}

export interface TrainChecked {
  result: 'works' | 'partly' | 'no' | 'error';
  why?: string[];
  travelled?: number; // how far the train went (LDU)
  length?: number; // how far it had to go: a lap, or the line's length less the train's
  offTrack?: number; // the furthest a wheelset came off the track (LDU)
  apart?: number; // the furthest a coupling came apart (LDU)
  rolled?: number; // how far the train went for each radian its wheel turned (LDU), the wheel's running radius if it rolls
  radius?: number; // the wheel's running radius (LDU)
}

// A part named as the function lists name it ("p483 70720c01").
const partOf = (ref: string) => Number(/^p(\d+)\b/.exec(ref.trim())![1]);

// The groups the track's lines join into (lines of one piece count as joined).
function trackGroups(track: Track): number {
  const lead = track.lines.map((_, i) => i);
  const find = (i: number): number => (lead[i] === i ? i : (lead[i] = find(lead[i])));
  track.links.forEach((ends, l) => ends.forEach((e) => e.forEach(([m]) => (lead[find(l)] = find(m)))));
  track.lines.forEach((line, l) => track.lines.forEach((other, m) => line.part === other.part && (lead[find(l)] = find(m))));
  return new Set(track.lines.map((_, i) => find(i))).size;
}

// From a place on the track, going forwards: the length of the loop it is on, or null if the
// way forwards ends at a buffer.
function loopLength(track: Track, line: number, s: number, dir: number): number | null {
  let [l, d] = [line, dir];
  let length = d > 0 ? track.lines[l].length - s : s;
  for (let hop = 0; hop < 10000; hop++) {
    const next = track.beyond(l, d > 0 ? 1 : 0);
    if (!next) return null;
    // Entering a line at its start goes along it; at its end, back along it.
    [l, d] = [next[0], next[1] === 0 ? 1 : -1];
    if (l === line && d === dir) return length + (d > 0 ? s : track.lines[l].length - s);
    length += track.lines[l].length;
  }
  return null;
}

// The functions a set's model calls for: its track joining up, each train running, each switch.
export function trainFunctions(file: string): TrainFunction[] {
  const { parts, mech } = loadModel(file, true);
  const track = mech.track;
  if (!track) return [];
  const name = (p: number) => `p${p} ${parts[p].name.replace(/\.dat$/, '')}`;
  const functions: TrainFunction[] = [{ kind: 'track', does: "The track's pieces join end to end into one layout" }];
  // One run for each train: its first wheelset that rolls, turned by one of its wheels.
  const seen = new Set<number>();
  for (const train of trains(mech)) {
    const rider = train.find((r) => r.rolls && !seen.has(r.body));
    if (!rider) continue;
    train.forEach((r) => seen.add(r.body));
    const wheel = mech.bodies[rider.body].parts.find((p) => mech.roles[p] === 'train wheel') ?? mech.bodies[rider.body].parts[0];
    functions.push({ kind: 'run', does: 'Turning a wheel of the train runs it the full length of the track (on a loop, a full lap back to its start), every wheelset on the track and its cars coupled', control: name(wheel) });
  }
  for (const s of track.switches) functions.push({ kind: 'switch', does: 'The switch flips, and a train taking it from its shared end goes the other way', control: name(s.part) });
  return functions;
}

// The trains: wheelsets whose bodies are joined, couplings and all (as the solver keeps them).
function trains(mech: Mechanism) {
  const lead = mech.bodies.map((_, i) => i);
  const find = (i: number): number => (lead[i] === i ? i : (lead[i] = find(lead[i])));
  for (const j of mech.joints) lead[find(j.bodyA)] = find(j.bodyB);
  const groups = new Map<number, NonNullable<Mechanism['riders']>>();
  for (const r of mech.riders ?? []) groups.set(find(r.body), [...(groups.get(find(r.body)) ?? []), r]);
  return [...groups.values()];
}

export function checkTrainSet(set: { curated: { model: string; functions: TrainFunction[] } }) {
  const { model, functions } = set.curated;
  const checked: TrainChecked[] = [];
  let loose: string[] = [];
  for (const fn of functions) {
    // Each function on the model as loaded, afresh.
    const { parts, mech, kin } = loadModel(model, true);
    loose = mech.loose.map((p) => `p${p} ${parts[p].name.replace(/\.dat$/, '')}`);
    const track = mech.track;
    try {
      if (!track) checked.push({ result: 'no', why: ['no track'] });
      else if (fn.kind === 'track') {
        const groups = trackGroups(track);
        checked.push(groups === 1 ? { result: 'works' } : { result: 'no', why: [`the track is in ${groups} pieces`] });
      } else if (fn.kind === 'switch') {
        const part = partOf(fn.control!);
        const sw = track.switchOf(part);
        if (!sw) checked.push({ result: 'no', why: ['not a switch'] });
        else {
          // Into the switch from the track that meets its shared end: which of its lines a
          // train takes, before and after it flips.
          const outside = track.beyond(sw.lines[0], 0);
          const into = () => (outside ? track.beyond(outside[0], outside[1])?.[0] : sw.lines[sw.state]);
          const before = into();
          track.flip(part);
          const after = into();
          checked.push(before !== after && sw.lines.includes(after!) ? { result: 'works' } : { result: 'no', why: ['flipping it changes nothing'] });
        }
      } else checked.push(run(mech, kin, track, partOf(fn.control!)));
    } catch (err) {
      checked.push({ result: 'error', why: [(err as Error).message] });
    }
  }
  const counts: Record<string, number> = {};
  for (const c of checked) counts[c.result] = (counts[c.result] ?? 0) + 1;
  return { counts, loose, functions: checked };
}

// Runs a train by turning one of its wheels: a lap of a loop, or to each end of a line.
function run(mech: Mechanism, kin: ReturnType<typeof loadModel>['kin'], track: Track, wheel: number): TrainChecked {
  const body = mech.bodyOf[wheel];
  const joint = mech.joints.findIndex((j) => j.kind === 'revolute' && (j.bodyA === body || j.bodyB === body));
  if (joint < 0) return { result: 'no', why: ['the wheel turns on nothing'] };
  const poses = (kin as unknown as { poses: import('three').Matrix4[] }).poses;
  const riders = mech.riders ?? [];
  const lead = riders.find((r) => r.body === body) ?? riders[0];
  const radius = mech.treads.find((t) => t.body === lead.body)?.radius ?? 22;
  const center = (r: (typeof riders)[number]) => r.center.clone().applyMatrix4(poses[r.body]);
  const head = track.head();
  // Couplings: ball joints between magnets' bodies.
  const magnets = new Set(mech.roles.flatMap((role, i) => (role === 'magnet' ? [mech.bodyOf[i]] : [])));
  const couplings = mech.joints.filter((j) => j.kind === 'ball' && magnets.has(j.bodyA) && magnets.has(j.bodyB));
  // The worst of the train's wheelsets off the track, and of its couplings apart, now.
  let offTrack = 0;
  let apart = 0;
  const measure = () => {
    for (const [i, r] of riders.entries()) {
      const c = center(r);
      const near = track.near(c, poses[0], i)!;
      const rr = mech.treads.find((t) => t.body === r.body)?.radius ?? radius;
      offTrack = Math.max(offTrack, Math.abs(near.offset), Math.abs(c.y + rr - head));
    }
    for (const j of couplings) apart = Math.max(apart, j.from.clone().applyMatrix4(poses[j.bodyA]).distanceTo(j.to.clone().applyMatrix4(poses[j.bodyB])));
  };
  measure();
  const start = center(lead);
  track.near(start, poses[0], riders.indexOf(lead));
  const place = track.placeOf(riders.indexOf(lead))!;
  // Which way along its line the train goes when the wheel turns positive: found by trying.
  const before = kin.snapshot();
  kin.turnJoint(joint, STEP);
  const tried = center(lead).sub(start).setY(0);
  kin.restore(before);
  const t = track.pointAt(place.line, place.s).t;
  const dir = tried.dot(t) >= 0 ? 1 : -1;
  const lap = loopLength(track, place.line, place.s, dir);
  // How far the train goes (LDU, along the way it goes) and how far the wheel turned.
  let travelled = 0;
  let turned = 0;
  const go = (way: number, until: () => boolean, most: number) => {
    let last = center(lead);
    for (let i = 0; i < most; i++) {
      const done = kin.turnJoint(joint, way * STEP);
      turned += Math.abs(done);
      const now = center(lead);
      travelled += now.clone().sub(last).setY(0).length();
      last = now;
      measure();
      if (Math.abs(done) < STEP - 1e-9 || until()) return;
    }
  };
  const total = (lap ?? track.lines.reduce((sum, l) => sum + l.length, 0)) * 1.5;
  const most = Math.ceil(total / (radius * STEP));
  const why: string[] = [];
  let length: number;
  let reached: boolean;
  if (lap !== null) {
    length = lap;
    go(1, () => travelled > lap - BACK && center(lead).distanceTo(start) < BACK, most);
    reached = travelled > lap - BACK && center(lead).distanceTo(start) < BACK;
    if (!reached) why.push(`went ${Math.round(travelled)} of a ${Math.round(lap)} LDU lap`);
  } else {
    // A line: to the end it goes towards, then back to the other.
    go(1, () => false, most);
    const there = travelled;
    const firstEnd = bufferNear(track, riders.map((_, i) => track.placeOf(i)!));
    go(-1, () => false, most);
    const back = travelled - there;
    const secondEnd = bufferNear(track, riders.map((_, i) => track.placeOf(i)!));
    length = back;
    reached = firstEnd && secondEnd && back > 0;
    if (!firstEnd || !secondEnd) why.push(`stopped short of ${!firstEnd && !secondEnd ? 'both ends' : 'an end'} of the track`);
  }
  const rolled = turned > 0 ? travelled / turned : 0;
  if (offTrack > OFF) why.push(`a wheelset came ${offTrack.toFixed(1)} LDU off the track`);
  if (apart > APART) why.push(`a coupling came ${apart.toFixed(1)} LDU apart`);
  if (Math.abs(rolled - radius) > ROLL_OFF * radius) why.push(`went ${rolled.toFixed(1)} LDU for each radian its wheel turned, not ${radius}`);
  const result = travelled < 1 ? 'no' : reached && why.length === 0 ? 'works' : 'partly';
  return { result, ...(why.length ? { why } : {}), travelled: Math.round(travelled), length: Math.round(length), offTrack: round(offTrack), apart: round(apart), rolled: round(rolled), radius };
}

const round = (x: number) => Math.round(x * 10) / 10;

// Whether any of these places is near a buffer: the end of a line that meets no other.
function bufferNear(track: Track, places: { line: number; s: number }[]): boolean {
  return places.some((p) => track.walk(p.line, p.s, -AT_END).short > 0 || track.walk(p.line, p.s, AT_END).short > 0);
}
