// What stops a drag, written to the error output with KINEBRICK_TRACE set, a line each, as `trace`
// and a JSON object: for working out why controls jam (see traceJam). Unset, nothing is written
// and nothing changes. With KINEBRICK_TRACE=parts, also which joint or gear mesh locks a control
// (see traceParts). The solver (kinematics.ts) and pushes (push.ts) call these where something
// stops.

import type { Mechanism } from './mechanism.ts';
import type { Kinematics, Slip } from './kinematics.ts';
import { combine, dot, EPSILON, gramOf, inBasis, nullSpace, orthonormalize, Row, solveSymmetric } from './linalg.ts';

export const TRACE = typeof process !== 'undefined' && !!process.env?.KINEBRICK_TRACE;
export function trace(what: object) {
  console.error(`trace ${JSON.stringify(what)}`);
}

// The solver's own workings that the trace looks into, which nothing else outside it uses: the
// trace sees the solver as this (see inside).
interface Inside {
  mech: Mechanism;
  bodyCount: number;
  drag: { held: Set<number>; heldToFrame: Set<number>; outOfReach: Set<number> };
  scrubNeeded: number | null;
  leastScrub: number;
  slipRows: number[][];
  traceNames: string[] | null;
  treeBasis(): number[][];
  buildEquations(gaps: number[] | null, slip: Slip | null, skipTree?: boolean, weights?: number[] | null, play?: number[] | null): Row[];
}
function inside(kin: Kinematics): Inside {
  return kin as unknown as Inside;
}

// With TRACE (see tracePushStuck in push.ts): `f`, with the drag's holds let go for the while.
export function withoutHolds<T>(kin: Kinematics, f: () => T): T {
  const k = inside(kin);
  const { held, heldToFrame, outOfReach } = k.drag;
  // What working out the free motions sets, as it was (see steeringBodies).
  const [scrubNeeded, leastScrub, slipRows] = [k.scrubNeeded, k.leastScrub, k.slipRows];
  k.drag.held = new Set();
  k.drag.heldToFrame = new Set();
  k.drag.outOfReach = new Set();
  try {
    return f();
  } finally {
    Object.assign(k.drag, { held, heldToFrame, outOfReach });
    [k.scrubNeeded, k.leastScrub, k.slipRows] = [scrubNeeded, leastScrub, slipRows];
  }
}

// With TRACE: how many bodies the drag holds.
export function heldCount(kin: Kinematics): number {
  const k = inside(kin);
  return k.drag.held.size + k.drag.heldToFrame.size;
}

// With TRACE: why no motion turns `joint` exactly (see playMotion). Of the rows but the loops',
// with tyres neither scrubbing nor lifting, whether any motion turns it, and if one does, how far
// the one that opens the loops least opens them, for each radian it turns the joint (`firm`);
// then the same with each kind of connection's rows left out in turn, and each kind of gear
// mesh's (`without`), which says what blocks it.
export function traceJam(kin: Kinematics, joint: number, rate: (z: number[]) => number) {
  const k = inside(kin);
  const basis = k.treeBasis();
  const q = basis[0].length;
  const look = () => {
    const slip: Slip = { sideways: [], travel: [], lift: [], rise: [] };
    const play: number[] = [];
    k.traceNames = [];
    const raw = k.buildEquations(null, slip, true, null, play);
    const rows = inBasis(raw, basis);
    const names = k.traceNames;
    k.traceNames = null;
    const loops = rows.flatMap((row, i) => (play[i] ? [row.map((x) => x * play[i])] : []));
    return { rows, play, names, loops, slid: inBasis([...slip.sideways, ...slip.lift], basis), raw, slips: [...slip.sideways, ...slip.lift] };
  };
  const judge = (firm: Row[], loops: Row[]) => {
    const motions = orthonormalize(nullSpace(firm, q));
    const rates = motions.map(rate);
    if (!(Math.max(0, ...rates.map(Math.abs)) > 1e-6)) return { turns: false };
    if (loops.length === 0) return { turns: true, opening: 0 };
    const cost = motions.map((m) => loops.map((row) => dot(row, m)));
    const gram = gramOf(cost, cost);
    const top = Math.max(1e-12, ...gram.map((row, i) => row[i]));
    gram.forEach((row, i) => (row[i] += 1e-12 * top));
    const mix = solveSymmetric(gram, rates, 1e-15 * top);
    const turns = mix.reduce((sum, a, k) => sum + a * rates[k], 0);
    if (!(Math.abs(turns) > EPSILON)) return { turns: false };
    const z = combine(motions, mix.map((a) => a / turns));
    return { turns: true, opening: Math.hypot(...loops.map((row) => dot(row, z))) / Math.abs(rate(z)) };
  };
  const firmOf = (seen: ReturnType<typeof look>, kind: string | null) => [...seen.rows.filter((_, i) => !seen.play[i] && seen.names[i] !== kind), ...(kind === 'tyres' ? [] : seen.slid)];
  const seen = look();
  const without: Record<string, object> = {};
  for (const kind of new Set(seen.names.filter((_, i) => !seen.play[i]))) without[kind] = judge(firmOf(seen, kind), seen.loops);
  // Each kind of gear mesh in turn: the model's meshes of that kind left out.
  const meshes = k.mech.meshes;
  for (const kind of new Set(meshes.map((m) => m.kind))) {
    k.mech.meshes = meshes.filter((m) => m.kind !== kind);
    try {
      const other = look();
      without[`gears:${kind}`] = judge(firmOf(other, null), other.loops);
    } finally {
      k.mech.meshes = meshes;
    }
  }
  trace({ event: 'jam', joint, loops: seen.loops.length, firm: judge(firmOf(seen, null), seen.loops), without });
  if (process.env.KINEBRICK_TRACE === 'parts') traceParts(k, seen, judge);
}

