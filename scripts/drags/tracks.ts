// A track placed link by link, dragged by its sprocket in the viewer (decision 185): the whole track
// runs round, no link left behind, and the model rolls where it stands on the ground. For each set
// named, its first such track (see chainPaths in src/ldr.ts): the sprocket (or gear) of the
// track's first wheel is turned half a turn on the screen, in two quarter turns, with the model
// lifted and again standing on the ground. Measured: how far each of the track's links went (LDU,
// against the frame), how far apart neighbouring links are before and after (their gap from one
// pitch), and how far the frame went over the ground. Yes if every link went at least 1 LDU, no two
// neighbours are further from a pitch apart than 4 LDU or 1 LDU more than as built, and on the
// ground the frame went at least 1 LDU.
//
// Run with the viewer's address, the sets, and a folder for pictures if wanted:
//   npx tsx scripts/drags/tracks.ts http://localhost:5173 9391 42006 8272 [--pictures dir]
import { answer, open } from './drag.ts';

const MODELS: Record<string, string> = {
  '9391': 'omr/9391-1 Crawler Crane (Tracked Crane).mpd',
  '42006': 'omr/42006-1 Excavator.mpd',
  '42021': 'omr/42021-1 Snowmobile.mpd',
  '42055': 'omr/42055-1 Bucket Wheel Excavator.mpd',
  '42069': 'omr/42069-1 Extreme Adventure.mpd',
  '8272': 'omr/8272-1 Snowmobile.mpd',
  '8275': 'omr/8275-1 Motorized Bulldozer.mpd',
  // For comparison: a track drawn along LDCad's path.
  '856': 'models/856-Bulldozer.mpd',
};
const args = process.argv.slice(3);
const picturesAt = args.indexOf('--pictures');
const pictures = picturesAt >= 0 ? args[picturesAt + 1] : null;
const sets = args.filter((a, i) => !a.startsWith('--') && (picturesAt < 0 || i !== picturesAt + 1));
const started = Date.now();
const seen: string[] = [];
let ok = true;
for (const set of sets) {
  for (const lifted of [true, false]) {
    const v = await open(MODELS[set], lifted ? 'lifted=1' : '');
    const how = `${set} ${lifted ? 'lifted' : 'on the ground'}`;
    // The track: its links in order round it, its pitch, and the part to turn.
    const track = await v.page.evaluate(() => {
      const k = (window as any).kinebrick;
      const loop = k.mech.loops.find((l: any) => l.path.byHand && l.path.halfWidth && l.wheels.length) ?? k.mech.loops.find((l: any) => l.links.length && l.wheels.length);
      if (!loop) return null;
      const body = loop.wheels[0].body;
      const turn = k.mech.bodies[body].parts.find((p: number) => /^(57519|57520|32007)\.dat$/.test(k.parts[p].name) || k.mech.roles[p] === 'gear');
      return { links: loop.links as number[], pitch: (loop.path.pitch ?? 16) as number, turn: turn as number, wheels: loop.wheels.length as number };
    });
    if (!track || track.turn === undefined) {
      seen.push(`${how}: no track placed by hand with a wheel`);
      ok = false;
      await v.close();
      continue;
    }
    const turns = await v.reach(track.turn);
    if (turns < 0) {
      seen.push(`${how}: p${track.turn} can't be seen`);
      ok = false;
      await v.close();
      continue;
    }
    const frameBefore = await v.page.evaluate(() => {
      const k = (window as any).kinebrick;
      return k.matrices()[k.mech.bodyOf.indexOf(0)].elements.slice(12, 15);
    });
    if (pictures) await v.page.screenshot({ path: `${pictures}/${set}-${lifted ? 'lifted' : 'ground'}-before.png` });
    // A path's links are measured where they're drawn (kinebrick.drawn), not by their bodies.
    const drawnAt = () => v.page.evaluate((links) => { const d = (window as any).kinebrick.drawn(); return links.map((p: number) => d[p].elements.slice(12, 15)); }, track.links);
    const before = await drawnAt();
    for (const quarter of [Math.PI / 2, Math.PI / 2]) {
      if (!(await v.aim(track.turn))) break;
      await v.press();
      await v.turn(track.turn, quarter);
    }
    const after = await drawnAt();
    // Against the frame: the frame's own travel taken off (on the ground it rolls).
    const frameNow = await v.page.evaluate(() => { const k = (window as any).kinebrick; return k.matrices()[k.mech.bodyOf.indexOf(0)].elements.slice(12, 15); });
    const went = after.map((a: number[], i: number) => ({ ldu: Math.hypot(...[0, 1, 2].map((c) => a[c] - frameNow[c] - (before[i][c] - frameBefore[c]))) }));
    if (pictures) await v.page.screenshot({ path: `${pictures}/${set}-${lifted ? 'lifted' : 'ground'}-after.png` });
    // Neighbours' gaps from a pitch: each link's nearest other link, as the links are drawn.
    const gapsOf = (at: number[][]) =>
      at.map((a, i) => {
        let least = Infinity;
        at.forEach((b, j) => {
          if (j !== i) least = Math.min(least, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]));
        });
        return Math.abs(least - track.pitch);
      });
    const gapsBefore = gapsOf(before);
    const gaps = gapsOf(after);
    const frameAfter = await v.page.evaluate(() => {
      const k = (window as any).kinebrick;
      return k.matrices()[k.mech.bodyOf.indexOf(0)].elements.slice(12, 15);
    });
    const rolled = Math.hypot(frameAfter[0] - frameBefore[0], frameAfter[1] - frameBefore[1], frameAfter[2] - frameBefore[2]);
    const ldu = went.map((w) => w.ldu);
    const most = Math.max(...ldu);
    const least = Math.min(...ldu);
    const behind = went.filter((w) => w.ldu < 1).length;
    const worstGap = Math.max(...gaps);
    const stops = await v.stops();
    const good = behind === 0 && worstGap <= Math.max(4, Math.max(...gapsBefore) + 1) && (lifted || rolled >= 1);
    if (!good) ok = false;
    seen.push(`${how}: turned p${track.turn} (wheel 1 of ${track.wheels}); ${track.links.length - behind} of ${track.links.length} links went, ${least.toFixed(1)} to ${most.toFixed(1)} LDU; neighbours' worst gap from a pitch ${Math.max(...gapsBefore).toFixed(2)} LDU as built, ${worstGap.toFixed(2)} after; the frame went ${rolled.toFixed(1)} LDU; stops: ${stops.join(', ') || 'none'}${good ? '' : ' (not as it should be)'}`);
    await v.close();
  }
}
answer(ok, seen, started);
