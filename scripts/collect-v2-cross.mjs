import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const args=process.argv.slice(2),options={};
for(let i=0;i<args.length;i+=2){const k=args[i],v=args[i+1];if(!['--report','--out','--expected'].includes(k)||!v||options[k])throw Error('Use --report <json> --out <new directory> --expected <cases>');options[k]=v;}
assert.ok(options['--report']&&options['--out']);
const report=JSON.parse(await readFile(options['--report'],'utf8')),out=resolve(options['--out']),expected=Number(options['--expected']??40);
assert.equal(report.stats.expected,expected);for(const key of['unexpected','skipped','flaky'])assert.equal(report.stats[key],0);assert.deepEqual(report.errors,[]);
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
await walk(report.suites);assert.equal(cases.length,expected);assert.equal(new Set(cases.map(c=>c.project)).size,5);
const sdkFiles={};for(const file of['sword-led-core.js','sword-led-session.js','sword-led-v2.js'])sdkFiles[file]=sha(await readFile(`dist/${file}`));
await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
await writeFile(join(out,'summary.json'),JSON.stringify({purpose:'V2 playable subset across actual three engines and five DPR projects; not the full release matrix',cases,states,audits,files,sdkFiles},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({cases:cases.length,projects:5,states:states.length,files:files.length,out}));
