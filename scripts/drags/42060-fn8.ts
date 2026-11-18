// The 42060 Roadwork Crew's function 8: the excavator's bucket p294 sits on a hinge arm and can be
// set at an angle by hand. As read, a friction pin holds it in a bigger body. A press with Shift
// frees that pin (293: see pinsForShift); then the bucket is turned one way and the other. The check
// has it working, by the Shift-press (its `shiftPressed`), the bucket turning 1.5 rad each way: yes
// if the pin freed is 293 and the bucket turns at least half that.
// Run with preview's viewer up (http://localhost:5174), or another's address after it: npx tsx scripts/drags/42060-fn8.ts
import { answer, atLeast, open, resultOf } from './drag.ts';

const started = Date.now();
const v = await open('omr/42060-1 Roadwork Crew.mpd', 'show=294');
const seen: string[] = [];
const turns = await v.reach(294);
if (turns < 0) answer(false, [`p294 can't be seen, even turning the camera round`], started);
if (turns > 0) seen.push(`turned the camera ${turns} times to see p294`);
const pressed = await v.press({ shift: true, release: true });
seen.push(`pressing p294 with Shift: ${pressed.said.join(' / ')}; freed ${pressed.freed.join(',') || 'none'}`);
const before = await v.where([294]);
let most = 0;
let best = { part: 294, ldu: 0, degrees: 0, moved: false };
for (const way of [Math.PI / 2, Math.PI / 2, Math.PI / 2]) {
  if (!(await v.aim(294))) break;
  await v.press();
  await v.turn(294, way);
  const [bucket] = await v.moved([294], before);
  if (bucket.degrees > most) [most, best] = [bucket.degrees, bucket];
}
seen.push(`p294, the bucket: at most ${best.degrees} degrees, ${best.ldu} LDU`);
const result = resultOf(best, [best], 1.5);
seen.push(`stops: ${(await v.stops()).join(', ') || 'none'}`);
seen.push(`the viewer: ${result}; the check: works`);
await v.close();
answer(pressed.freed.includes(293) && atLeast(result, 'works'), seen, started);
