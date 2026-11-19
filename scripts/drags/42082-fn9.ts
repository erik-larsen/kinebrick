// The 42082 Rough Terrain Crane's function 9: the cab door p3789 slides open on two parallel links
// (book 2, pages 269 to 271), so it goes out without turning. As read, friction pins fuse the door to
// the cab, so a plain drag of it slews the superstructure. A press with Shift frees its two pins
// (3792, 3793: see pinsForShift); then the door is pushed one way and the other, and measured against
// the cab (p2649), the push that takes it furthest kept. The check's record has the control turned
// -0.42 and 0.03 rad, the door going 44.7 LDU for each radian: 18.8 LDU its larger way. Yes if the
// pins freed are those two and the door goes out at least half that, 9.4 LDU, against the cab.
// Run with preview's viewer up (http://localhost:5174), or another's address after it: npx tsx scripts/drags/42082-fn9.ts
import { answer, open } from './drag.ts';

const CHECK_LDU = 0.42 * 44.7;

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
  if (door.ldu > best.ldu) best = door;
}
seen.push(`p3789, the door, against the cab: at most ${best.degrees} degrees, ${best.ldu} LDU`);
seen.push(`stops: ${(await v.stops()).join(', ') || 'none'}`);
await v.close();
answer(pressed.freed.includes(3792) && pressed.freed.includes(3793) && best.ldu >= CHECK_LDU / 2, seen, started);
