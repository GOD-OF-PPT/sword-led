// Independent forensic audit. This module deliberately imports no model policy or producer statistic.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createGunzip} from 'node:zlib';
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import * as api from '../dist/sword-led-v4.js';
import {captureFingerprint,changedInputs} from './release-fingerprint.mjs';

export const IDS=Object.freeze(['balanced-steady','balanced-ember','low-hammer','burst-first','cracked-commission','old-first','new-only','fixed-3','fixed-6','fixed-7','fixed-10','without-reserve','without-upgrades','without-traits','without-repair','without-optional-growth','decline-events','warm-wide','wind-warm','prefer-inherit','risky-no-inherit','prefer-crackedEdge','cracked-no-edge','duplicate','reload','raw','scrap','blind','qualified-story','qualified-challenge']);
const EVENTS=['donation','loan','salvage','credit','shelter','rest'];
const TRAITS=['steady','ember','inherit','echo','crackedEdge','pardon'];
const MODS=['windbox','warmRack','wideMouth'];
const RECIPES=['light','guard','heavy'];
const TERMINAL=['victory','return','defeat'];
const COSTS={3:{upgrade:180,repair:150},6:{upgrade:700,repair:350},9:{upgrade:1600,repair:800}};
// These literals are copied from the approved design, not from the simulation's condition evaluator.
const ORDERS=[
 [{id:'intact',count:1,value:100,crack:'intact'}],
 [{id:'light',count:1,value:160,recipe:'light',crack:'intact',maxHits:4}],
 [{id:'burst',count:1,value:260,minBursts:1}],
 [{id:'guard',count:1,value:360,recipe:'guard',crack:'intact'}],
 [{id:'old',count:1,value:420,age:'old'},{id:'new',count:1,value:630,age:'new'}],
 [{id:'cracked',count:1,value:520,crack:'cracked'}],
 [{id:'heavy',count:1,value:760,recipe:'heavy'}],
 [{id:'two-light',count:2,value:420,recipe:'light',crack:'intact'}],
 [{id:'two-bursts',count:1,value:1000,minBursts:2}],
 [{id:'cracked',count:1,value:1150,recipe:'guard',crack:'cracked'},{id:'intact',count:1,value:1800,recipe:'guard',crack:'intact'}],
 [{id:'old',count:1,value:1300,age:'old'},{id:'two-new',count:2,value:850,age:'new'}],
 [{id:'finale',count:1,value:2500,recipe:'heavy',crack:'intact',minLevel:9}],
];
export const hash=value=>createHash('sha256').update(typeof value==='string'||value instanceof Uint8Array?value:JSON.stringify(value)).digest('hex');
const cp=value=>structuredClone(value);
const integer=(value,name)=>assert(Number.isSafeInteger(value)&&value>=0,`Expected nonnegative integer: ${name}`);
const chapter=day=>day<=4?1:day<=8?2:3;
const percent=(value,n)=>Math.min(1_000_000_000,Math.floor(value*n/100));
const recovery=b=>Math.floor(b.base/4);
const eventCost=(id,day)=>id==='loan'?60:id==='credit'?[90,180,360][chapter(day)-1]:id==='shelter'?80:0;
const atCap=b=>b.peak>=1_000_000_000||b.level>=99;
function matches(b,r,day){return b.value>=r.value&&(!r.recipe||b.recipe===r.recipe)&&(!r.crack||(r.crack==='cracked')===b.cracked)&&(!r.age||(r.age==='old'?b.suppliedDay<day:b.suppliedDay===day))&&(r.maxHits===undefined||b.hits<=r.maxHits)&&(r.minLevel===undefined||b.level>=r.minLevel)&&(r.minBursts===undefined||b.bursts>=r.minBursts);}
function progress(s){
 const commissionId=s.commissionOrder[s.day-1],order=ORDERS[commissionId-1];assert(order,'Unknown commission');
 const deliveryOrder=new Map(s.journal.flatMap((a,i)=>a.type==='deliver'?[[a.pieceId,i]]:[]));
 const pieces=s.blades.filter(b=>b.status==='commissioned'&&b.commissionId===commissionId&&b.finalizedDay===s.day).sort((a,b)=>deliveryOrder.get(a.id)-deliveryOrder.get(b.id));
 const routes=order.map(r=>({...r,pieceIds:pieces.filter(b=>matches(b,r,s.day)).map(b=>b.id)}));
 const win=routes.find(r=>r.pieceIds.length>=r.count);
 return{commissionId,complete:!!win,routeId:win?.id??null,pieceIds:win?.pieceIds.slice(0,win.count)??[]};
}
function eligibilityFor(profile,qualification){
 if(!profile.startsWith('qualified-'))return{recipes:['light'],challenge:false};
 assert(qualification,'Qualified cohort requires a verified earned qualification');return qualification;
}
export function earnedQualification(state){
 assert.equal(state.phase,'victory');assert.equal(state.revision,210,'The frozen qualification source is the approved actual 210-command witness');
 const checked=api.validateRun(state);assert(checked.ok,checked.detail);assert.deepEqual(checked.state,state);
 const awards=api.getCollectionAwards(state);assert.equal(awards.challenge,true);return{recipes:[...awards.recipes],challenge:awards.challenge};
}
function checkSupply(s,before){
 assert.equal(s.blades.length,s.day*3);assert.equal(new Set(s.blades.map(b=>b.id)).size,s.blades.length);
 const own=s.blades.filter(b=>b.suppliedDay===s.day);assert.equal(own.length,3);
 const base=Math.floor([40,80,160][chapter(s.day)-1]*3**s.upgradeCount/2**s.upgradeCount*(before?.pending.supplyPct??100)/100);
 assert.equal(s.supplyBase,base);const inherited=before?Math.min(base*4,before.inheritance):0;
 for(const [i,b]of own.entries()){assert.equal(b.id,`d${s.day}-${i+1}`);assert.equal(b.slot,i+1);assert.equal(b.base,base+(i===0?inherited:0));assert.equal(b.value,b.base);assert.equal(b.hits,0);assert.equal(b.charge,0);assert.equal(b.bursts,0);assert.equal(b.status,'active');}
}
function checkState(s,eligibility){
 assert.equal(s.rulesVersion,'forge-v4');assert.equal(s.runId,'v4-model');assert.deepEqual(s.initialEligibility,eligibility);assert.equal(s.revision,s.journal.length);
 integer(s.coins,'coins');integer(s.seals,'seals');assert(s.seals<=3);assert(s.day>=1&&s.day<=12);assert.equal(s.blades.length,s.day*3);
 const active=s.blades.filter(b=>b.status==='active');assert(active.length<=4);assert(s.reserveId===null||active.some(b=>b.id===s.reserveId));
 assert(s.traits.length<=3&&new Set(s.traits).size===s.traits.length&&s.traits.every(t=>TRAITS.includes(t)));
 assert(s.modifications.length<=2&&new Set(s.modifications).size===s.modifications.length&&s.modifications.every(m=>MODS.includes(m)));
 for(const b of s.blades){for(const field of ['base','value','peak','level','hits','charge','bursts'])integer(b[field],`blade.${field}`);assert(b.value<=1_000_000_000&&b.level<=99&&b.charge<=6&&b.peak>=b.value);assert(RECIPES.includes(b.recipe));}
}
function eventCounters(){return Object.fromEntries(EVENTS.map(id=>[id,{offered:0,accepted:0,declined:0,unaffordable:0,consumed:0,coins:0}]));}
/** Replays and accounts for one complete record without trusting a producer counter. */
export function auditRecord(record,{profile=record?.profile,index=record?.index,prefix='v4-balance',qualification}={}){
 assert(record&&typeof record==='object');assert(IDS.includes(profile));assert.equal(record.profile,profile);assert(Number.isInteger(index)&&index>=0&&index<1000);assert.equal(record.index,index);
 const seed=`${prefix}-${String(index).padStart(4,'0')}`,mode=profile==='qualified-challenge'?'challenge':'story',eligibility=eligibilityFor(profile,qualification);
 assert.equal(record.seed,seed);assert.equal(record.mode,mode);assert(record.input&&typeof record.input==='object');assert.equal(record.input.runId,'v4-model');assert.equal(record.input.seed,seed);assert.equal(record.input.mode??'story',mode);
 assert.deepEqual(Object.keys(record.input).sort(),['runId','seed',...(record.input.mode===undefined?[]:['mode']),...(record.input.eligibility===undefined?[]:['eligibility'])].sort());
 if(record.input.eligibility!==undefined)assert.deepEqual(record.input.eligibility,eligibility);else assert(!profile.startsWith('qualified-'));
 const made=api.createRun(record.input);assert(made.ok,made.error);let s=made.state;checkState(s,eligibility);checkSupply(s);
 assert(Array.isArray(record.state?.journal)&&record.state.journal.length<=1000);assert(TERMINAL.includes(record.state.phase));
 const numbers={strikes:0,normalHits:0,burstActions:0,internalHits:0,cracks:0,broken:0,upgrades:0,repairs:0,reserves:0,retrieves:0,deliveredCount:0,commissionedCount:0,sales:0,recoveredCoins:0,giftCoins:0,eventIncome:0,spentCoins:0,tradeValue:0};
 const triggers=Object.fromEntries([...TRAITS,...MODS,'loan','credit','shelter'].map(id=>[id,0])),days=[],eventStats=eventCounters(),capped=new Set(),offered=new Set(),effects=new Set();
 const dayCounts=()=>({strikes:0,normalHits:0,burstActions:0,internalHits:0,cracks:0,broken:0,commissionAttempts:0,attemptedRecipes:{light:0,guard:0,heavy:0}});
 let dayMetrics=dayCounts(),attempted=new Set();
 function offer(state){if(state.eventId&&!offered.has(state.day)){offered.add(state.day);const c=eventStats[state.eventId];assert(c);c.offered++;if(state.coins<eventCost(state.eventId,state.day))c.unaffordable++;}}
 offer(s);
 for(const action of record.state.journal){
  assert(!TERMINAL.includes(s.phase),'A terminal run cannot accept another action');const before=s,b='pieceId'in action?before.blades.find(p=>p.id===action.pieceId):null;
  const r=api.applyCommand(before,{runId:before.runId,expectedRevision:before.revision,action});assert(r.ok,`Rejected journal action ${before.revision}: ${r.error}`);s=r.state;
  let income=0,expense=0;assert.equal(s.revision,before.revision+1);
  if(['strike','deliver'].includes(action.type)&&!progress(before).complete&&!attempted.has(b.id)){attempted.add(b.id);dayMetrics.commissionAttempts++;dayMetrics.attemptedRecipes[b.recipe]++;}
  if(action.type==='deliver'){
   assert(b&&b.status==='active'&&b.id!==before.reserveId);income=b.value;numbers.deliveredCount++;numbers.sales+=b.value;
   const p=progress(before),qualified=!p.complete&&ORDERS[p.commissionId-1].some(route=>matches(b,route,before.day)),after=s.blades.find(v=>v.id===b.id);
   assert.equal(after.status,qualified?'commissioned':'sold');assert.equal(after.commissionId,qualified?p.commissionId:null);assert.equal(after.finalizedDay,before.day);numbers.commissionedCount+=Number(qualified);
  }
  if(action.type==='scrap'){assert(b);income=recovery(b);numbers.recoveredCoins+=income;}
  if(action.type==='strike'){
   assert(b);numbers.strikes++;dayMetrics.strikes++;const e=r.events.filter(e=>e.type==='Strike');assert.equal(e.length,1);const hitEvent=e[0];assert.equal(hitEvent.pieceId,b.id);assert.equal(hitEvent.burst,b.charge===6);assert(hitEvent.hits.length>=1&&hitEvent.hits.length<=4);
   if(hitEvent.burst){numbers.burstActions++;dayMetrics.burstActions++;}else{numbers.normalHits++;dayMetrics.normalHits++;assert.equal(hitEvent.hits.length,1);}
   numbers.internalHits+=hitEvent.hits.length;dayMetrics.internalHits+=hitEvent.hits.length;assert.equal(hitEvent.hits[0].before,b.value);assert.equal(hitEvent.hits.at(-1).after,s.blades.find(v=>v.id===b.id).value);
   for(const [i,h]of hitEvent.hits.entries()){
    if(i)assert.equal(h.before,hitEvent.hits[i-1].after);if(h.result==='crack'){numbers.cracks++;dayMetrics.cracks++;}if(h.result==='broken'){numbers.broken++;dayMetrics.broken++;}
    for(const t of h.triggers){assert([...TRAITS,...MODS,'loan','credit','shelter'].includes(t));triggers[t]=(triggers[t]??0)+1;if(['loan','credit','shelter'].includes(t))eventStats[t].consumed++;}
   }
   if(s.blades.find(v=>v.id===b.id).status==='broken'){income=recovery(b);numbers.recoveredCoins+=income;}
  }
  if(action.type==='buy'){assert(b);numbers.tradeValue+=b.value;assert.equal(s.blades.find(v=>v.id===b.id).status,'traded');}
  if(action.type==='reserve'){if(before.reserveId===action.pieceId)numbers.retrieves++;else numbers.reserves++;}
  if(action.type==='claimGift'&&action.traitId===null){assert(before.traits.includes('steady')&&before.traits.includes('ember'));income=40;numbers.giftCoins+=40;}
  if(action.type==='upgrade'||action.type==='repair'){assert(COSTS[before.day]);expense=COSTS[before.day][action.type];numbers[action.type==='upgrade'?'upgrades':'repairs']++;}
  const eventRecord=s.eventHistory.length>before.eventHistory.length?s.eventHistory.at(-1):null;
  if(eventRecord){
   const id=before.eventId,c=eventStats[id];assert(c);assert.equal(eventRecord.id,id);assert.equal(eventRecord.day,before.day);
   const accept=action.type==='chooseEvent'&&action.choice==='accept';assert.equal(eventRecord.choice,accept?'accept':'decline');c[accept?'accepted':'declined']++;
   const delta=accept?(id==='salvage'?160:0)-eventCost(id,before.day):0;assert.equal(eventRecord.coins,delta);c.coins+=delta;
   if(accept){income+=id==='salvage'?160:0;numbers.eventIncome+=id==='salvage'?160:0;expense+=eventCost(id,before.day);if(id==='salvage')c.consumed++;}
  }
  if(action.type==='settle'){
   const p=progress(before),remaining=before.blades.filter(b=>b.status==='active'&&b.id!==before.reserveId),amount=remaining.reduce((n,b)=>n+recovery(b),0);income+=amount;numbers.recoveredCoins+=amount;
   const protectedMiss=!p.complete&&before.traits.includes('pardon')&&!before.pardonUsed,sealsAfter=before.seals-Number(!p.complete&&!protectedMiss);
   if(protectedMiss)triggers.pardon++;
   const expected={day:before.day,commissionId:p.commissionId,met:p.complete,routeId:p.routeId,pieceIds:p.pieceIds,sales:before.daySales,recovered:before.dayRecovered+amount,recoveredIds:remaining.map(b=>b.id),reserveId:before.reserveId,sealsBefore:before.seals,sealsAfter,protected:protectedMiss,modification:null};
   assert.deepEqual(s.history.at(-1),expected);assert.equal(s.seals,sealsAfter);
   const met=s.history.filter(h=>h.met).length,win=met>=10&&[4,8,12].every(day=>s.history.some(h=>h.day===day&&h.met));
   assert.equal(s.phase,sealsAfter===0?'defeat':before.day===12?(win?'victory':'return'):[4,8].includes(before.day)?'chapter':'summary');
   days.push({...cp(expected),coins:s.coins,supplyBase:s.supplyBase,...cp(dayMetrics)});
  }
  if(action.type==='chooseModification'){assert([4,8].includes(before.day));assert.equal(days.at(-1).day,before.day);days.at(-1).modification=action.modification;}
  if(action.type==='advance'){
   checkSupply(s,before);assert.equal(s.day,before.day+1);assert.equal(s.inheritance,0);
   if(before.inheritance>0)effects.add('inherit:consumed');
   if(before.reserveId)effects.add('reserve:crossed');
   if(before.pending.supplyPct===120)eventStats.donation.consumed++;
   if(before.reserveId){const old=before.blades.find(b=>b.id===before.reserveId),kept=s.blades.find(b=>b.id===old.id);assert.equal(kept.value,before.modifications.includes('warmRack')?percent(old.value,115):old.value);assert.equal(kept.cracked,old.cracked);assert.equal(kept.charge,old.charge);assert.equal(kept.base,old.base);if(kept.value>old.value&&before.modifications.includes('warmRack'))triggers.warmRack++;}
   offer(s);dayMetrics=dayCounts();attempted=new Set();
  }
  numbers.spentCoins+=expense;assert.equal(s.coins,before.coins+income-expense,'Independent monetary ledger differs');
  if(action.type!=='settle'&&action.type!=='repair')assert.equal(s.seals,before.seals);if(action.type==='repair')assert.equal(s.seals,before.seals+1);
  for(const old of before.blades){const after=s.blades.find(b=>b.id===old.id);assert(after);if(old.status!=='active')assert.deepEqual(after,old,'A finalized piece changed or was spent twice');}
  checkState(s,eligibility);for(const b of s.blades)if(atCap(b))capped.add(b.id);
 }
 assert(TERMINAL.includes(s.phase));assert.deepEqual(s,record.state,'Snapshot differs from independent journal replay');assert.equal(hash(s),record.stateSha256);
 assert.equal(s.history.length,s.day);assert.equal(numbers.sales,s.history.reduce((n,h)=>n+h.sales,0));assert.equal(numbers.recoveredCoins,s.history.reduce((n,h)=>n+h.recovered,0));
 assert.equal(s.coins,numbers.sales+numbers.recoveredCoins+numbers.giftCoins+numbers.eventIncome-numbers.spentCoins);
 const row={profile,index,seed,mode,phase:s.phase,day:s.day,commands:s.revision,...numbers,bursts:s.blades.reduce((n,b)=>n+b.bursts,0),coins:s.coins,seals:s.seals,met:s.history.filter(h=>h.met).length,peak:Math.max(...s.blades.map(b=>b.peak)),atCap:capped.size,traits:[...s.traits],modifications:[...s.modifications],triggers,days,eventStats,stateSha256:hash(s)};
 assert.equal(row.bursts,row.burstActions);assert.equal(row.strikes,row.normalHits+row.burstActions);
 for(const id of EVENTS){const e=eventStats[id];assert.equal(e.offered,e.accepted+e.declined);assert(e.unaffordable<=e.offered);if(['donation','credit','salvage'].includes(id))assert(e.consumed<=e.accepted);}
 if(profile==='without-reserve'||profile==='new-only')assert.equal(row.reserves,0);
 if(['without-upgrades','without-optional-growth'].includes(profile))assert.equal(row.upgrades,0);
 if(['without-traits','without-optional-growth'].includes(profile)){assert.equal(row.traits.length,0);assert.equal(row.tradeValue,0);assert(!s.journal.some(a=>a.type==='claimGift'||a.type==='buy'));}
 if(profile==='without-repair')assert.equal(row.repairs,0);
 if(['decline-events','without-optional-growth'].includes(profile))assert(!s.eventHistory.some(e=>e.choice==='accept'));
 if(['raw','scrap'].includes(profile)){assert.equal(row.strikes,0);assert.equal(row.phase,'defeat');assert.equal(row.day,3);}
 if(record.row!==undefined)assert.deepEqual(record.row,row,'Producer row differs from independently recomputed row');
 return{state:s,row,features:[...new Set([...featureIds(s,row),...effects])]};
}

