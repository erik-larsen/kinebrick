// What a real model's loose parts touch as built (see touchingFrom in collisions.ts, decision 259),
// read from its parts' shapes as the viewer and the check read them. Every test that infers the
// mechanism of a real model's file gives it this, so that it tests the mechanism the viewer has.
// A test on a hand-built model doesn't: its parts are all attached, or placed to show one rule.
import type { Touching } from '../src/collisions.ts';
import { touchingFrom } from '../src/collisions.ts';
import { partShapes } from '../scripts/part-shapes.ts';
import { readParts } from '../scripts/load-model.ts';

// `text` and `parts`: the model's text and parts as read, if the test has them (a set's file with
// its errata, see readParts), so that the shapes come one for each part.
export async function touchingOf(file: string, text?: string, parts?: { name: string; removed?: boolean; path?: unknown }[]): Promise<Touching> {
  // A path's parts (a chain's links) have no shape, as in the viewer (main.ts) and the collision pass.
  const paths = (parts ?? readParts(file, file.startsWith('omr/')).parts).map((p) => !!p.path);
  return touchingFrom((await partShapes(file, text, parts)).map((s, i) => (paths[i] ? [] : s.shape)));
}
