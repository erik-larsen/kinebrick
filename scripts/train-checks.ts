// Checks a train set's functions (curated.functions in data/trains/<set>.json), as
// scripts/check-functions.ts does a Technic set's (npm run functions -- --trains runs them). There
// are three kinds, each with `kind` saying which (see trainFunctions, which lists them for a set):
//
//   track    the track's pieces join end to end into one layout
//   run      turning one of a train's wheels (`control`, as "p483 70720c01") runs the train the
//            full length of the track: on a loop, a full lap and back to where it started; on a
//            line, to one end and back to the other. All the way, every wheelset keeps to the
//            track's centre line, its wheels on the rail heads, the cars stay coupled, and the
//            train goes as far as its wheel's rim turns. As in the viewer, it stops where a part
//            runs into another (a collision), so a train that the viewer's motor turns back
//            doesn't pass.
//   switch   a switch (`control`, its part) flips, and a train taking it from its shared end then
//            goes the other way
//
// A function works if all it asks for happens; a run partly works if the train moves but not
// all the way, or leaves the track or its coupling on the way.

import type { Matrix4 } from 'three';
import { Collisions, connectedPairs, LAYOUT_INSET, PartMesh } from '../src/collisions.ts';
import { railLift } from '../src/constraints/tyres.ts';
import type { Mechanism } from '../src/mechanism.ts';
import type { Track } from '../src/track.ts';
import { loadModel } from './load-model.ts';
import { partShapes } from './part-shapes.ts';

// How far the control is turned at a time (radians).
const STEP = 0.5;
// A wheelset counts as off the track if its middle is this far (LDU) across from the centre
// line, or its wheels this far above or below the rail heads.
const OFF = 3;
// Cars count as uncoupled if their magnets' meeting point comes this far (LDU) apart.
const APART = 4;
// A lap is back where it started if the wheel is this close (LDU) to where it was.
const BACK = 10;
// A run reaches an end of the track if a wheelset comes this close to it (LDU); or, stopped by
// something there (a buffer stop, a loading ramp the line runs into), this close: a car's end
// stands well past its wheelset (167's wagon meets the ramp 122 LDU short of the line's end).
const AT_END = 40;
const STOPPED_AT_END = 150;
// Wheelsets this close together (LDU, middle to middle) are of one train: a train's cars stand
// closed up, their wheelsets less far apart across a coupling than this.
const CLOSE = 300;
// The train goes as far as its wheel's rim turns, within this share.
const ROLL_OFF = 0.05;

export interface TrainFunction {
  kind: 'track' | 'run' | 'switch';
  does: string;
  control?: string;
  wheelsets?: string[]; // a run's: the train's wheelsets, each by a part of it, all of which should go along
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
    // Each wheelset's body, by one of its parts, so the check can see that every car goes along.
    const wheelsets = [...new Set(train.map((r) => r.body))].map((b) => name(mech.bodies[b].parts[0]));
    functions.push({ kind: 'run', does: 'Turning a wheel of the train runs it the full length of the track (on a loop, a full lap back to its start), every wheelset on the track and its cars coupled', control: name(wheel), wheelsets });
  }
  // Every set in the list has a train (see scripts/find-train-sets.ts). If none of its wheels ride
  // the track as Kinebrick reads it, its run is still a function, and doesn't work.
  if (!functions.some((f) => f.kind === 'run')) functions.push({ kind: 'run', does: 'Turning a wheel of the train runs it the full length of the track (no train found on the track yet)' });
  for (const s of track.switches) functions.push({ kind: 'switch', does: 'The switch flips, and a train taking it from its shared end goes the other way', control: name(s.part) });
  return functions;
}

// The trains: wheelsets whose bodies are joined (couplings and all, as the solver keeps them),
// and those standing close together, as scripts/train-layouts.ts sets a train's cars on the track,
// closed up, whether or not their couplings hold.
function trains(mech: Mechanism) {
  const lead = mech.bodies.map((_, i) => i);
  const find = (i: number): number => (lead[i] === i ? i : (lead[i] = find(lead[i])));
  for (const j of mech.joints) lead[find(j.bodyA)] = find(j.bodyB);
  const riders = mech.riders ?? [];
  for (const a of riders) for (const b of riders) if (a.center.distanceTo(b.center) < CLOSE) lead[find(a.body)] = find(b.body);
  const groups = new Map<number, NonNullable<Mechanism['riders']>>();
  for (const r of mech.riders ?? []) groups.set(find(r.body), [...(groups.get(find(r.body)) ?? []), r]);
  return [...groups.values()];
}

