// Ways to change a model's file that don't change its mechanism: moved, turned about the upright,
// or every part nudged a hair. For invariance.ts, which checks a set's functions on each, and
// probe-nudge.ts, which says what a nudge changes in the mechanism worked out.

export const JITTER = 0.05;

type Vec = [number, number, number];
// A way to change a model: where a point goes, where a direction goes, and how far a part is
// nudged (given a random number from 0 to 1 for each of x, y and z).
export interface Variant {
  name: string;
  point: (p: Vec) => Vec;
  direction: (d: Vec) => Vec;
  nudge: number;
}
const turnedBy = (degrees: number) => {
  const [c, s] = [Math.cos((degrees * Math.PI) / 180), Math.sin((degrees * Math.PI) / 180)];
  // About y, the upright in LDraw.
  return ([x, y, z]: Vec): Vec => [c * x + s * z, y, -s * x + c * z];
};
const asIs = (v: Vec): Vec => v;
export const VARIANTS: Variant[] = [
  { name: 'copy', point: asIs, direction: asIs, nudge: 0 },
  { name: 'moved', point: ([x, y, z]) => [x + 1000, y, z - 600], direction: asIs, nudge: 0 },
  { name: 'turned90', point: turnedBy(90), direction: turnedBy(90), nudge: 0 },
  { name: 'turned37', point: turnedBy(37), direction: turnedBy(37), nudge: 0 },
  { name: 'jitter', point: asIs, direction: asIs, nudge: JITTER },
];

// Random numbers from 0 to 1, the same every run (mulberry32).
function randomFrom(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const text = (n: number) => String(Math.round(n * 1e6) / 1e6);

// The model file's text, changed the variant's way. A move or a turn is applied to the main
// model's lines only (the first file in an MPD): its sub-models move with it. A nudge is given
// to every part and sub-model, wherever it's placed.
export function changed(model: string, v: Variant): string {
  const random = randomFrom(1);
  let file = 0;
  return model
    .split(/\r?\n/)
    .map((line) => {
      if (/^\s*0\s+FILE\b/.test(line)) file++;
      const main = file <= 1;
      const f = line.trim().split(/\s+/);
      if (f[0] === '1' && f.length >= 15) {
        let at = f.slice(2, 5).map(Number) as Vec;
        const m = f.slice(5, 14).map(Number);
        // The matrix's columns are where the part's own x, y and z point.
        let columns: Vec[] = [0, 1, 2].map((k) => [m[k], m[3 + k], m[6 + k]] as Vec);
        if (main) {
          at = v.point(at);
          columns = columns.map(v.direction);
        }
        if (v.nudge) at = at.map((x) => x + (2 * random() - 1) * v.nudge) as Vec;
        const rows = [0, 1, 2].flatMap((r) => columns.map((c) => c[r]));
        return [f[0], f[1], ...at.map(text), ...rows.map(text), ...f.slice(14)].join(' ');
      }
      // A slide's place and direction, written into the main model (see modelSettings).
      if (main && /^\s*0\s+!KINEBRICK\s+SLIDE\b/.test(line)) {
        const field = (name: string, to: (x: Vec) => Vec, l: string) =>
          l.replace(new RegExp(`\\[${name}=([^\\]]*)\\]`), (_, numbers: string) => `[${name}=${to(numbers.split(/[\s,]+/).filter(Boolean).map(Number) as Vec).map(text).join(' ')}]`);
        return field('dir', v.direction, field('at', v.point, line));
      }
      return line;
    })
    .join('\n');
}
