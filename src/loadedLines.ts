// Which child the LDraw loader made for each line of a packed model (see loadedLines).

import { Group, Matrix4, Object3D } from 'three';
import type { LDrawLoader } from 'three/addons/loaders/LDrawLoader.js';
import { normalizePartName } from './connections.ts';
import { colourCode } from './ldr.ts';

// The loader's child for each line of the packed model (a part or a shape), matched by what it is,
// its file and its colour, never by where it falls among the children (decision 250 of
// 2026-11-20). The loader makes a child group for a line whose file is a part or a model, but none
// for one whose file says it is a primitive or a subpart: it draws that into the model's own mesh
// (the 42120's 252 flexible axle segments, "42120 - axlehol8.dat", an unofficial primitive the
// model carries). Matched by place, every part after the first such line had its neighbour's child,
// and the count no longer fitted, so the 42120 never opened. A line with no child gets an empty
// group in its place, with its reason in userData.noChild; a line with no child and no reason, or
// a child no line has, is an error. The colour is as the line writes it (colourCode: a direct
// colour in hex, as the 8110's axle p1365 has). A child with no name (a subpart holding a part, the 6990's
// s/2684s01) is no line's, as in the check's shapes (scripts/part-shapes.ts).
export function loadedLines(model: Object3D, lines: { name: string; color: number; matrix: Matrix4 }[], loader: LDrawLoader): Object3D[] {
  const children = model.children.filter((obj) => (obj as Group).isGroup && obj.userData.colorCode !== undefined && obj.name !== '');
  // A file the model carries, the loader names as if in the library (parts/s/…, p/48/…).
  const loaded = (name: string) => normalizePartName(name).replace(/^(parts|p)\//, '');
  // The name the loader looks a line's file up by (see LDrawLoader's line of type 1).
  const loaderName = (name: string) => {
    const file = name.replace(/\\/g, '/');
    return file.startsWith('s/') ? `parts/${file}` : file.startsWith('48/') ? `p/${file}` : file;
  };
  let next = 0;
  const objects = lines.map((line, i) => {
    const child = children[next];
    if (child && loaded(child.name) === normalizePartName(line.name) && String(child.userData.colorCode) === colourCode(line.color)) {
      next++;
      return child;
    }
    const type: string | undefined = (loader as unknown as { partsCache: { parseCache: { getData(name: string, clone: boolean): { type?: string } | null } } }).partsCache.parseCache.getData(loaderName(line.name), false)?.type;
    if (!type || !(/primitive/i.test(type) || type === 'Subpart')) {
      throw new Error(`Line ${i} (${line.name}): the loader made no part of it${type ? ` (its file is a ${type})` : ' (its file did not load)'}`);
    }
    // Nothing to draw: the loader drew it into the model. The group keeps the line's place.
    const empty = new Group();
    empty.name = line.name;
    empty.userData.colorCode = line.color;
    empty.userData.noChild = `its file is a ${type}, which the loader draws into the model`;
    line.matrix.decompose(empty.position, empty.quaternion, empty.scale);
    model.add(empty);
    return empty;
  });
  if (next !== children.length) throw new Error(`The loader made ${children.length} parts and shapes, of which ${next} match the model's lines; from ${children[next].name} on, none do`);
  return objects;
}