export async function checkTrainSet(set: { curated: { model: string; functions: TrainFunction[] } }) {
  const { model, functions } = set.curated;
  // The parts' shapes, for collisions, as the viewer makes them.
  const shapes = await partShapes(model);
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
          if (before === after || !sw.lines.includes(after!)) checked.push({ result: 'no', why: ['flipping it changes nothing'] });
          else {
            // With a train on the track: run it, each way round, and see that it goes the way the
            // switch is set now (a train meets it from its shared end going one way round).
            const train = mech.riders?.length ? onto(mech, kin, track, sw.lines[sw.state]) : null;
            checked.push(train === false ? { result: 'partly', why: ["the train didn't take the way the switch is set"] } : { result: 'works' });
          }
        }
      } else if (!fn.control) checked.push({ result: 'no', why: ["Kinebrick doesn't find the train's wheels on the track"] });
      else checked.push(run(mech, kin, track, partOf(fn.control!), (fn.wheelsets ?? []).map((w) => mech.bodyOf[partOf(w)]), blocker(mech, kin, parts, shapes)));
    } catch (err) {
      checked.push({ result: 'error', why: [(err as Error).message] });
    }
  }
  const counts: Record<string, number> = {};
  for (const c of checked) counts[c.result] = (counts[c.result] ?? 0) + 1;
  return { counts, loose, functions: checked };
}

// The viewer's collision test (blockedBy in src/main.ts), for a model's parts: what stops them
// where they stand now (two parts that run into each other, a joint at its limit), or null.
function blocker(mech: Mechanism, kin: ReturnType<typeof loadModel>['kin'], parts: { name: string; matrix: Matrix4; path?: unknown }[], shapes: { name: string; shape: PartMesh[] }[]) {
  // Each part's shape, in order, passing over shapes with no part's name: primitives a split
  // part's pieces draw (the monorail motor's shaft), which the scripts' part list leaves out.
  const shapeOf: PartMesh[][] = [];
  let k = 0;
  for (const p of parts) {
    while (k < shapes.length && shapes[k].name !== p.name && shapes[k].name === '') k++;
    if (k >= shapes.length || shapes[k].name !== p.name) throw new Error("the parts' shapes don't match the model's parts");
    // (A path's links, a hose's or a chain's, only show where it runs, as in the viewer: no
    // shape. Nor a cable's pieces, which bend out of the way.)
    shapeOf.push(p.path || mech.roles[shapeOf.length] === 'cable' ? [] : shapes[k].shape);
    k++;
  }
  const poses = (kin as unknown as { poses: Matrix4[] }).poses;
  const now = () => parts.map((p, i) => poses[mech.bodyOf[i]].clone().multiply(p.matrix));
  const collisions = new Collisions(shapeOf, mech.bodyOf, connectedPairs(mech), now(), LAYOUT_INSET);
  const starts = parts.map((p) => p.matrix);
  const name = (i: number) => `p${i} ${parts[i].name.replace(/\.dat$/, '')}`;
  return (): string | null => {
    const at = now();
    const hit = collisions.check(at);
    if (hit) return `${name(hit[0])} ran into ${name(hit[1])}`;
    if (kin.atLimit() !== null) return 'a joint came to its limit';
    // (The ground is the table under the track, as in the viewer: not the rail heads.)
    const below = kin.groundY === null ? null : collisions.belowGround(at, collisions.table(starts), starts);
    return below ? `${name(below[0])} went into the ground` : null;
  };
}

