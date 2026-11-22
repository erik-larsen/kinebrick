// Keeps the pins the rule for stuck actuators frees (see pivotsOfStuckSlides in src/mechanism.ts)
// for each model the sets use, in data/pivots/<model>.json under the key it depends on (see
// pivotsKey.ts): an empty list where it frees none. A reading of the model then needn't work
// the rule out, which in a large model costs more than the rest of the reading (the 42078's
// took 21 s where the rest takes 6.6 s). tests/kept-pivots.test.ts fails when a kept file's key
// no longer matches its model.
//
//   npm run pivots                   every model the sets use whose kept file is missing, or whose
//                                    key no longer matches (the model, its errata, the roles or
//                                    connections of its parts, or PIVOTS_RULE changed)
//   npm run pivots -- 42078 8012     only models whose file name has one of these in it
//   npm run pivots -- --force        worked out again even where the key matches
//   npm run pivots -- --check        worked out again, and each told where it differs from its
//                                    kept file, nothing written: for a change to the reading
//                                    that the key doesn't see

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { keptFileName, touchingFrom } from '../src/collisions.ts';
import { actuatorPivots } from '../src/mechanism.ts';
import { pivotsKey } from '../src/pivotsKey.ts';
import { keptModels } from './collision-pairs.ts';
import { readParts } from './load-model.ts';
import { partShapes } from './part-shapes.ts';

export const PIVOTS_DIR = 'data/pivots';

if (process.argv[1]?.endsWith('kept-pivots.ts')) {
  const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const force = process.argv.includes('--force');
  const check = process.argv.includes('--check');
  const roles: Record<string, string> = JSON.parse(readFileSync('data/roles.json', 'utf-8'));
  mkdirSync(PIVOTS_DIR, { recursive: true });
  let differ = 0;
  for (const model of keptModels().filter((m) => !only.length || only.some((o) => m.includes(o)))) {
    const start = Date.now();
    const { text, parts, paths, table } = readParts(model, model.startsWith('omr/'));
    const key = pivotsKey(parts, table, roles);
    const file = `${PIVOTS_DIR}/${keptFileName(model)}.json`;
    const kept = existsSync(file) ? JSON.parse(readFileSync(file, 'utf-8')) : null;
    if (!force && !check && kept?.key === key) continue;
    const pins = actuatorPivots(parts, table, roles, paths, touchingFrom((await partShapes(model, text, parts)).map((s, i) => (parts[i]?.path ? [] : s.shape))));
    const seconds = ((Date.now() - start) / 1000).toFixed(1);
    if (check) {
      const same = kept?.key === key && JSON.stringify(kept.pins) === JSON.stringify(pins);
      if (!same) differ++;
      console.log(`${keptFileName(model)}: ${same ? 'as kept' : `kept ${kept ? JSON.stringify(kept.pins) + (kept.key === key ? '' : ' (stale key)') : 'nothing'}, now ${JSON.stringify(pins)}`} (${seconds} s)`);
      continue;
    }
    writeFileSync(file, JSON.stringify({ key, pins }) + '\n');
    console.log(`${keptFileName(model)}: ${pins.length ? `frees ${pins.map((p) => 'p' + p).join(', ')}` : 'frees none'} (${seconds} s)`);
  }
  if (check) {
    console.log(differ ? `${differ} differ from their kept files` : 'every kept file as worked out now');
    if (differ) process.exitCode = 1;
  }
}
