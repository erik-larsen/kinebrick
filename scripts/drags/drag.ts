// Drags in the viewer, as a user's pointer makes them, in a browser with no window (Playwright),
// for the scripts beside this one: one per function, each ending in yes or no on what moved.
// The viewer must be running; its address is the first argument, or preview's,
// http://localhost:5174. Not part of `npx vitest run`: all of them, with scripts/drags/all.ts.
//
// A part is found on the screen by where it is drawn: the pointer goes to the middle of it, and
// round it in rings, until the viewer marks that part as the one under it; where it was found on
// the part is kept, so the next time takes one try. Parts are measured as the check measures them: moved if
// they went at least 1 LDU or turned at least 1 degree (MOVED in check-functions.ts) against what
// they're measured against (the frame, unless another part is given).

import { chromium, type Browser, type Page } from 'playwright';

const MOVED = 1;

export type Viewer = {
  page: Page;
  browser: Browser;
  // Puts the pointer on `part`; false if it can't be seen from where the camera is.
  aim(part: number): Promise<boolean>;
  // Presses there (with Shift if `shift`), waits for any search for pins to end, and lets go if
  // `release`. Says what the viewer said and which pins are freed now.
  press(options?: { shift?: boolean; release?: boolean }): Promise<{ said: string[]; freed: number[] }>;
  // With the pointer pressed: moves it by (dx, dy) pixels, or round `part`'s middle by `turn`
  // radians on the screen, then waits until nothing moves; then lets go.
  push(dx: number, dy: number): Promise<void>;
  turn(part: number, turn: number): Promise<void>;
  // Where the parts are now, to compare with later (see moved).
  where(parts: number[]): Promise<number[][]>;
  // How far each part went, in LDU, and turned, in degrees, against `against` (a part of the
  // frame if -1; else one of `parts`), since `before` (from where(parts)).
  moved(parts: number[], before: number[][], against?: number): Promise<{ part: number; ldu: number; degrees: number; moved: boolean }[]>;
  // The pairs of parts whose collision stopped a motion since the last call.
  stops(): Promise<string[]>;
  // Puts the pointer on `part`, turning the camera round the model first if it can't be seen, as a
  // user would (up to 12 times): how many turns that took, or -1 if it still can't be seen.
  reach(part: number): Promise<number>;
  // Turns the camera round the model by dragging the pointer `dx` pixels across where no part is,
  // as a user orbits it. False if there was a part under every place tried.
  orbit(dx: number, dy?: number): Promise<boolean>;
  close(): Promise<void>;
};

// Where the viewer under test takes its parts from: the LDraw library in the viewer's own folder
// (ldraw/, which npm run dev serves), not the copy on the web. A browser with no window keeps
// nothing between runs, so every model opened fetched each of its parts again, and on 2026-11-20
// a day of sweeps brought the web copy to answer 429, too many requests, for everyone. Set
// KINEBRICK_WEB_LIBRARY=1 to test with the web copy all the same.
// How long reach() may look for a view of a part before it gives up, in ms (KB_REACH_S seconds).
export const REACH_MS = Number(process.env.KB_REACH_S ?? 300) * 1000;

export const LIBRARY = process.env.KINEBRICK_WEB_LIBRARY ? '' : '&library=/ldraw/';

// How the browser under test is launched. Without a window, Chromium draws WebGL in software
// (SwiftShader), and the viewer draws every frame: one browser took 3 to 4 of the Mac's cores to
// draw, idle or not, and a drag of the 9397's steering did 15 steps in 20 s against 59 with the
// graphics card (decision 273, 2026-11-21). On a Mac it draws with Metal: 0.2 of a core.
// KINEBRICK_SOFTWARE_GL=1 keeps the software drawing.
export const LAUNCH = {
  headless: true,
  args: process.platform === 'darwin' && !process.env.KINEBRICK_SOFTWARE_GL ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : [],
};

