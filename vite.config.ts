/// <reference types="vitest/config" />
import { createReadStream, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';

export default defineConfig({
  // Relative paths, so the built site works wherever it's served from (such as
  // erik-larsen.github.io/kinebrick/).
  base: './',
  // The site's icons and web app manifest, copied beside the page as they are (in place of
  // Vite's public/ folder), so the manifest's icon paths hold.
  publicDir: 'media/favicons',
  // three.js makes the one script about 650 KB; that's expected, so don't warn about it.
  build: { chunkSizeWarningLimit: 1000 },
  // Serve a plain 404 for missing files, rather than the page itself.
  appType: 'mpa',
  plugins: [
    {
      // The dev server serves a file whose name has a # in it (the 42125 Ferrari 488 GTE AF
      // CORSE #51's): the viewer asks for it with the # written %23, and Vite, decoding the
      // address, would cut the name at the #.
      name: 'files-named-with-a-hash',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const path = decodeURIComponent((req.url ?? '').split('?')[0]);
          const file = join(server.config.root, path);
          if (!path.includes('#') || !file.startsWith(server.config.root + '/') || !existsSync(file) || !statSync(file).isFile()) return next();
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          createReadStream(file).pipe(res);
        });
      },
    },
  ],
  server: {
    // Don't watch the large libraries for changes.
    watch: { ignored: ['**/ldraw/**', '**/ldcad-shadow/**', '**/reference/**'] },
  },
  // Many tests drive a whole model through many steps; on GitHub's machines, which run them
  // a few times slower, some take tens of seconds. Other sessions' git worktrees, under
  // .claude/, have tests of their own, which aren't this checkout's.
  test: { testTimeout: 120000, setupFiles: ['tests/setup.ts'], exclude: [...configDefaults.exclude, '.claude/**'] },
});
