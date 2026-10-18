import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  build: {
    target: 'es2022',
    rolldownOptions: { input: { main: fileURLToPath(new URL('./index.html',import.meta.url)), v2: fileURLToPath(new URL('./v2.html',import.meta.url)) } },
  },
});