export async function open(file: string, settings = ''): Promise<Viewer> {
  const base = process.argv[2] ?? 'http://localhost:5174';
  const browser = await chromium.launch(LAUNCH);
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  await page.goto(`${base}/?file=${encodeURIComponent(file)}&option=debug${LIBRARY}${settings ? '&' + settings : ''}`);
  await page.waitForFunction(() => {
    const k = (window as any).kinebrick;
    return k && k.kin && k.kin.poses.length > 0;
  }, null, { timeout: 300_000 });
  await page.waitForTimeout(1000);
  // Every stop the viewer makes for a collision, kept for stops().
  await page.evaluate(() => {
    const k = (window as any).kinebrick;
    const w = window as any;
    w.stopsSeen = [];
    const blockedBy = k.setup.blockedBy;
    k.setup.blockedBy = () => {
      const hit = blockedBy();
      // A part against itself is the viewer's ground test (belowGround in collisions.ts: the part
      // would go below the ground), not a collision: named so (decision 299).
      if (hit && Array.isArray(hit)) w.stopsSeen.push(hit[0] === hit[1] ? `ground: p${hit[0]}` : hit.join('/'));
      return hit;
    };
  });
  // A part of the frame, what parts are measured against unless another is named.
  const framePart: number = await page.evaluate(() => (window as any).kinebrick.mech.bodyOf.indexOf(0));
  const viewerBefore = async (before: number[][], parts: number[], against: number) => {
    const i = parts.indexOf(against);
    if (i < 0) throw new Error(`p${against}, measured against, must be among the parts measured`);
    return before[i];
  };
  const found = new Map<number, [number, number]>();
  let at: [number, number] = [0, 0];
  let down = false;

  // Where `part`'s middle is drawn, in pixels.
  const middle = (part: number) =>
    page.evaluate((p) => {
      const k = (window as any).kinebrick;
      const camera = k.setup.camera;
      const v = camera.position.clone().set(0, 0, 0).applyMatrix4(k.matrices()[p]).applyMatrix4(k.setup.ldrawSpace.matrixWorld).project(camera);
      const r = k.setup.renderer.domElement.getBoundingClientRect();
      return [r.left + ((v.x + 1) / 2) * r.width, r.top + ((1 - v.y) / 2) * r.height] as [number, number];
    }, part);
  const label = () =>
    page.evaluate(() => [...document.querySelectorAll('div')].filter((d) => d.children.length === 0 && getComputedStyle(d).display !== 'none').map((d) => d.textContent ?? '').find((t) => t.includes(' · ') && !/ parts · /.test(t)) ?? '');
  const messages = () =>
    page.evaluate(() => [...document.querySelectorAll('div')].filter((d) => d.children.length === 0 && getComputedStyle(d).display !== 'none').map((d) => d.textContent ?? '').filter((t) => t.length < 200 && /pins|can't|jammed|Finding/i.test(t)));
  const freedNow = () => page.evaluate(() => (new URLSearchParams(location.search).get('free') ?? '').split(',').filter((s) => s).map(Number));
  // Waits until no part moves for a second, or `most` milliseconds.
  const settle = async (most = 30_000) => {
    const start = Date.now();
    let last = '';
    while (Date.now() - start < most) {
      await page.waitForTimeout(1000);
      const now = await page.evaluate(() => JSON.stringify((window as any).kinebrick.kin.jointAngles.map((a: number) => a.toFixed(4))));
      if (now === last) return;
      last = now;
    }
  };

  // Where the check grabs `part` besides its middle (grabOf in scripts/check-functions.ts): GRAB
  // LDU from it along each of the part's own axes, each way, drawn in pixels. Aimed at where the
  // middle is covered (the 42110's roof box lid, whose middle no view shows).
  const GRAB = 10;
  const grabPoints = (part: number) =>
    page.evaluate(({ p, grab }) => {
      const k = (window as any).kinebrick;
      const camera = k.setup.camera;
      const m = k.matrices()[p];
      const r = k.setup.renderer.domElement.getBoundingClientRect();
      const out: [number, number][] = [];
      for (const c of [0, 1, 2]) for (const way of [1, -1]) {
        const axis = camera.position.clone().setFromMatrixColumn(m, c).normalize().multiplyScalar(way * grab);
        const v = camera.position.clone().setFromMatrixPosition(m).add(axis).applyMatrix4(k.setup.ldrawSpace.matrixWorld).project(camera);
        out.push([r.left + ((v.x + 1) / 2) * r.width, r.top + ((1 - v.y) / 2) * r.height]);
      }
      return out;
    }, { p: part, grab: GRAB });

  const viewer: Viewer = {
    page,
    browser,
    async aim(part) {
      // The rings are tried in the page, with hover events only (the viewer marks the part under
      // the pointer, appearance.hoveredPart); then the pointer itself goes where it was found.
      const [x, y] = await middle(part);
      const kept = found.get(part) ?? null;
      // Rings round the middle; where none finds the part, rings round each grab point.
      const ringsAt = (cx: number, cy: number, keep: [number, number] | null) => page.evaluate(
        ({ p, x, y, kept }) => {
          const k = (window as any).kinebrick;
          const canvas = k.setup.renderer.domElement as HTMLCanvasElement;
          const tries: [number, number][] = kept ? [kept] : [];
          for (let ring = 0; ring <= 12; ring++) for (let n = 0; n < Math.max(1, ring * 8); n++) {
            const a = (2 * Math.PI * n) / Math.max(1, ring * 8);
            tries.push([ring * 4 * Math.cos(a), ring * 4 * Math.sin(a)]);
          }
          for (const [dx, dy] of tries) {
            canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: x + dx, clientY: y + dy, pointerId: 1, bubbles: true, pointerType: 'mouse', isPrimary: true }));
            if (k.setup.appearance.hoveredPart === p) return [dx, dy] as [number, number];
          }
          return null;
        },
        { p: part, x: cx, y: cy, kept: keep },
      );
      let hit: [number, number] | null = await ringsAt(x, y, kept);
      if (!hit) {
        for (const [gx, gy] of await grabPoints(part)) {
          const h = await ringsAt(gx, gy, null);
          if (h) { hit = [gx - x + h[0], gy - y + h[1]]; break; }
        }
      }
      if (!hit) return false;
      at = [x + hit[0], y + hit[1]];
      await page.mouse.move(at[0], at[1]);
      if ((await page.evaluate(() => (window as any).kinebrick.setup.appearance.hoveredPart)) !== part) return false;
      found.set(part, hit);
      return true;
    },
    async press({ shift = false, release = false } = {}) {
      if (shift) await page.keyboard.down('Shift');
      await page.mouse.move(at[0], at[1]);
      await page.mouse.down();
      down = true;
      if (shift) await page.keyboard.up('Shift');
      const said: string[] = [];
      for (let i = 0; i < 600; i++) {
        await page.waitForTimeout(100);
        const now = await messages();
        for (const m of now) if (!said.includes(m)) said.push(m);
        if (i > 3 && !now.some((m) => /Finding/.test(m))) break;
      }
      if (release) {
        await page.mouse.up();
        down = false;
      }
      return { said, freed: await freedNow() };
    },
    async push(dx, dy) {
      for (let i = 1; i <= 20; i++) await page.mouse.move(at[0] + (dx * i) / 20, at[1] + (dy * i) / 20);
      await settle();
      if (down) await page.mouse.up();
      down = false;
    },
    async turn(part, turn) {
      const [cx, cy] = await middle(part);
      const a0 = Math.atan2(at[1] - cy, at[0] - cx);
      const r = Math.max(40, Math.hypot(at[0] - cx, at[1] - cy));
      for (let i = 1; i <= 40; i++) {
        const a = a0 + (turn * i) / 40;
        await page.mouse.move(cx + r * Math.cos(a), cy + r * Math.sin(a));
      }
      await settle();
      if (down) await page.mouse.up();
      down = false;
    },
    async where(parts) {
      const all = [...parts, framePart];
      const m = await page.evaluate((ps) => {
        const every = (window as any).kinebrick.matrices();
        return ps.map((p: number) => every[p].elements.slice());
      }, all);
      return m;
    },
    async moved(parts, before, against = -1) {
      // `before` is from where(parts): the parts, then a part of the frame.
      const ref = against >= 0 ? against : framePart;
      const now = await viewer.where([...parts, ref]);
      const refBefore = against >= 0 ? (await viewerBefore(before, parts, against)) : before[before.length - 1];
      // (where() puts a part of the frame last: the reference is the one after `parts`.)
      const refNow = now[parts.length];
      return parts.map((part, i) => {
        // The part's place in its reference's frame, before and now.
        const a = relative(refBefore, before[i]);
        const b = relative(refNow, now[i]);
        const ldu = Math.hypot(b[12] - a[12], b[13] - a[13], b[14] - a[14]);
        let dot = 0;
        for (const c of [0, 1, 2]) for (const r of [0, 1, 2]) dot += a[4 * c + r] * b[4 * c + r];
        const degrees = (Math.acos(Math.max(-1, Math.min(1, (dot - 1) / 2))) * 180) / Math.PI;
        return { part, ldu: round(ldu), degrees: round(degrees), moved: ldu >= MOVED || degrees >= MOVED };
      });
    },
    async stops() {
      return page.evaluate(() => {
        const w = window as any;
        const seen = [...new Set<string>(w.stopsSeen)];
        w.stopsSeen = [];
        return seen;
      });
    },
    async reach(part) {
      // Round the model at the height the camera starts at, then from above and from below
      // (decision 279, item 4: the 8285's, 42078's and 42080's controls were seen from no point of
      // the first circle), each a turn of 12 steps; and from each, closer in (the mouse wheel).
      // At most REACH_MS in all: a part hidden from every side (the 42056's seat axles, inside
      // the seats' pin holes) took 37 minutes of rings round 72 views on a big model.
      const until = Date.now() + REACH_MS;
      let turns = 0;
      for (const tilt of [0, -150, 300]) {
        if (tilt && !(await viewer.orbit(0, tilt))) return -1;
        for (let i = 0; i < 12; i++, turns++) {
          if (Date.now() > until) return -1;
          if (await viewer.aim(part)) return turns;
          if (!(await viewer.orbit(120))) return -1;
        }
      }
      for (let zoom = 0; zoom < 3; zoom++) {
        if (Date.now() > until) return -1;
        const [x, y] = await middle(part);
        await page.mouse.move(x, y);
        await page.mouse.wheel(0, -400);
        await page.waitForTimeout(300);
        for (let i = 0; i < 12; i++, turns++) {
          if (Date.now() > until) return -1;
          if (await viewer.aim(part)) return turns;
          if (!(await viewer.orbit(120))) return -1;
        }
      }
      return -1;
    },
    async orbit(dx, dy = 0) {
      for (const [x, y] of [[985, 685], [15, 685], [985, 15], [15, 120]]) {
        await page.mouse.move(x, y);
        if ((await page.evaluate(() => (window as any).kinebrick.setup.appearance.hoveredPart)) >= 0) continue;
        await page.mouse.down();
        for (let i = 1; i <= 10; i++) await page.mouse.move(x - (dx * i) / 10, y - (dy * i) / 10);
        await page.mouse.up();
        await page.waitForTimeout(300);
        return true;
      }
      return false;
    },
    async close() {
      await browser.close();
    },
  };
  return viewer;
}

