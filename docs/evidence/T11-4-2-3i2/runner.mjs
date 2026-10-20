import {spawn} from 'node:child_process';
import {openSync,closeSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {captureFingerprint,changedInputs} from '../../scripts/release-fingerprint.mjs';
const root=process.cwd(),kind=process.argv[2],token=process.argv[3],expected=Number(process.argv[4]),out=root+'/tmp/T11-4-2-3i2/'+kind;
if(!token)throw Error('Job token required');
const command=[process.execPath,root+'/node_modules/@playwright/test/cli.js','test','--config='+root+'/tmp/T11-4-2-3i2/'+kind+'.config.ts'];
const baseline=await captureFingerprint(root,['tmp/T11-4-2-3i2/runner.mjs','tmp/T11-4-2-3i2/'+kind+'.config.ts']);writeFileSync(out+'/baseline.json',JSON.stringify(baseline,null,2)+'\n',{flag:'wx'});
const fd=openSync(out+'/console.log','wx'),startedAt=new Date().toISOString();
const child=spawn(command[0],command.slice(1),{cwd:root,env:process.env,stdio:['ignore',fd,fd]});
writeFileSync(out+'/start.json',JSON.stringify({token,pid:process.pid,childPid:child.pid,startedAt,command,runnerSha256:createHash('sha256').update(readFileSync(import.meta.filename)).digest('hex')},null,2)+'\n',{flag:'wx'});
let ended=false;
async function finish(code,signal,error){if(ended)return;ended=true;closeSync(fd);let report=null,reportError=null;try{report=JSON.parse(readFileSync(out+'/report.json','utf8'));}catch(e){reportError=String(e);}
let changed=[];try{const before=JSON.parse(readFileSync(out+'/baseline.json','utf8'));changed=changedInputs(before,await captureFingerprint(root,before.extraInputs??[]));}catch(e){changed=[String(e)];}
const valid=code===0&&!error&&report?.stats?.expected===expected&&report.stats.unexpected===0&&report.stats.skipped===0&&report.stats.flaky===0&&(report.errors?.length??0)===0&&changed.length===0;
writeFileSync(out+'/terminal.json',JSON.stringify({token,pid:process.pid,childPid:child.pid,startedAt,finishedAt:new Date().toISOString(),exitCode:code,signal,error:error?String(error):null,reportError,stats:report?.stats??null,changedInputs:changed,validationComplete:valid},null,2)+'\n',{flag:'wx'});process.exitCode=valid?0:1;}
child.once('error',error=>{void finish(null,null,error);});child.once('close',(code,signal)=>{void finish(code,signal,null);});
process.once('SIGTERM',()=>child.kill('SIGTERM'));process.once('SIGINT',()=>child.kill('SIGINT'));
