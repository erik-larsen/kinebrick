// Pointer interaction in the 3D view (see "Interaction" in the README):
//   hover    highlight the part under the pointer, tint its body, label it
//   press    show how the grabbed point can move: an arrow (push) or an arc (turn)
//   drag     move the mechanism so the grabbed point follows the pointer
//   release  leave the model where it is
//   Alt-click   freeze a part, or unfreeze it
//   Ctrl-click  keep a part that spins on an axle turning on its own (a motor), or any other
//               part moving as a push would; again, the other way; again, stop it
// Dragging on empty space turns the camera instead.
//
// There are three kinds of drag:
//   push  for parts that don't spin on an axle (the frame): the grabbed point follows the
//         pointer along whatever straight-line motion the mechanism allows.
//   turn  for parts that spin on an axle (gears, cranks, tyres): the part turns about its
//         axle, relative to whatever the axle is mounted in, to follow the pointer around.
//   shift  for parts that slide into set positions (a gearbox's driving ring): the part jumps
//          to the position nearest the pointer along its slide, and the mechanism is worked
//          out afresh.

import {
  Box3,
  Camera,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Ray,
  Raycaster,
  TorusGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Appearance } from './appearance.ts';
import { Kinematics } from './kinematics.ts';
import { Mechanism } from './mechanism.ts';
import { knobTurn } from './turn.ts';

const HANDLE_COLOUR = 0x1d6fe0;
const ARROW_LENGTH = 40; // LDU, each way
const ARC_ANGLE = 1.8; // radians covered by the turning arc (about 100 degrees)
const MIN_ARC_RADIUS = 10; // LDU, so an arc grabbed near the axle is still visible
// Largest distance the grabbed point moves in one push step, in LDU. Smaller is more exact.
const MAX_STEP = 1;
// Most push steps towards one pointer position.
const MAX_STEPS = 60;
// Largest turn a drag makes in one go, in radians (as Kinematics.turnJoint's steps).
const TURN_STEP = 0.035;
// Most time spent moving the mechanism in one frame of a drag, in milliseconds. Pointer
// movements are gathered up and worked through a frame at a time, so a big model on a slow
// computer still redraws; what's left is done in the next frame.
const FRAME_BUDGET = 25;
// A message in the label (such as "Froze gear 1") stays up this long, in milliseconds, unless
// the pointer moves this far away, in pixels. (A click nearly always moves the pointer a
// little, so a message that went at the first move would hardly be seen.)
const MESSAGE_TIME = 2000;
const MESSAGE_MOVE = 40;
// How fast a part driven by Ctrl-click turns, relative to what its axle is mounted in.
// How fast a part kept turning turns at first, in revolutions per minute (a quarter turn a second).
export const DEFAULT_RPM = 15;
// Largest step a part kept turning takes, in radians (15 degrees): one frame's turn up to
// 150 rpm at 60 frames a second, with room to spare at 100 rpm when a frame runs long. Bigger
// than a drag's steps, to keep up on big models; it's just as exact, except where it runs into
// something, so it creeps up to that in a drag's steps.
const MOTOR_MAX_STEP = (15 * Math.PI) / 180;
// How fast a part kept moving (Ctrl-click on a part that's pushed) moves: this much of the
// model's size along the way it moves, per second.
const MOVE_SPEED = 0.1;

export interface InteractionSetup {
  renderer: WebGLRenderer;
  camera: Camera;
  controls: OrbitControls;
  ldrawSpace: Object3D; // the group in LDraw coordinates
  model: Object3D;
  partNames: string[];
  mech: Mechanism;
  kin: Kinematics;
  appearance: Appearance;
  partTitle: (name: string) => Promise<string>;
  onMoved: () => void; // called after the mechanism moves
  onFreezeChanged: () => void; // called after a part is frozen or unfrozen
  onMotorChanged: () => void; // called after a part starts or stops being kept turning
  onTurned: (part: number, angle: number) => void; // called after a drag turns a part like a knob, by `angle` radians about its joint
  onDragEnded: () => void; // called after any drag
  blockedBy: () => [number, number] | null; // two parts now passing through each other, or slid to the end of their travel, if any
  slideOf: (part: number) => Slide | null; // how a part slides, if it does
  stickOf: (part: number) => { ends: Vector3[]; position: number } | null; // where a gear lever's stick ends in each of its gate positions (LDraw coordinates), and which it's in, if it's one
  shiftStick: (part: number, position: number) => void; // clicks a gear lever into one of its gate positions
  shift: (part: number, position: number) => void; // slides a part to one of its positions
}

// A part that slides into set positions, as it is now (LDraw coordinates, LDU).
export interface Slide {
  at: Vector3; // where the part is
  dir: Vector3; // the way it slides
  position: number; // how far along its slide it is
  positions: number[]; // where it can click in
}

// Shifting a sliding part.
interface Shift {
  pointerId: number;
  part: number;
  startX: number; // where the pointer was pressed
  startY: number;
  startPosition: number; // where the part was then
  lever: boolean; // a gear lever clicking between its gate positions, rather than a part sliding
}

interface Drag {
  pointerId: number;
  part: number; // the part grabbed
  body: number;
  grabStart: Vector3; // the grabbed point, in the body's starting position
  joint: number; // the joint the body turns on (turn), or -1 (push)
  startAngle: number; // how far that joint had turned when the drag started (turn only)
  arc: Group | null; // turn only
  lastX: number; // the pointer's previous position (turn only)
  lastY: number;
  owed: number; // how far the joint has still to turn to catch up with the pointer (turn only)
  sideOn: boolean; // its plane of turning is seen edge-on, so it's turned by pushing its near side (turn only)
  target: Vector2 | null; // where the pointer is, if the grabbed point hasn't got there (push only)
  pushSteps: number; // steps taken towards the target so far (push only)
}

