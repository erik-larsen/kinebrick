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
export async function partShapes(file: string, modelText?: string): Promise<{ name: string; shape: PartMesh[] }[]> {
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
  let next = 0;
  for (const key of firsts) {
    const obj = lineChildren[next];
    if (!obj || normalizePartName(obj.name) !== nameOf(key) || String(obj.userData.colorCode) !== key.slice(0, key.indexOf(' '))) continue;
    next++;
    const toPart = obj.matrixWorld.clone().invert();
    const shape: PartMesh[] = [];
    obj.traverse((child) => {
      const mesh = child as Mesh;
      if (mesh.isMesh) shape.push({ geometry: collisionGeometry(mesh.geometry), matrix: toPart.clone().multiply(mesh.matrixWorld) });
    });
    byKey.set(key, { name: normalizePartName(obj.name), shape });
  }
  if (next !== lineChildren.length) throw new Error(`${file}: the loader made ${lineChildren.length} parts and shapes, of which ${next} match the model's lines; from ${lineChildren[next].name} on, none do`);
  // Each line's shape, in order: the model's parts as parseModel reads them, then the shapes its
  // submodels draw. A line the loader made no child for has no shape, and is named: the check
  // gets no collision for that part, rather than the next part's.
  const missing = new Set<string>();
  const out = keyOf.map((key) => {
    const found = byKey.get(key);
    if (found) return found;
    missing.add(nameOf(key));
    return { name: nameOf(key), shape: [] as PartMesh[] };
  });
  if (missing.size) console.error(`${base}: no shape for ${[...missing].join(', ')}: the loader makes no part of ${missing.size === 1 ? 'it' : 'them'} (drawn into the model, or not loaded)`);
  // Every copy shares its colour and part's list (see Collisions, which shrinks a list once).
  return out;
}
