import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // don't scan plugin scaffolds — they have their own build tools
    entries: ['main.jsx', 'embed.jsx'],
  },
  build: {
    outDir: 'dist/standalone',
    emptyOutDir: true,
  },
});
