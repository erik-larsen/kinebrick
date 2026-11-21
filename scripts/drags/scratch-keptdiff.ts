import { readFileSync } from 'node:fs';
import { keptFileName, touchingFrom, nearPairsOf } from '../../src/collisions.ts';
import { readParts } from '../load-model.ts';
import { partShapes } from '../part-shapes.ts';
const m = process.argv[2];
const { parts, text } = readParts(m, m.startsWith('omr/'));
const kept = JSON.parse(readFileSync(`data/collisions/${keptFileName(m)}.json`, 'utf-8'));
const shapes = await partShapes(m, text, parts);
const all = parts.map((_, i) => i);
const t = touchingFrom(shapes.map((s) => s.shape), parts.map((p) => p.matrix));
const got = t(parts.map((p) => p.matrix), all, true);
const live = new Set<string>(); for (const [a, l] of got) for (const b of l) live.add(a < b ? `${a},${b}` : `${b},${a}`);
const k = new Set<string>(kept.near.map(([a, b]: number[]) => (a < b ? `${a},${b}` : `${b},${a}`)));
const onlyLive = [...live].filter((x) => !k.has(x)), onlyKept = [...k].filter((x) => !live.has(x));
console.log(m, 'parts', parts.length, 'shapes', shapes.length, 'paths', parts.filter((p) => p.path).length, 'live', live.size, 'kept', k.size, 'onlyLive', onlyLive.length, onlyLive.slice(0, 8), 'onlyKept', onlyKept.length, onlyKept.slice(0, 8));
const fresh = nearPairsOf(shapes.slice(0, parts.length).map((s, i) => (parts[i].path ? [] : s.shape)), parts.map((p) => p.matrix));
const f = new Set<string>(fresh.near.map(([a, b]) => (a < b ? `${a},${b}` : `${b},${a}`)));
console.log('fresh nearPairsOf vs kept: onlyFresh', [...f].filter((x) => !k.has(x)).length, 'onlyKept', [...k].filter((x) => !f.has(x)).length, '; fresh vs live: onlyLive', [...live].filter((x) => !f.has(x)).slice(0, 8), 'onlyFresh', [...f].filter((x) => !live.has(x)).slice(0, 8));
for (const x of onlyLive.slice(0, 4)) { const [a, b] = x.split(',').map(Number); console.log(x, parts[a].name, parts[b].name, !!parts[a].path, !!parts[b].path); }
const stale = [...f].filter((x) => !k.has(x));
for (const x of stale) { const [a, b] = x.split(',').map(Number); console.log('stale', x, parts[a].name, parts[b].name); }
console.log('kept file date', (await import('node:child_process')).execSync(`git log -1 --format=%cd -- "data/collisions/${keptFileName(m)}.json"`).toString().trim());
