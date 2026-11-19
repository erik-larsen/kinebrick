// The 42078 Mack Anthem's function 12: a container end door (p2631) swung open on its hinge, the
// container riding on the trailer. A press with Shift first frees the friction pins that hold the
// door (see pinsForShift); then a quarter turn each way; measured against the container (p2619).
// Yes if the door turned at least 10 degrees against the container.
// Run with the viewer's address: npx tsx scripts/drags/42078-door.ts http://localhost:5174
import { answer, open } from './drag.ts';

const started = Date.now();
const v = await open('omr/42078-1 Mack Anthem.mpd', 'lifted=1');
const seen: string[] = [];
const [door, container] = [2631, 2619];
if ((await v.reach(door)) < 0) answer(false, [`p${door} can't be seen`], started);
const pressed = await v.press({ shift: true, release: true });
seen.push(`pressing p${door} with Shift: ${pressed.said.join(' / ')}; freed ${pressed.freed.join(',') || 'none'}`);
const before = await v.where([door, container]);
let most = 0;
for (const way of [Math.PI / 4, -Math.PI / 4]) {
  if (!(await v.aim(door))) break;
  await v.press();
  await v.turn(door, way);
  const [d] = await v.moved([door, container], before, container);
  most = Math.max(most, d.degrees);
  seen.push(`turned ${way > 0 ? 'one way' : 'back'}: the door p${door} ${d.degrees} degrees, ${d.ldu} LDU against the container`);
}
seen.push(`stops: ${(await v.stops()).join(', ') || 'none'}`);
await v.close();
answer(most >= 10, seen, started);
