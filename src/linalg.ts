// The linear algebra the solver runs on: null spaces, orthonormal bases, Gram matrices, the
// symmetric eigen-solve, the tiers' least squares (leastTurning) and the damped solution that
// closes the loops. Plain loops on plain arrays: on a big model these take most of a step.
// Nothing here knows about parts, bodies or joints.

// A row of the equations: coefficients for the motion vector, all equal to zero.
export type Row = number[];

// Numbers smaller than this count as zero when solving the equations.
export const EPSILON = 1e-9;
// When solving for the free motions, an equation counts as already implied by the others if
// what's left of it after elimination is smaller than this. It must be well above how far
// apart closeLoops leaves a loop's joints: a planar linkage moves only because some of its
// joints' equations repeat each other, and a tiny misalignment would make them look
// independent, jamming it.
export const RANK_TOLERANCE = 1e-6;
// A tier's motions count as costing nothing (see leastTurning) below this, as a fraction of the
// most a free motion of unit size costs there.
const TIER_TOLERANCE = 1e-10;
// A tier counts as costing nothing at all (see leastTurning) if its costs are at most this, as a
// fraction of the most a motion of unit size turns the joints (both squared).
const NOISE = 1e-20;
// How many rounds of reweighting a sparse tier gets (see leastTurning).
const SPARSE_ROUNDS = 30;

// Of orthonormal motions, the smallest mix that turns at rate 1 (by `rate`), or null if none
// of them turns at all, its size measured by the length of `size` of it: the mix a minimizing
// aᵀ G a with Σ a_k rate_k = 1, where G holds each pair of motions' sizes multiplied together,
// is a = G⁻¹ rates / (ratesᵀ G⁻¹ rates).
export function smallestTurning(motions: number[][], rate: (m: number[]) => number, size: (m: number[]) => number[]): number[] | null {
  const rates = motions.map(rate);
  const sizes = motions.map(size);
  const gram = sizes.map((a) => sizes.map((b) => a.reduce((sum, x, i) => sum + x * b[i], 0)));
  // How fast joints turn in the motions at all. Motions are made to unit size, and moving a body
  // far from the model's origin counts for more and more (its speed there), so a car driven far
  // off has motions in which every joint turns slowly: whether this joint turns is judged
  // against that.
  const scale = Math.max(...gram.map((row, i) => row[i]));
  if (!(scale > 0) || rates.reduce((sum, r) => sum + r * r, 0) < EPSILON * scale) return null;
  const mix = solveSymmetric(gram, rates, EPSILON * scale);
  const turns = mix.reduce((sum, a, k) => sum + a * rates[k], 0);
  if (Math.abs(turns) < EPSILON) return null;
  return combine(motions, mix.map((a) => a / turns));
}

// Of orthonormal motions, the mix that turns the joint at rate 1 (by `rate`) and, tier by tier,
// moves each tier as little as it can (see Kinematics.leastTiers): least squares in the first
// tier, then among the mixes that cost no more there, least squares in the next, and so on. Null
// if none turns the joint (judged as smallestTurning judges it, by the joints' tier).
//
// The mixes a with Σ a_k rate_k = 1 are a0 + N y: a0 along the rates, N's columns (orthonormal)
// across them. For each tier, C its components applied to each motion, the y making
// |C (a0 + N y)|² least is found from the eigenvectors of (C N)ᵀ(C N); those with eigenvalues
// that are next to nothing cost nothing there, and are what's left free for the next tier.
export interface Tier {
  cost: (m: number[]) => number[]; // what the tier moves, for a motion
  sparse?: boolean; // least sum of sizes rather than of squares (see leastTurning)
  bodies?: number; // its first 3 × bodies components are bodies' turning, which `stillness` may hold still
  stillness?: number; // a body this tier leaves turning less than this fraction of the most is held still (see Options.stillness in kinematics.ts)
  joints?: boolean; // every joint's turning: what judges whether a motion turns the joint at all
  steering?: boolean; // a car's steering, kept still: closing the loops counts tyres' scrub in it too (see closeLoops in kinematics.ts)
}

