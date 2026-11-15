// Stops parts passing through each other. After each small step of a drag, checks whether
// any two parts have started to overlap; if so, the step is undone and the drag stops there.
//
// Which pairs of parts are checked: parts on different bodies (parts on one body never move
// against each other) that aren't directly connected (an axle in a hole, a tyre on its rim
// and meshing gear teeth all touch legitimately; the caller counts any two gears as connected)
// and don't already touch, or nearly touch, when the model loads (a rim pressed against a
// brick; a bush built flush against a brick, which on the real model just rubs past it as the
// wheel steers).
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
import type { Mechanism } from './mechanism.ts';

// How far each part's shape is pulled in at each face of its box for collision checks, in
// LDU. Faces that merely touch (a beam sliding across the flush head of a pin) then don't
// count as overlapping; anything that really passes through still does.
export const INSET = 0.25;
// Parts this close when the model loads, in LDU (after INSET), aren't checked against each
// other: real models are built tight, and parts that rub on the real thing don't stop it.
export const NEAR = 1;

// A copy of a mesh's geometry for collision checks: its positions and its index.
export function collisionGeometry(source: BufferGeometry): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(source.getAttribute('position').array), 3));
  if (source.index) geometry.setIndex(source.index.clone());
  return geometry;
}

// The pairs of parts that may touch, as "a,b" (the lower first), so aren't checked: those directly
// connected, or on the same pin or axle (two beams on one pin lie face to face), and gears.
export function connectedPairs(mech: Mechanism): Set<string> {
  const connected = new Set<string>();
  const pairKey = (a: number, b: number) => (a < b ? `${a},${b}` : `${b},${a}`);
  for (const c of mech.connections) connected.add(pairKey(c.male, c.female));
  for (const a of mech.connections) {
    for (const b of mech.connections) {
      if (a.male === b.male && a.female !== b.female && a.kind !== 'stud' && b.kind !== 'stud') connected.add(pairKey(a.female, b.female));
    }
  }
  for (const m of mech.meshes) connected.add(pairKey(mech.gears[m.gearA].part, mech.gears[m.gearB].part));
  // Nor are any two gears: Kinebrick doesn't know where each gear's teeth are round it, so two
  // gears coming into mesh would seem to run into each other tip to tip, short of it (the 952
  // Tractor's harrow, lowered onto its power take-off, stopped 3 LDU short).
  for (const a of mech.gears) for (const b of mech.gears) if (a.part !== b.part) connected.add(pairKey(a.part, b.part));
  // Nor a train's wheels and the track's rails: the wheels run on them, and reach each piece
  // of track in turn.
  const rails = mech.roles.flatMap((r, i) => (r === 'rail' ? [i] : []));
  for (const t of mech.treads) for (const r of rails) connected.add(pairKey(t.part, r));
  // Nor the parts of train couplings with each other: two cars' magnets, casings and holders
  // meet face to face, and with one holder of each coupling fixed (see magnetCouplings) they
  // run into each other a little as the cars take a curve, where the real ones swivel clear.
  const couplings = mech.roles.flatMap((r, i) => (r === 'coupling' || r === 'magnet' ? [i] : []));
  for (const a of couplings) for (const b of couplings) if (a !== b) connected.add(pairKey(a, b));
  return connected;
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

// A pair of parts as one number, the lower first (see Collisions).
export const pairNumber = (a: number, b: number, count: number) => (a < b ? a * count + b : b * count + a);

// Whether two parts' shapes (their shrunken meshes and trees of boxes) are within NEAR of each
// other, b placed relative to a as `bToA` says. Used on the page and beside it (collisionWorker.ts).
export function shapesNear(a: { meshes: { geometry: BufferGeometry; bvh: MeshBVH; matrix: Matrix4 }[] }, b: { meshes: { geometry: BufferGeometry; matrix: Matrix4 }[] }, bToA: Matrix4): boolean {
  for (const ma of a.meshes) {
    const aMeshInverse = ma.matrix.clone().invert();
    for (const mb of b.meshes) {
      const toA = aMeshInverse.clone().multiply(bToA).multiply(mb.matrix);
      if (ma.bvh.intersectsGeometry(mb.geometry, toA)) return true;
      const hit = () => ({ point: new Vector3(), distance: 0, faceIndex: 0 });
      // The closest points found, if any: the search skips boxes further than NEAR, but within a
      // box it keeps the closest triangles it meets, however far (on the 8838, two parts 5.3 LDU
      // apart, or not, by which boxes it happened to enter, so the answer hung on what was tested
      // before). So the distance is what says.
      const closest = ma.bvh.closestPointToGeometry(mb.geometry, toA, hit(), hit(), 0, NEAR);
      if (closest && closest.distance <= NEAR) return true;
    }
  }
  return false;
}

// The pairs of parts whose boxes, placed as `partMatrices` says, come within NEAR of each other,
// found by sorting the boxes along x rather than by trying every pair (8.9 million on the 42114,
// of which 1,842 meet). `keep` says which of them are wanted.
export function meetingPairs(boxes: Box3[], partMatrices: Matrix4[], keep: (a: number, b: number) => boolean): [number, number][] {
  const placed = boxes.map((box, i) => (box.isEmpty() ? null : box.clone().applyMatrix4(partMatrices[i])));
  const order = placed.map((_, i) => i).filter((i) => placed[i]).sort((i, j) => placed[i]!.min.x - placed[j]!.min.x);
  const pairs: [number, number][] = [];
  for (let k = 0; k < order.length; k++) {
    const a = order[k];
    const boxA = placed[a]!.clone().expandByScalar(NEAR);
    for (let l = k + 1; l < order.length; l++) {
      const b = order[l];
      if (placed[b]!.min.x > boxA.max.x) break;
      if (!boxA.intersectsBox(placed[b]!)) continue;
      const pair: [number, number] = a < b ? [a, b] : [b, a];
      if (keep(pair[0], pair[1])) pairs.push(pair);
    }
  }
  return pairs;
}

// The key a kept result of the first pass is filed under (see nearPairsOf, data/collisions/):
// what the result depends on, and nothing of the reading. The model's text as read (after its
// errata), the parts library's release (LDConfig.ldr's update line, which a release changes; a
// part changed between releases isn't caught), INSET and NEAR. A SHA-256 in hex.
export async function collisionKey(modelText: string, libraryRelease: string): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify([modelText, libraryRelease, INSET, NEAR]));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// The kept file's name for a model (see keptPairs.ts): the model file's name, without .mpd or
// .ldr, with any sign but letters, digits, spaces and . _ ( ) - made _, since the viewer loads
// the file by its address, where a # or a ? would cut it short (the 42125 Ferrari 488 GTE AF
// CORSE #51).
export const keptFileName = (model: string) =>
  model
    .replace(/^.*[\\/]/, '')
    .replace(/\.(ldr|mpd|io)$/i, '')
    .replace(/[^A-Za-z0-9 ._()-]/g, '_');

