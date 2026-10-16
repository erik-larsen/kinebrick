// The viewer: loads the test car, works out its mechanism, and shows it.

import {
  Box3,
  Color,
  DirectionalLight,
  GridHelper,
  Group,
  HemisphereLight,
  Mesh,
  Object3D,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { LDrawLoader } from 'three/addons/loaders/LDrawLoader.js';
import { LDrawConditionalLineMaterial } from 'three/addons/materials/LDrawConditionalLineMaterial.js';
import { Appearance } from './appearance.ts';
import { ConnectionTable, normalizePartName } from './connections.ts';
import { makeJointAxes } from './jointAxes.ts';
import { parseLdr } from './ldr.ts';
import { inferMechanism } from './mechanism.ts';

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
  });

  const appearance = new Appearance(partObjects, mech);
  appearance.update();

  const axes = makeJointAxes(mech.joints);
  ldrawSpace.add(axes);

  frameCamera(model);

  summary.textContent = `${parts.length} parts · ${mech.bodies.length} bodies · ${mech.joints.length} joints`;

  const bodyColours = document.getElementById('bodyColours') as HTMLInputElement;
  bodyColours.addEventListener('change', () => {
    appearance.showBodyColours = bodyColours.checked;
    appearance.update();
  });
  const jointAxes = document.getElementById('jointAxes') as HTMLInputElement;
  jointAxes.addEventListener('change', () => {
    axes.visible = jointAxes.checked;
  });

  setUpHover(model, parts.map((p) => p.name), mech, appearance);
}

// Point the camera at the model from above and to one side, and put a grid under it.
function frameCamera(model: Object3D) {
  const box = new Box3().setFromObject(model);
  const center = box.getCenter(new Vector3());
  const size = box.getSize(new Vector3()).length();
  controls.target.copy(center);
  camera.position.copy(center).add(new Vector3(0.9, 0.7, 1.1).multiplyScalar(size));
  const grid = new GridHelper(size * 4, 40, 0x9aa3b0, 0xc4cad3);
  grid.position.set(center.x, box.min.y, center.z);
  scene.add(grid);
}

// ---------------------------------------------------------------------------
// Hover: highlight the part under the pointer, tint its body, and label it.

function setUpHover(model: Object3D, names: string[], mech: ReturnType<typeof inferMechanism>, appearance: Appearance) {
  const label = document.getElementById('label')!;
  const raycaster = new Raycaster();
  const pointer = new Vector2();

  // The index of the part under the pointer, or -1.
  function partAt(clientX: number, clientY: number): number {
    pointer.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    for (const hit of raycaster.intersectObject(model, true)) {
      if (!(hit.object as Mesh).isMesh) continue; // skip edge lines
      let obj: Object3D | null = hit.object;
      while (obj && obj.userData.partIndex === undefined) obj = obj.parent;
      if (obj) return obj.userData.partIndex;
    }
    return -1;
  }

  // Next to the pointer, flipped to the other side when it would run off the window.
  function placeLabel(clientX: number, clientY: number) {
    const gap = 14;
    const fitsRight = clientX + gap + label.offsetWidth < window.innerWidth;
    const fitsBelow = clientY + gap + label.offsetHeight < window.innerHeight;
    label.style.left = (fitsRight ? clientX + gap : clientX - gap - label.offsetWidth) + 'px';
    label.style.top = (fitsBelow ? clientY + gap : clientY - gap - label.offsetHeight) + 'px';
  }

  function show(clientX: number, clientY: number) {
    const part = partAt(clientX, clientY);
    if (part !== appearance.hoveredPart) {
      appearance.hoveredPart = part;
      appearance.update();
    }
    if (part < 0) {
      label.style.display = 'none';
      return;
    }
    const number = names[part].replace(/\.dat$/, '');
    const role = mech.roles[part];
    const body = mech.bodies[mech.bodyOf[part]].name;
    label.style.display = 'block';
    label.textContent = `${number} · ${role} · ${body}`;
    placeLabel(clientX, clientY);
    partTitle(names[part]).then((title) => {
      if (appearance.hoveredPart !== part) return;
      label.textContent = `${number} ${title} · ${role} · ${body}`;
      placeLabel(clientX, clientY);
    });
  }

  renderer.domElement.addEventListener('pointermove', (e) => show(e.clientX, e.clientY));
  renderer.domElement.addEventListener('pointerdown', (e) => show(e.clientX, e.clientY)); // touch: tap to inspect
  renderer.domElement.addEventListener('pointerleave', () => {
    appearance.hoveredPart = -1;
    appearance.update();
    label.style.display = 'none';
  });
}

start().catch((err) => {
  document.getElementById('summary')!.textContent = 'Error: ' + err.message;
  console.error(err);
});
