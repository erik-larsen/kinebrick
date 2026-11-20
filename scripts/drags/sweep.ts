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
//
// One record per set in data/viewer/<set>.json, with the commit and the date; a set already swept
// at this commit is skipped unless --force. Each set runs in a process of its own, through the
// machine's pool (scripts/check-pool.ts), at most 3 at a time (--jobs), on the viewer whose address
// is given (your own server, not 5174's).
//   npx tsx scripts/drags/sweep.ts http://localhost:5208 [set …] [--force] [--jobs 3]
//   npx tsx scripts/drags/sweep.ts http://localhost:5208 --one 9397-1      (one set, in this process)
import { execSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { open, type Viewer } from './drag.ts';

const MOVED = 1; // LDU or degrees, as the check's MOVED
const MAX_STEP = 0.035; // radians: the solver's largest turn step (MAX_TURN_STEP in kinematics.ts)
const MOTOR_MOST_MS = 60_000;
const PUSHES: [number, number][] = [[120, 0], [-120, 0], [0, 120], [0, -120]];

type Ref = { ref: string; part: number; against: number };
const refOf = (ref: string): Ref => {
  const m = /^p(\d+) .*?(?: against p(\d+) .*)?$/.exec(ref);
  if (!m) throw new Error(`can't read the reference "${ref}"`);
  return { ref, part: Number(m[1]), against: m[2] === undefined ? -1 : Number(m[2]) };
};

const args = process.argv.slice(2);
const base = args[0];
const force = args.includes('--force');
const commit = execSync('git rev-parse --short HEAD').toString().trim();
const setFile = (set: string) => `data/sets/${set}.json`;
const outFile = (set: string) => `data/viewer/${set}.json`;
const worksIn = (set: string) => (JSON.parse(readFileSync(setFile(set), 'utf-8')).generated?.functions ?? []).filter((g: { result?: string } | null) => g?.result === 'works').length;

const oneAt = args.indexOf('--one');
if (oneAt >= 0) {
  await sweepSet(args[oneAt + 1]);
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
  const sets = (named.length ? named.filter((s) => all.includes(s)) : all)
    .filter((s) => worksIn(s) > 0)
    .filter((s) => force || !existsSync(outFile(s)) || JSON.parse(readFileSync(outFile(s), 'utf-8')).commit !== commit)
    .sort((a, b) => Number(allWork(b)) - Number(allWork(a)) || a.localeCompare(b));
  console.log(`${sets.length} sets to sweep, ${jobs} at a time`);
  const queue = [...sets];
  await Promise.all(Array.from({ length: jobs }, async () => {
    for (let set = queue.shift(); set; set = queue.shift()) {
      const started = Date.now();
      const code = await new Promise<number>((done) => {
        const child = spawn('npx', ['tsx', 'scripts/check-pool.ts', 'run', '--mb', '3000', '--what', `sweep ${set}`, '--', 'npx', 'tsx', 'scripts/drags/sweep.ts', base, '--one', set], { stdio: ['ignore', 'inherit', 'inherit'] });
        child.on('close', (c) => done(c ?? 1));
      });
      console.log(`${set}: ${code === 0 ? 'done' : `failed (${code})`} in ${Math.round((Date.now() - started) / 1000)} s`);
    }
  }));
}

async function sweepSet(set: string) {
  const data = JSON.parse(readFileSync(setFile(set), 'utf-8'));
  const model: string = data.curated.model;
  const out: { set: string; commit: string; date: string; seconds: number; functions: unknown[] } = { set, commit, date: new Date().toISOString(), seconds: 0, functions: [] };
  const started = Date.now();
  for (const [i, fn] of (data.curated.functions as any[]).entries()) {
    const g = data.generated.functions[i];
    if (g?.result !== 'works') continue;
    const fnStarted = Date.now();
    let line: Record<string, any>;
    try {
      line = await sweepFunction(fn.model ?? model, fn, g);
    } catch (e) {
      line = { verdict: 'not shown', why: `the sweep failed: ${String(e).slice(0, 200)}` };
    }
    const record: Record<string, any> = { function: i + 1, does: fn.does, ...line, seconds: Math.round((Date.now() - fnStarted) / 1000) };
    out.functions.push(record);
    console.log(`${set} fn${i + 1}: ${record.verdict}${record.why ? ` (${record.why})` : ''}; ${(line.msPerStep as number | undefined) ?? '-'} ms a step`);
  }
  out.seconds = Math.round((Date.now() - started) / 1000);
  mkdirSync('data/viewer', { recursive: true });
  writeFileSync(outFile(set), JSON.stringify(out, null, 2) + '\n');
}

// One function, A and B. `fn` is the list's entry, `g` the check's record of it.
async function sweepFunction(file: string, fn: any, g: any): Promise<Record<string, any>> {
  const controls: string[] = [fn.control].flat();
  const moves = (fn.moves ?? []).map(refOf);
  const stays = (fn.stays ?? []).map(refOf);
  const limits: string[] = [];

  // A, the turn.
  const A: unknown[] = [];
  const movedByA = new Set<string>();
  const staysMovedByA = new Set<string>();
  const stopsA = new Set<string>();
  const msA: number[] = [];
  {
    const v = await open(file);
    await collisionsReady(v);
    limits.push(...(await firstSteps(v, fn.first ?? [])));
    for (const [ci, ref] of controls.entries()) {
      const control = refOf(ref).part;
      for (const [wi, way] of [1, -1].entries()) {
        const asked = Math.abs(g.turned?.[ci]?.[wi] ?? 1.5) || 1.5;
        const r = (await v.page.evaluate(
          ({ control, asked, way, parts }) => {
            const k = (window as any).kinebrick;
            const snap = k.kin.snapshot();
            const frame = k.mech.bodyOf.indexOf(0);
            const before = k.matrices().map((m: any) => m.clone());
            const t0 = performance.now();
            let went = 0;
            let how = 'turned';
            if (k.mech.roles[control] === 'motor') how = 'motor';
            else went = k.interaction.turnPart(control, way * asked, k.setup.camera.position);
            const ms = performance.now() - t0;
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
            const moved = parts.map(moveOf);
            k.kin.restore(snap);
            return { went, ms, how, moved };
          },
          { control, asked, way, parts: [...moves, ...stays].map((m: Ref) => [m.part, m.against]) },
        )) as { went: number; ms: number; how: string; moved: [number, number][] };
        let { went, ms } = r;
        let moved = r.moved;
        if (r.how === 'motor') ({ went, ms, moved } = await runMotor(v, control, way, asked, [...moves, ...stays]));
        const steps = Math.max(1, Math.abs(went) / MAX_STEP);
        if (Math.abs(went) > 1e-6) msA.push(ms / steps);
        const stops = await v.stops();
        stops.forEach((s) => stopsA.add(s));
        moves.forEach((m: Ref, k: number) => { if (moved[k][0] >= MOVED || moved[k][1] >= MOVED) movedByA.add(m.ref); });
        stays.forEach((m: Ref, k: number) => { const x = moved[moves.length + k]; if (x[0] >= MOVED || x[1] >= MOVED) staysMovedByA.add(m.ref); });
        A.push({ control: ref, way, asked: round(asked), went: round(went), ms: Math.round(ms), stops, moved: Object.fromEntries([...moves, ...stays].map((m: Ref, k: number) => [m.ref, moved[k]])) });
      }
    }
    await v.close();
  }

  // B, the hand.
  const B: unknown[] = [];
  const movedByB = new Set<string>();
  for (const ref of controls) {
    const control = refOf(ref).part;
    const v = await open(file);
    await collisionsReady(v);
    await firstSteps(v, fn.first ?? []);
    const turns = await v.reach(control);
    if (turns < 0) {
      B.push({ control: ref, seen: false });
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
      if (g.freed) shift = (await v.press({ shift: true, release: true })).said;
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
    await v.close();
  }

  const aShows = moves.every((m: Ref) => movedByA.has(m.ref)) && staysMovedByA.size === 0;
  const bShows = movedByB.size > 0 || moves.length === 0;
  const why = [
    ...(aShows ? [] : [`A: ${moves.filter((m: Ref) => !movedByA.has(m.ref)).map((m: Ref) => m.ref).join(', ') || 'none'} not moved${staysMovedByA.size ? `; ${[...staysMovedByA].join(', ')} listed to stay moved` : ''}`]),
    ...(bShows ? [] : [`B: ${B.some((b: any) => !b.seen) ? 'the control could not be seen' : 'no listed part moved by hand'}`]),
    ...limits,
  ].join('; ');
  // The farthest the control turned in a way that a collision stopped, and the pair that stopped it.
  const stopped = (A as any[]).filter((a) => a.stops.length).sort((a, b) => Math.abs(b.went) - Math.abs(a.went))[0];
  const stop = stopped ? { control: stopped.control, way: stopped.way, went: stopped.went, asked: stopped.asked, by: stopped.stops } : null;
  return { verdict: aShows && bShows ? 'shown' : 'not shown', ...(why ? { why } : {}), msPerStep: msA.length ? Math.round(Math.max(...msA)) : null, stop, stops: [...stopsA], A, B };
}

// The list's first steps, as a user does them: a catch or lever turned by its joint's angle (turned
// back the other way if the screen's sense is the opposite), then a drag end, which shifts the ring
// it moves. A slid part or a driving ring slid by hand is not done here: said, for the record.
async function firstSteps(v: Viewer, first: { control: string; by: number; slide?: boolean }[]): Promise<string[]> {
  const notDone: string[] = [];
  for (const step of first) {
    const part = refOf(step.control).part;
    if (step.slide) {
      notDone.push(`first step not done by the sweep: ${step.control} slid ${step.by}`);
      continue;
    }
    const done = await v.page.evaluate(
      ({ part, by }) => {
        const k = (window as any).kinebrick;
        const link = k.kin.parentLink(k.mech.bodyOf[part]);
        if (!link) return false;
        const a0 = k.kin.jointAngles[link.joint];
        k.interaction.turnPart(part, by, k.setup.camera.position);
        if (Math.sign(k.kin.jointAngles[link.joint] - a0) !== Math.sign(by)) k.interaction.turnPart(part, -2 * by, k.setup.camera.position);
        k.setup.onDragEnded();
        return Math.abs(k.kin.jointAngles[link.joint] - a0) > 1e-6;
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
