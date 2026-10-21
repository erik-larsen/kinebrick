// Keeps the OMR survey's findings (omr/controls/, omr/joints/ and their -<reach> folders, see docs/omr-survey.md)
// on a branch of their own, omr-survey, one commit per model per run, so they can be looked at
// while a survey that takes days is still running, from another machine or another session
// (git fetch origin omr-survey). The commits are made without checking the branch out, in an
// index of their own, so the checkout the survey runs in stays as it is.
//
// Each call commits every finding in the folder the branch doesn't have yet (or has differently),
// then pushes. A push that fails (no network, or another machine pushed first) is tried again on
// the next call, on top of what was pushed meanwhile: the findings this machine had committed but
// not pushed are committed again from its files.

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BRANCH = 'omr-survey';
// Pushes as the repository's owner, with the GitHub CLI's token for that account if it has one,
// otherwise with whatever git would use.
const OWNER = 'erik-larsen';

function git(args: string[], env: Record<string, string> = {}): string {
  return execFileSync('git', args, { encoding: 'utf-8', env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function tryGit(args: string[]): string | null {
  try {
    return git(args);
  } catch {
    return null;
  }
}

function push(): boolean {
  let token = '';
  try {
    token = execFileSync('gh', ['auth', 'token', '--user', OWNER], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    // No GitHub CLI, or not signed in as the owner: git's own credentials.
  }
  const helper = token ? ['-c', 'credential.helper=', '-c', `credential.helper=!f() { echo username=${OWNER}; echo "password=$KINEBRICK_PUSH_TOKEN"; }; f`] : [];
  try {
    git([...helper, 'push', '-q', 'origin', `refs/heads/${BRANCH}:refs/heads/${BRANCH}`], { KINEBRICK_PUSH_TOKEN: token });
    return true;
  } catch {
    return false;
  }
}

// Commits the findings in `dir` (a folder of <model>.json, relative to the repository's top) the
// branch doesn't have, one commit each, named "OMR survey, <label>: <model>, <n> knobs" (or that it timed out), and
// pushes them.
export function commitFindings(dir: string, label: string) {
  const index = join(tmpdir(), `kinebrick-survey-${process.pid}.index`);
  for (let attempt = 0; attempt < 3; attempt++) {
    tryGit(['fetch', '-q', 'origin', `+refs/heads/${BRANCH}:refs/remotes/origin/${BRANCH}`]);
    const remote = tryGit(['rev-parse', '-q', '--verify', `refs/remotes/origin/${BRANCH}`]);
    const local = tryGit(['rev-parse', '-q', '--verify', `refs/heads/${BRANCH}`]);
    // Build on this machine's branch if it has everything that was pushed, otherwise on what was pushed.
    const ahead = local !== null && (remote === null || tryGit(['merge-base', '--is-ancestor', remote, local]) !== null);
    let tip = ahead ? local : remote;
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.json')).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))) {
      const path = `${dir.replaceAll('\\', '/')}/${file}`;
      const blob = git(['hash-object', '-w', join(dir, file)]);
      if (tip && tryGit(['rev-parse', '-q', '--verify', `${tip}:${path}`]) === blob) continue;
      git(tip ? ['read-tree', tip] : ['read-tree', '--empty'], { GIT_INDEX_FILE: index });
      git(['update-index', '--add', '--cacheinfo', `100644,${blob},${path}`], { GIT_INDEX_FILE: index });
      const tree = git(['write-tree'], { GIT_INDEX_FILE: index });
      const found = JSON.parse(readFileSync(join(dir, file), 'utf-8'));
      const what = found.timedOut !== undefined ? `timed out after ${found.timedOut} hours, ${found.joints.length} knobs done by then` : `${found.joints.length} knobs`;
      tip = git(['commit-tree', tree, ...(tip ? ['-p', tip] : []), '-m', `OMR survey, ${label}: ${file.replace(/\.json$/, '')}, ${what}`]);
    }
    rmSync(index, { force: true });
    if (!tip) return;
    git(['update-ref', `refs/heads/${BRANCH}`, tip]);
    if (tip === remote || push()) return;
  }
  console.log(`Couldn't push the ${BRANCH} branch; the next model's findings will try again`);
}
