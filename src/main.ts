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
import { ConnectionTable, normalizePartName } from './connections.ts';
import { setUpInteraction } from './interaction.ts';
import { makeJointAxes } from './jointAxes.ts';
import { Kinematics } from './kinematics.ts';
import { parseLdr } from './ldr.ts';
import { inferMechanism, Mechanism } from './mechanism.ts';
import { Outlines } from './outlines.ts';

// The test models in models/, and their names in the picker.
const MODELS: [string, string][] = [
  ['simple-car', 'Simple car'],
  ['geared-car', 'Geared car'],
  ['gear-train', 'Gear train'],
  ['right-angle', 'Right-angle drive'],
  ['differential', 'Differential'],
  ['steering-car', 'Steering car'],
  ['steering-car-solid', 'Steering car, solid rear axle'],
];
const modelParam = new URLSearchParams(window.location.search).get('model');
const MODEL = MODELS.some(([file]) => file === modelParam) ? modelParam! : MODELS[0][0];
const MODEL_URL = `/models/${MODEL}.ldr`;
const CONNECTIONS_URL = '/data/connections.json';
const ROLES_URL = '/data/roles.json';
const LDRAW_URL = '/ldraw/';

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

renderer.setAnimationLoop(() => {
  controls.update();
  outlines.render();
  badgeRenderer.render(scene, camera);
});

// ---------------------------------------------------------------------------
// Part titles, read from the first line of each LDraw part file ("0 Technic Brick 1 x 4 with Holes").

const titles = new Map<string, Promise<string>>();

function partTitle(name: string): Promise<string> {
  let title = titles.get(name);
  if (!title) {
    title = fetch(LDRAW_URL + 'parts/' + name)
      .then((r) => (r.ok ? r.text() : ''))
      .then((text) => text.split(/\r?\n/)[0].replace(/^0\s+/, '').replace(/\s+/g, ' ').trim());
    titles.set(name, title);
  }
  return title;
}

// ---------------------------------------------------------------------------
// Loading

async function start() {
  const summary = document.getElementById('summary')!;

  const modelText = await (await fetch(MODEL_URL)).text();
  const parts = parseLdr(modelText);
  const table: ConnectionTable = await (await fetch(CONNECTIONS_URL)).json();
  const roles: Record<string, string> = await (await fetch(ROLES_URL)).json();
  const mech = inferMechanism(parts, table, roles);
  const kin = new Kinematics(mech);

  const loader = new LDrawLoader();
  loader.setConditionalLineMaterial(LDrawConditionalLineMaterial);
  loader.setPartsLibraryPath(LDRAW_URL);
  loader.smoothNormals = true;
  await loader.preloadMaterials(LDRAW_URL + 'LDConfig.ldr');
  const model = await loader.loadAsync(MODEL_URL);
  ldrawSpace.add(model);

  // The loader makes one child group per part line, in file order.
  const partObjects: Object3D[] = model.children;
  if (partObjects.length !== parts.length) {
    throw new Error(`Loader made ${partObjects.length} parts, model has ${parts.length}`);
  }
  partObjects.forEach((obj, i) => {
    if (normalizePartName(obj.name) !== parts[i].name) {
      throw new Error(`Part ${i}: loader has ${obj.name}, model has ${parts[i].name}`);
    }
    obj.userData.partIndex = i;
    obj.updateMatrix();
    obj.userData.startMatrix = obj.matrix.clone();
  });

  const appearance = new Appearance(partObjects, mech, outlines);
  appearance.looseParts = new Set(mech.loose);
  appearance.update();
  showLooseWarning(parts.map((p) => p.name), mech.loose);

  const axes = makeJointAxes(mech.joints);
  ldrawSpace.add(axes);
  // A dot where each pair of meshing gears touch. It stays put relative to what the gears'
  // axles are mounted in.
  const meshMaterial = new MeshBasicMaterial({ color: 0xe0218a, depthTest: false });
  for (const m of mech.meshes) {
    const a = mech.gears[m.gearA];
    const b = mech.gears[m.gearB];
    const dot = new Mesh(new SphereGeometry(3, 16, 8), meshMaterial);
    dot.position.copy(a.center).lerp(b.center, a.radius / (a.radius + b.radius));
    dot.renderOrder = 10;
    dot.updateMatrix();
    dot.userData.body = kin.parentLink(a.body)?.parent ?? a.body;
    dot.userData.startMatrix = dot.matrix.clone();
    axes.add(dot);
  }

  frameCamera(model, kin.groundY);

  summary.textContent =
    `${parts.length} parts · ${mech.bodies.length} bodies · ${mech.joints.length} joints` +
    (mech.meshes.length ? ` · ${mech.meshes.length} gear meshes` : '');

  const picker = document.getElementById('model') as HTMLSelectElement;
  for (const [file, name] of MODELS) picker.add(new Option(name, file, false, file === MODEL));
  picker.addEventListener('change', () => {
    window.location.search = '?model=' + picker.value;
  });

  // Moves every part and joint axis to where the kinematics says its body is.
  function showPoses() {
    for (const obj of [...partObjects, ...axes.children]) {
      const body = obj.userData.partIndex !== undefined ? mech.bodyOf[obj.userData.partIndex] : obj.userData.body;
      obj.matrix.multiplyMatrices(kin.poses[body], obj.userData.startMatrix);
      obj.matrix.decompose(obj.position, obj.quaternion, obj.scale);
    }
    updateReadout(mech, kin);
  }

  const bodyColours = document.getElementById('bodyColours') as HTMLInputElement;
  bodyColours.addEventListener('change', () => {
    appearance.showBodyColours = bodyColours.checked;
    appearance.update();
  });
  const jointAxes = document.getElementById('jointAxes') as HTMLInputElement;
  jointAxes.addEventListener('change', () => {
    axes.visible = jointAxes.checked;
  });
  document.getElementById('reset')!.addEventListener('click', () => {
    kin.reset();
    showPoses();
  });

  // Held parts get a cyan outline and a pin badge, and "Let go of all" shows while any are held.
  const letGo = document.getElementById('letGo') as HTMLButtonElement;
  function showHolds() {
    appearance.heldBodies = new Set(kin.heldBodies());
    appearance.update();
    letGo.style.display = kin.heldBodies().length ? '' : 'none';
    updateReadout(mech, kin);
  }
  letGo.addEventListener('click', () => {
    kin.letGoOfAll();
    showHolds();
  });
  showHolds();

  setUpInteraction({
    renderer,
    camera,
    controls,
    ldrawSpace,
    model,
    partNames: parts.map((p) => p.name),
    mech,
    kin,
    appearance,
    partTitle,
    onMoved: showPoses,
    onHoldChanged: showHolds,
  });
  showPoses();
}

