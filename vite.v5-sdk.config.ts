import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// A separate bundle keeps the published v1–v4 SDK dependency graph unchanged.
export default defineConfig({
  publicDir: false,
  build: {
    emptyOutDir: false,
    target: 'es2022',
    lib: {
      entry: fileURLToPath(new URL('./src/v5-sdk.ts', import.meta.url)),
      formats: ['es'],
      fileName: () => 'sword-led-v5.js',
    },
  },
});
