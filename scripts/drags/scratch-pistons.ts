// Decision 303: the 42112's four pistons (upright axles 4519 with bushes over the camshaft): each
// one's bottom bush as built, the cam (a 60483 end) under it at the built angle, and the gap.
import { loadModel } from '../load-model.ts';
import { Vector3 } from 'three';
const m = 'omr/42112-1 Concrete Mixer Truck.mpd';
const L = await loadModel(m, true);
const { mech, parts } = L;
const pos = (i: number) => new Vector3().setFromMatrixPosition(parts[i].matrix);
const col = (i: number, k: number) => new Vector3().setFromMatrixColumn(parts[i].matrix, k).normalize();
const cams = [134, 135, 136, 137];
for (let i = 165; i <= 185; i++) {
  if (parts[i].name !== '4519.dat') continue;
  const b = mech.bodyOf[i];
  const own = mech.bodyOf.flatMap((x, j) => (x === b ? [j] : []));
  const bushes = own.filter((j) => /^(3713|32123[ab])\.dat$/.test(parts[j].name)).map((j) => ({ j, name: parts[j].name, y: +pos(j).y.toFixed(1) }));
  const a = pos(i);
  // The cam under it: the 60483 whose holes are on this axle's line (same x, z), and where its holes are.
  const under = cams.map((c) => ({ c, at: pos(c), x: col(c, 0), y: col(c, 1), z: col(c, 2) })).filter((c) => Math.abs(c.at.z - a.z) < 15);
  console.log(JSON.stringify({ axle: i, at: [a.x, a.y, a.z].map((v) => +v.toFixed(1)), body: b, rest: mech.rests.some((r) => r.body === b), bushes, cams: under.map((c) => ({ c: c.c, origin: [c.at.x, c.at.y, c.at.z].map((v) => +v.toFixed(1)), axisX: [c.x.x, c.x.y, c.x.z].map((v) => +v.toFixed(2)) })) }));
}