// Point the camera at the model from above and to one side, and put a grid on the ground
// (or under the model, if nothing touches the ground).
function frameCamera(model: Object3D, groundY: number | null) {
  const box = new Box3().setFromObject(model);
  const center = box.getCenter(new Vector3());
  const size = box.getSize(new Vector3()).length();
  controls.target.copy(center);
  camera.position.copy(center).add(new Vector3(0.9, 0.7, 1.1).multiplyScalar(size));
  const grid = new GridHelper(size * 6, 60, 0x9aa3b0, 0xc4cad3);
  // The scene is the right way up, so LDraw's y is flipped.
  grid.position.set(center.x, groundY !== null ? -groundY : box.min.y, center.z);
  scene.add(grid);
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
  // One line per body that turns on a joint: how far it has turned relative to what it's
  // mounted on (the frame, unless it says otherwise).
  mech.bodies.forEach((body, b) => {
    const turn = turnOnAxis(mech, kin, b);
    if (!turn) return;
    const degrees = (turn.radians * 180) / Math.PI;
    let name = body.name;
    const gear = mech.gears.find((g) => g.body === b);
    if (gear && !name.startsWith('wheels') && !name.startsWith('differential')) name += ` (${gear.teeth} teeth)`;
    let line = `${name} turned ${degrees.toFixed(1)}°`;
    if (turn.mount !== 0) line += ` in ${mech.bodies[turn.mount].name}`;
    if (kin.isHeld(b)) line += ' (held)';
    // A wheel on the ground: its turn should match how far it rolled ÷ its radius.
    const t = mech.treads.findIndex((tr) => tr.body === b);
    if (t >= 0 && kin.groundY !== null) {
      const rolled = Math.abs(kin.treadTravel[t]);
      const expected = ((rolled / mech.treads[t].radius) * 180) / Math.PI;
      line += ` (rolled ${rolled.toFixed(1)} ÷ ${mech.treads[t].radius.toFixed(1)} = ±${expected.toFixed(1)}°)`;
    }
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