export function leastTurning(motions: number[][], rate: (m: number[]) => number, tiers: Tier[], offset: number[] | null = null, target = 1): number[] | null {
  const k = motions.length;
  if (k === 0) return null;
  const rates = motions.map(rate);
  const last = motions.map(tiers.find((t) => t.joints)!.cost);
  // How much the motions turn the joints, which says which tiers' costs are only rounding (see
  // NOISE). For a correction (with an offset), at least as much as a motion of unit size: its
  // free motions may barely turn a joint (a truck sliding on its tyres, which may scrub), and
  // judged against them, the rounding in a tier nothing moves (its steering) chose a mix
  // thousands of times the correction, flinging the 42041 Race Truck hundreds of LDU.
  const scale = Math.max(offset ? 1 : 0, ...last.map((s) => s.reduce((sum, x) => sum + x * x, 0)));
  const rr = rates.reduce((sum, r) => sum + r * r, 0);
  // With an offset (one problem for each step, see closeLoops), the motion chosen is the offset
  // plus a mix, the mix turning the joint at what's left of `target`, and each tier costing
  // what offset and mix move it by together. A mix that needn't turn the joint (a target of 0)
  // may be chosen from motions none of which turn it.
  const still = offset !== null && target === 0;
  if (!(scale > 0) || (rr < EPSILON * scale && !still)) return null;
  const want = target - (offset ? rate(offset) : 0);
  let a = rr < EPSILON * scale ? new Array(k).fill(0) : rates.map((r) => (r * want) / rr);
  let free = rr < EPSILON * scale ? motions.map((_, i) => motions.map((_, j) => (i === j ? 1 : 0))) : orthonormalize(nullSpace([rates], k));
  // Moves the tier as little as it can, of the mixes still free: updates a and free. `costs` are
  // each motion's components in the tier, `among` (K, if given) their dot products, motion
  // with motion, and `base` the offset's components, if there's one.
  const keepStill = (tier: Tier, costs = motions.map(tier.cost), among?: number[][], base: number[] | null = offset ? tier.cost(offset) : null) => {
    if (free.length === 0) return;
    const c = costs[0].length;
    if (c === 0) return;
    const tierScale = among ? Math.max(...among.map((row, i) => row[i])) : Math.max(...costs.map((s) => s.reduce((sum, x) => sum + x * x, 0)));
    // A tier whose costs are only rounding, next to how much the motions turn the joints, has
    // nothing to keep still: scaled up, its rounding would choose the motion (a loose truck's
    // steering, which nothing steers, swinging its wheels round wildly).
    if (!(tierScale > NOISE * scale)) return;
    // C a, and C N (one column per free direction).
    const apply = (v: number[]) => {
      const out = new Array(c).fill(0);
      for (let i = 0; i < k; i++) {
        const vi = v[i];
        if (vi === 0) continue;
        const s = costs[i];
        for (let j = 0; j < c; j++) out[j] += vi * s[j];
      }
      return out;
    };
    const m = free.length;
    const tiny = TIER_TOLERANCE * tierScale;
    // The eigenvalues and eigenvectors of a symmetric matrix, scaled to its largest entry first:
    // symmetricEigen's cut-offs are absolute, and a tier's costs may be small. Null if it's all 0.
    const eigen = (matrix: number[][]) => {
      const unit = Math.max(...matrix.map((row, i) => row[i]));
      if (!(unit > 0)) return null;
      const scaled = symmetricEigen(matrix.map((row) => row.map((x) => x / unit)));
      return { values: scaled.values.map((x) => x * unit), vectors: scaled.vectors };
    };
    if (!tier.sparse && c < m) {
      // Fewer components than free directions (most tiers on a big model): C N has rank at most
      // c, so the problem is solved from (C N)(C N)ᵀ, c by c, rather than (C N)ᵀ(C N), m by m.
      // Each of its eigenvectors u that costs something (eigenvalue s² above tiny) is the
      // direction v = (C N)ᵀ u / s of the free ones, which moves the tier by s u: y takes out
      // as much of C a along u as it can. What's left free is the rest, those taken out.
      const b = apply(a);
      if (base) base.forEach((x, j) => (b[j] += x));
      const columns = free.map(apply);
      const outer = Array.from({ length: c }, (_, i) => Array.from({ length: c }, (_, j) => columns.reduce((sum, col) => sum + col[i] * col[j], 0)));
      const solved = eigen(outer);
      if (!solved) return;
      const y = new Array(m).fill(0);
      const costly: number[][] = [];
      solved.vectors.forEach((u, e) => {
        if (solved.values[e] <= tiny) return;
        const s = Math.sqrt(solved.values[e]);
        const v = columns.map((col) => dot(col, u) / s);
        const amount = -dot(u, b) / s;
        for (let i = 0; i < m; i++) y[i] += amount * v[i];
        costly.push(v);
      });
      a = a.map((x, i) => x + free.reduce((sum, f, j) => sum + y[j] * f[i], 0));
      free = withoutDirections(free, orthonormalize(costly));
      return;
    }
    if (!tier.sparse) among ??= gramOf(costs, costs);
    // Only needed without K.
    const b = among ? [] : apply(a);
    if (base && !among) base.forEach((x, j) => (b[j] += x));
    const columns = among ? [] : free.map(apply);
    // With K, the offset's part: each motion's dot product with it, in the tier.
    const h = among && base ? costs.map((s) => dot(s, base)) : null;
    // The y making Σ w_j (b + C N y)_j² least, the eigenvectors of the unweighted problem that
    // cost nothing being left free.
    const solve = (w: number[] | null) => {
      let gram: number[][];
      let g: number[];
      if (among) {
        // (C N)ᵀ(C N) = Nᵀ K N, and (C N)ᵀ C a = Nᵀ K a: a tier with thousands of components,
        // and only hundreds of motions, is far quicker so.
        const kn = free.map((f) => among.map((row) => dot(row, f)));
        gram = gramOf(free, kn);
        g = kn.map((x) => dot(x, a));
        if (h) free.forEach((f, i) => (g[i] += dot(f, h)));
      } else {
        const weighed = w ? columns.map((x) => x.map((xi, j) => w[j] * xi)) : columns;
        gram = gramOf(weighed, columns);
        g = weighed.map((x) => dot(x, b));
      }
      const solved = eigen(gram);
      if (!solved) return { y: new Array(m).fill(0), left: w ? [] : free.slice() };
      const { values, vectors } = solved;
      const top = Math.max(0, ...values);
      const y = new Array(m).fill(0);
      const left: number[][] = [];
      vectors.forEach((v, e) => {
        if (values[e] <= (w ? 1e-12 * top : tiny)) {
          if (!w) left.push(combine(free, v));
          return;
        }
        const amount = -v.reduce((sum, vi, i) => sum + vi * g[i], 0) / values[e];
        for (let i = 0; i < m; i++) y[i] += amount * v[i];
      });
      return { y, left };
    };
    let { y, left } = solve(null);
    // Sparse: the least sum of sizes, by iteratively reweighted least squares: each round weighs
    // each component by 1 over its size in the round before, so the ones that can come to
    // nothing do, as static friction holds as many joints as it can rather than letting each
    // slip a little.
    if (tier.sparse) {
      for (let round = 0; round < SPARSE_ROUNDS; round++) {
        const r = b.map((x, j) => x + columns.reduce((sum, col, f) => sum + col[j] * y[f], 0));
        const biggest = Math.max(...r.map(Math.abs));
        if (!(biggest > 0)) break;
        const floor = 1e-8 * biggest;
        const next = solve(r.map((x) => 1 / Math.max(Math.abs(x), floor))).y;
        const change = Math.hypot(...next.map((x, i) => x - y[i]));
        y = next;
        if (change < 1e-9 * Math.max(1, Math.hypot(...y))) break;
      }
    }
    a = a.map((x, i) => x + free.reduce((sum, f, j) => sum + y[j] * f[i], 0));
    free = orthonormalize(left);
  };
  for (const tier of tiers) {
    if (free.length === 0) break;
    const stillness = tier.stillness ?? 0;
    if (!(stillness > 0 && tier.bodies)) {
      keepStill(tier);
      continue;
    }
    // Stillness: the bodies this tier leaves turning only a little are held still first (as
    // still as they can be), and the tier solved again, until it leaves none more of them.
    const n = tier.bodies;
    const start = { a, free };
    const held = new Set<number>();
    const costs = motions.map(tier.cost);
    const among = gramOf(costs, costs);
    const base = offset ? tier.cost(offset) : null;
    // K of the held bodies' components, added to as each is held.
    const heldAmong = Array.from({ length: k }, () => new Array(k).fill(0));
    for (let round = 0; round < 6; round++) {
      ({ a, free } = start);
      if (held.size) {
        const list = [...held];
        const heldCosts = costs.map((all) => list.flatMap((b) => [all[3 * b], all[3 * b + 1], all[3 * b + 2]]));
        keepStill({ cost: () => [] }, heldCosts, heldAmong, base && list.flatMap((b) => [base[3 * b], base[3 * b + 1], base[3 * b + 2]]));
      }
      keepStill(tier, costs, among, base);
      const turned = Array.from({ length: n }, (_, b) => Math.hypot(...[0, 1, 2].map((d) => a.reduce((sum, x, i) => sum + x * costs[i][3 * b + d], base ? base[3 * b + d] : 0))));
      const most = Math.max(0, ...turned);
      const more = turned.flatMap((t, b) => (!held.has(b) && t > 1e-12 * most && t < stillness * most ? [b] : []));
      if (more.length === 0) break;
      for (const b of more) held.add(b);
      const moreCosts = costs.map((all) => more.flatMap((b) => [all[3 * b], all[3 * b + 1], all[3 * b + 2]]));
      gramOf(moreCosts, moreCosts).forEach((row, i) => row.forEach((x, l) => (heldAmong[i][l] += x)));
    }
  }
  const mix = combine(motions, a);
  return offset ? mix.map((x, i) => x + offset[i]) : mix;
}

