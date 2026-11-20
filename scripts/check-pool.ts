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

import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { totalmem } from 'node:os';
import { join, resolve } from 'node:path';

// Half the machine's memory, in MB.
export const BUDGET_MB = Math.floor(totalmem() / 2 ** 20 / 2);

// How long to wait between tries for room in the pool, and for its lock (ms).
const WAIT = 2000;
const LOCK_WAIT = 20;
// A lock folder older than this with no owner written in it was left by a process that died
// between taking it and writing its owner (ms).
const LOCK_STALE = 10_000;

export function poolDir(): string {
  const common = execFileSync('git', ['rev-parse', '--git-common-dir'], { encoding: 'utf-8' }).trim();
  return join(resolve(common), 'check-pool');
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
  // live (a child expected to take more than the whole budget runs alone): the entry's name, or
  // null if there is no room yet.
  tryReserve(mb: number, what: string): string | null {
    return this.locked(() => {
      const used = this.used();
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
// part count: 1000 MB and 2.5 MB for each part. Chosen above what was seen, so as to wait rather
// than run out: the 42100 (4,079 parts) took 5.5 to 8.1 GB for one function (estimate 11.2 GB);
// the 42082 (4,113) 7.6 GB at its peak for function 9 (estimate 11.3 GB).
export function estimateMb(parts: number): number {
  return Math.round(1000 + 2.5 * parts);
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
