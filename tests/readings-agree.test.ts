import { describe, expect, it } from 'vitest';
import { bothReadings, setModels } from '../scripts/readings-agree.ts';

// The 42099 embeds its own planetary wheel hubs ("42099 - 46490c01.dat", role "split"), built of
// "42099 - u9475" where the library's 46490c01 has 46434. The scripts once read the library's
// pieces there while the viewer read the file's own (decision 169): both must read the file's.
describe('the scripts read a model as the viewer does', () => {
  it("the 42099's parts, index by index", async () => {
    const { scripts, viewer } = await bothReadings('omr/42099-1 4x4 X-treme Off-Roader.mpd');
    expect(scripts.length).toBe(viewer.length);
    expect(scripts.filter((name, i) => name !== viewer[i])).toEqual([]);
    expect(scripts.filter((name) => name === 'u9475.dat').length).toBe(4);
  }, 120000);

  it('every set model, part by part (about 17 s)', async () => {
    const differ: string[] = [];
    for (const model of setModels()) {
      const { scripts, viewer } = await bothReadings(model);
      if (scripts.length !== viewer.length || scripts.some((name, i) => name !== viewer[i])) differ.push(model);
    }
    expect(differ).toEqual([]);
  }, 300000);
});
