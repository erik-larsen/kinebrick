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
import { packModel, REMOVED_FILE } from '../src/pack.ts';

const LDRAW_DIR = 'ldraw';

async function readLdrawFile(name: string): Promise<string | null> {
  for (const dir of ['parts', 'p']) {
    const path = join(LDRAW_DIR, dir, name);
    if (existsSync(path)) return readFileSync(path, 'utf-8');
  }
  return null;
}

// `modelText`: the model's text as read, if not the file's own (a set's file with its errata).
// `parts`: the model's parts as parseModel reads them (readParts' parts): the shapes then come one
// for each of them, matched by name (see the end), with `empty` saying why where a part has none.
export async function partShapes(file: string, modelText?: string, parts?: { name: string; removed?: boolean; path?: unknown }[]): Promise<{ name: string; shape: PartMesh[]; empty?: string }[]> {
  const base = file.replace(/^.*[\\/]/, '').replace(/\.(ldr|mpd)$/i, '');
  let text: string;
  // The files neither the model nor the library has, packed empty (known where packed here).
  let absent = new Set<string>();
  if (existsSync(join('packed', `${base}.mpd`))) text = readFileSync(join('packed', `${base}.mpd`), 'utf-8');
  else {
    const colours = readFileSync(join(LDRAW_DIR, 'LDConfig.ldr'), 'utf-8')
      .split(/\r?\n/)
      .filter((line) => line.includes('!COLOUR'))
      .join('\n');
    const isPrimitive = (name: string) => !existsSync(join(LDRAW_DIR, 'parts', name)) && existsSync(join(LDRAW_DIR, 'p', name));
    const roles: Record<string, string> = JSON.parse(readFileSync('data/roles.json', 'utf-8'));
    const packed = await packModel(base, modelText ?? readFileSync(file, 'utf-8'), colours, readLdrawFile, isPrimitive, roles);
    text = packed.text;
    absent = new Set(packed.missing.map(normalizePartName));
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
  // Nor is a child with no name, wherever it stands: a subpart the model places itself that holds
  // a part, which the loader makes a group of but doesn't name (the 6990's s\2684s01, the monorail
  // motor's gear; decision 247). Its line gets no shape, as one the loader made nothing of.
  const lineChildren = model.children.filter((obj) => (obj as Object3D & { isGroup?: boolean }).isGroup && obj.userData.colorCode !== undefined && obj.name !== '');
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
  // Each line's shape, in order, or null where the loader made no child for it.
  const perLine = keyOf.map((key) => ({ name: nameOf(key), found: byKey.get(key) ?? null }));
  const missing = new Set(perLine.filter((l) => !l.found).map((l) => l.name));
  if (missing.size) console.error(`${base}: no part made of ${[...missing].join(', ')} (drawn into the model, or not loaded)`);
  // Without the parts: the loader's children, a part each, then the shapes the submodels draw.
  if (!parts) return perLine.flatMap((l) => (l.found ? [l.found] : []));
  // One for each of the model's parts, matched by name, in order; a part an erratum removed is
  // drawn as REMOVED_FILE, so its line is matched by that name. Where the loader and parseModel
  // read a subpart differently (the 42120's embedded s/42120 - faxle1, which the loader makes a
  // part of and parseModel draws into the model; the 6990's s/2684s01, which the loader makes a
  // nameless group of and readParts leaves out), a subpart's line no part has is passed over.
  // Every part gets its own line's shape. A part's shape is empty only where its line truly has
  // none, and then `empty` says why: removed by an erratum; a path's part (the 42120's flexible
  // axle's 252 segments, an embedded primitive the loader draws into the model), which has no
  // collision test anyway; a line the loader made nothing of (the 4558's s/4865p01b); a file
  // neither the model nor the library has (the 8094's 3068bd0s and 3068bd0t); or a part the loader
  // made with no triangles. Any other mismatch is an
  // error: one part out of step must not leave every part after it with no shape (decision 248 of
  // 2026-11-20: the 42093's part 7, a 32270 an erratum removes, drawn as REMOVED_FILE, left 569 of
  // its 576 parts with no shape and so with no collision test).
  const aligned: { name: string; shape: PartMesh[]; empty?: string }[] = [];
  let at = 0;
  parts.forEach((part, i) => {
    const name = normalizePartName(part.name);
    const want = part.removed ? REMOVED_FILE : name;
    let j = at;
    while (j < perLine.length && perLine[j].name !== want && /^s\//.test(perLine[j].name)) j++;
    if (j >= perLine.length || perLine[j].name !== want)
      throw new Error(`${base}: part ${i} (${name}${part.removed ? ', removed' : ''}) has no line of its own: the next line is ${perLine[at]?.name ?? 'none'}`);
    at = j + 1;
    const found = perLine[j].found;
    if (part.removed) aligned.push({ name, shape: [], empty: 'removed by an erratum' });
    else if (part.path && !found?.shape.length) aligned.push({ name, shape: [], empty: "a path's part, with no collision test" });
    else if (!found) aligned.push({ name, shape: [], empty: 'the loader made nothing of its line' });
    else if (!found.shape.length && absent.has(name)) aligned.push({ name, shape: [], empty: 'its file is in neither the model nor the library' });
    else if (!found.shape.length) aligned.push({ name, shape: [], empty: 'the loader made it with no triangles' });
    // Every copy shares its colour and part's list (see Collisions, which shrinks a list once).
    else aligned.push(found);
  });
  // The shapes the submodels draw come after, as they were.
  return [...aligned, ...perLine.slice(at).flatMap((l) => (l.found ? [l.found] : []))];
}
