import { readFileSync } from 'node:fs';
import { Vector3 } from 'three';
import { ConnectionTable } from '../../src/connections.ts';
import { DEFAULT_SCRUB, Kinematics } from '../../src/kinematics.ts';
import { modelSettings, parseModel } from '../../src/ldr.ts';
import { inferMechanism } from '../../src/mechanism.ts';

// Loads a real LEGO Technic set from the LDraw Official Model Repository for its tests (one file
// per set beside this one), as the viewer does: its mechanism, ready to move, and helpers to move it.

export const table: ConnectionTable = JSON.parse(readFileSync('data/connections.json', 'utf-8'));
export const roles: Record<string, string> = JSON.parse(readFileSync('data/roles.json', 'utf-8'));
// Which files each model places are LDraw primitives (drawn shapes, not parts), and which parts
// are read as their pieces, as the packer found.
const packed: Record<string, { primitives: string[]; pieces: Record<string, string[]> }> = JSON.parse(readFileSync('packed/models.json', 'utf-8'));

export function load(file: string) {
  const model = packed[file.replace(/^models\//, '').replace(/\.(ldr|mpd)$/, '')];
  const primitives = new Set(model?.primitives ?? []);
  const text = readFileSync(file, 'utf-8');
  const { parts, paths } = parseModel(text, (name) => primitives.has(name), (name) => model?.pieces[name] ?? null);
  const mech = inferMechanism(parts, table, roles, paths);
  const kin = new Kinematics(mech);
  kin.scrub = (modelSettings(text).scrub ?? DEFAULT_SCRUB * 100) / 100; // as the viewer does
  // The body of the n-th copy of a part.
  const bodyOf = (name: string, n = 0) => mech.bodyOf[parts.map((p, i) => (p.name === name ? i : -1)).filter((i) => i >= 0)[n]];
  // Turns a body on its joint as a drag does (holding what that doesn't need, chosen as the
  // viewer chooses), as far as it goes, up to `angle`. Returns how far it turned.
  const turn = (body: number, angle: number) => {
    const joint = kin.parentLink(body)!.joint;
    kin.holdWhatTheDragDoesntNeed(body, () => kin.jointMotion(joint) !== null, joint);
    const turned = kin.turnJoint(joint, angle, () => kin.atLimit() === null);
    kin.letGoAfterDrag();
    return turned;
  };
  // Keeps a body turning as the motor does (Ctrl-click): `steps` steps of 15 degrees, with what
  // that doesn't need held once, and held afresh if a step can't be taken. Returns how far it
  // turned, stopping at a step it can't take.
  const motor = (body: number, steps: number) => {
    const joint = kin.parentLink(body)!.joint;
    const step = (15 * Math.PI) / 180;
    const allowed = () => kin.atLimit() === null;
    let total = 0;
    kin.holdWhatTheDragDoesntNeed(body, () => kin.jointMotion(joint) !== null, joint);
    for (let i = 0; i < steps; i++) {
      let turned = kin.turnJoint(joint, step, allowed, step);
      if (Math.abs(turned - step) > 1e-9) {
        kin.holdWhatTheDragDoesntNeed(body, () => kin.jointMotion(joint) !== null, joint);
        turned += kin.turnJoint(joint, step - turned, allowed, step);
      }
      total += turned;
      if (Math.abs(turned - step) > 1e-9) break;
    }
    kin.letGoAfterDrag();
    return total;
  };
  const angleOf = (body: number) => kin.jointAngles[kin.parentLink(body)!.joint];
  const frameMoved = () => new Vector3().applyMatrix4(kin.poses[0]).length();
  // The bodies that turn on the frame on a 2x2 turntable (whose top, 3679, they carry).
  const turntables = () =>
    mech.joints.flatMap((j) => (j.kind === 'revolute' && j.bodyA === 0 && mech.bodies[j.bodyB].parts.some((p) => parts[p].name === '3679.dat') ? [j.bodyB] : []));
  return { parts, mech, kin, bodyOf, turn, motor, angleOf, frameMoved, turntables };
}
