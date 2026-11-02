// The shapes of a model's parts, for collision checks in the scripts (see check-functions.ts),
// as the viewer makes them: each part's meshes in the part's own coordinates, with the part's
// name, in the packed model's order (its parts, then the shapes its submodels draw). One of
// Kinebrick's own models is read from its packed file; a set from the OMR is packed here and
// now, from the LDraw library in ldraw/, as pack-models.ts does.

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

export async function partShapes(file: string): Promise<{ name: string; shape: PartMesh[] }[]> {
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
    text = (await packModel(base, readFileSync(file, 'utf-8'), colours, readLdrawFile, isPrimitive, roles)).text;
  }
  const loader = new LDrawLoader();
  loader.setConditionalLineMaterial(LDrawConditionalLineMaterial);
  const model = await new Promise<Object3D>((resolve, reject) => loader.parse(text, resolve, reject));
  model.updateMatrixWorld(true);
  return model.children.map((obj) => {
    const toPart = obj.matrixWorld.clone().invert();
    const shape: PartMesh[] = [];
    obj.traverse((child) => {
      const mesh = child as Mesh;
      if (mesh.isMesh) shape.push({ geometry: collisionGeometry(mesh.geometry), matrix: toPart.clone().multiply(mesh.matrixWorld) });
    });
    return { name: normalizePartName(obj.name), shape };
  });
}