export const TOTAL_FIELDS=Object.freeze(['commands','strikes','normalHits','burstActions','bursts','internalHits','cracks','broken','upgrades','repairs','reserves','retrieves','deliveredCount','commissionedCount','sales','recoveredCoins','giftCoins','eventIncome','spentCoins','tradeValue','atCap']);
const TRIGGER_IDS=[...TRAITS,...MODS,'loan','credit','shelter'];
const quantiles=values=>{
 assert(values.length>0);const sorted=[...values].sort((a,b)=>a-b);
 return{min:sorted[0],p10:sorted[Math.floor((sorted.length-1)*.1)],p50:sorted[Math.floor((sorted.length-1)*.5)],p90:sorted[Math.floor((sorted.length-1)*.9)],max:sorted.at(-1),mean:sorted.reduce((n,v)=>n+v,0)/sorted.length};
};
/** Intentionally implemented separately from the producer's summary function. */
export function summarizeRows(rows,profiles=IDS){
 assert(Array.isArray(rows)&&rows.length>0);assert.deepEqual(profiles,IDS);
 return Object.fromEntries(profiles.map(profile=>{
  const group=rows.filter(r=>r.profile===profile);assert(group.length>0,`Missing profile ${profile}`);
  return[profile,{
   cases:group.length,
   outcomes:Object.fromEntries(TERMINAL.map(phase=>[phase,group.filter(r=>r.phase===phase).length])),
   twelveOfTwelve:group.filter(r=>r.met===12).length,
   reachedDay12:group.filter(r=>r.day===12).length,
   finalBladeMade:group.filter(r=>r.days.some(h=>h.day===12&&h.met)).length,
   missingCritical:Object.fromEntries([4,8,12].map(day=>[day,group.filter(r=>!r.days.some(h=>h.day===day&&h.met)).length])),
   totals:Object.fromEntries(TOTAL_FIELDS.map(k=>[k,group.reduce((n,r)=>n+r[k],0)])),
   distributions:Object.fromEntries(['commands','coins','seals','peak','met'].map(k=>[k,quantiles(group.map(r=>r[k]))])),
   commissions:ORDERS.map((routes,i)=>{
    const days=group.flatMap(r=>r.days.filter(h=>h.commissionId===i+1));
    return{id:i+1,reached:days.length,met:days.filter(h=>h.met).length,routes:Object.fromEntries(routes.map(route=>[route.id,days.filter(h=>h.met&&h.routeId===route.id).length]))};
   }),
   traits:Object.fromEntries(TRAITS.map(id=>[id,group.filter(r=>r.traits.includes(id)).length])),
   modifications:Object.fromEntries(MODS.map(id=>[id,group.filter(r=>r.modifications.includes(id)).length])),
   triggers:Object.fromEntries(TRIGGER_IDS.map(id=>[id,group.reduce((n,r)=>n+(r.triggers[id]??0),0)])),
   events:Object.fromEntries(EVENTS.map(id=>[id,Object.fromEntries(['offered','accepted','declined','unaffordable','consumed','coins'].map(k=>[k,group.reduce((n,r)=>n+r.eventStats[id][k],0)]))])),
  }];
 }));
}

