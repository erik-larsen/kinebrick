// Where the viewer finds the pins the rule for stuck actuators frees (see pivotsOfStuckSlides in
// mechanism.ts) without working them out: for the models Kinebrick ships, kept files
// (data/pivots/<model>.json, made by npm run pivots), each under the key it depends on (see
// pivotsKey.ts). With none, or a key that doesn't match (a file you open yourself), the rule is
// worked out as the model is read.

import { keptFileName } from './collisions.ts';

const keptFiles = import.meta.glob('../data/pivots/*.json', { import: 'default' }) as Record<string, () => Promise<{ key: string; pins: number[] }>>;

// The kept pins for the model named `name` (its file's name, without .mpd or .ldr), if its key is `key`.
export async function keptPivots(name: string, key: string): Promise<number[] | null> {
  const load = keptFiles[`../data/pivots/${keptFileName(name)}.json`];
  if (!load) return null;
  try {
    const kept = await load();
    return kept.key === key ? kept.pins : null;
  } catch {
    return null;
  }
}