// What a function comes to by what moved, as the check has it: works if the control went at least
// half of `turned` (radians: as far as the check turned it) and every part it lists moved, partly
// if something moved (the control, or a part), no if nothing did.
export type Result = 'works' | 'partly' | 'no';
export function resultOf(control: { moved: boolean; degrees: number }, moved: { moved: boolean }[], turned: number): Result {
  const halfway = (turned / 2) * (180 / Math.PI);
  if (control.moved && control.degrees >= halfway && moved.every((m) => m.moved)) return 'works';
  return control.moved || moved.some((m) => m.moved) ? 'partly' : 'no';
}

// Whether the viewer shows at least what the check gives.
export const atLeast = (viewer: Result, check: Result) => ['no', 'partly', 'works'].indexOf(viewer) >= ['no', 'partly', 'works'].indexOf(check);

// Says the answer and ends: yes (exit 0) or no (exit 1), with what was seen and how long it took.
export function answer(yes: boolean, seen: string[], started: number): never {
  for (const line of seen) console.log(line);
  console.log(`${yes ? 'yes' : 'no'} (${Math.round((Date.now() - started) / 1000)} s)`);
  process.exit(yes ? 0 : 1);
}

const round = (x: number) => Math.round(x * 100) / 100;

// The matrix b in the frame of the matrix a (a rigid motion: inverse is the transpose and back).
function relative(a: number[], b: number[]): number[] {
  const out = new Array(16).fill(0);
  const inv = [a[0], a[4], a[8], 0, a[1], a[5], a[9], 0, a[2], a[6], a[10], 0, 0, 0, 0, 1];
  const t = [a[12], a[13], a[14]];
  inv[12] = -(inv[0] * t[0] + inv[4] * t[1] + inv[8] * t[2]);
  inv[13] = -(inv[1] * t[0] + inv[5] * t[1] + inv[9] * t[2]);
  inv[14] = -(inv[2] * t[0] + inv[6] * t[1] + inv[10] * t[2]);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) out[4 * c + r] += inv[4 * k + r] * b[4 * c + k];
  return out;
}
