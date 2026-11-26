// A measure for the speed work (decision 377 of 2026-11-26): opens a model in the viewer, in a
// browser with no window that draws with the graphics card (as the drag scripts do), and measures
// its frames at rest and with one part spun by Auto spin. For each: frames a second, the time
// between frames, and the time on the page's own thread inside a frame, split into the solver's
// turn (solve), the collision test inside it (collide) and the drawing (draw). One line of JSON.
//
//   npx tsx scripts/perf/frames.ts "omr/42043-1 Mercedes-Benz Arocs 3245.mpd" 169 [http://localhost:5174]
//
// The viewer must be running (npm run dev -- --port 5174). The part is one Auto spin can turn,
// by its number in the model. On a busy machine the times are longer.

import { chromium } from 'playwright';
import { LAUNCH, LIBRARY } from '../drags/drag.ts';

const [file, part, base = 'http://localhost:5174'] = process.argv.slice(2);

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
// tsx names functions with a helper the page does not have.
await page.addInitScript('window.__name = (f) => f');
// Before the page's own code: every frame callback is timed.
await page.addInitScript(() => {
  const w = window as any;
  w.frames = [];
  w.inFrame = { solve: 0, collide: 0, draw: 0 };
  const raf = window.requestAnimationFrame.bind(window);
  let last = 0;
  window.requestAnimationFrame = (cb: FrameRequestCallback) =>
    raf((t) => {
      const s = performance.now();
      w.inFrame = { solve: 0, collide: 0, draw: 0 };
      cb(t);
      const e = performance.now();
      if (w.recording) w.frames.push({ gap: last ? s - last : 0, work: e - s, ...w.inFrame });
      last = s;
    });
});
const started = Date.now();
await page.goto(`${base}/?file=${encodeURIComponent(file)}&option=debug${LIBRARY}`);
await page.waitForFunction(() => { const k = (window as any).kinebrick; return k && k.kin && k.kin.poses.length > 0; }, null, { timeout: 600_000 });
const loadSeconds = (Date.now() - started) / 1000;
await page.waitForTimeout(4000);
// Time inside the solver's turn, the collision test and the drawing, for each frame.
const sizes = await page.evaluate(() => {
  const w = window as any;
  const k = w.kinebrick;
  const time = (object: any, name: string, key: string) => {
    const original = object[name];
    if (typeof original !== 'function') return false;
    let depth = 0;
    object[name] = function (...args: unknown[]) {
      if (depth) return original.apply(this, args);
      depth++;
      const s = performance.now();
      try { return original.apply(this, args); } finally { depth--; w.inFrame[key] += performance.now() - s; }
    };
    return true;
  };
  const wrapped = { turnJoint: time(k.kin, 'turnJoint', 'solve'), push: time(k.kin, 'pushStepByTiers', 'solve'), blockedBy: time(k.setup, 'blockedBy', 'collide'), render: time(k.setup.renderer, 'render', 'draw') };
  let meshes = 0, objects = 0;
  k.setup.ldrawSpace.traverse((o: any) => { objects++; if (o.isMesh || o.isLineSegments) meshes++; });
  return { wrapped, parts: k.parts.length, bodies: k.kin.poses.length, objects, meshes, gl: (() => { const gl = k.setup.renderer.getContext(); const e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown'; })() };
});
const record = async (ms: number) => {
  await page.evaluate(() => { (window as any).frames = []; (window as any).recording = true; });
  await page.waitForTimeout(ms);
  return page.evaluate(() => {
    const w = window as any;
    w.recording = false;
    const f: { gap: number; work: number; solve: number; collide: number; draw: number }[] = w.frames.slice(1);
    const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
    const r = (x: number) => Math.round(x * 10) / 10;
    const gaps = f.map((x) => x.gap).sort((a, b) => a - b);
    return { frames: f.length, fps: r(1000 / mean(gaps)), gapMedian: r(gaps[Math.floor(gaps.length / 2)] ?? 0), gapWorst: r(gaps[gaps.length - 1] ?? 0), work: r(mean(f.map((x) => x.work))), solve: r(mean(f.map((x) => x.solve))), collide: r(mean(f.map((x) => x.collide))), draw: r(mean(f.map((x) => x.draw))) };
  });
};
const rest = await record(5000);
// Auto spin of the part, as the viewer's own address option does it.
const spinStarted = Date.now();
let spin: unknown = null;
if (part) {
  await page.goto(`${base}/?file=${encodeURIComponent(file)}&option=debug${LIBRARY}&autospin=${part}`);
  await page.waitForFunction(() => { const k = (window as any).kinebrick; return k && k.kin && k.kin.poses.length > 0; }, null, { timeout: 600_000 });
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    const w = window as any; const k = w.kinebrick;
    const time = (object: any, name: string, key: string) => { const original = object[name]; if (typeof original !== 'function') return; let depth = 0; object[name] = function (...a: unknown[]) { if (depth) return original.apply(this, a); depth++; const s = performance.now(); try { return original.apply(this, a); } finally { depth--; w.inFrame[key] += performance.now() - s; } }; };
    time(k.kin, 'turnJoint', 'solve'); time(k.kin, 'pushStepByTiers', 'solve'); time(k.setup, 'blockedBy', 'collide'); time(k.setup.renderer, 'render', 'draw');
  });
  spin = { ...(await record(15000)), running: await page.evaluate(() => (window as any).kinebrick.interaction.motorRunning?.()), secondsToStart: (Date.now() - spinStarted) / 1000 };
}
console.log(JSON.stringify({ file, loadSeconds, sizes, rest, spin }));
await browser.close();
