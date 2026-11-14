// What a model can do, worked out from the model alone: each thing a user could work (a knob or a
// crank, a part pushed, a part slid, a motor's output, a wheel rolled), and what working it moves.
// A report beside the curated function lists, never their answer key: it is written for any model,
// and the check never reads it.
//
//   npm run what-moves -- <set or model file> [more ...]   prints each one's table
//   npm run what-moves -- --write <set ...>                 also writes data/what-moves/<set>.json
//   npm run what-moves -- --write --all                     every set with a model
//
// Each candidate control's motion is the one the viewer's drag would start with (jointMotion:
// the least motion that works the control's joint), measured against the frame. Candidates that
// move the same bodies are one row (the gears of one train, an axle's two ends), named by the
// most telling of them: a motor's output, then a knob or crank, then a wheel, then the rest. A
// body that moves nothing but itself (a gear spinning free) is counted, not listed, unless it
// looks as if it should drive something (a gear, a worm): then it is a warning. A row whose
// control the set's curated list names as a function's control carries that function's number.
//
// What a first version leaves out: how far each control goes and what stops it (a drag each way,
// behind a switch later), every combination of gearbox settings (rows are as the model is built),
// pneumatic lines, strings, springs, and collisions.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadModel } from './load-model.ts';
import { signedGearRates } from './gear-rates.ts';

const SETS_DIR = 'data/sets';
const OUT_DIR = 'data/what-moves';
// How fast a body must move against the frame, as a share of the fastest, to count as moved.
const MOVED = 1e-4;
// How much of two rows' bodies they must share to be one row.
const SAME = 0.9;
// The order in which a row's controls name it.
const ORDER = ['motor', 'knob', 'wheel', 'slide', 'push', 'turn'] as const;
type Kind = (typeof ORDER)[number];
const GEARS = new Set(['gear', 'worm']);

interface Row {
  kind: Kind;
  control: string; // the part a user works, "p12 3648"
  alternatives: string[]; // other parts that work the same thing
  moves: string[]; // a part of each body it moves against the frame, the most telling
  parts: number; // how many parts move
  rates?: Record<string, number>; // geared bodies' turns for one turn of the control, by part
  functions?: number[]; // curated functions whose control is one of this row's
}

export interface WhatMoves {
  set: string;
  model: string;
  rows: Row[];
  freeSpinning: Record<string, number>; // controls that move only themselves, counted by kind
  warnings: string[]; // a gear or worm that drives nothing; a part that looks movable but can't
  loose: number; // how many parts are loose
}

