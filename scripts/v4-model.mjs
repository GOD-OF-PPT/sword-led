import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createWriteStream,readFileSync} from 'node:fs';
import {mkdir,writeFile,readFile,rename} from 'node:fs/promises';
import {once} from 'node:events';
import {pipeline} from 'node:stream/promises';
import {createGzip} from 'node:zlib';
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {resolve,relative} from 'node:path';
import {pathToFileURL} from 'node:url';
import * as kernel from '../dist/sword-led-v4.js';
import {PROFILES,observe,decide} from './v4-model-policy.mjs';
import {createMetrics,recordStep,finishRow,summarizeRows} from './v4-model-metrics.mjs';
import {captureFingerprint,changedInputs} from './release-fingerprint.mjs';

export const EXTRA_INPUTS=Object.freeze(['v3.html','legacy.html','docs/v0.7-balance-validation-contract.md','docs/v0.7-balance-profiles.json','docs/evidence/v07-approval/approved-proposal.md','docs/evidence/T11-4-2-3i1/witness-fixed/complete.json']);
export const sha=value=>createHash('sha256').update(typeof value==='string'||value instanceof Uint8Array?value:JSON.stringify(value)).digest('hex');
export const terminal=state=>['victory','return','defeat'].includes(state.phase);
export const seedAt=(index,prefix='v4-balance')=>{
 if(!Number.isInteger(index)||index<0||index>=1000||!['v4-balance','v4-pilot'].includes(prefix))throw Error('Invalid seed identity');
 return `${prefix}-${String(index).padStart(4,'0')}`;
};
assert.deepEqual(JSON.parse(readFileSync('docs/v0.7-balance-profiles.json')),JSON.parse(JSON.stringify(PROFILES)),'Profile source and independent data contract differ');
const qualificationPath='docs/evidence/T11-4-2-3i1/witness-fixed/complete.json',qualificationBytes=readFileSync(qualificationPath),qualifiedRun=kernel.validateRun(JSON.parse(qualificationBytes));
assert(qualifiedRun.ok,'The original earned qualification must replay');
const earned=kernel.getCollectionAwards(qualifiedRun.state);assert.equal(earned.challenge,true);
export const qualification=Object.freeze({recipes:Object.freeze([...earned.recipes]),challenge:earned.challenge});

/** The runner owns private state. Policy receives only its explicit public projection and local memory. */
export function simulate(profile,index,{seedPrefix='v4-balance'}={}){
 if(!PROFILES.includes(profile))throw Error('Unknown frozen profile');
 const input={runId:'v4-model',seed:seedAt(index,seedPrefix),mode:profile.mode,...(profile.qualified?{eligibility:qualification}:{})};
 const made=kernel.createRun(input);assert(made.ok,made.error);let state=made.state;
 const memory={},metrics=createMetrics(state),observations=createHash('sha256');let commands=0;
 while(!terminal(state)){
  if(commands>=1000)throw Error(`Nonterminal command bound: ${profile.id}/${index}`);
  const view=kernel.getRunView(state),quotes=view.event?.status==='available'?[undefined,...view.blades.map(piece=>piece.blade.id)].map(pieceId=>({pieceId:pieceId??null,...kernel.eventQuote(state,pieceId)})):[];
  const publicView=observe(view,quotes);observations.update(JSON.stringify(publicView)+'\n');
  const action=decide(publicView,profile,memory);if(!action)throw Error(`Policy stopped before a terminal: ${profile.id}/${index}`);
  const before=state,command={runId:state.runId,expectedRevision:state.revision,action};
  const result=kernel.applyCommand(state,command);if(!result.ok)throw Error(`${profile.id}/${index}/${state.revision}: ${result.error} ${JSON.stringify(action)}`);
  recordStep(before,action,result,metrics);state=result.state;commands++;
  if(profile.probe==='duplicate'){
   const duplicate=kernel.applyCommand(state,command);assert.equal(duplicate.ok,false);assert.equal(duplicate.error,'stale_revision');assert.equal(duplicate.state,state);assert.deepEqual(duplicate.events,[]);
  }
  if(profile.probe==='reload'&&(action.type==='settle'||commands%50===0)){
   const restored=kernel.validateRun(JSON.parse(JSON.stringify(state)));assert(restored.ok,restored.detail);assert.deepEqual(restored.state,state);state=restored.state;
  }
 }
 const replay=kernel.validateRun(state);assert(replay.ok,replay.detail);assert.deepEqual(replay.state,state);
 const row=finishRow(state,profile.id,index,metrics);assert.equal(row.commands,commands);
 return{profile:profile.id,index,seed:input.seed,mode:input.mode,input,state,stateSha256:sha(state),observationChainSha256:observations.digest('hex'),row};
}

