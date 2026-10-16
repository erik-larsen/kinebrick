// The viewer: loads the test car, works out its mechanism, shows it, and lets you drag it.

import {
  Box3,
  Color,
  DirectionalLight,
  GridHelper,
  Group,
  HemisphereLight,
  Object3D,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { LDrawLoader } from 'three/addons/loaders/LDrawLoader.js';
import { LDrawConditionalLineMaterial } from 'three/addons/materials/LDrawConditionalLineMaterial.js';
import { Appearance } from './appearance.ts';
import { ConnectionTable, normalizePartName } from './connections.ts';
import { setUpInteraction } from './interaction.ts';
import { makeJointAxes } from './jointAxes.ts';
import { Kinematics } from './kinematics.ts';
import { parseLdr } from './ldr.ts';
import { inferMechanism, Mechanism } from './mechanism.ts';

const MODEL_URL = '/models/simple-car.ldr';
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

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
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

  const appearance = new Appearance(partObjects, mech);
  appearance.update();

  const axes = makeJointAxes(mech.joints);
  ldrawSpace.add(axes);

  frameCamera(model, kin.groundY);

  summary.textContent = `${parts.length} parts · ${mech.bodies.length} bodies · ${mech.joints.length} joints`;

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

// ---------------------------------------------------------------------------
// Readout: how far the frame has moved and how far each joint has turned, so the motion can
// be checked by eye. For a wheel, the expected turn is distance ÷ tyre radius.

function updateReadout(mech: Mechanism, kin: Kinematics) {
  const readout = document.getElementById('readout')!;
  const lines: string[] = [];
  let distance = 0;
  if (kin.groundY !== null) {
    distance = new Vector3(0, 0, 0).applyMatrix4(kin.poses[0]).length();
    lines.push(`frame moved ${distance.toFixed(1)} LDU`);
  }
  mech.joints.forEach((joint, j) => {
    const degrees = Math.abs((kin.jointAngles[j] * 180) / Math.PI);
    let line = `${mech.bodies[joint.bodyB].name} turned ${degrees.toFixed(1)}°`;
    const tread = mech.treads.find((t) => t.body === joint.bodyB);
    if (tread && kin.groundY !== null) {
      const expected = ((distance / tread.radius) * 180) / Math.PI;
      line += ` (expected ${distance.toFixed(1)} ÷ ${tread.radius.toFixed(1)} = ${expected.toFixed(1)}°)`;
    }
    lines.push(line);
  });
  readout.textContent = lines.join('\n');
}

start().catch((err) => {
  document.getElementById('summary')!.textContent = 'Error: ' + err.message;
  console.error(err);
});
