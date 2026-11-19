// The longer turn in the viewer (decision 162, the slow-parts rule): the two functions it made work,
// each control turned as far as the check's longer turn went, as a drag turns it (the viewer's
// turnPart: holding what that doesn't need, and stopping where parts would run into each other,
// once the parts that touch as built are known), and each listed part measured against what the
// list measures it against, from as built.
//   - the 8258 Crane Truck's function 5: first its lever's catch p166 turned -0.4 (as the list's
//     first step, then a drag end, which shifts its ring), then the motor p767's output (its gear
//     p1141) turned 5.1 radians; the upper boom's linear actuator, p2167 sliding in p2166, and p2180 against p2123;
//   - the 42081 Volvo Concept Wheel Loader's function 2: each of its two knobs (p460, p463) turned
//     1.7 radians; p464 and p1136 against the frame, and the piston p442 sliding in p441.
// Yes if every listed part went at least 1 LDU or 1 degree (MOVED in check-functions.ts); a part
// that went less is named with how far it went.
// Run with the viewer's address (in the background, without a time limit):
//   npx tsx scripts/drags/longer-turn.ts http://localhost:5174
import { answer, open } from './drag.ts';

const started = Date.now();
const seen: string[] = [];
let ok = true;
const cases: { file: string; turn: number; radians: number; parts: [number, number][]; first?: [number, number] }[] = [
  { file: 'omr/8258-1 Crane Truck.mpd', turn: 1141, radians: 5.1, parts: [[2167, 2166], [2180, 2123]], first: [166, -0.4] },
  { file: 'omr/42081-1 Volvo Concept Wheel Loader ZEUX.mpd', turn: 460, radians: 1.7, parts: [[464, -1], [442, 441], [1136, -1]] },
  { file: 'omr/42081-1 Volvo Concept Wheel Loader ZEUX.mpd', turn: 463, radians: 1.7, parts: [[464, -1], [442, 441], [1136, -1]] },
];
for (const c of cases) {
  for (const sign of [1, -1]) {
    const degrees = Math.round(((sign * c.radians * 180) / Math.PI) * 10) / 10;
    const v = await open(c.file);
    // The collision stop is ready once the parts that touch as built are known.
    await v.page.waitForFunction(`document.getElementById('collision-note').textContent === ''`, null, { timeout: 600_000 });
    // The list's first step: the catch turned by its joint's angle (turned back the other way if
    // the screen's sense is the opposite), then a drag end, which shifts the ring it moves.
    if (c.first) {
      const [catchPart, by] = c.first;
      const firstWent = (await v.page.evaluate(`(() => {
        const k = window.kinebrick;
        const link = k.kin.parentLink(k.mech.bodyOf[${catchPart}]);
        const a0 = k.kin.jointAngles[link.joint];
        k.interaction.turnPart(${catchPart}, ${by}, k.setup.camera.position);
        if (Math.sign(k.kin.jointAngles[link.joint] - a0) !== Math.sign(${by})) k.interaction.turnPart(${catchPart}, ${-2 * by}, k.setup.camera.position);
        const went = k.kin.jointAngles[link.joint] - a0;
        k.setup.onDragEnded();
        return went;
      })()`)) as number;
      await v.page.waitForTimeout(3000);
      seen.push(`first: the catch p${catchPart} turned ${Math.round(firstWent * 1000) / 1000} (the list: ${by})`);
    }
    // How far it really turned, and each part's move from as built, against the part it's
    // measured against (or the frame), in the page.
    const found = (await v.page.evaluate(`(() => {
      const k = window.kinebrick;
      const turned = k.interaction.turnPart(${c.turn}, ${(sign * c.radians).toFixed(4)}, k.setup.camera.position);
      const kept = Math.abs(turned) > 1e-9 ? '${c.turn},' + (Math.round(turned * 1800 / Math.PI) / 10) : null;
      const now = k.matrices();
      const frame = k.mech.bodyOf.indexOf(0);
      const out = ${JSON.stringify(c.parts)}.map(([a, b]) => {
        const ref = b >= 0 ? b : frame;
        const before = k.parts[ref].matrix.clone().invert().multiply(k.parts[a].matrix);
        const after = now[ref].clone().invert().multiply(now[a]);
        const ldu = Math.hypot(after.elements[12] - before.elements[12], after.elements[13] - before.elements[13], after.elements[14] - before.elements[14]);
        const e = before.clone().invert().multiply(after).elements;
        const deg = Math.acos(Math.max(-1, Math.min(1, (e[0] + e[5] + e[10] - 1) / 2))) * 180 / Math.PI;
        return { part: a, against: b, ldu: Math.round(ldu * 100) / 100, degrees: Math.round(deg * 100) / 100 };
      });
      return JSON.stringify({ kept: kept ?? null, out });
    })()`)) as string;
    const { kept, out } = JSON.parse(found) as { kept: string | null; out: { part: number; against: number; ldu: number; degrees: number }[] };
    seen.push(`${c.file.replace(/^omr\//, '')}: p${c.turn} asked ${degrees}°, turned ${kept ? kept.split(',')[1] + '°' : 'not at all'}; ` + out.map((m) => `p${m.part}${m.against >= 0 ? ` against p${m.against}` : ''} ${m.ldu} LDU, ${m.degrees}°${m.ldu < 1 && m.degrees < 1 ? ' (under 1)' : ''}`).join('; '));
    if (!kept || out.some((m) => m.ldu < 1 && m.degrees < 1)) ok = false;
    seen.push(`stops: ${(await v.stops()).join(', ') || 'none'}`);
    await v.close();
  }
}
answer(ok, seen, started);
