// Puts a branch on the site as its pre-release, at erik-larsen.github.io/kinebrick/prerelease/,
// for trying work before it reaches main (the solver branch, say). It sets the repository variable
// PRERELEASE_BRANCH, which the Pages workflow (.github/workflows/pages.yml) reads, and runs the
// workflow, which builds main and the branch together and publishes both. From then on a push to
// main, or to the branch once it has the workflow, publishes both afresh. It also runs the
// branch's tests (.github/workflows/test.yml), as every push to the branch does from then on.
//
// It needs the GitHub CLI (gh), signed in as the repository's owner, who alone may change its
// variables.
//
//   npm run prerelease -- solver           put the solver branch up as the pre-release
//   npm run prerelease -- solver --watch   and watch the workflow run through
//   npm run prerelease                     say which branch is the pre-release, if any
//   npm run prerelease -- --off            take the pre-release down: the site is published
//                                          again without it

import { execFileSync } from 'node:child_process';

const VARIABLE = 'PRERELEASE_BRANCH';
const WORKFLOW = 'pages.yml';
const TESTS = 'test.yml';
const SITE = 'https://erik-larsen.github.io/kinebrick/prerelease/';

function run(cmd: string, args: string[], quiet = false): string {
  return execFileSync(cmd, args, { encoding: 'utf-8', stdio: ['ignore', 'pipe', quiet ? 'ignore' : 'inherit'] }).trim();
}

// The pre-release branch as set now, or null if none is.
function current(): string | null {
  try {
    return run('gh', ['variable', 'get', VARIABLE], true) || null;
  } catch {
    return null;
  }
}

// The newest run of the workflow, by id, or null if there's none.
function latestRun(): string | null {
  return run('gh', ['run', 'list', '--workflow', WORKFLOW, '--limit', '1', '--json', 'databaseId', '--jq', '.[0].databaseId'], true) || null;
}

// Runs the workflow on main, and with `watch`, waits for the run to appear and watches it through.
function publish(watch: boolean) {
  const before = latestRun();
  run('gh', ['workflow', 'run', WORKFLOW, '--ref', 'main']);
  console.log('Publishing: gh run list --workflow pages.yml');
  if (!watch) return;
  let id: string | null = null;
  for (let tries = 0; tries < 12 && !id; tries++) {
    execFileSync('sleep', ['5']);
    const latest = latestRun();
    if (latest && latest !== before) id = latest;
  }
  if (!id) {
    console.log("The run hasn't appeared yet; see gh run list --workflow pages.yml");
    return;
  }
  run('gh', ['run', 'watch', id, '--exit-status']);
}

// Runs the branch's tests on GitHub, if it has the test workflow (a branch gets it with main).
function test(branch: string) {
  try {
    run('gh', ['workflow', 'run', TESTS, '--ref', branch], true);
    console.log(`Testing the ${branch} branch: gh run list --workflow ${TESTS}`);
  } catch {
    console.log(`The ${branch} branch has no ${TESTS} yet, so its pushes aren't tested: merge main into it.`);
  }
}

const args = process.argv.slice(2);
const watch = args.includes('--watch');
const off = args.includes('--off');
const branch = args.find((a) => !a.startsWith('--'));
const was = current();

if (off) {
  if (!was) {
    console.log('No pre-release branch is set.');
  } else {
    run('gh', ['variable', 'delete', VARIABLE]);
    console.log(`Took the ${was} branch down as the pre-release; ${SITE} goes with the next publish.`);
    publish(watch);
  }
} else if (!branch) {
  console.log(was ? `The pre-release is the ${was} branch: ${SITE}` : `No pre-release branch is set: npm run prerelease -- <branch> puts one up at ${SITE}`);
} else {
  // The branch has to be on GitHub for the workflow to check it out.
  try {
    run('git', ['ls-remote', '--exit-code', '--heads', 'origin', branch], true);
  } catch {
    console.error(`There's no ${branch} branch on origin: push it first.`);
    process.exit(1);
  }
  if (was !== branch) run('gh', ['variable', 'set', VARIABLE, '--body', branch]);
  console.log(`The pre-release is the ${branch} branch${was && was !== branch ? ` (was ${was})` : ''}: ${SITE}`);
  test(branch);
  publish(watch);
}
