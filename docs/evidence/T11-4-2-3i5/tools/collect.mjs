import assert from 'node:assert/strict';
import {isDeepStrictEqual} from 'node:util';
import {createReadStream} from 'node:fs';
import {readFile,readdir,mkdir,copyFile,writeFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {basename,relative} from 'node:path';
import {gzipSync,gunzipSync} from 'node:zlib';
import {captureFingerprint} from '../../scripts/release-fingerprint.mjs';
import * as sdk from '../../dist/sword-led-v4.js';

// Explicit final coverage: nine unaffected boundary passes + three repaired memory cases + twelve journeys.
// Example: node collect.mjs pilot pilot-listen release repair final-boundaries final-memory final-journeys
const root='tmp/T11-4-2-3i5',out='docs/evidence/T11-4-2-3i5',batches=process.argv.slice(2);
const finalContributions={'final-boundaries':9,'final-memory':3,'final-journeys':12};
const finalBatches=Object.keys(finalContributions),projects=['v4-chromium','v4-firefox','v4-webkit'];
const memoryCaseTitle='explicit restored-ending boundaries keep unknown future collection bytes and block readonly challenge starts';
const testPath='tests/e2e/v4-final.spec.ts';
assert(batches.length,'Pass explicit retained batch names');assert.equal(new Set(batches).size,batches.length);
for(const name of batches)assert(/^[a-z][a-z0-9-]*$/.test(name),'Invalid batch path');
for(const name of [...finalBatches,'release','repair','pilot','pilot-listen'])assert(batches.includes(name),`Missing declared final/history batch ${name}`);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const identity=files=>sha(Buffer.from(JSON.stringify(Object.fromEntries(Object.entries(files).sort(([a],[b])=>a.localeCompare(b))))));
const changedPaths=(a,b)=>[...new Set([...Object.keys(a),...Object.keys(b)])].filter(path=>!isDeepStrictEqual(a[path],b[path])).sort();
const withoutFinalTest=source=>{const copy={...source};delete copy[testPath];return copy;};
async function exists(path){try{await stat(path);return true;}catch(error){if(error.code==='ENOENT')return false;throw error;}}
async function hashFile(path){const hash=createHash('sha256');for await(const block of createReadStream(path))hash.update(block);return hash.digest('hex');}
async function tree(dir){const files=[];for(const entry of await readdir(dir,{withFileTypes:true})){assert(!entry.isSymbolicLink());const path=dir+'/'+entry.name;if(entry.isDirectory())files.push(...await tree(path));else if(entry.isFile())files.push(path);}return files;}
assert(!await exists(out),'Use a fresh evidence publication directory; preserve earlier collector outputs explicitly');

// Reconstruct the exact historical trace-only patch from its retained original, not from the newest test.
const diagnostic=JSON.parse(await readFile(root+'/trace-diagnostic-change/result.json','utf8'));
assert.equal(diagnostic.commandsAssertionsAndTimeoutsUnchanged,true);assert.equal(diagnostic.gameRuntimeExactlyUnchanged,true);assert.equal(diagnostic.file,testPath);
const oldTraceTest=await readFile(root+'/trace-diagnostic-change/original-v4-final.spec.ts','utf8');assert.equal(sha(Buffer.from(oldTraceTest)),diagnostic.oldSha256);
const insertionOffsets=[0,...Array.from(oldTraceTest.matchAll(/\n/g),match=>match.index+1)].filter(offset=>sha(Buffer.from(oldTraceTest.slice(0,offset)+diagnostic.exactAddedBlock+oldTraceTest.slice(offset)))===diagnostic.newSha256);
assert.equal(insertionOffsets.length,1,'Historical trace-only patch cannot be reconstructed');
const traceEditProof={file:testPath,oldSha256:diagnostic.oldSha256,newSha256:diagnostic.newSha256,insertionOffset:insertionOffsets[0],scope:'Historical release-to-repair trace setting only; no equivalence to the final runtime is inferred.'};

// This is the sole permitted input difference within the final coverage cohort.
const memoryRepair=JSON.parse(await readFile(root+'/memory-test-repair/result.json','utf8'));
const oldMemoryTest=await readFile(root+'/memory-test-repair/original-v4-final.spec.ts','utf8');assert.equal(sha(Buffer.from(oldMemoryTest)),memoryRepair.beforeSha256);
assert.equal(oldMemoryTest.split(memoryRepair.old).length,2,'The local memory-export correction must have one exact site');
assert.equal(sha(Buffer.from(oldMemoryTest.replace(memoryRepair.old,memoryRepair.new))),memoryRepair.afterSha256,'Memory-export repair is not the exact declared replacement');
const memoryEditProof={file:testPath,beforeSha256:memoryRepair.beforeSha256,afterSha256:memoryRepair.afterSha256,old:memoryRepair.old,new:memoryRepair.new,scope:memoryRepair.scope};

// All terminal files are required before publication writes; missing/live handles are never treated as done.
const prepared=[];
for(const name of batches){
  const dir=root+'/'+name;
  const [terminal,before,after,report,start]=await Promise.all(['terminal','baseline','after','report','start'].map(async file=>JSON.parse(await readFile(`${dir}/${file}.json`,'utf8'))));
  assert.equal(terminal.token,start.token,`${name}: terminal/start identity mismatch`);
  const final=Object.hasOwn(finalContributions,name),sourceStable=isDeepStrictEqual(before.sourceHashes,after.sourceHashes),buildStable=isDeepStrictEqual(before.buildFiles,after.buildFiles);
  if(final){
    assert.equal(terminal.error,null,name);assert.equal(terminal.reportError,null,name);assert.deepEqual(terminal.changedInputs,[],name);assert.equal(report.stats.skipped,0,name);assert.equal(report.stats.flaky,0,name);assert.equal(report.errors?.length??0,0,name);assert(sourceStable,`${name}: source drift`);assert(buildStable,`${name}: runtime drift`);
    assert.equal(report.stats.expected,finalContributions[name],name);
    if(name==='final-boundaries'){assert.equal(terminal.exitCode,1);assert.equal(terminal.validationComplete,false);assert.equal(report.stats.unexpected,3);assert.equal(before.sourceHashes[testPath].sha256,memoryRepair.beforeSha256);}
    else{assert.equal(terminal.exitCode,0,name);assert.equal(terminal.validationComplete,true,name);assert.equal(report.stats.unexpected,0,name);assert.equal(before.sourceHashes[testPath].sha256,memoryRepair.afterSha256);}
  }
  prepared.push({name,dir,terminal,before,after,report,start,final,sourceStable,buildStable});
}
const finalIdentity=prepared.find(batch=>batch.name==='final-journeys').before;
assert.equal(Object.keys(finalIdentity.buildFiles).length,75,'The final cohort must bind the declared 75 runtime files');
for(const batch of prepared.filter(batch=>batch.final)){
  assert.deepEqual(withoutFinalTest(batch.before.sourceHashes),withoutFinalTest(finalIdentity.sourceHashes),`${batch.name}: unexpected final input differences`);
  assert.deepEqual(batch.before.buildFiles,finalIdentity.buildFiles,`${batch.name}: final runtimes differ`);
}
const current=await captureFingerprint(process.cwd(),finalIdentity.extraInputs??[]);
assert.deepEqual(current.sourceHashes,finalIdentity.sourceHashes,'Current source differs from final tested inputs');assert.deepEqual(current.buildFiles,finalIdentity.buildFiles,'Current runtime differs from final tested runtime');
const release=prepared.find(batch=>batch.name==='release'),repair=prepared.find(batch=>batch.name==='repair');
assert.equal(release.before.sourceHashes[testPath].sha256,diagnostic.oldSha256);assert.equal(repair.before.sourceHashes[testPath].sha256,diagnostic.newSha256);
assert.deepEqual(withoutFinalTest(release.before.sourceHashes),withoutFinalTest(repair.before.sourceHashes),'Historical trace-only repair changed other inputs');assert.deepEqual(release.before.buildFiles,repair.before.buildFiles,'Historical trace-only repair changed runtime');
traceEditProof.originalAndRepairRuntimeMatch=true;

const coverage=[],historicalCases=[],batchHistory=[],actualStates=[],collections=[],negativeCollections=[],storageRecords=[],originals=[],screens=[],diagnosticCases=[],unparseableEvidence=[],copyJobs=[];
const queue=(src,dst)=>copyJobs.push({src,dst});
for(const batch of prepared){
  const {name,dir,terminal,before,after,report,final,sourceStable,buildStable}=batch,rows=[];
  function suites(nodes,file=''){
    for(const suite of nodes){
      const currentFile=suite.file??file;
      for(const spec of suite.specs??[])for(const test of spec.tests){
        const results=test.results??[],passed=results.length===1&&results[0].status==='passed';
        const row={key:[test.projectName,spec.file??currentFile,spec.title].join('|'),project:test.projectName,file:spec.file??currentFile,title:spec.title,batch:name,status:results[0]?.status??'not-run',attempts:results.length,durationMs:results.reduce((sum,result)=>sum+(result.duration??0),0)};rows.push(row);
        if(final){
          assert.equal(results.length,1,`${name}: final cases must have one actual attempt`);
          if(passed){assert.equal(name==='final-memory',spec.title===memoryCaseTitle,`${name}: wrong final case selection`);coverage.push({...row,evidenceRole:'final-release-coverage'});}
          else{assert.equal(name,'final-boundaries');assert.equal(spec.title,memoryCaseTitle);diagnosticCases.push({...row,evidenceRole:'final-runtime-failed-case',coverageContribution:0,errors:results.flatMap(result=>result.errors??[])});}
        }else{const item={...row,evidenceRole:'historical-diagnostic',coverageContribution:0,errors:results.flatMap(result=>result.errors??[])};historicalCases.push(item);if(!passed)diagnosticCases.push(item);}
      }
      suites(suite.suites??[],currentFile);
    }
  }
  suites(report.suites);
  if(final){assert.equal(rows.filter(row=>row.status==='passed').length,finalContributions[name],name);assert.equal(rows.length,name==='final-memory'?3:12,name);}
  const evidenceRole=final?'final-runtime':'historical-diagnostic';
  batchHistory.push({batch:name,evidenceRole,coverageContribution:final?finalContributions[name]:0,terminalValidationComplete:terminal.validationComplete,exitCode:terminal.exitCode,stats:report.stats,sourceStableWithinBatch:sourceStable,buildStableWithinBatch:buildStable,sourceIdentity:identity(before.sourceHashes),buildIdentity:identity(before.buildFiles),sourceMatchesFinal:isDeepStrictEqual(before.sourceHashes,finalIdentity.sourceHashes),runtimeMatchesFinal:isDeepStrictEqual(before.buildFiles,finalIdentity.buildFiles),sourceDifferencesFromFinal:changedPaths(before.sourceHashes,finalIdentity.sourceHashes),runtimeDifferencesFromFinal:changedPaths(before.buildFiles,finalIdentity.buildFiles)});
  for(const file of ['terminal.json','baseline.json','after.json','report.json','start.json','console.log'])queue(dir+'/'+file,out+'/batches/'+name+'/'+file);
  for(const file of await tree(dir)){
    const size=(await stat(file)).size;originals.push({path:file,batch:name,evidenceRole,bytes:size,sha256:await hashFile(file)});
    if(!file.includes('/evidence/'))continue;
    if(file.endsWith('.json')){
      const bytes=await readFile(file);let value;
      try{value=JSON.parse(bytes.toString('utf8'));}catch(error){assert(!final,'Unparseable JSON in final runtime evidence');unparseableEvidence.push({path:file,batch:name,bytes:bytes.length,sha256:sha(bytes),error:String(error),scope:'Historical incomplete evidence, not an accepted run object or final coverage.'});queue(file,out+'/diagnostics/incomplete-evidence/'+name+'/'+relative(dir+'/evidence',file));continue;}
      if(value?.rulesVersion==='forge-v4'&&Array.isArray(value.journal)){
        const checked=sdk.validateRun(value);assert(checked.ok,file);assert.deepEqual(checked.state,value,file);
        actualStates.push({path:file,batch:name,evidenceRole,sha256:sha(bytes),normalizedStateSha256:sha(Buffer.from(JSON.stringify(checked.state))),phase:value.phase,day:value.day,revision:value.revision,mode:value.mode,sampleScope:file.endsWith('/explicit-memory-ending-export.json')?'explicit-restored-memory-ending-export':file.endsWith('/explicit-memory-challenge-opening.json')?'explicit-memory-challenge-opening':'recorded-run-state'});queue(file,out+'/objects/'+name+'/'+relative(dir+'/evidence',file));
      }else if(file.endsWith('-collection-envelope.json')){
        const checked=sdk.decodeCollection(bytes.toString('utf8'));
        if(checked.status==='valid')collections.push({path:file,batch:name,evidenceRole,sha256:sha(bytes),works:checked.state.works.length,chapters:checked.state.chapters,challenge:checked.state.challenge});
        else{assert(file.includes('future-collection-restored-boundary'));assert.equal(value.schemaVersion,999);negativeCollections.push({path:file,batch:name,evidenceRole,sha256:sha(bytes),status:checked.status,expectedSchema:999});}
        queue(file,out+'/objects/'+name+'/'+relative(dir+'/evidence',file));
      }else if(file.endsWith('/explicit-memory-ending-preserved-storage.json')){
        assert.equal(typeof value.run,'string');assert.equal(value.profile,null);const stored=sdk.decodeV4Save(value.run);assert.equal(stored.status,'valid',file);
        storageRecords.push({path:file,batch:name,evidenceRole,sha256:sha(bytes),storedRunPhase:stored.state.phase,profileIsNull:true,scope:'Observed persistent storage while viewing an explicitly restored ending in memory; this record is not a RunState or collection envelope.'});queue(file,out+'/objects/'+name+'/'+relative(dir+'/evidence',file));
      }
    }
    if(final&&file.endsWith('.png')&&file.includes('/v4-chromium/')&&(/(?:complete|return|defeat)-(?:1280|1920)\.png$/.test(file)||file.endsWith('/real-final-work.png')||file.endsWith('/mixed-return-final-real-outcome.png')))screens.push(file);
  }
}
coverage.sort((a,b)=>a.key.localeCompare(b.key));assert.equal(coverage.length,24);assert.equal(new Set(coverage.map(row=>row.key)).size,24,'Final logical cases must not be duplicated');
for(const project of projects){
  const cases=coverage.filter(row=>row.project===project);assert.equal(cases.length,8,project);assert.equal(cases.filter(row=>basename(row.file)==='v4-final.spec.ts').length,5,project);assert.equal(cases.filter(row=>basename(row.file)==='v4-final-visual.spec.ts').length,1,project);assert.equal(cases.filter(row=>basename(row.file)==='v4-second-saves.spec.ts').length,2,project);assert(cases.some(row=>row.title.startsWith('a saved first-chapter')),project);assert(cases.some(row=>row.title.startsWith('an external day-nine')),project);
  assert(actualStates.some(row=>row.batch==='final-memory'&&row.path.includes('/'+project+'/')&&row.sampleScope==='explicit-restored-memory-ending-export'),`${project}: repaired memory ending export missing`);assert(storageRecords.some(row=>row.batch==='final-memory'&&row.path.includes('/'+project+'/')),`${project}: repaired preserved-storage observation missing`);
}
assert.equal(new Set(screens.map(file=>basename(file))).size,screens.length,'Final screenshot basenames collide');for(const file of screens)queue(file,out+'/screens/'+basename(file));

const requiredValidation=['preserved-inputs-final.json','memory-test-repair/typecheck-observation.json','initial-verification.json','preserved-inputs.json','unit-initial-red.txt','unit-journey-recheck.txt','unit-listen.json','quality-final/result.json','quality-final/before.json','quality-final/after.json','quality-final/unit.json','quality-final/unit-terminal.json','quality-final/build-terminal.json','quality-final/unit.log','quality-final/build.log','quality-release/result.json','quality-release/before.json','quality-release/after.json','quality-release/unit.json','quality-release/unit-terminal.json','quality-release/build-terminal.json','quality-release/unit.log','quality-release/build.log','quality-final-memory/result.json','quality-final-memory/before.json','quality-final-memory/after.json','quality-final-memory/unit.json','quality-final-memory/unit-terminal.json','quality-final-memory/build-terminal.json','quality-final-memory/unit.log','quality-final-memory/build.log','build-equivalence-final.json','art-freeze-verified.json','trace-diagnostic-change/result.json','trace-diagnostic-change/original-v4-final.spec.ts','memory-test-repair/result.json','memory-test-repair/original-v4-final.spec.ts','release/interruption-reason.json','before-listen/index.json','before-modal-scroll/identity.json','qa-git-archive/recovery-map.json','qa-git-archive/inventory.json','qa-git-archive/cleanup-receipt.json','qa-git-archive/verification.log','qa-git-archive/restore.mjs','qa-git-archive/clear-verified.mjs'];
for(const file of requiredValidation){assert(await exists(root+'/'+file),`Missing retained verification ${file}`);queue(root+'/'+file,out+'/validation/'+file);}
for(const file of ['runner.mjs','quality.mjs','quality-release.mjs','quality-final-memory.mjs','collect.mjs','collect-before-final-coverage.mjs']){assert(await exists(root+'/'+file),file);queue(root+'/'+file,out+'/tools/'+file);}

// Preflight, replay and identities pass before any evidence publication is written.
await mkdir(out,{recursive:false});
async function copy(src,dst){const bytes=await readFile(src);await mkdir(dst.slice(0,dst.lastIndexOf('/')),{recursive:true});if(dst.endsWith('.log')){dst+='.gz';await writeFile(dst,gzipSync(bytes));assert.equal(sha(gunzipSync(await readFile(dst))),sha(bytes));}else{await copyFile(src,dst);assert.equal(sha(await readFile(dst)),sha(bytes));}}
for(const job of copyJobs)await copy(job.src,job.dst);
const afterCollection=await captureFingerprint(process.cwd(),finalIdentity.extraInputs??[]);assert.deepEqual(afterCollection.sourceHashes,finalIdentity.sourceHashes,'Source changed during collection');assert.deepEqual(afterCollection.buildFiles,finalIdentity.buildFiles,'Runtime changed during collection');
await writeFile(out+'/case-coverage.json',JSON.stringify(coverage,null,2)+'\n');await writeFile(out+'/historical-case-results.json',JSON.stringify(historicalCases,null,2)+'\n');await writeFile(out+'/batch-identities.json',JSON.stringify({finalCoverageBatches:finalContributions,finalSourceIdentity:identity(finalIdentity.sourceHashes),finalRuntimeIdentity:identity(finalIdentity.buildFiles),traceEditProof,memoryEditProof,batches:batchHistory},null,2)+'\n');
await writeFile(out+'/local-formal-originals.json',JSON.stringify({scope:'Every file in explicit final and historical browser batch directories. Earlier release/repair/pilot contribute zero final coverage; raw local originals remain at their indexed paths.',files:originals},null,2)+'\n');
const finalStates=actualStates.filter(row=>row.evidenceRole==='final-runtime'),finalCollections=collections.filter(row=>row.evidenceRole==='final-runtime');
const summary={at:new Date().toISOString(),batches,finalCoverageBatches:finalContributions,historicalBatches:batches.filter(name=>!finalBatches.includes(name)),logicalCases:coverage.length,projects:projects.length,casesPerProject:8,sourceFiles:Object.keys(finalIdentity.sourceHashes).length,buildFiles:Object.keys(finalIdentity.buildFiles).length,finalSourceIdentity:identity(finalIdentity.sourceHashes),finalRuntimeIdentity:identity(finalIdentity.buildFiles),actualRunObjects:actualStates.length,finalRunObjects:finalStates.length,historicalRunObjects:actualStates.length-finalStates.length,uniqueRunStates:new Set(actualStates.map(row=>row.normalizedStateSha256)).size,actualCollectionEnvelopes:collections.length,finalCollectionEnvelopes:finalCollections.length,declaredFutureEnvelopes:negativeCollections.length,memoryStorageObservationObjects:storageRecords.length,finalMemoryEndingExports:finalStates.filter(row=>row.sampleScope==='explicit-restored-memory-ending-export').length,screens:screens.length,diagnosticCases:diagnosticCases.length,unparseableEvidenceFiles:unparseableEvidence.length,scope:'Twenty-four logical cases are covered by nine genuinely passing boundary cases, three repaired memory/boundary cases and twelve journey cases on the same 75 runtime files. The sole final input difference is the exact reconstructed test-only direct-download correction. This is not a single all-green twenty-four-case batch: the original three memory test failures remain diagnostic. Older release/repair/pilot batches retain their own input/runtime hashes and red/green history, contribute zero final coverage, and may use another runtime. Restored memory endings, visual fixtures, memory openings and early failures are not additional full twelve-day UI runs. All recorded run objects replay through the current SDK; collection envelopes are validated, while preserved-storage observations are separate records.'};
await writeFile(out+'/replay.json',JSON.stringify({summary,actualStates,collections,negativeCollections,storageRecords,diagnosticCases,unparseableEvidence},null,2)+'\n');console.log(JSON.stringify(summary));
