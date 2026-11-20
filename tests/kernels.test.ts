import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadModel } from '../scripts/load-model.ts';
import { combine, dotsWith, EPSILON, gramOf, kernelSpy, mixes, nullSpace, orthonormalize, RANK_TOLERANCE, Row, rowsTimes, supportOf } from '../src/linalg.ts';

// The solver's kernels made cheaper with the same arithmetic (decision 263 of 2026-11-20): each new
// kernel gives the very numbers the old one gave, to the last bit (Object.is, so +0 and −0 differ
// and NaN equals NaN). The old kernels are kept here, as they were, and both are run on inputs
// taken from a real step of three big models (caught with kernelSpy), and on random ones.

// The kernels as they were before 2026-11-20.
function oldDot(x: number[], z: number[]): number {
  let sum = 0;
  for (let j = 0; j < x.length; j++) sum += x[j] * z[j];
  return sum;
}
function oldGramOf(rows: number[][], columns: number[][]): number[][] {
  return rows.map((x) => columns.map((z) => oldDot(x, z)));
}
function oldDotsWith(rows: number[][], vectors: number[][]): number[][] {
  return rows.map((row) => vectors.map((z) => z.reduce((sum, x, c) => sum + x * row[c], 0)));
}
function oldCombine(vectors: number[][], amounts: number[]): number[] {
  const out = new Array(vectors[0]?.length ?? 0).fill(0);
  for (let i = 0; i < vectors.length; i++) {
    const v = vectors[i];
    const a = amounts[i];
    for (let j = 0; j < v.length; j++) out[j] += a * v[j];
  }
  return out;
}

