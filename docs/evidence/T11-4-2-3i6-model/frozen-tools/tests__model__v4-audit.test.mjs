import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {gzipSync} from 'node:zlib';
import {spawn} from 'node:child_process';
import {Worker} from 'node:worker_threads';
import * as api from '../../dist/sword-led-v4.js';
import {IDS,hash,auditRecord,summarizeRows,auditMirrors,earnedQualification,parseArgs,audit,awaitWorkerExit} from '../../scripts/audit-v4-model.mjs';
import {captureFingerprint} from '../../scripts/release-fingerprint.mjs';

const qualificationSource='docs/evidence/T11-4-2-3i1/witness-fixed/complete.json';
const qualificationState=JSON.parse(await readFile(qualificationSource,'utf8'));
const qualification=earnedQualification(qualificationState);
const extraInputs=['v3.html','legacy.html','goal-1/input.md','docs/v0.7-balance-validation-contract.md','docs/v0.7-balance-profiles.json','docs/evidence/v07-approval/approved-proposal.md',qualificationSource];

function negativeRecord(profile='balanced-ember',index=0){
 const seed=`v4-pilot-${String(index).padStart(4,'0')}`,mode=profile==='qualified-challenge'?'challenge':'story';
 const input={runId:'v4-model',seed,mode,...(profile.startsWith('qualified-')?{eligibility:qualification}:{})};
 const created=api.createRun(input);assert(created.ok);let state=created.state;
 const send=action=>{const r=api.applyCommand(state,{runId:state.runId,expectedRevision:state.revision,action});assert(r.ok,r.error);state=r.state;};
 send({type:'continue'});
 while(!['victory','return','defeat'].includes(state.phase)){
  if(state.phase==='summary'){send({type:'advance'});continue;}
  if(state.phase==='chapter'){send({type:'chooseModification',modification:state.chapterChoices[0]});continue;}
  for(const b of state.blades.filter(b=>b.status==='active'&&b.id!==state.reserveId))send({type:profile==='scrap'?'scrap':'deliver',pieceId:b.id});
  send({type:'settle'});
 }
 const record={profile,index,seed,mode,input,state,stateSha256:hash(state)};
 record.row=auditRecord(record,{prefix:'v4-pilot',qualification}).row;return record;
}

function actualJourney(){
 const profile='balanced-ember',index=1,seed='v4-pilot-0001',input={runId:'v4-model',seed,mode:'story'};
 const created=api.createRun(input);assert(created.ok);let state=created.state;
 const send=action=>{const r=api.applyCommand(state,{runId:state.runId,expectedRevision:state.revision,action});assert(r.ok,r.error);state=r.state;};
 for(let guard=0;guard<800&&!['victory','return','defeat'].includes(state.phase);guard++){
  const v=api.getRunView(state);
  if(v.phase==='opening'){send({type:'continue'});continue;}
  if(v.phase==='summary'){send({type:'advance'});continue;}
  if(v.phase==='chapter'){send({type:'chooseModification',modification:v.chapterChoices.find(m=>m.id==='windbox')?.id??v.chapterChoices[0].id});continue;}
  if(v.gift.canClaim){send({type:'claimGift',traitId:v.traits.some(t=>t.id==='steady')?'ember':'steady'});continue;}
  if(v.merchant?.canRepair&&v.seals<2){send({type:'repair'});continue;}
  if(v.merchant?.canUpgrade){send({type:'upgrade'});continue;}
  const piece=v.blades.find(p=>!p.reserved);
  if(piece){
   const route=v.commission.routes.find(r=>r.recipe);
   if(!v.commission.progress.complete&&route&&piece.canChangeRecipe&&piece.blade.recipe!==route.recipe){send({type:'setRecipe',pieceId:piece.blade.id,recipe:route.recipe});continue;}
   if(!v.commission.progress.complete&&!piece.assessment.qualifies&&piece.canStrike&&piece.blade.hits<16&&!(piece.blade.cracked&&v.commission.routes.every(r=>r.crack==='intact'))){send({type:'strike',pieceId:piece.blade.id});continue;}
   send({type:'deliver',pieceId:piece.blade.id});continue;
  }
  if(v.event?.status==='available'){const q=api.eventQuote(state);send(q.allowed?{type:'chooseEvent',choice:'accept'}:{type:'chooseEvent',choice:'decline'});continue;}
  send({type:'settle'});
 }
 assert(['victory','return','defeat'].includes(state.phase));
 return{profile,index,seed,mode:'story',input,state,stateSha256:hash(state)};
}

