import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,access} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {gunzipSync} from 'node:zlib';
import {PROFILES} from '../../scripts/v4-model-policy.mjs';
import {seedAt,partition,simulate,runBatch} from '../../scripts/v4-model.mjs';

test('the frozen thirty profiles and paired seed partitions cover every case exactly once',()=>{
 assert.equal(PROFILES.length,30);assert.equal(new Set(PROFILES.map(p=>p.id)).size,30);
 assert.equal(seedAt(0),'v4-balance-0000');assert.equal(seedAt(999),'v4-balance-0999');assert.equal(seedAt(2,'v4-pilot'),'v4-pilot-0002');
 const jobs=partition(1000);assert.equal(jobs.length,1200);
 for(const profile of PROFILES){const ids=jobs.filter(job=>job.profile===profile.id).flatMap(job=>Array.from({length:job.count},(_,i)=>job.start+i));assert.deepEqual(ids,Array.from({length:1000},(_,i)=>i));}
 for(const value of [0,1001,1.5,NaN])assert.throws(()=>partition(value));assert.throws(()=>seedAt(1000));assert.throws(()=>seedAt(0,'favorable-seeds'));
});

test('producer mirrors retain the same real state, accounting and public-observation chain',()=>{
 const p=id=>PROFILES.find(profile=>profile.id===id),base=simulate(p('balanced-ember'),0,{seedPrefix:'v4-pilot'});
 for(const id of ['duplicate','reload']){const mirror=simulate(p(id),0,{seedPrefix:'v4-pilot'});assert.deepEqual(mirror.state,base.state);assert.equal(mirror.stateSha256,base.stateSha256);assert.equal(mirror.observationChainSha256,base.observationChainSha256);assert.deepEqual({...mirror.row,profile:'same'},{...base.row,profile:'same'});}
 assert.equal(base.row.coins,base.row.sales+base.row.recoveredCoins+base.row.giftCoins+base.row.eventIncome-base.row.spentCoins);
 assert.equal(base.state.journal.length,base.row.commands);assert(base.row.commands<1000);
});

test('serial and four-worker pilot datasets are byte-equivalent and keep all complete terminal journals',async()=>{
 const parent=await mkdtemp(resolve('tmp/v4-model-test-'));
 const first=await runBatch({seeds:1,workers:1,out:parent+'/serial',seedPrefix:'v4-pilot'});
 const other=await runBatch({seeds:1,workers:4,out:parent+'/parallel',seedPrefix:'v4-pilot'});
 assert.equal(first.cases,30);assert.equal(first.producerReplayedFinalStates,30);assert.equal(first.rowsSha256,other.rowsSha256);assert.equal(first.uncompressedRecordsSha256,other.uncompressedRecordsSha256);assert.deepEqual(first.statistics,other.statistics);assert.deepEqual(first.witnesses,other.witnesses);
 const a=gunzipSync(await readFile(parent+'/serial/records.jsonl.gz')),b=gunzipSync(await readFile(parent+'/parallel/records.jsonl.gz'));assert.deepEqual(a,b);
 const records=a.toString().trim().split('\n').map(line=>JSON.parse(line));assert.equal(records.length,30);
 assert.deepEqual(records.map(record=>record.profile),PROFILES.map(p=>p.id));for(const record of records){assert(record.state.journal.length>0);assert.equal(record.state.revision,record.state.journal.length);assert.equal(record.row.stateSha256,record.stateSha256);assert.equal(record.seed,'v4-pilot-0000');}
});

test('malformed CLI options reject before producing a successful dataset',async()=>{
 const out=await mkdtemp(resolve('tmp/v4-model-refusal-'));
 const cases=[['--bad','1'],['--seeds'],['--seeds','0'],['--seeds','1001'],['--seeds','1.1'],['--seeds','1e3'],['--seeds','1','--seeds','2'],['--workers','0'],['--workers','9'],['--seed-prefix','selected-winners'],['--out','.'],['--seeds','1','--out',out]];
 for(const args of cases){const result=spawnSync(process.execPath,['scripts/v4-model.mjs',...args],{encoding:'utf8',timeout:30000});assert.notEqual(result.status,0,args.join(' '));assert(!result.stderr.includes('ERR_MODULE_NOT_FOUND'),result.stderr);assert(!result.stdout.includes('"complete":true'));}
});

test('a worker that posts data then fails cannot publish a successful summary',async()=>{
 const parent=await mkdtemp(resolve('tmp/v4-model-worker-failure-')),out=parent+'/failed';
 const code=`import {runBatch} from './scripts/v4-model.mjs';await runBatch({seeds:1,workers:2,out:${JSON.stringify(out)},seedPrefix:'v4-pilot',injectFailureAfterMessage:true});`;
 const result=spawnSync(process.execPath,['--input-type=module','-e',code],{encoding:'utf8',timeout:60000});assert.notEqual(result.status,0);assert.match(result.stderr,/Intentional worker failure|Worker exit/);assert(!result.stdout.includes('"complete":true'));
 await assert.rejects(access(out+'/summary.json'));const failure=JSON.parse(await readFile(out+'/failure.json','utf8'));assert.equal(failure.expected,30);assert(failure.completed<30);
});
