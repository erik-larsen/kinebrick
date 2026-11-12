import { describe, expect, it } from 'vitest';
import { dampedSolution, dot, leastTurning, nullSpace, orthonormalize, RANK_TOLERANCE, symmetricEigen, Tier, withoutDirections } from '../src/linalg.ts';

// The rows times a vector.
const times = (rows: number[][], x: number[]) => rows.map((row) => dot(row, x));

// A symmetric matrix of numbers from a fixed seed, so a failure can be repeated.
function randomSymmetric(n: number, seed: number): number[][] {
  let s = seed;
  const next = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647 - 0.5;
  };
  const m = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) m[i][j] = m[j][i] = next();
  return m;
}

describe('the null space', () => {
  it('finds the one motion two equations leave free', () => {
    const rows = [
      [1, 1, 0],
      [0, 0, 1],
    ];
    const basis = nullSpace(rows, 3);
    expect(basis.length).toBe(1);
    for (const x of times(rows, basis[0])) expect(x).toBeCloseTo(0, 12);
    expect(basis[0][0]).toBeCloseTo(-basis[0][1], 12);
  });

  it('counts an equation that repeats another only once', () => {
    const rows = [
      [1, 2, 3],
      [2, 4, 6],
    ];
    const basis = nullSpace(rows, 3);
    expect(basis.length).toBe(2);
    for (const v of basis) for (const x of times(rows, v)) expect(x).toBeCloseTo(0, 12);
  });

  it('counts an equation that differs from another by less than RANK_TOLERANCE as the same one', () => {
    // As a linkage that closeLoops left a hair out of line: its repeated equations must still
    // look repeated, or it jams.
    const nearly = nullSpace(
      [
        [1, 0],
        [1, RANK_TOLERANCE / 10],
      ],
      2,
    );
    expect(nearly.length).toBe(1);
    const apart = nullSpace(
      [
        [1, 0],
        [1, RANK_TOLERANCE * 10],
      ],
      2,
    );
    expect(apart.length).toBe(0);
  });

  it('leaves everything free with no equations', () => {
    expect(nullSpace([], 3).length).toBe(3);
  });
});

describe('orthonormal bases', () => {
  it('makes vectors unit length and at right angles, dropping those that depend on the others', () => {
    const basis = orthonormalize([
      [1, 1, 0],
      [2, 2, 0],
      [1, 0, 1],
    ]);
    expect(basis.length).toBe(2);
    expect(dot(basis[0], basis[0])).toBeCloseTo(1, 12);
    expect(dot(basis[1], basis[1])).toBeCloseTo(1, 12);
    expect(dot(basis[0], basis[1])).toBeCloseTo(0, 12);
  });

  it('takes directions out of a basis, leaving the rest orthonormal', () => {
    const basis = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
    // Taken out: the direction (1, 1, 0) / √2, in the basis's own coordinates.
    const left = withoutDirections(basis, [[Math.SQRT1_2, Math.SQRT1_2, 0]]);
    expect(left.length).toBe(2);
    for (const v of left) expect(dot(v, [1, 1, 0])).toBeCloseTo(0, 12);
    expect(dot(left[0], left[1])).toBeCloseTo(0, 12);
  });
});

describe('the symmetric eigen-solve', () => {
  it('finds the eigenvalues of a small matrix', () => {
    const { values } = symmetricEigen([
      [2, 1],
      [1, 2],
    ]);
    expect(values.slice().sort((a, b) => a - b)).toEqual([expect.closeTo(1, 12), expect.closeTo(3, 12)]);
  });

  it('finds orthonormal eigenvectors of a larger one', () => {
    const n = 12;
    const m = randomSymmetric(n, 7);
    const { values, vectors } = symmetricEigen(m);
    expect(values.length).toBe(n);
    vectors.forEach((v, e) => {
      const mv = times(m, v);
      mv.forEach((x, i) => expect(x).toBeCloseTo(values[e] * v[i], 10));
      vectors.forEach((u, f) => expect(dot(u, v)).toBeCloseTo(e === f ? 1 : 0, 10));
    });
  });

  it('gives nothing for an empty matrix', () => {
    expect(symmetricEigen([])).toEqual({ values: [], vectors: [] });
  });
});

describe('the tiers', () => {
  // Three motions, one along each axis. The joint turns at m[0] + m[1].
  const motions = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  const rate = (m: number[]) => m[0] + m[1];
  const joints: Tier = { cost: (m) => m, joints: true };

  it('with one tier, chooses the smallest motion that turns the joint at rate 1', () => {
    const mix = leastTurning(motions, rate, [joints])!;
    expect(mix).toEqual([expect.closeTo(0.5, 12), expect.closeTo(0.5, 12), expect.closeTo(0, 12)]);
  });

  it('keeps an earlier tier still first, then the next least', () => {
    const first: Tier = { cost: (m) => [m[0]] };
    const mix = leastTurning(motions, rate, [first, joints])!;
    expect(mix).toEqual([expect.closeTo(0, 12), expect.closeTo(1, 12), expect.closeTo(0, 12)]);
  });

  it('gives null if no motion turns the joint', () => {
    expect(leastTurning(motions, () => 0, [joints])).toBeNull();
  });

  it('with an offset, chooses what to add to it, costing both together', () => {
    // The offset already moves the third motion, which turns nothing: the mix takes it out.
    const mix = leastTurning(motions, rate, [joints], [0, 0, 1], 1)!;
    expect(mix).toEqual([expect.closeTo(0.5, 12), expect.closeTo(0.5, 12), expect.closeTo(0, 12)]);
  });

  it('holds still a body that would only creep, given stillness', () => {
    // Two motions, two bodies: the first motion turns body 0, the second turns body 1 three
    // times as fast. Least squares turns body 0 by 0.9 and body 1 by 0.3; with stillness 0.5,
    // body 1 turns less than half of body 0, and is held.
    const two = [
      [1, 0],
      [0, 1],
    ];
    const turns = (m: number[]) => [m[0], 0, 0, 3 * m[1], 0, 0];
    const both = (m: number[]) => m[0] + m[1];
    const loose = leastTurning(two, both, [{ cost: turns, bodies: 2 }, joints])!;
    expect(loose).toEqual([expect.closeTo(0.9, 12), expect.closeTo(0.1, 12)]);
    const held = leastTurning(two, both, [{ cost: turns, bodies: 2, stillness: 0.5 }, joints])!;
    expect(held).toEqual([expect.closeTo(1, 12), expect.closeTo(0, 12)]);
  });
});

describe('the damped solution', () => {
  it('solves equations that all hold', () => {
    const x = dampedSolution(
      [
        [1, 0],
        [0, 1],
      ],
      [2, 3],
    )!;
    expect(x).toEqual([expect.closeTo(2, 6), expect.closeTo(3, 6)]);
  });

  it('chooses the smallest solution when there are many', () => {
    const x = dampedSolution([[1, 1]], [2])!;
    expect(x).toEqual([expect.closeTo(1, 6), expect.closeTo(1, 6)]);
  });

  it('counts each row alike, whatever its length, when they cannot all hold', () => {
    // 10 x = 0 and x = 2: scaled to length 1, the two count alike, and x is halfway.
    const x = dampedSolution([[10], [1]], [0, 2])!;
    expect(x[0]).toBeCloseTo(1, 6);
  });

  it('gives null with no rows', () => {
    expect(dampedSolution([], [])).toBeNull();
  });
});
