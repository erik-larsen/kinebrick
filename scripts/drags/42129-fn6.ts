// The 4x4 Mercedes-Benz Zetros's function 6, lifted: each axle (p958 front, p1198 rear) sways on its suspension arms, between two shock absorbers. Each axle is turned a quarter turn each way, the model off the ground, and its wheel (p1309, p1032) and shock absorbers' rods in their cylinders (p1379 in p1380, p1215 in p1216) measured. The check has it as works, by collision stops at 0.03 and 0.13 rad (p1715/p1820, p830/p1303), judged as ends of travel: yes if the viewer shows at least that.
// Run with preview's viewer up (http://localhost:5174), or another's address after it: npx tsx scripts/drags/42129-fn6.ts
import { answer, atLeast, open, resultOf, type Result } from './drag.ts';

const started = Date.now();
const v = await open('omr/42129-1 4x4 Mercedes-Benz Zetros Trial Truck.mpd', 'lifted=1&show=958,1198');
const seen: string[] = [];
const results: Result[] = [];
for (const [control, parts] of [[958, [1309, 1379, 1380]], [1198, [1032, 1215, 1216]]] as [number, number[]][]) {
  const turns = await v.reach(control);
  if (turns < 0) answer(false, [...seen, `p${control} can't be seen, even turning the camera round`], started);
  const pressed = await v.press({ release: true });
  seen.push(`pressing p${control}: ${pressed.said.join(' / ')}; freed ${pressed.freed.join(',') || 'none'}`);
  const measured = [control, parts[0]];
  const before = await v.where(measured);
  const rodBefore = await v.where([parts[1], parts[2]]);
  let best = { part: control, ldu: 0, degrees: 0, moved: false };
  let bestMoved: { part: number; ldu: number; degrees: number; moved: boolean }[] = [];
  for (const way of [Math.PI / 2, -Math.PI / 2, -Math.PI / 2]) {
    if (!(await v.aim(control))) break;
    await v.press();
    await v.turn(control, way);
    const [c, wheel] = await v.moved(measured, before);
    const [rod] = await v.moved([parts[1], parts[2]], rodBefore, parts[2]);
    const moved = [wheel, rod];
    seen.push(`p${control} after a turn of ${way > 0 ? '+' : '-'}π/2: ${c.degrees} degrees; ${moved.map((m) => `p${m.part} ${m.degrees} degrees, ${m.ldu} LDU`).join('; ')}; stops: ${(await v.stops()).join(', ') || 'none'}`);
    if (c.degrees > best.degrees) [best, bestMoved] = [c, moved];
  }
  // The wheel against the frame, and the rod against its cylinder.
  results.push(resultOf(best, bestMoved, 0.13));
}
const result: Result = results.every((r) => r === 'works') ? 'works' : results.some((r) => r !== 'no') ? 'partly' : 'no';
seen.push(`the viewer: ${result} (front ${results[0]}, rear ${results[1]}); the check: works`);
await v.close();
answer(atLeast(result, 'works'), seen, started);
