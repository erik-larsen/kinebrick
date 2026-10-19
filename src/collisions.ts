// Stops parts passing through each other. After each small step of a drag, checks whether
// any two parts have started to overlap; if so, the step is undone and the drag stops there.
//
// Which pairs of parts are checked: parts on different bodies (parts on one body never move
// against each other) that aren't directly connected (an axle in a hole, a tyre on its rim
// and meshing gear teeth all touch legitimately) and don't already touch, or nearly touch,
// when the model loads (a rim pressed against a brick; a bush built flush against a brick,
// which on the real model just rubs past it as the wheel steers).
//
// The shapes are the parts' own LDraw meshes, tested with three-mesh-bvh, a library that
// sorts each mesh's triangles into a tree of boxes so two meshes can be tested quickly. Pairs
// are grouped by the two bodies they're on: parts on two bodies that haven't moved against each
// other since last found clear can't have started to overlap, so the whole group is skipped.
// Cheap box checks (around each body's parts, then each part) skip pairs that aren't near
// each other. Each shape is shrunk a
// little towards its middle (by INSET at each face of its box), so parts that only touch,
// face to face, don't count.

import { Box3, BufferAttribute, BufferGeometry, Matrix4, Vector3 } from 'three';

// How far each part's shape is pulled in at each face of its box for collision checks, in
// LDU. Faces that merely touch (a beam sliding across the flush head of a pin) then don't
// count as overlapping; anything that really passes through still does.
const INSET = 0.25;
// Parts this close when the model loads, in LDU (after INSET), aren't checked against each
// other: real models are built tight, and parts that rub on the real thing don't stop it.
const NEAR = 1;

// A copy of a mesh's geometry for collision checks: its positions and its index.
export function collisionGeometry(source: BufferGeometry): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(source.getAttribute('position').array), 3));
  if (source.index) geometry.setIndex(source.index.clone());
  return geometry;
}

// Pulls a part's meshes in towards the middle of their box, by INSET at each face.
function shrink(list: PartMesh[]) {
  const box = new Box3();
  for (const m of list) {
    m.geometry.computeBoundingBox();
    box.union(m.geometry.boundingBox!.clone().applyMatrix4(m.matrix));
  }
  const middle = box.getCenter(new Vector3());
  const size = box.getSize(new Vector3());
  const scale = new Vector3(1, 1, 1);
  for (let k = 0; k < 3; k++) {
    if (size.getComponent(k) > 4 * INSET) scale.setComponent(k, 1 - (2 * INSET) / size.getComponent(k));
  }
  for (const m of list) {
    const toMesh = m.matrix.clone().invert();
    const position = m.geometry.getAttribute('position');
    const v = new Vector3();
    for (let i = 0; i < position.count; i++) {
      v.fromBufferAttribute(position, i).applyMatrix4(m.matrix).sub(middle).multiply(scale).add(middle).applyMatrix4(toMesh);
      position.setXYZ(i, v.x, v.y, v.z);
    }
  }
}
import { MeshBVH } from 'three-mesh-bvh';

// One mesh of a part, in the part's own coordinates.
export interface PartMesh {
  geometry: BufferGeometry; // from collisionGeometry; the BVH reorders the index
  matrix: Matrix4; // mesh -> part
}

interface Shape {
  meshes: { geometry: BufferGeometry; bvh: MeshBVH; matrix: Matrix4 }[];
  box: Box3; // in the part's own coordinates
}

// The watched pairs of parts on two bodies.
interface Group {
  pairs: [number, number][];
  onA: number[]; // the parts in those pairs on each body
  onB: number[];
  // A part on each body, and how the second sat relative to the first when the group was last
  // found clear. If that hasn't changed, no pair in the group can have started to overlap.
  a: number;
  b: number;
  lastClear: Matrix4 | null;
}

export class Collisions {
  private shapes: Shape[];
  private groups: Group[] = [];

  // `meshes[i]` are part i's meshes; `bodyOf[i]` its body; `connected` holds "i,j" (i < j)
  // for parts that are directly connected; `partMatrices` gives each part's current
  // placement (part -> model coordinates).
  constructor(meshes: PartMesh[][], bodyOf: number[], connected: Set<string>, partMatrices: Matrix4[]) {
    this.shapes = meshes.map((list) => {
      shrink(list);
      const box = new Box3();
      const built = list.map((m) => {
        const bvh = new MeshBVH(m.geometry);
        m.geometry.boundsTree = bvh;
        m.geometry.computeBoundingBox();
        box.union(m.geometry.boundingBox!.clone().applyMatrix4(m.matrix));
        return { geometry: m.geometry, bvh, matrix: m.matrix };
      });
      return { meshes: built, box };
    });
    this.watch(bodyOf, connected, partMatrices);
  }

  // Works out which pairs of parts to watch, for a mechanism worked out afresh (after a shift).
  // Same arguments as the constructor.
  watch(bodyOf: number[], connected: Set<string>, partMatrices: Matrix4[]) {
    const groups = new Map<string, Group>();
    for (let a = 0; a < this.shapes.length; a++) {
      for (let b = a + 1; b < this.shapes.length; b++) {
        if (bodyOf[a] === bodyOf[b] || connected.has(`${a},${b}`)) continue;
        if (this.near(a, b, partMatrices)) continue; // already touching, or nearly, at the start
        const key = `${bodyOf[a]},${bodyOf[b]}`;
        if (!groups.has(key)) groups.set(key, { pairs: [], onA: [], onB: [], a, b, lastClear: null });
        groups.get(key)!.pairs.push([a, b]);
      }
    }
    this.groups = [...groups.values()];
    for (const g of this.groups) {
      g.onA = [...new Set(g.pairs.map(([a]) => a))];
      g.onB = [...new Set(g.pairs.map(([, b]) => b))];
    }
  }

