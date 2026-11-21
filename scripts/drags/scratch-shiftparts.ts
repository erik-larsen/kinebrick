// Decision 304: for each held function whose record has freed pins, what a Shift press frees on
// its control and on each listed part, by the viewer's own answer (setup.pinsToShift).
import { readFileSync, writeFileSync } from 'node:fs';
import { open } from './drag.ts';
(globalThis as any).__name = (f: unknown) => f;
const keys = JSON.parse(readFileSync(process.env.KB_KEYS!, 'utf-8')) as string[];
const out: any = {};
for (const key of keys) {
  const [set, n] = key.split(' ');
  const s = JSON.parse(readFileSync(`data/sets/${set}.json`, 'utf-8'));
  const fn = s.curated.functions[+n - 1];
  const model = fn.model ?? s.curated.model;
  const v = await open(model, fn.lifted ? 'lifted=1' : '');
  await v.page.evaluate('window.__name = window.__name || ((f) => f)');
  await v.page.waitForFunction(`(document.getElementById('collision-note')?.textContent ?? '') === '' && !!window.kinebrick.collisions() && !window.kinebrick.collisions().waiting`, null, { timeout: 600_000 });
  const refs = [...[fn.control].flat(), ...(fn.moves ?? []).map((m: string) => m.split(' against ')[0])];
  const parts = [...new Set(refs.map((r: string) => Number(/^p(\d+)/.exec(r)![1])))];
  const answers: any = {};
  for (const p of parts) answers[`p${p}`] = await v.page.evaluate((p) => (window as any).kinebrick.setup.pinsToShift(p), p);
  out[key] = { control: fn.control, answers };
  console.log(key, JSON.stringify(answers));
  await v.close();
}
writeFileSync(process.env.KB_OUT!, JSON.stringify(out, null, 1));