// A vector with its parts along each of some orthonormal vectors taken out.
export function without(vector: number[], orthonormal: number[][]): number[] {
  const u = vector.slice();
  for (const p of orthonormal) {
    let d = 0;
    for (let i = 0; i < u.length; i++) d += u[i] * p[i];
    for (let i = 0; i < u.length; i++) u[i] -= d * p[i];
  }
  return u;
}

// What's left of an orthonormal basis once some directions are taken out, as an orthonormal
// basis: `taken` are orthonormal, in the basis's own coordinates. Householder reflections take
// each of them to one of the first axes in turn (as in a QR factorization), the basis reflected
// with them; the rest of the reflected basis spans what's left. Far less work than finding
// what's left by an eigen-solve, when few are taken.
export function withoutDirections(basis: number[][], taken: number[][]): number[][] {
  const m = basis.length;
  const rows = basis.map((r) => r.slice());
  const t = taken.map((v) => v.slice());
  for (let e = 0; e < t.length; e++) {
    // The reflection I − 2 h hᵀ / hᵀh, in coordinates e on, taking t[e] to ±axis e.
    const h = new Array(m).fill(0);
    let norm = 0;
    for (let i = e; i < m; i++) {
      h[i] = t[e][i];
      norm += h[i] * h[i];
    }
    h[e] += t[e][e] >= 0 ? Math.sqrt(norm) : -Math.sqrt(norm);
    const hh = dot(h, h);
    if (!(hh > 0)) continue;
    for (let f = e + 1; f < t.length; f++) {
      const s = (2 * dot(h, t[f])) / hh;
      for (let i = e; i < m; i++) t[f][i] -= s * h[i];
    }
    // The basis times the reflection: each vector j less 2 h_j / hᵀh of Σ h_i basis_i.
    const bh = combine(rows, h);
    for (let j = e; j < m; j++) {
      if (h[j] === 0) continue;
      const s = (2 * h[j]) / hh;
      const row = rows[j];
      for (let x = 0; x < row.length; x++) row[x] -= s * bh[x];
    }
  }
  return rows.slice(t.length);
}