export function auditMirrors(rows,seeds){
 const base=rows.filter(r=>r.profile==='balanced-ember');assert.equal(base.length,seeds);
 for(const profile of ['duplicate','reload']){
  const cohort=rows.filter(r=>r.profile===profile);assert.equal(cohort.length,seeds);
  for(let i=0;i<seeds;i++)assert.deepEqual({...cohort[i],profile:'balanced-ember'},base[i],`Mirror differs: ${profile}/${i}`);
 }
 return seeds*2;
}

export function pairedRows(rows,seeds){
 const base=rows.filter(r=>r.profile==='balanced-ember');assert.equal(base.length,seeds);
 return Object.fromEntries(IDS.filter(id=>!['balanced-ember','duplicate','reload','qualified-story','qualified-challenge'].includes(id)).map(id=>{
  const control=rows.filter(r=>r.profile===id);assert.equal(control.length,seeds);
  const result={bothVictory:0,baselineOnlyVictory:0,controlOnlyVictory:0,neitherVictory:0,commandsDelta:[],metDelta:[]};
  for(let i=0;i<seeds;i++){
   const a=base[i],b=control[i];assert.equal(a.seed,b.seed);const aw=a.phase==='victory',bw=b.phase==='victory';
   result[aw?(bw?'bothVictory':'baselineOnlyVictory'):(bw?'controlOnlyVictory':'neitherVictory')]++;
   result.commandsDelta.push(b.commands-a.commands);result.metDelta.push(b.met-a.met);
  }
  return[id,{...result,commandsDelta:quantiles(result.commandsDelta),metDelta:quantiles(result.metDelta)}];
 }));
}