export function setUpInteraction(s: InteractionSetup) {
  const canvas = s.renderer.domElement;
  const label = document.getElementById('label')!;
  const raycaster = new Raycaster();

  const arrow = makeDoubleArrow();
  arrow.visible = false;
  s.ldrawSpace.add(arrow);

  let drag: Drag | null = null;
  let shifting: Shift | null = null;
  let motorPart = -1; // the part kept turning (Ctrl-click), or -1
  // Which way the part kept turning turns about its joint's axis (jointAxisNow): 1 or -1. It
  // starts counter-clockwise as seen from the camera; a second Ctrl-click reverses it.
  let motorDirection = 1;
  let motorReversed = false; // whether it's been reversed since it started (a third Ctrl-click stops it)
  let motorMoved = false; // whether it's turned at all since it started or last turned back
  let motorSpeed = (DEFAULT_RPM / 60) * 2 * Math.PI; // radians per second
  // A part kept moving rather than turning: the point moved (in its body's starting position),
  // the way it's going now (LDraw coordinates, a unit vector), and how fast, in LDU per second.
  let motorPush: { grabStart: Vector3; dir: Vector3; speed: number } | null = null;
  // The kinematics the motor's holds were worked out for, or null if they need working out
  // again (after a drag, a freeze, a shift).
  let motorHeldIn: Kinematics | null = null;
  let ctrlHeld = false; // the Ctrl key is down (see the contextmenu handler)
  let ctrlClickHandled = false; // a press already handled the Ctrl-click a context menu follows
  // True while the label shows a message (such as "Froze ...") rather than the
  // hovered part's name; when and where it was shown.
  let showingMessage = false;
  let messageTime = 0;
  let messageX = 0;
  let messageY = 0;

  // ---------------------------------------------------------------------------
  // Coordinates

  // A point in LDraw coordinates -> pixels in the window.
  function toScreen(p: Vector3): Vector2 {
    const ndc = s.ldrawSpace.localToWorld(p.clone()).project(s.camera);
    return new Vector2(((ndc.x + 1) / 2) * window.innerWidth, ((1 - ndc.y) / 2) * window.innerHeight);
  }

  // The ray from the camera through a pixel, in LDraw coordinates.
  function rayAt(clientX: number, clientY: number): Ray {
    const ndc = new Vector2((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, s.camera);
    const toLdraw = new Matrix4().copy(s.ldrawSpace.matrixWorld).invert();
    return raycaster.ray.clone().applyMatrix4(toLdraw);
  }

  // The part under the pointer and where the pointer touches it (LDraw coordinates), if any.
  function hitAt(clientX: number, clientY: number): { part: number; point: Vector3 } | null {
    const ndc = new Vector2((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, s.camera);
    for (const hit of raycaster.intersectObject(s.model, true)) {
      if (!(hit.object as Mesh).isMesh) continue; // skip edge lines
      let obj: Object3D | null = hit.object;
      while (obj && obj.userData.partIndex === undefined) obj = obj.parent;
      if (obj) return { part: obj.userData.partIndex, point: s.ldrawSpace.worldToLocal(hit.point.clone()) };
    }
    return null;
  }

  // The grabbed point where it is now.
  function grabPoint(d: Drag): Vector3 {
    return d.grabStart.clone().applyMatrix4(s.kin.poses[d.body]);
  }

  // For a turn: the axle's direction (the way the body turns positive about it, relative to
  // its parent) and the point on the axle level with the grabbed point.
  function turnAxis(d: Drag): { hub: Vector3; dir: Vector3 } {
    const { point, dir } = s.kin.jointAxisNow(d.joint);
    if (s.mech.joints[d.joint].bodyA === d.body) dir.negate();
    const g = grabPoint(d);
    const hub = point.addScaledVector(dir, new Vector3().subVectors(g, point).dot(dir));
    return { hub, dir };
  }

  // ---------------------------------------------------------------------------
  // Label

  function placeLabel(clientX: number, clientY: number) {
    const gap = 14;
    const fitsRight = clientX + gap + label.offsetWidth < window.innerWidth;
    const fitsBelow = clientY + gap + label.offsetHeight < window.innerHeight;
    label.style.left = (fitsRight ? clientX + gap : clientX - gap - label.offsetWidth) + 'px';
    label.style.top = (fitsBelow ? clientY + gap : clientY - gap - label.offsetHeight) + 'px';
  }

  function showLabel(text: string, clientX: number, clientY: number) {
    label.style.display = 'block';
    label.textContent = text;
    placeLabel(clientX, clientY);
  }

  // A message in the label, kept for MESSAGE_TIME or until the pointer moves MESSAGE_MOVE away.
  function showMessage(text: string, clientX: number, clientY: number) {
    showLabel(text, clientX, clientY);
    showingMessage = true;
    messageTime = performance.now();
    messageX = clientX;
    messageY = clientY;
  }

  // Why the model can't move the way asked: its tyres would scrub sideways more than Tyre scrub
  // allows (see Kinematics.scrubNeeded), or it's jammed.
  function whyStuck(): string {
    const needed = s.kin.scrubNeeded;
    const percent = (x: number) => `${Math.round(x * 100)}%`;
    return needed === null ? "it's jammed" : `its tyres would scrub ${percent(needed)}, over the ${percent(s.kin.scrub)} allowed`;
  }

  // Where a part is on the screen, in client coordinates.
  function onScreen(part: number): { x: number; y: number } {
    const p = new Vector3().setFromMatrixPosition(s.model.children[part].matrixWorld).project(s.camera);
    const box = s.renderer.domElement.getBoundingClientRect();
    return { x: box.left + ((p.x + 1) / 2) * box.width, y: box.top + ((1 - p.y) / 2) * box.height };
  }

  function hideLabel() {
    label.style.display = 'none';
  }

  // ---------------------------------------------------------------------------
  // Hover

  // While the view is being turned, panned or zoomed, nothing is highlighted: parts sweeping
  // under a still pointer would flicker yellow, and their labels with them.
  let movingView = false;
  s.controls.addEventListener('start', () => {
    movingView = true;
    if (s.appearance.hoveredPart >= 0) {
      s.appearance.hoveredPart = -1;
      s.appearance.update();
    }
    if (!showingMessage) hideLabel();
  });
  s.controls.addEventListener('end', () => (movingView = false));

  function hover(clientX: number, clientY: number) {
    if (movingView) return;
    const hit = hitAt(clientX, clientY);
    const part = hit ? hit.part : -1;
    if (part !== s.appearance.hoveredPart) {
      s.appearance.hoveredPart = part;
      s.appearance.update();
    }
    if (showingMessage) {
      const recent = performance.now() - messageTime < MESSAGE_TIME;
      const near = Math.hypot(clientX - messageX, clientY - messageY) < MESSAGE_MOVE;
      if (recent && near) return; // leave the message up
      showingMessage = false;
    }
    if (part < 0) {
      hideLabel();
      return;
    }
    const name = s.partNames[part];
    const number = name.replace(/\.dat$/, '');
    const role = s.mech.roles[part];
    const body = s.mech.bodies[s.mech.bodyOf[part]].name;
    showLabel(`${number} · ${role} · ${body}`, clientX, clientY);
    s.partTitle(name).then((title) => {
      if (s.appearance.hoveredPart === part && !drag && !showingMessage) showLabel(`${number} ${title} · ${role} · ${body}`, clientX, clientY);
    });
  }

  // ---------------------------------------------------------------------------
  // Push: arrow and drag

  // Points the arrow along the way the grabbed point moves fastest, of the motions the
  // mechanism allows (pushing a car's frame rolls it, rather than steering, which leaves the
  // frame where it is). Returns false if the point can't move.
  function updateArrow(d: Drag): boolean {
    const g = grabPoint(d);
    let direction = new Vector3();
    for (const m of s.kin.freeMotions()) {
      const v = s.kin.pointVelocity(m, d.body, g);
      if (v.length() > direction.length()) direction = v;
    }
    if (direction.length() < 1e-9) {
      arrow.visible = false;
      return false;
    }
    arrow.position.copy(g);
    arrow.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize()); // built along y
    arrow.visible = true;
    return true;
  }

  // Moves the mechanism, in small steps, so the grabbed point gets as close as it can to the
  // pointer on screen. Each step works out, for every allowed motion, how far the grabbed
  // point would move on screen, and picks the mix of motions that best closes the gap
  // (least squares). Returns false if it ran out of time (`deadline`, from performance.now())
  // before getting there, else true (there, or as near as it can get).
  function pushTowards(d: Drag, target: Vector2, deadline: number): boolean {
    for (; d.pushSteps < MAX_STEPS; d.pushSteps++) {
      if (performance.now() > deadline) return false;
      const motions = s.kin.freeMotions();
      if (motions.length === 0) return true;
      const g = grabPoint(d);
      const gScreen = toScreen(g);
      const gap = target.clone().sub(gScreen);
      if (gap.length() < 0.5) return true;

      // For each motion: how fast the point moves in LDU, and in pixels on screen.
      const speeds: Vector3[] = [];
      const screenSpeeds: Vector2[] = [];
      for (const m of motions) {
        const v = s.kin.pointVelocity(m, d.body, g);
        speeds.push(v);
        const h = 1 / Math.max(v.length(), 1e-9); // a nudge that moves the point 1 LDU
        screenSpeeds.push(toScreen(g.clone().addScaledVector(v, h)).sub(gScreen).divideScalar(h));
      }

      const amounts = leastSquares(screenSpeeds, gap);
      if (!amounts) return true;
      // Limit how far the point moves in one step.
      const move = new Vector3();
      amounts.forEach((a, i) => move.addScaledVector(speeds[i], a));
      if (move.length() < 1e-6) return true;
      const scale = Math.min(1, MAX_STEP / move.length());
      const combined = new Array(motions[0].length).fill(0);
      motions.forEach((m, i) => m.forEach((x, k) => (combined[k] += x * amounts[i] * scale)));
      const before = s.kin.snapshot();
      s.kin.advance(combined, 1);
      if (stopIfBlocked(before)) return true;
    }
    return true;
  }

  // ---------------------------------------------------------------------------
  // Turn: arc and drag

  // Places the arc around the axle, centred on the grabbed point, so it turns with the part
  // and travels with whatever the axle is mounted in.
  function updateArc(d: Drag) {
    if (!d.arc) return; // the part can't turn, so there's no arc
    const { hub, dir } = turnAxis(d);
    const outward = new Vector3().subVectors(grabPoint(d), hub);
    if (outward.length() < 1e-6) outward.copy(perpendicularTo(dir));
    outward.normalize();
    const side = new Vector3().crossVectors(dir, outward);
    d.arc.position.copy(hub);
    d.arc.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(outward, side, dir)); // arc built in its x-y plane
    d.arc.visible = true;
  }

  // Owes the part a turn about its axle like a knob, by the angle the pointer swept around the
  // axle since its last position (see turn.ts). Seen side-on, where that doesn't work, it
  // instead owes it how far the pointer moved along the way the part's side nearest the camera
  // turns on screen, as if pushing that side. Not the grabbed point's way: seen side-on, that
  // reverses as the turn carries the grabbed point past the near side, and the part would turn
  // back and forth. Once side-on, a drag stays so, rather than switching to and fro as the
  // pointer crosses where it becomes side-on. (turnOwed makes the turn.)
  function turnTowards(d: Drag, clientX: number, clientY: number) {
    const { hub, dir } = turnAxis(d);
    const outward = new Vector3().subVectors(grabPoint(d), hub);
    const minRadius = Math.max(outward.length() / 2, 1);
    let angle = d.sideOn ? null : knobTurn({ hub, dir, from: rayAt(d.lastX, d.lastY), to: rayAt(clientX, clientY), minRadius });
    if (angle === null) {
      d.sideOn = true;
      // The side nearest the camera, and where it would move per radian, turning about a still axle.
      const radius = Math.max(outward.length(), MIN_ARC_RADIUS);
      const toCamera = s.ldrawSpace.worldToLocal(s.camera.position.clone()).sub(hub);
      const near = toCamera.addScaledVector(dir, -toCamera.dot(dir));
      if (near.lengthSq() < 1e-9) return; // looking along the axle: not side-on at all
      near.setLength(radius);
      const nearPoint = hub.clone().add(near);
      const perRadian = new Vector3().crossVectors(dir, near);
      const screenPerRadian = toScreen(nearPoint.clone().add(perRadian)).sub(toScreen(nearPoint));
      if (screenPerRadian.lengthSq() < 1e-6) return;
      const moved = new Vector2(clientX - d.lastX, clientY - d.lastY);
      angle = Math.max(-0.5, Math.min(0.5, moved.dot(screenPerRadian) / screenPerRadian.lengthSq()));
    }
    // The joint's angle is bodyB relative to bodyA, so flip it if we're turning bodyA.
    const sign = s.mech.joints[d.joint].bodyB === d.body ? 1 : -1;
    d.owed += sign * angle;
  }

  // Turns the part by what it's owed, a step at a time, until `deadline` (from
  // performance.now()). If it runs into something, it stops there and is owed nothing more.
  function turnOwed(d: Drag, deadline: number) {
    const allowed = () => {
      const pair = s.blockedBy();
      if (pair) s.appearance.flashBlocked(pair);
      return !pair;
    };
    while (d.owed !== 0 && performance.now() < deadline) {
      const step = Math.sign(d.owed) * Math.min(Math.abs(d.owed), TURN_STEP);
      const turned = s.kin.turnJoint(d.joint, step, allowed);
      d.owed = Math.abs(turned - step) > 1e-12 ? 0 : d.owed - step;
      if (Math.abs(d.owed) < 1e-12) d.owed = 0;
    }
  }

  // Works through the drag's pointer movements for up to FRAME_BUDGET, once a frame, as long
  // as there's some left.
  let working = false;
  function workSoon() {
    if (working) return;
    working = true;
    requestAnimationFrame(() => {
      working = false;
      if (!drag) return;
      work(drag);
      if (drag.owed !== 0 || drag.target) workSoon();
    });
  }

  function work(d: Drag) {
    const deadline = performance.now() + FRAME_BUDGET;
    if (d.joint >= 0) {
      turnOwed(d, deadline);
      updateArc(d);
    } else if (d.target) {
      if (pushTowards(d, d.target, deadline)) d.target = null;
      updateArrow(d);
    }
    s.onMoved();
  }

  // If the last step made two parts pass through each other, puts everything back where it
  // was before the step, outlines the two parts in red, and says so.
  function stopIfBlocked(before: ReturnType<Kinematics['snapshot']>): boolean {
    const pair = s.blockedBy();
    if (!pair) return false;
    s.kin.restore(before);
    s.appearance.flashBlocked(pair);
    return true;
  }

  // ---------------------------------------------------------------------------
  // Shift: arrow and drag

  // Points the arrow along the way the part slides.
  function showSlideArrow(slide: Slide) {
    arrow.position.copy(slide.at);
    arrow.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), slide.dir); // built along y
    arrow.visible = true;
  }

  // Slides the part to the position nearest to where the pointer has dragged it, if that's
  // not where it is.
  function shiftTowards(sh: Shift, clientX: number, clientY: number) {
    const slide = s.slideOf(sh.part)!;
    // How far the part's middle moves on screen per LDU of slide.
    const atScreen = toScreen(slide.at);
    const perLdu = toScreen(slide.at.clone().add(slide.dir)).sub(atScreen);
    if (perLdu.lengthSq() < 1e-6) return; // sliding straight towards the camera
    const moved = new Vector2(clientX - sh.startX, clientY - sh.startY);
    const wanted = sh.startPosition + moved.dot(perLdu) / perLdu.lengthSq();
    const nearest = slide.positions.reduce((best, p) => (Math.abs(p - wanted) < Math.abs(best - wanted) ? p : best));
    if (Math.abs(nearest - slide.position) < 1e-6) return;
    s.shift(sh.part, nearest);
    showSlideArrow(s.slideOf(sh.part)!);
  }

  // Clicks a gear lever into the gate position where its stick's end is nearest the pointer
  // on screen, if that's not where it is.
  function leverTowards(sh: Shift, clientX: number, clientY: number) {
    const stick = s.stickOf(sh.part);
    if (!stick) return;
    const pointer = new Vector2(clientX, clientY);
    const distances = stick.ends.map((end) => toScreen(end).distanceTo(pointer));
    const nearest = distances.indexOf(Math.min(...distances));
    if (nearest !== stick.position) s.shiftStick(sh.part, nearest);
  }

  // ---------------------------------------------------------------------------
  // Freezing parts

  function toggleFreeze(body: number, clientX: number, clientY: number) {
    const name = s.mech.bodies[body].name;
    if (body === 0 && s.kin.frameFixed()) {
      showMessage(`The ${name} already stays put: the model has no means of locomotion`, clientX, clientY);
      return;
    }
    s.kin.toggleFreeze(body);
    motorHeldIn = null; // the motor's holds need working out again
    s.onFreezeChanged();
    const text = s.kin.isFrozen(body) ? `Froze ${name} · Alt-click again to unfreeze` : `Unfroze ${name}`;
    showMessage(text, clientX, clientY);
  }

  // ---------------------------------------------------------------------------
  // Motor: a part kept turning

  function setMotor(part: number) {
    if (motorHeldIn === s.kin) s.kin.letGoAfterDrag();
    motorHeldIn = null;
    if (part < 0) motorPush = null;
    motorPart = part;
    s.appearance.drivenPart = part;
    s.appearance.update();
    s.onMotorChanged();
  }

  // Ctrl-click: starts the part turning; on a part already turning, turns it the other way;
  // on one already turned round, stops it.
  function cycleMotor(part: number, clientX: number, clientY: number) {
    const body = s.mech.bodyOf[part];
    const name = s.mech.bodies[body].name;
    if (motorPart >= 0 && s.mech.bodyOf[motorPart] === body) {
      if (!motorReversed) {
        reverseMotor();
        showMessage(`${motorPush ? 'Moving' : 'Turning'} ${name} the other way · Ctrl-click again to stop`, clientX, clientY);
      } else {
        setMotor(-1);
        showMessage(`Stopped ${name}`, clientX, clientY);
      }
      return;
    }
    const why = startMotor(part, s.camera.position, false);
    showMessage(why ?? `${motorPush ? 'Moving' : 'Turning'} ${name} · Ctrl-click again to reverse`, clientX, clientY);
  }

  // Keeps a part turning, counter-clockwise (or clockwise) as seen from `seenFrom` (world
  // coordinates). Returns why it can't, if it can't.
  // A part that doesn't spin on an axle is kept moving instead (see startPush), away from
  // `seenFrom`, or with `clockwise`, towards it.
  function startMotor(part: number, seenFrom: Vector3, clockwise: boolean): string | null {
    const body = s.mech.bodyOf[part];
    const link = s.kin.parentLink(body);
    if (s.slideOf(part) || s.stickOf(part)) return "A part that clicks into set positions can't be kept moving: drag it";
    if (!link || !s.kin.turnsLikeAKnob(body)) return startPush(part, seenFrom, clockwise);
    const wormLocked = s.kin.holdWhatTheDragDoesntNeed(body, () => s.kin.jointMotion(link.joint) !== null, link.joint);
    const canTurn = s.kin.jointMotion(link.joint) !== null;
    s.kin.letGoAfterDrag();
    if (!canTurn) return `This part can't turn: ${wormLocked ? 'a worm gear can only be turned from the worm' : whyStuck()}`;
    motorDirection = counterClockwiseFrom(part, seenFrom) * (clockwise ? -1 : 1);
    motorReversed = false;
    motorMoved = false;
    motorPush = null;
    setMotor(part);
    return null;
  }

  // Keeps a part moving as a push would move its middle: of the ways it can go, the one nearest
  // straight away from `seenFrom` (world coordinates), or with `back`, towards it, at MOVE_SPEED
  // of the model's size that way per second. Returns why it can't, if it can't.
  function startPush(part: number, seenFrom: Vector3, back: boolean): string | null {
    const body = s.mech.bodyOf[part];
    const g = s.ldrawSpace.worldToLocal(new Box3().setFromObject(s.model.children[part]).getCenter(new Vector3()));
    const directions = pointDirections(body, g);
    const wormLocked = directions > 0 && s.kin.holdWhatTheDragDoesntNeed(body, () => pointDirections(body, g) === directions);
    const speeds = s.kin.freeMotions().map((m) => s.kin.pointVelocity(m, body, g));
    s.kin.letGoAfterDrag();
    if (directions === 0 || speeds.every((v) => v.length() < 1e-9)) {
      const why = wormLocked ? 'a worm gear can only be turned from the worm' : s.kin.frameFixed() && body === 0 ? 'the model has no means of locomotion' : whyStuck();
      return `This part can't move: ${why}`;
    }
    const away = g.clone().sub(s.ldrawSpace.worldToLocal(seenFrom.clone())).normalize();
    const amounts = leastSquares(speeds, away);
    const dir = new Vector3();
    if (amounts) amounts.forEach((a, i) => dir.addScaledVector(speeds[i], a));
    if (dir.length() < 1e-6) dir.copy(speeds.reduce((a, b) => (b.length() > a.length() ? b : a)));
    dir.normalize();
    // The model's size along that way.
    const size = new Box3().setFromObject(s.model).getSize(new Vector3());
    const extent = Math.abs(dir.x) * size.x + Math.abs(dir.y) * size.y + Math.abs(dir.z) * size.z;
    motorDirection = back ? -1 : 1;
    if (back) dir.negate();
    motorReversed = false;
    motorMoved = false;
    motorPush = { grabStart: g.applyMatrix4(s.kin.poses[body].clone().invert()), dir, speed: MOVE_SPEED * extent };
    setMotor(part);
    return null;
  }

  // The motor direction that turns a part counter-clockwise as seen from `seenFrom` (world
  // coordinates): about its joint's axis pointing towards there, where the joint is now, or with
  // `atStart`, where it was when the model loaded. (The part turns at motorDirection about its
  // joint's axis, relative to what it's mounted in.)
  function counterClockwiseFrom(part: number, seenFrom: Vector3, atStart = false): number {
    const link = s.kin.parentLink(s.mech.bodyOf[part])!;
    const j = s.mech.joints[link.joint];
    const { point, dir } = atStart ? { point: j.from.clone(), dir: j.to.clone().sub(j.from).normalize() } : s.kin.jointAxisNow(link.joint);
    const toCamera = s.ldrawSpace.worldToLocal(seenFrom.clone()).sub(point);
    return dir.dot(toCamera) < 0 ? -1 : 1;
  }

  // Which way a part turns counter-clockwise as seen from `seenFrom` (world coordinates), with
  // the model as it was when it loaded, about its joint: 1 if that's the way its joint's angle
  // grows, -1 if not, or null if it doesn't turn like a knob.
  function turnSense(part: number, seenFrom: Vector3): number | null {
    const body = s.mech.bodyOf[part];
    const link = s.kin.parentLink(body);
    if (!link || !s.kin.turnsLikeAKnob(body)) return null;
    const sign = s.mech.joints[link.joint].bodyB === body ? 1 : -1;
    return sign * counterClockwiseFrom(part, seenFrom, true);
  }

  // Turns a part like a knob by `angle` radians, counter-clockwise as seen from `seenFrom`
  // (world coordinates), with the model as it was when it loaded, as a drag would: holding what
  // that doesn't need, and stopping where parts would run into each other. Returns how far it
  // turned.
  function turnPart(part: number, angle: number, seenFrom: Vector3): number {
    const body = s.mech.bodyOf[part];
    const link = s.kin.parentLink(body);
    if (!link || !s.kin.turnsLikeAKnob(body)) return 0;
    const sign = s.mech.joints[link.joint].bodyB === body ? 1 : -1;
    const way = sign * counterClockwiseFrom(part, seenFrom, true);
    s.kin.holdWhatTheDragDoesntNeed(body, () => s.kin.jointMotion(link.joint) !== null, link.joint);
    const allowed = () => s.blockedBy() === null;
    const turned = s.kin.turnJoint(link.joint, way * angle, allowed);
    s.kin.letGoAfterDrag();
    motorHeldIn = null;
    s.onMoved();
    return turned * way;
  }

  function reverseMotor() {
    motorDirection = -motorDirection;
    motorPush?.dir.negate();
    motorReversed = !motorReversed;
    s.onMotorChanged();
  }

  // Turns the driven part on by however far it goes in `seconds`, as a turn drag would but in
  // steps of up to MOTOR_MAX_STEP. Waits while the user drags something else. Stops for good if
  // it can't turn (it's run into something, or a frozen part jams it). Its holds are worked out
  // once and kept while it runs (working them out takes longer than the step itself on a big
  // model), and again if a step fails with them, before giving up.
  function runMotor(seconds: number) {
    if (motorPart < 0 || drag) return;
    if (motorPush) return runPush(motorPush, seconds);
    const body = s.mech.bodyOf[motorPart];
    const link = s.kin.parentLink(body);
    if (!link) {
      setMotor(-1);
      return;
    }
    const sign = s.mech.joints[link.joint].bodyB === body ? 1 : -1;
    const angle = sign * motorDirection * motorSpeed * seconds;
    let turned = 0;
    let blocked = false;
    const allowed = () => {
      const pair = s.blockedBy();
      if (pair) s.appearance.flashBlocked(pair);
      blocked = pair !== null; // ran into something: fresh holds won't help
      return !pair;
    };
    for (let attempt = 0; attempt < 2 && !blocked && Math.abs(turned - angle) > 1e-9; attempt++) {
      if (motorHeldIn !== s.kin || attempt > 0) {
        s.kin.holdWhatTheDragDoesntNeed(body, () => s.kin.jointMotion(link.joint) !== null, link.joint);
        motorHeldIn = s.kin;
      }
      turned += s.kin.turnJoint(link.joint, angle - turned, allowed, MOTOR_MAX_STEP);
    }
    // A big step that ran into something: creep up to it in a drag's small steps, so the
    // motor gets as far as a drag would.
    if (blocked) turned += s.kin.turnJoint(link.joint, angle - turned, allowed);
    if (Math.abs(turned) > 1e-9) motorMoved = true;
    if (Math.abs(turned - angle) > 1e-9) {
      // At the end of its travel (it ran into something, a slide or rack ran out, or a linkage
      // came to a dead point), it turns back, as long as it got somewhere since it last did:
      // else it's stuck both ways, and stops. If it can't turn at all, it stops.
      if ((blocked || s.kin.atDeadPoint(link.joint)) && motorMoved) {
        motorDirection = -motorDirection;
        motorMoved = false;
        s.onMotorChanged();
      } else {
        // Stuck both ways, or it can't turn at all: it stops, and if that's because its tyres
        // would have to scrub too much, says so.
        const scrubbing = !blocked && s.kin.scrubNeeded !== null;
        const at = onScreen(motorPart);
        setMotor(-1);
        if (scrubbing) showMessage(`Stopped: ${whyStuck()}`, at.x, at.y);
      }
    }
    s.onMoved();
  }

  // Moves the part kept moving on by however far it goes in `seconds`, in steps of up to
  // MAX_STEP as a push drag would, each the mix of the ways it can go nearest the way it was
  // going, so it follows a curve (a steered car rolling round). Where it can go no further that
  // way (it runs into something, or a slide runs out), it turns back, as long as it got
  // somewhere since it last did; else it stops.
  function runPush(push: NonNullable<typeof motorPush>, seconds: number) {
    const body = s.mech.bodyOf[motorPart];
    const distance = push.speed * seconds;
    let moved = 0;
    let stuck = false;
    for (let attempt = 0; attempt < 2 && moved < distance - 1e-9; attempt++) {
      if (motorHeldIn !== s.kin || attempt > 0) {
        const g = push.grabStart.clone().applyMatrix4(s.kin.poses[body]);
        const directions = pointDirections(body, g);
        if (directions > 0) s.kin.holdWhatTheDragDoesntNeed(body, () => pointDirections(body, push.grabStart.clone().applyMatrix4(s.kin.poses[body])) === directions);
        motorHeldIn = s.kin;
      }
      stuck = false;
      while (moved < distance - 1e-9) {
        const step = Math.min(MAX_STEP, distance - moved);
        const g = push.grabStart.clone().applyMatrix4(s.kin.poses[body]);
        const motions = s.kin.freeMotions();
        const speeds = motions.map((m) => s.kin.pointVelocity(m, body, g));
        const amounts = motions.length ? leastSquares(speeds, push.dir) : null;
        const move = new Vector3();
        if (amounts) amounts.forEach((a, i) => move.addScaledVector(speeds[i], a));
        // Nowhere to go, or only well off the way it was going.
        if (!amounts || move.length() < 1e-6 || move.clone().normalize().dot(push.dir) < 0.5) {
          stuck = true;
          break;
        }
        const scale = step / move.length();
        const combined = new Array(motions[0].length).fill(0);
        motions.forEach((m, i) => m.forEach((x, k) => (combined[k] += x * amounts[i] * scale)));
        const before = s.kin.snapshot();
        s.kin.advance(combined, 1);
        const pair = s.blockedBy();
        if (pair) {
          s.kin.restore(before);
          s.appearance.flashBlocked(pair);
          stuck = true;
          attempt = 2; // ran into something: fresh holds won't help
          break;
        }
        const now = push.grabStart.clone().applyMatrix4(s.kin.poses[body]).sub(g);
        if (now.length() > 1e-9) push.dir.copy(now.normalize());
        moved += step;
        motorMoved = true;
      }
    }
    if (stuck) {
      if (motorMoved) {
        reverseMotor();
        motorReversed = false;
        motorMoved = false;
      } else {
        const scrubbing = s.kin.scrubNeeded !== null;
        const at = onScreen(motorPart);
        setMotor(-1);
        if (scrubbing) showMessage(`Stopped: ${whyStuck()}`, at.x, at.y);
      }
    }
    s.onMoved();
  }

  // ---------------------------------------------------------------------------
  // Press, move, release

  // In how many independent directions the grabbed point can move.
  function grabDirections(d: Drag): number {
    return pointDirections(d.body, grabPoint(d));
  }

  // In how many independent directions a point on a body can move.
  function pointDirections(body: number, g: Vector3): number {
    const basis: Vector3[] = [];
    for (const m of s.kin.freeMotions()) {
      const v = s.kin.pointVelocity(m, body, g);
      for (const b of basis) v.addScaledVector(b, -v.dot(b));
      if (v.length() > 1e-6) basis.push(v.normalize());
    }
    return basis.length;
  }

  function endDrag() {
    motorHeldIn = null; // the drag replaced the motor's holds with its own
    if (shifting) {
      if (canvas.hasPointerCapture(shifting.pointerId)) canvas.releasePointerCapture(shifting.pointerId);
      shifting = null;
      arrow.visible = false;
      s.controls.enabled = true;
    }
    if (!drag) return;
    s.kin.letGoAfterDrag();
    const turned = drag.joint >= 0 ? s.kin.jointAngles[drag.joint] - drag.startAngle : 0;
    if (canvas.hasPointerCapture(drag.pointerId)) canvas.releasePointerCapture(drag.pointerId);
    if (drag.arc) {
      s.ldrawSpace.remove(drag.arc);
      drag.arc.traverse((o) => (o as Mesh).geometry?.dispose());
    }
    const part = drag.part;
    drag = null;
    arrow.visible = false;
    s.controls.enabled = true;
    if (Math.abs(turned) > 1e-9) s.onTurned(part, turned);
    s.onDragEnded();
  }

  // Runs before the camera controls see the press (capture phase), so a press on a part
  // can switch the camera off before it starts turning.
  canvas.addEventListener(
    'pointerdown',
    (e) => {
      if (drag || shifting) return; // already dragging with another finger or pointer
      ctrlClickHandled = false;
      hover(e.clientX, e.clientY);
      const hit = hitAt(e.clientX, e.clientY);
      if (!hit) return; // empty space: let the camera turn
      if (e.altKey) {
        // Alt-click: freeze the part's body, or unfreeze it. Keep the camera from turning.
        e.stopImmediatePropagation();
        toggleFreeze(s.mech.bodyOf[hit.part], e.clientX, e.clientY);
        return;
      }
      if (e.ctrlKey || ctrlHeld) {
        // Ctrl-click: keep the part turning, turn it the other way, or stop it. Keep the camera
        // from moving.
        e.stopImmediatePropagation();
        ctrlClickHandled = true;
        cycleMotor(hit.part, e.clientX, e.clientY);
        return;
      }
      s.controls.enabled = false;
      // Keep receiving moves when the pointer leaves the canvas. (Can fail for synthetic events.)
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {}

      const stick = s.stickOf(hit.part);
      if (stick) {
        shifting = { pointerId: e.pointerId, part: hit.part, startX: e.clientX, startY: e.clientY, startPosition: stick.position, lever: true };
        hideLabel();
        return;
      }
      const slide = s.slideOf(hit.part);
      if (slide) {
        shifting = { pointerId: e.pointerId, part: hit.part, startX: e.clientX, startY: e.clientY, startPosition: slide.position, lever: false };
        hideLabel();
        showSlideArrow(slide);
        return;
      }

      const body = s.mech.bodyOf[hit.part];
      const grabStart = hit.point.clone().applyMatrix4(s.kin.poses[body].clone().invert());
      // A part that turns like a knob is turned; anything else (a frame, a piston, a connecting
      // rod) is pushed.
      const link = s.kin.parentLink(body);
      const joint = link && s.kin.turnsLikeAKnob(body) ? link.joint : -1;
      drag = { pointerId: e.pointerId, part: hit.part, body, grabStart, joint, startAngle: joint >= 0 ? s.kin.jointAngles[joint] : 0, arc: null, lastX: e.clientX, lastY: e.clientY, owed: 0, target: null, pushSteps: 0, sideOn: false };
      hideLabel();

      // Hold still whatever this drag doesn't need to move.
      const d = drag;
      let wormLocked = false;
      if (d.joint >= 0) {
        wormLocked = s.kin.holdWhatTheDragDoesntNeed(body, () => s.kin.jointMotion(d.joint) !== null, d.joint);
      } else {
        const directions = grabDirections(d);
        if (directions > 0) wormLocked = s.kin.holdWhatTheDragDoesntNeed(body, () => grabDirections(d) === directions);
      }
      const canMove = d.joint >= 0 ? s.kin.jointMotion(d.joint) !== null : grabDirections(d) > 0;

      if (!canMove && wormLocked) {
        showMessage("This part can't move: a worm gear can only be turned from the worm", e.clientX, e.clientY);
      } else if (s.kin.freeMotions().length === 0) {
        showMessage("Can't move: the mechanism is jammed", e.clientX, e.clientY);
      } else if (drag.joint >= 0) {
        const { hub } = turnAxis(drag);
        const radius = Math.max(hit.point.distanceTo(hub), MIN_ARC_RADIUS);
        drag.arc = makeArc(radius);
        s.ldrawSpace.add(drag.arc);
        updateArc(drag);
      } else if (!updateArrow(drag)) {
        const why = s.kin.frameFixed() ? 'the model has no means of locomotion' : whyStuck();
        showMessage(`This part can't move: ${why}`, e.clientX, e.clientY);
      }
    },
    { capture: true },
  );

  // On a Mac, Ctrl-click is the system's right click, and browsers report it in different
  // ways: as a right-button press, sometimes without the Ctrl flag, or mainly as a context
  // menu event. So the Ctrl key is also tracked on its own, and a Ctrl context menu event on a
  // part counts as a Ctrl-click if no press already did.
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Control') ctrlHeld = true;
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === 'Control') ctrlHeld = false;
  });
  window.addEventListener('blur', () => (ctrlHeld = false));
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (ctrlClickHandled || !(e.ctrlKey || ctrlHeld)) {
      ctrlClickHandled = false;
      return;
    }
    const hit = hitAt(e.clientX, e.clientY);
    if (hit) cycleMotor(hit.part, e.clientX, e.clientY);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (shifting) {
      if (e.pointerId === shifting.pointerId) (shifting.lever ? leverTowards : shiftTowards)(shifting, e.clientX, e.clientY);
      return;
    }
    if (!drag) {
      hover(e.clientX, e.clientY);
      return;
    }
    if (e.pointerId !== drag.pointerId) return; // another finger or pointer
    if (drag.joint >= 0) {
      turnTowards(drag, e.clientX, e.clientY);
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;
    } else {
      drag.target = new Vector2(e.clientX, e.clientY);
      drag.pushSteps = 0;
    }
    workSoon();
  });

  canvas.addEventListener('pointerup', (e) => {
    // A last movement not yet worked through (let go within a frame of it) is, first.
    if (e.pointerId === drag?.pointerId && (drag.owed !== 0 || drag.target)) work(drag);
    if (e.pointerId === drag?.pointerId || e.pointerId === shifting?.pointerId) endDrag();
  });
  canvas.addEventListener('pointercancel', (e) => {
    if (e.pointerId === drag?.pointerId || e.pointerId === shifting?.pointerId) endDrag();
  });
  canvas.addEventListener('pointerleave', () => {
    if (drag || shifting) return;
    s.appearance.hoveredPart = -1;
    s.appearance.update();
    hideLabel();
  });

  return {
    runMotor, // call every frame with the seconds since the last
    stopMotor: () => setMotor(-1),
    reverseMotor,
    startMotor, // (part, seenFrom, clockwise): see startMotor
    motorPart: () => motorPart,
    turnSense, // (part, seenFrom): see turnSense
    turnPart, // (part, angle, seenFrom): see turnPart
    // Whether the part kept turning turns clockwise as seen from `seenFrom` (world coordinates),
    // with the model as it was when it loaded.
    // A part kept moving, rather than turning: whether it's going the other way from how it started.
    motorClockwiseFrom: (seenFrom: Vector3) => motorPart >= 0 && (motorPush ? motorDirection < 0 : motorDirection !== counterClockwiseFrom(motorPart, seenFrom, true)),
    setMotorRpm: (rpm: number) => (motorSpeed = (rpm / 60) * 2 * Math.PI),
    // The ways the mechanism can move have changed (tyres may scrub more or less), so the
    // motor's holds need working out again.
    motionsChanged: () => {
      if (motorHeldIn === s.kin) s.kin.letGoAfterDrag();
      motorHeldIn = null;
    },
    motorRunning: () => motorPart >= 0,
  };
}