test('independent replay checks the raw/scrap paper ledger and all fixed profile identities',()=>{
 assert.equal(IDS.length,30);assert.equal(new Set(IDS).size,30);
 const raw=auditRecord(negativeRecord('raw'),{prefix:'v4-pilot',qualification}).row;
 assert.equal(raw.phase,'defeat');assert.equal(raw.day,3);assert.equal(raw.sales,360);assert.equal(raw.coins,360);assert.equal(raw.deliveredCount,9);assert.equal(raw.met,0);assert.equal(raw.strikes,0);assert.equal(raw.seals,0);
 const scrap=auditRecord(negativeRecord('scrap'),{prefix:'v4-pilot',qualification}).row;
 assert.equal(scrap.recoveredCoins,90);assert.equal(scrap.coins,90);assert.equal(scrap.deliveredCount,0);assert.equal(scrap.sales,0);
 assert.equal(Object.keys(raw.triggers).length,12);assert.equal(raw.days[0].commissionAttempts,3);assert.deepEqual(raw.days[0].attemptedRecipes,{light:3,guard:0,heavy:0});
});

test('exactly 1000 accepted commands may end legally; a nonterminal journal is rejected',()=>{
 const input={runId:'v4-model',seed:'v4-pilot-0000',mode:'story'},made=api.createRun(input);assert(made.ok);let state=made.state;
 const send=action=>{const r=api.applyCommand(state,{runId:state.runId,expectedRevision:state.revision,action});assert(r.ok,r.error);state=r.state;};
 send({type:'continue'});for(let i=0;i<994;i++)send({type:'reserve',pieceId:'d1-1'});
 const ongoing={profile:'balanced-ember',index:0,seed:input.seed,mode:'story',input,state,stateSha256:hash(state)};
 assert.throws(()=>auditRecord(ongoing,{prefix:'v4-pilot',qualification}));
 for(let day=1;day<=3;day++){send({type:'settle'});if(day<3)send({type:'advance'});}
 assert.equal(state.revision,1000);assert.equal(state.phase,'defeat');
 const result=auditRecord({...ongoing,state,stateSha256:hash(state)},{prefix:'v4-pilot',qualification});assert.equal(result.row.commands,1000);assert.equal(result.row.recoveredCoins,90);assert.equal(result.row.reserves,497);assert.equal(result.row.retrieves,497);
});

test('a genuine multi-day journal independently accounts for strikes, growth, events and chapter choice',()=>{
 const record=actualJourney(),{row,state}=auditRecord(record,{prefix:'v4-pilot',qualification});
 assert(row.strikes>20);assert(row.internalHits>=row.strikes);assert(row.upgrades>0);assert(row.days.length>=4);assert(row.modifications.length>=1);
 assert.deepEqual(row.days.map(d=>d.modification),state.history.map(d=>d.modification));
 assert.equal(row.coins,row.sales+row.recoveredCoins+row.giftCoins+row.eventIncome-row.spentCoins);
 record.row=row;assert.deepEqual(auditRecord(record,{prefix:'v4-pilot',qualification}).row,row);
});

test('state, row, journal, earned qualification, cohort and canonical position tampering are rejected',()=>{
 const original=negativeRecord();
 for(const mutate of [
  r=>r.state.coins++,r=>r.state.journal.pop(),r=>r.state.phase='victory',r=>r.state.rulesVersion='forge-v3',r=>r.state.rng.forge.draws++,r=>r.stateSha256='0'.repeat(64),
  r=>r.row.sales++,r=>r.row.days[0].met=true,r=>r.row.days[0].commissionAttempts--,r=>r.row.triggers.echo++,r=>r.row.eventStats.loan.consumed++,
  r=>r.input.eligibility={recipes:['light','guard'],challenge:false},r=>r.mode='challenge',r=>r.seed='v4-pilot-0002',r=>r.index=1,
 ]){const r=structuredClone(original);mutate(r);assert.throws(()=>auditRecord(r,{profile:original.profile,index:0,prefix:'v4-pilot',qualification}));}
 const qualified=negativeRecord('qualified-story');assert.throws(()=>auditRecord(qualified,{prefix:'v4-pilot'}));
 const bad=structuredClone(qualificationState);bad.coins++;assert.throws(()=>earnedQualification(bad));
});

