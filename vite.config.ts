import { existsSync } from 'node:fs';
import { defineConfig, Plugin } from 'vite';

// The LDraw loader asks for every file under ldraw/parts/ first and only then tries
// ldraw/p/ (where primitives live), so each primitive would cost a failed request.
// This answers a request for a missing ldraw/parts/ file from ldraw/p/ instead.
function ldrawPrimitives(): Plugin {
  return {
    name: 'ldraw-primitives',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = req.url ?? '';
        if (url.startsWith('/ldraw/parts/')) {
          const rest = decodeURIComponent(url.slice('/ldraw/parts/'.length));
          if (!existsSync('ldraw/parts/' + rest) && existsSync('ldraw/p/' + rest)) {
            req.url = '/ldraw/p/' + url.slice('/ldraw/parts/'.length);
          }
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [ldrawPrimitives()],
  // Serve a plain 404 for missing files, rather than the page itself.
  appType: 'mpa',
  server: {
    // Don't watch the large libraries for changes.
    watch: { ignored: ['**/ldraw/**', '**/ldcad-shadow/**', '**/reference/**'] },
  },
});