// ---------------------------------------------------------------------------
// Handles

const handleMaterial = new MeshBasicMaterial({ color: HANDLE_COLOUR, depthTest: false, transparent: true, opacity: 0.9 });

// A two-headed arrow through the origin along y, drawn on top of the parts.
function makeDoubleArrow(): Group {
  const headLength = 10;
  const shaft = new Mesh(new CylinderGeometry(1.5, 1.5, 2 * (ARROW_LENGTH - headLength), 12), handleMaterial);
  const tip = new Mesh(new ConeGeometry(5, headLength, 16), handleMaterial);
  tip.position.y = ARROW_LENGTH - headLength / 2;
  const tail = new Mesh(new ConeGeometry(5, headLength, 16), handleMaterial);
  tail.position.y = -(ARROW_LENGTH - headLength / 2);
  tail.rotation.x = Math.PI; // point the other way
  return onTop(new Group().add(shaft, tip, tail));
}

// An arc of a circle around the origin in the x-y plane, centred on the +x axis, with an
// arrowhead at each end pointing on around the circle.
function makeArc(radius: number): Group {
  const ring = new Mesh(new TorusGeometry(radius, 1.5, 8, 48, ARC_ANGLE), handleMaterial);
  ring.rotation.z = -ARC_ANGLE / 2; // the torus starts at +x; centre it there
  const group = new Group().add(ring);
  for (const end of [1, -1]) {
    const angle = (end * ARC_ANGLE) / 2;
    const head = new Mesh(new ConeGeometry(5, 10, 16), handleMaterial);
    head.position.set(radius * Math.cos(angle), radius * Math.sin(angle), 0);
    // The cone points along +y; turn it to point along the circle, away from the arc.
    head.rotation.z = angle + (end > 0 ? 0 : Math.PI);
    group.add(head);
  }
  return onTop(group);
}

