// Opens every model the Technic sets use (data/sets: each set's model and its functions' own
// models) in the viewer at the address given, waits until it has loaded or failed, and prints one
// line for each: the error, or how many of its parts are drawn as parts of their own against how
// many the model has, with the reason for each part the loader drew into the model instead (see
// loadedLines in src/main.ts). Every change to how the viewer loads a model is gated with it
// (decision 250 of 2026-11-20: the 42120 had never opened). Each model is opened in a process of
// its own, through the machine's pool (scripts/check-pool.ts), at most 3 at a time, each asking
// for what its browser takes (see browserMb).
//   npx tsx scripts/drags/open-all.ts http://localhost:5191 [model …]
//   npx tsx scripts/drags/open-all.ts http://localhost:5191 --one "omr/42120-1 Rescue Hovercraft.mpd"
// It exits with 1 if any model fails to open.
import { spawn } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { partCounts } from '../check-pool.ts';
import { LAUNCH, LIBRARY } from './drag.ts';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const base = args[0];
if (!base?.startsWith('http')) throw new Error('give the viewer\'s address first, e.g. http://localhost:5191');
const LOAD_MS = 600_000;
// What a model's browser is expected to take, in MB: 1,000 and 0.85 for each part of its set, the
// worker's figure of 2026-11-20 (decision 255; its sampler measured chromium at 2,752 MB for the
// 8110, 1,558 for the 9397 and 1,427 for the 42078); 3,000 where the part count is unknown.
const browserMb = (parts: number | undefined) => (parts ? Math.round(1000 + 0.85 * parts) : 3000);

const oneAt = args.indexOf('--one');
if (oneAt >= 0) {
  const model = args[oneAt + 1];
  const browser = await chromium.launch(LAUNCH);
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const started = Date.now();
    await page.goto(`${base}/?file=${encodeURIComponent(model)}&option=debug${LIBRARY}`);
    // Loaded (the debug handle is set at the end of loading) or failed (the summary says Error).
    await page.waitForFunction(() => (window as any).kinebrick?.mech || /^Error/.test(document.getElementById('summary')?.textContent ?? ''), null, { timeout: LOAD_MS });
    const seconds = Math.round((Date.now() - started) / 1000);
    const said = await page.evaluate(() => {
      const k = (window as any).kinebrick;
      if (!k?.mech) return { error: document.getElementById('summary')?.textContent?.replace(/\s*Try again\s*$/, '') ?? 'no summary' };
      return { parts: k.parts.length as number, noChild: k.noChild() as { part: number; name: string; why: string }[] };
    });
    if ('error' in said) {
      console.log(`${model}: ${said.error} (${seconds} s)`);
      process.exitCode = 1;
    } else {
      const why = new Map<string, number[]>();
      for (const n of said.noChild) why.set(`${n.name}: ${n.why}`, [...(why.get(`${n.name}: ${n.why}`) ?? []), n.part]);
      const list = [...why].map(([w, ps]) => `${ps.length} × ${w} (p${ps[0]}${ps.length > 1 ? ` to p${ps[ps.length - 1]}` : ''})`).join('; ');
      console.log(`${model}: ${said.parts - said.noChild.length} of ${said.parts} parts drawn as parts${list ? `; drawn into the model: ${list}` : ''} (${seconds} s)`);
    }
    if (errors.length) console.log(`${model}: page errors: ${[...new Set(errors)].join(' | ')}`);
  } finally {
    await browser.close();
  }
} else {
  // Every model the sets use, as scripts/scan-part-shapes.ts lists them; or those named.
  const named = args.slice(1).filter((a) => !a.startsWith('--'));
  const models = new Set<string>();
  // Each model's set, for its part count.
  const setOf = new Map<string, string>();
  for (const file of readdirSync(join('data', 'sets')).filter((f) => f.endsWith('.json'))) {
    const set = JSON.parse(readFileSync(join('data', 'sets', file), 'utf-8'));
    for (const m of [set.curated?.model, ...(set.curated?.functions ?? []).map((fn: { model?: string }) => fn.model)]) {
      if (!m) continue;
      models.add(m);
      if (!setOf.has(m)) setOf.set(m, set.set);
    }
  }
  const queue = [...models].filter((m) => !named.length || named.some((n) => m.includes(n))).sort();
  const total = queue.length;
  const parts = partCounts();
  let failed = 0;
  const lines: string[] = [];
  const worker = async () => {
    for (let model = queue.shift(); model; model = queue.shift()) {
      const m = model;
      const out = await new Promise<{ code: number | null; text: string }>((resolve) => {
        const child = spawn('npx', ['tsx', 'scripts/check-pool.ts', 'run', '--mb', String(browserMb(parts.get(setOf.get(m) ?? ''))), '--what', `open ${m}`, '--', 'npx', 'tsx', 'scripts/drags/open-all.ts', base, '--one', m], { stdio: ['ignore', 'pipe', 'pipe'] });
        let text = '';
        child.stdout.on('data', (d) => (text += d));
        child.stderr.on('data', (d) => (text += d));
        child.on('close', (code) => resolve({ code, text }));
      });
      const said = out.text.split('\n').filter((l) => l.startsWith(`${m}:`));
      if (out.code !== 0) failed++;
      const line = said.length ? said.join('\n') : `${m}: failed (${out.code}): ${out.text.trim().split('\n').slice(-2).join(' ')}`;
      lines.push(line);
      console.log(line);
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  console.log(`${total - failed} of ${total} models open`);
  if (failed) process.exitCode = 1;
}
