// The 42078's lock bar p2641 asked to slide, as the check reads it: its body, its parent link and
// whether its slide has a motion, to set beside the viewer's (body 292, no parent link, no motion).
import { loadModel } from '../load-model.ts';
const m = 'omr/42078-1 Mack Anthem.mpd';
const loaded = await loadModel(m, true);
const r = loaded.read(loaded.parts, new Set(), new Set([2641]));
const { mech, kin } = r;
const body = mech.bodyOf[2641];
const joints = mech.joints.map((j, i) => ({ i, kind: j.kind, a: j.bodyA, b: j.bodyB, asked: !!(j as any).asked })).filter((j) => j.a === body || j.b === body);
const slide = joints.find((j) => j.kind === 'slide' && j.asked);
console.log(JSON.stringify({
  slid: mech.slid, why: (mech as any).slideWhy?.[2641] ?? null, body,
  parts: mech.bodyOf.flatMap((b, i) => (b === body ? [`${i} ${loaded.parts[i].name}`] : [])),
  parentLink: kin.parentLink(body), joints,
  motion: slide ? kin.jointMotion(slide.i) !== null : null,
  frames: (mech as any).frames ?? null,
}, null, 1));
// The check's own slide (slidePart), on this reading, with no collision test: how far it goes.
import { slidePart } from '../../src/slide.ts';
import { Vector3 } from 'three';
let cur = r;
const place = (i: number) => {
  const mm = cur.kin.poses[cur.mech.bodyOf[i]].clone().multiply(cur.parts[i].matrix);
  return { position: new Vector3().setFromMatrixPosition(mm), axes: [0, 1, 2].map((k) => new Vector3().setFromMatrixColumn(mm, k).normalize()) };
};
const placedNow = () => cur.parts.map((p, i) => ({ ...p, matrix: cur.kin.poses[cur.mech.bodyOf[i]].clone().multiply(p.matrix) }));
const res = slidePart(() => ({ kin: cur.kin, mech: cur.mech, place }), () => { cur = loaded.read(placedNow(), new Set(), new Set([2641])); }, 2641, -25, () => true);
console.log('slidePart:', JSON.stringify(res));
// The bare push, as the sweep's page probe did it, on a fresh reading.
import { pushStep, pointDirections } from '../../src/push.ts';
{
  const r2 = loaded.read(loaded.parts, new Set(), new Set([2641]));
  const b = r2.mech.bodyOf[2641];
  const j = r2.mech.joints.find((x: any) => x.kind === 'slide' && x.asked && (x.bodyA === b || x.bodyB === b))!;
  const other = j.bodyA === b ? j.bodyB : j.bodyA;
  const axis = j.to.clone().sub(j.from).normalize().transformDirection(r2.kin.poses[other]);
  const mm = r2.kin.poses[b].clone().multiply(r2.parts[2641].matrix);
  const own = [0, 1, 2].map((k) => new Vector3().setFromMatrixColumn(mm, k).normalize());
  const ka = own.reduce((best, v, i) => (Math.abs(v.dot(axis)) > Math.abs(own[best].dot(axis)) ? i : best), 0);
  const dir = axis.clone().multiplyScalar(Math.sign(own[ka].dot(axis)) * -1);
  const start = new Vector3().setFromMatrixPosition(mm);
  const grab = start.clone().applyMatrix4(r2.kin.poses[b].clone().invert());
  const d = pointDirections(r2.kin, b, start);
  const results: string[] = [];
  for (let i = 0; i < 3; i++) results.push(pushStep(r2.kin, b, grab, dir.clone(), 1, () => true));
  const sh = r2.mech.joints.map((x: any, i: number) => ({ i, a: x.bodyA, b: x.bodyB, kind: x.kind, asked: !!x.asked, sh: x.springHeld })).filter((x) => x.sh !== undefined && (x.a === b || x.b === b || x.a === 293 || x.b === 293));
  console.log('springHeld near:', JSON.stringify(sh));
  for (const x of r2.mech.joints as any[]) if (x.asked && x.springHeld && (x.bodyA === b || x.bodyB === b)) x.springHeld = false;
  const after: string[] = [];
  for (let i = 0; i < 3; i++) after.push(pushStep(r2.kin, b, grab, dir.clone(), 1, () => true));
  console.log('after letting go:', JSON.stringify(after), 'motion now', r2.kin.jointMotion(r2.mech.joints.indexOf(j)) !== null);
  console.log('bare push, no holds:', JSON.stringify({ d, dir: dir.toArray().map((x) => +x.toFixed(3)), results }));
}
