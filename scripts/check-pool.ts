// The machine's check pool (decision 229 of 2026-11-19): every child process of every function
// check on this machine, from any working folder, is entered here with the memory it is expected
// to take, and a check starts a child only while all the live entries and this one stay within the
// budget, half the machine's memory. The other half is for the system, the app, the sessions, the
// viewers and a drag's browser. Two checks side by side, five children each at 5.5 to 8.1 GB, took
// 82 GB of a 32 GB machine, and it stopped answering and restarted.
//
// The pool is a folder in the repository's common git folder (`git rev-parse --git-common-dir`), so
// every worktree shares it: one file for each entry, and a lock folder taken while entries are
// counted and one is added. An entry belongs to a child process once it has started, and before
// that to the check that reserved it; an entry whose process is gone is dropped.
//
// Any other heavy command (reading all the models, `npm run collisions`, `npm run pivots`, a probe
// that loads a large model) goes through the pool too, by this file's wrapper (decision 231):
//
//   npx tsx scripts/check-pool.ts run --mb <expected MB> --what <words> -- <command …>
//
// It waits for room as a check's child does, runs the command, passes on its exit code, drops its
// entry when the command ends (also when it fails or is stopped), and prints the most memory the
// command and its own children took, so that the next caller can give a better figure.

import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { totalmem } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Half the machine's memory, in MB.
export const BUDGET_MB = Math.floor(totalmem() / 2 ** 20 / 2);
// At most this many live entries on the whole machine, whatever memory is left: Erik's figure for
// this 12-thread Mac, 2026-11-19 (decision 232): "let's do a worker limit too - 16 check processes
// on a 12 thread machine ain't gonna work; how about 10 max".
export const MAX_PROCESSES = 10;

// How long to wait between tries for room in the pool, and for its lock (ms).
const WAIT = 2000;
const LOCK_WAIT = 20;
// A lock folder older than this with no owner written in it was left by a process that died
// between taking it and writing its owner (ms).
const LOCK_STALE = 10_000;

export function poolDir(): string {
  // A pool of its own, for tests.
  if (process.env.KINEBRICK_POOL_DIR) return process.env.KINEBRICK_POOL_DIR;
  // Found from this file's own folder, so that a command run from anywhere (a scratch folder)
  // uses the same pool.
  const here = dirname(fileURLToPath(import.meta.url));
  const common = execFileSync('git', ['-C', here, 'rev-parse', '--git-common-dir'], { encoding: 'utf-8' }).trim();
  return join(resolve(here, common), 'check-pool');
}

// Whether a process is running (one of another user's counts too).
export function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

interface Entry {
  owner: number; // the check that reserved it
  child: number | null; // the child process, once started
  mb: number; // the memory it is expected to take
  what: string; // the set (and function), for anyone reading the folder
}

const sleep = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

export class Pool {
  private n = 0;
  constructor(
    readonly dir: string,
    readonly budget = BUDGET_MB,
    readonly most = MAX_PROCESSES,
  ) {
    mkdirSync(dir, { recursive: true });
  }

  // Runs `f` with the pool's lock held, so that no other check counts or adds at the same time.
  private locked<T>(f: () => T): T {
    const lock = join(this.dir, 'lock');
    for (;;) {
      try {
        mkdirSync(lock);
        break;
      } catch {
        let owner = 0;
        try {
          owner = Number(readFileSync(join(lock, 'owner'), 'utf-8'));
        } catch {
          // Not written yet, or left so by a process that died.
          try {
            if (Date.now() - statSync(lock).mtimeMs > LOCK_STALE) rmSync(lock, { recursive: true, force: true });
          } catch {
            // Gone meanwhile.
          }
        }
        if (owner && !alive(owner)) rmSync(lock, { recursive: true, force: true });
        sleep(LOCK_WAIT);
      }
    }
    try {
      writeFileSync(join(lock, 'owner'), String(process.pid));
      return f();
    } finally {
      rmSync(lock, { recursive: true, force: true });
    }
  }

  // The live entries, by file name; the files of dead ones are removed.
  entries(): Map<string, Entry> {
    const out = new Map<string, Entry>();
    for (const name of readdirSync(this.dir)) {
      if (!name.endsWith('.json')) continue;
      let e: Entry;
      try {
        e = JSON.parse(readFileSync(join(this.dir, name), 'utf-8'));
      } catch {
        continue; // being written
      }
      if (alive(e.child ?? e.owner)) out.set(name, e);
      else rmSync(join(this.dir, name), { force: true });
    }
    return out;
  }

  // The memory the live entries are expected to take, in MB.
  used(): number {
    let sum = 0;
    for (const e of this.entries().values()) sum += e.mb;
    return sum;
  }

  // Enters `mb` for this check if it fits in the budget with everything live, or if nothing is
  // live (a child expected to take more than the whole budget runs alone), and fewer than `most`
  // entries are live: the entry's name, or null if there is no room yet.
  tryReserve(mb: number, what: string): string | null {
    return this.locked(() => {
      const live = [...this.entries().values()];
      const used = live.reduce((sum, e) => sum + e.mb, 0);
      if (live.length >= this.most) return null;
      if (used > 0 && used + mb > this.budget) return null;
      const name = `${process.pid}-${this.n++}.json`;
      this.write(name, { owner: process.pid, child: null, mb, what });
      return name;
    });
  }

  // As tryReserve, waiting until there is room.
  async reserve(mb: number, what: string): Promise<string> {
    for (;;) {
      const name = this.tryReserve(mb, what);
      if (name) return name;
      await new Promise((r) => setTimeout(r, WAIT));
    }
  }

