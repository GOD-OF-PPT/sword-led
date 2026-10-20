import{spawn}from'node:child_process';
import{openSync,closeSync,readFileSync,writeFileSync,mkdirSync}from'node:fs';
import{createHash}from'node:crypto';
import{captureFingerprint,changedInputs}from'../../scripts/release-fingerprint.mjs';
const [kind,token,count,...args]=process.argv.slice(2),expected=Number(count),root=process.cwd();
if(!kind||!/^[a-z][a-z0-9-]*$/.test(kind)||!token||!Number.isSafeInteger(expected)||expected<1)throw Error('Invalid explicit batch identity');
const out=`${root}/tmp/T11-4-2-3i5/${kind}`;mkdirSync(out,{recursive:false});
const extra=['v3.html','legacy.html','goal-1/input.md','design/d/v07','design/d/v07-chapter2','design/d/v07-chapter3','tmp/T11-4-2-3i5/runner.mjs','docs/evidence/T11-4-2-3i1/witness-fixed','docs/evidence/T11-4-2-3d/route.json','docs/evidence/T11-4-2-3d/repair-route.json'];
const before=await captureFingerprint(root,extra);writeFileSync(`${out}/baseline.json`,JSON.stringify(before,null,2)+'\n',{flag:'wx'});
const fd=openSync(`${out}/console.log`,'wx'),command=[`${root}/node_modules/@playwright/test/cli.js`,'test','--config=playwright.v4-ui.config.ts',`--output=${out}/work`,...args],startedAt=new Date().toISOString();
const child=spawn(process.execPath,command,{cwd:root,env:{...process.env,V4_DEV:'0',V4_REPORT:`${out}/report.json`,V4_EVIDENCE_ROOT:`${out}/evidence`,V4_FINAL_EVIDENCE_ROOT:`${out}/evidence/final`,V4_HEAVY_EVIDENCE_ROOT:`${out}/heavy`},stdio:['ignore',fd,fd]});
writeFileSync(`${out}/start.json`,JSON.stringify({token,pid:process.pid,childPid:child.pid,startedAt,command:[process.execPath,...command],runnerSha256:createHash('sha256').update(readFileSync(import.meta.filename)).digest('hex')},null,2)+'\n',{flag:'wx'});
let ended=false;
async function finish(code,signal,error){
 if(ended)return;ended=true;closeSync(fd);let report=null,reportError=null;
 try{report=JSON.parse(readFileSync(`${out}/report.json`,'utf8'));}catch(e){reportError=String(e);}
 const after=await captureFingerprint(root,extra),changed=changedInputs(before,after);writeFileSync(`${out}/after.json`,JSON.stringify(after,null,2)+'\n',{flag:'wx'});
 const valid=code===0&&!error&&report?.stats?.expected===expected&&report.stats.unexpected===0&&report.stats.skipped===0&&report.stats.flaky===0&&(report.errors?.length??0)===0&&!changed.length;
 const result={token,pid:process.pid,childPid:child.pid,startedAt,finishedAt:new Date().toISOString(),exitCode:code,signal,error:error?String(error):null,reportError,stats:report?.stats??null,changedInputs:changed,validationComplete:valid};
 writeFileSync(`${out}/terminal.json`,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result));process.exitCode=valid?0:1;
}
child.once('error',e=>void finish(null,null,e));child.once('close',(c,s)=>void finish(c,s,null));
process.once('SIGINT',()=>child.kill('SIGINT'));process.once('SIGTERM',()=>child.kill('SIGTERM'));
