// Bundles the Custom UI HTML/JS so @forge/bridge bare imports resolve and
// inline styles are extracted (Forge CSP disallows 'unsafe-inline').
//
// Builds each entry separately so each output dir is fully self-contained
// (manifest resource paths point at packaged dirs, no cross-dir asset refs).

import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const entry = process.env.FORGE_UI_ENTRY || 'macro';

export default defineConfig({
  root: resolve(__dirname, `src-ui/${entry}`),
  base: './',
  build: {
    target: 'es2022',
    outDir: resolve(__dirname, `built/${entry}`),
    emptyOutDir: true,
    assetsDir: 'assets',
    rollupOptions: {
      input: resolve(__dirname, `src-ui/${entry}/index.html`),
    },
  },
});
