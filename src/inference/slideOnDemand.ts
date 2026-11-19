// Slides asked for (decision 206 of 2026-11-18). A part, with all that is fixed to it, that is
// carried only by axles in round holes on lines that run one way may slide along them: the
// 42078's container door lock bars, lifted to free their doors, or the 42114's bumper axle, pulled
// out so its hood can tilt. Most such parts in a model are only play, a bush or two short of
// held, so a slide is read only for a part a function's `first` step, or the viewer's user,
// names; nowhere else, so no other reading changes.

import { Vector3 } from 'three';
import type { Connection } from '../mechanism.ts';
import { AXIS_TOLERANCE, type WorldCylinder } from './shared.ts';

// Parts that grip an axle by friction: a bush, a half bush, a rubber axle joiner. One that also
// holds something else (the frame's own axle, in the joiner's other hole) holds the asked part's
// axle by friction only, and doesn't tie it; one on the asked part's axle alone rides along.
const GRIPS = new Set(['45590.dat', '32123b.dat', '4265b.dat', '4265c.dat']);
const GRIP_ROLES = new Set(['bush', 'toothed bush']);

const PARALLEL = 0.035;

// For each part asked to slide, makes its slide if it can, before the bodies are found (two hinges
// on two lines would hold it fast, see groupIntoBodies): each connection by which its group is
// carried, an axle in a round hole, becomes a slide that turns, held where it is built (see
// Joint.springHeld), with the travel for which the axle stays in the hole. Its grips' ties are
// dropped. Returns the parts whose slide was made, and why each other one can't slide.
export function slidesAsked(names: string[], roles: string[], cyls: WorldCylinder[], connections: Connection[], asked: Set<number>): { slid: number[]; why: Map<number, string> } {
  const slid: number[] = [];
  const why = new Map<number, string>();
  if (!asked.size) return { slid, why };
  const byPart = new Map<number, WorldCylinder[]>();
  for (const c of cyls) (byPart.get(c.part) ?? byPart.set(c.part, []).get(c.part)!).push(c);
  const grip = (p: number) => GRIPS.has(names[p]) || GRIP_ROLES.has(roles[p]);
  const isShaft = (p: number) => (byPart.get(p) ?? []).some((c) => c.gender === 'M' && c.secs.some((s) => s.shape === 'A'));
  const lineOf = (c: Connection) => {
    const d = new Vector3().subVectors(c.to, c.from);
    return d.length() < 1e-6 ? null : d.normalize();
  };
  const onLine = (cyl: WorldCylinder, from: Vector3, d: Vector3) => {
    if (new Vector3().crossVectors(cyl.dir, d).length() > PARALLEL) return false;
    const off = new Vector3().subVectors(cyl.start, from);
    return off.addScaledVector(d, -off.dot(d)).length() <= AXIS_TOLERANCE;
  };
  // A part's cylinder of one gender on a connection's line.
  const cylOn = (part: number, gender: 'M' | 'F', c: Connection, d: Vector3) => (byPart.get(part) ?? []).find((cyl) => cyl.gender === gender && onLine(cyl, c.from, d));
  // Whether a turning connection's male slides in its hole: its sections there are all a smooth
  // shaft (axle-shaped, or round no wider than an axle: the middle of an axle with a stop), no pin's
  // ridge or collar, and it is an axle (it has an axle-shaped section somewhere).
  const slides = (c: Connection) => {
    if (c.kind !== 'revolute') return false;
    const d = lineOf(c);
    if (!d || !isShaft(c.male)) return false;
    const m = cylOn(c.male, 'M', c, d);
    if (!m) return false;
    const lo = Math.min(...[c.from, c.to].map((p) => new Vector3().subVectors(p, m.start).dot(m.dir))) + 0.5;
    const hi = Math.max(...[c.from, c.to].map((p) => new Vector3().subVectors(p, m.start).dot(m.dir))) - 0.5;
    let at = 0;
    let shaft = false;
    for (const sec of m.secs) {
      const [s, e] = [at, at + sec.length];
      at = e;
      if (e <= lo || s >= hi) continue;
      if (sec.shape === 'A' || (sec.shape === 'R' && sec.radius <= 6.5)) shaft = true;
      else return false;
    }
    return shaft;
  };

  for (const part of [...asked].sort((a, b) => a - b)) {
    // Its grips: ties from a shaft to a grip that also holds some other part.
    const holds = (g: number, not: number) => connections.some((k) => (k.kind === 'rigid' || k.kind === 'stud') && ((k.male === g && k.female !== not) || (k.female === g && k.male !== not)));
    const gripTie = (c: Connection) => (c.kind === 'rigid' || c.kind === 'stud') && ((isShaft(c.male) && grip(c.female) && holds(c.female, c.male)) || (isShaft(c.female) && grip(c.male) && holds(c.male, c.female)));
    // The part's group: what is fixed to it, but not through a grip; then what snaps onto that by
    // a pin on a line along the way it slides (the 42078's tan axle pin, its pin end snapped into
    // the lock bar's connector, goes with the bar), found once that way is known.
    const group = new Set([part]);
    const grow = (joins: (c: Connection) => boolean) => {
      let more = true;
      while (more) {
        more = false;
        for (const c of connections) {
          if (!joins(c) || group.has(c.male) === group.has(c.female)) continue;
          group.add(group.has(c.male) ? c.female : c.male);
          more = true;
        }
      }
    };
    const fixed = (c: Connection) => (c.kind === 'rigid' || c.kind === 'stud') && !gripTie(c);
    grow(fixed);
    const out = () => connections.filter((c) => group.has(c.male) !== group.has(c.female) && !gripTie(c));
    const first = out().find((c) => slides(c));
    if (!first) {
      why.set(part, 'not carried by an axle in a round hole');
      continue;
    }
    const d = lineOf(first)!;
    const parallel = (c: Connection) => {
      const e = lineOf(c);
      return e !== null && new Vector3().crossVectors(e, d).length() <= PARALLEL;
    };
    grow((c) => fixed(c) || (c.kind === 'revolute' && parallel(c) && !slides(c)));
    // Carried only so: every tie out of the group an axle sliding in a round hole along the way.
    const ties = out();
    const other = ties.find((c) => !(slides(c) && parallel(c)));
    if (other) {
      why.set(part, `held by p${other.male} ${names[other.male]} in p${other.female} ${names[other.female]} (${other.kind})`);
      continue;
    }
    for (const c of ties) {
      // Its travel: for as long as the axle stays in the hole (see slideRange).
      const u = lineOf(c)!;
      const m = cylOn(c.male, 'M', c, u)!;
      const f = cylOn(c.female, 'F', c, u);
      const span = (cyl: WorldCylinder | undefined, fallback: [number, number]): [number, number] => {
        if (!cyl) return fallback;
        const a = new Vector3().subVectors(cyl.start, c.from).dot(u);
        const b = a + Math.sign(cyl.dir.dot(u)) * cyl.secs.reduce((sum, s) => sum + s.length, 0);
        return [Math.min(a, b), Math.max(a, b)];
      };
      const along = c.to.clone().sub(c.from).length();
      c.kind = 'slide';
      c.turns = true;
      c.springHeld = true;
      c.asked = true;
      c.extents = { male: span(m, [0, along]), female: span(f, [0, along]), overlap: 0 };
    }
    // Its grips hold it by friction only: their ties are dropped, so the slide is held where it is
    // built as any is (springHeld), and not fast.
    for (let k = connections.length - 1; k >= 0; k--) {
      const c = connections[k];
      if (gripTie(c) && group.has(c.male) !== group.has(c.female)) connections.splice(k, 1);
    }
    slid.push(part);
  }
  return { slid, why };
}
