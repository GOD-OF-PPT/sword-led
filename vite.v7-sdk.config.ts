import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vite';
export default defineConfig({
 publicDir:false,
 build:{emptyOutDir:false,target:'es2022',lib:{entry:fileURLToPath(new URL('./src/v7-sdk.ts',import.meta.url)),formats:['es'],fileName:()=>'sword-led-v7.js'}},
});
