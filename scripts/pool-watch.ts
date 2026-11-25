// The hung-task check (decision 375 of 2026-11-25, Erik's order): looks at every job in the
// machine's check pool (scripts/check-pool.ts) and says which ones have stopped working. It only
// reports. It never stops a process: a job belongs to the session that started it.
//
// Why: on 2026-11-25 a sweep of one set had written its record and then never closed its browser.
// Its entry stayed in the pool for 2 hours 28 minutes, the session that started it waited for it
// in silence, and nobody saw it until Erik asked what was running. On 2026-11-23 the pool itself
// stood still for 20 hours (decision 346).
//
// What it reports:
// - idle: a job whose own processes (the browser left out) used less than IDLE_CPU seconds of
//   processor time for each 10 minutes between two looks. (A sweep's script mostly waits for its
//   browser and uses about 0.3 s a minute while it works; a hung one uses none.) A browser draws frames whether its sweep works or not (the
//   hung one took half a core), so its time proves nothing; the script that drives it does.
// - waiting: a request that has waited for room longer than WAITING_MIN minutes.
// - long: a job older than LONG_HOURS hours, whatever it is doing.
//
//   npx tsx scripts/pool-watch.ts                 look twice, 60 s apart, and print what is found.
//                                                 A quick look only: in one minute a sweep can sit
//                                                 in one long step of its browser and look idle.
//   npx tsx scripts/pool-watch.ts --loop 600      look every 600 s; print and end (exit code 1) at
//                                                 the first finding. Run in the background, it
//                                                 costs nothing while all is well and wakes the
//                                                 session that started it when a job hangs.
//   … --allow <entry name>                        leave this entry out (a long job known to be well)
//
// A finding names the entry, its process number, what it is and how long it has run, so that the
// reader can tell whose it is and say so to that session.

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { loadavg } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { poolDir } from './check-pool.ts';

export const IDLE_CPU = 1; // seconds of processor time for each 10 minutes between two looks, under which a job is idle
export const WAITING_MIN = 30; // minutes a request may wait for room
export const LONG_HOURS = 4; // hours a job may run before it is reported once

// What one look sees of one pool entry.
export interface Seen {
  name: string; // the entry's file
  pid: number; // the job's process
  what: string;
  started: number; // when the entry was written (ms)
  cpu: number; // processor seconds its own processes have used so far, the browser left out
  browser: number; // processor seconds of its browser's processes
}

// A request waiting for room.
export interface Waiting {
  name: string;
  what: string;
  since: number; // ms
}

// "12:34.56", "1:02:03" or "2-01:02:03" (ps's time) in seconds.
export function cpuSeconds(text: string): number {
  const [days, rest] = text.includes('-') ? text.split('-') : ['0', text];
  let seconds = 0;
  for (const part of rest.split(':')) seconds = seconds * 60 + Number(part);
  return Number(days) * 86400 + seconds;
}

const isBrowser = (command: string) => /chrome|chromium/i.test(command);

// Every pool entry and waiter, as they are now. Nothing is removed from the pool's folder.
export function look(dir = poolDir()): { seen: Seen[]; waiting: Waiting[] } {
  const rows = execFileSync('ps', ['-axo', 'pid=,ppid=,time=,comm='], { encoding: 'utf-8', maxBuffer: 1 << 26 })
    .trim()
    .split('\n')
    .map((line) => line.trim().match(/^(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => ({ pid: Number(m[1]), ppid: Number(m[2]), cpu: cpuSeconds(m[3]), command: m[4] }));
  const children = new Map<number, typeof rows>();
  for (const r of rows) children.set(r.ppid, [...(children.get(r.ppid) ?? []), r]);
  const byPid = new Map(rows.map((r) => [r.pid, r]));
  const seen: Seen[] = [];
  const waiting: Waiting[] = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.json')) continue;
    let e: { owner: number; child?: number | null; what: string; since?: number };
    let started: number;
    try {
      e = JSON.parse(readFileSync(join(dir, name), 'utf-8'));
      started = statSync(join(dir, name)).birthtimeMs;
    } catch {
      continue; // being written, or just removed
    }
    if (name.startsWith('wait-')) {
      if (byPid.has(e.owner)) waiting.push({ name, what: e.what, since: e.since ?? started });
      continue;
    }
    const pid = e.child ?? e.owner;
    if (!byPid.has(pid)) continue; // ended: the pool drops the entry at its next use
    let cpu = 0;
    let browser = 0;
    const todo = [byPid.get(pid)!];
    while (todo.length) {
      const r = todo.pop()!;
      if (isBrowser(r.command)) browser += r.cpu;
      else cpu += r.cpu;
      todo.push(...(children.get(r.pid) ?? []));
    }
    seen.push({ name, pid, what: e.what, started, cpu, browser });
  }
  return { seen, waiting };
}

const minutes = (ms: number) => Math.round(ms / 60000);

// What two looks, `seconds` apart, find wrong. `said` holds the long jobs already reported.
export function findings(before: Seen[], now: Seen[], waiting: Waiting[], at: number, seconds: number, allow: string[] = [], said = new Set<string>()): string[] {
  const out: string[] = [];
  const was = new Map(before.map((s) => [`${s.name} ${s.pid}`, s]));
  for (const s of now) {
    if (allow.includes(s.name)) continue;
    const b = was.get(`${s.name} ${s.pid}`);
    const age = minutes(at - s.started);
    if (b && s.cpu - b.cpu < (IDLE_CPU * seconds) / 600) {
      out.push(`idle: ${s.what} (entry ${s.name}, process ${s.pid}) has run ${age} min and its own processes used ${(s.cpu - b.cpu).toFixed(2)} s of processor time in the last ${Math.round(seconds)} s` + (s.browser - b.browser >= 1 ? `; its browser used ${(s.browser - b.browser).toFixed(0)} s, which a browser does whether the job works or not` : ''));
    } else if (at - s.started > LONG_HOURS * 3600_000 && !said.has(s.name)) {
      said.add(s.name);
      out.push(`long: ${s.what} (entry ${s.name}, process ${s.pid}) has run ${age} min, over ${LONG_HOURS} hours; it is still working`);
    }
  }
  for (const w of waiting) {
    if (allow.includes(w.name)) continue;
    if (at - w.since > WAITING_MIN * 60_000) out.push(`waiting: ${w.what} (${w.name}) has waited ${minutes(at - w.since)} min for room; the machine's load is ${loadavg()[0].toFixed(1)}`);
  }
  return out;
}

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

async function main() {
  const args = process.argv.slice(2);
  const loopAt = args.indexOf('--loop');
  const every = loopAt >= 0 ? Number(args[loopAt + 1]) : 60;
  const allow = args.flatMap((a, i) => (a === '--allow' ? [args[i + 1]] : []));
  const said = new Set<string>();
  let before = look().seen;
  for (;;) {
    await sleep(every * 1000);
    const { seen, waiting } = look();
    const found = findings(before, seen, waiting, Date.now(), every, allow, said);
    if (found.length) {
      console.log(`Hung-task check, ${new Date().toLocaleString()}: ${found.length} of ${seen.length} jobs in the pool, ${waiting.length} waiting`);
      for (const f of found) console.log(`- ${f}`);
      process.exit(1);
    }
    if (loopAt < 0) {
      console.log(`Hung-task check, ${new Date().toLocaleString()}: nothing found; ${seen.length} jobs in the pool, ${waiting.length} waiting`);
      return;
    }
    before = seen;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) void main();
