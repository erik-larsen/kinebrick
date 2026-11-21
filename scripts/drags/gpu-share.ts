// Decision 273 (npx tsx scripts/drags/gpu-share.ts <viewer> shell|shell-metal|chromium): how much of a core the browser's drawing process takes, idle and over a drag, for
// each way of launching it. One browser at a time; the drawing and page processes started before it are left out.
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
(globalThis as any).__name = (f: unknown) => f;
const base = process.argv[2];
const mode = process.argv[3] ?? 'shell';
const opts: any = { headless: true };
if (mode === 'shell-metal') opts.args = ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'];
if (mode === 'chromium') opts.channel = 'chromium';
if (mode === 'chromium-metal') { opts.channel = 'chromium'; opts.args = ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']; }
const before = new Set(execSync('ps -axo pid=').toString().split('\n').map((l) => parseInt(l.trim())));
const browser = await chromium.launch(opts);
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
const extra = process.argv[4] ?? '';
await page.goto(`${base}/?file=${encodeURIComponent('omr/9397-1 Logging Truck.mpd')}&option=debug&library=/ldraw/${extra}`);
await page.waitForFunction(() => { const k = (window as any).kinebrick; return k && k.kin && k.kin.poses.length > 0; }, null, { timeout: 300_000 });
await page.waitForTimeout(3000);
const gl = await page.evaluate(() => { const c = document.createElement('canvas').getContext('webgl2') as any; const d = c?.getExtension('WEBGL_debug_renderer_info'); return d ? c.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'none'; });
function gpuPids(): number[] {
  return execSync('ps -axo pid=,command=').toString().split('\n').filter((l) => l.includes('--type=gpu-process') && l.includes('ms-playwright')).map((l) => parseInt(l.trim())).filter((p) => !before.has(p));
}
function cpuTime(pids: number[]): number {
  // cumulative cpu seconds of the drawing processes
  let s = 0;
  for (const p of pids) {
    const t = execSync(`ps -o time= -p ${p}`).toString().trim();
    const [m, sec] = t.split(':');
    s += parseInt(m) * 60 + parseFloat(sec);
  }
  return s;
}
function renderer(): number[] {
  return execSync('ps -axo pid=,command=').toString().split('\n').filter((l) => l.includes('--type=renderer') && l.includes('ms-playwright') && !l.includes('extension')).map((l) => parseInt(l.trim())).filter((p) => !before.has(p));
}
const pids = gpuPids();
const rp = renderer();
async function share(seconds: number, work: () => Promise<void>) {
  const g0 = cpuTime(pids), r0 = cpuTime(rp), t0 = Date.now();
  await work();
  const dt = (Date.now() - t0) / 1000;
  return { gpu: +((cpuTime(pids) - g0) / dt).toFixed(2), page: +((cpuTime(rp) - r0) / dt).toFixed(2), seconds: +dt.toFixed(1) };
}
const idle = await share(20, () => page.waitForTimeout(20_000));
const drag = await share(20, async () => {
  await page.evaluate(async () => {
    const k = (window as any).kinebrick;
    const t0 = performance.now();
    let way = 1, steps = 0;
    while (performance.now() - t0 < 20_000) {
      const went = k.interaction.turnPart(1000, way * 0.05, k.setup.camera.position);
      steps++;
      if (Math.abs(went) < 1e-6 || steps % 20 === 0) way = -way;
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r)));
    }
    (window as any).steps = steps;
  });
});
const steps = await page.evaluate(() => (window as any).steps);
console.log(JSON.stringify({ mode, extra, gl, gpuPids: pids, rendererPids: rp, idle, drag, steps }));
await browser.close();
