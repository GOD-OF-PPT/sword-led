import {createRun,applyCommand,validateRun} from '../dist/sword-led-v3.js';
import {PROFILES,observe,decide} from './v3-model-policy.mjs';
import {captureFingerprint,changedInputs} from './release-fingerprint.mjs';
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
export const seedAt=i=>`v3-balance-${String(i).padStart(4,'0')}`;
export const sha=x=>createHash('sha256').update(typeof x==='string'||x instanceof Uint8Array?x:JSON.stringify(x)).digest('hex');
const terminal=s=>s.phase==='victory'||s.phase==='defeat';
export function simulate(profile,index,{reload=profile.probe==='reload',duplicate=profile.probe==='duplicate'}={}){
 if(!PROFILES.some(p=>p===profile)||!Number.isInteger(index)||index<0||index>=1000)throw Error('Invalid simulation profile or seed index');
 const created=createRun({runId:'v3-model',seed:seedAt(index),roundLimit:12});if(!created.ok)throw Error(created.error);
 let state=created.state;const clicks=new Map(),triggers={},rounds=[],trades=[];
 let strikes=0,bursts=0,cracks=0,broken=0,upgrades=0,repairs=0,reserves=0,retrieves=0,tradeValue=0,deliveries=0,recoveredCoins=0,giftCoins=0,spentCoins=0;
 while(!terminal(state)&&state.revision<1000){
  const action=decide(observe(state),profile,clicks);if(!action)throw Error('Nonterminal policy stopped');
  const before=state,command={runId:state.runId,expectedRevision:state.revision,action},r=applyCommand(state,command);
  if(!r.ok)throw Error(`${profile.id}/${index}/${state.revision}: ${r.error} ${JSON.stringify(action)}`);state=r.state;
  // Independent accounting from the pre-command snapshot, not domain event amounts.
  const blade='pieceId'in action?before.blades.find(b=>b.id===action.pieceId):undefined;
  let income=0,expense=0,quotaDelta=0;
  if(action.type==='deliver'){income=blade.value;quotaDelta=blade.value;}
  if(action.type==='scrap'||action.type==='strike'&&state.blades.find(b=>b.id===blade.id).status==='broken'){income=Math.floor(blade.base/4);recoveredCoins+=income;}
  if(action.type==='settle'){income=before.blades.filter(b=>b.status==='active'&&b.id!==before.reserveId).reduce((n,b)=>n+Math.floor(b.base/4),0);recoveredCoins+=income;}
  if(action.type==='claimGift'&&action.traitId===null){income=40;giftCoins+=income;}
  if(action.type==='upgrade')expense=({3:180,6:900,9:4500})[before.round];
  if(action.type==='repair')expense=Math.ceil(([180,300,520,850,1400,2300,3800,6200,10000,16000,26000,42000][before.round-1])/2);
  spentCoins+=expense;assert.equal(state.coins,before.coins+income-expense);
  assert.equal(state.delivered,action.type==='advance'?0:before.delivered+quotaDelta);
  assert.equal(state.revision,before.revision+1);assert.equal(state.journal.length,state.revision);
  assert.equal(state.blades.length,state.round*3);assert(state.blades.filter(b=>b.status==='active').length<=4);
  if(state.reserveId)assert(state.blades.some(b=>b.id===state.reserveId&&b.status==='active'));
  if(duplicate){const again=applyCommand(state,command);if(again.ok||again.state!==state||again.error!=='stale_revision')throw Error('Repeated command changed state');}
  // JSON reload at every settlement and each 50th command; no random reroll or action injection.
  if(reload&&(state.phase!=='workshop'||state.revision%50===0)){const restored=validateRun(JSON.parse(JSON.stringify(state)));if(!restored.ok)throw Error(`Reload failed: ${restored.detail}`);state=restored.state;}
  if(action.type==='strike'){strikes++;clicks.set(action.pieceId,(clicks.get(action.pieceId)??0)+1);}
  if(action.type==='upgrade')upgrades++;if(action.type==='repair')repairs++;
  if(action.type==='reserve'){if(before.reserveId===action.pieceId)retrieves++;else reserves++;}
  if(action.type==='settle')rounds.push({...state.history.at(-1),coins:state.coins,base:state.base});
  for(const e of r.events){
   if(e.type==='Strike'){if(e.burst)bursts++;for(const h of e.hits){if(h.result==='crack')cracks++;if(h.result==='broken')broken++;for(const t of h.triggers)triggers[t]=(triggers[t]??0)+1;}}
   if(e.type==='Traded'){tradeValue+=e.amount;trades.push({round:state.round,blade:e.pieceId,value:e.amount,trait:action.traitId,replaced:action.replaceId??null});}
   if(e.type==='Delivered')deliveries++;
  }
 }
 if(!terminal(state))throw Error(`Command bound reached: ${profile.id}/${index}`);
 const replay=validateRun(state);if(!replay.ok)throw Error(replay.detail);
 const row={profile:profile.id,index,seed:state.seed,phase:state.phase,round:state.round,commands:state.revision,strikes,bursts,cracks,broken,
  upgrades,repairs,reserves,retrieves,deliveries,tradeValue,recoveredCoins,giftCoins,spentCoins,coins:state.coins,seals:state.seals,base:state.base,met:state.history.filter(x=>x.met).length,
  supplied:state.blades.length,delivered:state.blades.filter(b=>b.status==='delivered').reduce((n,b)=>n+b.value,0),
  peak:Math.max(...state.blades.map(b=>b.peak)),triggers,traits:state.traits,trades,rounds,stateSha256:sha(state)};
 return{row,state};
}
export function partition(seeds,size=25){
 if(!Number.isInteger(seeds)||seeds<1||seeds>1000||!Number.isInteger(size)||size<1)throw Error('Invalid partition');
 return PROFILES.flatMap(p=>Array.from({length:Math.ceil(seeds/size)},(_,n)=>({profile:p.id,start:n*size,count:Math.min(size,seeds-n*size)})));
}
export function batch(input){
 const p=PROFILES.find(p=>p.id===input.profile);
 if(!p||!Number.isInteger(input.start)||!Number.isInteger(input.count)||input.start<0||input.count<1||input.start+input.count>1000)throw Error('Invalid batch');
 const rows=[],witnesses={};for(let i=input.start;i<input.start+input.count;i++){
  const result=simulate(p,i);rows.push(result.row);witnesses[result.state.phase]??=result.state;
 }
 return{rows,witnesses};
}
export async function runBatch({seeds,workers,out}){
 if(!Number.isInteger(seeds)||seeds<1||seeds>1000||!Number.isInteger(workers)||workers<1||workers>8||typeof out!=='string'||!out)throw Error('Use seeds 1..1000, workers 1..8, new output directory');
 const frozen=await captureFingerprint(),begin=performance.now(),inputs=partition(seeds),groups=[],witnesses={},live=new Set();
 await mkdir(out,{recursive:false});await writeFile(`${out}/baseline.json`,JSON.stringify(frozen,null,2)+'\n',{flag:'wx'});
 let cursor=0,completed=0,failed=false;
 try{await Promise.all(Array.from({length:Math.min(workers,inputs.length)},async()=>{
  for(let n=cursor++;!failed&&n<inputs.length;n=cursor++){
   const input=inputs[n];const result=workers===1?batch(input):await new Promise((resolve,reject)=>{
    const worker=new Worker(new URL(import.meta.url),{workerData:input});live.add(worker);let message;
    worker.once('message',value=>{message=value;});worker.once('error',reject);
    worker.once('exit',code=>{live.delete(worker);if(code||!message)reject(Error(`Worker exited ${code} without result`));else resolve(message);});
   });
   if(failed)return;
   if(result.rows.length!==input.count||result.rows.some((r,i)=>r.profile!==input.profile||r.index!==input.start+i||r.seed!==seedAt(input.start+i)))throw Error('Incomplete/mismatched batch');
   groups[n]=result.rows;completed+=result.rows.length;
   for(const [phase,state]of Object.entries(result.witnesses))if(!witnesses[phase]||n<witnesses[phase].batch)witnesses[phase]={batch:n,state};
   console.log(JSON.stringify({completed,total:seeds*PROFILES.length,profile:input.profile,start:input.start,elapsedMs:Math.round(performance.now()-begin)}));
  }
 }));}catch(e){failed=true;throw e;}finally{await Promise.all([...live].map(w=>w.terminate()));}
 const changed=changedInputs(frozen,await captureFingerprint());if(changed.length)throw Error('Inputs changed: '+changed.join(','));
 const rows=groups.flat();if(completed!==seeds*PROFILES.length||rows.length!==completed||!witnesses.defeat)throw Error('Incomplete coverage');
 const bytes=Buffer.from(rows.map(r=>JSON.stringify(r)).join('\n')+'\n');
 await writeFile(`${out}/rows.jsonl.gz`,gzipSync(bytes,{level:9}),{flag:'wx'});
 for(const [phase,w]of Object.entries(witnesses))await writeFile(`${out}/${phase}.json`,JSON.stringify(w.state,null,2)+'\n',{flag:'wx'});
 const summary={schemaVersion:1,rulesVersion:'forge-v3',seeds,profiles:PROFILES,cases:rows.length,workers,replayedFinalStates:rows.length,
  elapsedMs:performance.now()-begin,rowsSha256:sha(bytes.toString()),baselineSha256:sha(JSON.stringify(frozen,null,2)+'\n'),
  witnesses:Object.fromEntries(Object.entries(witnesses).map(([phase,w])=>[phase,{batch:w.batch,stateSha256:sha(w.state)}]))};
 await writeFile(`${out}/summary.json`,JSON.stringify(summary,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({complete:true,cases:rows.length,elapsedMs:summary.elapsedMs}));
 return{summary,rows};
}
if(!isMainThread)parentPort.postMessage(batch(workerData));
else if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 const opts=new Map(),args=process.argv.slice(2);for(let i=0;i<args.length;i+=2){const k=args[i],v=args[i+1];if(!['--seeds','--workers','--out'].includes(k)||!v||opts.has(k))throw Error('Use --seeds --workers --out');opts.set(k,v);}
 await runBatch({seeds:Number(opts.get('--seeds')??1000),workers:Number(opts.get('--workers')??4),out:opts.get('--out')??'tmp/T12-v3-1000'});
}
