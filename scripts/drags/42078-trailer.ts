// The 42078 Mack Anthem's function 7, the trailer on its king pin, with the container riding on the
// trailer (its own second model, see rideAlong). The trailer's part p1634 is turned a quarter turn
// each way, lifted; measured at the far end: the trailer (p1579) and the container (p2619) against
// the tractor (p180), and the stops. Yes if the trailer turned and the container went with it, the
// container's turn within a degree of the trailer's.
// Run with the viewer's address: npx tsx scripts/drags/42078-trailer.ts http://localhost:5174
import { answer, open } from './drag.ts';

const started = Date.now();
const v = await open('omr/42078-1 Mack Anthem.mpd', 'lifted=1');
const seen: string[] = [];
const [control, trailer, container, tractor] = [1634, 1579, 2619, 180];
if ((await v.reach(control)) < 0) answer(false, [`p${control} can't be seen`], started);
const before = await v.where([control, trailer, container, tractor]);
let ok = false;
for (const way of [Math.PI / 4, -Math.PI / 4]) {
  if (!(await v.aim(control))) break;
  await v.press();
  await v.turn(control, way);
  const [, t, c] = await v.moved([control, trailer, container, tractor], before, tractor);
  if (way > 0) {
    seen.push(`against the tractor: the trailer p${trailer} ${t.degrees} degrees, ${t.ldu} LDU; the container p${container} ${c.degrees} degrees, ${c.ldu} LDU`);
    ok = t.degrees > 1 && Math.abs(c.degrees - t.degrees) < 1;
  }
}
seen.push(`stops: ${(await v.stops()).join(', ') || 'none'}`);
await v.close();
answer(ok, seen, started);
