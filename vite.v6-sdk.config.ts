import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vite';

// A separate graph preserves every older published rules bundle.
export default defineConfig({
 publicDir:false,
 build:{
  emptyOutDir:false,target:'es2022',
  lib:{entry:fileURLToPath(new URL('./src/v6-sdk.ts',import.meta.url)),formats:['es'],fileName:()=>'sword-led-v6.js'},
 },
});
