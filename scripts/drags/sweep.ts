// The viewer sweep (decision 236 of 2026-11-19): every function the check marks works, tried in the
// viewer, so that "works" is something the viewer is seen to show, not only the check's word (Erik
// opened the 9397 and found its steering dead under his hand and seconds a frame). For each such
// function, with its list's first steps done first:
//   A, the turn: each control turned with the viewer's own turnPart (as a drag turns it, holding what
//      that doesn't need, stopping where parts meet once the collision pass is ready), as far as the
//      check's record turned it, each way; a motor run instead, by the viewer's own motor, until its
//      output has turned that far or a minute has gone. Recorded: how far it went, the collision
//      stops, each listed part's move against what the list measures it against, the parts listed to
//      stay, and the time per solver step (the turn's time over its steps of MAX_STEP).
//   B, the hand: the pointer aimed at the control (reach, aim), pressed (with Shift first where the
//      check freed pins) and pushed four ways, as 42082-fn9.ts does; a motor Ctrl-clicked and left
//      running, as 8110-crane.ts does. Recorded: whether the control could be seen and taken, and
//      which listed parts then moved.
// The verdict per function: shown (A moves every listed part, in some way of some control, and none
// listed to stay; and B moves a listed part), else not shown, with which of A or B failed and how.
// No threshold for slow: the ms per step is reported beside it.
// A collision stop is then judged (decision 252, see judge()): where the real part turns without
// end (a wheel that rolls, a track, an engine, a rotor), a stop makes the function not shown, however
// far its parts moved first; where it has an end and a travel of 0.2 rad or less each way, the
// booklet's picture decides, by hand, in data/viewer/judged.json, and until then it is "not decided".
// A model the viewer can't open is recorded "does not open", and the sweep goes on.
//
// One record per set in data/viewer/<set>.json, with the commit and the date; a set already swept
// at this commit is skipped unless --force. Each set runs in a process of its own, through the
// machine's pool (scripts/check-pool.ts), at most 3 at a time (--jobs), on the viewer whose address
// is given (your own server, not 5174's).
//   npx tsx scripts/drags/sweep.ts http://localhost:5208 [set …] [--then-all] [--force] [--jobs 3]
//   npx tsx scripts/drags/sweep.ts http://localhost:5208 --one 9397-1      (one set, in this process)
//   npx tsx scripts/drags/sweep.ts --judge      (the records judged again, with no browser)
//   npx tsx scripts/drags/sweep.ts --table      (data/viewer/table.csv from the records: every
//      function swept, slowest one call first; decision 258)
//   … --a      part A alone (decision 257: every working function timed first). The model is opened
//      once for the set, and the viewer's state set back (kin.restore) before each function; a
//      function after which a restore can't be trusted (the mechanism rebuilt by a shift, a new
//      Kinematics, the tyres' scrub raised) has the model opened afresh for the next, and its
//      record says why ("reopened"). Its records say part "A".
//   … --quiet  the quiet pass (decision 261): every function whose msOneCall is QUIET_OVER ms or more
//      timed again alone, one set at a time, each set's browser holding the whole pool (16,000 MB),
//      part A's way. It adds msOneCallQuiet, msPerStepQuiet, loadQuiet (the load average as the
//      set's timing starts) and commitQuiet to the function's line in the set's record, and changes
//      nothing else there.
//   … --shift  where the check freed friction pins for a function (its record's `freed`), part A
//      presses Shift on the control first, as a user does (the viewer's pinsToShift and freePins),
//      then turns it; what it freed is in the record (decision 267's sorting).
//   … --listed  the list's settings as a user makes them (decision 267's sorting): the model opened
//      lifted where the list says `lifted` (the viewer's "Lift off the ground", ?lifted=1), the parts
//      it says are `held` frozen after the first steps (as Alt-click freezes them), and each of A's
//      turns ended as a drag ends (setup.onDragEnded), so that a catch the turn took past its shift
//      angle shifts its ring, as the check counts it; where that works the mechanism out afresh, the
//      model is opened afresh for the next way.
//   KB_SWEEP_ONLY=<file.json>  only these functions: a list of "<set> <function>"; KB_SWEEP_OUT=<dir>
//      writes the records there, not in data/viewer (a sorting run beside part A's records).
// Each set's browser claims 1,000 MB and 0.85 MB a part from the pool (decision 255), as open-all.ts.
import { execSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { loadavg } from 'node:os';
import { chromium } from 'playwright';
import { partCounts } from '../check-pool.ts';
import { LAUNCH, LIBRARY, open, type Viewer } from './drag.ts';
import { foundOf } from '../holds.ts';
import { ENDLESS_WORDS, endlessKinds, endlessPart } from '../endless.ts';

const MOVED = 1; // LDU or degrees, as the check's MOVED
const MAX_STEP = 0.035; // radians: the solver's largest turn step (MAX_TURN_STEP in kinematics.ts)
const MOTOR_MOST_MS = 60_000;
const PUSHES: [number, number][] = [[120, 0], [-120, 0], [0, 120], [0, -120]];
// How a collision stop is judged (decision 252 of 2026-11-20). A stop is right where the real part
// has an end (a door against its frame, steering at its lock), and wrong where it turns without
// end. The kinds that turn without end are a first sieve (a function with one of them and no kind
// with an end); the words of the function's text that say so are recorded beside them.
const SHORT = 0.2; // radians each way: a travel this short is compared with the booklet's picture
// Judgements made by hand where the sweep can't tell (a short travel against the booklet's
// picture): data/viewer/judged.json, {"<set> <function>": {stop, why, page}}, stop "shown",
// "not shown" or "not decided".
const judged: Record<string, { stop: string; why: string; page?: string }> = existsSync('data/viewer/judged.json') ? JSON.parse(readFileSync('data/viewer/judged.json', 'utf-8')) : {};

type Ref = { ref: string; part: number; against: number };
const refOf = (ref: string): Ref => {
  const m = /^p(\d+) .*?(?: against p(\d+) .*)?$/.exec(ref);
  if (!m) throw new Error(`can't read the reference "${ref}"`);
  return { ref, part: Number(m[1]), against: m[2] === undefined ? -1 : Number(m[2]) };
};

const args = process.argv.slice(2);
const base = args[0];
const force = args.includes('--force');
const aOnly = args.includes('--a');
const shiftFirst = args.includes('--shift');
const listed = args.includes('--listed');
const part = (aOnly ? 'A' : 'A and B') + (shiftFirst ? ', Shift where the check freed pins' : '') + (listed ? ', the list\'s lifted and held, each turn ended as a drag' : '');
const only: Set<string> | null = process.env.KB_SWEEP_ONLY ? new Set(JSON.parse(readFileSync(process.env.KB_SWEEP_ONLY, 'utf-8'))) : null;
const outDir = process.env.KB_SWEEP_OUT || 'data/viewer';
const browserMb = (parts: number | undefined) => (parts ? Math.round(1000 + 0.85 * parts) : 3000);
// The commit a run records, set once by the run that starts the sets (so the records can be
// committed while it goes on).
const commit = process.env.KB_SWEEP_COMMIT || execSync('git rev-parse --short HEAD').toString().trim();
process.env.KB_SWEEP_COMMIT = commit;
const setFile = (set: string) => `data/sets/${set}.json`;
const outFile = (set: string) => `${outDir}/${set}.json`;
// A held function (data/holds.json) is swept by what the check found (decision 279): a sweep that
// shows it is what may lift its hold.
const worksIn = (set: string) => (JSON.parse(readFileSync(setFile(set), 'utf-8')).generated?.functions ?? []).filter((g: { result?: string } | null) => foundOf(g)?.result === 'works').length;

const oneAt = args.indexOf('--one');
const quiet = args.includes('--quiet');
const QUIET_OVER = 250;
// The functions a set's quiet pass times: those whose msOneCall is QUIET_OVER or more.
const quietFunctions = (set: string): number[] => (existsSync(outFile(set)) ? (JSON.parse(readFileSync(outFile(set), 'utf-8')).functions as any[]).filter((f) => f.msOneCall != null && f.msOneCall >= QUIET_OVER).map((f) => f.function) : []);
if (args[0] === '--judge') {
  // The records judged again (after a change to judge() or to judged.json), with no browser.
  for (const f of readdirSync('data/viewer').filter((f) => /^\d.*\.json$/.test(f))) {
    const rec = JSON.parse(readFileSync(`data/viewer/${f}`, 'utf-8'));
    const fns = JSON.parse(readFileSync(setFile(rec.set), 'utf-8')).curated.functions;
    rec.functions = rec.functions.map((line: any) => {
      if (!line.A) return line;
      const { stopsJudged, stopVerdict, byHand, moved, ...rest } = line;
      const base = moved ? { ...rest, verdict: moved.verdict, why: moved.why } : rest;
      if (!base.why) delete base.why;
      return judge(`${rec.set} ${line.function}`, fns[line.function - 1], base);
    });
    writeFileSync(`data/viewer/${f}`, JSON.stringify(rec, null, 2) + '\n');
  }
} else if (args[0] === '--table') {
  // Every function swept, with its control's time for one call of one step (the slowest of its
  // controls and ways) and for a step of the long turn, slowest one call first.
  const counts = partCounts();
  const rows: (string | number | null)[][] = [];
  for (const f of readdirSync('data/viewer').filter((f) => /^\d.*\.json$/.test(f))) {
    const rec = JSON.parse(readFileSync(`data/viewer/${f}`, 'utf-8'));
    for (const line of rec.functions) {
      const slowest = (line.A ?? []).filter((a: any) => a.msOneCall != null).sort((a: any, b: any) => b.msOneCall - a.msOneCall)[0];
      const stop = line.stop ? `${line.stop.control} way ${line.stop.way > 0 ? '+' : '-'}: went ${line.stop.went} of ${line.stop.asked}, ${line.stop.by.join(' ')}` : '';
      rows.push([rec.set, line.function, slowest?.control ?? [...new Set((line.A ?? []).map((a: any) => a.control))].join(' / '), rec.parts ?? counts.get(rec.set) ?? null, line.msOneCall ?? null, line.msPerStep ?? null, line.verdict, line.why ?? '', stop, rec.part ?? 'A and B', rec.commit, rec.load ?? null, line.msOneCallQuiet ?? null, line.msPerStepQuiet ?? null, line.loadQuiet ?? null, line.commitQuiet ?? null]);
    }
  }
  rows.sort((a, b) => Number(b[4] ?? -1) - Number(a[4] ?? -1) || Number(b[5] ?? -1) - Number(a[5] ?? -1));
  const cell = (x: string | number | null) => (x === null ? '' : /[",\n]/.test(String(x)) ? `"${String(x).replace(/"/g, '""')}"` : String(x));
  const head = ['set', 'function', 'control', 'parts', 'msOneCall', 'msPerStep', 'verdict', 'why', 'collision stop', 'part', 'commit', 'load', 'msOneCallQuiet', 'msPerStepQuiet', 'loadQuiet', 'commitQuiet'];
  writeFileSync('data/viewer/table.csv', [head, ...rows].map((r) => r.map(cell).join(',')).join('\n') + '\n');
  console.log(`${rows.length} functions in data/viewer/table.csv`);
} else if (oneAt >= 0) {
  await sweepSet(args[oneAt + 1]);
} else if (quiet) {
  // One set at a time, slowest first, each holding the whole pool.
  const named = args.slice(1).filter((a) => !a.startsWith('--'));
  const sets = (named.length ? named : readdirSync('data/viewer').filter((f) => /^\d.*\.json$/.test(f)).map((f) => f.replace(/\.json$/, '')))
    .filter((s) => quietFunctions(s).length && (force || (JSON.parse(readFileSync(outFile(s), 'utf-8')).functions as any[]).some((f) => quietFunctions(s).includes(f.function) && f.commitQuiet !== commit)));
  const slowest = (s: string) => Math.max(...(JSON.parse(readFileSync(outFile(s), 'utf-8')).functions as any[]).map((f) => f.msOneCall ?? 0));
  sets.sort((a, b) => slowest(b) - slowest(a));
  console.log(`${sets.length} sets, ${sets.reduce((n, s) => n + quietFunctions(s).length, 0)} functions, for the quiet pass`);
  for (const set of sets) {
    const started = Date.now();
    const code = await new Promise<number>((done) => {
      const child = spawn('npx', ['tsx', 'scripts/check-pool.ts', 'run', '--mb', '16000', '--what', `quiet pass ${set}`, '--', 'npx', 'tsx', 'scripts/drags/sweep.ts', base, '--one', set, '--a', '--quiet'], { stdio: ['ignore', 'inherit', 'inherit'] });
      child.on('close', (c) => done(c ?? 1));
    });
    console.log(`${set}: ${code === 0 ? 'done' : `failed (${code})`} in ${Math.round((Date.now() - started) / 1000)} s`);
  }
} else {
  const named = args.slice(1).filter((a, i, all) => !a.startsWith('--') && all[i - 1] !== '--jobs');
  const jobsAt = args.indexOf('--jobs');
  const jobs = Math.min(3, jobsAt >= 0 ? Number(args[jobsAt + 1]) : 3);
  const all = readdirSync('data/sets').filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));
  // The sets where every checked function works go first (decision 236), then the rest.
  const allWork = (set: string) => {
    const g = (JSON.parse(readFileSync(setFile(set), 'utf-8')).generated?.functions ?? []).filter((x: { result?: string } | null) => x && x.result !== 'skipped' && x.result !== 'not checked');
    return g.length > 0 && g.every((x: { result: string }) => x.result === 'works');
  };
  const counts = partCounts();
  // Sets named go in the order named; else those where every checked function works first, then
  // the rest, each smallest first.
  // --then-all: the sets named first, in that order, then every other, as with none named.
  const thenAll = args.includes('--then-all');
  const sets = (named.length ? [...named.filter((s) => all.includes(s)), ...(thenAll ? all.filter((s) => !named.includes(s)).sort((a, b) => Number(allWork(b)) - Number(allWork(a)) || (counts.get(a) ?? 1e9) - (counts.get(b) ?? 1e9) || a.localeCompare(b)) : [])] : all.sort((a, b) => Number(allWork(b)) - Number(allWork(a)) || (counts.get(a) ?? 1e9) - (counts.get(b) ?? 1e9) || a.localeCompare(b)))
    .filter((s) => worksIn(s) > 0)
    .filter((s) => !only || [...only].some((o) => o.startsWith(`${s} `)))
    .filter((s) => {
      if (force || !existsSync(outFile(s))) return true;
      const rec = JSON.parse(readFileSync(outFile(s), 'utf-8'));
      return rec.commit !== commit || (rec.part ?? 'A and B') !== part;
    });
  console.log(`${sets.length} sets to sweep, ${jobs} at a time`);
  const queue = [...sets];
  await Promise.all(Array.from({ length: jobs }, async () => {
    for (let set = queue.shift(); set; set = queue.shift()) {
      const started = Date.now();
      const code = await new Promise<number>((done) => {
        const child = spawn('npx', ['tsx', 'scripts/check-pool.ts', 'run', '--mb', String(browserMb(counts.get(set))), '--what', `sweep ${set}`, '--', 'npx', 'tsx', 'scripts/drags/sweep.ts', base, '--one', set, ...(aOnly ? ['--a'] : []), ...(shiftFirst ? ['--shift'] : []), ...(listed ? ['--listed'] : [])], { stdio: ['ignore', 'inherit', 'inherit'] });
        child.on('close', (c) => done(c ?? 1));
      });
      console.log(`${set}: ${code === 0 ? 'done' : `failed (${code})`} in ${Math.round((Date.now() - started) / 1000)} s`);
    }
  }));
}

async function sweepSet(set: string) {
  const data = JSON.parse(readFileSync(setFile(set), 'utf-8'));
  const model: string = data.curated.model;
  // `load`: the machine's load average when the set's timing starts (decision 261): the times
  // hold as ratios on a loaded machine, not as times.
  const out: { set: string; commit: string; date: string; load: number; part: string; parts: number | null; seconds: number; functions: unknown[] } = { set, commit, date: new Date().toISOString(), load: Math.round(loadavg()[0] * 10) / 10, part, parts: partCounts().get(set) ?? null, seconds: 0, functions: [] };
  // Part A alone: one viewer per model file, kept open between functions (see --a).
  const viewers = new Map<string, Viewer>();
  // Keyed by the file and its settings (a lifted model is opened lifted).
  const viewerFor = async (file: string, settings = '') => {
    const key = `${file}?${settings}`;
    let v = viewers.get(key);
    // A viewer whose mechanism was worked out afresh (a ring shifted at a drag's end) can't be set
    // back: it is opened afresh.
    if (v && (await v.page.evaluate(() => { const k = (window as any).kinebrick; const home = (window as any).sweepHome; return k.mech !== home.mech || k.kin !== home.kin; }).catch(() => true))) {
      await v.close().catch(() => {});
      viewers.delete(key);
      v = undefined;
    }
    if (!v) {
      v = await open(file, settings);
      await collisionsReady(v);
      await v.page.evaluate(() => {
        const k = (window as any).kinebrick;
        (window as any).sweepHome = { snap: k.kin.snapshot(), mech: k.mech, kin: k.kin, scrub: k.kin.scrub };
      });
      viewers.set(key, v);
    } else {
      await v.page.evaluate(() => {
        const k = (window as any).kinebrick;
        k.kin.restore((window as any).sweepHome.snap);
        k.kin.frozen = new Set(); // what a function before froze (see hold)
      });
      await v.stops();
    }
    return v;
  };
  // Why the viewer's state can't be set back after a function, or null.
  const untrusted = async (file: string, settings = ''): Promise<string | null> => {
    const key = `${file}?${settings}`;
    const v = viewers.get(key);
    if (!v) return null;
    const why = await v.page.evaluate(() => {
      const k = (window as any).kinebrick;
      const home = (window as any).sweepHome;
      if (k.mech !== home.mech) return 'the mechanism was rebuilt (a ring shifted)';
      if (k.kin !== home.kin) return 'the kinematics was made anew';
      if (k.kin.scrub !== home.scrub) return `the tyres' scrub was raised (${home.scrub} to ${k.kin.scrub})`;
      return null;
    }).catch((e) => `the page failed: ${String(e).slice(0, 100)}`);
    if (why) {
      await v.close();
      viewers.delete(key);
    }
    return why;
  };
  const started = Date.now();
  // A model that the viewer can't open: every working function recorded so, and the sweep goes on.
  // (Asked only once a function's sweep fails, since a load costs as much as a function.)
  const fails = new Map<string, string | null>();
  const onlyQuiet = quiet ? new Set(quietFunctions(set)) : null;
  for (const [i, fn] of (data.curated.functions as any[]).entries()) {
    const stored = data.generated.functions[i];
    const g = foundOf(stored);
    if (g?.result !== 'works') continue;
    if (onlyQuiet && !onlyQuiet.has(i + 1)) continue;
    if (only && !only.has(`${set} ${i + 1}`)) continue;
    const fnStarted = Date.now();
    let line: Record<string, any>;
    const file: string = fn.model ?? model;
    try {
      if (fails.get(file)) throw new Error('known');
      line = judge(`${set} ${i + 1}`, fn, await sweepFunction(file, fn, g, aOnly ? (f) => viewerFor(f, listed && fn.lifted ? 'lifted=1' : '') : null));
      if (aOnly) {
        const why = await untrusted(file, listed && fn.lifted ? 'lifted=1' : '');
        if (why) line.reopened = why;
      }
    } catch (e) {
      for (const [key, viewer] of [...viewers].filter(([key]) => key.startsWith(`${file}?`))) {
        await viewer.close().catch(() => {});
        viewers.delete(key);
      }
      if (!fails.has(file)) fails.set(file, await opens(file));
      const fail = fails.get(file);
      line = fail ? { verdict: 'does not open', why: fail } : { verdict: 'not shown', why: `the sweep failed: ${String(e).slice(0, 200)}` };
    }
    const record: Record<string, any> = { function: i + 1, does: fn.does, ...(stored?.hold ? { held: { result: stored.result, reason: stored.hold.reason } } : {}), ...line, seconds: Math.round((Date.now() - fnStarted) / 1000) };
    out.functions.push(record);
    console.log(`${set} fn${i + 1}: ${record.verdict}${record.why ? ` (${record.why})` : ''}; ${(line.msOneCall as number | undefined) ?? '-'} ms one call, ${(line.msPerStep as number | undefined) ?? '-'} ms a step${line.time ? `; s: ${Object.entries(line.time as Record<string, number>).map(([k, n]) => `${k} ${n}`).join(', ')}` : ''}`);
  }
  for (const v of viewers.values()) await v.close();
  if (quiet) {
    // The quiet times beside part A's, in the record as it is.
    const rec = JSON.parse(readFileSync(outFile(set), 'utf-8'));
    for (const q of out.functions as any[]) {
      const f = rec.functions.find((x: any) => x.function === q.function);
      if (f) Object.assign(f, { msOneCallQuiet: q.msOneCall ?? null, msPerStepQuiet: q.msPerStep ?? null, loadQuiet: out.load, commitQuiet: commit, ...(q.verdict !== f.verdict ? { verdictQuiet: q.verdict } : {}) });
    }
    writeFileSync(outFile(set), JSON.stringify(rec, null, 2) + '\n');
    return;
  }
  out.seconds = Math.round((Date.now() - started) / 1000);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(outFile(set), JSON.stringify(out, null, 2) + '\n');
}

// One function, A and B. `fn` is the list's entry, `g` the check's record of it.
// With `viewerFor`, part A alone, on a viewer kept open for the set (see --a).
async function sweepFunction(file: string, fn: any, g: any, viewerFor: ((file: string) => Promise<Viewer>) | null = null): Promise<Record<string, any>> {
  const controls: string[] = [fn.control].flat();
  const moves = (fn.moves ?? []).map(refOf);
  const stays = (fn.stays ?? []).map(refOf);
  const limits: string[] = [];
  // Where the function's time goes, in seconds: opening the model, the wait for the collision test,
  // the list's first steps, the camera's reach, A's turns and B's presses and pushes.
  const time: Record<string, number> = { open: 0, collisions: 0, first: 0, reach: 0, A: 0, B: 0 };
  const timed = async <T>(key: string, job: Promise<T>): Promise<T> => {
    const t0 = Date.now();
    try { return await job; } finally { time[key] += (Date.now() - t0) / 1000; }
  };

  // A, the turn.
  const A: unknown[] = [];
  const movedByA = new Set<string>();
  const staysMovedByA = new Set<string>();
  const stopsA = new Set<string>();
  const msA: number[] = [];
  const oneCalls: number[] = [];
  const settings = listed && fn.lifted ? 'lifted=1' : '';
  // The model opened, the list's first steps done, and (--listed) what it says is held frozen.
  const prepare = async (ref: string, noteLimits: boolean) => {
    const v = viewerFor ? await timed('open', viewerFor(file)) : await timed('open', open(file, settings));
    if (!viewerFor) await timed('collisions', collisionsReady(v));
    const notDone = await timed('first', firstSteps(v, fn.first ?? []));
    if (noteLimits) limits.push(...notDone);
    if (listed) await hold(v, Array.isArray(fn.held) ? fn.held : (fn.held?.[ref] ?? []));
    return v;
  };
  {
    let v = await prepare(controls[0], true);
    const tA = Date.now();
    for (const [ci, ref] of controls.entries()) {
      const control = refOf(ref).part;
      if (ci > 0 && listed && fn.held && !Array.isArray(fn.held)) {
        if (!viewerFor) await v.close();
        v = await prepare(ref, false);
      }
      // As a user does where the check freed pins: Shift pressed on the control.
      // The camera turned till the control is in view, the pointer on it, and Shift pressed and let
      // go (no drag): what the viewer said, and the pins freed.
      let shifted: { seen: boolean; said?: string[]; freed?: number[] } | null = null;
      if (shiftFirst && g.freed && !(await turnsPlain(v, control))) {
        const seen = (await v.reach(control)) >= 0 && (await v.aim(control));
        shifted = seen ? { seen, ...(await v.press({ shift: true, release: true })) } : { seen };
      }
      for (const [wi, way] of [1, -1].entries()) {
        // As far as the check turned it, but a part that turns without end (endlessPart) the full
        // turn each way, whatever the check's record turned (ordered after decision 284): where the check stopped
        // at a collision, asking only that far never shows whether the viewer stops there too.
        // (At least the full turn: never less than the check turned it, as a slow gearing needs
        // more, the 856's handwheel 8.3 rad.)
        const checkTurned = Math.abs(g.turned?.[ci]?.[wi] ?? 1.5) || 1.5;
        const asked = endlessPart(ref.split(' ').slice(1).join(' ')) ? Math.max(1.5, checkTurned) : checkTurned;
        const r = (await v.page.evaluate(
          ({ control, asked, way, step, parts, dragEnd }) => {
            const k = (window as any).kinebrick;
            const snap = k.kin.snapshot();
            const mechBefore = k.mech;
            const frame = k.mech.bodyOf.indexOf(0);
            const before = k.matrices().map((m: any) => m.clone());
            let went = 0;
            let how = 'turned';
            // One call of one step from the start pose, as a drag makes them (decision 258): what
            // the user waits for each time the pointer moves.
            let oneCall: number | null = null;
            if (k.mech.roles[control] !== 'motor') {
              const t1 = performance.now();
              k.interaction.turnPart(control, way * step, k.setup.camera.position);
              oneCall = performance.now() - t1;
              k.kin.restore(snap);
            }
            // Each part's motion added up over the turn, piece by piece (decision 291): sampled at
            // each of the solver's steps, which ask the collision test (blockedBy) whether they may
            // stand, as the check's turnMeasuring adds them up. Measured from start to end alone, a
            // part that turns nearly a whole turn read as hardly moved (the 42075's crankshaft at
            // rate 3.89 turns 5.83 rad for 1.5 in, and read 25.8 degrees).
            const relOf = (now: any[], [a, b]: number[]) => now[b >= 0 ? b : frame].clone().invert().multiply(now[a]);
            const summed = parts.map(() => [0, 0]);
            let was = parts.map((p: number[]) => relOf(before, p));
            const sample = () => {
              const now = k.matrices();
              parts.forEach((p: number[], i: number) => {
                const is = relOf(now, p);
                const e = was[i].clone().invert().multiply(is).elements;
                summed[i][0] += Math.hypot(is.elements[12] - was[i].elements[12], is.elements[13] - was[i].elements[13], is.elements[14] - was[i].elements[14]);
                summed[i][1] += (Math.acos(Math.max(-1, Math.min(1, (e[0] + e[5] + e[10] - 1) / 2))) * 180) / Math.PI;
                was[i] = is;
              });
            };
            const blockedBy = k.setup.blockedBy;
            k.setup.blockedBy = () => {
              const hit = blockedBy();
              if (!hit) sample();
              return hit;
            };
            const t0 = performance.now();
            if (k.mech.roles[control] === 'motor') how = 'motor';
            else {
              try {
                went = k.interaction.turnPart(control, way * asked, k.setup.camera.position);
              } finally {
                k.setup.blockedBy = blockedBy;
              }
            }
            k.setup.blockedBy = blockedBy;
            sample();
            const ms = performance.now() - t0;
            // The drag let go: a catch past its shift angle shifts its ring (see shiftDue).
            let shiftedRing = false;
            if (dragEnd && k.setup.shiftDue?.()) {
              k.setup.onDragEnded();
              shiftedRing = true;
            }
            const now = k.matrices();
            const moveOf = ([a, b]: number[]) => {
              const ref = b >= 0 ? b : frame;
              const x = before[ref].clone().invert().multiply(before[a]);
              const y = now[ref].clone().invert().multiply(now[a]);
              const e = x.clone().invert().multiply(y).elements;
              const ldu = Math.hypot(y.elements[12] - x.elements[12], y.elements[13] - x.elements[13], y.elements[14] - x.elements[14]);
              const deg = (Math.acos(Math.max(-1, Math.min(1, (e[0] + e[5] + e[10] - 1) / 2))) * 180) / Math.PI;
              return [Math.round(ldu * 100) / 100, Math.round(deg * 100) / 100];
            };
            // The summed motion where the turn was sampled; else (a motor, measured apart) from start
            // to end. A ring shifted at the drag's end moved after the turn: its shift is added.
            const shiftMoves = parts.map(moveOf);
            const moved = parts.map((p: number[], i: number) => (summed[i][0] || summed[i][1] ? [Math.round(Math.max(summed[i][0], shiftMoves[i][0]) * 100) / 100, Math.round(Math.max(summed[i][1], shiftMoves[i][1]) * 100) / 100] : shiftMoves[i]));
            const rebuilt = k.mech !== mechBefore;
            if (!rebuilt) k.kin.restore(snap);
            return { went, ms, how, moved, oneCall, shiftedRing, rebuilt };
          },
          { control, asked, way, step: MAX_STEP, parts: [...moves, ...stays].map((m: Ref) => [m.part, m.against]), dragEnd: listed },
        )) as { went: number; ms: number; how: string; moved: [number, number][]; oneCall: number | null; shiftedRing: boolean; rebuilt: boolean };
        if (r.oneCall !== null) oneCalls.push(r.oneCall);
        let { went, ms } = r;
        let moved = r.moved;
        if (r.how === 'motor') ({ went, ms, moved } = await runMotor(v, control, way, asked, [...moves, ...stays]));
        const steps = Math.max(1, Math.abs(went) / MAX_STEP);
        if (Math.abs(went) > 1e-6) msA.push(ms / steps);
        const stops = await v.stops();
        stops.forEach((s) => stopsA.add(s));
        moves.forEach((m: Ref, k: number) => { if (moved[k][0] >= MOVED || moved[k][1] >= MOVED) movedByA.add(m.ref); });
        stays.forEach((m: Ref, k: number) => { const x = moved[moves.length + k]; if (x[0] >= MOVED || x[1] >= MOVED) staysMovedByA.add(m.ref); });
        if (r.rebuilt && wi === 0) {
          // Worked out afresh (a ring shifted): opened afresh for the other way, Shift pressed again.
          if (!viewerFor) await v.close();
          v = await prepare(ref, false);
          if (shifted?.seen && (await v.reach(control)) >= 0 && (await v.aim(control))) await v.press({ shift: true, release: true });
        }
        A.push({ control: ref, way, ...(shifted ? { shift: shifted } : {}), ...(r.shiftedRing ? { ringShifted: true } : {}), asked: round(asked), went: round(went), ms: Math.round(ms), msOneCall: r.oneCall === null ? null : Math.round(r.oneCall), stops, moved: Object.fromEntries([...moves, ...stays].map((m: Ref, k: number) => [m.ref, moved[k]])) });
      }
    }
    time.A += (Date.now() - tA) / 1000;
    if (!viewerFor) await v.close();
  }

  // B, the hand.
  const B: unknown[] = [];
  const movedByB = new Set<string>();
  for (const ref of viewerFor ? [] : controls) {
    const control = refOf(ref).part;
    const v = await timed('open', open(file, settings));
    await timed('collisions', collisionsReady(v));
    await timed('first', firstSteps(v, fn.first ?? []));
    if (listed) await hold(v, Array.isArray(fn.held) ? fn.held : (fn.held?.[ref] ?? []));
    const turns = await timed('reach', v.reach(control));
    const tB = Date.now();
    if (turns < 0) {
      B.push({ control: ref, seen: false });
      time.B += (Date.now() - tB) / 1000;
      await v.close();
      continue;
    }
    const parts = moves.flatMap((m: Ref) => [m.part, m.against].filter((p) => p >= 0));
    const before = await v.where(parts);
    const isMotor = await v.page.evaluate((p) => (window as any).kinebrick.mech.roles[p] === 'motor', control);
    let shift: string[] = [];
    if (isMotor) {
      await v.page.keyboard.down('Control');
      await v.page.mouse.down();
      await v.page.mouse.up();
      await v.page.keyboard.up('Control');
      await v.page.waitForTimeout(10_000);
      await v.page.evaluate(() => (window as any).kinebrick.interaction.pauseMotor(true));
    } else {
      if (g.freed && !(await turnsPlain(v, control))) shift = (await v.press({ shift: true, release: true })).said;
      for (const [dx, dy] of PUSHES) {
        if (!(await v.aim(control))) continue;
        await v.press();
        await v.push(dx, dy);
      }
    }
    const moved: string[] = [];
    for (const m of moves) {
      const [r] = await v.moved([m.part, ...(m.against >= 0 ? [m.against] : [])], await pick(v, before, parts, [m.part, ...(m.against >= 0 ? [m.against] : [])]), m.against);
      if (r.moved) moved.push(m.ref);
    }
    moved.forEach((m) => movedByB.add(m));
    B.push({ control: ref, seen: true, cameraTurns: turns, motor: isMotor, shift, moved, stops: await v.stops() });
    time.B += (Date.now() - tB) / 1000;
    await v.close();
  }

  // Every control turned (or ran, a motor) in some way: a turn of 0 never shows a function, even one
  // that lists no part to move (the 8840's function 5, whose wheels all turned 0, was shown).
  const turnedEach = controls.every((ref) => (A as any[]).some((a) => a.control === ref && Math.abs(a.went) >= 0.01));
  const aShows = moves.every((m: Ref) => movedByA.has(m.ref)) && staysMovedByA.size === 0 && turnedEach;
  const bShows = !!viewerFor || movedByB.size > 0 || moves.length === 0;
  const why = [
    ...(aShows ? [] : [`A: ${moves.filter((m: Ref) => !movedByA.has(m.ref)).map((m: Ref) => m.ref).join(', ') || 'none'} not moved${staysMovedByA.size ? `; ${[...staysMovedByA].join(', ')} listed to stay moved` : ''}`]),
    ...(bShows ? [] : [`B: ${B.some((b: any) => !b.seen) ? 'the control could not be seen' : 'no listed part moved by hand'}`]),
    ...limits,
  ].join('; ');
  // The farthest the control turned in a way that a collision stopped, and the pair that stopped it.
  const stopped = (A as any[]).filter((a) => a.stops.length).sort((a, b) => Math.abs(b.went) - Math.abs(a.went))[0];
  const stop = stopped ? { control: stopped.control, way: stopped.way, went: stopped.went, asked: stopped.asked, by: stopped.stops } : null;
  return { verdict: aShows && bShows ? 'shown' : 'not shown', ...(why ? { why } : {}), msOneCall: oneCalls.length ? Math.round(Math.max(...oneCalls)) : null, msPerStep: msA.length ? Math.round(Math.max(...msA)) : null, time: Object.fromEntries(Object.entries(time).map(([k, s]) => [k, Math.round(s)])), stop, stops: [...stopsA], A, B };
}

// The list's first steps, as a user does them: a catch or lever turned by its joint's angle (turned
// back the other way if the screen's sense is the opposite), then a drag end, which shifts the ring
// it moves. A slid part or a driving ring slid by hand is not done here: said, for the record.
// The parts the list says are held, frozen, as Alt-click freezes their bodies.
async function hold(v: Viewer, refs: string[]) {
  if (!refs.length) return;
  await v.page.evaluate((parts) => {
    const k = (window as any).kinebrick;
    for (const p of parts) {
      const body = k.mech.bodyOf[p];
      if (!k.kin.isFrozen(body)) k.kin.toggleFreeze(body);
    }
  }, refs.map((r) => refOf(r).part));
}

// Whether a control moves by a plain drag (a turn of 0.01 rad, put back): where it does, a user
// presses no Shift on it. Shift on a part no friction pins hold asks for it to slide on its axle
// (slidesOnAxle in interaction.ts), and a wheel asked so turns no more: the 8840's p210, which the
// sweep pressed because the check's record had freed pins elsewhere, then turned 0 both ways.
async function turnsPlain(v: Viewer, control: number): Promise<boolean> {
  return v.page.evaluate((control) => {
    const k = (window as any).kinebrick;
    if (k.mech.roles[control] === 'motor') return true;
    const snap = k.kin.snapshot();
    const went = k.interaction.turnPart(control, 0.01, k.setup.camera.position);
    k.kin.restore(snap);
    return Math.abs(went) > 1e-4;
  }, control);
}

async function firstSteps(v: Viewer, first: { control: string; by: number; slide?: boolean }[]): Promise<string[]> {
  const notDone: string[] = [];
  for (const step of first) {
    const part = refOf(step.control).part;
    if (step.slide) {
      // A slide on the part's axle, as a user does it (decision 279, item 4): Shift pressed on the
      // part asks for the slide (setup.slideOnAxle), then a drag along it, which pushes its slide
      // joint, `by` LDU along the part's own axis that runs along the slide (as the check's
      // slidePart), a step at a time with the viewer's collision stop; the drag's end reads the
      // model where it now is (afterSlide).
      const went = await v.page.evaluate(
        ({ part, by }) => {
          const k = (window as any).kinebrick;
          if (!k.setup.slideOnAxle?.(part)) return null;
          // The slide joint asked for, found by its bodies: it need not hang the part's body in
          // the tree (the 42078's lock bar's closes a loop, and the body has no parent link). A
          // user's drag of such a part pushes it (the viewer's push: pushStep), as here.
          const body = k.mech.bodyOf[part];
          const joint = k.mech.joints.find((j: any) => j.kind === 'slide' && j.asked && (j.bodyA === body || j.bodyB === body));
          if (!joint) return null;
          const other = joint.bodyA === body ? joint.bodyB : joint.bodyA;
          const V = k.setup.camera.position.constructor;
          const axis = joint.to.clone().sub(joint.from).normalize().transformDirection(k.kin.poses[other]);
          const m = k.matrices()[part];
          const own = [0, 1, 2].map((c: number) => new V().setFromMatrixColumn(m, c).normalize());
          const kAxis = own.reduce((best: number, v: any, i: number) => (Math.abs(v.dot(axis)) > Math.abs(own[best].dot(axis)) ? i : best), 0);
          const dir = axis.clone().multiplyScalar(Math.sign(own[kAxis].dot(axis)) * Math.sign(by));
          const start = new V().setFromMatrixPosition(m);
          const grab = start.clone().applyMatrix4(k.kin.poses[body].clone().invert());
          const directions = k.pointDirections(k.kin, body, start);
          if (directions > 0) k.kin.holdWhatTheDragDoesntNeed(body, () => k.pointDirections(k.kin, body, grab.clone().applyMatrix4(k.kin.poses[body])) === directions);
          let moved = 0;
          while (moved < Math.abs(by) - 1e-9) {
            const step = Math.min(1, Math.abs(by) - moved);
            if (k.pushStep(k.kin, body, grab, dir, step, () => k.setup.blockedBy() === null) !== 'moved') break;
            moved += step;
          }
          k.kin.letGoAfterDrag();
          k.setup.onDragEnded();
          return moved;
        },
        { part, by: step.by },
      );
      if (went === null) notDone.push(`first step not done by the sweep: ${step.control} slid ${step.by} (it can't slide on its axle in the viewer)`);
      else if (went < 0.9 * Math.abs(step.by)) notDone.push(`first step short: ${step.control} slid ${Math.round(went * 10) / 10} of ${Math.abs(step.by)} LDU`);
      await v.page.waitForTimeout(2000);
      continue;
    }
    const done = await v.page.evaluate(
      ({ part, by }) => {
        const k = (window as any).kinebrick;
        // A driving ring is slid by hand, `by` LDU, to the click-in place nearest that, as a drag
        // on it does (the viewer's shiftTowards), and as the check does it.
        const slide = k.setup.slideOf?.(part);
        if (slide) {
          const wanted = slide.position + by;
          const nearest = slide.positions.reduce((best: number, p: number) => (Math.abs(p - wanted) < Math.abs(best - wanted) ? p : best));
          if (Math.abs(nearest - slide.position) < 1e-6) return false;
          // A ring a changeover catch holds: slid by hand in the viewer, it goes back where the
          // catch's fork is when the drag ends (meshAfresh), so a user turns the catch instead,
          // till the drag's end shifts the ring there (decision 279, item 4). The catch is dragged
          // round its joint each way in small steps, with the viewer's collision stop, till a shift
          // to that place is due.
          const catchPart = k.catchOf?.(part);
          if (catchPart !== null && catchPart !== undefined) {
            const body = k.mech.bodyOf[catchPart];
            const link = k.kin.parentLink(body);
            if (!link) return false;
            for (const way of [1, -1]) {
              const snap = k.kin.snapshot();
              for (let turned = 0; turned < 1.6; turned += 0.02) {
                k.kin.holdWhatTheDragDoesntNeed(body, () => k.kin.jointMotion(link.joint) !== null, link.joint);
                const went = k.kin.turnJoint(link.joint, way * 0.02, () => k.setup.blockedBy() === null);
                k.kin.letGoAfterDrag();
                const due = k.catchShiftsNow().find(([ring]: [number, number]) => ring === slide.part || ring === part);
                if (due && Math.abs(due[1] - nearest) < 1e-6) {
                  k.setup.onDragEnded();
                  return Math.abs((k.setup.slideOf(part)?.position ?? NaN) - nearest) < 1e-6;
                }
                if (due || Math.abs(went) < 1e-4) break;
              }
              k.kin.restore(snap);
            }
            return false;
          }
          k.setup.shift(part, nearest);
          k.setup.onDragEnded();
          return true;
        }
        const body = k.mech.bodyOf[part];
        const link = k.kin.parentLink(body);
        if (!link) return false;
        const a0 = k.kin.jointAngles[link.joint];
        if (k.kin.turnsLikeAKnob(body)) {
          k.interaction.turnPart(part, by, k.setup.camera.position);
          if (Math.sign(k.kin.jointAngles[link.joint] - a0) !== Math.sign(by)) k.interaction.turnPart(part, -2 * by, k.setup.camera.position);
        } else {
          // A part that doesn't turn like a knob (a changeover catch's lever) is dragged round its
          // joint in the viewer, not turned as a knob: its joint turned by `by`, as the drag ends
          // up doing, with the viewer's own collision stop (decision 267's look at the 8110's catches).
          k.kin.holdWhatTheDragDoesntNeed(body, () => k.kin.jointMotion(link.joint) !== null, link.joint);
          k.kin.turnJoint(link.joint, by, () => k.setup.blockedBy() === null);
          k.kin.letGoAfterDrag();
        }
        // Measured before the drag's end, which may work the mechanism out afresh (a ring shifted).
        const done = Math.abs(k.kin.jointAngles[link.joint] - a0) > 1e-6;
        k.setup.onDragEnded();
        return done;
      },
      { part, by: step.by },
    );
    if (!done) notDone.push(`first step not done by the sweep: ${step.control} by ${step.by} (it has no joint to turn, or didn't turn)`);
    await v.page.waitForTimeout(2000);
  }
  return notDone;
}

// A motor run by the viewer's own motor until its output has turned `asked` radians or a minute has
// gone; then paused, and the parts measured, and everything put back.
async function runMotor(v: Viewer, control: number, way: number, asked: number, parts: Ref[]) {
  const t0 = Date.now();
  await v.page.evaluate(({ control, way }) => {
    const k = (window as any).kinebrick;
    (window as any).sweepSnap = k.kin.snapshot();
    (window as any).sweepBefore = k.matrices().map((m: any) => m.clone());
    k.interaction.startMotor(control, k.setup.camera.position, way < 0);
  }, { control, way });
  let went = 0;
  while (Date.now() - t0 < MOTOR_MOST_MS && Math.abs(went) < asked) {
    await v.page.waitForTimeout(1000);
    went = await v.page.evaluate(() => {
      const k = (window as any).kinebrick;
      const part = k.interaction.motorPart();
      const link = part >= 0 ? k.kin.parentLink(k.mech.bodyOf[part]) : null;
      const snap = (window as any).sweepSnap;
      return link ? k.kin.jointAngles[link.joint] - snap.jointAngles[link.joint] : 0;
    });
  }
  const ms = Date.now() - t0;
  const moved = (await v.page.evaluate((pairs) => {
    const k = (window as any).kinebrick;
    k.interaction.pauseMotor(true);
    const before = (window as any).sweepBefore;
    const now = k.matrices();
    const frame = k.mech.bodyOf.indexOf(0);
    const out = pairs.map(([a, b]: number[]) => {
      const ref = b >= 0 ? b : frame;
      const x = before[ref].clone().invert().multiply(before[a]);
      const y = now[ref].clone().invert().multiply(now[a]);
      const e = x.clone().invert().multiply(y).elements;
      const ldu = Math.hypot(y.elements[12] - x.elements[12], y.elements[13] - x.elements[13], y.elements[14] - x.elements[14]);
      const deg = (Math.acos(Math.max(-1, Math.min(1, (e[0] + e[5] + e[10] - 1) / 2))) * 180) / Math.PI;
      return [Math.round(ldu * 100) / 100, Math.round(deg * 100) / 100];
    });
    k.kin.restore((window as any).sweepSnap);
    return out;
  }, parts.map((m) => [m.part, m.against]))) as [number, number][];
  return { went, ms, moved };
}

// The collision stop is ready once the parts that touch as built are known.
// Before that the viewer tests nothing, and a turn goes through parts. Also gives the page the
// helper that tsx names functions with, so the functions passed to evaluate run there.
async function collisionsReady(v: Viewer) {
  await v.page.evaluate('window.__name = window.__name || ((f) => f)');
  await v.page.waitForFunction(`(document.getElementById('collision-note')?.textContent ?? '') === '' && !!window.kinebrick.collisions() && !window.kinebrick.collisions().waiting`, null, { timeout: 600_000 });
}

// The rows of `before` (from where(parts)) for the parts `want`, then the frame's, as moved() takes them.
async function pick(_v: Viewer, before: number[][], parts: number[], want: number[]): Promise<number[][]> {
  return [...want.map((p) => before[parts.indexOf(p)]), before[before.length - 1]];
}

function round(x: number) {
  return Math.round(x * 1000) / 1000;
}

// Whether the viewer opens the model: null if it does, else what the page said (an error thrown
// while loading, or that it never got ready).
async function opens(file: string): Promise<string | null> {
  const browser = await chromium.launch(LAUNCH);
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
    let error: string | null = null;
    page.on('pageerror', (e) => { error ??= e.message; });
    await page.goto(`${base}/?file=${encodeURIComponent(file)}&option=debug${LIBRARY}`);
    for (let t = 0; t < 300; t++) {
      if (error) return `does not open in the viewer: ${String(error).slice(0, 200)}`;
      if (await page.evaluate(() => { const k = (window as any).kinebrick; return !!(k && k.kin && k.kin.poses.length > 0); })) return null;
      await page.waitForTimeout(1000);
    }
    return 'does not open in the viewer: not ready after 300 s';
  } finally {
    await browser.close();
  }
}

// The collision stops judged (decision 252): for each control a collision stopped, whether the real
// part turns without end (then the function is not shown, however far its parts moved first), or
// has an end with a travel of SHORT or less both ways (then the booklet decides, by hand, in
// judged.json), or neither (the stop stands).
function judge(key: string, fn: any, line: Record<string, any>): Record<string, any> {
  const A = line.A as any[];
  const stopped = [...new Set(A.filter((a) => a.stops.length).map((a) => a.control as string))];
  if (!stopped.length) return line;
  const kinds: string[] = fn.mechanisms ?? [];
  const { kinds: endlessOnes, endless } = endlessKinds(kinds);
  const words = [...new Set(((fn.does as string).match(ENDLESS_WORDS) ?? []).map((w) => w.toLowerCase()))];
  const stopsJudged = stopped.map((control) => {
    const ways = A.filter((a) => a.control === control);
    const at = ways.filter((a) => a.stops.length).map((a) => `${a.way > 0 ? '+' : '-'}${Math.abs(a.went)} rad (${a.stops.join(', ')})`).join('; ');
    const short = ways.every((a) => Math.abs(a.went) <= SHORT);
    // Judged so only where the stopped control is itself a part that turns without end
    // (endlessPart, decision 282): a lever at the end of its travel stands.
    if (endless && endlessPart(control.split(' ').slice(1).join(' '))) return { control, judged: 'not shown', why: `turns without end (kinds ${endlessOnes.join(', ')}; the text says: ${words.join(', ') || 'nothing more'}), but a collision stops it at ${at}` };
    if (short) return { control, judged: 'to compare with the booklet', why: `a travel of ${SHORT} rad or less each way, stopped at ${at}` };
    return { control, judged: 'stands', why: `stopped at ${at}; kinds ${kinds.join(', ') || 'none'}` };
  });
  const byHand = judged[key];
  let stopVerdict = stopsJudged.some((s) => s.judged === 'not shown') ? 'not shown' : stopsJudged.some((s) => s.judged === 'to compare with the booklet') ? 'not decided' : 'shown';
  if (byHand && stopVerdict === 'not decided') stopVerdict = byHand.stop;
  const out: Record<string, any> = { ...line, stopsJudged, stopVerdict, ...(byHand ? { byHand } : {}), moved: { verdict: line.verdict, ...(line.why ? { why: line.why } : {}) } };
  if (stopVerdict === 'not shown' && line.verdict === 'shown') {
    out.verdict = 'not shown';
    out.why = [line.why, `a collision stops a control: ${stopsJudged.filter((s) => s.judged !== 'stands').map((s) => `${s.control}: ${s.why}`).join('; ')}${byHand ? ` (${byHand.why}${byHand.page ? `, ${byHand.page}` : ''})` : ''}`].filter(Boolean).join('; ');
  }
  if (stopVerdict === 'not decided' && line.verdict === 'shown') out.verdict = 'not decided';
  if (stopVerdict === 'not decided') out.why = [out.why, `not decided: ${stopsJudged.filter((s) => s.judged === 'to compare with the booklet').map((s) => `${s.control}: ${s.why}`).join('; ')}`].filter(Boolean).join('; ');
  return out;
}
