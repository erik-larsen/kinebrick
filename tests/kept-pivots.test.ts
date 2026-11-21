import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { keptFileName } from '../src/collisions.ts';
import { actuatorPivots } from '../src/mechanism.ts';
import { pivotsKey } from '../src/pivotsKey.ts';
import { keptModels } from '../scripts/collision-pairs.ts';
import { PIVOTS_DIR } from '../scripts/kept-pivots.ts';
import { readParts } from '../scripts/load-model.ts';
import { touchingOf } from './touching.ts';

// The kept results of the rule for stuck actuators (npm run pivots) are filed under a key made
// from what they depend on: a kept file whose model has changed since is stale, and a reading
// would ignore it, working the rule out itself, slowly.
describe('the kept pins of stuck actuators', () => {
  const roles: Record<string, string> = JSON.parse(readFileSync('data/roles.json', 'utf-8'));
  const models = keptModels();
  const byName = new Map(models.map((m) => [keptFileName(m), m]));
  it('is kept for every model the sets use (npm run pivots makes what is missing)', () => {
    const missing = models.filter((m) => existsSync(m) && !existsSync(`${PIVOTS_DIR}/${keptFileName(m)}.json`));
    expect(missing).toEqual([]);
  });
  for (const file of readdirSync(PIVOTS_DIR).filter((f) => f.endsWith('.json'))) {
    const model = byName.get(file.replace(/\.json$/, ''));
    it.skipIf(!model || !existsSync(model))(`has a key that matches its model, and names only its parts: ${file}`, () => {
      const kept = JSON.parse(readFileSync(`${PIVOTS_DIR}/${file}`, 'utf-8'));
      const { parts, table } = readParts(model!, model!.startsWith('omr/'));
      expect(kept.key).toBe(pivotsKey(parts, table, roles));
      expect((kept.pins as number[]).filter((p) => p >= parts.length)).toEqual([]);
    });
  }
  // A second guard, for a change to the reading that the key doesn't see: a few models whose
  // rule is quick to work out are worked out again here, and must free what is kept.
  // (npm run pivots -- --check does this for every model.)
  for (const set of ['42023-1', '42061-1', '42006-1', '42050-1']) {
    const model = models.find((m) => m.includes(`/${set} `));
    it.skipIf(!model || !existsSync(model) || !existsSync('ldraw/parts'))(`frees what is kept, worked out again: ${set}`, async () => {
      const { text, parts, table, paths } = readParts(model!, true);
      const kept = JSON.parse(readFileSync(`${PIVOTS_DIR}/${keptFileName(model!)}.json`, 'utf-8'));
      expect(actuatorPivots(parts, table, roles, paths, await touchingOf(model!, text, parts))).toEqual(kept.pins);
    }, 60000);
  }
});