// With KINEBRICK_TRACE=parts, after traceJam: the rows in groups, one joint, gear mesh, tyre or
// other rule each (the rows of one kind of connection on the same bodies), and which group, left
// out alone, lets the control turn opening the loops no more than 1 LDU a radian. A loop's joint
// left out is let come apart. Where no one group does, the pair that does with the least opening,
// from the 12 groups that each do best alone.
function traceParts(
  k: Inside,
  seen: { rows: Row[]; play: number[]; names: string[]; slid: Row[]; raw: Row[]; slips: Row[] },
  judge: (firm: Row[], loops: Row[]) => { turns: boolean; opening?: number },
) {
  const bodiesOf = (row: Row) => {
    const out: number[] = [];
    for (let b = 0; b < k.bodyCount; b++) {
      for (let k = 0; k < 6; k++) {
        if (row[6 * b + k] !== 0) {
          out.push(b);
          break;
        }
      }
    }
    return out;
  };
  const keys = seen.raw.map((row, i) => `${seen.play[i] ? 'loop joint' : seen.names[i]}:${bodiesOf(row).join(',')}`);
  const slipKeys = seen.slips.map((row) => `slip:${bodiesOf(row).join(',')}`);
  const loopRows = seen.rows.flatMap((row, i) => (seen.play[i] ? [{ key: keys[i], row: row.map((x) => x * seen.play[i]) }] : []));
  const firmRows = [...seen.rows.flatMap((row, i) => (seen.play[i] ? [] : [{ key: keys[i], row }])), ...seen.slid.map((row, i) => ({ key: slipKeys[i], row }))];
  const groups = [...new Set([...firmRows, ...loopRows].map((r) => r.key))];
  const without = (out: Set<string>) =>
    judge(
      firmRows.filter((r) => !out.has(r.key)).map((r) => r.row),
      loopRows.filter((r) => !out.has(r.key)).map((r) => r.row),
    );
  const base = without(new Set());
  const score = (v: { turns: boolean; opening?: number }) => (v.turns ? (v.opening ?? 0) : Infinity);
  const singles = groups.map((key) => ({ key, v: without(new Set([key])) }));
  const frees = singles.filter((s) => score(s.v) <= 1);
  let pair: { keys: string[]; opening: number } | null = null;
  if (!frees.length) {
    const best = singles.filter((s) => score(s.v) < score(base) * (1 - 1e-6)).sort((a, b) => score(a.v) - score(b.v)).slice(0, 12);
    for (let i = 0; i < best.length; i++) {
      for (let j = i + 1; j < best.length; j++) {
        const v = without(new Set([best[i].key, best[j].key]));
        if (score(v) <= 1 && (!pair || score(v) < pair.opening)) pair = { keys: [best[i].key, best[j].key], opening: score(v) };
      }
    }
  }
  const describe = (key: string) => {
    const [kind, list] = key.split(':');
    const bodies = list ? list.split(',').map(Number) : [];
    return { key, kind, bodies, ...partsOf(k, kind, bodies) };
  };
  trace({
    event: 'parts',
    groups: groups.length,
    base: score(base),
    frees: frees.map((s) => ({ ...describe(s.key), opening: score(s.v) })),
    pair: pair && { opening: pair.opening, groups: pair.keys.map(describe) },
    best: pair || frees.length ? [] : singles.sort((a, b) => score(a.v) - score(b.v)).slice(0, 3).map((s) => ({ ...describe(s.key), opening: score(s.v) })),
  });
}

// With TRACE: the parts behind a group of rows (see traceParts), and their roles: a joint's
// connections, a mesh's gears, a tyre, else the parts of each body that aren't structure.
function partsOf(k: Inside, kind: string, bodies: number[]): { parts: [number, string][]; mesh?: string } {
  const m = k.mech;
  const on = (a: number, b: number) => bodies.length === 2 && ((bodies[0] === a && bodies[1] === b) || (bodies[0] === b && bodies[1] === a));
  const named = (parts: number[]) => ({ parts: [...new Set(parts.filter((p) => p !== undefined))].slice(0, 6).map((p) => [p, m.roles[p]] as [number, string]) });
  if (kind === 'gears') {
    const mesh = m.meshes.find((x) => on(m.gears[x.gearA].body, m.gears[x.gearB].body));
    if (mesh) return { ...named([m.gears[mesh.gearA].part, m.gears[mesh.gearB].part]), mesh: mesh.kind };
  }
  if (kind === 'tyres' || kind === 'slip') {
    const treads = m.treads.filter((t) => bodies.includes(t.body));
    if (treads.length) return named(treads.map((t) => t.part));
  }
  if (kind === 'loops') {
    const loop = m.loops.find((l) => l.wheels.some((w) => bodies.includes(w.body)));
    if (loop) return named([loop.links[0], ...m.gears.filter((g) => loop.wheels.some((w) => w.body === g.body) && bodies.includes(g.body)).map((g) => g.part)]);
  }
  const connections = m.connections.filter((c) => c.kind !== 'rigid' && on(m.bodyOf[c.male], m.bodyOf[c.female]));
  if (connections.length) return named(connections.flatMap((c) => [c.male, c.female]));
  return named(bodies.flatMap((b) => (b === 0 ? [] : m.bodies[b].parts.filter((p) => m.roles[p] !== 'structure').slice(0, 2))));
}
