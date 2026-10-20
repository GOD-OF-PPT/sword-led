import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: false,
  build: {
    emptyOutDir: false,
    target: 'es2022',
    lib: {
      entry: {
        'sword-led-core': fileURLToPath(new URL('./src/core/index.ts', import.meta.url)),
        'sword-led-session': fileURLToPath(new URL('./src/persistence/index.ts', import.meta.url)),
        'sword-led-v2': fileURLToPath(new URL('./src/v2-sdk.ts', import.meta.url)),
        'sword-led-v3': fileURLToPath(new URL('./src/v3-sdk.ts', import.meta.url)),
        'sword-led-v4': fileURLToPath(new URL('./src/v4-sdk.ts', import.meta.url)),
      },
      formats: ['es'],
      fileName: (_format, entryName) => `${entryName}.js`,
    },
  },
});
