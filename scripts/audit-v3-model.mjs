// Independent result audit: totals/shape are recomputed here, never trusted from producer summary.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {createRun,validateRun} from '../dist/sword-led-v3.js';
import {captureFingerprint,changedInputs} from './release-fingerprint.mjs';

export const IDS=[...['conservative','balanced','aggressive'].flatMap(r=>['steady','ember'].map(g=>`${r}-${g}`)),
 ...[3,6,7,10].map(n=>`fixed-${n}`),...['reserve','trade','upgrade','repair','shop','traits'].map(x=>`without-${x}`),
 ...['echo','steady','pardon','inherit','crackedEdge'].map(x=>`prefer-${x}`),'balanced-duplicate','balanced-reload','raw','scrap','blind'];
const quotas=[180,300,520,850,1400,2300,3800,6200,10000,16000,26000,42000];
const hash=x=>createHash('sha256').update(typeof x==='string'||x instanceof Uint8Array?x:JSON.stringify(x)).digest('hex');
const integer=n=>assert(Number.isSafeInteger(n)&&n>=0,'Expected nonnegative integer');
const quartiles=values=>{const a=[...values].sort((a,b)=>a-b);return{min:a[0],p25:a[Math.floor((a.length-1)*.25)],median:a[Math.floor((a.length-1)*.5)],p75:a[Math.floor((a.length-1)*.75)],max:a.at(-1),mean:a.reduce((n,v)=>n+v,0)/a.length};};
export function auditRows(rows,seeds){
 assert(Number.isInteger(seeds)&&seeds>=1&&seeds<=1000);assert.equal(rows.length,IDS.length*seeds);
 const numeric=['round','commands','strikes','bursts','cracks','broken','upgrades','repairs','reserves','retrieves','deliveries','tradeValue','recoveredCoins','giftCoins','spentCoins','coins','seals','base','met','supplied','delivered','peak'];
 rows.forEach((r,n)=>{
  assert.equal(r.profile,IDS[Math.floor(n/seeds)]);assert.equal(r.index,n%seeds);assert.equal(r.seed,`v3-balance-${String(n%seeds).padStart(4,'0')}`);
  assert(['victory','defeat'].includes(r.phase));for(const k of numeric)integer(r[k]);assert.match(r.stateSha256,/^[a-f0-9]{64}$/);
  assert(r.round>=3&&r.round<=12&&r.commands<1000&&r.strikes<=r.commands&&r.bursts<=r.strikes);
  assert.equal(r.supplied,r.round*3);assert.equal(r.rounds.length,r.round);assert.equal(r.met,r.rounds.filter(x=>x.met).length);
  assert.equal(r.delivered,r.rounds.reduce((n,x)=>n+x.delivered,0));assert.equal(r.rounds.at(-1).sealsAfter,r.seals);
  assert.equal(r.coins,r.delivered+r.recoveredCoins+r.giftCoins-r.spentCoins);
  assert(r.phase==='victory'?r.round===12&&r.seals>0:r.seals===0);
  let seals=3,misses=0;
  for(const [i,x]of r.rounds.entries()){
   assert.equal(x.round,i+1);assert.equal(x.quota,quotas[i]);assert.equal(x.met,x.delivered>=x.quota);
   assert.equal(x.sealsAfter,x.sealsBefore-Number(!x.met&&!x.protected));assert(x.sealsBefore>=seals&&x.sealsBefore<=3);
   for(const k of ['delivered','recovered','coins','base','sealsBefore','sealsAfter'])integer(x[k]);
   if(x.protected){assert(!x.met);misses++;}seals=x.sealsAfter;
  }
  assert(misses<=1&&r.upgrades<=3&&r.repairs<=3&&r.traits.length<=3&&new Set(r.traits).size===r.traits.length);
  assert.equal(r.base,40*2**r.upgrades);assert(r.trades.length<=3);assert.equal(new Set(r.trades.map(x=>x.round)).size,r.trades.length);
  assert.equal(r.tradeValue,r.trades.reduce((n,x)=>n+x.value,0));assert(r.trades.every(x=>[3,6,9].includes(x.round)));
  const spent=r.trades.map(x=>x.blade);assert.equal(new Set(spent).size,spent.length);
  for(const count of Object.values(r.triggers))integer(count);
  if(r.profile==='raw'||r.profile==='scrap'){assert.equal(r.phase,'defeat');assert.equal(r.round,3);assert.equal(r.strikes,0);}
  if(r.profile==='without-reserve')assert.equal(r.reserves,0);
  if(['without-trade','without-shop','without-traits'].includes(r.profile))assert.equal(r.trades.length,0);
  if(['without-upgrade','without-shop'].includes(r.profile))assert.equal(r.upgrades,0);
  if(['without-repair','without-shop'].includes(r.profile))assert.equal(r.repairs,0);
  if(r.profile==='without-traits'){assert.equal(r.traits.length,0);assert.deepEqual(r.triggers,{});}
 });
 const byProfile=Object.fromEntries(IDS.map(id=>[id,rows.filter(r=>r.profile===id)]));
 for(const name of ['balanced-duplicate','balanced-reload'])for(let i=0;i<seeds;i++){
  assert.deepEqual({...byProfile[name][i],profile:'balanced-ember'},byProfile['balanced-ember'][i],`Probe changed state: ${name}/${i}`);
 }
 return Object.fromEntries(IDS.map(id=>{const group=byProfile[id],wins=group.filter(r=>r.phase==='victory');return[id,{
  cases:group.length,victories:wins.length,winRate:wins.length/group.length,
  round:quartiles(group.map(r=>r.round)),commands:quartiles(group.map(r=>r.commands)),winningCommands:wins.length?quartiles(wins.map(r=>r.commands)):null,
  met:quartiles(group.map(r=>r.met)),broken:quartiles(group.map(r=>r.broken)),bursts:quartiles(group.map(r=>r.bursts)),coins:quartiles(group.map(r=>r.coins)),
  upgrades:quartiles(group.map(r=>r.upgrades)),repairs:quartiles(group.map(r=>r.repairs)),reserveRetrievals:group.reduce((n,r)=>n+r.retrieves,0),
  triggers:Object.fromEntries(['steady','ember','inherit','echo','crackedEdge'].map(t=>[t,group.reduce((n,r)=>n+(r.triggers[t]??0),0)])),
  equipped:Object.fromEntries(['steady','ember','inherit','echo','crackedEdge','pardon'].map(t=>[t,group.filter(r=>r.traits.includes(t)).length])),
  roundDetail:quotas.map((q,i)=>{const present=group.filter(r=>r.round>i),records=present.map(r=>r.rounds[i]);return{round:i+1,quota:q,reached:present.length,met:records.filter(x=>x.met).length,protected:records.filter(x=>x.protected).length,delivered:records.length?quartiles(records.map(x=>x.delivered)):null};}),
 }];}));
}
export async function auditDirectory(dir){
 const summary=JSON.parse(await readFile(`${dir}/summary.json`,'utf8')),baselineBytes=await readFile(`${dir}/baseline.json`),baseline=JSON.parse(baselineBytes);
 assert.equal(summary.schemaVersion,1);assert.equal(summary.rulesVersion,'forge-v3');assert.deepEqual(summary.profiles.map(p=>p.id),IDS);
 assert.equal(summary.baselineSha256,hash(baselineBytes));assert.equal(summary.cases,summary.seeds*IDS.length);assert.equal(summary.replayedFinalStates,summary.cases);
 assert.deepEqual(changedInputs(baseline,await captureFingerprint()),[],'Source/build drift');
 const raw=gunzipSync(await readFile(`${dir}/rows.jsonl.gz`));assert.equal(hash(raw),summary.rowsSha256);assert(raw.toString().endsWith('\n'));
 const rows=raw.toString().trimEnd().split('\n').map(x=>JSON.parse(x)),statistics=auditRows(rows,summary.seeds),witnesses={};
 for(const phase of ['victory','defeat']){
  const row=rows.find(r=>r.phase===phase);if(!row){assert(!summary.witnesses[phase]);continue;}
  const state=JSON.parse(await readFile(`${dir}/${phase}.json`,'utf8')),replayed=validateRun(state);assert(replayed.ok,replayed.detail);
  assert.equal(hash(state),row.stateSha256);assert.equal(summary.witnesses[phase].stateSha256,row.stateSha256);
  assert.equal(state.seed,row.seed);assert.equal(state.phase,phase);assert.equal(state.revision,row.commands);assert.equal(state.coins,row.coins);
  assert.equal(state.round,row.round);assert.equal(state.seals,row.seals);witnesses[phase]={profile:row.profile,seed:row.seed,stateSha256:hash(state),commands:state.revision};
 }
 // No action must leave every initial snapshot untouched (1000 independent seeds).
 for(let i=0;i<summary.seeds;i++){const fresh=createRun({runId:'v3-model',seed:`v3-balance-${String(i).padStart(4,'0')}`,roundLimit:12});assert(fresh.ok);assert.equal(fresh.state.revision,0);assert.equal(fresh.state.phase,'workshop');assert.equal(fresh.state.coins,0);assert(validateRun(fresh.state).ok);}
 const paired={};const baselineRows=rows.filter(r=>r.profile==='balanced-ember');
 for(const id of IDS.filter(id=>id.startsWith('without-')||id.startsWith('prefer-'))){
  const control=rows.filter(r=>r.profile===id);paired[id]={baselineOnlyWins:0,controlOnlyWins:0,bothWin:0,bothLose:0};
  for(let i=0;i<summary.seeds;i++){const a=baselineRows[i].phase==='victory',b=control[i].phase==='victory';paired[id][a?(b?'bothWin':'baselineOnlyWins'):(b?'controlOnlyWins':'bothLose')]++;}
 }
 return{rulesVersion:'forge-v3',seeds:summary.seeds,cases:rows.length,producerReplays:summary.replayedFinalStates,independentWitnessReplays:Object.keys(witnesses).length,
  mirrorComparisons:summary.seeds*2,noActionSnapshots:summary.seeds,sourceInputs:Object.keys(baseline.sourceHashes).length,buildFiles:Object.keys(baseline.buildFiles).length,
  rowsSha256:hash(raw),statistics,paired,witnesses};
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 const [dir,out,...rest]=process.argv.slice(2);if(!dir||!out||rest.length)throw Error('Use <batch directory> <new audit.json>');
 const audit=await auditDirectory(dir);await writeFile(out,JSON.stringify(audit,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({valid:true,seeds:audit.seeds,cases:audit.cases,witnesses:audit.witnesses}));
}
