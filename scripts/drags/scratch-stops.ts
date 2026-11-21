// Item 2 of decision 279: for each held collision stop, turn the control in small steps from the
// start, each way, and at the first stop say which two parts meet, what they are, their bodies,
// how far each has moved from where it was built, and whether they were near as built.
import { readFileSync, writeFileSync } from 'node:fs';
import { open } from './drag.ts';
(globalThis as any).__name = (f: unknown) => f;
const list = JSON.parse(readFileSync(process.env.KB_STOPS!, 'utf8'));
const only = process.argv[3];
const out: any[] = [];
for (const f of list) {
  if (only && f.set !== only) continue;
  const v = await open(f.model, f.lifted ? 'lifted=1' : '');
  await v.page.evaluate(() => { (window as any).__name = (f: unknown) => f; });
  await v.page.waitForFunction(`(document.getElementById('collision-note')?.textContent ?? '') === '' && !!window.kinebrick.collisions() && !window.kinebrick.collisions().waiting`, null, { timeout: 600_000 });
  for (const control of f.controls) {
    const part = parseInt(control.slice(1));
    for (const way of [1, -1]) {
      const r = await v.page.evaluate(async ({ part, way, held, first }) => {
        const frame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r)));
        const k = (window as any).kinebrick;
        const w = window as any;
        const snap = k.kin.snapshot();
        for (const h of held) { const b = k.mech.bodyOf[parseInt(h.slice(1))]; if (!k.kin.isFrozen(b)) k.kin.toggleFreeze(b); }
        for (const fs of first) {
          const p = parseInt(fs.control.slice(1));
          const b = k.mech.bodyOf[p];
          const l = k.kin.parentLink(b);
          if (k.setup.slideOf?.(p) || !l) continue;
          k.kin.holdWhatTheDragDoesntNeed(b, () => k.setup.blockedBy() === null, l.joint);
          k.kin.turnJoint(l.joint, fs.by, () => k.setup.blockedBy() === null);
          k.kin.letGoAfterDrag();
          if (k.setup.shiftDue?.()) k.setup.onDragEnded();
        }
        await frame(); await frame();
        const body0 = k.mech.bodyOf[part];
        const knob = k.kin.turnsLikeAKnob(body0);
        const link0 = k.kin.parentLink(body0);
        const start = k.drawn();
        w.stopsSeen = [];
        let total = 0;
        const step = 0.01;
        let hit: number[] | null = null;
        for (let i = 0; i < 160; i++) {
          let went: number;
          if (knob) went = k.interaction.turnPart(part, way * step, k.setup.camera.position);
          else if (!link0) went = 0;
          else {
            const a0 = k.kin.jointValue ? k.kin.jointValue(link0.joint) : null;
            k.kin.holdWhatTheDragDoesntNeed(body0, () => k.setup.blockedBy() === null, link0.joint);
            const ok = k.kin.turnJoint(link0.joint, way * step, () => k.setup.blockedBy() === null);
            k.kin.letGoAfterDrag();
            went = typeof ok === 'number' ? ok : ok === false ? 0 : way * step;
          }
          total += went;
          if (w.stopsSeen.length) { hit = w.stopsSeen[w.stopsSeen.length - 1].split('/').map(Number); break; }
          if (Math.abs(went) < step * 0.1) break;
        }
        await frame(); await frame();
        const now = k.drawn();
        const desc = (p: number) => {
          const e = k.parts[p];
          const a = start[p].elements, b = now[p].elements;
          const moved = Math.hypot(b[12] - a[12], b[13] - a[13], b[14] - a[14]);
          const body = k.mech.bodyOf[p];
          const link = k.kin.parentLink(body);
          return { part: p, name: e?.name ?? e?.file ?? null, body, joint: link ? { joint: link.joint, kind: link.kind } : null, moved: +moved.toFixed(2), at: [a[12], a[13], a[14]].map((x: number) => +x.toFixed(1)) };
        };
        let near = null;
        const c = k.collisions();
        const V = k.setup.camera.position.constructor;
        const gap = (a: number, b: number, mats: any[]) => {
          let best: any = null;
          const bToA = mats[a].clone().invert().multiply(mats[b]);
          for (const ma of c.shapes[a].meshes) {
            const inv = ma.matrix.clone().invert();
            for (const mb of c.shapes[b].meshes) {
              const toA = inv.clone().multiply(bToA).multiply(mb.matrix);
              if (ma.bvh.intersectsGeometry(mb.geometry, toA)) return { d: 0 };
              const h = () => ({ point: new V(), distance: 0, faceIndex: 0 });
              const r = ma.bvh.closestPointToGeometry(mb.geometry, toA, h(), h(), 0, 200);
              if (r && (!best || r.distance < best.d)) {
                const pa = r.point.clone().applyMatrix4(ma.matrix);
                best = { d: +r.distance.toFixed(2), onA: [pa.x, pa.y, pa.z].map((x: number) => +x.toFixed(1)) };
              }
            }
          }
          return best;
        };
        let gaps = null;
        if (hit && c?.nearNow) {
          near = c.nearNow(hit[0], hit[1], start);
          gaps = { built: gap(hit[0], hit[1], start), atStop: gap(hit[0], hit[1], now), atStopFromB: gap(hit[1], hit[0], now) };
        }
        let rel = null;
        if (hit) {
          const [a, b] = hit;
          const r0 = start[a].clone().invert().multiply(start[b]);
          const r1 = now[a].clone().invert().multiply(now[b]);
          const e0 = r0.elements, e1 = r1.elements;
          const shift = Math.hypot(e1[12] - e0[12], e1[13] - e0[13], e1[14] - e0[14]);
          // the angle of the relative turn
          const d = r0.clone().invert().multiply(r1).elements;
          const tr = Math.min(1, Math.max(-1, (d[0] + d[5] + d[10] - 1) / 2));
          rel = { shift: +shift.toFixed(2), deg: +((Math.acos(tr) * 180) / Math.PI).toFixed(1), originGap: +Math.hypot(e0[12], e0[13], e0[14]).toFixed(1) };
        }
        const res = { way, knob, link: !!link0, gaps, rel, turned: +total.toFixed(3), hit: hit ? hit.map(desc) : null, nearAsBuilt: near, controlBody: k.mech.bodyOf[part], keys: Object.keys(k.parts[0] ?? {}) };
        k.kin.restore(snap);
        await frame(); await frame();
        for (const h of held) { const b = k.mech.bodyOf[parseInt(h.slice(1))]; if (k.kin.isFrozen(b)) k.kin.toggleFreeze(b); }
        return res;
      }, { part, way, held: f.held, first: f.first });
      out.push({ set: f.set, fn: f.fn, control, ...r });
      writeFileSync(process.env.KB_STOPS_OUT!, JSON.stringify(out, null, 1));
      console.log(JSON.stringify(out[out.length - 1]));
    }
  }
  await v.close();
}
writeFileSync(process.env.KB_STOPS_OUT!, JSON.stringify(out, null, 1));