async function* gzipLines(path,maxBytes=4_000_000_000){
 const info=await stat(path);assert(info.isFile()&&info.size>0&&info.size<=512_000_000,'Invalid or excessive gzip file');
 const source=createReadStream(path),unzip=createGunzip();source.on('error',e=>unzip.destroy(e));source.pipe(unzip);
 let pending='',count=0,lastByte=null;const digest=createHash('sha256'),decoder=new TextDecoder('utf-8',{fatal:true});
 try{
  // Iterating chunks, rather than an eagerly flowing line emitter, keeps worker waits under stream backpressure.
  for await(const chunk of unzip){
   count+=chunk.length;assert(count<=maxBytes,'Excessive uncompressed evidence');digest.update(chunk);lastByte=chunk.at(-1);pending+=decoder.decode(chunk,{stream:true});
   let newline;
   while((newline=pending.indexOf('\n'))>=0){const line=pending.slice(0,newline);pending=pending.slice(newline+1);assert(Buffer.byteLength(line)<=1_000_000,'Excessive JSONL line');assert(line.length>0,'Blank JSONL line');assert(!line.endsWith('\r'),'Noncanonical JSONL newline');yield{value:JSON.parse(line),line};}
   assert(Buffer.byteLength(pending)<=1_000_000,'Excessive unterminated JSONL line');
  }
  pending+=decoder.decode();assert.equal(lastByte,10,'JSONL must end in a newline');assert.equal(pending,'','Unterminated JSONL record');return digest.digest('hex');
 }finally{source.destroy();unzip.destroy();}
}

