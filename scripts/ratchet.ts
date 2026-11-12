// The ratchet: what works may not break (see docs/plan.md, "The gate"). Compares each set's
// function check results as they are now, in data/sets/, with what they were at a commit, and
// lists every function that got worse: a result that fell (works to partly or no, partly to no),
// a part that now moves by the wrong amount, or a way worked that no longer comes back. Fails if
// any did. What got better is counted too.
// (Coming back is counted by the ways worked that leave a part out of place, from `back`, not by
// the parts the check names in `strayed`: it names the one part left furthest each way, and where
// two parts are left as far as each other to the eighth decimal, as the 9394's are, which one it
// names turns on rounding, so the number of names went up and down with nothing changed.)
//
//   npm run ratchet                against the last commit (HEAD)
//   npm run ratchet -- preview     against a branch, tag or commit

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SETS_DIR = 'data/sets';
const ref = process.argv[2] ?? 'HEAD';
// How each result ranks, best first.
const RANK: Record<string, number> = { works: 0, partly: 1, no: 2, error: 3 };

interface Checked {
  result: string;
  back?: [number, number][][]; // there and back was measured: for each control, each way, the furthest a part is left (LDU, degrees)
  wrong?: string[];
}

// As BACK in check-functions.ts: how far from its start, in LDU or degrees, a part counts as not back.
const BACK = 0.5;
// How many of the ways a function's controls were worked leave a part not back.
const notBack = (c: Checked) => (c.back ?? []).flat().filter(([ldu, degrees]) => ldu > BACK || degrees > BACK).length;

// A set's file as it was at the commit, or null if it wasn't there.
function before(file: string) {
  try {
    return JSON.parse(execFileSync('git', ['show', `${ref}:${SETS_DIR}/${file}`], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 }));
  } catch {
    return null;
  }
}

const worse: string[] = [];
let better = 0;
const totals = { before: 0, now: 0 };
for (const file of readdirSync(SETS_DIR).filter((f) => f.endsWith('.json'))) {
  const now = JSON.parse(readFileSync(join(SETS_DIR, file), 'utf-8'));
  const was = before(file);
  const [is, old]: Checked[][] = [now.generated?.functions ?? [], was?.generated?.functions ?? []];
  totals.now += is.filter((c) => c.result === 'works').length;
  totals.before += old.filter((c) => c.result === 'works').length;
  // A set that timed out or failed where it had results has lost them all.
  if (old.length && !is.length) worse.push(`${now.set}: no results now (it had ${old.length} functions' before)`);
  is.forEach((c, i) => {
    const b = old[i];
    // Only functions checked both times compare (not skipped, or new).
    if (!b || !(b.result in RANK) || !(c.result in RANK)) return;
    const what = `${now.set} function ${i + 1} (${String(now.curated.functions[i]?.does ?? '').slice(0, 60)})`;
    const lines: string[] = [];
    if (RANK[c.result] > RANK[b.result]) lines.push(`${b.result} → ${c.result}`);
    // Amounts and coming back compare only once both were measured for them.
    if (!b.back || !c.back) {
      if (lines.length) worse.push(`${what}: ${lines.join('; ')}`);
      else if (RANK[c.result] < RANK[b.result]) better++;
      return;
    }
    if ((c.wrong?.length ?? 0) > (b.wrong?.length ?? 0)) lines.push(`${c.wrong!.length} parts by the wrong amount, had ${b.wrong?.length ?? 0}`);
    if (notBack(c) > notBack(b)) lines.push(`${notBack(c)} ways not back, had ${notBack(b)}`);
    if (lines.length) worse.push(`${what}: ${lines.join('; ')}`);
    else if (RANK[c.result] < RANK[b.result] || (c.wrong?.length ?? 0) < (b.wrong?.length ?? 0) || notBack(c) < notBack(b)) better++;
  });
}

console.log(`Against ${ref}: ${totals.now} functions work (${totals.before} before); ${better} better, ${worse.length} worse`);
for (const line of worse) console.log(`  worse: ${line}`);
process.exit(worse.length ? 1 : 0);