// The mix of `vectors` with these amounts.
export function combine(vectors: number[][], amounts: number[]): number[] {
  const out = new Array(vectors[0]?.length ?? 0).fill(0);
  for (let i = 0; i < vectors.length; i++) {
    const v = vectors[i];
    const a = amounts[i];
    for (let j = 0; j < v.length; j++) out[j] += a * v[j];
  }
  return out;
}

// The x with  a · x = b  for a small symmetric a, ignoring directions with eigenvalues below
// `tiny` (least squares, if a is singular).
export function solveSymmetric(a: number[][], b: number[], tiny: number): number[] {
  if (a.length === 0) return [];
  const { values, vectors } = symmetricEigen(a);
  const x = new Array(a.length).fill(0);
  vectors.forEach((v, e) => {
    if (values[e] <= tiny) return;
    const amount = v.reduce((sum, vi, i) => sum + vi * b[i], 0) / values[e];
    v.forEach((vi, i) => (x[i] += amount * vi));
  });
  return x;
}

// The dot products of each of `rows` with each of `columns`, x · z, summed in order: plain loops,
// as on a big model these take much of a step.
export function gramOf(rows: number[][], columns: number[][]): number[][] {
  return rows.map((x) => columns.map((z) => dot(x, z)));
}

export function dot(x: number[], z: number[]): number {
  let sum = 0;
  for (let j = 0; j < x.length; j++) sum += x[j] * z[j];
  return sum;
}

