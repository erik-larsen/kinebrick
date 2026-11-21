import { loadModel } from '../load-model.ts';
const [model, ...ids] = process.argv.slice(2);
const L = await loadModel(model, model.startsWith('omr/'));
const want = new Set(ids.map(Number));
for (const c of L.mech.connections as any[]) {
  const a = c.male?.part ?? c.from?.part ?? c.male, b = c.female?.part ?? c.to?.part ?? c.female;
  if (want.has(a) || want.has(b)) console.log(JSON.stringify({ kind: c.kind, male: c.male, female: c.female }).slice(0, 300));
}
console.log('welded/loose:', JSON.stringify((L.mech.loose ?? []).filter((x: number) => want.has(x))));
