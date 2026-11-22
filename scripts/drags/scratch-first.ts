// Decision 267 (e): why the sweep can't do a function's first step. For each, the control's body,
// its parent link, and what turnPart does by `by` (the joint's angle before and after, any stop).
import { readFileSync } from 'node:fs';
import { open } from './drag.ts';
(globalThis as any).__name = (f: unknown) => f;
const cases: [string, number][] = [['42054-1', 3], ['42054-1', 4], ['8258-1', 5], ['8110-1', 7]];
for (const [set, fn] of cases) {
  const s = JSON.parse(readFileSync(`data/sets/${set}.json`, 'utf-8'));
  const c = s.curated.functions[fn - 1];
  const v = await open(c.model ?? s.curated.model);
  await v.page.evaluate(() => { (window as any).__name = (f: unknown) => f; });
  await v.page.waitForFunction(() => (window as any).kinebrick.collisions?.() != null, null, { timeout: 600_000 }).catch(() => {});
  for (const f of c.first) {
    const part = Number(/^p(\d+)/.exec(f.control)![1]);
    const r = await v.page.evaluate(({ part, by }) => {
      const k = (window as any).kinebrick;
      const body = k.mech.bodyOf[part];
      const link = k.kin.parentLink(body);
      const slide = k.setup.slideOf?.(part);
      const a0 = link ? k.kin.jointAngles[link.joint] : null;
      const m0 = k.matrices()[part].clone();
      const went = k.interaction.turnPart(part, by, k.setup.camera.position);
      const a1 = link ? k.kin.jointAngles[link.joint] : null;
      const m1 = k.matrices()[part];
      const d = Math.hypot(m1.elements[12] - m0.elements[12], m1.elements[13] - m0.elements[13], m1.elements[14] - m0.elements[14]);
      const blocked = k.setup.blockedBy?.();
      const motion = link ? k.kin.jointMotion(link.joint) !== null : null;
      return { body, role: k.mech.roles[part], link: link ? { joint: link.joint, kind: k.mech.joints[link.joint].kind } : null, frozen: k.kin.isFrozen(body), slide: !!slide, a0, a1, went, movedLdu: d, blocked: blocked ? String(blocked).slice(0, 120) : null, motion };
    }, { part, by: f.by });
    console.log(set, fn, f.control, f.by, JSON.stringify(r));
  }
  await v.close();
}