// The eigenvalues and eigenvectors of a symmetric matrix: Householder reflections bring it to
// tridiagonal form, and the QL method with implicit shifts finds that one's (tred2 and tql2 from
// EISPACK). Plain loops on flat typed arrays, v[i * n + j] for v[i][j]: on a big model this is
// much of a step's work, and Jacobi's method, which this replaced, took ten times as long on the
// 8110 Unimog's 646 motions.
export function symmetricEigen(matrix: number[][]): { values: number[]; vectors: number[][] } {
  const n = matrix.length;
  const v = new Float64Array(n * n); // ends with the eigenvectors as its columns
  matrix.forEach((row, i) => v.set(row, i * n));
  const d = new Float64Array(n); // the eigenvalues
  const e = new Float64Array(n);
  if (n === 0) return { values: [], vectors: [] };

  // Householder: v becomes the product of the reflections, d and e the diagonal and the
  // entries next to it.
  for (let j = 0; j < n; j++) d[j] = v[(n - 1) * n + j];
  for (let i = n - 1; i > 0; i--) {
    let scale = 0;
    let h = 0;
    for (let k = 0; k < i; k++) scale += Math.abs(d[k]);
    if (scale === 0) {
      e[i] = d[i - 1];
      for (let j = 0; j < i; j++) {
        d[j] = v[(i - 1) * n + j];
        v[i * n + j] = 0;
        v[j * n + i] = 0;
      }
    } else {
      for (let k = 0; k < i; k++) {
        d[k] /= scale;
        h += d[k] * d[k];
      }
      let f = d[i - 1];
      let g = Math.sqrt(h);
      if (f > 0) g = -g;
      e[i] = scale * g;
      h -= f * g;
      d[i - 1] = f - g;
      for (let j = 0; j < i; j++) e[j] = 0;
      for (let j = 0; j < i; j++) {
        f = d[j];
        v[j * n + i] = f;
        g = e[j] + v[j * n + j] * f;
        for (let k = j + 1; k <= i - 1; k++) {
          g += v[k * n + j] * d[k];
          e[k] += v[k * n + j] * f;
        }
        e[j] = g;
      }
      f = 0;
      for (let j = 0; j < i; j++) {
        e[j] /= h;
        f += e[j] * d[j];
      }
      const hh = f / (h + h);
      for (let j = 0; j < i; j++) e[j] -= hh * d[j];
      for (let j = 0; j < i; j++) {
        f = d[j];
        g = e[j];
        for (let k = j; k <= i - 1; k++) v[k * n + j] -= f * e[k] + g * d[k];
        d[j] = v[(i - 1) * n + j];
        v[i * n + j] = 0;
      }
    }
    d[i] = h;
  }
  for (let i = 0; i < n - 1; i++) {
    v[(n - 1) * n + i] = v[i * n + i];
    v[i * n + i] = 1;
    const h = d[i + 1];
    if (h !== 0) {
      for (let k = 0; k <= i; k++) d[k] = v[k * n + i + 1] / h;
      for (let j = 0; j <= i; j++) {
        let g = 0;
        for (let k = 0; k <= i; k++) g += v[k * n + i + 1] * v[k * n + j];
        for (let k = 0; k <= i; k++) v[k * n + j] -= g * d[k];
      }
    }
    for (let k = 0; k <= i; k++) v[k * n + i + 1] = 0;
  }
  for (let j = 0; j < n; j++) {
    d[j] = v[(n - 1) * n + j];
    v[(n - 1) * n + j] = 0;
  }
  v[(n - 1) * n + n - 1] = 1;
  e[0] = 0;

  // QL with implicit shifts on the tridiagonal matrix, the rotations applied to v as well.
  for (let i = 1; i < n; i++) e[i - 1] = e[i];
  e[n - 1] = 0;
  let f = 0;
  let tst1 = 0;
  const eps = 2 ** -52;
  for (let l = 0; l < n; l++) {
    tst1 = Math.max(tst1, Math.abs(d[l]) + Math.abs(e[l]));
    let m = l;
    while (m < n - 1 && Math.abs(e[m]) > eps * tst1) m++;
    if (m > l) {
      for (let iteration = 0; iteration < 60; iteration++) {
        let g = d[l];
        let p = (d[l + 1] - g) / (2 * e[l]);
        let r = Math.hypot(p, 1);
        if (p < 0) r = -r;
        d[l] = e[l] / (p + r);
        d[l + 1] = e[l] * (p + r);
        const dl1 = d[l + 1];
        let h = g - d[l];
        for (let i = l + 2; i < n; i++) d[i] -= h;
        f += h;
        p = d[m];
        let c = 1;
        let c2 = c;
        let c3 = c;
        const el1 = e[l + 1];
        let s = 0;
        let s2 = 0;
        for (let i = m - 1; i >= l; i--) {
          c3 = c2;
          c2 = c;
          s2 = s;
          g = c * e[i];
          h = c * p;
          r = Math.hypot(p, e[i]);
          e[i + 1] = s * r;
          s = e[i] / r;
          c = p / r;
          p = c * d[i] - s * g;
          d[i + 1] = h + s * (c * g + s * d[i]);
          for (let k = 0; k < n; k++) {
            const vk = k * n;
            h = v[vk + i + 1];
            v[vk + i + 1] = s * v[vk + i] + c * h;
            v[vk + i] = c * v[vk + i] - s * h;
          }
        }
        p = (-s * s2 * c3 * el1 * e[l]) / dl1;
        e[l] = s * p;
        d[l] = c * p;
        if (!(Math.abs(e[l]) > eps * tst1)) break;
      }
    }
    d[l] += f;
    e[l] = 0;
  }
  return {
    values: Array.from(d),
    vectors: Array.from({ length: n }, (_, col) => Array.from({ length: n }, (_, k) => v[k * n + col])),
  };
}

