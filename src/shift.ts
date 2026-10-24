// Shifting a gearbox: a driving ring slides along the part it sits on (an axle joiner) and
// clicks into set positions (see "slides" in the connection table). Moving it changes which
// gear it locks to the shaft, so after a shift the mechanism is worked out afresh from where
// everything now is.

import { Matrix4, Quaternion, Vector3 } from 'three';
import { ConnectionTable } from './connections.ts';
import { ModelSlide, PlacedPart } from './ldr.ts';
import { Mechanism } from './mechanism.ts';

export interface Slider {
  part: number; // the part that slides (the driving ring)
  base: number; // the part it slides on (the axle joiner), or -1 for a model's own (see ModelSlide)
  positions: number[]; // where it can click in: distances of its middle from the base's, in LDU
  origin?: Vector3; // a model's own: where its middle was built, and the way it slides
  dir?: Vector3;
  riders?: number[]; // the parts that slide with it (a model's own: its body's, and what turns on it), if not just it
}

// The parts in a model that slide into set positions, and what each sits on; and the shafts
// the model says slide (its SLIDE lines, see modelSettings), each with what turns on it (a gear
// lever) sliding with it.
export function findSliders(parts: PlacedPart[], mech: Mechanism, table: ConnectionTable, slides: ModelSlide[] = []): Slider[] {
  const sliders: Slider[] = [];
  parts.forEach((p, i) => {
    const slide = table.slides?.[p.name];
    if (!slide) return;
    // It sits on whatever it's fitted rigidly over (it's the female side of the fit).
    const fit = mech.connections.find((c) => c.female === i && c.kind === 'rigid');
    if (fit) sliders.push({ part: i, base: fit.male, positions: slide.positions });
  });
  for (const slide of slides) {
    // The part, wherever along its slide it is now.
    const part = parts.findIndex((p) => {
      if (p.name !== slide.part) return false;
      const off = new Vector3().setFromMatrixPosition(p.matrix).sub(slide.at);
      const along = off.dot(slide.dir);
      return off.addScaledVector(slide.dir, -along).length() < 1 && along > Math.min(...slide.positions) - 1 && along < Math.max(...slide.positions) + 1;
    });
    if (part < 0) continue;
    const body = mech.bodyOf[part];
    const riding = mech.joints.flatMap((j) => {
      const other = j.bodyA === body ? j.bodyB : j.bodyB === body ? j.bodyA : -1;
      if (other <= 0 || j.kind !== 'revolute') return [];
      const axis = new Vector3().subVectors(j.to, j.from).normalize();
      return Math.abs(axis.dot(slide.dir)) > 0.99 ? [other] : [];
    });
    const riders = [body, ...riding].flatMap((b) => mech.bodies[b].parts);
    sliders.push({ part, base: -1, positions: slide.positions, origin: slide.at.clone(), dir: slide.dir.clone(), riders });
  }
  return sliders;
}

// The direction a slider slides, in model coordinates.
export function slideDirection(parts: PlacedPart[], table: ConnectionTable, slider: Slider): Vector3 {
  if (slider.dir) return slider.dir.clone();
  const dir = table.slides![parts[slider.part].name].dir;
  return new Vector3(...dir).transformDirection(parts[slider.part].matrix);
}

// Where a slider is now: its middle's distance from its base's middle (or where a model's own
// was built), along the slide.
export function sliderPosition(parts: PlacedPart[], table: ConnectionTable, slider: Slider): number {
  const dir = slideDirection(parts, table, slider);
  const at = new Vector3().setFromMatrixPosition(parts[slider.part].matrix);
  const base = slider.origin ?? new Vector3().setFromMatrixPosition(parts[slider.base].matrix);
  return at.sub(base).dot(dir);
}

// The slider's part matrix moved to `position`.
export function sliderMovedTo(parts: PlacedPart[], table: ConnectionTable, slider: Slider, position: number): Matrix4 {
  const dir = slideDirection(parts, table, slider);
  const by = position - sliderPosition(parts, table, slider);
  return new Matrix4().makeTranslation(dir.x * by, dir.y * by, dir.z * by).multiply(parts[slider.part].matrix);
}

// The click-in position nearest `position`.
export function nearestPosition(slider: Slider, position: number): number {
  return slider.positions.reduce((best, p) => (Math.abs(p - position) < Math.abs(best - position) ? p : best));
}

// A gear lever (role `shift lever`, the 6549 Technic 4 Speed Shift Lever): a stick on a ball,
// standing up through a gate (a plate with a slot), its foot below the ball sitting between
// driving rings. It clicks between the gate's positions: tilted into a slot, its foot swings the
// other way, into the ring on that side, and slides it to its click-in position that way; in
// the middle of the gate, every ring is in its middle (neutral).
export interface Stick {
  part: number; // the lever
  gate: number; // the plate it stands up through
  rings: Slider[]; // the driving rings its foot can reach
}

// The gates: the points of each gate's slot a lever can stand in, in the plate's own
// coordinates, on its top face. The 6543 Technic Plate 4 x 6 with 4 Position Gear Shift Gate:
// the middle (neutral), and the ends of the two slots either side of it (each slot 12 LDU wide,
// from 7.3 to 19 LDU out, and 19 LDU long each way, with round ends: the ends' middles at 13).
const GATES: Record<string, [number, number, number][]> = {
  '6543.dat': [
    [0, 0, 0],
    [-13, 0, -13],
    [-13, 0, 13],
    [13, 0, -13],
    [13, 0, 13],
  ],
};
// Where a 6549 lever's ball is, and its foot, in the lever's own coordinates; its stick runs up
// from the ball along -y, to its end.
const BALL = new Vector3(0, 0, 0);
const FOOT = new Vector3(0, 20, 0);
const STICK_END = new Vector3(0, -79, 0);
// How far a lever's foot may be from a driving ring's middle to move it, in LDU.
const FOOT_REACH = 30;
// How far from its ball a gate may be for a lever to stand up through it, in LDU.
const GATE_REACH = 40;

