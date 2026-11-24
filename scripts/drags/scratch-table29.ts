import { readFileSync } from 'node:fs';
import { endlessKinds, endlessPart } from '../endless.ts';
const list = JSON.parse(readFileSync('../kb/rule279.json', 'utf-8'));
const titles = JSON.parse(readFileSync('packed/titles.json', 'utf-8'));
const t = (n: string) => titles[`${n}.dat`] ?? (() => { try { return readFileSync(`ldraw/parts/${n.replace(/^.* - /, '')}.dat`, 'utf-8').split('\n')[0].replace(/^0\s+~?/, ''); } catch { return '?'; } })();
console.log('| set fn | stored (found) | stopped control | pair met | at (rad) of turned | endless part | rule gives |');
console.log('|---|---|---|---|---|---|---|');
for (const o of list) {
  const s = JSON.parse(readFileSync(`data/sets/${o.set}.json`, 'utf-8'));
  const r = s.generated.functions[o.fn - 1];
  const x = r.found ?? r;
  const c = s.curated.functions[o.fn - 1];
  const refs = [c.control].flat();
  const kinds = endlessKinds(c.mechanisms).endless;
  const stops = x.collisionStops as number[][];
  const byCtl = new Map<number, number[]>();
  for (const st of stops) if (!byCtl.has(st[0])) byCtl.set(st[0], st);
  const cells = [...byCtl.values()].map((st) => { const ref = refs[st[0]]; const nm = ref.split(' ').slice(1).join(' '); return { ref: `${ref} (${t(nm).slice(0, 28)})`, pair: `p${st[2]}/p${st[3]}`, at: `${st[4]} of ${st[5]}`, endless: endlessPart(nm) }; });
  const judged = kinds && cells.some((c) => c.endless);
  const gives = judged && x.result === 'works' ? 'partly' : x.result;
  const stored = r.hold ? `${r.result} held (found ${x.result})` : r.result;
  console.log(`| ${o.set} fn${o.fn} | ${stored} | ${cells.map((c) => c.ref).join('; ')} | ${cells.map((c) => c.pair).join('; ')} | ${cells.map((c) => c.at).join('; ')} | ${cells.map((c) => (c.endless ? 'yes' : 'no')).join('; ')} | ${gives}${gives !== x.result ? ' (drops)' : ''} |`);
}
