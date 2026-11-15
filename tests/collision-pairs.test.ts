import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { Box3 } from 'three';
import { describe, expect, it } from 'vitest';
import { collisionKey, Collisions, connectedPairs, libraryRelease, NEAR, shapesNear } from '../src/collisions.ts';
import { DIR, keptModels, keptName, modelText, RELEASE_FILE } from '../scripts/collision-pairs.ts';
import { loadModel } from '../scripts/load-model.ts';
import { partShapes } from '../scripts/part-shapes.ts';

// The kept results of the viewer's first collision pass (npm run collisions) are filed under a
// key made from what they depend on: a kept file whose model or library has changed since is
// stale, and the viewer would ignore it, doing the pass itself.
describe('the kept collision pass', () => {
  const release = libraryRelease(readFileSync('ldraw/LDConfig.ldr', 'utf-8'));
  it('is for the parts library as it is', () => {
    expect(JSON.parse(readFileSync(RELEASE_FILE, 'utf-8')).release).toBe(release);
  });
  const byName = new Map(keptModels().map((m) => [keptName(m), m]));
  for (const file of readdirSync(DIR).filter((f) => f.endsWith('.json') && f !== 'library.json')) {
    const model = byName.get(file.replace(/\.json$/, ''));
    it.skipIf(!model || !existsSync(model))(`has a key that matches its model: ${file}`, async () => {
      const kept = JSON.parse(readFileSync(`${DIR}/${file}`, 'utf-8'));
      expect(kept.key).toBe(await collisionKey(modelText(model!), release));
    });
  }
});

// The pass finds the pairs whose boxes meet by sorting them (see meetingPairs), not by trying
// every pair: on real models it must watch the very pairs the old way did.
describe('the first collision pass on real models', () => {
  for (const model of ['models/854-Go Kart.mpd', 'models/8845-Dune Buggy.mpd', 'omr/8838-1 Shock Cycle.mpd']) {
    it.skipIf(!existsSync(model))(`watches the same pairs as trying every pair: ${model}`, async () => {
      const { parts, mech } = loadModel(model, model.startsWith('omr/'));
      const shapes = (await partShapes(model, modelText(model))).slice(0, parts.length).map((s, i) => (parts[i].path ? [] : s.shape));
      const placed = parts.map((p) => p.matrix);
      const connected = connectedPairs(mech);
      const sorted = new Collisions(shapes.map((list) => list.map((m) => ({ geometry: m.geometry.clone(), matrix: m.matrix.clone() }))), mech.bodyOf, connected, placed);
      // The old way: every pair on different bodies, not connected, near by its box and its meshes.
      const old = new Collisions(shapes, mech.bodyOf, new Set(), placed, true) as unknown as { shapes: { box: Box3; meshes: never[] }[] };
      let watched = 0;
      for (let a = 0; a < parts.length; a++) {
        for (let b = a + 1; b < parts.length; b++) {
          if (mech.bodyOf[a] === mech.bodyOf[b] || connected.has(`${a},${b}`)) continue;
          const boxA = old.shapes[a].box.clone().applyMatrix4(placed[a]).expandByScalar(NEAR);
          const boxB = old.shapes[b].box.clone().applyMatrix4(placed[b]);
          const near = boxA.intersectsBox(boxB) && shapesNear(old.shapes[a] as never, old.shapes[b] as never, placed[a].clone().invert().multiply(placed[b]));
          if (!near) watched++;
        }
      }
      expect(sorted.watchedPairs).toBe(watched);
    }, 120000);
  }
});


