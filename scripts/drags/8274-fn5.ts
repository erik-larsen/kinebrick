// The 8274 Combine Harvester's function 5: the knob p919 swings the unloading auger p938 out from the grain tank and back; the grain tank's p964 stays. The control is turned a quarter turn each way. The check has it as works, by two collision stops (p395/p694 at once one way, p397/p701 at 0.1 rad the other), judged as ends of travel: yes if the viewer shows at least that.
// Run with preview's viewer up (http://localhost:5174), or another's address after it: npx tsx scripts/drags/8274-fn5.ts
import { answer, atLeast, open, resultOf } from './drag.ts';

const started = Date.now();
const v = await open('omr/8274-1 Combine Harvester.mpd', 'show=919');
const measured = [919, 938, 964];
const seen: string[] = [];
const turns = await v.reach(919);
if (turns < 0) answer(false, [`p919 can't be seen, even turning the camera round`], started);
if (turns > 0) seen.push(`turned the camera ${turns} times to see p919`);
const pressed = await v.press({ release: true });
seen.push(`pressing p919: ${pressed.said.join(' / ')}; freed ${pressed.freed.join(',') || 'none'}`);
const before = await v.where(measured);
let best = { part: 919, ldu: 0, degrees: 0, moved: false };
let bestMoved: { part: number; ldu: number; degrees: number; moved: boolean }[] = [];
for (const way of [Math.PI / 2, -Math.PI / 2, -Math.PI / 2]) {
  if (!(await v.aim(919))) break;
  await v.press();
  await v.turn(919, way);
  const [control, ...moved] = await v.moved(measured, before);
  seen.push(`after a turn of ${way > 0 ? '+' : '-'}π/2: p919 ${control.degrees} degrees; ${moved.map((m) => `p${m.part} ${m.degrees} degrees, ${m.ldu} LDU`).join('; ')}; stops: ${(await v.stops()).join(', ') || 'none'}`);
  if (control.degrees > best.degrees) [best, bestMoved] = [control, moved];
}
// The check turned the control 0.1 rad; p964 is to stay.
const [auger, tank] = bestMoved;
const result = tank?.moved ? 'partly' : resultOf(best, [auger ?? { moved: false }], 0.1);
seen.push(`the viewer: ${result}; the check: works`);
await v.close();
answer(atLeast(result, 'works'), seen, started);