export function whatMoves(set: string, model: string, functions: { control?: string | string[] }[] = []): WhatMoves {
  const { parts, mech, kin, table } = loadModel(model, model.startsWith('omr/'));
  const name = (p: number) => `p${p} ${parts[p].name.replace(/\.dat$/i, '').replace(/^.* - /, '')}`;
  const roles = mech.roles;
  // A wheel's part, by its data: a rim's or a tyre's half of a tyre's seat (not every tyre has the
  // role "tyre").
  const libraryName = (n: string) => (table.parts[n] ? n : (/ - ([^/]+)$/.exec(n)?.[1] ?? n));
  const wheel = (p: number) => roles[p] === 'tyre' || roles[p] === 'rim' || (table.parts[libraryName(parts[p].name)] ?? []).some((c) => c.secs.some((s) => s.shape === 'T'));
  // The most telling part of a body: a gear, a wheel, a beam, by the roles, else its first part.
  const telling = (body: number) => {
    const ps = mech.bodies[body].parts;
    return ps.find((p) => GEARS.has(roles[p])) ?? ps.find(wheel) ?? ps.find((p) => roles[p] === 'structure') ?? ps[0];
  };

  // The candidates: a body and the joint a user works it by, with its kind.
  const candidates: { body: number; joint: number; kind: Kind }[] = [];
  const seen = new Set<string>();
  const add = (body: number, joint: number, kind: Kind) => {
    const key = `${body} ${joint}`;
    if (body !== 0 && !seen.has(key)) {
      seen.add(key);
      candidates.push({ body, joint, kind });
    }
  };
  // A motor's output.
  mech.joints.forEach((j, i) => {
    if (j.motor) add(roles[mech.bodies[j.bodyA].parts[0]] === 'motor' ? j.bodyB : j.bodyA, i, 'motor');
  });
  // Each body on a joint of the solver's tree: turned like a knob, or pushed.
  for (let b = 1; b < mech.bodies.length; b++) {
    const link = kin.parentLink(b);
    if (!link) continue;
    const joint = mech.joints[link.joint];
    if (joint.kind === 'slide') add(b, link.joint, 'slide');
    else if (joint.kind === 'revolute') {
      add(b, link.joint, mech.bodies[b].parts.some(wheel) ? 'wheel' : kin.turnsLikeAKnob(b) ? 'knob' : 'push');
    }
  }
  // A slid part, from the reading's slide joints, not the tree (a slide closes a loop there).
  mech.joints.forEach((j, i) => {
    if (j.kind === 'slide') add(j.bodyB, i, 'slide');
  });

  // Each candidate's motion against the frame: the bodies it moves.
  const rows = new Map<string, { members: { body: number; kind: Kind }[]; moved: number[] }>();
  const freeSpinning: Record<string, number> = {};
  const warnings: string[] = [];
  for (const c of candidates) {
    let motion: number[] | null = null;
    try {
      motion = kin.jointMotion(c.joint);
    } catch {
      motion = null;
    }
    if (!motion) continue;
    const speed = (b: number) => Math.hypot(...[0, 1, 2, 3, 4, 5].map((k) => motion![6 * b + k] - motion![k]));
    const fastest = Math.max(...mech.bodies.map((_, b) => speed(b)));
    if (fastest === 0) continue;
    const moved = mech.bodies.map((_, b) => b).filter((b) => b !== 0 && speed(b) > MOVED * fastest);
    if (moved.length === 1 && moved[0] === c.body) {
      freeSpinning[c.kind] = (freeSpinning[c.kind] ?? 0) + 1;
      const gear = mech.bodies[c.body].parts.find((p) => GEARS.has(roles[p]));
      if (gear !== undefined) warnings.push(`${name(gear)} turns on its own, driving nothing`);
      continue;
    }
    const key = moved.join(' ');
    if (!rows.has(key)) rows.set(key, { members: [], moved });
    rows.get(key)!.members.push({ body: c.body, kind: c.kind });
  }

  // The curated functions' controls, by body.
  const fnOf = new Map<number, number[]>();
  functions.forEach((f, n) => {
    for (const c of [f.control ?? []].flat()) {
      const p = Number(/^p(\d+)/.exec(c)?.[1]);
      if (Number.isNaN(p) || p >= parts.length) continue;
      const b = mech.bodyOf[p];
      fnOf.set(b, [...(fnOf.get(b) ?? []), n + 1]);
    }
  });

  // Rows that move nearly the same bodies are one thing worked from different places (one
  // drivetrain, a few clutch gears more or less): merged, keeping the larger's bodies.
  const merged: { members: { body: number; kind: Kind }[]; moved: number[] }[] = [];
  for (const row of [...rows.values()].sort((a, b) => b.moved.length - a.moved.length)) {
    const like = merged.find((m) => {
      const shared = row.moved.filter((b) => m.moved.includes(b)).length;
      return shared >= SAME * Math.max(row.moved.length, m.moved.length);
    });
    if (like) like.members.push(...row.members);
    else merged.push({ members: [...row.members], moved: row.moved });
  }
  const out: Row[] = [];
  for (const { members, moved } of merged) {
    members.sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind) || a.body - b.body);
    const main = members[0];
    const rates = signedGearRates(mech, (b) => kin.parentLink(b), main.body);
    const rateRow: Record<string, number> = {};
    for (const [b, r] of rates) if (b !== main.body && moved.includes(b) && mech.bodies[b].parts.some((p) => GEARS.has(roles[p]) || wheel(p))) rateRow[name(telling(b))] = Math.round(r * 1000) / 1000;
    const fns = [...new Set(members.flatMap((m) => fnOf.get(m.body) ?? []))].sort((a, b) => a - b);
    out.push({
      kind: main.kind,
      control: name(telling(main.body)),
      alternatives: members.slice(1).map((m) => name(telling(m.body))),
      moves: moved.filter((b) => b !== main.body).map((b) => name(telling(b))),
      parts: moved.reduce((n, b) => n + mech.bodies[b].parts.length, 0),
      ...(Object.keys(rateRow).length ? { rates: rateRow } : {}),
      ...(fns.length ? { functions: fns } : {}),
    });
  }
  out.sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind) || b.parts - a.parts);
  return { set, model, rows: out, freeSpinning, warnings, loose: mech.loose.length };
}

// The readable table.
function table(w: WhatMoves): string {
  const lines = [`${w.set} (${w.model}): ${w.rows.length} things that move, ${w.loose} loose parts`];
  w.rows.forEach((r, i) => {
    lines.push(`${String(i + 1).padStart(3)}. ${r.kind.padEnd(6)} ${r.control}${r.alternatives.length ? ` (or ${r.alternatives.length} more)` : ''}${r.functions ? `  [fn ${r.functions.join(', ')}]` : ''}`);
    lines.push(`       moves ${r.parts} parts: ${r.moves.slice(0, 6).join(', ')}${r.moves.length > 6 ? `, and ${r.moves.length - 6} more bodies` : ''}`);
    if (r.rates) lines.push(`       rates: ${Object.entries(r.rates).slice(0, 6).map(([p, x]) => `${p} ${x}`).join(', ')}`);
  });
  const spin = Object.entries(w.freeSpinning).map(([k, n]) => `${n} ${k}`).join(', ');
  if (spin) lines.push(`     free-spinning, counted: ${spin}`);
  for (const x of w.warnings) lines.push(`     warning: ${x}`);
  return lines.join('\n');
}

if (process.argv[1]?.endsWith('what-moves.ts')) {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  let named = args.filter((a) => !a.startsWith('--'));
  if (args.includes('--all')) named = readdirSync(SETS_DIR).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));
  for (const n of named) {
    const setFile = join(SETS_DIR, `${n}.json`);
    const set = existsSync(setFile) ? JSON.parse(readFileSync(setFile, 'utf-8')) : null;
    const model = set?.curated.model ?? n;
    if (!model || !existsSync(model)) {
      console.log(`${n}: no model`);
      continue;
    }
    const w = whatMoves(set?.set ?? n.replace(/^.*[\\/]/, ''), model, set?.curated.functions ?? []);
    console.log(table(w));
    if (write && set) {
      mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(join(OUT_DIR, `${set.set}.json`), JSON.stringify(w, null, 2) + '\n');
    }
  }
}
