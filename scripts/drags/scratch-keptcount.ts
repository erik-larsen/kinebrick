import { existsSync, readFileSync } from 'node:fs';
import { collisionKey, keptFileName } from '../../src/collisions.ts';
import { readParts } from '../load-model.ts';
import { keptModels } from '../collision-pairs.ts';
const release = JSON.parse(readFileSync('data/collisions/library.json', 'utf-8')).release;
let match = 0; const miss: string[] = [];
for (const m of keptModels()) {
  const f = `data/collisions/${keptFileName(m)}.json`;
  if (!existsSync(f)) { miss.push(`${m} (no file)`); continue; }
  const { parts } = readParts(m, m.startsWith('omr/'));
  if (JSON.parse(readFileSync(f, 'utf-8')).key === (await collisionKey(parts, release))) match++; else miss.push(`${m} (key differs)`);
}
console.log(`${match} models' kept files match; ${miss.length} don't:`); for (const m of miss) console.log(' ', m);
