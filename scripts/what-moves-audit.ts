// The model beside the audit's rows for Erik (docs/audits/for-erik.md, Parts 2 and 3): for each row
// that names a set and a function, whether the model agrees with the function as listed, as far as
// the model can tell. A report for sorting the rows, never an answer: the booklet and Erik settle.
//
//   npm run what-moves-audit                 prints the table; --write also writes
//                                            data/what-moves/for-erik.md
//
// For each function: its control's motion as the viewer's drag would start it (what the drag
// doesn't need held, then jointMotion: the first instant, the model as built), and whether every part the function says moves does move,
// against what it names (" against p12 ...", else the frame), with every part it says stays
// still. The verdicts:
//   agrees        every part listed as moving moves, and every part listed as staying stays;
//   disagrees     a part listed as moving doesn't, or one listed as staying moves, or the control
//                 can't move at all;
//   cannot tell   the row names no function, the function is skipped or has no parts to judge,
//                 it needs a lever or catch set first (the model is read as built), or its control
//                 is loose (attached to nothing, it moves by chance).
// Directions (which way is up), which lever is which, and wording are beyond it: a row about
// those is "cannot tell" unless its parts can be judged.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Kinematics } from '../src/kinematics.ts';
import type { PlacedPart } from '../src/ldr.ts';
import { catchShifts, findCatches, findSliders, nearestPosition, sliderMovedTo, sliderPosition } from '../src/shift.ts';
import type { Mechanism } from '../src/mechanism.ts';
import { loadModel } from './load-model.ts';

const AUDIT = 'docs/audits/for-erik.md';
const OUT = 'data/what-moves/for-erik.md';
// How fast a body must move against its reference, as a share of the control's own speed, to count.
const MOVED = 1e-3;

interface Fn {
  control?: string | string[];
  moves?: string[];
  stays?: string[];
  first?: { control: string; by: number }[];
  skip?: string;
  model?: string;
}

