// Pointer interaction in the 3D view (see "Interaction" in the README):
//   hover    highlight the part under the pointer, tint its body, label it
//   press    show how the grabbed point can move: an arrow (push) or an arc (turn)
//   drag     move the mechanism so the grabbed point follows the pointer
//   release  leave the model where it is
//   Alt-click   freeze a part, or unfreeze it
//   Ctrl-click  keep a part that spins on an axle turning on its own (a motor), or stop it;
//               with Shift, it turns the other way
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
// Most push steps per pointer movement.
const MAX_STEPS = 60;
// A message in the label (such as "Froze gear 1") stays up this long, in milliseconds, unless
// the pointer moves this far away, in pixels. (A click nearly always moves the pointer a
// little, so a message that went at the first move would hardly be seen.)
const MESSAGE_TIME = 2000;
const MESSAGE_MOVE = 40;
// How fast a part driven by Ctrl-click turns, relative to what its axle is mounted in.
const MOTOR_SPEED = Math.PI / 2; // radians per second: a quarter turn

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
  blockedBy: () => [number, number] | null; // two parts now passing through each other, or slid to the end of their travel, if any
  slideOf: (part: number) => Slide | null; // how a part slides, if it does
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
}

interface Drag {
  pointerId: number;
  body: number;
  grabStart: Vector3; // the grabbed point, in the body's starting position
  joint: number; // the joint the body turns on (turn), or -1 (push)
  arc: Group | null; // turn only
  lastX: number; // the pointer's previous position (turn only)
  lastY: number;
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
  let motorDirection = 1; // 1, or -1 for the other way (Shift-Ctrl-click)
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

  function hideLabel() {
    label.style.display = 'none';
  }

  // ---------------------------------------------------------------------------
  // Hover

