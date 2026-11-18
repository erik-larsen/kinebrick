// The 42080 Forest Machine's function 3: the gear p1892 by the cab works the crane's valve. The gear
// sits in the frame even with every friction pin free, so no pin is freed for it (decision 166):
// a press with Shift says it's held by more than friction pins. (A plain drag of it pushes the
// whole machine, which isn't the function.) The check has it as no: yes if the viewer agrees, no
// pin freed.
// Run with the viewer's address: npx tsx scripts/drags/42080-fn3.ts http://localhost:5173
import { answer, open } from './drag.ts';

const started = Date.now();
const v = await open('omr/42080-1 Forest Machine.mpd', '');
const turns = await v.reach(1892);
if (turns < 0) answer(false, [`p1892 can't be seen, even turning the camera round`], started);
const pressed = await v.press({ shift: true, release: true });
await v.close();
answer(pressed.freed.length === 0, [...(turns > 0 ? [`turned the camera ${turns} times`] : []), `pressing p1892 with Shift: ${pressed.said.join(' / ')}; freed ${pressed.freed.join(',') || 'none'}`], started);