function oldOrthonormalize(vectors: number[][], tiny = EPSILON): number[][] {
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

function oldNullSpace(rows: Row[], n: number): number[][] {
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

// Every number of two results the same, by Object.is; the first that isn't, else null.
function firstDifference(a: unknown, b: unknown, at = ''): string | null {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return `${at}: length ${a.length} against ${b.length}`;
    for (let i = 0; i < a.length; i++) {
      const d = firstDifference(a[i], b[i], `${at}[${i}]`);
      if (d) return d;
    }
    return null;
  }
  return Object.is(a, b) ? null : `${at}: ${String(a)} against ${String(b)}`;
}

type Call = { kernel: string; args: unknown[] };
const copy = (x: unknown): unknown => (Array.isArray(x) ? x.map(copy) : x);
const oldMixes = (vectors: number[][], amountsList: number[][]) => amountsList.map((amounts) => oldCombine(vectors, amounts));
const kernels: Record<string, { old: (...args: never[]) => unknown; now: (...args: never[]) => unknown }> = {
  gramOf: { old: oldGramOf, now: gramOf },
  combine: { old: oldCombine, now: combine },
  mixes: { old: oldMixes, now: mixes },
  orthonormalize: { old: oldOrthonormalize, now: orthonormalize },
  nullSpace: { old: oldNullSpace, now: nullSpace },
  dotsWith: { old: oldDotsWith, now: dotsWith },
};

// The calls of each kernel in one turn of a control by a step, as a drag makes it: up to `most`
// of each, the first ones and then every so often, copied as they were given.
function callsInAStep(model: string, part: number, most = 30): Call[] {
  const { mech, kin } = loadModel(model, true);
  const body = mech.bodyOf[part];
  const link = kin.parentLink(body)!;
  const seen: Record<string, number> = {};
  const calls: Call[] = [];
  kernelSpy.on = (kernel, args) => {
    const n = (seen[kernel] = (seen[kernel] ?? 0) + 1);
    if (n <= most / 2 || (n % 7 === 0 && calls.filter((c) => c.kernel === kernel).length < most)) calls.push({ kernel, args: args.map(copy) });
  };
  try {
    kin.holdWhatTheDragDoesntNeed(body, () => kin.jointMotion(link.joint) !== null, link.joint);
    kin.turnJoint(link.joint, 0.035, () => true);
    kin.letGoAfterDrag();
  } finally {
    kernelSpy.on = null;
  }
  return calls;
}

function sameOnAll(calls: Call[]) {
  for (const { kernel, args } of calls) {
    const { old, now } = kernels[kernel];
    const d = firstDifference((now as (...a: unknown[]) => unknown)(...args.map(copy)), (old as (...a: unknown[]) => unknown)(...args.map(copy)));
    expect(d, `${kernel}`).toBeNull();
  }
}

describe('the solver kernels, made cheaper, give the same numbers', () => {
  it('on random vectors, mostly 0, with −0, tiny and huge numbers, and with ∞ and NaN', () => {
    // A seeded generator, so the test is the same each run.
    let seed = 12345;
    const random = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    const value = (): number => {
      const r = random();
      if (r < 0.6) return 0;
      if (r < 0.65) return -0;
      if (r < 0.7) return 5e-324 * (random() < 0.5 ? -1 : 1);
      if (r < 0.75) return 1e300 * (random() - 0.5);
      return random() * 2 - 1;
    };
    const vectors = (k: number, n: number) => Array.from({ length: k }, () => Array.from({ length: n }, value));
    const calls: Call[] = [];
    for (let t = 0; t < 40; t++) {
      const k = 1 + Math.floor(random() * 12);
      const n = Math.floor(random() * 30);
      const a = vectors(k, n);
      calls.push({ kernel: 'gramOf', args: [a, vectors(1 + Math.floor(random() * 8), n)] });
      calls.push({ kernel: 'combine', args: [a, Array.from({ length: k }, value)] });
      calls.push({ kernel: 'dotsWith', args: [vectors(1 + Math.floor(random() * 6), n), vectors(k, n)] });
      calls.push({ kernel: 'orthonormalize', args: [vectors(k, n), EPSILON] });
      // Rows that repeat each other (a sum of two others), as a linkage's equations do.
      const rows = vectors(1 + Math.floor(random() * 8), n).map((r) => r.map((x) => (Number.isFinite(x) && Math.abs(x) < 1e100 ? x : 0)));
      if (rows.length > 2) rows.push(rows[0].map((x, j) => x + rows[1][j]));
      calls.push({ kernel: 'nullSpace', args: [rows, n] });
      calls.push({ kernel: 'mixes', args: [a, Array.from({ length: 1 + Math.floor(random() * 5) }, () => Array.from({ length: k }, value))] });
    }
    // A basis's rows times z (rowsTimes), as they were: over the row's places that are not 0. With ∞ in a
    // basis or in z, and with z both sparser and fuller than the rows.
    for (let t2 = 0; t2 < 30; t2++) {
      const n = 1 + Math.floor(random() * 25);
      const basis = vectors(1 + Math.floor(random() * 10), n);
      if (t2 % 7 === 3) basis[0][n - 1] = Infinity;
      const z = Array.from({ length: n }, () => (random() < 0.8 ? 0 : value()));
      if (t2 % 5 === 4) z[0] = -Infinity;
      const support = supportOf(basis);
      const old = basis.map((row, i) => {
        let sum = 0;
        for (const c of support[i]) sum += row[c] * z[c];
        return sum;
      });
      const list = basis.map((_, i) => i).reverse();
      expect(firstDifference(rowsTimes(basis, list, z), list.map((i) => old[i]))).toBeNull();
    }
    // A Gram matrix of a list with itself, as the solver asks it (the same array twice).
    const a = vectors(9, 20);
    expect(firstDifference(gramOf(a, a), oldGramOf(a, a))).toBeNull();
    // Not finite: made as before.
    const odd = vectors(4, 6);
    odd[1][2] = Infinity;
    odd[2][3] = NaN;
    calls.push({ kernel: 'gramOf', args: [odd, odd.map((r) => r.slice())] }, { kernel: 'combine', args: [odd, [0, 0, 1, 0]] }, { kernel: 'mixes', args: [odd, [[0, 0, 1, 0], [1, -0, 0, 2]]] }, { kernel: 'mixes', args: [vectors(3, 5), [[Infinity, 0, 1], [NaN, 0, 0]]] });
    expect(firstDifference(gramOf(odd, odd), oldGramOf(odd, odd))).toBeNull();
    sameOnAll(calls);
  });

  const models: [string, string, number][] = [
    ['the 9397 Logging Truck, its steering', 'omr/9397-1 Logging Truck.mpd', 1000],
    ['the 8110 Unimog, its steering', 'omr/8110-1 Mercedes-Benz Unimog U 400.mpd', 1504],
    ["the 42100 Liebherr R 9800, its bucket's motor", 'omr/42100-1 Liebherr R 9800.mpd', 3237],
  ];
  for (const [what, model, part] of models) {
    it.skipIf(!existsSync(model))(`on what a step of ${what} gives them`, () => {
      const calls = callsInAStep(model, part);
      for (const kernel of Object.keys(kernels)) expect(calls.some((c) => c.kernel === kernel), kernel).toBe(true);
      sameOnAll(calls);
    }, 300_000);
  }
});
