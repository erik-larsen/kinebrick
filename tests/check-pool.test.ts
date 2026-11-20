import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { alive, estimateMb, partCounts, Pool } from '../scripts/check-pool.ts';

// The machine's check pool (see scripts/check-pool.ts): a check starts a child only while the
// live entries and this one stay within the budget, or alone; entries of processes that are gone
// don't count.
describe('the check pool', () => {
  const dirs: string[] = [];
  const fresh = (budget: number) => {
    const dir = mkdtempSync(join(tmpdir(), 'check-pool-'));
    dirs.push(dir);
    return new Pool(dir, budget);
  };
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });
  // A process id that has ended.
  const dead = () => spawnSync('true').pid!;

  it('counts what is live against the budget', () => {
    const pool = fresh(1000);
    const a = pool.tryReserve(600, 'a');
    expect(a).not.toBeNull();
    expect(pool.tryReserve(500, 'b')).toBeNull();
    const c = pool.tryReserve(400, 'c');
    expect(c).not.toBeNull();
    expect(pool.used()).toBe(1000);
    pool.release(a!);
    expect(pool.used()).toBe(400);
    expect(pool.tryReserve(500, 'b')).not.toBeNull();
  });

  it('lets no more than the most processes run, though memory would allow more', () => {
    const pool = fresh(100000);
    const names = Array.from({ length: 10 }, (_, i) => pool.tryReserve(10, `p${i}`));
    expect(names.every((n) => n !== null)).toBe(true);
    expect(pool.tryReserve(10, 'eleventh')).toBeNull();
    pool.release(names[0]!);
    expect(pool.tryReserve(10, 'eleventh')).not.toBeNull();
  });

  it('drops the entries of processes that are gone', () => {
    const pool = fresh(1000);
    writeFileSync(join(pool.dir, '1-0.json'), JSON.stringify({ owner: dead(), child: null, mb: 900, what: 'gone' }));
    const kept = pool.tryReserve(700, 'kept')!;
    expect(pool.used()).toBe(700);
    expect(readdirSync(pool.dir)).not.toContain('1-0.json');
    // Once the child it was reserved for has ended, the entry goes too.
    pool.started(kept, dead());
    expect(pool.used()).toBe(0);
  });

  it('lets a child larger than the budget run, alone', () => {
    const pool = fresh(1000);
    const big = pool.tryReserve(5000, 'big');
    expect(big).not.toBeNull();
    expect(pool.tryReserve(1, 'small')).toBeNull();
    pool.release(big!);
    expect(pool.tryReserve(1, 'small')).not.toBeNull();
    expect(pool.tryReserve(5000, 'big')).toBeNull();
  });

  // The oldest waiter goes first: a request that waits holds back every younger one, though the
  // younger would fit, until it has its room; a waiter whose process is gone holds back no one.
  it('lets an older large waiter go before a younger small one', () => {
    const pool = fresh(1000);
    const a = pool.tryReserve(800, 'a')!;
    const big = pool.enqueue(500, 'big');
    // 800 + 100 would fit, but the older waiter comes first.
    expect(pool.tryReserve(100, 'small')).toBeNull();
    const small = pool.enqueue(100, 'small');
    expect(pool.tryReserve(100, 'small', small)).toBeNull();
    expect(pool.tryReserve(500, 'big', big)).toBeNull();
    pool.release(a);
    expect(pool.tryReserve(100, 'small', small)).toBeNull();
    expect(pool.tryReserve(500, 'big', big)).not.toBeNull();
    expect(pool.waiters().map(([name]) => name)).toEqual([small]);
    expect(pool.tryReserve(100, 'small', small)).not.toBeNull();
    expect(pool.waiters()).toEqual([]);
    expect(pool.used()).toBe(600);
  });

  it('lets no dead waiter hold anyone back', () => {
    const pool = fresh(1000);
    writeFileSync(join(pool.dir, 'wait-1-0.json'), JSON.stringify({ owner: dead(), mb: 900, what: 'gone', since: 0 }));
    expect(pool.tryReserve(100, 'after')).not.toBeNull();
    expect(readdirSync(pool.dir)).not.toContain('wait-1-0.json');
  });

  it('waits in turn, and drops its waiting entry once it has room', async () => {
    const pool = fresh(1000);
    const a = pool.tryReserve(900, 'a')!;
    const waiting = pool.reserve(500, 'later');
    expect(pool.waiters().length).toBe(1);
    pool.release(a);
    const got = await waiting;
    expect(got).toMatch(/\.json$/);
    expect(pool.waiters()).toEqual([]);
    expect(pool.used()).toBe(500);
  });

  it('takes a lock left by a process that is gone', () => {
    const pool = fresh(1000);
    mkdirSync(join(pool.dir, 'lock'));
    writeFileSync(join(pool.dir, 'lock', 'owner'), String(dead()));
    expect(pool.tryReserve(10, 'after')).not.toBeNull();
  });

  it('tells a live process from one that is gone', () => {
    expect(alive(process.pid)).toBe(true);
    expect(alive(dead())).toBe(false);
  });

  it("runs a heavy command through the pool, entered while it runs, and drops it when the command fails", () => {
    const dir = mkdtempSync(join(tmpdir(), 'check-pool-'));
    dirs.push(dir);
    const seen = join(dir, 'seen.txt');
    // The command lists the pool while it runs, then fails.
    const wrapper = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/check-pool.ts', 'run', '--mb', '50', '--what', 'a failing command', '--', 'sh', '-c', `ls ${dir} > ${seen}; exit 3`], { env: { ...process.env, KINEBRICK_POOL_DIR: dir }, encoding: 'utf-8' });
    expect(wrapper.status).toBe(3);
    expect(readFileSync(seen, 'utf-8').split('\n').filter((f) => f.endsWith('.json'))).toHaveLength(1);
    expect(readdirSync(dir).filter((f) => f.endsWith('.json'))).toEqual([]);
    expect(wrapper.stderr).toContain('a failing command: exit 3');
  });

  it('estimates from the part count, and reads part counts past quoted commas', () => {
    expect(estimateMb(4079)).toBe(4059);
    const dir = mkdtempSync(join(tmpdir(), 'check-pool-'));
    dirs.push(dir);
    const csv = join(dir, 'sets.csv');
    writeFileSync(csv, 'set_num,name,parts,year,omr_parts\n1-1,"Car, Big",100,1990,90\n2-1,Crane,50,1991,\n');
    const parts = partCounts(csv);
    expect(parts.get('1-1')).toBe(90);
    expect(parts.get('2-1')).toBe(50);
  });
});