  function hover(clientX: number, clientY: number) {
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

  // Points the arrow along the grabbed point's allowed motion (the first one, if several).
  // Returns false if the point can't move.
  function updateArrow(d: Drag): boolean {
    const motions = s.kin.freeMotions();
    const g = grabPoint(d);
    const direction = motions.length ? s.kin.pointVelocity(motions[0], d.body, g) : new Vector3();
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
  // (least squares).
  function pushTowards(d: Drag, clientX: number, clientY: number) {
    const target = new Vector2(clientX, clientY);
    for (let step = 0; step < MAX_STEPS; step++) {
      const motions = s.kin.freeMotions();
      if (motions.length === 0) return;
      const g = grabPoint(d);
      const gScreen = toScreen(g);
      const gap = target.clone().sub(gScreen);
      if (gap.length() < 0.5) return;

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
      if (!amounts) return;
      // Limit how far the point moves in one step.
      const move = new Vector3();
      amounts.forEach((a, i) => move.addScaledVector(speeds[i], a));
      if (move.length() < 1e-6) return;
      const scale = Math.min(1, MAX_STEP / move.length());
      const combined = new Array(motions[0].length).fill(0);
      motions.forEach((m, i) => m.forEach((x, k) => (combined[k] += x * amounts[i] * scale)));
      const before = s.kin.snapshot();
      s.kin.advance(combined, 1);
      if (stopIfBlocked(before)) return;
    }
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

  // Turns the part about its axle like a knob, by the angle the pointer swept around the axle
  // since its last position (see turn.ts). Seen side-on, where that doesn't work, it instead
  // turns by how far the pointer moved along the way the grabbed point turns on screen.
  function turnTowards(d: Drag, clientX: number, clientY: number) {
    const { hub, dir } = turnAxis(d);
    const grab = grabPoint(d);
    const outward = new Vector3().subVectors(grab, hub);
    const minRadius = Math.max(outward.length() / 2, 1);
    let angle = knobTurn({ hub, dir, from: rayAt(d.lastX, d.lastY), to: rayAt(clientX, clientY), minRadius });
    if (angle === null) {
      // Where the grabbed point would move per radian, turning about a still axle.
      const perRadian = new Vector3().crossVectors(dir, outward).setLength(Math.max(outward.length(), MIN_ARC_RADIUS));
      const gScreen = toScreen(grab);
      const screenPerRadian = toScreen(grab.clone().add(perRadian)).sub(gScreen);
      if (screenPerRadian.lengthSq() < 1e-6) return;
      const moved = new Vector2(clientX - d.lastX, clientY - d.lastY);
      angle = Math.max(-0.5, Math.min(0.5, moved.dot(screenPerRadian) / screenPerRadian.lengthSq()));
    }
    // The joint's angle is bodyB relative to bodyA, so flip it if we're turning bodyA.
    const sign = s.mech.joints[d.joint].bodyB === d.body ? 1 : -1;
    s.kin.turnJoint(d.joint, sign * angle, () => {
      const pair = s.blockedBy();
      if (pair) s.appearance.flashBlocked(pair);
      return !pair;
    });
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
    motorPart = part;
    s.appearance.drivenPart = part;
    s.appearance.update();
  }

  // Starts the part turning (direction 1, or -1 for the other way). If its body is already
  // turning that way, stops it; if the other way, turns it round.
  function toggleMotor(part: number, direction: number, clientX: number, clientY: number) {
    const body = s.mech.bodyOf[part];
    const name = s.mech.bodies[body].name;
    if (motorPart >= 0 && s.mech.bodyOf[motorPart] === body) {
      if (direction === motorDirection) {
        setMotor(-1);
        showMessage(`Stopped ${name}`, clientX, clientY);
      } else {
        motorDirection = direction;
        showMessage(`Turning ${name} the other way`, clientX, clientY);
      }
      return;
    }
    const link = s.kin.parentLink(body);
    if (!link || !s.kin.turnsLikeAKnob(body)) {
      showMessage('Only a part that spins on an axle can be kept turning', clientX, clientY);
      return;
    }
    const wormLocked = s.kin.holdWhatTheDragDoesntNeed(body, () => s.kin.jointMotion(link.joint) !== null);
    const canTurn = s.kin.jointMotion(link.joint) !== null;
    s.kin.letGoAfterDrag();
    if (!canTurn) {
      const why = wormLocked ? 'a worm gear can only be turned from the worm' : "it's jammed";
      showMessage(`This part can't turn: ${why}`, clientX, clientY);
      return;
    }
    motorDirection = direction;
    setMotor(part);
    showMessage(`Turning ${name} · Ctrl-click again to stop`, clientX, clientY);
  }

  // Turns the driven part on by however far it goes in `seconds`, as a turn drag would. Waits
  // while the user drags something else. Stops for good if it can't turn (it's run into
  // something, or a frozen part jams it). Its holds are worked out once and kept while it
  // runs (working them out takes longer than the step itself on a big model), and again if a
  // step fails with them, before giving up.
  function runMotor(seconds: number) {
    if (motorPart < 0 || drag) return;
    const body = s.mech.bodyOf[motorPart];
    const link = s.kin.parentLink(body);
    if (!link) {
      setMotor(-1);
      return;
    }
    const sign = s.mech.joints[link.joint].bodyB === body ? 1 : -1;
    const angle = sign * motorDirection * MOTOR_SPEED * seconds;
    let turned = 0;
    let blocked = false;
    for (let attempt = 0; attempt < 2 && !blocked && Math.abs(turned - angle) > 1e-9; attempt++) {
      if (motorHeldIn !== s.kin || attempt > 0) {
        s.kin.holdWhatTheDragDoesntNeed(body, () => s.kin.jointMotion(link.joint) !== null);
        motorHeldIn = s.kin;
      }
      turned += s.kin.turnJoint(link.joint, angle - turned, () => {
        const pair = s.blockedBy();
        if (pair) s.appearance.flashBlocked(pair);
        blocked = pair !== null; // ran into something: fresh holds won't help
        return !pair;
      });
    }
    if (Math.abs(turned - angle) > 1e-9) setMotor(-1);
    s.onMoved();
  }

  // ---------------------------------------------------------------------------
  // Press, move, release

  // In how many independent directions the grabbed point can move.
  function grabDirections(d: Drag): number {
    const g = grabPoint(d);
    const basis: Vector3[] = [];
    for (const m of s.kin.freeMotions()) {
      const v = s.kin.pointVelocity(m, d.body, g);
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
    if (canvas.hasPointerCapture(drag.pointerId)) canvas.releasePointerCapture(drag.pointerId);
    if (drag.arc) {
      s.ldrawSpace.remove(drag.arc);
      drag.arc.traverse((o) => (o as Mesh).geometry?.dispose());
    }
    drag = null;
    arrow.visible = false;
    s.controls.enabled = true;
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
        // Ctrl-click: keep the part turning, or stop it; Shift-Ctrl-click the other way. Keep
        // the camera from moving.
        e.stopImmediatePropagation();
        ctrlClickHandled = true;
        toggleMotor(hit.part, e.shiftKey ? -1 : 1, e.clientX, e.clientY);
        return;
      }
      s.controls.enabled = false;
      // Keep receiving moves when the pointer leaves the canvas. (Can fail for synthetic events.)
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {}

      const slide = s.slideOf(hit.part);
      if (slide) {
        shifting = { pointerId: e.pointerId, part: hit.part, startX: e.clientX, startY: e.clientY, startPosition: slide.position };
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
      drag = { pointerId: e.pointerId, body, grabStart, joint, arc: null, lastX: e.clientX, lastY: e.clientY };
      hideLabel();

      // Hold still whatever this drag doesn't need to move.
      const d = drag;
      let wormLocked = false;
      if (d.joint >= 0) {
        wormLocked = s.kin.holdWhatTheDragDoesntNeed(body, () => s.kin.jointMotion(d.joint) !== null);
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
        const why = s.kin.frameFixed() ? 'the model has no means of locomotion' : "it's jammed";
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
    if (hit) toggleMotor(hit.part, e.shiftKey ? -1 : 1, e.clientX, e.clientY);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (shifting) {
      if (e.pointerId === shifting.pointerId) shiftTowards(shifting, e.clientX, e.clientY);
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
      updateArc(drag);
    } else {
      pushTowards(drag, e.clientX, e.clientY);
      updateArrow(drag);
    }
    s.onMoved();
  });

  canvas.addEventListener('pointerup', (e) => {
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
function leastSquares(columns: Vector2[], target: Vector2): number[] | null {
  const k = columns.length;
  const a: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < k; i++) {
    a.push([]);
    for (let j = 0; j < k; j++) a[i].push(columns[i].dot(columns[j]) + (i === j ? 1e-3 : 0));
    b.push(columns[i].dot(target));
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
