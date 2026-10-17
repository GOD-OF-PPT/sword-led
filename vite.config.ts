import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2022',
    lib: {
      entry: fileURLToPath(new URL('./src/core/index.ts', import.meta.url)),
      formats: ['es'],
      fileName: 'sword-led-core',
    },
  },
});
