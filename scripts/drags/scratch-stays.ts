import { readdirSync, readFileSync } from 'node:fs';
import { endlessPart } from '../endless.ts';
let shown = 0, withStays = 0, endlessStays = 0, rows: string[] = [];
for (const f of readdirSync('data/viewer').filter((f) => /^\d.*\.json$/.test(f))) {
  const r = JSON.parse(readFileSync(`data/viewer/${f}`, 'utf-8'));
  const s = JSON.parse(readFileSync(`data/sets/${r.set}.json`, 'utf-8'));
  for (const fn of r.functions ?? []) {
    if (fn.verdict !== 'shown') continue;
    shown++;
    const c = s.curated.functions[fn.function - 1];
    const stays: string[] = c.stays ?? [];
    if (!stays.length) continue;
    withStays++;
    const e = stays.filter((x) => endlessPart(x.split(' against ')[0].split(' ').slice(1).join(' ')));
    if (e.length) { endlessStays++; rows.push(`${r.set} fn${fn.function}: ${e.join('; ')}`); }
  }
}
console.log({ shown, withStays, endlessStays }); console.log(rows.join('\n'));