// The rows of Parts 2 and 3: set, function numbers, the section, and the row's text.
function auditRows(text: string): { part: string; set: string; fns: number[]; text: string; named: string[] }[] {
  const rows: { part: string; set: string; fns: number[]; text: string; named: string[] }[] = [];
  let part = '';
  for (const line of text.split('\n')) {
    const heading = /^## (Part [23])/.exec(line);
    if (heading) part = heading[1];
    else if (/^## /.test(line)) part = '';
    if (!part || !line.startsWith('| ') || /^\| (Set|---)/.test(line)) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    const number = /^(\d+)/.exec(cells[0])?.[1];
    if (!number) continue;
    const set = [`${number}-1`, `${number}-2`].find((s) => existsSync(`data/sets/${s}.json`));
    if (!set) continue;
    const fns: number[] = [];
    for (const m of cells[1].matchAll(/(\d+)(?:\s*-\s*(\d+))?/g)) {
      const [a, b] = [Number(m[1]), Number(m[2] ?? m[1])];
      for (let n = a; n <= b && n - a < 30; n++) fns.push(n);
    }
    rows.push({ part, set, fns, text: cells.slice(2, 4).join(' / ').slice(0, 140), named: [...new Set(cells.slice(2, 5).join(' ').match(/\bp\d+\b/g) ?? [])] });
  }
  return rows;
}

type Verdict = 'agrees' | 'disagrees' | 'cannot tell';

// Each set's model, read once, and a function's verdict on it.
const models = new Map<string, ReturnType<typeof loadModel>>();
function judge(set: string, n: number): { verdict: Verdict; why: string } {
  const data = JSON.parse(readFileSync(`data/sets/${set}.json`, 'utf-8'));
  const fn: Fn | undefined = data.curated.functions?.[n - 1];
  if (!fn) return { verdict: 'cannot tell', why: `no function ${n} in the list` };
  if (fn.skip) return { verdict: 'cannot tell', why: 'skipped in the list' };
  const file = fn.model ?? data.curated.model;
  // Only the last model read is kept: the rows are judged set by set (see below).
  if (!models.has(file)) {
    models.clear();
    models.set(file, loadModel(file, file.startsWith('omr/')));
  }
  const loaded = models.get(file)!;
  if (fn.first?.length) {
    // Its lever, catch or ring set first, as the check sets it, then judged on the model as it then is.
    const set = setFirst(loaded, fn.first);
    if ('why' in set) return { verdict: 'cannot tell', why: set.why };
    const after = judgeOn(fn, set.parts, set.mech, set.kin);
    return { verdict: after.verdict, why: `${after.why}, after its first step` };
  }
  const first = judgeOn(fn, loaded.parts, loaded.mech, loaded.kin);
  if (first.verdict !== 'disagrees') return first;
  // As the check does, with the friction pins it needs let turn: judged again with every friction
  // pin free.
  const free = loaded.allFree(loaded.parts);
  const again = judgeOn(fn, loaded.parts, free, new Kinematics(free));
  return again.verdict === 'agrees' ? { verdict: 'agrees', why: `${again.why}, once its friction pins turn` } : first;
}

// A function's verdict on a model as read (see judge).
function judgeOn(fn: Fn, parts: { name: string }[], mech: Mechanism, kin: Kinematics): { verdict: Verdict; why: string } {
  const num = (ref: string) => Number(/^p(\d+)/.exec(ref)?.[1]);
  const controls = [fn.control ?? []].flat().map(num).filter((p) => !Number.isNaN(p) && p < parts.length);
  const moves = (fn.moves ?? []).map((m) => ({ part: num(m), against: num(/ against (p\d+)/.exec(m)?.[1] ?? '') }));
  const stays = (fn.stays ?? []).map((m) => ({ part: num(m), against: num(/ against (p\d+)/.exec(m)?.[1] ?? '') }));
  if (controls.length === 0) return { verdict: 'cannot tell', why: 'the list names no control' };
  if (moves.length + stays.length === 0) return { verdict: 'cannot tell', why: 'the list names no part that moves or stays' };
  if (controls.some((p) => mech.loose.includes(p))) return { verdict: 'cannot tell', why: 'its control is loose' };
  // Each control's motion; a part moves if any control moves it.
  const motions = controls.flatMap((p) => {
    let body = mech.bodyOf[p];
    if (mech.roles[p] === 'motor') {
      const j = mech.joints.find((x) => x.motor && (x.bodyA === body || x.bodyB === body));
      if (j) body = j.bodyA === body ? j.bodyB : j.bodyA;
    }
    const link = kin.parentLink(body);
    let motion: number[] | null = null;
    try {
      // As a drag starts: what it doesn't need held (a gearbox's other paths), then the motion.
      if (link) kin.holdWhatTheDragDoesntNeed(body, () => kin.jointMotion(link.joint) !== null, link.joint);
      motion = link ? kin.jointMotion(link.joint) : null;
      kin.letGoAfterDrag();
    } catch {
      motion = null;
    }
    return motion ? [{ motion, body }] : [];
  });
  if (motions.length === 0) return { verdict: 'disagrees', why: 'its control can\'t move' };
  const speed = (m: number[], b: number, ref: number) => Math.hypot(...[0, 1, 2, 3, 4, 5].map((k) => m[6 * b + k] - m[6 * ref + k]));
  const moved = (p: number, against: number) => {
    const ref = Number.isNaN(against) ? 0 : mech.bodyOf[against];
    return motions.some(({ motion, body }) => speed(motion, mech.bodyOf[p], ref) > MOVED * Math.max(speed(motion, body, 0), 1e-9));
  };
  const name = (p: number) => `p${p} ${parts[p]?.name.replace(/\.dat$/i, '').replace(/^.* - /, '')}`;
  const still = moves.filter((m) => !Number.isNaN(m.part) && !moved(m.part, m.against)).map((m) => name(m.part));
  const went = stays.filter((m) => !Number.isNaN(m.part) && moved(m.part, m.against)).map((m) => name(m.part));
  if (still.length || went.length) return { verdict: 'disagrees', why: [still.length ? `doesn't move ${still.join(', ')}` : '', went.length ? `moves ${went.join(', ')}, listed as staying` : ''].filter(Boolean).join('; ') };
  return { verdict: 'agrees', why: `its control moves the ${moves.length} part${moves.length === 1 ? '' : 's'} listed${stays.length ? ', and those listed as staying stay' : ''}` };
}

if (process.argv[1]?.endsWith('what-moves-audit.ts')) {
  const rows = auditRows(readFileSync(AUDIT, 'utf-8'));
  const out = ['# The model beside the audit\'s rows for Erik (Parts 2 and 3)', '', `Written by npm run what-moves-audit from ${AUDIT} and each set's model, the model as built (the first instant of each control's motion). "agrees": the parts the list says move do, and those it says stay do; "disagrees": not so; "cannot tell": the model can't judge the row (no function, a lever step first, a loose control, nothing to judge). It sorts the rows; it settles none.`, '', '| Part | Set | Fn | The row | Model | Why |', '| --- | --- | --- | --- | --- | --- |'];
  const counts: Record<string, number> = {};
  // Judged set by set, so each model is read once; written in the audit's order.
  const judged = new Map<string, { verdict: Verdict; why: string }>();
  for (const r of [...rows].sort((a, b) => a.set.localeCompare(b.set))) for (const n of r.fns) if (!judged.has(`${r.set} ${n}`)) judged.set(`${r.set} ${n}`, judge(r.set, n));
  for (const r of rows) {
    const verdicts = r.fns.length ? r.fns.map((n) => ({ n, ...judged.get(`${r.set} ${n}`)! })) : [{ n: 0, verdict: 'cannot tell' as Verdict, why: 'names no function' }];
    for (const v of verdicts) {
      // What a row the model can't judge for want of parts would need: the parts the audit's
      // text names, which the list lacks.
      if (/names no (control|part)/.test(v.why)) v.why += r.named.length ? `; to judge it, the list needs the part${r.named.length === 1 ? '' : 's'} the row names: ${r.named.join(', ')}` : '; neither the list nor the row names a part';
      counts[`${r.part}: ${v.verdict}`] = (counts[`${r.part}: ${v.verdict}`] ?? 0) + 1;
      out.push(`| ${r.part.replace('Part ', '')} | ${r.set} | ${v.n || '-'} | ${r.text.replace(/\|/g, '/')} | ${v.verdict} | ${v.why} |`);
    }
    console.error(`${r.set} ${r.fns.join(',')}: ${verdicts.map((v) => v.verdict).join(', ')}`);
  }
  out.splice(4, 0, Object.entries(counts).map(([k, n]) => `${k} ${n}`).join('; ') + '.', '');
  console.log(out.join('\n'));
  if (process.argv.includes('--write')) {
    mkdirSync('data/what-moves', { recursive: true });
    writeFileSync(OUT, out.join('\n') + '\n');
  }
}

// A function's first steps worked, as the check works them: a driving ring slid to the click-in
// position nearest `by` LDU on, else the control's joint turned `by` and the rings its catch moves
// shifted; the mechanism then read afresh from where everything is. Or why a step couldn't be.
function setFirst(loaded: ReturnType<typeof loadModel>, steps: { control: string; by: number }[]): { parts: PlacedPart[]; mech: Mechanism; kin: Kinematics } | { why: string } {
  let { parts, mech, kin } = loaded.read(loaded.parts);
  const { table, slides } = loaded;
  const placedNow = () => parts.map((p, i) => ({ ...p, matrix: kin.poses[mech.bodyOf[i]].clone().multiply(p.matrix) }));
  for (const step of steps) {
    const p = Number(/^p(\d+)/.exec(step.control)?.[1]);
    if (Number.isNaN(p) || p >= parts.length) return { why: `its first step names no part (${step.control})` };
    const sliders = findSliders(parts, mech, table, slides);
    const shiftTo = (shifts: Map<number, number>) => {
      const now = placedNow();
      for (const [ring, to] of shifts) {
        const slider = sliders.find((s) => s.part === ring)!;
        const by = sliderMovedTo(now, table, slider, to).multiply(now[ring].matrix.clone().invert());
        for (const i of slider.riders ?? [ring]) now[i] = { ...now[i], matrix: by.clone().multiply(now[i].matrix) };
      }
      ({ parts, mech, kin } = loaded.read(now));
    };
    const slider = sliders.find((s) => s.part === p);
    if (slider) {
      const from = sliderPosition(placedNow(), table, slider);
      const to = nearestPosition(slider, from + step.by);
      if (to === nearestPosition(slider, from)) return { why: `its first step (${step.control}) doesn't shift its ring` };
      shiftTo(new Map([[p, to]]));
      continue;
    }
    const link = kin.parentLink(mech.bodyOf[p]);
    if (!link) return { why: `its first step's part (${step.control}) can't move` };
    const went = kin.turnJoint(link.joint, step.by);
    if (Math.abs(went) < 0.9 * Math.abs(step.by)) return { why: `its first step (${step.control}) went ${went.toFixed(2)} of ${step.by}` };
    const shifts = catchShifts(placedNow(), table, findCatches(parts, sliders));
    if (shifts.size) shiftTo(shifts);
    else ({ parts, mech, kin } = loaded.read(placedNow()));
  }
  return { parts, mech, kin };
}
