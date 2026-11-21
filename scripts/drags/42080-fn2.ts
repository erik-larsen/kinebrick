// The 42080 Forest Machine's function 2: the gear p1893 by the cab works the boom's valve. The gear
// sits in the frame even with every friction pin free, so no pin is freed for it (decision 166):
// a press with Shift says it's held by more than friction pins. (A plain drag of it pushes the
// whole machine, which isn't the function.) The check has it as no: yes if the viewer agrees, no
// pin freed.
// Run with preview's viewer up (http://localhost:5174), or another's address after it: npx tsx scripts/drags/42080-fn2.ts
import { answer, open } from './drag.ts';

const started = Date.now();
const v = await open('omr/42080-1 Forest Machine.mpd', 'show=1893');
const turns = await v.reach(1893);
if (turns < 0) answer(false, [`p1893 can't be seen, even turning the camera round`], started);
const pressed = await v.press({ shift: true, release: true });
await v.close();
answer(pressed.freed.length === 0, [...(turns > 0 ? [`turned the camera ${turns} times`] : []), `pressing p1893 with Shift: ${pressed.said.join(' / ')}; freed ${pressed.freed.join(',') || 'none'}`], started);
