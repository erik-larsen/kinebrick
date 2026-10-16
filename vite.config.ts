import { defineConfig } from 'vite';

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
});
