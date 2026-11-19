// The 8110 Unimog's function 8 with the list's proposed first steps (decision 212 of 2026-11-19):
// the red lever up and the yellow lever up, as page 43 of printed book 5 shows, and the motor slews
// the crane. With the proposed errata (option=proposed: the crane's shaft whole). As a user would:
// each lever is dragged by its arm (red p559 on the catch p512, yellow p556 on the catch p516),
// the way that tips it up; then a Ctrl-click on the motor p60 keeps it turning, for a while. Measured from
// the viewer's own joint angles: the catches' turns (the list's steps are p512 by -0.4 and p516 by
// +0.4), the motor's 24-tooth gear p241, the turntable's gear p2216 (turning on the truck), and the
// winch's drum p4030. Yes if both catches went the list's way by at least 0.3 rad, the motor turned
// at least a radian, the turntable turned at the check's rate (0.00595 of the motor) within a
// fifth, and the drum stayed within 1 degree.
// Run with the viewer's address (in the background, without a time limit):
//   npx tsx scripts/drags/8110-crane.ts http://localhost:5174
import { answer, open } from './drag.ts';

const started = Date.now();
const v = await open('omr/8110-1 Mercedes-Benz Unimog U 400.mpd', 'option=proposed');
const seen: string[] = [];
let ok = true;
// The angle a part's body has turned on the joint it hangs on, as the viewer has it now.
const angle = (part: number) =>
  v.page.evaluate((p) => {
    const k = (window as any).kinebrick;
    const link = k.kin.parentLink(k.mech.bodyOf[p]);
    return link ? k.kin.jointAngles[link.joint] : NaN;
  }, part);
const round = (x: number) => Math.round(x * 1e4) / 1e4;

// The levers: each dragged by its arm, the 32013 on its catch's axle (red p559, yellow p556); its
// handle (red p561, yellow p558) turns on a pin of its own, so a drag on it only spins it. The two
// handles point opposite ways from their axles (the red one to -z, the yellow one to +z), so from
// the viewer's first camera a drag up the screen tips the yellow lever up and the red one down
// (seen on 2026-11-19): the red one is dragged down the screen, the yellow one up. Dragged once
// more the other way if the catch turned the wrong way (from another camera).
for (const [name, grip, catchPart, want, first] of [['red', 559, 512, -1, 60], ['yellow', 556, 516, 1, -60]] as [string, number, number, number, number][]) {
  const before = await angle(catchPart);
  let went = 0;
  for (const dy of [first, -2 * first]) {
    if ((await v.reach(grip)) < 0) {
      seen.push(`the ${name} lever's arm p${grip} can't be seen`);
      break;
    }
    await v.press();
    await v.push(0, dy);
    went = (await angle(catchPart)) - before;
    seen.push(`the ${name} lever dragged ${dy < 0 ? 'up' : 'down'} the screen by p${grip}: its catch p${catchPart} has turned ${round(went)} rad (the list: ${want > 0 ? '+' : '-'}0.4)`);
    if (Math.sign(went) === want && Math.abs(went) >= 0.3) break;
  }
  if (Math.sign(went) !== want || Math.abs(went) < 0.3) ok = false;
}
const rings = await v.where([320, 330]);
seen.push(`the rings p320 and p330 now at ${rings.slice(0, 2).map((m) => m.slice(12, 15).map((x) => Math.round(x * 10) / 10).join(' ')).join(' and ')}`);

// The motor, kept turning by a Ctrl-click, for a while.
if ((await v.reach(60)) < 0) {
  seen.push(`the motor p60 can't be seen`);
  ok = false;
} else {
  const [motor0, table0, drum0] = [await angle(241), await angle(2216), await angle(4030)];
  await v.page.keyboard.down('Control');
  await v.page.mouse.down();
  await v.page.mouse.up();
  await v.page.keyboard.up('Control');
  const running = await v.page.evaluate(() => (window as any).kinebrick.interaction.motorRunning());
  seen.push(`Ctrl-click on the motor: ${running ? 'it runs' : "it doesn't run"}`);
  await v.page.waitForTimeout(60_000);
  const [motor1, table1, drum1] = [await angle(241), await angle(2216), await angle(4030)];
  await v.page.evaluate(() => (window as any).kinebrick.interaction.pauseMotor(true));
  const [motor, table, drum] = [motor1 - motor0, table1 - table0, drum1 - drum0];
  const rate = Math.abs(motor) > 1e-6 ? Math.abs(table / motor) : 0;
  seen.push(`in 60 s the motor's gear p241 turned ${round(motor)} rad, the turntable's gear p2216 ${round(table)} rad (${round(rate)} of the motor; the check: 0.00595), the winch's drum p4030 ${round(drum)} rad`);
  if (Math.abs(motor) < 1 || Math.abs(rate - 0.00595) > 0.2 * 0.00595 || Math.abs(drum) > Math.PI / 180) ok = false;
}
seen.push(`stops: ${(await v.stops()).join(', ') || 'none'}`);
await v.close();
answer(ok, seen, started);