test('independent aggregation includes absent routes/triggers and exact mirrors',()=>{
 const rows=IDS.map(id=>negativeRecord(id).row),summary=summarizeRows(rows);
 assert.deepEqual(Object.keys(summary),IDS);assert.equal(summary.raw.outcomes.defeat,1);assert.equal(summary.raw.commissions[3].reached,0);assert.equal(summary.raw.commissions[10].routes.old,0);assert.equal(summary.raw.triggers.pardon,0);assert.equal(summary.scrap.totals.recoveredCoins,90);assert.equal(summary.raw.distributions.coins.p50,360);
 assert.equal(auditMirrors(rows,1),2);const bad=structuredClone(rows);bad.find(r=>r.profile==='reload').stateSha256='f'.repeat(64);assert.throws(()=>auditMirrors(bad,1));
});

test('CLI validates all parameters before writing an output',()=>{
 assert.deepEqual(parseArgs(['--input','tmp/model','--out','tmp/audit.json','--seeds','1000']),{input:'tmp/model',output:'tmp/audit.json',expectedSeeds:1000,expectedPrefix:'v4-balance',workers:6});
 for(const args of [[],['--input'],['--other','x'],['--input','x','--input','y'],['--input','x','--out','y','--seeds','0'],['--input','x','--out','y','--seeds','1001'],['--input','x','--out','y','--seeds','1.5'],['--input','x','--out','y','--seeds','01'],['--input','x','--out','y','--seeds','1','--prefix','secret'],['--input','x','--out','y','--seeds','1','--workers','0'],['--input','x','--out','y','--seeds','1','--workers','9'],['--input','x','--out','--seeds','1']])assert.throws(()=>parseArgs(args));
});

test('a worker message is not accepted until its real successful exit',async()=>{
 const bad=new Worker('const {parentPort}=require("node:worker_threads");parentPort.postMessage({valid:true});setTimeout(()=>process.exit(1),20);',{eval:true,execArgv:[]});await assert.rejects(awaitWorkerExit(bad),/exited 1 with 1 messages/);
 const good=new Worker('const {parentPort}=require("node:worker_threads");parentPort.postMessage({valid:true});',{eval:true,execArgv:[]});assert.deepEqual(await awaitWorkerExit(good),{valid:true});
 const empty=new Worker('',{eval:true,execArgv:[]});await assert.rejects(awaitWorkerExit(empty),/0 messages/);
 const duplicate=new Worker('const {parentPort}=require("node:worker_threads");parentPort.postMessage(1);parentPort.postMessage(2);',{eval:true,execArgv:[]});await assert.rejects(awaitWorkerExit(duplicate),/2 messages/);
});

async function makeDirectory(){
 const out=await mkdtemp(join(tmpdir(),'sword-v4-audit-')),records=IDS.map(id=>negativeRecord(id));
 const baseline=await captureFingerprint(process.cwd(),extraInputs),baselineBytes=JSON.stringify(baseline,null,2)+'\n';
 const rowsBytes=records.map(r=>JSON.stringify(r.row)).join('\n')+'\n',recordsBytes=records.map(r=>JSON.stringify(r)).join('\n')+'\n';
 const first=records.find(r=>r.state.phase==='defeat');
 const profiles=JSON.parse(await readFile('docs/v0.7-balance-profiles.json','utf8'));
 const summary={schemaVersion:1,rulesVersion:'forge-v4',seedPrefix:'v4-pilot',seeds:1,profiles,cases:30,producerReplayedFinalStates:30,rowsSha256:hash(rowsBytes),uncompressedRecordsSha256:hash(recordsBytes),baselineSha256:hash(baselineBytes),statistics:summarizeRows(records.map(r=>r.row)),witnesses:{defeat:{profile:first.profile,index:first.index,seed:first.seed,phase:first.state.phase,stateSha256:first.stateSha256,commands:first.state.revision,path:'witness-defeat.json'}}};
 await Promise.all([writeFile(join(out,'baseline.json'),baselineBytes),writeFile(join(out,'after.json'),baselineBytes),writeFile(join(out,'records.jsonl.gz'),gzipSync(recordsBytes)),writeFile(join(out,'rows.jsonl.gz'),gzipSync(rowsBytes)),writeFile(join(out,'summary.json'),JSON.stringify(summary,null,2)+'\n'),writeFile(join(out,'witness-defeat.json'),JSON.stringify(first.state)+'\n')]);
 return{out,records,summary,baseline,baselineBytes,rowsBytes,recordsBytes};
}

