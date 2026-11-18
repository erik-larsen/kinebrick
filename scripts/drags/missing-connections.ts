// The pairs the collision sorting found meeting at the first step for want of a joint (decision 197):
// a half shaft held at its wheel end by nothing, so it swung into what was beside it. For each set,
// each of the function's controls (or the one named) is turned a quarter turn one way and back, and
// the viewer's collision stops are kept, and how far the parts watched went at the far end. Yes if none of them is between the pair's
// parts, and every control turned.
//
//   42000 functions 4 and 5 (the front and rear suspension), with the erratum that puts its rear
//   drivers in their hubs (option=proposed): p356 32494 / p357 11950, p351 32494 / p349 11950, and
//   the front steering links p571 32293 / p588 92909, p536 42003 / p580 32293.
//   8880 functions 7 and 8 (the front and rear suspension): p399 2907 / p429 6540b and the three
//   other balls in their steering arms, and p106 6536 / p314 6538a and the three other pairs.
//   8466 function 8 (the suspension): p627 3713 / p1151 2910, p626 3713 / p1147 2910, p1048 32494 /
//   p1134 2910.
//
// Run with the viewer's address, a set, and one of its controls if wanted (each quarter turn can take a
// minute and more on a loaded machine; run it in the background, without a time limit):
//   npx tsx scripts/drags/missing-connections.ts http://localhost:5174 42000 278
import { answer, open } from './drag.ts';

const CASES: Record<string, { file: string; settings: string; controls: number[]; pairs: [number, number][]; watch?: number[] }> = {
  '42000': { file: 'omr/42000-1 Grand Prix Racer.mpd', settings: 'lifted=1&option=proposed', controls: [591, 600, 278, 291], pairs: [[356, 357], [351, 349], [571, 588], [536, 580]], watch: [355, 356, 358, 352, 351, 350] },
  '8880': {
    file: 'models/8880-Super Car.mpd',
    settings: 'lifted=1',
    controls: [105, 121, 113, 129],
    pairs: [[399, 429], [400, 438], [397, 432], [398, 435], [106, 314], [122, 315], [114, 333], [130, 332]],
  },
  '8466': { file: 'omr/8466-1 4 X 4 Off-Roader.mpd', settings: 'lifted=1', controls: [648, 666, 1039, 1057], pairs: [[627, 1151], [626, 1147], [1048, 1134]] },
};
const [set, only] = process.argv.slice(3);
const sets = [set];
const started = Date.now();
const seen: string[] = [];
let ok = true;
for (const set of sets) {
  const c = CASES[set];
  const v = await open(c.file, c.settings);
  for (const part of only ? [Number(only)] : c.controls) {
    if ((await v.reach(part)) < 0) {
      seen.push(`${set}: p${part} can't be seen`);
      ok = false;
      continue;
    }
    const watched = [part, ...(c.watch ?? [])];
    const before = await v.where(watched);
    let turned = 0;
    for (const way of [Math.PI / 4, -Math.PI / 4]) {
      if (!(await v.aim(part))) break;
      await v.press();
      await v.turn(part, way);
      const [m, ...others] = await v.moved(watched, before);
      turned = Math.max(turned, m.degrees);
      if (way > 0) for (const o of others) seen.push(`${set} p${part} turned ${m.degrees} degrees: p${o.part} ${o.degrees} degrees, ${o.ldu} LDU`);
    }
    const stops = await v.stops();
    const pairStops = stops.filter((s) => c.pairs.some(([a, b]) => s === `${a}/${b}` || s === `${b}/${a}`));
    if (pairStops.length || turned < 1) ok = false;
    seen.push(`${set} p${part}: turned up to ${turned.toFixed(1)} degrees; stops ${stops.join(', ') || 'none'}${pairStops.length ? ' (a pair stops it)' : ''}`);
  }
  await v.close();
}
answer(ok, seen, started);
