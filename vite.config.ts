import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2022',
    lib: {
      entry: {
        'sword-led-core': fileURLToPath(new URL('./src/core/index.ts', import.meta.url)),
        'sword-led-session': fileURLToPath(new URL('./src/persistence/index.ts', import.meta.url)),
      },
      formats: ['es'],
      fileName: (_format, entryName) => `${entryName}.js`,
    },
  },
});
