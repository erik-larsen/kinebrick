// Runs every drag script in this folder, one after another, and prints one line each: its name,
// yes or no, and how long it took. With an address, the viewer there (else preview's, see drag.ts);
// with names after it, only the scripts whose names start with one of them.
//
//   npx tsx scripts/drags/all.ts                          every script, on http://localhost:5174
//   npx tsx scripts/drags/all.ts http://localhost:5191 8272 42080
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

const args = process.argv.slice(2);
const address = args[0]?.startsWith('http') ? args.shift()! : 'http://localhost:5174';
const scripts = readdirSync('scripts/drags')
  .filter((f) => f.endsWith('.ts') && f !== 'drag.ts' && f !== 'all.ts')
  .filter((f) => !args.length || args.some((a) => f.startsWith(a)))
  .sort();
let no = 0;
for (const f of scripts) {
  const run = spawnSync(process.execPath, [...process.execArgv, `scripts/drags/${f}`, address], { encoding: 'utf-8' });
  const last = (run.stdout ?? '').trim().split('\n').pop() ?? '';
  const answer = /^(yes|no) /.test(last) ? last : `no (failed: ${(run.stderr ?? '').trim().split('\n').pop() ?? run.status})`;
  if (!answer.startsWith('yes')) no++;
  console.log(`${f.replace(/\.ts$/, '')}: ${answer}`);
}
process.exit(no ? 1 : 0);
