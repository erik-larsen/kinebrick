/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';

export default defineConfig({
  // Relative paths, so the built site works wherever it's served from (such as
  // erik-larsen.github.io/kinebrick/).
  base: './',
  // three.js makes the one script about 650 KB; that's expected, so don't warn about it.
  build: { chunkSizeWarningLimit: 1000 },
  // Serve a plain 404 for missing files, rather than the page itself.
  appType: 'mpa',
  server: {
    // Don't watch the large libraries for changes.
    watch: { ignored: ['**/ldraw/**', '**/ldcad-shadow/**', '**/reference/**'] },
  },
  // Many tests drive a whole model through many steps; on GitHub's machines, which run them
  // a few times slower, some take tens of seconds. Other sessions' git worktrees, under
  // .claude/, have tests of their own, which aren't this checkout's.
  test: { testTimeout: 120000, setupFiles: ['tests/setup.ts'], exclude: [...configDefaults.exclude, '.claude/**'] },
});