// Runs a train by turning one of its wheels: a lap of a loop, or to each end of a line.
function run(mech: Mechanism, kin: ReturnType<typeof loadModel>['kin'], track: Track, wheel: number, wheelsets: number[], blockedBy: () => string | null): TrainChecked {
  const body = mech.bodyOf[wheel];
  const joint = mech.joints.findIndex((j) => j.kind === 'revolute' && (j.bodyA === body || j.bodyB === body));
  if (joint < 0) return { result: 'no', why: ['the wheel turns on nothing'] };
  const poses = (kin as unknown as { poses: import('three').Matrix4[] }).poses;
  const riders = mech.riders ?? [];
  const lead = riders.find((r) => r.body === body) ?? riders[0];
  const radius = mech.treads.find((t) => t.body === lead.body)?.radius ?? 22;
  const center = (r: (typeof riders)[number]) => r.center.clone().applyMatrix4(poses[r.body]);
  // Where the train's going is measured: at the wheelset's middle if its wheels are on one axle
  // (on a curve they skid, and the middle keeps to the turning); at the wheel itself if it turns
  // on a pin of its own (the 4.5V and 12V trains' wheel block), whose rim then rolls the way it
  // goes, the inner wheel on a curve going less far than the middle.
  const own = mech.treads.filter((t) => t.body === body).length === 1 ? mech.treads.find((t) => t.body === body)! : null;
  const gauge = () => (own ? own.center.clone().applyMatrix4(poses[body]) : center(lead));
  const head = track.head();
  // Couplings: ball joints between magnets' bodies.
  const magnets = new Set(mech.roles.flatMap((role, i) => (role === 'magnet' ? [mech.bodyOf[i]] : [])));
  const couplings = mech.joints.filter((j) => j.kind === 'ball' && magnets.has(j.bodyA) && magnets.has(j.bodyB));
  // The worst of the train's wheelsets off the track, and of its couplings apart, now.
  let offTrack = 0;
  let apart = 0;
  const measure = () => {
    for (const [i, r] of riders.entries()) {
      // Only the train's own wheelsets (another train, or spare wheels, may stand elsewhere).
      if (wheelsets.length && !wheelsets.includes(r.body)) continue;
      const c = center(r);
      const near = track.near(c, poses[0], i)!;
      const rr = mech.treads.find((t) => t.body === r.body)?.radius ?? radius;
      // (Its height against the rail heads under it: a monorail's run at more than one height.)
      // (Up a slope it stands a little higher, its radius square to the rail.)
      const under = track.under(c.clone().setY(c.y + rr), poses[0]);
      const rail = under ? under.y - railLift(rr, under.rise) : head;
      offTrack = Math.max(offTrack, Math.abs(near.offset), Math.abs(c.y + rr - rail));
    }
    for (const j of couplings) apart = Math.max(apart, j.from.clone().applyMatrix4(poses[j.bodyA]).distanceTo(j.to.clone().applyMatrix4(poses[j.bodyB])));
  };
  measure();
  // Every wheelset of the train, where it starts: each should go as far as the lead one.
  const train = riders.filter((r) => wheelsets.includes(r.body));
  const starts = train.map(center);
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
  // As the viewer's motor does: whatever the turning doesn't need is held where it is (a cab
  // roof on a slide rides with its cab, rather than staying put as the cab moves on).
  kin.holdWhatTheDragDoesntNeed(body, () => kin.jointMotion(joint) !== null, joint);
  // A lap if the track loops the way the train goes; or, if it leads that way into a siding and
  // the other way round a loop (as 6991's, its points set as built), a lap the other way.
  let lap = loopLength(track, place.line, place.s, dir);
  let way = 1;
  if (lap === null) {
    const other = loopLength(track, place.line, place.s, -dir);
    if (other !== null) [lap, way] = [other, -1];
  }
  // How far the train goes (LDU, along the way it goes) and how far the wheel turned.
  let travelled = 0;
  let turned = 0;
  // How far the wheel's rim went, for how far it turned; and how many of the train's wheelsets
  // were left behind on the way.
  let rimWent = 0;
  let stragglers = 0;
  let checkedOnce = false;
  // The first two parts that ran into each other on the way, if any.
  let ranInto: string | null = null;
  const allowed = () => {
    const pair = blockedBy();
    if (pair && !ranInto) ranInto = pair;
    return pair === null;
  };
  // Whether it ran into something (and was stopped by it) on its way: set by each go.
  let stopped = false;
  const go = (way: number, until: () => boolean, most: number) => {
    ranInto = null;
    let last = center(lead);
    let lastRim = gauge();
    for (let i = 0; i < most; i++) {
      const done = kin.turnJoint(joint, way * STEP, allowed);
      turned += Math.abs(done);
      const now = center(lead);
      // (As it goes, up and down a ramp too, as the track's lengths are measured.)
      travelled += now.distanceTo(last);
      last = now;
      rimWent += gauge().sub(lastRim).setY(0).length();
      lastRim = gauge();
      if (!checkedOnce && center(lead).distanceTo(start) > 200) {
        checkedOnce = true;
        stragglers = train.filter((r, k) => center(r).distanceTo(starts[k]) < 100).length;
      }
      measure();
      if (Math.abs(done) < STEP - 1e-9 || until()) break;
    }
    stopped = ranInto !== null;
  };
  const total = (lap ?? track.lines.reduce((sum, l) => sum + l.length, 0)) * 1.5;
  const most = Math.ceil(total / (radius * STEP));
  const why: string[] = [];
  let length: number;
  let reached: boolean;
  if (lap !== null) {
    length = lap;
    go(way, () => travelled > lap - BACK && center(lead).distanceTo(start) < BACK, most);
    reached = travelled > lap - BACK && center(lead).distanceTo(start) < BACK;
    if (!reached) why.push(`went ${Math.round(travelled)} of a ${Math.round(lap)} LDU lap`);
  } else {
    // A line: to the end it goes towards, then back to the other.
    // (Stopped at an end by something there, it has reached that end: that's no fault.)
    const atEnd = () => bufferNear(track, riders.map((_, i) => track.placeOf(i)!), stopped ? STOPPED_AT_END : AT_END);
    go(1, () => false, most);
    const there = travelled;
    const firstEnd = atEnd();
    const firstHit = firstEnd ? null : ranInto;
    go(-1, () => false, most);
    const back = travelled - there;
    const secondEnd = atEnd();
    ranInto = firstHit ?? (secondEnd ? null : ranInto);
    length = back;
    reached = firstEnd && secondEnd && back > 0;
    if (!firstEnd || !secondEnd) why.push(`stopped short of ${!firstEnd && !secondEnd ? 'both ends' : 'an end'} of the track`);
  }
  const rolled = turned > 0 ? rimWent / turned : 0;
  if (ranInto) why.push(`stopped: ${ranInto}`);
  // A car left behind: a wheelset that, once the lead one was 200 LDU from where it started, was
  // less than 100 from where it did (measured then, as a lap brings each back to its start).
  if (stragglers > 0) why.push(`${stragglers} of the train's ${train.length} wheelsets stayed behind: a coupling didn't hold`);
  if (offTrack > OFF) why.push(`a wheelset came ${offTrack.toFixed(1)} LDU off the track`);
  if (apart > APART) why.push(`a coupling came ${apart.toFixed(1)} LDU apart`);
  if (Math.abs(rolled - radius) > ROLL_OFF * radius) why.push(`went ${rolled.toFixed(1)} LDU for each radian its wheel turned, not ${radius}`);
  const result = travelled < 1 ? 'no' : reached && why.length === 0 ? 'works' : 'partly';
  return { result, ...(why.length ? { why } : {}), travelled: Math.round(travelled), length: Math.round(length), offTrack: round(offTrack), apart: round(apart), rolled: round(rolled), radius };
}

