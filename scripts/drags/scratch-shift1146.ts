// Decision 302: the 42078's roof gear p1146 with Shift, as a user presses it: once before any
// turn, and once after the turn stops at 0.07 rad. What the viewer says and frees, and how far a
// turn then goes, with what stops it.
import { open } from './drag.ts';
(globalThis as any).__name = (f: unknown) => f;
const control = 1146;
const turn = (v: any, a: number) => v.page.evaluate(({ c, a }) => { const k = (window as any).kinebrick; return k.interaction.turnPart(c, a, k.setup.camera.position); }, { c: control, a });
const freed = (v: any) => v.page.evaluate(() => { const k = (window as any).kinebrick; return k.mech.joints.length; });
const ready = (v: any) => v.page.waitForFunction(`(document.getElementById('collision-note')?.textContent ?? '') === '' && !!window.kinebrick.collisions() && !window.kinebrick.collisions().waiting`, null, { timeout: 600_000 });
const out: any = {};
for (const when of ['before']) {
  const v = await open('omr/42078-1 Mack Anthem.mpd');
  await v.page.evaluate('window.__name = window.__name || ((f) => f)');
  await ready(v);
  const r: any = {};
  if (when === 'after the stop') { r.first = await turn(v, 1.5); r.firstStops = await v.stops(); }
  r.seen = (await v.reach(control)) >= 0 && (await v.aim(control));
  const joints0 = await freed(v);
  if (r.seen) {
    const p = await v.press({ shift: true, release: true });
    r.said = p.said; r.freedPins = p.freed;
    await v.page.waitForTimeout(30000);
    await ready(v);
    r.state = await v.page.evaluate((c) => { const k = (window as any).kinebrick; const b = k.mech.bodyOf[c]; return { slid: k.mech.slid ?? null, link: k.kin.parentLink(b), knob: k.kin.turnsLikeAKnob(b), frozen: [...k.kin.frozen], motion: k.kin.parentLink(b) ? k.kin.jointMotion(k.kin.parentLink(b).joint) !== null : null, notes: [...document.querySelectorAll('.message, #message, .toast')].map((e: any) => e.textContent).slice(-3) }; }, control);
  }
  r.jointsBefore = joints0; r.jointsAfter = await freed(v);
  r.thenPlus = await turn(v, 1.5); r.stopsPlus = await v.stops();
  r.thenMinus = await turn(v, -3); r.stopsMinus = await v.stops();
  out[when] = r;
  await v.close();
}
console.log(JSON.stringify(out, null, 1));
