// The 8272 Snowmobile's function 3: the right ski's steering. No part is pointed at, so the camera starts where it does for any user, and is turned round the model if the control p9 can't be seen. Pressing p9 frees its ski's hinge pin p24; then three quarter turns turn it to its limit. The check has it as works: yes if the pins freed are the check's (24) and the viewer shows at least that.
// Run with the viewer's address: npx tsx scripts/drags/8272-fn3.ts http://localhost:5173
import { answer, atLeast, open, resultOf } from './drag.ts';

const started = Date.now();
const v = await open('omr/8272-1 Snowmobile.mpd', '');
const measured = [9, 42, 21, 35, 10, 51, 626];
const seen: string[] = [];
const turns = await v.reach(9);
if (turns < 0) answer(false, [`p9 can't be seen, even turning the camera round`], started);
if (turns > 0) seen.push(`turned the camera ${turns} times to see p9`);
const pressed = await v.press({ release: true });
seen.push(`pressing p9: ${pressed.said.join(' / ')}; freed ${pressed.freed.join(',') || 'none'}`);
const before = await v.where(measured);
for (const way of [Math.PI / 2, Math.PI / 2, Math.PI / 2]) {
  if (!(await v.aim(9))) break;
  await v.press();
  await v.turn(9, way);
}
let [control, ...moved] = await v.moved(measured, before);
// The other way, if that way didn't go far enough.
if (resultOf(control, moved, 0.3) !== 'works') {
  for (const way of [-(Math.PI / 2), -(Math.PI / 2), -(Math.PI / 2)]) {
    if (!(await v.aim(9))) break;
    await v.press();
    await v.turn(9, way);
  }
  [control, ...moved] = await v.moved(measured, before);
}
seen.push(`p9, the control: ${control.degrees} degrees, ${control.ldu} LDU`);
for (const m of moved) seen.push(`p${m.part}: ${m.degrees} degrees, ${m.ldu} LDU`);
// The check turned the control 0.3 rad.
const result = resultOf(control, moved, 0.3);
seen.push(`stops: ${(await v.stops()).join(', ') || 'none'}`);
seen.push(`the viewer: ${result}; the check: works`);
await v.close();
answer(pressed.freed.includes(24) && atLeast(result, 'works'), seen, started);
