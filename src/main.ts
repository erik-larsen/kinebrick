// The viewer: loads the test car, works out its mechanism, shows it, and lets you drag it.

import {
  Box3,
  Color,
  DirectionalLight,
  GridHelper,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { LDrawLoader } from 'three/addons/loaders/LDrawLoader.js';
import { LDrawConditionalLineMaterial } from 'three/addons/materials/LDrawConditionalLineMaterial.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { Appearance } from './appearance.ts';
import { collisionGeometry, Collisions, PartMesh } from './collisions.ts';
import { ConnectionTable, normalizePartName } from './connections.ts';
import { InteractionSetup, setUpInteraction } from './interaction.ts';
import { makeJointAxes } from './jointAxes.ts';
import { Kinematics } from './kinematics.ts';
import { parseLdr, PlacedPart } from './ldr.ts';
import { inferMechanism, Mechanism } from './mechanism.ts';
import { Outlines } from './outlines.ts';
import { findSliders, Slider, sliderMovedTo, sliderPosition, slideDirection } from './shift.ts';
import connectionsUrl from '../data/connections.json?url';
import rolesUrl from '../data/roles.json?url';
import titlesUrl from '../packed/titles.json?url';

// The test models in models/, and their names in the picker.
const MODELS: [string, string][] = [
  ['simple-car', 'Simple car'],
  ['geared-car', 'Geared car'],
  ['gear-train', 'Gear train'],
  ['right-angle', 'Right-angle drive'],
  ['differential', 'Differential'],
  ['steering-car', 'Steering car'],
  ['steering-car-solid', 'Steering car, solid rear axle'],
  ['worm-drive', 'Worm drive'],
  ['gearbox', 'Two-speed gearbox'],
  ['engine', 'Single-cylinder engine'],
  ['four-bar', 'Four-bar linkage'],
];
const params = new URLSearchParams(window.location.search);
const modelParam = params.get('model');
const MODEL = MODELS.some(([file]) => file === modelParam) ? modelParam! : MODELS[0][0];
// Views for checking the mechanism, off unless the address turns them on, e.g.
// ?model=gearbox&option=bodycolours,axes,contacts
//   bodycolours  each body in its own colour, instead of the parts' LEGO colours
//   axes         each joint's axis
//   contacts     a dot where each pair of gears' teeth meet
const OPTIONS = params.getAll('option').join(',').split(',');

// The files the viewer loads. Vite bundles them, so they're found both in development and on
// the published site. The packed files (made by npm run pack) hold each model with every LDraw
// part it uses, so the viewer needs no LDraw parts library.
const modelUrls: Record<string, string> = import.meta.glob('../models/*.ldr', { query: '?url', import: 'default', eager: true });
const packedUrls: Record<string, string> = import.meta.glob('../packed/*.mpd', { query: '?url', import: 'default', eager: true });
const MODEL_URL = modelUrls[`../models/${MODEL}.ldr`];
const PACKED_URL = packedUrls[`../packed/${MODEL}.mpd`];

// ---------------------------------------------------------------------------
// Scene

const renderer = new WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new Scene();
scene.background = new Color(0xe4e8ee);
scene.add(new HemisphereLight(0xffffff, 0x777777, 2.5));
const sun = new DirectionalLight(0xffffff, 2);
sun.position.set(100, 200, 150);
scene.add(sun);

const camera = new PerspectiveCamera(35, window.innerWidth / window.innerHeight, 1, 10000);
const controls = new OrbitControls(camera, renderer.domElement);

// LDraw's y axis points down; flipping this group turns the model the right way up.
// Everything in it is in LDraw coordinates.
const ldrawSpace = new Group();
ldrawSpace.rotation.x = Math.PI;
scene.add(ldrawSpace);

// Outlines are drawn after the scene; badges are HTML laid over it.
const outlines = new Outlines(renderer, scene, camera);
const badgeRenderer = new CSS2DRenderer();
badgeRenderer.setSize(window.innerWidth, window.innerHeight);
badgeRenderer.domElement.className = 'badges';
document.body.appendChild(badgeRenderer.domElement);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  outlines.setSize(window.innerWidth, window.innerHeight);
  badgeRenderer.setSize(window.innerWidth, window.innerHeight);
});

