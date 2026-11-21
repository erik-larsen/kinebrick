// Decision 294: two parts that a turn brings together. Where each is as built, its body, the
// joint its body turns on (axis), and the parts on the same axle line; and the gap between them.
import { loadModel } from '../load-model.ts';
import { Vector3 } from 'three';
const [model, ...ids] = process.argv.slice(2);
const L = await loadModel(model, model.startsWith('omr/'));
const { mech, kin, parts } = L;
const fmt = (v: Vector3) => v.toArray().map((x) => +x.toFixed(1));
for (const id of ids.map(Number)) {
  const b = mech.bodyOf[id];
  const link = kin.parentLink(b);
  const j = link ? mech.joints[link.joint] : null;
  const m = parts[id].matrix;
  const pos = new Vector3().setFromMatrixPosition(m);
  const axes = [0, 1, 2].map((k) => fmt(new Vector3().setFromMatrixColumn(m, k).normalize()));
  let onAxis = null;
  if (j) {
    const from = j.from.clone().applyMatrix4(kin.poses[link!.parent]), to = j.to.clone().applyMatrix4(kin.poses[link!.parent]);
    const dir = to.clone().sub(from).normalize();
    const off = pos.clone().sub(from); const dist = off.clone().sub(dir.clone().multiplyScalar(off.dot(dir))).length();
    onAxis = { kind: j.kind, from: fmt(from), to: fmt(to), distFromAxis: +dist.toFixed(2) };
  }
  const bodyParts = mech.bodyOf.flatMap((x, i) => (x === b ? [`${i} ${parts[i].name}`] : [])).slice(0, 12);
  console.log(JSON.stringify({ id, name: parts[id].name, pos: fmt(pos), axes, body: b, joint: onAxis, bodyParts }));
}
