// The 42078 Mack Anthem's function 12: the container's two end doors (p2631 and p2665), each
// opened as a user would, with the proposed erratum that takes door 1's 13L beam and blue pins out
// of door 2 (option=proposed). For each door: a press with Shift on its lock bar (the first of
// its parts the camera can see: its 99008, p2641 or p2675, its axles or its handle) asks for it
// to slide on its axle (decision 206 of 2026-11-18); a drag lifts it, up the screen; then a press
// with Shift on the door frees the friction pins it hangs on (see
// pinsForShift), and a quarter turn each way swings it; measured against the container (p2619 for
// door 1, p2620 for door 2), with the viewer's collision stops. Yes if each bar went up at least
// 16 LDU (out of the container's 32184) and each door turned at least 10 degrees.
// Run with the viewer's address (in the background, without a time limit):
//   npx tsx scripts/drags/42078-door.ts http://localhost:5174
import { answer, open } from './drag.ts';

const started = Date.now();
const v = await open('omr/42078-1 Mack Anthem.mpd', 'lifted=1&option=proposed');
const seen: string[] = [];
let ok = true;
for (const [bars, door, container] of [[[2641, 2643, 2644, 2650], 2631, 2619], [[2675, 2677, 2678, 2684], 2665, 2620]] as [number[], number, number][]) {
  // The bar's part the camera can see: its 99008, axles or handle.
  let bar = -1;
  for (const b of bars) if ((await v.reach(b)) >= 0) {
    bar = b;
    break;
  }
  if (bar < 0) {
    seen.push(`no part of the lock bar ${bars.map((b) => `p${b}`).join(', ')} can be seen`);
    ok = false;
    continue;
  }
  const asked = await v.press({ shift: true, release: true });
  seen.push(`pressing the lock bar p${bar} with Shift: ${asked.said.join(' / ')}`);
  const barBefore = await v.where([bar, door]);
  if (await v.aim(bar)) {
    await v.press();
    await v.push(0, -80);
  }
  const [lifted] = await v.moved([bar, door], barBefore, door);
  seen.push(`the bar p${bar} dragged up the screen: ${lifted.ldu} LDU against the door`);
  if (lifted.ldu < 16) ok = false;
  if ((await v.reach(door)) < 0) {
    seen.push(`p${door} can't be seen`);
    ok = false;
    continue;
  }
  const pressed = await v.press({ shift: true, release: true });
  seen.push(`pressing the door p${door} with Shift: ${pressed.said.join(' / ')}; freed ${pressed.freed.join(',') || 'none'}`);
  const before = await v.where([door, container]);
  let most = 0;
  for (const way of [Math.PI / 4, -Math.PI / 4]) {
    if (!(await v.aim(door))) break;
    await v.press();
    await v.turn(door, way);
    const [d] = await v.moved([door, container], before, container);
    most = Math.max(most, d.degrees);
    seen.push(`p${door} turned ${way > 0 ? 'one way' : 'back'}: ${d.degrees} degrees, ${d.ldu} LDU against the container`);
  }
  if (most < 10) ok = false;
}
seen.push(`stops: ${(await v.stops()).join(', ') || 'none'}`);
await v.close();
answer(ok, seen, started);