export function partition(seeds,size=25){
 if(!Number.isInteger(seeds)||seeds<1||seeds>1000||!Number.isInteger(size)||size<1||size>25)throw Error('Invalid model partition');
 return PROFILES.flatMap(profile=>Array.from({length:Math.ceil(seeds/size)},(_,index)=>({profile:profile.id,start:index*size,count:Math.min(size,seeds-index*size)})));
}
export function batch(input){
 const profile=PROFILES.find(candidate=>candidate.id===input.profile);
 if(!profile||!Number.isInteger(input.start)||!Number.isInteger(input.count)||input.start<0||input.count<1||input.count>25||input.start+input.count>1000)throw Error('Invalid worker batch');
 return Array.from({length:input.count},(_,i)=>simulate(profile,input.start+i,{seedPrefix:input.seedPrefix}));
}

function compressedWriter(path){
 const compressor=createGzip({level:9}),file=createWriteStream(path,{flags:'wx'}),done=pipeline(compressor,file);done.catch(()=>{});
 let problem=null;compressor.on('error',error=>{problem=error;});file.on('error',error=>{problem=error;});
 return{async write(bytes){if(problem)throw problem;if(!compressor.write(bytes))await once(compressor,'drain');if(problem)throw problem;},async finish(){compressor.end();await done;},cancel(){compressor.destroy();file.destroy();},done};
}
function validateOptions({seeds,workers,out,seedPrefix,injectFailureAfterMessage}){
 if(!Number.isSafeInteger(seeds)||seeds<1||seeds>1000||!Number.isSafeInteger(workers)||workers<1||workers>8)throw Error('Use seeds 1..1000 and workers 1..8');
 if(typeof out!=='string'||!out||out.includes('\0')||relative(process.cwd(),resolve(out)).startsWith('..')||resolve(out)===process.cwd())throw Error('Provide a fresh output directory inside the project');
 if(!['v4-balance','v4-pilot'].includes(seedPrefix)||typeof injectFailureAfterMessage!=='boolean')throw Error('Invalid model execution identity');
}

