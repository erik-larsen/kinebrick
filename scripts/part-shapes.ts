// The shapes of a model's parts, for collision checks in the scripts (see check-functions.ts),
// as the viewer makes them: each part's meshes in the part's own coordinates, with the part's
// name, in the packed model's order (its parts, then the shapes its submodels draw). One of
// Kinebrick's own models is read from its packed file; a set from the OMR is packed here and
// now, from the LDraw library in ldraw/, as pack-models.ts does.
//
// Each part placed in one colour is read once, and every copy of it shares that one list of
// meshes (decision 235 of 2026-11-19): the loader is given each colour and part once, where it
// stands, and without the lines it draws (edges and conditional lines, LDraw's types 2 and 5),
// which no collision uses. Read copy by copy, the 42100's 7,283 parts took the loader 8.5 GB and
// 42 s; read so, its 229 colours and parts take 0.75 GB and 4 s, and every mesh's triangles are
// the same to the bit (the mesh's place in the part differs by rounding only, 5e-13 at most).

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Mesh, Object3D } from 'three';
import { LDrawLoader } from 'three/addons/loaders/LDrawLoader.js';
import { LDrawConditionalLineMaterial } from 'three/addons/materials/LDrawConditionalLineMaterial.js';
import { collisionGeometry, PartMesh } from '../src/collisions.ts';
import { normalizePartName } from '../src/connections.ts';
import { packModel } from '../src/pack.ts';

const LDRAW_DIR = 'ldraw';

async function readLdrawFile(name: string): Promise<string | null> {
  for (const dir of ['parts', 'p']) {
    const path = join(LDRAW_DIR, dir, name);
    if (existsSync(path)) return readFileSync(path, 'utf-8');
  }
  return null;
}