// Called every frame with the seconds since the last one, once the model has loaded.
let onFrame = (_seconds: number) => {};
let lastFrame = performance.now();

renderer.setAnimationLoop(() => {
  const now = performance.now();
  onFrame(Math.min((now - lastFrame) / 1000, 0.1)); // a hidden tab pauses frames; don't jump
  lastFrame = now;
  controls.update();
  outlines.render();
  badgeRenderer.render(scene, camera);
});

// ---------------------------------------------------------------------------
// Part titles ("Technic Brick 1 x 4 with Holes"), from packed/titles.json.

const titles: Promise<Record<string, string>> = fetch(titlesUrl).then((r) => r.json());

function partTitle(name: string): Promise<string> {
  return titles.then((t) => t[name] ?? '');
}

// ---------------------------------------------------------------------------
// Loading

async function start() {
  const summary = document.getElementById('summary')!;

  const modelText = await (await fetch(MODEL_URL)).text();
  const startParts = parseLdr(modelText);
  const table: ConnectionTable = await (await fetch(connectionsUrl)).json();
  const roles: Record<string, string> = await (await fetch(rolesUrl)).json();

  const loader = new LDrawLoader();
  loader.setConditionalLineMaterial(LDrawConditionalLineMaterial);
  loader.smoothNormals = true;
  const model = await loader.loadAsync(PACKED_URL);
  ldrawSpace.add(model);

  // The loader makes one child group per part line, in file order.
  const partObjects: Object3D[] = model.children;
  if (partObjects.length !== startParts.length) {
    throw new Error(`Loader made ${partObjects.length} parts, model has ${startParts.length}`);
  }
  partObjects.forEach((obj, i) => {
    if (normalizePartName(obj.name) !== startParts[i].name) {
      throw new Error(`Part ${i}: loader has ${obj.name}, model has ${startParts[i].name}`);
    }
    obj.userData.partIndex = i;
    obj.updateMatrix();
  });
  const loadedMatrices = partObjects.map((obj) => obj.matrix.clone());

  // Collision checks: each part's meshes in the part's own coordinates.
  model.updateMatrixWorld(true);
  const shapes: PartMesh[][] = partObjects.map((obj) => {
    const toPart = obj.matrixWorld.clone().invert();
    const list: PartMesh[] = [];
    obj.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      list.push({ geometry: collisionGeometry(mesh.geometry), matrix: toPart.clone().multiply(mesh.matrixWorld) });
    });
    return list;
  });

  // The mechanism, and everything worked out from it. read() sets these, at the start and
  // again after each shift, when the mechanism is worked out afresh from where the parts are.
  let parts = startParts;
  let mech = inferMechanism(parts, table, roles);
  let kin = new Kinematics(mech);
  let sliders: Slider[] = [];
  let axes = new Group();
  axes.visible = OPTIONS.includes('axes');
  ldrawSpace.add(axes);
  const contacts = new Group();
  contacts.visible = OPTIONS.includes('contacts');
  ldrawSpace.add(contacts);
  const appearance = new Appearance(partObjects, mech, outlines);
  appearance.showBodyColours = OPTIONS.includes('bodycolours');
  const partMatrices = () => partObjects.map((obj, i) => kin.poses[mech.bodyOf[i]].clone().multiply(obj.userData.startMatrix));
  let collisions: Collisions | null = null;

  // Works out the mechanism from parts placed as given, with partObjects already there.
  function read(placed: PlacedPart[]) {
    parts = placed;
    mech = inferMechanism(parts, table, roles);
    kin = new Kinematics(mech);
    sliders = findSliders(parts, mech, table);
    partObjects.forEach((obj) => (obj.userData.startMatrix = obj.matrix.clone()));

    appearance.setMechanism(mech);
    appearance.update();

    const showAxes = axes.visible;
    ldrawSpace.remove(axes);
    axes = makeJointAxes(mech.joints);
    axes.visible = showAxes;
    ldrawSpace.add(axes);
    // A dot where each pair of meshing gears touch. It stays put relative to what the gears'
    // axles are mounted in.
    contacts.clear();
    for (const m of mech.meshes) {
      const a = mech.gears[m.gearA];
      const b = mech.gears[m.gearB];
      const dot = new Mesh(new SphereGeometry(3, 16, 8), meshMaterial);
      dot.position.copy(a.center).lerp(b.center, a.radius / (a.radius + b.radius));
      dot.renderOrder = 10;
      dot.updateMatrix();
      dot.userData.body = kin.parentLink(a.body)?.parent ?? a.body;
      dot.userData.startMatrix = dot.matrix.clone();
      contacts.add(dot);
    }

    // Which parts are directly connected, or sit on the same pin or axle (they may touch:
    // two beams on one pin lie face to face).
    const connected = new Set<string>();
    const pairKey = (a: number, b: number) => (a < b ? `${a},${b}` : `${b},${a}`);
    for (const c of mech.connections) connected.add(pairKey(c.male, c.female));
    for (const a of mech.connections) {
      for (const b of mech.connections) {
        if (a.male === b.male && a.female !== b.female && a.kind !== 'stud' && b.kind !== 'stud') connected.add(pairKey(a.female, b.female));
      }
    }
    for (const m of mech.meshes) connected.add(pairKey(mech.gears[m.gearA].part, mech.gears[m.gearB].part));
    if (collisions) collisions.watch(mech.bodyOf, connected, partMatrices());
    else collisions = new Collisions(shapes, mech.bodyOf, connected, partMatrices());

    summary.textContent =
      `${parts.length} parts · ${mech.bodies.length} bodies · ${mech.joints.length} joints` +
      (mech.meshes.length ? ` · ${mech.meshes.length} gear meshes` : '');
    setup.mech = mech;
    setup.kin = kin;
    showFrozen();
  }

  // Moves every part and joint axis to where the kinematics says its body is.
  function showPoses() {
    for (const obj of [...partObjects, ...axes.children, ...contacts.children]) {
      const body = obj.userData.partIndex !== undefined ? mech.bodyOf[obj.userData.partIndex] : obj.userData.body;
      obj.matrix.multiplyMatrices(kin.poses[body], obj.userData.startMatrix);
      obj.matrix.decompose(obj.position, obj.quaternion, obj.scale);
    }
    updateReadout(mech, kin);
  }

  // Slides a part (a driving ring) to one of its click-in positions, then works the mechanism
  // out afresh from where everything now is.
  function shift(part: number, position: number) {
    const slider = sliders.find((sl) => sl.part === part)!;
    const now = parts.map((p, i) => ({ ...p, matrix: kin.poses[mech.bodyOf[i]].clone().multiply(p.matrix) }));
    const moved = sliderMovedTo(now, table, slider, position);
    const by = moved.clone().multiply(now[part].matrix.clone().invert());
    now[part] = { ...now[part], matrix: moved };
    partObjects[part].matrix.premultiply(by);
    partObjects[part].matrix.decompose(partObjects[part].position, partObjects[part].quaternion, partObjects[part].scale);
    read(now);
    showPoses();
  }

  // Where a sliding part is and how it slides, or null if it doesn't.
  function slideOf(part: number) {
    const slider = sliders.find((sl) => sl.part === part);
    if (!slider) return null;
    const now = parts.map((p, i) => ({ ...p, matrix: kin.poses[mech.bodyOf[i]].clone().multiply(p.matrix) }));
    return {
      at: new Vector3().setFromMatrixPosition(now[part].matrix),
      dir: slideDirection(now, table, slider),
      position: sliderPosition(now, table, slider),
      positions: slider.positions,
    };
  }

  const meshMaterial = new MeshBasicMaterial({ color: 0xe0218a, depthTest: false });

  const picker = document.getElementById('model') as HTMLSelectElement;
  for (const [file, name] of MODELS) picker.add(new Option(name, file, false, file === MODEL));
  // Switching model keeps the options.
  picker.addEventListener('change', () => {
    params.set('model', picker.value);
    window.location.search = params.toString();
  });

  const bodyColours = document.getElementById('bodyColours') as HTMLInputElement;
  bodyColours.checked = appearance.showBodyColours;
  bodyColours.addEventListener('change', () => {
    appearance.showBodyColours = bodyColours.checked;
    appearance.update();
  });
  const axesBox = document.getElementById('axes') as HTMLInputElement;
  axesBox.checked = axes.visible;
  axesBox.addEventListener('change', () => {
    axes.visible = axesBox.checked;
  });
  const contactsBox = document.getElementById('contacts') as HTMLInputElement;
  contactsBox.checked = contacts.visible;
  contactsBox.addEventListener('change', () => {
    contacts.visible = contactsBox.checked;
  });

  // Frozen parts get a cyan outline and a pin badge, and "Unfreeze all" shows while any are frozen.
  const unfreeze = document.getElementById('unfreeze') as HTMLButtonElement;
  function showFrozen() {
    appearance.frozenBodies = new Set(kin.frozenBodies());
    appearance.update();
    unfreeze.style.display = kin.frozenBodies().length ? '' : 'none';
    updateReadout(mech, kin);
  }
  unfreeze.addEventListener('click', () => {
    kin.unfreezeAll();
    showFrozen();
  });

  const setup: InteractionSetup = {
    renderer,
    camera,
    controls,
    ldrawSpace,
    model,
    partNames: startParts.map((p) => p.name),
    mech,
    kin,
    appearance,
    partTitle,
    onMoved: showPoses,
    onFreezeChanged: showFrozen,
    blockedBy: () => collisions!.check(partMatrices()),
    slideOf,
    shift,
  };
  read(startParts);
  showLooseWarning(startParts.map((p) => p.name), mech.loose);
  const grid = frameCamera(model, kin.groundY);
  const interaction = setUpInteraction(setup);
  // While a part is kept turning, the camera follows the model: it moves by however far the
  // frame's middle moved, so the model stays in view while you still orbit and zoom around it.
  const frameMiddle = ldrawSpace.worldToLocal(new Box3().setFromObject(model).getCenter(new Vector3())); // LDraw coordinates
  const frameMiddleNow = () => ldrawSpace.localToWorld(frameMiddle.clone().applyMatrix4(kin.poses[0]));
  onFrame = (seconds) => {
    if (!interaction.motorRunning()) return;
    const before = frameMiddleNow();
    interaction.runMotor(seconds);
    const moved = frameMiddleNow().sub(before);
    camera.position.add(moved);
    controls.target.add(moved);
    // Keep the grid under the model, moving it in whole grid squares so it looks endless and
    // its lines still slide past.
    const { cell, home } = grid.userData;
    grid.position.x = home.x + Math.round((controls.target.x - home.x) / cell) * cell;
    grid.position.z = home.z + Math.round((controls.target.z - home.z) / cell) * cell;
  };
  showPoses();

  // Back to the model as loaded, shifted back too, with nothing turning.
  document.getElementById('reset')!.addEventListener('click', () => {
    interaction.stopMotor();
    partObjects.forEach((obj, i) => {
      obj.matrix.copy(loadedMatrices[i]);
      obj.matrix.decompose(obj.position, obj.quaternion, obj.scale);
    });
    read(startParts);
    showPoses();
  });
}