// The parts library's release, from LDConfig.ldr's text: its "!LDRAW_ORG ... UPDATE" line.
export function libraryRelease(ldconfig: string): string {
  return /^0 !LDRAW_ORG .*$/m.exec(ldconfig)?.[0].trim() ?? '';
}

// The first pass's whole result, kept per model (see data/collisions/): every pair of parts
// whose boxes meet as built, whatever bodies they're on, and which of them are near. It doesn't
// depend on how the model is read, so a change to the inference never makes it stale.
export function nearPairsOf(meshes: PartMesh[][], partMatrices: Matrix4[]): { tested: [number, number][]; near: [number, number][] } {
  const c = new Collisions(meshes, meshes.map((_, i) => i), new Set(), partMatrices, true);
  const tested = meetingPairs(c.shapeBoxes(), partMatrices, () => true);
  return { tested, near: tested.filter(([a, b]) => c.nearNow(a, b, partMatrices)) };
}

export class Collisions {
  private shapes: Shape[];
  private groups: Group[] = [];
  // For each pair tested for nearness, whether it was near, and how the second part sat relative
  // to the first when tested: a pair that hasn't moved against itself needn't be tested again
  // (after a shift, only the parts the shift moved are).
  private known = new Map<number, { near: boolean; relative: Matrix4 }>();
  // Whether the page is waiting for the pairs near at the start, found beside it (see the
  // constructor's `later` and collisionWorker.ts): meanwhile nothing is watched, and `check` finds
  // nothing. `last` is the mechanism to watch for once they come.
  waiting = false;
  private last: { bodyOf: number[]; connected: Set<string>; partMatrices: Matrix4[] } | null = null;

  // `meshes[i]` are part i's meshes; `bodyOf[i]` its body; `connected` holds "i,j" (i < j)
  // for parts that are directly connected; `partMatrices` gives each part's current
  // placement (part -> model coordinates). With `later`, the pairs near at the start aren't
  // found here: `nearPairs` then says which they are (see setNear), and the page goes on
  // meanwhile.
  constructor(meshes: PartMesh[][], bodyOf: number[], connected: Set<string>, partMatrices: Matrix4[], later = false) {
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
    this.waiting = later;
    this.watch(bodyOf, connected, partMatrices);
  }