  // The entry `name` belongs to the child `pid` from now on.
  started(name: string, pid: number) {
    const file = join(this.dir, name);
    try {
      const e: Entry = JSON.parse(readFileSync(file, 'utf-8'));
      this.write(name, { ...e, child: pid });
    } catch {
      // Dropped meanwhile: nothing to keep.
    }
  }

  release(name: string) {
    rmSync(join(this.dir, name), { force: true });
  }

  // Written whole, so that no one reads half an entry.
  private write(name: string, e: Entry) {
    const tmp = join(this.dir, `${name}.tmp`);
    writeFileSync(tmp, JSON.stringify(e));
    renameSync(tmp, join(this.dir, name));
  }
}

// The memory a child is expected to take where no peak of its own is stored, from the model's
// part count: 1000 MB and 0.75 MB for each part. Chosen above what was seen since the shapes are
// shared per part type (decision 235), so as to wait rather than run out: one function of the
// 42100 (4,079 parts) peaks at 1,268 MB (estimate 4,059), of the 8110 (2,048) at 1,813 MB at most
// over its 16 (estimate 2,536), of the 9397 (1,308) at 1,237 MB (estimate 1,981), a small set at
// about 300 MB. Before that decision a function of the 42100 took 5.5 to 8.1 GB and the estimate
// was 1000 + 2.5 a part; kept at that, the pool ran one such child at a time on an idle machine.
export function estimateMb(parts: number): number {
  return Math.round(1000 + 0.75 * parts);
}

// Each set's part count in its OMR model, from models/technic-sets.csv (0 where unknown).
export function partCounts(file = 'models/technic-sets.csv'): Map<string, number> {
  const out = new Map<string, number>();
  let lines: string[];
  try {
    lines = readFileSync(file, 'utf-8').trim().split('\n');
  } catch {
    return out;
  }
  // Cells split at commas outside quotes (a set's name may have a comma in it).
  const cellsOf = (line: string) => line.match(/("([^"]|"")*"|[^,]*)(,|$)/g)!.map((c) => c.replace(/,$/, ''));
  const head = cellsOf(lines[0]);
  const [setAt, partsAt, omrAt] = [head.indexOf('set_num'), head.indexOf('parts'), head.indexOf('omr_parts')];
  for (const line of lines.slice(1)) {
    const cells = cellsOf(line);
    const n = Number(cells[omrAt]) || Number(cells[partsAt]) || 0;
    if (cells[setAt]) out.set(cells[setAt], n);
  }
  return out;
}

// The most memory this process has taken so far, in MB.
export function peakMb(): number {
  return Math.round(process.resourceUsage().maxRSS / 1024);
}

// The memory a process group takes now, in MB: the sum over its processes.
function groupMb(pgid: number): number {
  try {
    const out = execFileSync('ps', ['-axo', 'pgid=,rss='], { encoding: 'utf-8' });
    let kb = 0;
    for (const line of out.trim().split('\n')) {
      const [g, rss] = line.trim().split(/\s+/).map(Number);
      if (g === pgid) kb += rss;
    }
    return Math.round(kb / 1024);
  } catch {
    return 0;
  }
}

// The wrapper (see the top of this file): the command's exit code, as the process's own.
async function run(args: string[]) {
  const dash = args.indexOf('--');
  const opt = (name: string) => {
    const i = args.indexOf(name);
    return i >= 0 && (dash < 0 || i < dash) ? args[i + 1] : undefined;
  };
  const mb = Number(opt('--mb'));
  const command = dash >= 0 ? args.slice(dash + 1) : [];
  if (!(mb > 0) || command.length === 0) {
    console.error('usage: npx tsx scripts/check-pool.ts run --mb <expected MB> --what <words> -- <command …>');
    process.exit(2);
  }
  const what = opt('--what') ?? command.join(' ');
  const pool = new Pool(poolDir());
  let entry: string | null = null;
  let child: ReturnType<typeof spawn> | null = null;
  // Stopped while it waits or runs: the command is stopped too, and the entry dropped.
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
    process.on(signal, () => {
      if (child?.pid) {
        try {
          process.kill(-child.pid, signal);
        } catch {
          // Gone already.
        }
      }
      if (entry) pool.release(entry);
      process.exit(128 + ({ SIGINT: 2, SIGTERM: 15, SIGHUP: 1 } as const)[signal]);
    });
  }
  // Said only when it has to wait, with what it waits for.
  entry = pool.tryReserve(mb, what);
  if (!entry) {
    const live = pool.entries();
    const used = [...live.values()].reduce((sum, e) => sum + e.mb, 0);
    console.error(`check-pool: waiting for room: ${live.size >= pool.most ? `${live.size} of ${pool.most} processes running` : `${mb} MB asked, ${used} of ${pool.budget} MB in use`}`);
    entry = await pool.reserve(mb, what);
  }
  // In a process group of its own, so that its own children are measured and stopped with it.
  child = spawn(command[0], command.slice(1), { stdio: 'inherit', detached: true });
  let peak = 0;
  if (child.pid) pool.started(entry, child.pid);
  const pgid = child.pid ?? 0;
  const timer = setInterval(() => (peak = Math.max(peak, groupMb(pgid))), 1000);
  const code = await new Promise<number>((resolve) => {
    child!.on('error', (err) => {
      console.error(`check-pool: ${err.message}`);
      resolve(127);
    });
    child!.on('exit', (c, signal) => resolve(c ?? (signal ? 128 + (({ SIGINT: 2, SIGKILL: 9, SIGTERM: 15 } as Record<string, number>)[signal] ?? 1) : 1)));
  });
  clearInterval(timer);
  pool.release(entry);
  console.error(`check-pool: ${what}: exit ${code}, peak ${peak} MB (expected ${mb})`);
  process.exit(code);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname) && process.argv[2] === 'run') await run(process.argv.slice(3));
