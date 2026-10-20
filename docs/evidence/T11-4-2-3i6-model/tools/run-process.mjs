import {spawn} from 'node:child_process';
import {openSync,closeSync,writeFileSync,readFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {captureFingerprint,changedInputs} from '../../scripts/release-fingerprint.mjs';
import {EXTRA_INPUTS} from '../../scripts/v4-model.mjs';
const [kind,token,count,resultFile,module,...args]=process.argv.slice(2),expected=Number(count);
if(!/^[a-z][a-z0-9-]*$/.test(kind??'')||!token||!Number.isSafeInteger(expected)||expected<1||!['scripts/v4-model.mjs','scripts/audit-v4-model.mjs'].includes(module))throw Error('Explicit valid process identity required');
const out='tmp/T11-4-2-3i6/'+kind+'-process';mkdirSync(out,{recursive:false});
const before=await captureFingerprint(process.cwd(),EXTRA_INPUTS);writeFileSync(out+'/before.json',JSON.stringify(before,null,2)+'\n',{flag:'wx'});
const fd=openSync(out+'/console.log','wx'),startedAt=new Date().toISOString(),command=[process.execPath,module,...args],child=spawn(process.execPath,[module,...args],{cwd:process.cwd(),stdio:['ignore',fd,fd]});
writeFileSync(out+'/start.json',JSON.stringify({kind,token,pid:process.pid,childPid:child.pid,startedAt,command,resultFile,wrapperSha256:createHash('sha256').update(readFileSync(import.meta.filename)).digest('hex')},null,2)+'\n',{flag:'wx'});
let ended=false;
async function finish(exitCode,signal,error){
 if(ended)return;ended=true;closeSync(fd);let result=null,resultError=null;
 try{result=JSON.parse(readFileSync(resultFile,'utf8'));}catch(e){resultError=String(e);}
 const after=await captureFingerprint(process.cwd(),EXTRA_INPUTS),changed=changedInputs(before,after);writeFileSync(out+'/after.json',JSON.stringify(after,null,2)+'\n',{flag:'wx'});
 const replayCount=module.endsWith('/v4-model.mjs')?result?.producerReplayedFinalStates:result?.independentReplayedFinalStates;
 const valid=exitCode===0&&!error&&!resultError&&result?.cases===expected&&replayCount===expected&&!changed.length;
 const receipt={kind,token,pid:process.pid,childPid:child.pid,startedAt,finishedAt:new Date().toISOString(),exitCode,signal,error:error?String(error):null,resultError,cases:result?.cases??null,replayCount:replayCount??null,changedInputs:changed,validationComplete:valid};
 writeFileSync(out+'/terminal.json',JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(receipt));process.exitCode=valid?0:1;
}
child.once('error',error=>void finish(null,null,error));child.once('close',(code,signal)=>void finish(code,signal,null));
process.once('SIGINT',()=>child.kill('SIGINT'));process.once('SIGTERM',()=>child.kill('SIGTERM'));