// The smallest x with  rows · x = values, or if they can't all hold (a model whose positions
// are rounded off can't always close its loops exactly), close to the smallest that comes
// closest: the x minimizing |rows · x - values|² + δ|x|², with δ tiny, which keeps rows that
// nearly repeat others (two joints in a loop that each keep the same body from tipping) from
// asking for huge motions. Each row is scaled to length 1 first, so that where rows can't all
// hold, rows about turning count as much as rows about moving (in LDU, whose numbers run
// larger); weighed by their raw sizes, a single-cylinder engine's piston tips a little further
// out of line with every step. Solved by QR on the rows themselves, rather than on rows · rowsᵀ,
// which would square their rounding errors (see leastSquares). `order` is the order to take
// x's places in (see leastSquares), all of them, by default in turn. `weights`, if given, says
// how much more some rows count than others, after scaling (see DRIVE_WEIGHT).
export function dampedSolution(rows: Row[], values: number[], order?: number[], weights?: number[]): number[] | null {
  if (rows.length === 0) return null;
  const n = rows[0].length;
  // Each row scaled to length 1, so that rows of turning and of moving count alike. Rows next
  // to nothing long are left out: the tree already keeps them (their length is rounding).
  const lengths = rows.map((row) => Math.sqrt(row.reduce((sum, x) => sum + x * x, 0)));
  const longest = Math.max(...lengths);
  const kept = rows.flatMap((_, i) => (lengths[i] > 1e-9 * longest ? [i] : []));
  if (kept.length === 0) return null;
  const weight = (i: number) => (weights?.[i] ?? 1) / lengths[i];
  return leastSquares(
    kept.map((i) => rows[i].map((x) => x * weight(i))),
    kept.map((i) => values[i] * weight(i)),
    Math.sqrt(1e-13),
    order ?? Array.from({ length: n }, (_, i) => i),
  );
}