// The gear levers in a model, each with its gate and the driving rings its foot can reach from
// the middle of the gate (in a slot that swings it away from a ring, it may be out of reach).
export function findSticks(parts: PlacedPart[], roles: Record<string, string>, sliders: Slider[]): Stick[] {
  const sticks: Stick[] = [];
  parts.forEach((p, i) => {
    if (roles[p.name] !== 'shift lever') return;
    const ball = BALL.clone().applyMatrix4(p.matrix);
    const gate = parts.findIndex((g) => GATES[g.name] && new Vector3().setFromMatrixPosition(g.matrix).distanceTo(ball) < GATE_REACH);
    if (gate < 0) return;
    const middle = new Vector3(...GATES[parts[gate].name][0]).applyMatrix4(parts[gate].matrix);
    const foot = FOOT.clone().applyMatrix4(standThrough(p.matrix, middle).multiply(p.matrix));
    const rings = sliders.filter((s) => new Vector3().setFromMatrixPosition(parts[s.part].matrix).distanceTo(foot) < FOOT_REACH);
    if (rings.length > 0) sticks.push({ part: i, gate, rings });
  });
  return sticks;
}

// The turn about its ball that stands a lever, placed by `lever`, up through a point.
function standThrough(lever: Matrix4, point: Vector3): Matrix4 {
  const ball = BALL.clone().applyMatrix4(lever);
  const up = STICK_END.clone().applyMatrix4(lever).sub(ball).normalize();
  const turn = new Quaternion().setFromUnitVectors(up, point.clone().sub(ball).normalize());
  return new Matrix4().makeTranslation(ball.x, ball.y, ball.z).multiply(new Matrix4().makeRotationFromQuaternion(turn)).multiply(new Matrix4().makeTranslation(-ball.x, -ball.y, -ball.z));
}

// Where a lever's stick ends, placed by `lever`.
export function stickEnd(lever: Matrix4): Vector3 {
  return STICK_END.clone().applyMatrix4(lever);
}

// The lever's part matrix moved into a gate position.
export function leverAt(parts: PlacedPart[], stick: Stick, position: StickPosition): Matrix4 {
  return position.turn.clone().multiply(parts[stick.part].matrix);
}

// A lever's place in its gate: how to move the lever, and what's fixed to it, from where it is
// now to there, and where each ring it reaches is then (by its part, at one of its click-in
// positions).
export interface StickPosition {
  turn: Matrix4;
  rings: Map<number, number>;
}

// Each of a lever's gate positions, worked out from where the lever and its rings are now
// (the gate's first position is neutral).
export function stickPositions(parts: PlacedPart[], table: ConnectionTable, stick: Stick): StickPosition[] {
  const lever = parts[stick.part].matrix;
  const gate = parts[stick.gate].matrix;
  const points = GATES[parts[stick.gate].name].map((q) => new Vector3(...q).applyMatrix4(gate));
  const turns = points.map((point) => standThrough(lever, point));
  const footAt = (turn: Matrix4) => FOOT.clone().applyMatrix4(turn.clone().multiply(lever));
  const neutralFoot = footAt(turns[0]);
  return turns.map((turn, k) => {
    const rings = new Map<number, number>();
    for (const s of stick.rings) rings.set(s.part, nearestPosition(s, 0));
    if (k > 0) {
      const moved = footAt(turn).sub(neutralFoot);
      // The ring the foot swings towards, across the way the rings slide, and which way it
      // slides it.
      let best: Slider | null = null;
      let most = 0;
      for (const s of stick.rings) {
        const dir = slideDirection(parts, table, s);
        const across = moved.clone().addScaledVector(dir, -moved.dot(dir));
        const toward = new Vector3().setFromMatrixPosition(parts[s.part].matrix).sub(neutralFoot).dot(across);
        if (toward > most) [best, most] = [s, toward];
      }
      if (best) {
        const way = Math.sign(moved.dot(slideDirection(parts, table, best)));
        const ends = best.positions.filter((x) => Math.sign(x) === way);
        if (ends.length) rings.set(best.part, ends.reduce((a, b) => (Math.abs(b) < Math.abs(a) ? b : a)));
      }
    }
    return { turn, rings };
  });
}

// Which of a lever's gate positions it's in now: the one it stands in (the one it needn't turn
// to get to), or, if it stands in none, the one its rings are in (neutral if none matches). Not
// only by its rings: where a lever reaches one ring, the slots that swing its foot away from it
// leave it in its middle, as neutral does.
export function stickPositionNow(parts: PlacedPart[], table: ConnectionTable, stick: Stick, positions: StickPosition[]): number {
  const turned = positions.map((p) => new Quaternion().setFromRotationMatrix(p.turn).angleTo(new Quaternion()));
  const standing = turned.indexOf(Math.min(...turned));
  if (turned[standing] < 0.01) return standing;
  const k = positions.findIndex((p) => stick.rings.every((s) => Math.abs(sliderPosition(parts, table, s) - p.rings.get(s.part)!) < 1));
  return Math.max(0, k);
}
