// The 8868 Air Tech Claw Rig's engine, with the proposed erratum that puts four connecting rods'
// balls in their pistons (option=proposed): the crankshaft p2898 is kept turning by the viewer
// (autospin, as Ctrl-click keeps a part moving; it is inside the engine and can't be grabbed), and
// every few seconds how far it has turned and where each of the six pistons p2910 to p2915 is are
// measured, with the viewer's collision stops. Yes if the crankshaft turned at least half a turn,
// every piston went at least 1 LDU from where it started at some time, and no rod met anything.
//
// Run with the viewer's address after it, and "before" to open it without the erratum (on a loaded
// machine the model can take minutes to load; run it in the background, without a time limit):
//   npx tsx scripts/drags/8868-rods.ts http://localhost:5174 [before]
import { answer, open } from './drag.ts';

const before = process.argv[3] === 'before';
const started = Date.now();
const crank = 2898;
const pistons = [2910, 2911, 2912, 2913, 2914, 2915];
const rods = [2899, 2900, 2903, 2904, 2907, 2908];
const v = await open('omr/8868-1 Air Tech Claw Rig.mpd', `lifted=1&autospin=${crank}&rpm=20${before ? '' : '&option=proposed'}`);
const at = await v.where([crank, ...pistons]);
const seen: string[] = [];
let turned = 0;
const furthest = pistons.map(() => 0);
for (let k = 1; k <= 6; k++) {
  await v.page.waitForTimeout(5000);
  const [c, ...p] = await v.moved([crank, ...pistons], at);
  turned = Math.max(turned, c.degrees);
  p.forEach((m, i) => (furthest[i] = Math.max(furthest[i], m.ldu)));
  seen.push(`after ${5 * k} s: the crankshaft ${c.degrees} degrees from where it started; pistons ${p.map((m) => `p${m.part} ${m.ldu}`).join(', ')} LDU`);
}
const stops = await v.stops();
seen.push(`each piston's furthest from where it started: ${pistons.map((p, i) => `p${p} ${furthest[i]}`).join(', ')} LDU`);
seen.push(`stops: ${stops.join(', ') || 'none'}`);
await v.close();
const rodStop = stops.some((s) => s.split('/').some((p) => rods.includes(Number(p))));
answer(turned >= 90 && furthest.every((l) => l >= 1) && !rodStop, seen, started);
