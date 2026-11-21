// Decision 300: the check's collision test, built as check-functions.ts builds it (collisionsNow),
// over the 42078's roof-gear turn: does it meet 466/1065, and if not, why (skipped as near or
// connected, or the shapes don't meet).
import { readFileSync } from 'node:fs';
import { loadModel, readParts } from '../load-model.ts';
import { partShapes } from '../part-shapes.ts';
import { Collisions, connectedPairs, pairNumber, keptFileName } from '../../src/collisions.ts';
const m = 'omr/42078-1 Mack Anthem.mpd';
const L = await loadModel(m, true);
const { mech, kin, parts } = L;
const shapes = await partShapes(m, readParts(m, true).text, parts);
const connected = connectedPairs(mech);
const near = JSON.parse(readFileSync(`data/collisions/${keptFileName(m)}.json`, 'utf-8')).near as [number, number][];
const built = parts.map((p) => p.matrix);
const c = new Collisions(parts.map((p, i) => (p.path ? [] : shapes[i].shape)), mech.bodyOf, connected, built, true);
const n = parts.length;
c.setNear(c.candidates(mech.bodyOf, connected, built), new Set(near.map(([a, b]) => pairNumber(a, b, n))), built, built);
c.ignored = new Set(mech.loose);
const placed = () => parts.map((p, i) => kin.poses[mech.bodyOf[i]].clone().multiply(p.matrix));
console.log(JSON.stringify({ connected_466_1065: connected.has('466,1065'), near_466_1065: near.some(([a, b]) => (a === 466 && b === 1065) || (a === 1065 && b === 466)), shapes466: shapes[466].shape.length, shapes1065: shapes[1065].shape.length, emptyFlags: [shapes[466].empty ?? null, shapes[1065].empty ?? null] }));
const body = mech.bodyOf[1146];
const link = kin.parentLink(body)!;
kin.holdWhatTheDragDoesntNeed(body, () => kin.jointMotion(link.joint) !== null, link.joint);
let turned = 0;
for (let i = 0; i < 20; i++) {
  turned += kin.turnJoint(link.joint, 0.01, () => true);
  const hit = c.check(placed());
  if (hit) { console.log(JSON.stringify({ hitAt: +turned.toFixed(3), hit })); break; }
}
kin.letGoAfterDrag();
console.log(JSON.stringify({ turned: +turned.toFixed(3) }));