const QUALIFICATION='docs/evidence/T11-4-2-3i1/witness-fixed/complete.json';
const EXTRA_INPUTS=['v3.html','legacy.html','goal-1/input.md','docs/v0.7-balance-validation-contract.md','docs/v0.7-balance-profiles.json','docs/evidence/v07-approval/approved-proposal.md',QUALIFICATION];
export function parseArgs(args){
 const found=new Map();assert(args.length>0&&args.length%2===0,'Use --input <batch> --out <new audit.json> --seeds <1..1000> [--prefix v4-balance|v4-pilot] [--workers 1..8]');
 for(let i=0;i<args.length;i+=2){const key=args[i],value=args[i+1];assert(['--input','--out','--seeds','--prefix','--workers'].includes(key)&&value&&!value.startsWith('--')&&!found.has(key),'Unknown, duplicate or missing argument');found.set(key,value);}
 for(const key of ['--input','--out','--seeds'])assert(found.has(key),`Missing ${key}`);
 assert(/^(?:[1-9]\d{0,2}|1000)$/.test(found.get('--seeds')),'Expected seeds 1..1000');
 const prefix=found.get('--prefix')??'v4-balance';assert(['v4-balance','v4-pilot'].includes(prefix),'Invalid seed prefix');
 const workers=found.get('--workers')??'6';assert(/^[1-8]$/.test(workers),'Expected workers 1..8');
 return{input:found.get('--input'),output:found.get('--out'),expectedSeeds:Number(found.get('--seeds')),expectedPrefix:prefix,workers:Number(workers)};
}

