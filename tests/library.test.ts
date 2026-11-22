import { describe, expect, it } from 'vitest';
import { libraryReader } from '../src/library.ts';

// Reading a part from the LDraw library online, when a fetch fails for a moment or for good.
describe('the LDraw library reader', () => {
  // A fetch that fails the first `fails` times (as a network slip, which the browser reports as a
  // CORS error), then gives `status` with the part's text.
  const flaky = (fails: number, status = 200) => {
    let tries = 0;
    const fetchFile = async () => {
      tries++;
      if (tries <= fails) throw new TypeError('Failed to fetch');
      return new Response('0 a part', { status });
    };
    return { fetchFile, tries: () => tries };
  };
  it('tries a failed fetch again', async () => {
    const f = flaky(2);
    const counts: number[] = [];
    const read = libraryReader('https://example.org/', new Set(), (n) => counts.push(n), f.fetchFile, [0, 0]);
    expect(await read('3001.dat')).toBe('0 a part');
    expect(f.tries()).toBe(3);
    expect(counts).toEqual([1]);
  });
  it('gives up after its tries, naming the part, and counts no more', async () => {
    const f = flaky(3);
    const counts: number[] = [];
    const read = libraryReader('https://example.org/', new Set(), (n) => counts.push(n), f.fetchFile, [0, 0]);
    await expect(read('3001.dat')).rejects.toThrow(/couldn't fetch 3001.dat .*3 tries.*Failed to fetch/);
    expect(await read('3002.dat')).toBe('0 a part');
    expect(counts).toEqual([]);
  });
  it("tries a server's error again, but not a part the library hasn't got", async () => {
    const busy = flaky(0, 503);
    await expect(libraryReader('https://example.org/', new Set(), () => {}, busy.fetchFile, [0])('3001.dat')).rejects.toThrow(/answered 503/);
    expect(busy.tries()).toBe(2);
    const missing = flaky(0, 404);
    expect(await libraryReader('https://example.org/', new Set(), () => {}, missing.fetchFile, [0])('nopart.dat')).toBe(null);
    expect(missing.tries()).toBe(1);
  });
});
