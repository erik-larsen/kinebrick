// The 8272 Snowmobile's function 2, lifted: the left ski's steering. Pressing the ski's wishbone p43 frees its hinge pin p20; then three quarter turns of the control p12 turn it to its limit. The check has it as works: yes if the pins freed are the check's (20) and the viewer shows at least that.
// Run with preview's viewer up (http://localhost:5174), or another's address after it: npx tsx scripts/drags/8272-fn2.ts
import { answer, atLeast, open, resultOf } from './drag.ts';

const started = Date.now();
const v = await open('omr/8272-1 Snowmobile.mpd', 'lifted=1');
const measured = [12, 43, 17, 36, 13, 53, 615];
const seen: string[] = [];
const turns = await v.reach(43);
if (turns < 0) answer(false, [`p43 can't be seen, even turning the camera round`], started);
if (turns > 0) seen.push(`turned the camera ${turns} times to see p43`);
const pressed = await v.press({ release: true });
seen.push(`pressing p43: ${pressed.said.join(' / ')}; freed ${pressed.freed.join(',') || 'none'}`);
const before = await v.where(measured);
for (const way of [-Math.PI / 2, -Math.PI / 2, -Math.PI / 2]) {
  if (!(await v.aim(12))) break;
  await v.press();
  await v.turn(12, way);
}
let [control, ...moved] = await v.moved(measured, before);
seen.push(`p12, the control: ${control.degrees} degrees, ${control.ldu} LDU`);
for (const m of moved) seen.push(`p${m.part}: ${m.degrees} degrees, ${m.ldu} LDU`);
// The check turned the control 0.3 rad.
const result = resultOf(control, moved, 0.3);
seen.push(`stops: ${(await v.stops()).join(', ') || 'none'}`);
seen.push(`the viewer: ${result}; the check: works`);
await v.close();
answer(pressed.freed.includes(20) && atLeast(result, 'works'), seen, started);