// The x minimizing |a · x - b|² + (damping · |x|)², by QR: Givens rotations, taking in a row
// at a time (the damping first, as rows of their own), each rotated against the rows taken in
// so far, place by place in `order`, until it's either all zero or the first with something
// in its place. Rows in the tree's coordinates are mostly zeros: a row about one joint moves
// only that joint's bodies, and so has something only in the places of their joints, and of
// those they turn on, back to the root. Taken deepest first (see treeBasis), roots last, the
// rows stay that way as they're rotated, and only what's not zero is worked on: far less work
// than reflecting whole columns (Householder), and as accurate.
export function leastSquares(a: number[][], b: number[], damping: number, order: number[]): number[] {
  const k = order.length;
  // The rows taken in so far: row p has p as its first place, in `order`'s positions.
  const r: Float64Array[] = Array.from({ length: k }, (_, p) => {
    const row = new Float64Array(k);
    row[p] = damping;
    return row;
  });
  const used: number[][] = Array.from({ length: k }, (_, p) => [p]); // the positions where each isn't zero, in order
  const rb = new Float64Array(k);
  const position = new Int32Array(k);
  order.forEach((place, p) => (position[place] = p));
  // The positions in either of two ordered lists, in order.
  const union = (x: number[], y: number[]) => {
    const out: number[] = [];
    let i = 0;
    let j = 0;
    while (i < x.length && j < y.length) {
      if (x[i] < y[j]) out.push(x[i++]);
      else if (x[i] > y[j]) out.push(y[j++]);
      else {
        out.push(x[i++]);
        j++;
      }
    }
    while (i < x.length) out.push(x[i++]);
    while (j < y.length) out.push(y[j++]);
    return out;
  };
  const w = new Float64Array(k);
  a.forEach((row, i) => {
    let nonzero: number[] = [];
    for (let place = 0; place < row.length; place++) {
      if (row[place] === 0) continue;
      w[position[place]] = row[place];
      nonzero.push(position[place]);
    }
    nonzero.sort((x, y) => x - y);
    let wb = b[i];
    while (nonzero.length) {
      const p = nonzero[0];
      if (w[p] === 0) {
        nonzero.shift();
        continue;
      }
      // Rotate row p and this one so that this one's p becomes zero.
      const rp = r[p];
      const h = Math.hypot(rp[p], w[p]);
      const c = rp[p] / h;
      const s = w[p] / h;
      const both = union(used[p], nonzero);
      for (const q of both) {
        const x = rp[q];
        const y = w[q];
        rp[q] = c * x + s * y;
        w[q] = c * y - s * x;
      }
      const x = rb[p];
      rb[p] = c * x + s * wb;
      wb = c * wb - s * x;
      w[p] = 0;
      used[p] = both;
      nonzero = both.slice(1);
    }
    for (const q of nonzero) w[q] = 0;
  });
  // Back substitution.
  const y = new Float64Array(k);
  for (let p = k - 1; p >= 0; p--) {
    let sum = rb[p];
    for (const q of used[p]) if (q > p) sum -= r[p][q] * y[q];
    y[p] = sum / r[p][p];
  }
  const x = new Array(k).fill(0);
  order.forEach((place, p) => (x[place] = y[p]));
  return x;
}

// Equation rows (on motion vectors) as rows on coordinates in a basis (see treeBasis).
export function inBasis(rows: Row[], basis: number[][]): Row[] {
  const q = basis[0]?.length ?? 0;
  const support = supportOf(basis);
  return rows.map((row) => {
    const out = new Array(q).fill(0);
    for (let i = 0; i < row.length; i++) {
      const x = row[i];
      if (x === 0) continue;
      const b = basis[i];
      for (const c of support[i]) out[c] += x * b[c];
    }
    return out;
  });
}

// The motion vector with these coordinates in a basis (see treeBasis).
export function fromBasis(z: number[], basis: number[][]): number[] {
  const support = supportOf(basis);
  return basis.map((b, i) => {
    let sum = 0;
    for (const c of support[i]) sum += b[c] * z[c];
    return sum;
  });
}

// For each row of a basis, the columns where it isn't 0: a big model's tree basis is mostly 0s
// (a joint moves only the bodies beyond it), so going over only these makes the sums above many
// times faster, and leaves them just as they were.
const supports = new WeakMap<number[][], Int32Array[]>();
export function supportOf(basis: number[][]): Int32Array[] {
  let support = supports.get(basis);
  if (!support) {
    support = basis.map((row) => Int32Array.from(row.flatMap((x, c) => (x !== 0 ? [c] : []))));
    supports.set(basis, support);
  }
  return support;
}

