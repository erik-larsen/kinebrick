// Pictures of the models for their cards in the README: media/thumbs/<model>.webp, named after
// the model's file in lower case, with dashes for spaces ("956-Auto Chassis" makes
// 956-auto-chassis.webp). Serves the viewer with Vite, opens each model in Chrome, out of
// sight, with ?thumb, and saves the picture the page takes of itself (see src/thumbnail.ts),
// driving Chrome through its DevTools protocol.
//
// Needs Google Chrome (or set CHROME to another Chrome or Chromium program).
// Run with: npm run thumbs (every model in models/), or for some: npm run thumbs -- "956-Auto Chassis"

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';

const MODELS_DIR = 'models';
const OUT_DIR = 'media/thumbs';
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const TIMEOUT = 120_000; // ms to wait for a model to load and picture itself (the 8880 takes about 25 s)

const all = readdirSync(MODELS_DIR)
  .filter((f) => /\.(ldr|mpd)$/.test(f))
  .map((f) => f.replace(/\.(ldr|mpd)$/, ''));
const models = process.argv.length > 2 ? process.argv.slice(2) : all;
for (const m of models) if (!all.includes(m)) throw new Error(`no model ${m} in ${MODELS_DIR}/`);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// The viewer, served as npm run dev serves it, on a free port.
const server = await createServer({ logLevel: 'error', server: { port: 5199 } });
await server.listen();
const site = server.resolvedUrls!.local[0];

// Chrome, out of sight, at twice the pixels of a 960 x 720 window (so the picture, a part of
// the view scaled down, stays sharp). It says which port it listens on in DevToolsActivePort.
const profile = mkdtempSync(join(tmpdir(), 'kinebrick-thumbs-'));
const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--window-size=960,720', '--force-device-scale-factor=2', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
let port = '';
for (let i = 0; i < 100 && !port; i++) {
  await sleep(100);
  const file = join(profile, 'DevToolsActivePort');
  if (existsSync(file)) port = readFileSync(file, 'utf-8').split('\n')[0];
}
if (!port) throw new Error(`Chrome didn't start (${CHROME}; set CHROME to where it is)`);

mkdirSync(OUT_DIR, { recursive: true });
let failed = 0;
try {
  for (const model of models) {
    const start = Date.now();
    const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
    const page = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve) => (page.onopen = resolve));
    // DevTools commands, each answered by a message with the same id.
    let lastId = 0;
    const waiting = new Map<number, (result: any) => void>();
    page.onmessage = (e) => {
      const message = JSON.parse(e.data);
      waiting.get(message.id)?.(message.result);
      waiting.delete(message.id);
    };
    const send = (method: string, params = {}): Promise<any> =>
      new Promise((resolve) => {
        waiting.set(++lastId, resolve);
        page.send(JSON.stringify({ id: lastId, method, params }));
      });
    const evaluate = async (expression: string) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.value;

    await send('Page.navigate', { url: `${site}?model=${encodeURIComponent(model)}&thumb` });
    let picture: string | undefined;
    while (Date.now() - start < TIMEOUT) {
      await sleep(250);
      if (await evaluate('window.kinebrickThumbnail !== undefined')) {
        picture = await evaluate('window.kinebrickThumbnail');
        break;
      }
      const summary = await evaluate("document.getElementById('summary')?.textContent ?? ''");
      if (typeof summary === 'string' && summary.startsWith('Error')) break;
    }
    page.close();
    await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`);

    const file = join(OUT_DIR, `${model.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.webp`);
    if (picture?.startsWith('data:image/webp;base64,')) {
      writeFileSync(file, Buffer.from(picture.split(',')[1], 'base64'));
      console.log(`${file} (${Math.round((Date.now() - start) / 1000)} s)`);
    } else {
      console.log(`${model}: no picture`);
      failed++;
    }
  }
} finally {
  const exited = new Promise((resolve) => chrome.once('exit', resolve));
  chrome.kill();
  await exited;
  await server.close();
  rmSync(profile, { recursive: true, force: true, maxRetries: 5 });
}
if (failed) process.exit(1);