// `modelText`: the model's text as read, if not the file's own (a set's file with its errata).
// `partNames`: the model's parts as parseModel reads them (readParts' parts): the shapes then come
// one for each of them, matched by name (see the end).
export async function partShapes(file: string, modelText?: string, partNames?: string[]): Promise<{ name: string; shape: PartMesh[] }[]> {
  const base = file.replace(/^.*[\\/]/, '').replace(/\.(ldr|mpd)$/i, '');
  let text: string;
  if (existsSync(join('packed', `${base}.mpd`))) text = readFileSync(join('packed', `${base}.mpd`), 'utf-8');
  else {
    const colours = readFileSync(join(LDRAW_DIR, 'LDConfig.ldr'), 'utf-8')
      .split(/\r?\n/)
      .filter((line) => line.includes('!COLOUR'))
      .join('\n');
    const isPrimitive = (name: string) => !existsSync(join(LDRAW_DIR, 'parts', name)) && existsSync(join(LDRAW_DIR, 'p', name));
    const roles: Record<string, string> = JSON.parse(readFileSync('data/roles.json', 'utf-8'));
    text = (await packModel(base, modelText ?? readFileSync(file, 'utf-8'), colours, readLdrawFile, isPrimitive, roles)).text;
  }
  // The model's own file is the first; what it places, each on a line of type 1, are the parts
  // and shapes in order. Each colour and file is placed once, where it stands.
  const lines = text.split(/\r?\n/);
  let end = lines.findIndex((line, i) => i > 0 && /^\s*0\s+FILE\s/.test(line));
  if (end < 0) end = lines.length;
  const keyOf: string[] = [];
  const firsts: string[] = [];
  const placed: string[] = [];
  for (const line of lines.slice(0, end)) {
    const f = line.trim().split(/\s+/);
    if (f[0] !== '1') {
      if (f[0] !== '2' && f[0] !== '5') placed.push(line);
      continue;
    }
    const key = `${f[1]} ${f.slice(14).join(' ')}`;
    keyOf.push(key);
    if (firsts.includes(key)) continue;
    firsts.push(key);
    placed.push(`1 ${f[1]} 0 0 0 1 0 0 0 1 0 0 0 1 ${f.slice(14).join(' ')}`);
  }
  const rest = lines.slice(end).filter((line) => !/^\s*[25]\s/.test(line));
  const loader = new LDrawLoader();
  loader.setConditionalLineMaterial(LDrawConditionalLineMaterial);
  const model = await new Promise<Object3D>((resolve, reject) => loader.parse([...placed, ...rest].join('\n'), resolve, reject));
  model.updateMatrixWorld(true);
  // Each child the loader made, matched to its line by what it is (its file and its colour),
  // never by where it falls in the list: a line the loader makes no child for (a subpart or
  // primitive the model places itself, which the loader draws into the model's own mesh; a file
  // that failed to load) must not shift every shape after it onto the next part (the 4558
  // Metroliner's two subparts s/4865p01b and s/4865p01c: from its part 200 on, every part had the
  // next one's shape; decision 242). The model's own mesh, of what it draws itself, is no line's.
  const lineChildren = model.children.filter((obj) => (obj as Object3D & { isGroup?: boolean }).isGroup && obj.userData.colorCode !== undefined);
  const byKey = new Map<string, { name: string; shape: PartMesh[] }>();
  const nameOf = (key: string) => normalizePartName(key.slice(key.indexOf(' ') + 1));
  // A file the model carries itself, the loader names as if in the library (parts/s/…).
  const loaded = (name: string) => normalizePartName(name).replace(/^(parts|p)\//, '');
  let next = 0;
  for (const key of firsts) {
    const obj = lineChildren[next];
    if (!obj || loaded(obj.name) !== nameOf(key) || String(obj.userData.colorCode) !== key.slice(0, key.indexOf(' '))) continue;
    next++;
    const toPart = obj.matrixWorld.clone().invert();
    const shape: PartMesh[] = [];
    obj.traverse((child) => {
      const mesh = child as Mesh;
      if (mesh.isMesh) shape.push({ geometry: collisionGeometry(mesh.geometry), matrix: toPart.clone().multiply(mesh.matrixWorld) });
    });
    byKey.set(key, { name: nameOf(key), shape });
  }
  if (next !== lineChildren.length) throw new Error(`${file}: the loader made ${lineChildren.length} parts and shapes, of which ${next} match the model's lines; from ${lineChildren[next].name} on, none do`);
  // Each line's shape, in order, but the lines the loader makes no child for: as the old reading
  // gave them (the loader's children, a part each, then the shapes the submodels draw), which is
  // how parseModel reads the parts where they agree. They are named; the check's guard (see
  // check-functions.ts) stops a function where the shapes don't match the parts.
  const missing = new Set<string>();
  const out = keyOf.flatMap((key) => {
    const found = byKey.get(key);
    if (!found) missing.add(nameOf(key));
    return found ? [found] : [];
  });
  if (missing.size) console.error(`${base}: no part made of ${[...missing].join(', ')} (drawn into the model, or not loaded)`);
  if (!partNames) return out;
  // One for each of the model's parts, by name, in order. Where the loader and parseModel read a
  // subpart differently (the 42120's embedded s/42120 - faxle1, which the loader makes a part of
  // and parseModel draws into the model; the 4558's s/4865p01b, the other way round), a shape no
  // part has is passed over, and a part the loader made nothing of has no shape. The shapes the
  // submodels draw come after, as they were.
  const aligned: { name: string; shape: PartMesh[] }[] = [];
  let at = 0;
  for (const name of partNames.map(normalizePartName)) {
    let j = at;
    while (j < out.length && out[j].name !== name && /^s\//.test(out[j].name)) j++;
    if (j < out.length && out[j].name === name) {
      aligned.push(out[j]);
      at = j + 1;
    } else aligned.push({ name, shape: [] });
  }
  return [...aligned, ...out.slice(at)];
  // Every copy shares its colour and part's list (see Collisions, which shrinks a list once).
  return out;
}
