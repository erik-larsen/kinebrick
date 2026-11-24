// Decision 305's proof: Shift on a part asks it to slide; a drag slides it; Shift again takes the
// slide back; a turn then goes as in a fresh page.
import { open } from './drag.ts';
(globalThis as any).__name = (f: unknown) => f;
const [, , , model, partArg] = process.argv;
const part = Number(partArg);
const ready = (v: any) => v.page.waitForFunction(`(document.getElementById('collision-note')?.textContent ?? '') === '' && !!window.kinebrick.collisions() && !window.kinebrick.collisions().waiting`, null, { timeout: 600_000 });
const turns = (v: any) => v.page.evaluate((p: number) => {
  const k = (window as any).kinebrick;
  const out: number[] = [];
  for (const a of [0.5, -0.5]) { const s = k.kin.snapshot(); out.push(+k.interaction.turnPart(p, a, k.setup.camera.position).toFixed(4)); k.kin.restore(s); }
  return out;
}, part);
const slid = (v: any) => v.page.evaluate((p: number) => ({ slid: ((window as any).kinebrick.mech.slid ?? []).includes(p), address: location.search.includes('slide=') }), part);
const v = await open(model);
await v.page.evaluate('window.__name = window.__name || ((f) => f)');
await ready(v);
const out: any = { fresh: await turns(v) };
out.seen = (await v.reach(part)) >= 0 && (await v.aim(part));
out.shift1 = (await v.press({ shift: true, release: true })).said;
await v.page.waitForFunction((p: number) => ((window as any).kinebrick.mech.slid ?? []).includes(p), part, { timeout: 120_000 }).catch(() => {});
out.afterShift1 = { ...(await slid(v)), turns: await turns(v) };
const at0 = await v.page.evaluate((p: number) => (window as any).kinebrick.matrices()[p].elements.slice(12, 15), part);
if (await v.aim(part)) { await v.press(); await v.push(0, -40); }
const at1 = await v.page.evaluate((p: number) => (window as any).kinebrick.matrices()[p].elements.slice(12, 15), part);
out.dragMovedLdu = +Math.hypot(at1[0] - at0[0], at1[1] - at0[1], at1[2] - at0[2]).toFixed(2);
if ((await v.reach(part)) >= 0 && (await v.aim(part))) out.shift2 = (await v.press({ shift: true, release: true })).said;
await v.page.waitForTimeout(3000);
out.afterShift2 = { ...(await slid(v)), turns: await turns(v) };
console.log(JSON.stringify(out));
await v.close();
