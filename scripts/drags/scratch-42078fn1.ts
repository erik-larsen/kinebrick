// Decision 300: the 42078's fn1 in the check's reading: is the cab's steering wheel p466 loose (a
// loose part never stops a motion), its body, and how its body moves as the roof gear p1146 turns.
import { loadModel } from '../load-model.ts';
const L = await loadModel('omr/42078-1 Mack Anthem.mpd', true);
const { mech, kin } = L;
const b = mech.bodyOf[466];
console.log(JSON.stringify({ loose466: mech.loose.includes(466), loose1065: mech.loose.includes(1065), loose872: mech.loose.includes(872), body: b, parentLink: kin.parentLink(b), looseOfBody: mech.bodyOf.flatMap((x, i) => (x === b ? [{ i, loose: mech.loose.includes(i) }] : [])) }));
{
  const body = mech.bodyOf[1146];
  const link = kin.parentLink(body)!;
  const joints = mech.joints.map((j, i) => ({ i, kind: j.kind, a: j.bodyA, b: j.bodyB })).filter((j) => j.a === b || j.b === b);
  const p0 = kin.poses[b].clone();
  kin.holdWhatTheDragDoesntNeed(body, () => kin.jointMotion(link.joint) !== null, link.joint);
  const went = kin.turnJoint(link.joint, 0.2, () => true);
  kin.letGoAfterDrag();
  const p1 = kin.poses[b];
  const e0 = p0.elements, e1 = p1.elements;
  const moved = Math.hypot(e1[12] - e0[12], e1[13] - e0[13], e1[14] - e0[14]);
  const d = p0.clone().invert().multiply(p1).elements;
  const deg = (Math.acos(Math.max(-1, Math.min(1, (d[0] + d[5] + d[10] - 1) / 2))) * 180) / Math.PI;
  console.log(JSON.stringify({ body67joints: joints, roofTurned: went, body67moved: +moved.toFixed(3), body67deg: +deg.toFixed(3) }));
}
