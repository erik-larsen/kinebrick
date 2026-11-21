// Every weld rideAlong makes (a loose part's rigid tie at its own origin), in every model the
// check reads; with --touches (on decision 259's code), also for each loose part the bodies of the
// parts it touches as built that aren't loose. Run in a worktree, through the pool:
// npx tsx welds2.mts <out.json> [--touches] [model …]
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
const wt = process.cwd();
const { loadModel } = await import(wt + '/scripts/load-model.ts');
const touchesToo = process.argv.includes('--touches');
const only = process.argv.slice(3).filter((a) => !a.startsWith('--'));
const models = [...new Set(readdirSync('data/sets').filter((f) => f.endsWith('.json')).flatMap((f) => { const s = JSON.parse(readFileSync('data/sets/' + f, 'utf-8')); return [s.curated?.model, ...(s.curated?.functions ?? []).map((fn: any) => fn.model)].filter(Boolean); }))].sort().filter((m) => !only.length || only.some((o) => m.includes(o)));
const out: any[] = [];
for (const m of models) {
  try {
    const loaded = await loadModel(m, m.startsWith('omr/'));
    const { mech, parts } = loaded;
    const loose = new Set<number>(mech.loose);
    const name = (p: number) => (parts[p]?.name ?? '?').replace('.dat', '');
    const welds = mech.connections.filter((c: any) => c.kind === 'rigid' && c.from && c.to && c.from.distanceTo(c.to) < 1e-9 && loose.has(c.male)).map((c: any) => ({ part: `p${c.male} ${name(c.male)}`, to: `p${c.female} ${name(c.female)}`, body: mech.bodyOf[c.female] }));
    const row: any = { model: m, welds };
    if (touchesToo) {
      const t: Map<number, number[]> = loaded.touching(parts.map((p: any) => p.matrix), [...loose]);
      row.multi = [...t].flatMap(([i, list]) => { const bodies = [...new Set(list.filter((p) => !loose.has(p)).map((p) => mech.bodyOf[p]))]; return bodies.length > 1 ? [{ part: `p${i} ${name(i)}`, bodies }] : []; });
    }
    out.push(row);
  } catch (e) { out.push({ model: m, error: String(e).slice(0, 160) }); }
  process.stderr.write('.');
}
writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
console.log(`\n${models.length} models read`);