// Whether a train, run by its first rolling wheelset's axle each way in turn, gets onto a line
// with its first wheelset (null if it has no wheel to turn).
function onto(mech: Mechanism, kin: ReturnType<typeof loadModel>['kin'], track: Track, line: number): boolean | null {
  const riders = mech.riders ?? [];
  const lead = riders.findIndex((r) => r.rolls);
  if (lead < 0) return null;
  const joint = mech.joints.findIndex((j) => j.kind === 'revolute' && (j.bodyA === riders[lead].body || j.bodyB === riders[lead].body));
  if (joint < 0) return null;
  const poses = (kin as unknown as { poses: import('three').Matrix4[] }).poses;
  const start = kin.snapshot();
  const lap = track.lines.reduce((sum, l) => sum + l.length, 0);
  for (const way of [1, -1]) {
    kin.restore(start);
    track.places.clear();
    for (let i = 0; i < lap / (22 * STEP); i++) {
      if (Math.abs(kin.turnJoint(joint, way * STEP)) < STEP - 1e-9) break;
      track.near(riders[lead].center.clone().applyMatrix4(poses[riders[lead].body]), poses[0], lead);
      if (track.placeOf(lead)!.line === line) return true;
    }
  }
  return false;
}

const round = (x: number) => Math.round(x * 10) / 10;

// Whether any of these places is near a buffer: the end of a line that meets no other.
function bufferNear(track: Track, places: { line: number; s: number }[], reach = AT_END): boolean {
  return places.some((p) => track.walk(p.line, p.s, -reach).short > 0 || track.walk(p.line, p.s, reach).short > 0);
}