  // How many pairs of parts are being watched.
  get watchedPairs(): number {
    return this.groups.reduce((sum, g) => sum + g.pairs.length, 0);
  }

  // A part that has gone below the ground (LDraw y `ground`, which points down), as a pair of
  // it with itself, or null if none has: a crane's hook let down too far. Parts that reach to
  // within NEAR of the ground at `start` (tyres, outrigger pads) aren't checked (by the box
  // round each part as it was built).
  belowGround(partMatrices: Matrix4[], ground: number, start: Matrix4[]): [number, number] | null {
    for (let i = 0; i < this.shapes.length; i++) {
      const box = this.shapes[i].box;
      if (box.isEmpty() || box.clone().applyMatrix4(start[i]).max.y > ground - NEAR) continue;
      // A box turned with its part reaches further than the part (a big wheel's rim, turned an
      // eighth of a turn, would reach below its tyre): so where it does, the part's own shape
      // is looked at.
      if (box.clone().applyMatrix4(partMatrices[i]).max.y > ground && this.lowest(i, partMatrices[i]) > ground) return [i, i];
    }
    return null;
  }

  // How low a part's shape reaches (its greatest LDraw y), placed as `matrix` says.
  private lowest(part: number, matrix: Matrix4): number {
    let low = -Infinity;
    for (const m of this.shapes[part].meshes) {
      const e = matrix.clone().multiply(m.matrix).elements;
      const position = m.geometry.getAttribute('position');
      for (let k = 0; k < position.count; k++) {
        const y = e[1] * position.getX(k) + e[5] * position.getY(k) + e[9] * position.getZ(k) + e[13];
        if (y > low) low = y;
      }
    }
    return low;
  }

  // The first pair of watched parts that now overlap, or null if none do.
  check(partMatrices: Matrix4[]): [number, number] | null {
    // Each part's box in model coordinates, worked out when first needed.
    const boxes: (Box3 | undefined)[] = [];
    const boxOf = (i: number) => (boxes[i] ??= this.shapes[i].box.clone().applyMatrix4(partMatrices[i]));
    for (const group of this.groups) {
      const relative = partMatrices[group.a].clone().invert().multiply(partMatrices[group.b]);
      if (group.lastClear && sameMatrix(group.lastClear, relative)) continue;
      // Boxes round each side's watched parts: if they don't meet, no pair can.
      const sideA = new Box3();
      const sideB = new Box3();
      for (const a of group.onA) sideA.union(boxOf(a));
      for (const b of group.onB) sideB.union(boxOf(b));
      if (sideA.intersectsBox(sideB)) {
        for (const [a, b] of group.pairs) {
          if (boxOf(a).intersectsBox(boxOf(b)) && this.overlap(a, b, partMatrices)) return [a, b];
        }
      }
      group.lastClear = relative;
    }
    return null;
  }

  // Whether two parts' meshes are within NEAR of each other, placed as `partMatrices` says.
  private near(a: number, b: number, partMatrices: Matrix4[]): boolean {
    const boxA = this.shapes[a].box.clone().applyMatrix4(partMatrices[a]).expandByScalar(NEAR);
    const boxB = this.shapes[b].box.clone().applyMatrix4(partMatrices[b]);
    if (!boxA.intersectsBox(boxB)) return false;
    const bToA = partMatrices[a].clone().invert().multiply(partMatrices[b]);
    for (const ma of this.shapes[a].meshes) {
      const aMeshInverse = ma.matrix.clone().invert();
      for (const mb of this.shapes[b].meshes) {
        const toA = aMeshInverse.clone().multiply(bToA).multiply(mb.matrix);
        if (ma.bvh.intersectsGeometry(mb.geometry, toA)) return true;
        const hit = () => ({ point: new Vector3(), distance: 0, faceIndex: 0 });
        if (ma.bvh.closestPointToGeometry(mb.geometry, toA, hit(), hit(), 0, NEAR)) return true;
      }
    }
    return false;
  }

  // Whether two parts' meshes overlap, placed as `partMatrices` says.
  // (The caller has already checked their boxes meet.)
  private overlap(a: number, b: number, partMatrices: Matrix4[]): boolean {
    // b's coordinates -> a's coordinates
    const bToA = partMatrices[a].clone().invert().multiply(partMatrices[b]);
    for (const ma of this.shapes[a].meshes) {
      const aMeshInverse = ma.matrix.clone().invert();
      for (const mb of this.shapes[b].meshes) {
        // mb's mesh -> b's part -> a's part -> ma's mesh
        const toA = aMeshInverse.clone().multiply(bToA).multiply(mb.matrix);
        if (ma.bvh.intersectsGeometry(mb.geometry, toA)) return true;
      }
    }
    return false;
  }
}

function sameMatrix(a: Matrix4, b: Matrix4): boolean {
  for (let i = 0; i < 16; i++) if (Math.abs(a.elements[i] - b.elements[i]) > 1e-9) return false;
  return true;
}
