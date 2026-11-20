import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
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

  it('estimates from the part count, and reads part counts past quoted commas', () => {
    expect(estimateMb(4079)).toBe(11198);
    const dir = mkdtempSync(join(tmpdir(), 'check-pool-'));
    dirs.push(dir);
    const csv = join(dir, 'sets.csv');
    writeFileSync(csv, 'set_num,name,parts,year,omr_parts\n1-1,"Car, Big",100,1990,90\n2-1,Crane,50,1991,\n');
    const parts = partCounts(csv);
    expect(parts.get('1-1')).toBe(90);
    expect(parts.get('2-1')).toBe(50);
  });
});
