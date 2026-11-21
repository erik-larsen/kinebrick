// The 42078's lock bar p2641 slid by the check's slidePart with the check's own collision test
// (built as collisionsNow builds it): how far it goes, and what stops it; and whether the pair
// 2639/2645 is skipped (near as built, or connected).
import { readFileSync } from 'node:fs';
import { Vector3 } from 'three';
import { loadModel, readParts } from '../load-model.ts';
import { partShapes } from '../part-shapes.ts';
import { Collisions, connectedPairs, pairNumber, keptFileName } from '../../src/collisions.ts';
import { slidePart } from '../../src/slide.ts';
const m = 'omr/42078-1 Mack Anthem.mpd';
const L = await loadModel(m, true);
const shapes = await partShapes(m, readParts(m, true).text, L.parts);
const near = JSON.parse(readFileSync(`data/collisions/${keptFileName(m)}.json`, 'utf-8')).near as [number, number][];
const built = L.parts.map((p) => p.matrix);
const n = L.parts.length;
const FREED = new Set<number>(JSON.parse(process.env.KB_FREED ?? '[]'));
let cur = L.read(L.parts, FREED, new Set([2641]));
const mk = () => {
  const connected = connectedPairs(cur.mech);
  const c = new Collisions(L.parts.map((p, i) => (p.path ? [] : shapes[i].shape)), cur.mech.bodyOf, connected, built, true);
  c.setNear(c.candidates(cur.mech.bodyOf, connected, built), new Set(near.map(([a, b]) => pairNumber(a, b, n))), built, built);
  c.ignored = new Set(cur.mech.loose);
  return { c, connected };
};
let { c, connected } = mk();
console.log(JSON.stringify({ near_2639_2645: near.some(([a, b]) => (a === 2639 && b === 2645) || (a === 2645 && b === 2639)), connected_2639_2645: connected.has('2639,2645'), bodies: [cur.mech.bodyOf[2639], cur.mech.bodyOf[2645]], loose: [cur.mech.loose.includes(2639), cur.mech.loose.includes(2645)] }));
const placedNow = () => cur.parts.map((p, i) => ({ ...p, matrix: cur.kin.poses[cur.mech.bodyOf[i]].clone().multiply(p.matrix) }));
const place = (i: number) => { const mm = cur.kin.poses[cur.mech.bodyOf[i]].clone().multiply(cur.parts[i].matrix); return { position: new Vector3().setFromMatrixPosition(mm), axes: [0, 1, 2].map((k) => new Vector3().setFromMatrixColumn(mm, k).normalize()) }; };
let met: number[] | null = null;
const allowed = () => { const hit = c.check(placedNow().map((p) => p.matrix)); if (hit) met = hit; return !hit && cur.kin.atLimit() === null; };
const res = slidePart(() => ({ kin: cur.kin, mech: cur.mech, place }), () => { cur = L.read(placedNow(), FREED, new Set([2641])); ({ c, connected } = mk()); }, 2641, -25, allowed);
console.log(JSON.stringify({ slidePart: res, met }));
