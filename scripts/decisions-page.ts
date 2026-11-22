// Writes the decisions page: everything that waits for Erik (sign-offs, moves of main, sets to
// look at), what is coming, and what was decided. The orchestrator keeps data/decisions.json
// current and publishes the page after each change (see docs/plan.md, "What Erik sees").
// The page is scripts/decisions-page.html with the data put in.
//
//   npm run decisions              writes dist/decisions.html
//   npm run decisions -- some/file writes it there instead

import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const out = process.argv[2] ?? join('dist', 'decisions.html');
const data = JSON.parse(readFileSync(join('data', 'decisions.json'), 'utf-8'));
// Where preview and main stand comes from git, so the page cannot name an old commit.
// (A checkout that does not have the branch named, as GitHub's build may not, gives no commit.)
const short = (ref: string) => {
  try {
    return execSync(`git rev-parse --short=8 ${ref}`, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
};
data.state.preview.commit = short('HEAD');
data.state.main.commit = short('origin/main');
// The web servers running on this computer now: each node process that listens on a port, named
// by the branch of the folder it runs in. Found afresh each time the page is written, so the page
// lists the servers that were up then.
function servers(): { label: string; url: string }[] {
  const run = (command: string) => {
    try {
      return execSync(command, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
    } catch {
      return '';
    }
  };
  const found = new Map<number, string>();
  for (const line of run('lsof -nP -iTCP -sTCP:LISTEN').split('\n')) {
    const columns = line.trim().split(/\s+/);
    if (columns[0] !== 'node') continue;
    const port = Number(columns[8].split(':').pop());
    const folder = run(`lsof -a -p ${columns[1]} -d cwd -Fn`).split('\n').find((l) => l.startsWith('n'))?.slice(1);
    const branch = folder ? run(`git -C "${folder}" rev-parse --abbrev-ref HEAD`).trim() : '';
    if (branch) found.set(port, branch);
  }
  return [...found].sort((a, b) => a[0] - b[0]).map(([port, branch]) => ({ label: `Viewer on port ${port} (${branch})`, url: `http://localhost:${port}/` }));
}
data.servers = servers();
// The page says when it was written, in this Mac's time.
const now = new Date();
const two = (n: number) => String(n).padStart(2, '0');
data.updated = `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())} ${two(now.getHours())}:${two(now.getMinutes())}`;
const page = readFileSync(join('scripts', 'decisions-page.html'), 'utf-8');
// "</" is written "<\/" so that no text in the data can end the page's script early.
const filled = page.replace('/*DATA*/null', () => JSON.stringify(data).replaceAll('</', '<\\/'));
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, filled);
console.log(`${data.waiting.length} waiting, ${data.coming.length} coming, ${data.done.length} decided: written to ${out}`);
