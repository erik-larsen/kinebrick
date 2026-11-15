// The viewer's helper for the first collision pass, run beside the page so the page stays live:
// which pairs of parts already touch, or nearly touch, as the model is built (see Collisions).
// Testing them is most of a big model's load (4.5 s on the 42114), and the page needs none of it
// to draw the model or turn the view; a drag or a motor goes without the collision stop until
// the answer comes.
//
// The page sends one message: { shapes, pairs, matrices }: each part's shrunken meshes (as
// Collisions.shapeArrays gives them), the pairs to test as [a, b], and each part's placement as
// a matrix's 16 numbers. The answer is { near }: the pairs that are near, as [a, b].

import { BufferAttribute, BufferGeometry, Matrix4 } from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { shapesNear } from './collisions.ts';

type Arrays = { meshes: { position: Float32Array; index: Uint32Array | Uint16Array | null; matrix: number[] }[] };

self.onmessage = (event: MessageEvent) => {
  const { shapes, pairs, matrices } = event.data as { shapes: Arrays[]; pairs: [number, number][]; matrices: number[][] };
  // Each part's shape with its trees of boxes, built only for the parts some pair names.
  const built = new Map<number, { meshes: { geometry: BufferGeometry; bvh: MeshBVH; matrix: Matrix4 }[] }>();
  const shapeOf = (i: number) => {
    let shape = built.get(i);
    if (!shape) {
      shape = {
        meshes: shapes[i].meshes.map((m) => {
          const geometry = new BufferGeometry();
          geometry.setAttribute('position', new BufferAttribute(m.position, 3));
          if (m.index) geometry.setIndex(new BufferAttribute(m.index, 1));
          // Each geometry keeps its tree of boxes, as on the page: a test against another mesh
          // uses that mesh's tree too, rather than all its triangles.
          const bvh = new MeshBVH(geometry);
          geometry.boundsTree = bvh;
          return { geometry, bvh, matrix: new Matrix4().fromArray(m.matrix) };
        }),
      };
      built.set(i, shape);
    }
    return shape;
  };
  const placed = matrices.map((e) => new Matrix4().fromArray(e));
  const start = performance.now();
  for (const [a, b] of pairs) shapeOf(a), shapeOf(b);
  const builtIn = performance.now() - start;
  const near = pairs.filter(([a, b]) => shapesNear(shapeOf(a), shapeOf(b), placed[a].clone().invert().multiply(placed[b])));
  // How long its two stages took, in ms, for whoever wants to know (the page shows it with `debug`).
  self.postMessage({ near, took: { trees: Math.round(builtIn), tests: Math.round(performance.now() - start - builtIn) } });
};
