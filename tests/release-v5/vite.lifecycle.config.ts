import {defineConfig} from 'vite';
import {resolve} from 'node:path';
export default defineConfig({
 build:{outDir:'tmp/goal4-T03/harness',emptyOutDir:false,copyPublicDir:false,
  lib:{entry:resolve('tests/fixtures/v5/t03-lifecycle-entry.ts'),formats:['es'],fileName:'lifecycle',cssFileName:'style'},
 },
});
