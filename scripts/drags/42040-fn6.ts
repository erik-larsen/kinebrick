// The 42040 Fire Plane's function 6: the joystick p358 works the ailerons. Pressing it frees its pin p331; then it is pushed four ways. The check has it as partly: yes if the pins freed are the check's (331) and the viewer shows at least that.
// Run with preview's viewer up (http://localhost:5174), or another's address after it: npx tsx scripts/drags/42040-fn6.ts
import { answer, atLeast, open, resultOf } from './drag.ts';

const started = Date.now();
const v = await open('omr/42040-1 Fire Plane.mpd', 'show=358');
const measured = [358, 381, 384, 405, 441, 520, 511];
const seen: string[] = [];
const turns = await v.reach(358);
if (turns < 0) answer(false, [`p358 can't be seen, even turning the camera round`], started);
if (turns > 0) seen.push(`turned the camera ${turns} times to see p358`);
const pressed = await v.press({ release: true });
seen.push(`pressing p358: ${pressed.said.join(' / ')}; freed ${pressed.freed.join(',') || 'none'}`);
const before = await v.where(measured);
for (const [dx, dy] of [[0, -100], [0, 100], [100, 0], [-100, 0]]) {
  if (!(await v.aim(358))) break;
  await v.press();
  await v.push(dx, dy);
}
let [control, ...moved] = await v.moved(measured, before);
seen.push(`p358, the control: ${control.degrees} degrees, ${control.ldu} LDU`);
for (const m of moved) seen.push(`p${m.part}: ${m.degrees} degrees, ${m.ldu} LDU`);
// The check turned the control 0.7 rad.
const result = resultOf(control, moved, 0.7);
seen.push(`stops: ${(await v.stops()).join(', ') || 'none'}`);
seen.push(`the viewer: ${result}; the check: partly`);
await v.close();
answer(pressed.freed.includes(331) && atLeast(result, 'partly'), seen, started);
