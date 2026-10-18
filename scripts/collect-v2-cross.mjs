import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import {captureFingerprint,changedInputs} from './release-fingerprint.mjs';

const args=process.argv.slice(2),options={};
for(let i=0;i<args.length;i+=2){const k=args[i],v=args[i+1];if(!['--report','--out','--expected','--projects','--purpose','--baseline'].includes(k)||!v||options[k])throw Error('Use --report <json> --out <new directory> --expected <cases> [--projects <count>] [--purpose <description>] [--baseline <pre-test fingerprint>]' );options[k]=v;}
assert.ok(options['--report']&&options['--out']);
const report=JSON.parse(await readFile(options['--report'],'utf8')),out=resolve(options['--out']),expected=Number(options['--expected']??40),expectedProjects=Number(options['--projects']??5);
assert.equal(report.stats.expected,expected);for(const key of['unexpected','skipped','flaky'])assert.equal(report.stats[key],0);assert.deepEqual(report.errors,[]);
let baseline=null,baselineBytes=null;
if(options['--baseline']){baselineBytes=await readFile(options['--baseline']);baseline=JSON.parse(baselineBytes);const timestamp=Date.parse(baseline.recordedAt);assert.ok(Number.isFinite(timestamp)&&timestamp<=Date.parse(report.stats.startTime),'Baseline must predate the actual test run');assert.deepEqual(changedInputs(baseline,await captureFingerprint(process.cwd(),baseline.extraInputs??[])),[],'Inputs changed since the pre-test snapshot');}
await mkdir(out,{recursive:false});
const sdk=await import(pathToFileURL(resolve('dist/sword-led-v2.js')).href),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const cases=[],files=[],states=[],audits=[];
function inspect(value,identity,path='$'){
  if(!value||typeof value!=='object')return;
  if(value.rulesVersion==='forge-v2'&&Array.isArray(value.journal)){const check=sdk.validateRun(value);assert.equal(check.ok,true,`${identity}: ${check.detail??''}`);states.push({identity,path,runId:value.runId,revision:value.revision,round:value.round});return;}
  for(const[k,v]of Object.entries(value))inspect(v,identity,`${path}.${k}`);
}
async function walk(suites){
  for(const suite of suites){for(const spec of suite.specs??[])for(const test of spec.tests){assert.equal(test.results.length,1);const result=test.results[0];assert.equal(result.status,'passed');assert.deepEqual(result.errors,[]);cases.push({project:test.projectName,name:spec.title,durationMs:result.duration});
    for(const a of result.attachments??[]){const bytes=a.path?await readFile(a.path):Buffer.from(a.body??'','base64');if(!bytes.length)continue;
      if(a.contentType==='application/json'){const data=JSON.parse(bytes.toString());inspect(data,`${test.projectName}/${a.name}`);if(a.name==='runtime-audit'){assert.deepEqual(data.errors,[]);audits.push({project:test.projectName,case:spec.title,...data});}}
      const name=a.name.replace(/[^a-zA-Z0-9-]/g,'-'),ext=a.path?extname(a.path):a.contentType==='application/json'?'.json':'.bin',file=`${test.projectName}/${name}-${sha(bytes).slice(0,12)}${ext}`;
      await mkdir(join(out,test.projectName),{recursive:true});try{await writeFile(join(out,file),bytes,{flag:'wx'});}catch(error){if(error.code!=='EEXIST'||sha(await readFile(join(out,file)))!==sha(bytes))throw error;}
      a.path=file;files.push({file,sha256:sha(bytes),bytes:bytes.length});
    }
  }await walk(suite.suites??[]);}
}
await walk(report.suites);assert.equal(cases.length,expected);assert.equal(new Set(cases.map(c=>c.project)).size,expectedProjects);
const sdkFiles={};for(const file of['sword-led-core.js','sword-led-session.js','sword-led-v2.js'])sdkFiles[file]=sha(await readFile(`dist/${file}`));
const sourceHashes={},buildFiles={};async function fingerprint(dir,target,include){for(const entry of await readdir(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory())await fingerprint(path,target,include);else if(include(path)){const bytes=await readFile(path);if(target===buildFiles&&path.endsWith('.js'))for(const probe of ['releaseV2WriteFault','nativeV2Probe','frameV2Probe','audioTestProbe'])assert.ok(!bytes.toString().includes(probe),`${probe} leaked into production`);target[path]={sha256:sha(bytes),bytes:bytes.length};}}}for(const dir of ['src','tests/e2e','tests/support'])await fingerprint(dir,sourceHashes,p=>/\.(ts|mts|mjs|css|html)$/.test(p));for(const p of ['package.json','package-lock.json','playwright.v2.config.ts','scripts/collect-v2-cross.mjs','scripts/release-fingerprint.mjs','scripts/encode-browser-evidence.py'])sourceHashes[p]={sha256:sha(await readFile(p))};await fingerprint('dist',buildFiles,()=>true);
if(baselineBytes)await writeFile(join(out,'baseline.json'),baselineBytes,{flag:'wx'});
await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
await writeFile(join(out,'summary.json'),JSON.stringify({purpose:options['--purpose']??'V2 playable subset across actual three engines and five DPR projects; not the full release matrix',recordedAt:new Date().toISOString(),baseline:baselineBytes?{file:'baseline.json',sha256:sha(baselineBytes),recordedAt:baseline.recordedAt}:null,projects:expectedProjects,cases,states,audits,files,sdkFiles,sourceHashes,buildFiles},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({cases:cases.length,projects:expectedProjects,states:states.length,files:files.length,out}));
