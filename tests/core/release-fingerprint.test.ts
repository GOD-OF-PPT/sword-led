import {test,expect} from 'vitest';
import {cpSync,mkdtempSync,readFileSync,writeFileSync,rmSync,mkdirSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

test('release fingerprint refuses changed builds, changed real test inputs and added source, and never overwrites evidence',()=>{
  const root=mkdtempSync(join(tmpdir(),'sword-led-release-')),script=resolve('scripts/release-fingerprint.mjs');
  const run=(mode:string)=>spawnSync(process.execPath,[script,mode,'receipt.json'],{cwd:root,encoding:'utf8',timeout:20000});
  try{
    for(const dir of ['src','tests','scripts','public','dist','docs/evidence/T06'])cpSync(dir,join(root,dir),{recursive:true});
    for(const p of ['docs/evidence/T11-2/simulation/victory.json','docs/evidence/T11-3/polish-runtime/ui/d-keyboard-campaign.json','docs/evidence/T11-3/polish-runtime/ui/v2-three-round-contract.json']){mkdirSync(dirname(join(root,p)),{recursive:true});cpSync(p,join(root,p));}
    for(const name of readdirSync('.').filter(n=>/^(?:package.*\.json|tsconfig.*\.json|vite.*\.ts|vitest.*\.ts|playwright.*\.ts|index\.html|v2\.html|\.nvmrc|\.npmrc)$/.test(n)))cpSync(name,join(root,name));
    expect(run('capture').status).toBe(0);const original=readFileSync(join(root,'receipt.json'));expect(run('verify').status).toBe(0);
    for(const p of ['dist/v2.html','docs/evidence/T11-2/simulation/victory.json']){const full=join(root,p),before=readFileSync(full);writeFileSync(full,Buffer.concat([before,Buffer.from('\n')]));const result=run('verify');expect(result.status).toBe(1);expect(JSON.parse(result.stdout).changed).toContain(p);writeFileSync(full,before);}
    writeFileSync(join(root,'src/unexpected.ts'),'export {};');expect(run('verify').status).toBe(1);rmSync(join(root,'src/unexpected.ts'));expect(run('verify').status).toBe(0);
    expect(run('capture').status).not.toBe(0);expect(readFileSync(join(root,'receipt.json'))).toEqual(original);
    writeFileSync(join(root,'review-notes.md'),'Review progress does not change executable inputs.');expect(run('verify').status).toBe(0);
  }finally{rmSync(root,{recursive:true,force:true});}
},30000);