// Point the camera at the model from above and to one side, and put a grid on the ground
// (or under the model, if nothing touches the ground).
// Returns the grid.
function frameCamera(model: Object3D, groundY: number | null): GridHelper {
  const box = new Box3().setFromObject(model);
  const center = box.getCenter(new Vector3());
  const size = box.getSize(new Vector3()).length();
  controls.target.copy(center);
  camera.position.copy(center).add(new Vector3(0.9, 0.7, 1.1).multiplyScalar(size));
  const grid = new GridHelper(size * 6, 60, 0x9aa3b0, 0xc4cad3);
  grid.userData.cell = (size * 6) / 60;
  grid.userData.home = grid.position.clone(); // where it starts, under the camera's target
  // The scene is the right way up, so LDraw's y is flipped.
  grid.position.set(center.x, groundY !== null ? -groundY : box.min.y, center.z);
  scene.add(grid);
  return grid;
}

// Lists the parts that aren't attached to the rest of the model (outlined red, marked ⚠), if any.
async function showLooseWarning(names: string[], loose: number[]) {
  const warning = document.getElementById('warning')!;
  if (loose.length === 0) return;
  const shown = await Promise.all(loose.slice(0, 3).map(async (i) => `${names[i].replace(/\.dat$/, '')} ${await partTitle(names[i])}`));
  const more = loose.length > 3 ? `, and ${loose.length - 3} more` : '';
  const what = loose.length === 1 ? "1 part isn't" : `${loose.length} parts aren't`;
  warning.textContent = `${what} attached to the rest of the model (marked ⚠): ${shown.join(', ')}${more}`;
  warning.style.display = 'block';
}

