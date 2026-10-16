// Pointer interaction in the 3D view (see "Interaction" in the README):
//   hover    highlight the part under the pointer, tint its body, label it
//   press    show the directions the grabbed point can move
//   drag     move the mechanism so the grabbed point follows the pointer
//   release  leave the model where it is
// Dragging on empty space turns the camera instead.

import {
  Camera,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Raycaster,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Appearance } from './appearance.ts';
import { Kinematics } from './kinematics.ts';
import { Mechanism } from './mechanism.ts';

const ARROW_LENGTH = 40; // LDU, each way
const ARROW_COLOUR = 0x1d6fe0;
// Largest distance the grabbed point moves in one solver step, in LDU. Smaller is more exact.
const MAX_STEP = 1;
// Most solver steps per pointer movement.
const MAX_STEPS = 60;

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
}

export function setUpInteraction(s: InteractionSetup) {
  const canvas = s.renderer.domElement;
  const label = document.getElementById('label')!;
  const raycaster = new Raycaster();

  const arrows = makeDoubleArrow();
  arrows.visible = false;
  s.ldrawSpace.add(arrows);

  // The drag in progress, if any.
  let drag: { pointerId: number; body: number; grabStart: Vector3 } | null = null;

  // ---------------------------------------------------------------------------
  // Coordinates

  // A point in LDraw coordinates -> pixels in the window.
  function toScreen(p: Vector3): Vector2 {
    const ndc = s.ldrawSpace.localToWorld(p.clone()).project(s.camera);
    return new Vector2(((ndc.x + 1) / 2) * window.innerWidth, ((1 - ndc.y) / 2) * window.innerHeight);
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
  function grabPoint(): Vector3 {
    return drag!.grabStart.clone().applyMatrix4(s.kin.poses[drag!.body]);
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
      if (s.appearance.hoveredPart === part && !drag) showLabel(`${number} ${title} · ${role} · ${body}`, clientX, clientY);
    });
  }

  // ---------------------------------------------------------------------------
  // Press and drag

  // Which body a press drags. A part that turns on an axle which is itself moving (a tyre
  // of a rolling car) is grabbed by its axle: pressing it pushes whatever the axle is
  // mounted in, at the pressed point. Otherwise the part's own body is grabbed, so a part on
  // an axle that stays still turns.
  function grabbedBody(body: number, point: Vector3): number {
    const link = s.kin.parentLink(body);
    if (!link) return body;
    const hub = s.kin.nearestOnAxis(link.joint, point);
    for (const m of s.kin.freeMotions()) {
      const hubSpeed = s.kin.pointVelocity(m, body, hub).length();
      const pointSpeed = s.kin.pointVelocity(m, body, point).length();
      if (hubSpeed > 1e-3 * Math.max(pointSpeed, 1e-9)) return grabbedBody(link.parent, point);
    }
    return body;
  }

  // Points the arrows along the grabbed point's allowed motion (the first one, if several).
  function updateArrows() {
    const motions = s.kin.freeMotions();
    const g = grabPoint();
    const direction = motions.length ? s.kin.pointVelocity(motions[0], drag!.body, g) : new Vector3();
    if (direction.length() < 1e-9) {
      arrows.visible = false;
      return;
    }
    arrows.position.copy(g);
    arrows.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize()); // built along y
    arrows.visible = true;
  }

  // Moves the mechanism, in small steps, so the grabbed point gets as close as it can to the
  // pointer on screen. Each step works out, for every allowed motion, how far the grabbed
  // point would move on screen, and picks the mix of motions that best closes the gap
  // (least squares).
  function dragTowards(clientX: number, clientY: number) {
    const target = new Vector2(clientX, clientY);
    for (let step = 0; step < MAX_STEPS; step++) {
      const motions = s.kin.freeMotions();
      if (motions.length === 0) return;
      const g = grabPoint();
      const gScreen = toScreen(g);
      const gap = target.clone().sub(gScreen);
      if (gap.length() < 0.5) return;

      // For each motion: how fast the point moves in LDU, and in pixels on screen.
      const speeds: Vector3[] = [];
      const screenSpeeds: Vector2[] = [];
      for (const m of motions) {
        const v = s.kin.pointVelocity(m, drag!.body, g);
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
      s.kin.advance(combined, 1);
    }
  }

  function endDrag() {
    if (!drag) return;
    if (canvas.hasPointerCapture(drag.pointerId)) canvas.releasePointerCapture(drag.pointerId);
    drag = null;
    arrows.visible = false;
    s.controls.enabled = true;
  }

  // Runs before the camera controls see the press (capture phase), so a press on a part
  // can switch the camera off before it starts turning.
  canvas.addEventListener(
    'pointerdown',
    (e) => {
      hover(e.clientX, e.clientY);
      const hit = hitAt(e.clientX, e.clientY);
      if (!hit) return; // empty space: let the camera turn
      s.controls.enabled = false;
      // Keep receiving moves when the pointer leaves the canvas. (Can fail for synthetic events.)
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {}
      const body = grabbedBody(s.mech.bodyOf[hit.part], hit.point);
      const grabStart = hit.point.clone().applyMatrix4(s.kin.poses[body].clone().invert());
      drag = { pointerId: e.pointerId, body, grabStart };
      if (s.kin.freeMotions().length === 0) {
        showLabel("Can't move: the mechanism is jammed", e.clientX, e.clientY);
        return;
      }
      hideLabel();
      updateArrows();
    },
    { capture: true },
  );

  canvas.addEventListener('pointermove', (e) => {
    if (!drag) {
      hover(e.clientX, e.clientY);
      return;
    }
    if (e.pointerId !== drag.pointerId) return; // another finger or pointer
    dragTowards(e.clientX, e.clientY);
    updateArrows();
    s.onMoved();
  });

  canvas.addEventListener('pointerup', (e) => {
    if (drag && e.pointerId === drag.pointerId) endDrag();
  });
  canvas.addEventListener('pointercancel', (e) => {
    if (drag && e.pointerId === drag.pointerId) endDrag();
  });
  canvas.addEventListener('pointerleave', () => {
    if (drag) return;
    s.appearance.hoveredPart = -1;
    s.appearance.update();
    hideLabel();
  });
}

// A two-headed arrow through the origin along y, drawn on top of the parts.
function makeDoubleArrow(): Group {
  const material = new MeshBasicMaterial({ color: ARROW_COLOUR, depthTest: false, transparent: true, opacity: 0.9 });
  const headLength = 10;
  const shaft = new Mesh(new CylinderGeometry(1.5, 1.5, 2 * (ARROW_LENGTH - headLength), 12), material);
  const tip = new Mesh(new ConeGeometry(5, headLength, 16), material);
  tip.position.y = ARROW_LENGTH - headLength / 2;
  const tail = new Mesh(new ConeGeometry(5, headLength, 16), material);
  tail.position.y = -(ARROW_LENGTH - headLength / 2);
  tail.rotation.x = Math.PI; // point the other way
  const arrow = new Group();
  for (const piece of [shaft, tip, tail]) {
    piece.renderOrder = 20;
    arrow.add(piece);
  }
  return arrow;
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
