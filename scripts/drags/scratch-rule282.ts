// Decision 282's rule, applied to the stored records: every function whose record (or, held, what
// the check found) has a collision stop, with its result as stored and as the rule makes it.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { endlessKinds, endlessPart } from '../endless.ts';
const rows: any[] = [];
for (const f of readdirSync('data/sets').filter((f) => f.endsWith('.json'))) {
  const s = JSON.parse(readFileSync(`data/sets/${f}`, 'utf-8'));
  (s.generated?.functions ?? []).forEach((r: any, i: number) => {
    const x = r?.found ?? r;
    if (!x?.collisionStops?.length) return;
    const c = s.curated.functions[i];
    const refs = [c.control].flat();
    const endless = endlessKinds(c.mechanisms).endless;
    const hit = endless ? x.collisionStops.find(([wi]: number[]) => refs[wi] && endlessPart(refs[wi].split(' ').slice(1).join(' '))) : undefined;
    const after = hit && x.result === 'works' ? 'partly' : x.result;
    rows.push({ set: s.set, fn: i + 1, stored: r.result, held: !!r.hold, found: x.result, after, endlessKinds: endless, control: hit ? refs[hit[0]] : null });
  });
}
writeFileSync(process.argv[2], JSON.stringify(rows, null, 1));
const changed = rows.filter((r) => r.after !== r.found);
console.log(`${rows.length} functions with a collision stop; ${changed.length} change:`);
for (const r of changed) console.log(`${r.set} fn${r.fn}: ${r.found} -> ${r.after}${r.held ? ' (held at ' + r.stored + ')' : ''}; ${r.control}`);
const e = rows.find((r) => r.set === '8063-1' && r.fn === 5);
console.log('8063 fn5:', JSON.stringify(e));