// ---------------------------------------------------------------------------
// Readout: how far the frame has moved and how far each joint has turned, so the motion can
// be checked by eye. For a wheel, the expected turn is distance ÷ tyre radius.

function updateReadout(mech: Mechanism, kin: Kinematics) {
  const readout = document.getElementById('readout')!;
  const lines: string[] = [];
  if (kin.groundY !== null) {
    const moved = new Vector3(0, 0, 0).applyMatrix4(kin.poses[0]).length();
    const radius = kin.frameTurningRadius();
    let line = `frame moved ${moved.toFixed(1)} LDU`;
    if (radius === Infinity) line += ', driving straight';
    else if (radius !== null) line += `, turning circle radius ${radius.toFixed(0)} LDU`;
    lines.push(line);
  }
  // One line per body that turns on a joint like a knob: how far it has turned relative to
  // what it's mounted on (the frame, unless it says otherwise). Parts that turn and travel at
  // once (a connecting rod) are left out: their turn follows from the rest.
  mech.bodies.forEach((body, b) => {
    if (!kin.turnsLikeAKnob(b)) return;
    const turn = turnOnAxis(mech, kin, b);
    if (!turn) return;
    const degrees = (turn.radians * 180) / Math.PI;
    let name = body.name;
    const gear = mech.gears.find((g) => g.body === b);
    if (gear && !gear.worm && !name.startsWith('wheels') && !name.startsWith('differential')) name += ` (${gear.teeth} teeth)`;
    let line = `${name} turned ${degrees.toFixed(1)}°`;
    if (turn.mount !== 0) line += ` in ${mech.bodies[turn.mount].name}`;
    if (kin.isFrozen(b)) line += ' (frozen)';
    // A wheel on the ground: its turn should match how far it rolled ÷ its radius.
    const t = mech.treads.findIndex((tr) => tr.body === b);
    if (t >= 0 && kin.groundY !== null) {
      const rolled = Math.abs(kin.treadTravel[t]);
      const expected = ((rolled / mech.treads[t].radius) * 180) / Math.PI;
      line += ` (rolled ${rolled.toFixed(1)} ÷ ${mech.treads[t].radius.toFixed(1)} = ±${expected.toFixed(1)}°)`;
    }
    lines.push(line);
  });
  // One line per slide joint: how far its part has slid (a piston in its cylinder).
  mech.joints.forEach((joint, index) => {
    if (joint.kind !== 'slide') return;
    let line = `${mech.bodies[joint.bodyB].name} moved ${kin.slideOffset(index).toFixed(1)} LDU`;
    if (joint.bodyA !== 0) line += ` in ${mech.bodies[joint.bodyA].name}`;
    lines.push(line);
  });
  readout.textContent = lines.join('\n');
}

// How far a body has turned about its axle, and the body that's measured against. Bodies on
// the same line of axles add up: a differential's housing turns on an output axle, which
// turns in the frame, so the housing's turn is measured against the frame.
function turnOnAxis(mech: Mechanism, kin: Kinematics, body: number): { radians: number; mount: number } | null {
  let link = kin.parentLink(body);
  if (!link) return null;
  const axis = kin.jointAxisNow(link.joint);
  let radians = 0;
  let current = body;
  while (link) {
    const joint = mech.joints[link.joint];
    const here = kin.jointAxisNow(link.joint);
    const sameLine = Math.abs(here.dir.dot(axis.dir)) > 0.999 && new Vector3().subVectors(here.point, axis.point).cross(axis.dir).length() < 0.5;
    if (!sameLine) break;
    // The joint angle is bodyB's turn relative to bodyA about the joint's own direction.
    const sign = (joint.bodyB === current ? 1 : -1) * Math.sign(here.dir.dot(axis.dir));
    radians += sign * kin.jointAngles[link.joint];
    current = link.parent;
    link = kin.parentLink(current);
  }
  return { radians, mount: current };
}

start().catch((err) => {
  document.getElementById('summary')!.textContent = 'Error: ' + err.message;
  console.error(err);
});