// The same vectors made orthonormal (unit length, at right angles to each other), by
// Gram-Schmidt. Plain loops: this runs many times a step.
export function orthonormalize(vectors: number[][], tiny = EPSILON): number[][] {
  const result: number[][] = [];
  for (const v of vectors) {
    const u = v.slice();
    const n = u.length;
    for (const b of result) {
      let d = 0;
      for (let i = 0; i < n; i++) d += u[i] * b[i];
      for (let i = 0; i < n; i++) u[i] -= d * b[i];
    }
    let len = 0;
    for (let i = 0; i < n; i++) len += u[i] * u[i];
    len = Math.sqrt(len);
    if (len > tiny) {
      for (let i = 0; i < n; i++) u[i] /= len;
      result.push(u);
    }
  }
  return result;
}

// The solutions x of  rows · x = 0,  as a list of independent vectors (Gauss-Jordan elimination).
// Plain loops on typed arrays: this runs many times a step.
export function nullSpace(rows: Row[], n: number): number[][] {
  const a = rows.map((r) => Float64Array.from(r));
  const pivotColumns: number[] = [];
  const used = new Array(n).fill(false);
  // Rows found to have nothing left above RANK_TOLERANCE (rows that depend on others), until
  // they next change: the search everywhere left (below) skips them, as they can't be chosen. A
  // row's entries left only get fewer, as columns are used, so it stays tiny until taking a
  // pivot row from it changes it. Without this, a big model's search went over its dependent rows
  // again for every pivot, and took most of a step.
  const tiny = new Set<Float64Array>();
  for (let r = 0; r < a.length; r++) {
    // Pivot on an entry that's the largest in both its row and its column ("rook pivoting"),
    // for accuracy: picking only down a column lets rounding errors grow until an equation
    // implied by the others looks independent. If that finds nothing, look everywhere left.
    const largestInRow = (i: number) => {
      let best = -1;
      for (let k = 0; k < n; k++) if (!used[k] && (best < 0 || Math.abs(a[i][k]) > Math.abs(a[i][best]))) best = k;
      return best;
    };
    const largestInColumn = (k: number) => {
      let best = r;
      for (let i = r + 1; i < a.length; i++) if (Math.abs(a[i][k]) > Math.abs(a[best][k])) best = i;
      return best;
    };
    let best = r;
    let c = largestInRow(r);
    if (c < 0) break;
    for (;;) {
      const i = largestInColumn(c);
      const k = largestInRow(i);
      const done = Math.abs(a[i][k]) <= Math.abs(a[i][c]);
      best = i;
      if (done) break;
      c = k;
    }
    if (Math.abs(a[best][c]) < RANK_TOLERANCE) {
      for (let i = r; i < a.length; i++) {
        if (tiny.has(a[i])) continue;
        const k = largestInRow(i);
        if (Math.abs(a[i][k]) < RANK_TOLERANCE) tiny.add(a[i]);
        if (Math.abs(a[i][k]) > Math.abs(a[best][c])) [best, c] = [i, k];
      }
      if (Math.abs(a[best][c]) < RANK_TOLERANCE) break;
    }
    used[c] = true;
    [a[r], a[best]] = [a[best], a[r]];
    const row = a[r];
    const pivot = row[c];
    // The pivot row's nonzero entries: the only columns taking it from another row changes.
    const nonzero: number[] = [];
    for (let k = 0; k < n; k++) {
      if (row[k] === 0) continue;
      row[k] /= pivot;
      nonzero.push(k);
    }
    for (let i = 0; i < a.length; i++) {
      const other = a[i];
      if (i === r || other[c] === 0) continue;
      const factor = other[c];
      for (const k of nonzero) other[k] -= factor * row[k];
      tiny.delete(other);
    }
    pivotColumns.push(c);
  }
  const basis: number[][] = [];
  for (let free = 0; free < n; free++) {
    if (used[free]) continue;
    const x = new Array(n).fill(0);
    x[free] = 1;
    pivotColumns.forEach((pc, row) => {
      x[pc] = -a[row][free];
    });
    basis.push(x);
  }
  return basis;
}
