// Decision 267: the 8110's function 1, 17.7 s for one call of one step against 4.5 s a step. One
// call of turnPart by 0.035 rad from the start pose, three times (restored between), then the
// collision test alone, to see what of the first is set-up done once.
import { open } from './drag.ts';
(globalThis as any).__name = (f: unknown) => f;
const v = await open('omr/8110-1 Mercedes-Benz Unimog U 400.mpd');
await v.page.evaluate(() => { (window as any).__name = (f: unknown) => f; });
await v.page.waitForFunction(() => (window as any).kinebrick.collisions?.() != null, null, { timeout: 600_000 }).catch(() => {});
const r = await v.page.evaluate(() => {
  const k = (window as any).kinebrick;
  const out: Record<string, number> = {};
  const snap = k.kin.snapshot();
  for (const way of [1, 1, 1, -1, -1]) {
    const t = performance.now();
    k.interaction.turnPart(1504, way * 0.035, k.setup.camera.position);
    out[`call ${Object.keys(out).length + 1} (${way > 0 ? '+' : '-'})`] = Math.round(performance.now() - t);
    k.kin.restore(snap);
  }
  let t = performance.now();
  k.setup.blockedBy();
  out['collision test alone'] = Math.round(performance.now() - t);
  t = performance.now();
  const body = k.mech.bodyOf[1504];
  const link = k.kin.parentLink(body);
  k.kin.holdWhatTheDragDoesntNeed(body, () => k.kin.jointMotion(link.joint) !== null, link.joint);
  out['holds chosen alone'] = Math.round(performance.now() - t);
  k.kin.letGoAfterDrag();
  t = performance.now();
  k.kin.turnJoint(link.joint, 0.035, () => true, 0.035);
  out['one solver step alone, no holds, no collision test'] = Math.round(performance.now() - t);
  k.kin.restore(snap);
  return out;
});
console.log(JSON.stringify(r, null, 1));
await v.close();
