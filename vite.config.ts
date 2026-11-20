import { readFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
// vitest/config re-exports Vite's defineConfig and adds the `test` section to its type.
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';

const localDataDir = fileURLToPath(new URL('./local-data', import.meta.url));

/**
 * Serves the git-ignored `local-data/` folder byte for byte, in the dev server only.
 *
 * Left to Vite, a saved third-party page there would be treated as a page of this app: parsed
 * with parse5, which complains loudly about the page's own broken markup, and rewritten with
 * Vite's client injected. The app reads it with DOMParser, which copes, so it wants it untouched.
 * A missing file answers 404 rather than Vite's fallback to the app's index page.
 */
const serveLocalData = (): Plugin => ({
  name: 'serve-local-data',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use('/local-data', (request, response, next) => {
      const pathname = decodeURIComponent((request.url ?? '/').split('?')[0] ?? '/');
      const file = resolve(join(localDataDir, pathname));
      if (!file.startsWith(localDataDir + sep)) {
        next();
        return;
      }
      readFile(file).then(
        (content) => {
          response.setHeader(
            'Content-Type',
            file.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream',
          );
          response.end(content);
        },
        () => {
          response.statusCode = 404;
          response.end();
        },
      );
    });
  },
});

export default defineConfig({
  plugins: [react(), serveLocalData()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