function featureIds(state,row){
 const ids=[`ending:${state.phase}`];
 for(const id of RECIPES)if(state.blades.some(b=>b.recipe===id&&b.hits>0))ids.push(`recipe:${id}:forged`);
 for(const h of row.days)if(h.met)ids.push(`route:${h.commissionId}:${h.routeId}`);
 for(const id of TRAITS)if(state.traits.includes(id)||state.journal.some(a=>(a.type==='buy'||a.type==='claimGift')&&a.traitId===id))ids.push(`trait:${id}:equipped`);
 for(const id of MODS)if(state.modifications.includes(id))ids.push(`modification:${id}:equipped`);
 for(const id of TRIGGER_IDS)if(row.triggers[id])ids.push(`trigger:${id}`);
 for(const id of EVENTS){if(row.eventStats[id].accepted)ids.push(`event:${id}:accepted`);if(row.eventStats[id].consumed)ids.push(`event:${id}:consumed`);}
 if(state.phase==='defeat'&&state.history.some(h=>h.day===4&&h.sealsAfter>0))ids.push('failure:after-chapter');
 if(state.mode==='challenge'&&state.commissionOrder.some((id,i)=>id!==i+1))ids.push('challenge:reordered');
 return[...new Set(ids)];
}
const FEATURE_IDS=[...TERMINAL.map(id=>`ending:${id}`),...RECIPES.map(id=>`recipe:${id}:forged`),...ORDERS.flatMap((routes,i)=>routes.map(r=>`route:${i+1}:${r.id}`)),...TRAITS.map(id=>`trait:${id}:equipped`),...MODS.map(id=>`modification:${id}:equipped`),...TRIGGER_IDS.map(id=>`trigger:${id}`),...EVENTS.map(id=>`event:${id}:accepted`),...EVENTS.filter(id=>id!=='rest').map(id=>`event:${id}:consumed`),'inherit:consumed','reserve:crossed','failure:after-chapter','challenge:reordered'];

