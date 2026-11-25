import { describe, expect, it } from 'vitest';
import { cpuSeconds, findings, type Seen } from '../scripts/pool-watch.ts';

// The hung-task check (scripts/pool-watch.ts): a job in the pool whose own processes use no
// processor time between two looks is reported, whatever its browser does.
describe('the hung-task check', () => {
  const at = 1_000_000_000_000;
  const job = (cpu: number, browser = 0, minutesOld = 20): Seen => ({ name: '42071-0.json', pid: 42208, what: 'sweep 41999-1', started: at - minutesOld * 60_000, cpu, browser });

  it("reads ps's processor time", () => {
    expect(cpuSeconds('0:03.45')).toBeCloseTo(3.45);
    expect(cpuSeconds('12:34.56')).toBeCloseTo(754.56);
    expect(cpuSeconds('1:02:03')).toBe(3723);
    expect(cpuSeconds('2-01:02:03')).toBe(2 * 86400 + 3723);
  });

  it('reports a job that used no processor time, though its browser did', () => {
    // The sweep of 2026-11-25: the record written, the browser never closed and drawing frames.
    const found = findings([job(100, 500)], [job(100.2, 800)], [], at, 600);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatch(/^idle: sweep 41999-1 \(entry 42071-0\.json, process 42208\) has run 20 min/);
    expect(found[0]).toMatch(/its browser used 300 s/);
  });

  it('leaves a working job alone, and a job seen only once', () => {
    expect(findings([job(100)], [job(160)], [], at, 600)).toEqual([]);
    // A sweep's script at work, about 0.3 s a minute: not idle over one minute or over ten.
    expect(findings([job(100)], [job(100.3)], [], at, 60)).toEqual([]);
    expect(findings([job(100)], [job(103)], [], at, 600)).toEqual([]);
    expect(findings([job(100)], [job(100.05)], [], at, 60)).toHaveLength(1);
    expect(findings([], [job(100)], [], at, 600)).toEqual([]);
    // The same entry name with another process is another job.
    expect(findings([{ ...job(100), pid: 1 }], [job(100)], [], at, 600)).toEqual([]);
  });

  it('reports a job older than four hours once, and a request that waits over half an hour', () => {
    const said = new Set<string>();
    const old = job(9000, 0, 5 * 60);
    expect(findings([job(8000, 0, 5 * 60)], [old], [], at, 600, [], said)[0]).toMatch(/^long: sweep 41999-1 .* has run 300 min/);
    expect(findings([old], [{ ...old, cpu: 9500 }], [], at, 600, [], said)).toEqual([]);
    const waiting = [{ name: 'wait-1-0.json', what: 'tests', since: at - 45 * 60_000 }];
    expect(findings([], [], waiting, at, 600)[0]).toMatch(/^waiting: tests \(wait-1-0\.json\) has waited 45 min for room/);
    expect(findings([], [], [{ ...waiting[0], since: at - 10 * 60_000 }], at, 600)).toEqual([]);
  });

  it('leaves out an entry that is allowed', () => {
    expect(findings([job(100)], [job(100)], [], at, 600, ['42071-0.json'])).toEqual([]);
  });
});
