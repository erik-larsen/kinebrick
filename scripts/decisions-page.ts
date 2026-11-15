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
const short = (ref: string) => execSync(`git rev-parse --short=8 ${ref}`, { encoding: 'utf-8' }).trim();
data.state.preview.commit = short('HEAD');
data.state.main.commit = short('origin/main');
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
