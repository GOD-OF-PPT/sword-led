// Tests existing forge-v3 rules only. No experimental rules or in-game autoplayer.
import {createRun,applyCommand,validateRun,quotaFor,strikeOdds,atCap} from '../dist/sword-led-v3.js';
import {observe,decide,PROFILES} from './v3-model-policy.mjs';
import {captureFingerprint,changedInputs} from './release-fingerprint.mjs';
import {createHash} from 'node:crypto';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {gzipSync,gunzipSync} from 'node:zlib';
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const original=id=>PROFILES.find(p=>p.id===id),base=original('balanced-ember');
export const DIRECTED=Object.freeze([
 {id:'baseline',config:base,overlap:'balanced-ember'},
 {id:'no-reserve',config:original('without-reserve'),overlap:'without-reserve'},
 {id:'carry-next',config:base,carry:true},
 {id:'no-upgrade',config:original('without-upgrade'),overlap:'without-upgrade'},
 {id:'carry-no-upgrade',config:original('without-upgrade'),carry:true},
 {id:'aggressive',config:original('aggressive-ember'),overlap:'aggressive-ember'},
 {id:'aggressive-inherit',config:{...original('aggressive-ember'),rank:['inherit','ember','echo','steady','pardon','crackedEdge']}},
 {id:'aggressive-edge',config:{...original('aggressive-ember'),rank:['crackedEdge','ember','echo','steady','pardon','inherit']}},
 {id:'aggressive-no-traits',config:{...original('aggressive-ember'),traits:false}},
].map(Object.freeze));
export const hash=b=>createHash('sha256').update(typeof b==='string'||b instanceof Uint8Array?b:JSON.stringify(b)).digest('hex');
export function choose(v,p,context){
 const ordinary=decide(v,p.config,context.clicks);
 if(!p.carry||v.phase!=='workshop'||['claimGift','buy','upgrade','repair'].includes(ordinary?.type))return ordinary;
 const reserve=v.blades.find(b=>b.id===v.reserveId),gap=v.quota-v.delivered;
 if(gap>0)return reserve&&reserve.value>=gap?{type:'reserve',pieceId:reserve.id}:ordinary;
 if(v.round===12||context.prepared.has(v.round))return{type:'settle'};
 const next=quotaFor(v.round+1);if(reserve&&reserve.value>=next)return{type:'settle'};
 const best=v.blades.filter(b=>b.status==='active'&&b.id!==v.reserveId).sort((a,b)=>b.value-a.value||a.id.localeCompare(b.id))[0];
 if(!best)return{type:'settle'};
 const odds=strikeOdds(v,best);
 if(best.value<next&&!atCap(best)&&(odds.burst||!best.cracked&&odds.crack<300))return{type:'strike',pieceId:best.id};
 return best.value>(reserve?.value??0)?{type:'reserve',pieceId:best.id}:{type:'settle'};
}
export function evaluate(id,index){
 const p=DIRECTED.find(p=>p.id===id);if(!p||!Number.isInteger(index)||index<0||index>=128)throw Error('Invalid directed profile/index');
 const created=createRun({runId:'v3-model',seed:`v3-balance-${String(index).padStart(4,'0')}`,roundLimit:12});assert(created.ok);
 let s=created.state;const context={clicks:new Map(),prepared:new Set()},triggers={},first={},rounds=[];
 let reserveDeliveries=0,reserveDelivered=0,bonus=0,bursts=0,strikes=0;
 while(['workshop','summary'].includes(s.phase)&&s.revision<1000){
  const before=s,action=choose(observe(s),p,context);assert(action);
  const r=applyCommand(s,{runId:s.runId,expectedRevision:s.revision,action});assert(r.ok,`${id}/${index}/${s.revision}/${r.error}`);s=r.state;
  if(action.type==='strike'){strikes++;context.clicks.set(action.pieceId,(context.clicks.get(action.pieceId)??0)+1);}
  if(action.type==='reserve'&&before.delivered>=quotaFor(before.round)&&before.reserveId!==action.pieceId)context.prepared.add(before.round);
  if(action.type==='deliver'){
   const b=before.blades.find(b=>b.id===action.pieceId);if(b.suppliedRound<before.round){reserveDeliveries++;reserveDelivered+=b.value;}
  }
  if(action.type==='advance'){
   const extra=s.blades.find(b=>b.id===`r${s.round}-1`).base-s.base;
   assert.equal(extra,Math.min(s.base*4,before.pendingInheritance));bonus+=extra;
  }
  if(action.type==='settle')rounds.push({...s.history.at(-1),reserveValue:s.blades.find(b=>b.id===s.reserveId)?.value??0});
  for(const e of r.events)if(e.type==='Strike'){
   if(e.burst)bursts++;
   for(const h of e.hits)for(const t of h.triggers){triggers[t]=(triggers[t]??0)+1;if(!first[t])first[t]={before,action,after:s,hit:h};}
  }
 }
 assert(['victory','defeat'].includes(s.phase));assert(s.revision<1000);const replay=validateRun(s);assert(replay.ok,replay.detail);
 return{row:{profile:id,index,seed:s.seed,phase:s.phase,round:s.round,commands:s.revision,strikes,bursts,coins:s.coins,seals:s.seals,
  met:s.history.filter(h=>h.met).length,broken:s.blades.filter(b=>b.status==='broken').length,reserveDeliveries,reserveDelivered,
  inheritanceBonus:bonus,triggers,rounds,stateSha256:hash(s)},state:s,first};
}
function slice(input){
 if(!DIRECTED.some(p=>p.id===input.profile)||!Number.isInteger(input.start)||!Number.isInteger(input.count)||input.start<0||input.count<1||input.start+input.count>128)throw Error('Invalid slice');
 const rows=[],witnesses={};for(let i=input.start;i<input.start+input.count;i++){const r=evaluate(input.profile,i);rows.push(r.row);
  for(const trait of ['inherit','crackedEdge'])if(r.first[trait]&&!witnesses[trait])witnesses[trait]={profile:input.profile,index:i,...r.first[trait],final:r.state};
 }return{rows,witnesses};
}
export async function run({out,seeds=128,workers=4}){
 if(!out||!Number.isInteger(seeds)||seeds<1||seeds>128||!Number.isInteger(workers)||workers<1||workers>4)throw Error('Use new output, seeds 1..128, workers 1..4');
 const baseline=await captureFingerprint(),old=JSON.parse(await readFile('docs/evidence/T12-v3/baseline.json'));
 for(const group of ['sourceHashes','buildFiles'])for(const [p,digest]of Object.entries(old[group]))assert.deepEqual(baseline[group][p],digest,`Historical input changed: ${p}`);
 await mkdir(out,{recursive:false});await writeFile(`${out}/baseline.json`,JSON.stringify(baseline,null,2)+'\n',{flag:'wx'});
 const begin=performance.now(),inputs=DIRECTED.flatMap(p=>Array.from({length:Math.ceil(seeds/16)},(_,i)=>({profile:p.id,start:i*16,count:Math.min(16,seeds-i*16),kind:'v3-directed'}))),groups=[],witnesses={},live=new Set();let cursor=0,completed=0,failed=false;
 try{await Promise.all(Array.from({length:Math.min(workers,inputs.length)},async()=>{
  for(let n=cursor++;!failed&&n<inputs.length;n=cursor++){
   const input=inputs[n],result=workers===1?slice(input):await new Promise((resolve,reject)=>{
    const worker=new Worker(new URL(import.meta.url),{workerData:input});live.add(worker);let value;
    worker.once('message',v=>{value=v;});worker.once('error',reject);worker.once('exit',code=>{live.delete(worker);code||!value?reject(Error(`Worker failed: ${code}`)):resolve(value);});
   });
   assert.equal(result.rows.length,input.count);result.rows.forEach((r,i)=>{assert.equal(r.profile,input.profile);assert.equal(r.index,input.start+i);});groups[n]=result.rows;completed+=result.rows.length;
   for(const [trait,w]of Object.entries(result.witnesses))if(!witnesses[trait]||n<witnesses[trait].slice)witnesses[trait]={slice:n,...w};
   console.log(JSON.stringify({completed,total:seeds*DIRECTED.length,profile:input.profile,elapsedMs:Math.round(performance.now()-begin)}));
  }
 }));}catch(e){failed=true;throw e;}finally{await Promise.all([...live].map(w=>w.terminate()));}
 assert.deepEqual(changedInputs(baseline,await captureFingerprint()),[]);
 const rows=groups.flat();assert.equal(rows.length,seeds*DIRECTED.length);
 const historical=gunzipSync(await readFile('docs/evidence/T12-v3/rows.jsonl.gz'));assert.equal(hash(historical),JSON.parse(await readFile('docs/evidence/T12-v3/summary.json')).rowsSha256);
 const oldRows=new Map(historical.toString().trimEnd().split('\n').map(line=>{const r=JSON.parse(line);return[`${r.profile}/${r.index}`,r];}));let overlap=0;
 for(const r of rows){const oldId=DIRECTED.find(p=>p.id===r.profile).overlap;if(!oldId)continue;const old=oldRows.get(`${oldId}/${r.index}`);
  for(const k of ['stateSha256','phase','round','commands','strikes','bursts','coins','seals','met','broken','triggers'])assert.deepEqual(r[k],old[k],`${r.profile}/${r.index}/${k}`);overlap++;
 }
 const bytes=Buffer.from(rows.map(r=>JSON.stringify(r)).join('\n')+'\n');await writeFile(`${out}/rows.jsonl.gz`,gzipSync(bytes,{level:9}),{flag:'wx'});
 for(const [trait,w]of Object.entries(witnesses))await writeFile(`${out}/${trait}.json`,JSON.stringify(w,null,2)+'\n',{flag:'wx'});
 const statistics=Object.fromEntries(DIRECTED.map(p=>{const group=rows.filter(r=>r.profile===p.id),avg=k=>group.reduce((n,r)=>n+r[k],0)/group.length;
  return[p.id,{cases:group.length,victories:group.filter(r=>r.phase==='victory').length,meanCommands:avg('commands'),meanMet:avg('met'),meanBroken:avg('broken'),meanReserveDeliveries:avg('reserveDeliveries'),meanReserveDelivered:avg('reserveDelivered'),inheritanceBonus:group.reduce((n,r)=>n+r.inheritanceBonus,0),triggers:Object.fromEntries(['inherit','crackedEdge'].map(t=>[t,group.reduce((n,r)=>n+(r.triggers[t]??0),0)]))}];}));
 const summary={rulesVersion:'forge-v3',purpose:'Directed tests of existing rules; 128-seed subset, not a new 1000-seed audit or human fun test',seeds,cases:rows.length,profiles:DIRECTED.map(p=>p.id),workers,producerReplays:rows.length,overlapRows:overlap,elapsedMs:performance.now()-begin,rowsSha256:hash(bytes),statistics,witnesses:Object.fromEntries(Object.entries(witnesses).map(([t,w])=>[t,{profile:w.profile,index:w.index,afterSha256:hash(w.after),finalSha256:hash(w.final)}]))};
 await writeFile(`${out}/summary.json`,JSON.stringify(summary,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({complete:true,cases:rows.length,overlap,elapsedMs:summary.elapsedMs}));
}
if(!isMainThread&&workerData?.kind==='v3-directed')parentPort.postMessage(slice(workerData));
else if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 const args=process.argv.slice(2),opts=new Map();for(let i=0;i<args.length;i+=2){const [k,v]=args.slice(i,i+2);if(!['--out','--seeds','--workers'].includes(k)||!v||opts.has(k))throw Error('Use --out, --seeds, --workers');opts.set(k,v);}
 await run({out:opts.get('--out'),seeds:Number(opts.get('--seeds')??128),workers:Number(opts.get('--workers')??4)});
}