/** A successful audit is returned only after every recorded terminal has been independently replayed. */
export function awaitWorkerExit(worker){
 return new Promise((resolve,reject)=>{
  let message,messages=0;
  worker.on('message',value=>{message=value;messages++;});worker.once('error',reject);
  worker.once('exit',code=>{if(code!==0||messages!==1)reject(Error(`Audit worker exited ${code} with ${messages} messages`));else resolve(message);});
 });
}

export async function audit({out,expectedSeeds=1000,expectedPrefix='v4-balance',workers=6}={}){
 assert(typeof out==='string'&&out.length>0);assert(Number.isInteger(expectedSeeds)&&expectedSeeds>=1&&expectedSeeds<=1000);assert(['v4-balance','v4-pilot'].includes(expectedPrefix));assert(Number.isInteger(workers)&&workers>=1&&workers<=8);
 const summary=JSON.parse(await readFile(join(out,'summary.json'),'utf8')),baselineBytes=await readFile(join(out,'baseline.json')),baseline=JSON.parse(baselineBytes),after=JSON.parse(await readFile(join(out,'after.json'),'utf8'));
 assert.equal(summary.schemaVersion,1);assert.equal(summary.rulesVersion,'forge-v4');assert.equal(summary.seedPrefix,expectedPrefix);assert.equal(summary.seeds,expectedSeeds);assert.equal(summary.cases,IDS.length*expectedSeeds);assert.equal(summary.producerReplayedFinalStates,summary.cases);
 const profiles=summary.profiles.map(p=>typeof p==='string'?p:p?.id);assert.deepEqual(profiles,IDS);assert.equal(summary.baselineSha256,hash(baselineBytes));
 assert.deepEqual(baseline.extraInputs,EXTRA_INPUTS,'All six approved extra inputs must be frozen in their declared order');
 assert.deepEqual(changedInputs(baseline,after),[],'Producer completion fingerprint differs from baseline');assert.deepEqual(after.extraInputs,baseline.extraInputs);
 assert.deepEqual(changedInputs(baseline,await captureFingerprint(process.cwd(),baseline.extraInputs)),[],'Source/build differs from frozen physical inputs');
 const frozenProfiles=JSON.parse(await readFile('docs/v0.7-balance-profiles.json','utf8'));assert.deepEqual(summary.profiles,frozenProfiles,'Profile metadata differs from the frozen, reviewed literal table');
 const qualificationState=JSON.parse(await readFile(QUALIFICATION,'utf8')),qualification=earnedQualification(qualificationState);
 const rows=[],rowHash=createHash('sha256'),stateMirrors=new Map(),witnesses={},contentCoverage=Object.fromEntries(FEATURE_IDS.map(id=>[id,0])),live=new Set(),queue=[];let n=0,readCount=0;
 const records=gzipLines(join(out,'records.jsonl.gz'));let recordsSha256;
 function processBatch(entries,result){
  assert(Array.isArray(result)&&result.length===entries.length,'Incomplete independent audit worker result');
  for(let i=0;i<entries.length;i++){
   const record=entries[i],profile=IDS[Math.floor(n/expectedSeeds)],index=n%expectedSeeds,{row,features}=result[i],state=record.state;
   assert.equal(record.profile,profile);assert.equal(record.index,index);assert.deepEqual(row,record.row);assert.equal(row.stateSha256,hash(state));assert(Array.isArray(features));
   rows.push(row);rowHash.update(JSON.stringify(record.row)+'\n');
   if(profile==='balanced-ember')stateMirrors.set(index,state);
   if(profile==='duplicate'||profile==='reload')assert.deepEqual(state,stateMirrors.get(index),`Full-state mirror differs: ${profile}/${index}`);
   const identity={profile,index,seed:row.seed,phase:state.phase,stateSha256:hash(state),commands:state.revision};
   for(const id of features){assert(FEATURE_IDS.includes(id),`Unknown coverage category ${id}`);contentCoverage[id]++;witnesses[id]??=identity;}n++;
  }
 }
 const reap=async()=>{const task=queue.shift();processBatch(task.entries,await task.promise);};
 try{
  let ended=false;
  while(!ended){
   const entries=[],start=readCount;
   for(let i=0;i<25;i++){const next=await records.next();if(next.done){recordsSha256=next.value;ended=true;break;}assert(readCount<summary.cases,'Extra full terminal record');entries.push(next.value.value);readCount++;}
   if(entries.length){
    let promise;
    if(workers===1)promise=Promise.resolve(replayBatch({entries,start,expectedSeeds,expectedPrefix,qualification}));
    else{const worker=new Worker(new URL(import.meta.url),{execArgv:[],workerData:{kind:'v4-model-audit',entries,start,expectedSeeds,expectedPrefix,qualification}});live.add(worker);worker.once('exit',()=>live.delete(worker));promise=awaitWorkerExit(worker);promise.catch(()=>{});}
    queue.push({entries,promise});if(queue.length>=workers)await reap();
   }
  }
  while(queue.length)await reap();
 }finally{await records.return();await Promise.all([...live].map(w=>w.terminate()));}
 assert.equal(n,summary.cases,'Missing full terminal record');assert.equal(recordsSha256,summary.uncompressedRecordsSha256);
 assert(summary.witnesses&&typeof summary.witnesses==='object');
 for(const phase of TERMINAL){
  const expected=witnesses[`ending:${phase}`],actual=summary.witnesses[phase];
  if(!expected){assert(actual===undefined,`Fabricated ${phase} witness`);continue;}
  assert.deepEqual(actual,{...expected,path:`witness-${phase}.json`},`Witness is not the canonical first ${phase}`);
  const state=JSON.parse(await readFile(join(out,actual.path),'utf8'));assert.equal(hash(state),expected.stateSha256);assert.equal(state.phase,phase);
 }
 assert.deepEqual(Object.keys(summary.witnesses).sort(),TERMINAL.filter(phase=>witnesses[`ending:${phase}`]).sort());
 // Read the separately published raw-row stream and compare every field with the full-state evidence.
 const rowStream=gzipLines(join(out,'rows.jsonl.gz'));let m=0,rowsSha256;
 while(true){const next=await rowStream.next();if(next.done){rowsSha256=next.value;break;}assert(m<rows.length,'Extra row');assert.deepEqual(next.value.value,rows[m],`Published row differs at ${m}`);m++;}
 assert.equal(m,rows.length,'Missing row');assert.equal(rowsSha256,summary.rowsSha256);assert.equal(rowHash.digest('hex'),rowsSha256,'The rows embedded in full records differ byte-for-byte from published rows');
 const mirrorComparisons=auditMirrors(rows,expectedSeeds),statistics=summarizeRows(rows);assert.deepEqual(summary.statistics,statistics,'Producer summary statistics differ from independent reconstruction');
 assert.deepEqual(changedInputs(baseline,await captureFingerprint(process.cwd(),baseline.extraInputs)),[],'Inputs changed during the independent audit');
 return{schemaVersion:1,rulesVersion:'forge-v4',seedPrefix:expectedPrefix,seeds:expectedSeeds,cases:n,producerReplayedFinalStates:summary.producerReplayedFinalStates,independentReplayedFinalStates:n,mirrorComparisons,rowsSha256,uncompressedRecordsSha256:recordsSha256,baselineSha256:hash(baselineBytes),sourceFiles:Object.keys(baseline.sourceHashes).length,buildFiles:Object.keys(baseline.buildFiles).length,qualification:{source:QUALIFICATION,stateSha256:hash(qualificationState),eligibility:qualification},statistics,paired:pairedRows(rows,expectedSeeds),contentCoverage,missingFeatures:FEATURE_IDS.filter(id=>contentCoverage[id]===0),exemptCoverage:{'event:rest:consumed':'Rest preserves existing resources; it has no consumable benefit.'},witnesses};
}

function replayBatch({entries,start,expectedSeeds,expectedPrefix,qualification}){
 assert(Array.isArray(entries)&&entries.length>=1&&entries.length<=25);assert(Number.isInteger(start)&&start>=0);
 return entries.map((record,i)=>{const n=start+i,profile=IDS[Math.floor(n/expectedSeeds)],index=n%expectedSeeds,{row,features}=auditRecord(record,{profile,index,prefix:expectedPrefix,qualification});return{row,features};});
}

if(!isMainThread){
 assert.equal(workerData?.kind,'v4-model-audit');parentPort.postMessage(replayBatch(workerData));
}else if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 const args=parseArgs(process.argv.slice(2));
 // Check before replaying: an existing report is never overwritten, including an earlier failed run's evidence.
 await stat(args.output).then(()=>{throw Error('Audit output already exists');},e=>{if(e.code!=='ENOENT')throw e;});
 const result=await audit({out:args.input,expectedSeeds:args.expectedSeeds,expectedPrefix:args.expectedPrefix,workers:args.workers});
 await writeFile(args.output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({valid:true,cases:result.cases,independentReplayedFinalStates:result.independentReplayedFinalStates,workers:args.workers,out:args.output}));
}
