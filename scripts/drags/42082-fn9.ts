// The 42082 Rough Terrain Crane's function 9: the cab door p3789 swings open on its hinge. As read,
// friction pins fuse the door to the cab, so a plain drag of it slews the superstructure. A press
// with Shift frees its two hinge pins (3792, 3793: see pinsForShift); then the door is pushed one
// way and the other, and measured against the cab (p2649). The check has it working, by the
// Shift-press (its `shiftPressed`), the door turning 0.91 rad: yes if the pins freed are those and
// the door goes at least half that against the cab.
// Run with preview's viewer up (http://localhost:5174), or another's address after it: npx tsx scripts/drags/42082-fn9.ts
import { answer, atLeast, open, resultOf } from './drag.ts';

const started = Date.now();
const v = await open('omr/42082-1 Rough Terrain Crane.mpd', 'show=3789');
const seen: string[] = [];
const turns = await v.reach(3789);
if (turns < 0) answer(false, [`p3789 can't be seen, even turning the camera round`], started);
const pressed = await v.press({ shift: true, release: true });
seen.push(`pressing p3789 with Shift: ${pressed.said.join(' / ')}; freed ${pressed.freed.join(',') || 'none'}`);
const before = await v.where([3789, 2649]);
let best = { part: 3789, ldu: 0, degrees: 0, moved: false };
for (const [dx, dy] of [[120, 0], [-120, 0], [0, 120], [0, -120]]) {
  if (!(await v.aim(3789))) continue;
  await v.press();
  await v.push(dx, dy);
  const [door] = await v.moved([3789, 2649], before, 2649);
  if (door.degrees > best.degrees) best = door;
}
seen.push(`p3789, the door, against the cab: at most ${best.degrees} degrees, ${best.ldu} LDU`);
const result = resultOf(best, [best], 0.91);
seen.push(`stops: ${(await v.stops()).join(', ') || 'none'}`);
seen.push(`the viewer: ${result}; the check: works`);
await v.close();
answer(pressed.freed.includes(3792) && pressed.freed.includes(3793) && atLeast(result, 'works'), seen, started);
