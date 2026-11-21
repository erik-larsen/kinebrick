// Decision 301: the rests (push rods, rockers) of a model: each resting body's parts and what it
// stands on, by kind and the part of the body below.
import { loadModel } from '../load-model.ts';
for (const m of process.argv.slice(2)) {
  const L = await loadModel(m, m.startsWith('omr/'));
  const { mech, parts } = L;
  const names = (b: number) => mech.bodyOf.flatMap((x, i) => (x === b ? [`p${i} ${parts[i].name.replace('.dat', '')}`] : [])).slice(0, 5).join(', ');
  console.log(`== ${m}: ${mech.rests.length} rests`);
  for (const r of mech.rests) console.log(`  body ${r.body} [${names(r.body)}] on: ${[...new Set(r.on.map((o) => `${o.shape.kind} r${o.shape.radius} of body ${o.body} [${names(o.body).split(', ').slice(0, 2).join(', ')}]`))].join(' | ')}`);
}
