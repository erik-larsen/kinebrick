// The viewer: loads the test car, works out its mechanism, shows it, and lets you drag it.

import {
  Box3,
  Color,
  DirectionalLight,
  GridHelper,
  Group,
  HemisphereLight,
  Matrix4,
  CatmullRomCurve3,
  CurvePath,
  LineCurve3,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  TubeGeometry,
  Object3D,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
} from 'three';
import GUI, { Controller } from 'lil-gui';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { LDrawLoader } from 'three/addons/loaders/LDrawLoader.js';
import { LDrawConditionalLineMaterial } from 'three/addons/materials/LDrawConditionalLineMaterial.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { Appearance } from './appearance.ts';
import { collisionGeometry, Collisions, PartMesh } from './collisions.ts';
import { ConnectionTable, libraryConnections, normalizePartName } from './connections.ts';
import { DEFAULT_RPM, InteractionSetup, setUpInteraction } from './interaction.ts';
import { makeJointAxes } from './jointAxes.ts';
import { DEFAULT_SCRUB, Kinematics } from './kinematics.ts';
import { modelSettings, parseModel, PathPoint, PlacedPart } from './ldr.ts';
import { inferMechanism, libraryName, Mechanism, meshesChanged, movePaths } from './mechanism.ts';
import { Outlines } from './outlines.ts';
import { LoopPath, loopLinks } from './paths.ts';
import { Catch, catchShifts, findCatches, findSliders, findSticks, Slider, sliderMovedTo, sliderPosition, slideDirection, Stick, stickEnd, leverAt, stickPositionNow, stickPositions } from './shift.ts';
import { keepFile, keptFile, LDRAW_LIBRARY, libraryReader } from './library.ts';
import { packModel, shapeName } from './pack.ts';
import { studioModel } from './studio.ts';
import { thumbnail } from './thumbnail.ts';
import connectionsUrl from '../data/connections.json?url';
import libraryConnectionsUrl from '../data/library-connections.json?url';
import rolesUrl from '../data/roles.json?url';
import coloursUrl from '../packed/colours.ldr?url';
import primitivesUrl from '../packed/primitives.json?url';
import titlesUrl from '../packed/titles.json?url';
import packedModels from '../packed/models.json';
import notMovingYet from '../data/not-moving-yet.json';
import wipModels from '../data/wip-models.json';

// The test models in models/, and their names in the picker. Any other model in models/ (the
// real LEGO sets) comes after them, under its file name.
const NAMED_MODELS: [string, string][] = [
  ['simple-car', 'Simple car'],
  ['geared-car', 'Geared car'],
  ['gear-train', 'Gear train'],
  ['right-angle', 'Right-angle drive'],
  ['differential', 'Differential'],
  ['steering-car', 'Steering car'],
  ['steering-car-solid', 'Steering car, solid rear axle'],
  ['ackermann-car', 'Ackermann car'],
  ['worm-drive', 'Worm drive'],
  ['gearbox', 'Two-speed gearbox'],
  ['single-piston-engine', 'Single-cylinder engine'],
  ['four-bar', 'Four-bar linkage'],
  ['rack-and-pinion', 'Rack and pinion'],
  ['linear-actuator', 'Linear actuator'],
];
// How the picker opens each test model and working set, as the README's links do: the part it
// keeps turning (and how fast), the parts it turns first (a car's steering), and any view.
const OPENINGS: Record<string, string> = {
  'simple-car': 'autospin=12',
  'geared-car': 'autospin=13&rpm=24',
  'gear-train': 'autospin=6',
  'right-angle': 'autospin=5',
  'differential': 'autospin=11&rpm=39',
  'steering-car': 'turn=21,38.4&autospin=27,cw',
  'steering-car-solid': 'turn=16,-45.7&autospin=22,cw',
  'ackermann-car': 'turn=51,-160.6&autospin=55,cw',
  'worm-drive': 'autospin=13&rpm=120',
  'gearbox': 'autospin=13',
  'single-piston-engine': 'autospin=7,cw&rpm=200',
  'four-bar': 'turn=3,-8.7&autospin=3',
  'rack-and-pinion': 'autospin=11&rpm=42',
  'linear-actuator': 'autospin=12&rpm=160',
  '852-Helicopter': 'rpm=135&autospin=143',
  '854-Go Kart': 'rpm=54&turn=155,60&autospin=323',
  '855-Mobile Crane': 'rpm=79&autospin=313,cw',
  '952-Tractor': 'turn=68,141.6&autospin=252',
  '956-Auto Chassis': 'turn=354,-67.2&autospin=453',
  '856-Bulldozer': 'autospin=51,cw',
  '950-Fork Lift': 'turn=178,101.2&autospin=188,cw&rpm=28',
  '858-Auto Engines-2-Cycle Engine': 'rpm=100&autospin=20',
  '858-Auto Engines-Boxer Engine': 'rpm=100&autospin=91',
  '858-Auto Engines-Inline Engine': 'rpm=100&autospin=43',
  '858-Auto Engines-V-6 Engine': 'rpm=100&autospin=133',
  '8448-Super Car-V8 engine': 'rpm=100&autospin=89,cw&option=focus',
};
const MODELS: [string, string][] = [
  ...NAMED_MODELS,
  ...Object.keys(packedModels)
    .filter((file) => !NAMED_MODELS.some(([named]) => named === file))
    .map((file): [string, string] => [file, file]),
];
const params = new URLSearchParams(window.location.search);
const modelParam = params.get('model');
const MODEL = MODELS.some(([file]) => file === modelParam) ? modelParam! : MODELS[0][0];
// A model opened from your own computer, by its file name, e.g. ?file=my-car.mpd, in place of
// one of Kinebrick's own: the browser keeps the file (see library.ts), so only this browser has it.
const FILE = params.get('file');
// The LDraw library such a model's parts come from, if not the usual one (LDRAW_LIBRARY), e.g.
// ?library=/ldraw/ for the one in ldraw/, served by npm run dev.
const LIBRARY = params.get('library') ?? LDRAW_LIBRARY;
// Views for checking the mechanism, off unless the address turns them on, e.g.
// ?model=gearbox&option=bodycolours,axes,contacts
//   bodycolours  each body in its own colour, instead of the parts' LEGO colours
//   axes         each joint's axis
//   contacts     a dot where each pair of gears' teeth meet
//   focus        drivetrain focus: only the parts the last drag or spin moved drawn solid
const OPTIONS = params.getAll('option').join(',').split(',');
// How fast Ctrl-click spins a part, in whole revolutions per minute, e.g. ?rpm=60.
const RPM = whole(params.get('rpm')) ?? DEFAULT_RPM;
// How far tyres may scrub sideways, as a percentage of how far they roll, e.g. ?scrub=10, if
// not the model's own (see modelSettings in ldr.ts).
const SCRUB_PARAM = percent(params.get('scrub'));
// A part kept turning from the start, by its place in the model file (counting from 0, as
// the model's parts come, submodels flattened), counter-clockwise as seen from where the
// camera starts, or with ",cw" clockwise: e.g. ?autospin=271 or ?autospin=271,cw. Ctrl-click
// keeps it up to date, so the address shares the animation.
const AUTOSPIN = /^(\d+)(,cw)?$/.exec(params.get('autospin') ?? '');
// Parts turned from the start, each by its place in the model file and how many degrees,
// counter-clockwise as seen from where the camera starts (negative: clockwise), in the order
// given, as a drag would turn them, before Auto spin starts: e.g. ?turn=12,30&turn=271,-45.
// Dragging a part like a knob keeps it up to date, so the address shares the pose.
const TURNS = params.getAll('turn').flatMap((t) => {
  const m = /^(\d+),(-?[\d.]+)$/.exec(t);
  return m && Number.isFinite(Number(m[2])) ? [{ part: Number(m[1]), degrees: Number(m[2]) }] : [];
});

