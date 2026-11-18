// The 42036 Street Motorcycle's function 5: the handlebars p268 steer the front wheel. They are part of the frame as read; a press with Shift frees the pin that holds them, p257; then they are turned one way and the other. The check has it as partly: yes if the pins freed are the check's (257) and the viewer shows at least that.
// Run with the viewer's address: npx tsx scripts/drags/42036-fn5.ts http://localhost:5173
import { answer, atLeast, open, resultOf } from './drag.ts';

const started = Date.now();
const v = await open('omr/42036-1 Street Motorcycle.mpd', 'show=268');
const measured = [268, 233, 227, 236];
const seen: string[] = [];
const turns = await v.reach(268);
if (turns < 0) answer(false, [`p268 can't be seen, even turning the camera round`], started);
if (turns > 0) seen.push(`turned the camera ${turns} times to see p268`);
const pressed = await v.press({ shift: true, release: true });
seen.push(`pressing p268 with Shift: ${pressed.said.join(' / ')}; freed ${pressed.freed.join(',') || 'none'}`);
const before = await v.where(measured);
for (const way of [Math.PI / 2, -Math.PI]) {
  if (!(await v.aim(268))) break;
  await v.press();
  await v.turn(268, way);
}
let [control, ...moved] = await v.moved(measured, before);
seen.push(`p268, the control: ${control.degrees} degrees, ${control.ldu} LDU`);
for (const m of moved) seen.push(`p${m.part}: ${m.degrees} degrees, ${m.ldu} LDU`);
// The check turned the control 0.03 rad.
const result = resultOf(control, moved, 0.03);
seen.push(`stops: ${(await v.stops()).join(', ') || 'none'}`);
seen.push(`the viewer: ${result}; the check: partly`);
await v.close();
answer(pressed.freed.includes(257) && atLeast(result, 'partly'), seen, started);