  // Each part's box, in its own coordinates.
  shapeBoxes(): Box3[] {
    return this.shapes.map((s) => s.box);
  }

  // The pairs to test for nearness: on different bodies, not connected, their boxes meeting.
  candidates(bodyOf: number[], connected: Set<string>, partMatrices: Matrix4[]): [number, number][] {
    return meetingPairs(
      this.shapes.map((s) => s.box),
      partMatrices,
      (a, b) => bodyOf[a] !== bodyOf[b] && !connected.has(`${a},${b}`),
    );
  }

  // The answer to `candidates`, found elsewhere: which of `tested` (placed as `partMatrices`
  // said) are near. Then the pairs to watch are worked out, for the mechanism last given, placed
  // as `now` says: a drag or a motor may have moved the model while the answer was being found,
  // even passing a part through another, and the stop must never trap it, so the pose it comes in
  // is taken as the start (a pair that moved is tested again there, and one that overlaps then
  // isn't watched, as if built touching).
  setNear(tested: [number, number][], near: Set<number>, partMatrices: Matrix4[], now = partMatrices) {
    const n = this.shapes.length;
    for (const [a, b] of tested) this.known.set(pairNumber(a, b, n), { near: near.has(pairNumber(a, b, n)), relative: partMatrices[a].clone().invert().multiply(partMatrices[b]) });
    this.waiting = false;
    if (this.last) this.watch(this.last.bodyOf, this.last.connected, now);
  }

  // The shapes, as plain arrays, for finding the near pairs beside the page (collisionWorker.ts).
  // Only the parts in `only` get their meshes; the rest come empty, keeping their numbers.
  shapeArrays(only: Set<number>): { meshes: { position: Float32Array; index: Uint32Array | Uint16Array | null; matrix: number[] }[] }[] {
    return this.shapes.map((s, i) => ({
      meshes: !only.has(i) ? [] : s.meshes.map((m) => ({
        position: new Float32Array(m.geometry.getAttribute('position').array as ArrayLike<number>),
        index: m.geometry.index ? (m.geometry.index.array.slice() as Uint32Array | Uint16Array) : null,
        matrix: m.matrix.toArray(),
      })),
    }));
  }

  // Whether a and b are near, placed as `partMatrices` says, tested here (where the page can't
  // use a helper beside it).
  nearNow(a: number, b: number, partMatrices: Matrix4[]): boolean {
    return shapesNear(this.shapes[a], this.shapes[b], partMatrices[a].clone().invert().multiply(partMatrices[b]));
  }

  // Whether a and b are near, placed as `partMatrices` says: as found before if they haven't moved
  // against each other since, else tested now.
  private isNear(a: number, b: number, partMatrices: Matrix4[]): boolean {
    const key = pairNumber(a, b, this.shapes.length);
    const relative = partMatrices[a].clone().invert().multiply(partMatrices[b]);
    const known = this.known.get(key);
    if (known && sameMatrix(known.relative, relative)) return known.near;
    const near = shapesNear(this.shapes[a], this.shapes[b], relative);
    this.known.set(key, { near, relative });
    return near;
  }

  // Works out which pairs of parts to watch, for a mechanism worked out afresh (after a shift).
  // Same arguments as the constructor. Until the near pairs are known (see setNear), it only
  // remembers them.
  watch(bodyOf: number[], connected: Set<string>, partMatrices: Matrix4[]) {
    this.last = { bodyOf, connected, partMatrices };
    if (this.waiting) return;
    const n = this.shapes.length;
    const joined = new Set([...connected].map((key) => key.split(',').map(Number)).map(([a, b]) => pairNumber(a, b, n)));
    const near = new Set(this.candidates(bodyOf, connected, partMatrices).filter(([a, b]) => this.isNear(a, b, partMatrices)).map(([a, b]) => pairNumber(a, b, n)));
    const groups = new Map<number, Group>();
    const bodies = Math.max(0, ...bodyOf) + 1;
    for (let a = 0; a < n; a++) {
      for (let b = a + 1; b < n; b++) {
        if (bodyOf[a] === bodyOf[b] || near.has(a * n + b) || joined.has(a * n + b)) continue;
        const key = bodyOf[a] * bodies + bodyOf[b];
        let group = groups.get(key);
        if (!group) groups.set(key, (group = { pairs: [], onA: [], onB: [], a, b, lastClear: null }));
        group.pairs.push([a, b]);
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