// The address's query, from params, with commas left as they are (option=bodycolours,axes),
// rather than written %2C.
function address(): string {
  return '?' + params.toString().replaceAll('%2C', ',');
}

// A percentage from 0 to 100 from text, or null if it isn't one.
function percent(text: string | null): number | null {
  const n = Number(text);
  return text && Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
}

// How thick a string is drawn: its radius, in LDU.
const STRING_RADIUS = 1;
// How thick a rubber band is drawn: its radius, in LDU.
const BAND_RADIUS = 1.5;

// A whole number of at least 1 from text, or null if it isn't one.
function whole(text: string | null): number | null {
  const n = Number(text);
  return text && Number.isInteger(n) && n >= 1 ? n : null;
}

// The files the viewer loads. Vite bundles them, so they're found both in development and on
// the published site. The packed files (made by npm run pack) hold each model with every LDraw
// part it uses, so the viewer needs no LDraw parts library.
const modelUrls: Record<string, string> = import.meta.glob('../models/*.{ldr,mpd}', { query: '?url', import: 'default', eager: true });
const packedUrls: Record<string, string> = import.meta.glob('../packed/*.mpd', { query: '?url', import: 'default', eager: true });
const MODEL_URL = modelUrls[`../models/${MODEL}.ldr`] ?? modelUrls[`../models/${MODEL}.mpd`];
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
// Somewhere sensible to start, looking at the middle, until frameCamera points it at the model.
camera.position.set(450, 350, 550);
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
// Part titles ("Technic Brick 1 x 4 with Holes"), from packed/titles.json, or for a model opened
// from your own computer, from its parts' files (start() sets them).

let titles: Promise<Record<string, string>> = FILE ? Promise.resolve({}) : fetch(titlesUrl).then((r) => r.json());

function partTitle(name: string): Promise<string> {
  return titles.then((t) => t[name] ?? '');
}

// ---------------------------------------------------------------------------
// Loading

// Lets the page show what's changed (the summary's progress) before a long step.
function shown(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => setTimeout(resolve));
    setTimeout(resolve, 100); // a page out of sight gets no frames
  });
}

// three.js's LDraw loader means to build each kind of part once and copy it wherever the model
// places it, but asked for the same part many times at once (as it is, for a whole model), it
// starts building it each time, before the first build is there to copy: the 8880 Super Car's
// 140 kinds of part were built 1411 times over, most of its loading time. So the first request
// for a part builds it, and the rest wait for it and take copies, from the loader's own cache.
function buildEachPartOnce(loader: LDrawLoader) {
  const cache = (loader as unknown as { partsCache: { loadModel(name: string): Promise<Group> } }).partsCache;
  const loadModel = cache.loadModel.bind(cache);
  const first = new Map<string, Promise<Group>>();
  cache.loadModel = (name) => {
    const key = name.toLowerCase();
    const building = first.get(key);
    if (building) return building.catch(() => null).then(() => loadModel(name));
    const promise = loadModel(name);
    first.set(key, promise);
    return promise;
  };
}

// A string's shape, as LDCad drew it, isn't shown: the string is drawn afresh as it runs (see
// showStrings), in the colour of its shape's first piece. Building the rest would be wasted,
// and slow: a crane's string is 3725 short pieces, and smoothing their shading took seconds.
// So for each of these shapes (by its file's name in the packed model), the loader builds only
// the first piece.
function firstPieceOnly(loader: LDrawLoader, files: string[]) {
  type Info = { fileName: string | null; subobjects: unknown[] };
  const cache = (loader as unknown as { partsCache: { processIntoMesh(info: Info): Promise<Group> } }).partsCache;
  const build = cache.processIntoMesh.bind(cache);
  const names = new Set(files.map((f) => f.toLowerCase()));
  cache.processIntoMesh = (info) => {
    if (info.fileName && names.has(info.fileName.toLowerCase())) info.subobjects = info.subobjects.slice(0, 1);
    return build(info);
  };
}