// Draws a handle after the parts, through them.
function onTop(group: Group): Group {
  group.traverse((o) => (o.renderOrder = 20));
  return group;
}

// Any unit vector at right angles to `d`.
function perpendicularTo(d: Vector3): Vector3 {
  const helper = Math.abs(d.x) < 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
  return new Vector3().crossVectors(d, helper).normalize();
}

// The amounts a_i that make  Σ a_i · columns_i  as close as possible to `target`, slightly
// damped so a motion that barely shows on screen doesn't get a huge amount.
function leastSquares(columns: (Vector2 | Vector3)[], target: Vector2 | Vector3): number[] | null {
  const dot = (u: Vector2 | Vector3, v: Vector2 | Vector3) => u.toArray().reduce((sum: number, x: number, i: number) => sum + x * v.toArray()[i], 0);
  const k = columns.length;
  const a: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < k; i++) {
    a.push([]);
    for (let j = 0; j < k; j++) a[i].push(dot(columns[i], columns[j]) + (i === j ? 1e-3 : 0));
    b.push(dot(columns[i], target));
  }
  // Gaussian elimination on the small k × k system.
  for (let c = 0; c < k; c++) {
    let best = c;
    for (let r = c + 1; r < k; r++) if (Math.abs(a[r][c]) > Math.abs(a[best][c])) best = r;
    if (Math.abs(a[best][c]) < 1e-12) return null;
    [a[c], a[best]] = [a[best], a[c]];
    [b[c], b[best]] = [b[best], b[c]];
    for (let r = 0; r < k; r++) {
      if (r === c) continue;
      const f = a[r][c] / a[c][c];
      for (let j = c; j < k; j++) a[r][j] -= f * a[c][j];
      b[r] -= f * b[c];
    }
  }
  return b.map((x, i) => x / a[i][i]);
}
