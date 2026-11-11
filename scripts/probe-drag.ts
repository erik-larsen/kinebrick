// Works one function's control as a drag does, piece by piece, and says what happened at each
// piece: how far the control went, which bodies moved most, how far each part the function lists
// moved, and what stopped it, if anything did. For finding out why a drag stops or moves the
// wrong thing (see docs/plan.md, phase 1). The model is worked as built: controls the function
// says to work first aren't.
//
//   npm run probe -- 8880 2           the 8880's second function, its first control, both ways
//   npm run probe -- 8880 2 --json    the same, as JSON, to compare two runs line by line

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Matrix4, Quaternion, Vector3 } from 'three';
import { loadModel } from './load-model.ts';

const REACH = 1.5; // how far the control is worked each way: radians, or for a slide, PUSH LDU
const PUSH = 20;
const PIECE = 0.1;
const MOVERS = 5; // how many of the bodies that moved most are listed

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const json = process.argv.includes('--json');
const file = readdirSync(join('data', 'sets')).find((f) => f.startsWith(`${args[0]}-`) && f.endsWith('.json'));
if (!file || !(Number(args[1]) >= 1)) {
  console.error('npm run probe -- <set number> <function number> [--json]');
  process.exit(1);
}
const set = JSON.parse(readFileSync(join('data', 'sets', file), 'utf-8'));
const fn = set.curated.functions[Number(args[1]) - 1];
const model: string = fn.model ?? set.curated.model;
const { parts, mech, kin } = loadModel(model, model.startsWith('omr/'));

// A part named as the function lists name it ("p483 3736"), and a part's name.
const part = (ref: string) => Number(/^p(\d+)\b/.exec(ref.trim())![1]);
const name = (p: number) => `p${p} ${parts[p].name.replace(/\.dat$/, '')}`;
const at = parts.map((p) => new Vector3().setFromMatrixPosition(p.matrix));
// How far a body went against another between two sets of poses: LDU (at one of its parts) and degrees.
const went = (body: number, against: number, from: Matrix4[], to: Matrix4[]) => {
  const rel = (poses: Matrix4[]) => poses[against].clone().invert().multiply(poses[body]);
  const [was, is] = [rel(from), rel(to)];
  const p = at[mech.bodies[body].parts[0]];
  const q = new Quaternion().setFromRotationMatrix(was.clone().invert().multiply(is));
  return [p.clone().applyMatrix4(is).distanceTo(p.clone().applyMatrix4(was)), (2 * Math.acos(Math.min(1, Math.abs(q.w))) * 180) / Math.PI];
};
const round = (x: number) => Math.round(x * 100) / 100;

const control = part([fn.control].flat()[0]);
const body = mech.bodyOf[control];
const link = kin.parentLink(body);
const listed = [...(fn.moves ?? []).map((ref: string) => ({ ref, should: 'move' })), ...(fn.stays ?? []).map((ref: string) => ({ ref, should: 'stay' }))].map((x) => {
  const [a, b] = x.ref.split(' against ');
  return { ...x, body: mech.bodyOf[part(a)], against: b ? mech.bodyOf[part(b)] : 0 };
});
const out: unknown[] = [];
const say = (line: string, data: unknown) => (json ? out.push(data) : console.log(line));

say(`${set.set} function ${args[1]}: ${fn.does}\ncontrol ${name(control)}, ${mech.bodies.length} bodies, ${mech.joints.length} joints, ${mech.loose.length} loose parts`, { set: set.set, function: Number(args[1]), control: name(control), bodies: mech.bodies.length, joints: mech.joints.length });
if (body === 0 || !link) {
  say(body === 0 ? 'The control is part of the frame.' : 'The control has no joint to work.', { stop: 'no joint' });
} else {
  const reach = mech.joints[link.joint].kind === 'slide' ? PUSH : REACH;
  const start = kin.snapshot();
  const startPoses = kin.poses.map((m) => m.clone());
  for (const way of [1, -1]) {
    kin.restore(start);
    kin.holdWhatTheDragDoesntNeed(body, () => kin.jointMotion(link.joint) !== null, link.joint);
    let limited: [number, number] | null = null;
    const allowed = () => {
      limited = kin.atLimit() ?? limited;
      return kin.atLimit() === null;
    };
    let turned = 0;
    let stop = '';
    while (Math.abs(turned) < reach - 1e-9 && !stop) {
      const before = kin.poses.map((m) => m.clone());
      const piece = way * Math.min(PIECE, reach - Math.abs(turned));
      const step = kin.turnJoint(link.joint, piece, allowed);
      turned += step;
      if (Math.abs(step) < Math.abs(piece) - 1e-9) {
        const pair = limited as [number, number] | null;
        stop = pair ? `the end of travel between ${name(pair[0])} and ${name(pair[1])}` : kin.atDeadPoint(link.joint) ? 'a dead point' : kin.jointMotion(link.joint) === null ? `no motion left that turns it${kin.scrubNeeded !== null ? ` (its tyres would have to scrub ${Math.round(kin.scrubNeeded * 100)}%)` : ''}` : "a step that couldn't be taken";
      }
      // The bodies that moved most against the frame in this piece.
      const movers = mech.bodies
        .map((_, b) => ({ b, by: went(b, 0, before, kin.poses) }))
        .filter((m) => m.b > 0 && (m.by[0] > 0.01 || m.by[1] > 0.01))
        .sort((x, y) => Math.max(...y.by) - Math.max(...x.by));
      const top = movers.slice(0, MOVERS).map((m) => `${name(mech.bodies[m.b].parts[0])} ${round(m.by[0])} LDU ${round(m.by[1])}°`);
      say(`  ${way > 0 ? '+' : '-'} ${round(Math.abs(turned))}: ${movers.length} bodies moved; most: ${top.join(', ')}`, { way, turned: round(turned), moved: movers.length, most: top });
    }
    kin.letGoAfterDrag();
    const parts = listed.map((x) => {
      const by = went(x.body, x.against, startPoses, kin.poses);
      return { ref: x.ref, should: x.should, ldu: round(by[0]), degrees: round(by[1]) };
    });
    say(`  ${way > 0 ? '+' : '-'} went ${round(Math.abs(turned))} of ${reach}${stop ? `, stopped by ${stop}` : ''}\n${parts.map((p) => `      should ${p.should}: ${p.ref} went ${p.ldu} LDU, ${p.degrees}°`).join('\n')}`, { way, went: round(turned), of: reach, stop: stop || null, parts });
  }
}
if (json) console.log(JSON.stringify(out, null, 1));