async function start() {
  const summary = document.getElementById('summary')!;

  const roles: Record<string, string> = await (await fetch(rolesUrl)).json();
  const loader = new LDrawLoader();
  loader.setConditionalLineMaterial(LDrawConditionalLineMaterial);
  loader.smoothNormals = true;

  // The model's file, which of the files it places are LDraw primitives (drawn shapes) and which
  // parts are read as their pieces, as the packer found, its connection table, and the packed
  // model, loaded. One of Kinebrick's own models comes packed (npm run pack); one opened from
  // your own computer is packed here and now, with the parts it uses fetched from the library.
  let modelText: string;
  let packed: { primitives: string[]; pieces: Record<string, string[]> } | undefined;
  let table: ConnectionTable;
  let load: (onProgress: (event: ProgressEvent) => void) => Promise<Group>;
  let missingFiles: string[] = [];
  if (FILE) {
    const kept = await keptFile(FILE);
    if (kept === null) throw new Error(`${FILE} isn't kept in this browser: open it again with "Open a model file…" above`);
    modelText = kept;
    const [colours, primitiveList, library] = await Promise.all([
      fetch(coloursUrl).then((r) => r.text()),
      fetch(primitivesUrl).then((r) => r.json()),
      fetch(libraryConnectionsUrl).then((r) => r.json()),
    ]);
    const primitiveSet = new Set<string>(primitiveList);
    const readFile = libraryReader(LIBRARY, primitiveSet, (count) => (summary.textContent = `Fetching parts from the LDraw library: ${count}…`));
    const result = await packModel(FILE.replace(/\.(ldr|mpd|io)$/i, ''), modelText, colours.trimEnd(), readFile, (name) => primitiveSet.has(name), roles);
    summary.textContent = 'Loading…';
    packed = result;
    titles = Promise.resolve(result.titles);
    missingFiles = result.missing;
    table = libraryConnections(library);
    load = () => new Promise((resolve, reject) => loader.parse(result.text, resolve, reject));
  } else {
    modelText = await (await fetch(MODEL_URL)).text();
    packed = (packedModels as Record<string, { primitives: string[]; pieces: Record<string, string[]> }>)[MODEL];
    table = await (await fetch(connectionsUrl)).json();
    load = (onProgress) => loader.loadAsync(PACKED_URL, onProgress);
  }
  const primitives = new Set(packed?.primitives ?? []);
  const { parts: startParts, shapes: drawnShapes, paths } = parseModel(modelText, (name) => primitives.has(name), (name) => packed?.pieces[name] ?? null);
  // The mechanism, worked out from the parts as placed (it needs no shapes). Here, so the loader
  // needn't build the pieces of a string's shape that won't be shown (see showStrings).
  summary.textContent = 'Working out how it moves…';
  await shown();
  let mech = inferMechanism(startParts, table, roles, paths);
  // The paths as the file drew them, for Reset: working the mechanism out afresh moves them with
  // the parts they run round (see movePaths).
  const copyPoint = (p: PathPoint) => ({ ...p, center: p.center.clone(), axis: p.axis.clone() });
  const startPaths = paths.map((path) => path.points.map(copyPoint));

  // Loading, with how far the download has got.
  const megabytes = (bytes: number) => (bytes / 1e6).toFixed(1);
  buildEachPartOnce(loader);
  firstPieceOnly(loader, drawnShapes.filter((shape) => mech.strings.some((s) => s.path === shape.path)).map((shape) => shapeName(shape.submodel)));
  summary.textContent = 'Loading…';
  const model = await load((e) => (summary.textContent = `Loading… ${megabytes(e.loaded)}${e.lengthComputable ? ` of ${megabytes(e.total)}` : ''} MB`));
  // Hidden until the camera is pointed at it (frameCamera, below): the page shows how loading is
  // going in between, and would show the model from wherever the camera happened to be.
  model.visible = false;
  ldrawSpace.add(model);

  // The loader makes one child group per line of the packed model, in file order: the parts,
  // then the shapes submodels draw without parts (see scripts/pack-models.ts). A shape moves
  // with the body of a part from the same submodel, or else the frame; but a rubber band's, kept
  // as drawn where it can't be drawn afresh (see showBands), with the first thing it's hooked
  // round (the 855 Mobile Crane's, on its cab, slews with it).
  const partObjects: Object3D[] = model.children.slice(0, startParts.length);
  const shapeObjects: Object3D[] = model.children.slice(startParts.length);
  if (model.children.length !== startParts.length + drawnShapes.length) {
    throw new Error(`Loader made ${model.children.length} parts and shapes, model has ${startParts.length} and ${drawnShapes.length}`);
  }
  shapeObjects.forEach((obj, i) => {
    const band = mech.loops.find((loop) => !loop.links.length && loop.path === drawnShapes[i].path);
    obj.userData.nearPart = band ? mech.bodies[band.carriers[0]].parts[0] : drawnShapes[i].nearPart;
    obj.updateMatrix();
  });
  const loadedShapeMatrices = shapeObjects.map((obj) => obj.matrix.clone());
  partObjects.forEach((obj, i) => {
    if (normalizePartName(obj.name) !== startParts[i].name) {
      throw new Error(`Part ${i}: loader has ${obj.name}, model has ${startParts[i].name}`);
    }
    obj.userData.partIndex = i;
    obj.updateMatrix();
  });
  const loadedMatrices = partObjects.map((obj) => obj.matrix.clone());

  // Collision checks: each part's meshes in the part's own coordinates. A path's parts (a
  // chain's links) aren't checked: they only show where it runs.
  model.updateMatrixWorld(true);
  const shapes: PartMesh[][] = partObjects.map((obj, i) => {
    if (startParts[i].path) return [];
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
  // How far tyres may scrub sideways, in percent: the model's own allowance, unless the address
  // says otherwise.
  const modelScrub = modelSettings(modelText).scrub ?? DEFAULT_SCRUB * 100;
  let scrub = SCRUB_PARAM ?? modelScrub;
  let kin = new Kinematics(mech);
  kin.scrub = scrub / 100;
  let sliders: Slider[] = [];
  let sticks: Stick[] = [];
  let catches: Catch[] = [];
  let placeLinks: (((travel: number) => Matrix4[]) | null)[] = [];
  let axes = new Group();
  axes.visible = OPTIONS.includes('axes');
  ldrawSpace.add(axes);
  const contacts = new Group();
  contacts.visible = OPTIONS.includes('contacts');
  ldrawSpace.add(contacts);
  const appearance = new Appearance(partObjects, mech, outlines);
  appearance.showBodyColours = OPTIONS.includes('bodycolours');
  // Drivetrain focus (see OPTIONS): the bodies the motion going on (a drag, or a part kept
  // turning or moving) has moved against the frame, and where each was against the frame as it
  // started. Until it's moved one, the last motion's stay in focus.
  let focusOn = OPTIONS.includes('focus');
  let focusStart: Matrix4[] | null = null;
  let focusMoved = new Set<number>();
  const againstFrame = (body: number) => kin.poses[0].clone().invert().multiply(kin.poses[body]);
  const startFocus = () => {
    focusStart = mech.bodies.map((_, body) => againstFrame(body));
    focusMoved = new Set();
  };
  const clearFocus = () => {
    focusStart = null;
    appearance.focusBodies = null;
    appearance.update();
  };
  function trackFocus() {
    if (!focusOn || !focusStart) return;
    let more = false;
    for (let body = 1; body < mech.bodies.length; body++) {
      if (focusMoved.has(body)) continue;
      const now = againstFrame(body).elements;
      if (focusStart[body].elements.some((x, k) => Math.abs(x - now[k]) > 1e-4)) {
        focusMoved.add(body);
        more = true;
      }
    }
    if (!more) return;
    appearance.focusBodies = new Set(focusMoved);
    appearance.update();
  }
  const partMatrices = () => partObjects.map((obj, i) => kin.poses[mech.bodyOf[i]].clone().multiply(obj.userData.startMatrix));
  let collisions: Collisions | null = null;

  // Works out the mechanism from parts placed as given (unless it's known already), with
  // partObjects already there.
  function read(placed: PlacedPart[], known?: Mechanism) {
    parts = placed;
    mech = known ?? inferMechanism(parts, table, roles, paths);
    kin = new Kinematics(mech);
    kin.scrub = scrub / 100;
    sliders = findSliders(parts, mech, table, modelSettings(modelText).slides);
    sticks = findSticks(parts, roles, sliders);
    catches = findCatches(parts, sliders);
    partObjects.forEach((obj) => (obj.userData.startMatrix = obj.matrix.clone()));
    shapeObjects.forEach((obj) => (obj.userData.startMatrix = obj.matrix.clone()));
    // Where each chain's or track's links go as it moves round (see paths.ts).
    placeLinks = mech.loops.map((loop) => (loop.wheels.length ? loopLinks(loop.path.points, loop.links.map((i) => partObjects[i].userData.startMatrix)) : null));

    appearance.setMechanism(mech);
    focusStart = null; // the bodies have changed
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
      if (m.kind === 'rack') dot.position.copy(a.center).addScaledVector(b.face!, -a.radius);
      else dot.position.copy(a.center).lerp(b.center, a.radius / (a.radius + b.radius));
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
    // Nor are any two gears: Kinebrick doesn't know where each gear's teeth are round it, so
    // two gears coming into mesh would seem to run into each other tip to tip, short of it (the
    // 952 Tractor's harrow, lowered onto its power take-off, stopped 3 LDU short).
    for (const a of mech.gears) for (const b of mech.gears) if (a.part !== b.part) connected.add(pairKey(a.part, b.part));
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
    for (const obj of [...partObjects, ...shapeObjects, ...axes.children, ...contacts.children]) {
      const near = obj.userData.nearPart;
      const body =
        obj.userData.partIndex !== undefined ? mech.bodyOf[obj.userData.partIndex] : near !== undefined ? (near >= 0 ? mech.bodyOf[near] : 0) : obj.userData.body;
      obj.matrix.multiplyMatrices(kin.poses[body], obj.userData.startMatrix);
      obj.matrix.decompose(obj.position, obj.quaternion, obj.scale);
    }
    // A chain's or track's links go round it as far as it has moved, carried by what its first
    // wheel turns in.
    mech.loops.forEach((loop, l) => {
      const place = placeLinks[l];
      if (!place) return;
      const placements = place(kin.loopTravel(l));
      loop.links.forEach((part, k) => {
        const obj = partObjects[part];
        obj.matrix.multiplyMatrices(kin.poses[loop.wheels[0].mount], placements[k]);
        obj.matrix.decompose(obj.position, obj.quaternion, obj.scale);
      });
    });
    showStrings();
    showBands();
    trackFocus();
    updateReadout(mech, kin);
  }

  // A string runs where its hook now hangs, so it's drawn afresh each time, as a thin tube along
  // its layout (see stringLayout), rather than as the pieces LDCad drew it with for where the
  // hook hung in the model file, which are hidden.
  const strings: Mesh[] = [];
  function showStrings() {
    mech.strings.forEach((s, i) => {
      if (!strings[i]) {
        const drawn = shapeObjects.filter((_, k) => drawnShapes[k].path === s.path);
        drawn.forEach((obj) => (obj.visible = false));
        let material: Material = new MeshStandardMaterial({ color: 0x333333 });
        drawn[0]?.traverse((child) => {
          if ((child as Mesh).isMesh) material = (child as Mesh).material as Material;
        });
        strings[i] = new Mesh(undefined, material);
        ldrawSpace.add(strings[i]);
      }
      const points = kin.stringPoints(i);
      const path = new CurvePath<Vector3>();
      for (let k = 1; k < points.length; k++) path.add(new LineCurve3(points[k - 1], points[k]));
      strings[i].geometry.dispose();
      strings[i].geometry = new TubeGeometry(path, 2 * points.length, STRING_RADIUS, 6, false);
    });
  }

  // A rubber band (a loop with no links of its own) stretches between what it's hooked round,
  // so it's drawn afresh each time, as a thin closed tube round where its circles are now (see
  // Loop.carriers), rather than as the pieces LDCad drew it with for where they were in the model
  // file, which are hidden. A band whose circles don't lie in one plane keeps its pieces.
  const bands: Mesh[] = [];
  function showBands() {
    mech.loops.forEach((loop, i) => {
      if (loop.links.length) return;
      const points = loop.path.points.map((p, k) => {
        const pose = kin.poses[loop.carriers[k]];
        return { ...p, center: p.center.clone().applyMatrix4(pose), axis: p.axis.clone().transformDirection(pose) };
      });
      let path: LoopPath;
      try {
        path = new LoopPath(points);
      } catch {
        return;
      }
      if (!bands[i]) {
        const drawn = shapeObjects.filter((_, k) => drawnShapes[k].path === loop.path);
        drawn.forEach((obj) => (obj.visible = false));
        let material: Material = new MeshStandardMaterial({ color: 0x333333 });
        drawn[0]?.traverse((child) => {
          if ((child as Mesh).isMesh) material = (child as Mesh).material as Material;
        });
        bands[i] = new Mesh(undefined, material);
        ldrawSpace.add(bands[i]);
      }
      const n = Math.max(24, Math.ceil(path.length / 2));
      const round = Array.from({ length: n }, (_, k) => new Vector3().setFromMatrixPosition(path.frameAt((k * path.length) / n)));
      bands[i].geometry.dispose();
      bands[i].geometry = new TubeGeometry(new CatmullRomCurve3(round, true), n, BAND_RADIUS, 6, true);
    });
  }

  // Slides a part (a driving ring) to one of its click-in positions, then works the mechanism
  // out afresh from where everything now is.
  function shift(part: number, position: number) {
    const slider = sliderOf(part)!;
    const now = parts.map((p, i) => ({ ...p, matrix: kin.poses[mech.bodyOf[i]].clone().multiply(p.matrix) }));
    const moved = sliderMovedTo(now, table, slider, position);
    const by = moved.clone().multiply(now[slider.part].matrix.clone().invert());
    for (const i of slider.riders ?? [slider.part]) {
      now[i] = { ...now[i], matrix: by.clone().multiply(now[i].matrix) };
      partObjects[i].matrix.premultiply(by);
      partObjects[i].matrix.decompose(partObjects[i].position, partObjects[i].quaternion, partObjects[i].scale);
    }
    movePaths(paths, parts, mech.bodyOf, kin.poses);
    read(now);
    showPoses();
  }

  // The slider a part slides with: it's the slider, or rides on one (a gear lever on the shaft
  // it slides).
  const sliderOf = (part: number) => sliders.find((sl) => sl.part === part || sl.riders?.includes(part));

  // Clicks a gear lever into one of its gate positions, sliding the driving rings it moves with
  // it, then works the mechanism out afresh from where everything now is.
  function shiftStick(part: number, position: number) {
    const stick = sticks.find((st) => mech.bodyOf[st.part] === mech.bodyOf[part])!;
    const now = parts.map((p, i) => ({ ...p, matrix: kin.poses[mech.bodyOf[i]].clone().multiply(p.matrix) }));
    const target = stickPositions(now, table, stick)[position];
    const place = (i: number, matrix: Matrix4) => {
      const by = matrix.clone().multiply(now[i].matrix.clone().invert());
      now[i] = { ...now[i], matrix };
      partObjects[i].matrix.premultiply(by);
      partObjects[i].matrix.decompose(partObjects[i].position, partObjects[i].quaternion, partObjects[i].scale);
    };
    for (const slider of stick.rings) place(slider.part, sliderMovedTo(now, table, slider, target.rings.get(slider.part)!));
    for (const i of mech.bodies[mech.bodyOf[stick.part]].parts) place(i, target.turn.clone().multiply(now[i].matrix));
    movePaths(paths, parts, mech.bodyOf, kin.poses);
    read(now);
    showPoses();
  }

  // Where a gear lever's stick ends in each of its gate positions, and which it's in now, or
  // null if the part isn't a gear lever or fixed to one (its knob).
  function stickOf(part: number) {
    const stick = sticks.find((st) => mech.bodyOf[st.part] === mech.bodyOf[part]);
    if (!stick) return null;
    const now = parts.map((p, i) => ({ ...p, matrix: kin.poses[mech.bodyOf[i]].clone().multiply(p.matrix) }));
    const positions = stickPositions(now, table, stick);
    return { ends: positions.map((p) => stickEnd(leverAt(now, stick, p))), position: stickPositionNow(now, table, stick, positions) };
  }

  // Works the mechanism out afresh from where everything now is, if gears now mesh that didn't
  // when it was last worked out, or no longer do (the 952 Tractor's harrow, lowered onto its
  // power take-off), or a changeover catch has swung its driving ring's fork nearer another of
  // the ring's click-in positions, sliding the ring there.
  function meshAfresh() {
    const now = parts.map((p, i) => ({ ...p, matrix: kin.poses[mech.bodyOf[i]].clone().multiply(p.matrix) }));
    const shifts = catchShifts(now, table, catches);
    if (!shifts.size && !meshesChanged(mech, kin.poses)) return;
    for (const [ring, to] of shifts) {
      const slider = sliderOf(ring)!;
      const by = sliderMovedTo(now, table, slider, to).multiply(now[ring].matrix.clone().invert());
      for (const i of slider.riders ?? [ring]) {
        now[i] = { ...now[i], matrix: by.clone().multiply(now[i].matrix) };
        partObjects[i].matrix.premultiply(by);
        partObjects[i].matrix.decompose(partObjects[i].position, partObjects[i].quaternion, partObjects[i].scale);
      }
    }
    movePaths(paths, parts, mech.bodyOf, kin.poses);
    read(now);
    showPoses();
  }

  // Where a sliding part is and how it slides, or null if it doesn't.
  function slideOf(part: number) {
    const slider = sliderOf(part);
    if (!slider) return null;
    const now = parts.map((p, i) => ({ ...p, matrix: kin.poses[mech.bodyOf[i]].clone().multiply(p.matrix) }));
    return {
      at: new Vector3().setFromMatrixPosition(now[slider.part].matrix),
      dir: slideDirection(now, table, slider),
      position: sliderPosition(now, table, slider),
      positions: slider.positions,
    };
  }

  const meshMaterial = new MeshBasicMaterial({ color: 0xe0218a, depthTest: false });

  // The options panel, upper right. Each option is kept in the address, so switching model
  // keeps it.
  const gui = new GUI({ title: 'Options' });
  const settings = {
    bodyColours: appearance.showBodyColours,
    axes: axes.visible,
    contacts: contacts.visible,
    focus: focusOn,
    rpm: RPM,
    scrub,
  };
  const keepOption = (name: string, on: boolean) => {
    const options = new Set(OPTIONS.filter((o) => o));
    if (on) options.add(name);
    else options.delete(name);
    OPTIONS.splice(0, OPTIONS.length, ...options);
    if (options.size) params.set('option', [...options].join(','));
    else params.delete('option');
    history.replaceState(null, '', address());
  };
  gui.add(settings, 'bodyColours').name('Body colours').onChange((on: boolean) => {
    appearance.showBodyColours = on;
    appearance.update();
    keepOption('bodycolours', on);
  });
  gui.add(settings, 'axes').name('Joint axes').onChange((on: boolean) => {
    axes.visible = on;
    keepOption('axes', on);
  });
  gui.add(settings, 'contacts').name('Gear contacts').onChange((on: boolean) => {
    contacts.visible = on;
    keepOption('contacts', on);
  });
  gui.add(settings, 'focus').name('Drivetrain focus').onChange((on: boolean) => {
    focusOn = on;
    if (!on) clearFocus();
    keepOption('focus', on);
  });

  // Frozen parts get a cyan outline and a pin badge, and "Unfreeze all" (in the options panel,
  // added below) shows while any are frozen.
  let unfreezeButton: Controller | undefined;
  let showMotor = () => {}; // shows the motor's buttons, once they're made (below)
  let keepTurn = (_part: number, _angle: number) => {}; // keeps a part's turn (radians, counter-clockwise) in the address, once that's set up (below)
  function showFrozen() {
    appearance.frozenBodies = new Set(kin.frozenBodies());
    appearance.update();
    unfreezeButton?.show(kin.frozenBodies().length > 0);
    updateReadout(mech, kin);
  }

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
    onMotorChanged: () => showMotor(),
    onTurned: (part, angle) => {
      const sense = interaction.turnSense(part, startCamera.position);
      if (sense !== null) keepTurn(part, angle * sense);
    },
    onDragEnded: () => meshAfresh(),
    onMotionStarted: () => startFocus(),
    blockedBy: () => {
      const now = partMatrices();
      return collisions!.check(now) ?? kin.atLimit() ?? (kin.groundY === null ? null : collisions!.belowGround(now, kin.groundY, partObjects.map((obj) => obj.userData.startMatrix)));
    },
    slideOf,
    stickOf,
    shiftStick,
    shift,
  };
  summary.textContent = 'Checking for collisions…';
  await shown();
  read(startParts, mech);
  const placed = [...new Set(startParts.map((p) => libraryName(p.name, table)))];
  // A part the file brings under its own name, read as the library's, keeps its title under both.
  titles = titles.then((t) => {
    for (const p of startParts) t[libraryName(p.name, table)] ??= t[p.name];
    return t;
  });
  // A linear actuator's input (47157) is listed for the motor it also comes on, whose output it
  // holds still; on an actuator it turns.
  const inputs = new Set(mech.screws.flatMap((screw) => mech.bodies[screw.input].parts.map((i) => libraryName(startParts[i].name, table))));
  const stuck = placed.filter((name) => name in notMovingYet && !inputs.has(name));
  showWarnings(startParts.map((p) => p.name), mech.loose, unconnected(startParts, table, roles), stuck, missingFiles);
  const grid = frameCamera(model, kin.groundY);
  model.visible = true;
  // Where the camera starts, for Reset (the camera follows the model while a part turns).
  const startCamera = { position: camera.position.clone(), target: controls.target.clone() };
  const interaction = setUpInteraction(setup);
  // The spin speed for Ctrl-click, in whole rpm, kept in the address too.
  interaction.setMotorRpm(RPM);
  gui.add(settings, 'rpm', 1, 300, 1).name('Spin speed (rpm)').onFinishChange((value: number) => {
    const rpm = Math.max(1, Math.round(value));
    interaction.setMotorRpm(rpm);
    if (rpm === DEFAULT_RPM) params.delete('rpm');
    else params.set('rpm', String(rpm));
    history.replaceState(null, '', address());
  });
  // How far tyres may scrub sideways, in percent, kept in the address if not the model's own.
  gui.add(settings, 'scrub', 0, 30, 1).name('Tyre scrub (%)').onFinishChange((value: number) => {
    scrub = Math.max(0, Math.round(value));
    kin.scrub = scrub / 100;
    interaction.motionsChanged();
    if (scrub === modelScrub) params.delete('scrub');
    else params.set('scrub', String(scrub));
    history.replaceState(null, '', address());
  });
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

  // Back to the model as loaded, shifted back too, with nothing turning, and the camera and
  // grid back where they started.
  const reset = () => {
    interaction.stopMotor();
    clearFocus();
    turns.length = 0;
    showTurns();
    camera.position.copy(startCamera.position);
    controls.target.copy(startCamera.target);
    controls.update();
    grid.position.copy(grid.userData.home);
    partObjects.forEach((obj, i) => {
      obj.matrix.copy(loadedMatrices[i]);
      obj.matrix.decompose(obj.position, obj.quaternion, obj.scale);
    });
    shapeObjects.forEach((obj, i) => {
      obj.matrix.copy(loadedShapeMatrices[i]);
      obj.matrix.decompose(obj.position, obj.quaternion, obj.scale);
    });
    paths.forEach((path, i) => (path.points = startPaths[i].map(copyPoint)));
    read(startParts);
    showPoses();
  };
  const unfreezeAll = () => {
    kin.unfreezeAll();
    showFrozen();
  };
  // Reverse and Stop show while a part is kept turning (Ctrl-click).
  const reverseButton = gui.add({ reverse: () => interaction.reverseMotor() }, 'reverse').name('Reverse');
  const stopButton = gui.add({ stop: () => interaction.stopMotor() }, 'stop').name('Stop');
  showMotor = () => {
    reverseButton.show(interaction.motorRunning());
    stopButton.show(interaction.motorRunning());
    // Kept in the address, so it can be shared (see AUTOSPIN).
    if (interaction.motorRunning()) {
      const clockwise = interaction.motorClockwiseFrom(startCamera.position);
      params.set('autospin', `${interaction.motorPart()}${clockwise ? ',cw' : ''}`);
    } else {
      params.delete('autospin');
    }
    history.replaceState(null, '', address());
  };
  showMotor();
  // The parts turned (see TURNS), in the order they were turned, each by how many degrees (one
  // after another turned again adding up). Kept as turns rather than where each part is, so they
  // still add up after the mechanism is worked out afresh (see meshAfresh).
  const turns: { part: number; degrees: number }[] = [];
  const showTurns = () => {
    params.delete('turn');
    for (const { part, degrees } of turns) params.append('turn', `${part},${degrees}`);
    history.replaceState(null, '', address());
  };
  keepTurn = (part: number, angle: number) => {
    const last = turns[turns.length - 1];
    if (last?.part === part) turns.pop();
    const degrees = Math.round(((last?.part === part ? last.degrees : 0) + (angle * 180) / Math.PI) * 10) / 10;
    if (degrees !== 0) turns.push({ part, degrees });
    showTurns();
  };
  for (const { part, degrees } of TURNS) {
    if (part >= startParts.length) continue;
    const turned = interaction.turnPart(part, (degrees * Math.PI) / 180, startCamera.position);
    if (Math.abs(turned) > 1e-9) keepTurn(part, turned);
    meshAfresh();
  }
  if (AUTOSPIN && Number(AUTOSPIN[1]) < startParts.length) interaction.startMotor(Number(AUTOSPIN[1]), startCamera.position, AUTOSPIN[2] === ',cw');
  unfreezeButton = gui.add({ unfreezeAll }, 'unfreezeAll').name('Unfreeze all');
  gui.add({ reset }, 'reset').name('Reset');
  showFrozen();
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

// The parts Kinebrick knows no connection points for, so they can't connect to anything (by
// file name, each once), other than decoration, which needs none.
function unconnected(parts: PlacedPart[], table: ConnectionTable, roles: Record<string, string>): string[] {
  const names = new Set(parts.filter((p) => !p.path).map((p) => libraryName(p.name, table)));
  return [...names].filter((name) => !table.parts[name]?.length && roles[name] !== 'decoration' && !table.stickers?.includes(name));
}

// Lists, if there are any, the parts that aren't attached to the rest of the model (outlined red,
// marked ⚠), the parts Kinebrick can't connect, the moving parts it can't move yet (from
// data/not-moving-yet.json, each with what it doesn't do), and the files that couldn't be found,
// so aren't drawn: under Warnings, which counts each kind, and opens to the list.
async function showWarnings(names: string[], loose: number[], unconnected: string[], stuck: string[], missing: string[]) {
  const warnings = document.getElementById('warnings') as HTMLDetailsElement;
  const warning = document.getElementById('warning')!;
  const list = async (parts: string[], count: number, note: (name: string) => string = () => '') => {
    const shown = await Promise.all(parts.slice(0, count).map(async (name) => `${name.replace(/\.dat$/, '')} ${await partTitle(name)}`.trim() + note(name)));
    return shown.join(', ') + (parts.length > count ? `, and ${parts.length - count} more` : '');
  };
  const lines: string[] = [];
  if (loose.length) {
    const what = loose.length === 1 ? "1 part isn't" : `${loose.length} parts aren't`;
    lines.push(`${what} attached to the rest of the model (marked ⚠): ${await list(loose.map((i) => names[i]), 3)}`);
  }
  if (unconnected.length) {
    const what = unconnected.length === 1 ? 'a part' : `${unconnected.length} parts`;
    lines.push(`Kinebrick doesn't know how ${what} can connect: ${await list(unconnected, 8)}`);
  }
  if (stuck.length) {
    const reasons: Record<string, string> = notMovingYet;
    lines.push(`Some parts don't move as they should yet: ${await list(stuck, 8, (name) => ` (${reasons[name]})`)}`);
  }
  if (missing.length) {
    const what = missing.length === 1 ? "1 file isn't" : `${missing.length} files aren't`;
    lines.push(`${what} in the LDraw library or the model file, so not drawn: ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? `, and ${missing.length - 8} more` : ''}`);
  }
  if (!lines.length) return;
  warning.replaceChildren(...lines.map((line) => Object.assign(document.createElement('p'), { textContent: line })));
  const counts = [
    [loose.length, 'loose'],
    [unconnected.length, 'unknown'],
    [stuck.length, 'not moving yet'],
    [missing.length, 'missing'],
  ].filter(([count]) => count);
  warnings.querySelector('summary')!.textContent = `Warnings: ${counts.map(([count, what]) => `${count} ${what}`).join(' · ')}`;
  warnings.hidden = false;
}

// ---------------------------------------------------------------------------
// The model picker: Kinebrick's own models, and a model of your own, opened from your computer
// (picked, or dropped on the page). The browser keeps the file and the page reloads with it.

// Kinebrick's own test models are grouped under Test models; the official sets that work in full
// under Working sets; and those that don't yet (data/wip-models.json: those marked WIP in the
// README, and those it doesn't show yet) under Work in progress sets.
const picker = document.getElementById('model') as HTMLSelectElement;
if (FILE) picker.add(new Option(FILE, '', false, true));
const heading = (label: string) => Object.assign(document.createElement('optgroup'), { label });
const tests = heading('Test models');
const working = heading('Working sets');
const wip = heading('Work in progress sets');
for (const [file, name] of MODELS) {
  const group = NAMED_MODELS.some(([named]) => named === file) ? tests : wipModels.includes(file) ? wip : working;
  group.append(new Option(name, file, false, !FILE && file === MODEL));
}
for (const group of [tests, working, wip]) if (group.children.length) picker.append(group);
picker.add(new Option('Open a model file…', 'open'));
const chosen = picker.value;
const filePicker = document.getElementById('file') as HTMLInputElement;

// Switching model keeps the options, except tyre scrub, turned parts, spinning and spin speed:
// the next model has its own.
function openModel(set: (params: URLSearchParams) => void) {
  for (const name of ['model', 'file', 'scrub', 'turn', 'autospin', 'rpm']) params.delete(name);
  set(params);
  window.location.search = address();
}

picker.addEventListener('change', () => {
  if (picker.value === 'open') {
    picker.value = chosen;
    filePicker.click();
  } else if (picker.value) {
    openModel((p) => {
      // The views the model being left opened with (the V8 engine's drivetrain focus) were its
      // own: not kept for the next one, as views turned on in the Options are.
      const own = new URLSearchParams(OPENINGS[MODEL] ?? '').getAll('option').join(',').split(',');
      const kept = p.getAll('option').join(',').split(',').filter((o) => o && !own.includes(o));
      p.delete('option');
      if (kept.length) p.set('option', kept.join(','));
      p.set('model', picker.value);
      for (const [name, value] of new URLSearchParams(OPENINGS[picker.value] ?? '')) p.append(name, value);
    });
  }
});

async function openFile(file: File | undefined) {
  if (!file) return;
  try {
    if (!/\.(ldr|mpd|io)$/i.test(file.name)) throw new Error('Kinebrick opens LDraw models (.ldr or .mpd files) and BrickLink Studio files (.io)');
    // A Studio file is kept as the LDraw model inside it (see studio.ts), under its own name.
    await keepFile(file.name, /\.io$/i.test(file.name) ? await studioModel(await file.arrayBuffer()) : await file.text());
    openModel((p) => p.set('file', file.name));
  } catch (err) {
    document.getElementById('summary')!.textContent = `Can't open ${file.name}: ${(err as Error).message}`;
  }
}
filePicker.addEventListener('change', () => openFile(filePicker.files?.[0]));
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => {
  e.preventDefault();
  openFile(e.dataTransfer?.files[0]);
});

// ---------------------------------------------------------------------------
// Readout: how far the frame has moved and how far each joint has turned, so the motion can
// be checked by eye. For a wheel, the expected turn is distance ÷ tyre radius.

// Fades the readout's right edge while some of it is hidden to the right, short of the
// scrollbars (see index.html).
function showReadoutFade() {
  const readout = document.getElementById('readout')!;
  const box = document.getElementById('readoutBox')!;
  box.classList.toggle('more', readout.scrollLeft + readout.clientWidth < readout.scrollWidth - 1);
  box.style.setProperty('--bar-v', `${readout.offsetWidth - readout.clientWidth}px`);
  box.style.setProperty('--bar-h', `${readout.offsetHeight - readout.clientHeight}px`);
}
document.getElementById('readout')!.addEventListener('scroll', showReadoutFade);
document.getElementById('details')!.addEventListener('toggle', showReadoutFade);

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
      const radius = mech.treads[t].rollRadius ?? mech.treads[t].radius; // a track rolls at its path's radius
      const expected = ((rolled / radius) * 180) / Math.PI;
      line += ` (rolled ${rolled.toFixed(1)} ÷ ${radius.toFixed(1)} = ±${expected.toFixed(1)}°)`;
      // How far it has scrubbed sideways (see Kinematics.scrub), once it's noticeable, and how
      // fast it's scrubbing, as a share of how fast it rolls.
      if (kin.treadScrub[t] >= 0.05) line += `, scrubbed ${kin.treadScrub[t].toFixed(1)} sideways, ${(kin.treadScrubRate[t] * 100).toFixed(1)}% of its roll`;
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
  showReadoutFade();
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

start()
  .then(() => {
    // Opened with ?thumb (by npm run thumbs), the page takes a picture of the model.
    if (params.has('thumb')) (window as unknown as { kinebrickThumbnail: Promise<string> }).kinebrickThumbnail = thumbnail(renderer.domElement, camera, ldrawSpace);
  })
  .catch((err) => {
    document.getElementById('summary')!.textContent = 'Error: ' + err.message;
    console.error(err);
  });