test('full evidence audit rejects gzip, omission, ordering, fake fingerprints and summary attacks',async()=>{
 const fixture=await makeDirectory();
 try{
  const valid=await audit({out:fixture.out,expectedSeeds:1,expectedPrefix:'v4-pilot',workers:1});assert.equal(valid.independentReplayedFinalStates,30);assert.equal(valid.mirrorComparisons,2);
  const parallel=await audit({out:fixture.out,expectedSeeds:1,expectedPrefix:'v4-pilot',workers:2});assert.deepEqual(parallel,valid,'Parallel audit must preserve every field, statistic and witness');
  const restore=async()=>{await writeFile(join(fixture.out,'summary.json'),JSON.stringify(fixture.summary));await writeFile(join(fixture.out,'baseline.json'),fixture.baselineBytes);await writeFile(join(fixture.out,'after.json'),fixture.baselineBytes);await writeFile(join(fixture.out,'records.jsonl.gz'),gzipSync(fixture.recordsBytes));await writeFile(join(fixture.out,'rows.jsonl.gz'),gzipSync(fixture.rowsBytes));};
  const rejected=()=>assert.rejects(audit({out:fixture.out,expectedSeeds:1,expectedPrefix:'v4-pilot',workers:1}));
  await writeFile(join(fixture.out,'records.jsonl.gz'),'not a gzip');await rejected();await restore();
  for(const change of [records=>records.pop(),records=>records.reverse(),records=>{records[1]=records[0];},records=>{records[0].row.coins++;}]){
   const records=structuredClone(fixture.records);change(records);const bytes=records.map(r=>JSON.stringify(r)).join('\n')+'\n';
   await writeFile(join(fixture.out,'records.jsonl.gz'),gzipSync(bytes));await writeFile(join(fixture.out,'summary.json'),JSON.stringify({...fixture.summary,uncompressedRecordsSha256:hash(bytes)}));await rejected();await restore();
  }
  for(const group of ['buildFiles','sourceHashes']){
   const fake=structuredClone(fixture.baseline),key=group==='buildFiles'?'dist/sword-led-v4.js':'src/core-v4/game.ts';assert(fake[group][key]);fake[group][key].sha256='0'.repeat(64);const bytes=JSON.stringify(fake,null,2)+'\n';
   await writeFile(join(fixture.out,'baseline.json'),bytes);await writeFile(join(fixture.out,'after.json'),bytes);await writeFile(join(fixture.out,'summary.json'),JSON.stringify({...fixture.summary,baselineSha256:hash(bytes)}));await rejected();await restore();
  }
  const falseSummary=structuredClone(fixture.summary);falseSummary.statistics.raw.outcomes.victory=1;await writeFile(join(fixture.out,'summary.json'),JSON.stringify(falseSummary));await rejected();await restore();
  const proc=spawn(process.execPath,[resolve('scripts/audit-v4-model.mjs'),'--input',fixture.out,'--out',join(fixture.out,'summary.json'),'--seeds','1','--prefix','v4-pilot'],{stdio:'ignore'});
  const code=await new Promise((res,rej)=>{proc.once('error',rej);proc.once('exit',res);});assert.notEqual(code,0);assert((await stat(join(fixture.out,'summary.json'))).isFile());
  await writeFile(join(fixture.out,'records.jsonl.gz'),'bad gzip');const report=join(fixture.out,'must-not-exist.json');
  const failure=spawn(process.execPath,[resolve('scripts/audit-v4-model.mjs'),'--input',fixture.out,'--out',report,'--seeds','1','--prefix','v4-pilot'],{stdio:'ignore'});
  const failureCode=await new Promise((res,rej)=>{failure.once('error',rej);failure.once('exit',res);});assert.notEqual(failureCode,0);await assert.rejects(stat(report),{code:'ENOENT'});
 }finally{await rm(fixture.out,{recursive:true,force:true});}
});
