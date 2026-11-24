// Decision 296's proof: the 42078's lock bars slid as a user slides them, by the pointer: Shift
// pressed on the bar (it asks to slide), then dragged 25 LDU along its slide on screen. Then each
// door (p2631, p2665) dragged with the pointer. How far each bar went, and whether the doors turn.
import { open } from './drag.ts';
(globalThis as any).__name = (f: unknown) => f;
const v = await open('omr/42078-1 Mack Anthem.mpd');
await v.page.evaluate('window.__name = window.__name || ((f) => f)');
await v.page.waitForFunction(`(document.getElementById('collision-note')?.textContent ?? '') === '' && !!window.kinebrick.collisions() && !window.kinebrick.collisions().waiting`, null, { timeout: 600_000 });
const out: any = {};
for (const [bar, by] of [[2641, -25], [2675, -25]] as [number, number][]) {
  const seen = (await v.reach(bar)) >= 0 && (await v.aim(bar));
  if (!seen) { out[bar] = 'not seen'; continue; }
  const said = (await v.press({ shift: true, release: true })).said;
  // Shift on a part held by friction pins first looks for them; only where none hold it does the
  // viewer ask it to slide (slidesOnAxle). Wait for that, as a user waits for the message.
  const asked = await v.page.waitForFunction((bar) => ((window as any).kinebrick.mech.slid ?? []).includes(bar), bar, { timeout: 120_000 }).then(() => true).catch(() => false);
  if (!asked) {
    // A second Shift press, as a user tries again once the pins are freed.
    if (await v.aim(bar)) said.push(...(await v.press({ shift: true, release: true })).said);
  }
  const askedNow = await v.page.evaluate((bar) => ((window as any).kinebrick.mech.slid ?? []).includes(bar), bar);
  // The slide's way on screen, from the asked slide joint and the bar's own axis (as slidePart).
  const geo = await v.page.evaluate(({ bar, by }) => {
    const k = (window as any).kinebrick;
    const body = k.mech.bodyOf[bar];
    const j = k.mech.joints.find((x: any) => x.kind === 'slide' && x.asked && (x.bodyA === body || x.bodyB === body));
    if (!j) return null;
    const other = j.bodyA === body ? j.bodyB : j.bodyA;
    const V = k.setup.camera.position.constructor;
    const axis = j.to.clone().sub(j.from).normalize().transformDirection(k.kin.poses[other]);
    const m = k.matrices()[bar];
    const own = [0, 1, 2].map((c: number) => new V().setFromMatrixColumn(m, c).normalize());
    const ka = own.reduce((b: number, x: any, i: number) => (Math.abs(x.dot(axis)) > Math.abs(own[b].dot(axis)) ? i : b), 0);
    const dir = axis.clone().multiplyScalar(Math.sign(own[ka].dot(axis)) * Math.sign(by));
    const start = new V().setFromMatrixPosition(m);
    const toWorld = (p: any) => p.clone().applyMatrix4(k.setup.ldrawSpace.matrixWorld);
    const canvas = k.setup.renderer.domElement.getBoundingClientRect();
    const px = (p: any) => { const q = toWorld(p).project(k.setup.camera); return [canvas.left + ((q.x + 1) / 2) * canvas.width, canvas.top + ((1 - q.y) / 2) * canvas.height]; };
    const a = px(start), b = px(start.clone().addScaledVector(dir, Math.abs(by)));
    (window as any).slideProbe = { start: start.toArray(), dir: dir.toArray() };
    return { dx: b[0] - a[0], dy: b[1] - a[1] };
  }, { bar, by });
  if (!geo) { out[bar] = { said, askedNow, slide: 'no asked slide' }; continue; }
  await v.aim(bar);
  await v.press();
  await v.push(geo.dx, geo.dy);
  const went = await v.page.evaluate((bar) => {
    const k = (window as any).kinebrick;
    const p = (window as any).slideProbe;
    const e = k.matrices()[bar].elements;
    return [e[12] - p.start[0], e[13] - p.start[1], e[14] - p.start[2]].reduce((s: number, x: number, i: number) => s + x * p.dir[i], 0);
  }, bar);
  out[bar] = { said, askedNow, screen: [Math.round(geo.dx), Math.round(geo.dy)], wentLdu: +went.toFixed(2), stops: await v.stops() };
}
// The doors, dragged by the pointer as the sweep's part B does: the most each turned against what
// the list measures it against (p2619, p2620), in degrees, over the four pushes.
const rel = (d: number, a: number) => v.page.evaluate(({ d, a }) => { const k = (window as any).kinebrick; const m = k.matrices(); return m[a].clone().invert().multiply(m[d]).toArray(); }, { d, a });
const angle = (x: number[], y: number[]) => {
  // the angle of y's turn against x's, from their 3x3 parts (column-major arrays)
  const t = [0, 1, 2].reduce((s, i) => s + [0, 1, 2].reduce((u, r) => u + x[4 * i + r] * y[4 * i + r], 0), 0);
  return (Math.acos(Math.max(-1, Math.min(1, (t - 1) / 2))) * 180) / Math.PI;
};
for (const [door, against] of [[2631, 2619], [2665, 2620]] as [number, number][]) {
  const seen = (await v.reach(door)) >= 0 && (await v.aim(door));
  if (!seen) { out[door] = 'not seen'; continue; }
  const before = await rel(door, against);
  let most = 0;
  for (const [dx, dy] of [[120, 0], [-120, 0], [0, 120], [0, -120]]) {
    if (!(await v.aim(door))) continue;
    await v.press();
    await v.push(dx, dy);
    most = Math.max(most, angle(before, await rel(door, against)));
  }
  out[door] = { mostDeg: +most.toFixed(1), stops: await v.stops() };
}
console.log(JSON.stringify(out, null, 1));
await v.close();
