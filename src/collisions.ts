// Stops parts passing through each other. After each small step of a drag, checks whether
// any two parts have started to overlap; if so, the step is undone and the drag stops there.
//
// Which pairs of parts are checked: parts on different bodies (parts on one body never move
// against each other) that aren't directly connected (an axle in a hole, a tyre on its rim
// and meshing gear teeth all touch legitimately) and don't already touch when the model
// loads (a rim pressed against a brick).
//
// The shapes are the parts' own LDraw meshes, tested with three-mesh-bvh, a library that
// sorts each mesh's triangles into a tree of boxes so two meshes can be tested quickly. A
// cheap box check first skips pairs that aren't near each other.

import { Box3, BufferGeometry, Matrix4 } from 'three';
import { MeshBVH } from 'three-mesh-bvh';

// One mesh of a part, in the part's own coordinates.
export interface PartMesh {
  geometry: BufferGeometry; // positions (and index, if any) only; the BVH reorders the index
  matrix: Matrix4; // mesh -> part
}

interface Shape {
  meshes: { geometry: BufferGeometry; bvh: MeshBVH; matrix: Matrix4 }[];
  box: Box3; // in the part's own coordinates
}

export class Collisions {
  private shapes: Shape[];
  private pairs: [number, number][] = [];
  // For each checked pair: how the second part sat relative to the first when last found
  // clear. If that hasn't changed, the pair can't have started to overlap.
  private lastClear = new Map<string, Matrix4>();

  // `meshes[i]` are part i's meshes; `bodyOf[i]` its body; `connected` holds "i,j" (i < j)
  // for parts that are directly connected; `partMatrices` gives each part's current
  // placement (part -> model coordinates).
  constructor(meshes: PartMesh[][], bodyOf: number[], connected: Set<string>, partMatrices: Matrix4[]) {
    this.shapes = meshes.map((list) => {
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
    for (let a = 0; a < meshes.length; a++) {
      for (let b = a + 1; b < meshes.length; b++) {
        if (bodyOf[a] === bodyOf[b] || connected.has(`${a},${b}`)) continue;
        if (this.overlap(a, b, partMatrices)) continue; // already touching at the start
        this.pairs.push([a, b]);
      }
    }
  }

  // How many pairs of parts are being watched.
  get watchedPairs(): number {
    return this.pairs.length;
  }

  // The first pair of watched parts that now overlap, or null if none do.
  check(partMatrices: Matrix4[]): [number, number] | null {
    for (const [a, b] of this.pairs) {
      const key = `${a},${b}`;
      const relative = partMatrices[a].clone().invert().multiply(partMatrices[b]);
      const last = this.lastClear.get(key);
      if (last && sameMatrix(last, relative)) continue;
      if (this.overlap(a, b, partMatrices)) return [a, b];
      this.lastClear.set(key, relative);
    }
    return null;
  }

  // Whether two parts' meshes overlap, placed as `partMatrices` says.
  private overlap(a: number, b: number, partMatrices: Matrix4[]): boolean {
    const boxA = this.shapes[a].box.clone().applyMatrix4(partMatrices[a]);
    const boxB = this.shapes[b].box.clone().applyMatrix4(partMatrices[b]);
    if (!boxA.intersectsBox(boxB)) return false;
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