export async function runBatch({seeds=1000,workers=6,out='tmp/T11-4-2-3i6/formal',seedPrefix='v4-balance',injectFailureAfterMessage=false}={}){
 validateOptions({seeds,workers,out,seedPrefix,injectFailureAfterMessage});
 const frozen=await captureFingerprint(process.cwd(),EXTRA_INPUTS),baselineBytes=JSON.stringify(frozen,null,2)+'\n';
 await mkdir(out,{recursive:false});await writeFile(out+'/baseline.json',baselineBytes,{flag:'wx'});
 const begin=performance.now(),startedAt=new Date().toISOString(),inputs=partition(seeds),rows=[],witnesses={},pending=new Map(),live=new Set();
 const recordsWriter=compressedWriter(out+'/records.jsonl.gz.partial'),rowsWriter=compressedWriter(out+'/rows.jsonl.gz.partial');
 const recordsHash=createHash('sha256'),rowsHash=createHash('sha256');let cursor=0,nextWrite=0,completed=0,failed=false,flush=Promise.resolve();
 async function accept(index,records){
  const input=inputs[index];assert.equal(records.length,input.count);
  for(const[local,record]of records.entries()){assert.equal(record.profile,input.profile);assert.equal(record.index,input.start+local);assert.equal(record.seed,seedAt(input.start+local,seedPrefix));}
  pending.set(index,records);
  flush=flush.then(async()=>{
   while(pending.has(nextWrite)){
    const group=pending.get(nextWrite);pending.delete(nextWrite++);
    for(const record of group){
     const bytes=Buffer.from(JSON.stringify(record)+'\n'),rowBytes=Buffer.from(JSON.stringify(record.row)+'\n');
     await recordsWriter.write(bytes);await rowsWriter.write(rowBytes);recordsHash.update(bytes);rowsHash.update(rowBytes);rows.push(record.row);
     if(!witnesses[record.state.phase]){
      const path=`witness-${record.state.phase}.json`;await writeFile(out+'/'+path,JSON.stringify(record.state,null,2)+'\n',{flag:'wx'});
      witnesses[record.state.phase]={profile:record.profile,index:record.index,seed:record.seed,phase:record.state.phase,stateSha256:record.stateSha256,commands:record.state.revision,path};
     }
    }
   }
  });
  await flush;completed+=records.length;
  console.log(JSON.stringify({completed,total:seeds*PROFILES.length,profile:input.profile,start:input.start,elapsedMs:Math.round(performance.now()-begin)}));
 }
 try{
  await Promise.all(Array.from({length:Math.min(workers,inputs.length)},async()=>{
   for(let index=cursor++;!failed&&index<inputs.length;index=cursor++){
    const input={...inputs[index],seedPrefix,failAfterMessage:injectFailureAfterMessage&&index===0};
    const records=workers===1?batch(input):await new Promise((resolveResult,reject)=>{
     const worker=new Worker(new URL(import.meta.url),{workerData:input,execArgv:[]});live.add(worker);let message,messages=0;
     worker.on('message',value=>{messages++;if(messages===1)message=value;});worker.once('error',reject);
     worker.once('exit',code=>{live.delete(worker);if(code||messages!==1||!message)reject(Error(`Worker exit ${code}, messages: ${messages}`));else resolveResult(message);});
    });
    if(workers===1&&input.failAfterMessage)throw Error('Intentional serial post-result failure');
    if(failed)return;await accept(index,records);
   }
  }));
  await flush;assert.equal(completed,seeds*PROFILES.length);assert.equal(rows.length,completed);assert.equal(nextWrite,inputs.length);assert.equal(pending.size,0);
  await recordsWriter.finish();await rowsWriter.finish();
  const after=await captureFingerprint(process.cwd(),EXTRA_INPUTS),changed=changedInputs(frozen,after);await writeFile(out+'/after.json',JSON.stringify(after,null,2)+'\n',{flag:'wx'});assert.deepEqual(changed,[],'Frozen model inputs or SDK changed');
  await rename(out+'/records.jsonl.gz.partial',out+'/records.jsonl.gz');await rename(out+'/rows.jsonl.gz.partial',out+'/rows.jsonl.gz');
  const summary={schemaVersion:1,rulesVersion:'forge-v4',startedAt,finishedAt:new Date().toISOString(),seedPrefix,seeds,profiles:PROFILES,cases:rows.length,workers,batchSize:25,producerReplayedFinalStates:rows.length,
   elapsedMs:performance.now()-begin,rowsSha256:rowsHash.digest('hex'),uncompressedRecordsSha256:recordsHash.digest('hex'),baselineSha256:sha(baselineBytes),
   qualification:{path:qualificationPath,sha256:sha(qualificationBytes),sourcePhase:qualifiedRun.state.phase,sourceCommands:qualifiedRun.state.revision,eligibility:qualification},
   statistics:summarizeRows(rows,PROFILES),witnesses};
  await writeFile(out+'/summary.json',JSON.stringify(summary,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({complete:true,cases:rows.length,producerReplayedFinalStates:rows.length,elapsedMs:summary.elapsedMs}));return summary;
 }catch(error){
  failed=true;recordsWriter.cancel();rowsWriter.cancel();await Promise.allSettled([recordsWriter.done,rowsWriter.done]);
  await writeFile(out+'/failure.json',JSON.stringify({at:new Date().toISOString(),error:String(error),completed,expected:seeds*PROFILES.length,scope:'Failed model execution; partial artifacts are diagnostic, no successful summary.'},null,2)+'\n').catch(()=>{});throw error;
 }finally{await Promise.all([...live].map(worker=>worker.terminate()));}
}

if(!isMainThread){parentPort.postMessage(batch(workerData));if(workerData.failAfterMessage)throw Error('Intentional worker failure after posting a complete result');}
else if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 const args=process.argv.slice(2),options=new Map();for(let i=0;i<args.length;i+=2){const key=args[i],value=args[i+1];if(!['--seeds','--workers','--out','--seed-prefix'].includes(key)||value===undefined||value.startsWith('--')||options.has(key))throw Error('Use unique --seeds --workers --out --seed-prefix arguments');options.set(key,value);}
 for(const key of ['--seeds','--workers'])if(options.has(key)&&!/^\d+$/.test(options.get(key)))throw Error('Numeric arguments require integers');
 await runBatch({seeds:Number(options.get('--seeds')??1000),workers:Number(options.get('--workers')??6),out:options.get('--out')??'tmp/T11-4-2-3i6/formal',seedPrefix:options.get('--seed-prefix')??'v4-balance'});
}
