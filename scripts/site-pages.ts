// Writes the pages that the site publishes beside the viewer, into the folder named (dist if none
// is named):
//   status.html     the Technic status page (npm run status)
//   decisions.html  the decisions page (npm run decisions)
//   trains.html     the train status page, only on a branch that has train results (data/trains)
//
//   npm run site-pages -- dist/preview
//
// .github/workflows/pages.yml runs it after each build of the viewer, for main and for each
// preview branch, so every branch's pages are published as of its last push:
// erik-larsen.github.io/kinebrick/status.html for main, .../preview/status.html for preview.
// A page that fails is left out and named; the others are still written.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2] ?? 'dist';
mkdirSync(out, { recursive: true });

// Each page: its file name, and the script (with its options) that writes it.
const pages = [
  { file: 'status.html', script: ['scripts/status-page.ts'] },
  { file: 'decisions.html', script: ['scripts/decisions-page.ts'] },
];
if (existsSync(join('data', 'trains'))) pages.push({ file: 'trains.html', script: ['scripts/status-page.ts', '--trains'] });

const failed: string[] = [];
for (const page of pages) {
  try {
    execFileSync('npx', ['tsx', ...page.script, join(out, page.file)], { stdio: 'inherit' });
  } catch {
    failed.push(page.file);
  }
}
if (failed.length > 0) {
  console.error(`Not written: ${failed.join(', ')}`);
  process.exitCode = 1;
}
