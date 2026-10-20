// Collection only, after both formal processes have actually completed. No full third model replay.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {readFile,writeFile,mkdir,copyFile,stat,lstat,readdir,open,rename} from 'node:fs/promises';
import {constants} from 'node:fs';
import {dirname,resolve,relative,join,isAbsolute} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createGunzip} from 'node:zlib';

const SELF=fileURLToPath(import.meta.url),TASK='tmp/T11-4-2-3i6',DEFAULT_OUT='docs/evidence/T11-4-2-3i6-model';
const FORMAL_CASES=30_000,SEEDS=1000,MAX_RECORDS_GZIP=90*1024*1024;
const EXTRA=['v3.html','legacy.html','goal-1/input.md','docs/v0.7-balance-validation-contract.md','docs/v0.7-balance-profiles.json','docs/evidence/v07-approval/approved-proposal.md','docs/evidence/T11-4-2-3i1/witness-fixed/complete.json'];
const SDK_FILES=['sword-led-v4.js','core-CvAZnNjA.js','browser-session-BQdQqpuu.js','rules-CAo3EZyg.js'];
const sha=value=>createHash('sha256').update(typeof value==='string'||value instanceof Uint8Array?value:JSON.stringify(value)).digest('hex');
const json=async path=>JSON.parse(await readFile(path,'utf8'));
function args(values){
 if(!values.length){const root=resolve(dirname(SELF),'../..');return{root,out:resolve(root,DEFAULT_OUT)};}
 assert.equal(values.length,4,'Use no arguments, or --root <checkout> --out <fresh evidence directory>');const found=new Map();
 for(let i=0;i<values.length;i+=2){const k=values[i],v=values[i+1];assert(['--root','--out'].includes(k)&&v&&!v.startsWith('--')&&!found.has(k),'Unknown, duplicate or missing argument');found.set(k,v);}
 assert(found.has('--root')&&found.has('--out'));const root=resolve(found.get('--root'));return{root,out:resolve(root,found.get('--out'))};
}
const {root,out}=args(process.argv.slice(2));
const inside=(base,path)=>{const result=resolve(base,path),rel=relative(base,result);assert(rel&&!rel.startsWith('..')&&!isAbsolute(rel),'A path escaped its designated root');return result;};
const source=path=>inside(root,path);
const output=path=>inside(out,path);
assert.notEqual(root,out);assert(!relative(root,out).startsWith('..'),'Evidence output must be inside the selected checkout');
await lstat(out).then(()=>{throw Error('Evidence output already exists; collection never overwrites it');},e=>{if(e.code!=='ENOENT')throw e;});
assert((await stat(dirname(out))).isDirectory(),'Evidence output parent must exist');

async function fileHash(path){const digest=createHash('sha256');let bytes=0;const info=await lstat(path);assert(info.isFile()&&!info.isSymbolicLink(),`Expected an ordinary file: ${path}`);for await(const chunk of createReadStream(path)){digest.update(chunk);bytes+=chunk.length;}assert.equal(bytes,info.size);return{sha256:digest.digest('hex'),bytes};}
const collectorInitialHash=await fileHash(SELF);
async function* lines(path){
 const raw=createReadStream(path),unzip=createGunzip();raw.on('error',e=>unzip.destroy(e));raw.pipe(unzip);let pending='',bytes=0,last=null;const digest=createHash('sha256'),decoder=new TextDecoder('utf-8',{fatal:true});
 try{for await(const chunk of unzip){bytes+=chunk.length;assert(bytes<=4_000_000_000,'Evidence stream exceeds its bounded format');digest.update(chunk);last=chunk.at(-1);pending+=decoder.decode(chunk,{stream:true});let newline;
  while((newline=pending.indexOf('\n'))>=0){const line=pending.slice(0,newline);pending=pending.slice(newline+1);assert(line.length&&!line.endsWith('\r')&&Buffer.byteLength(line)<=1_000_000,'Invalid JSONL line');yield{line,value:JSON.parse(line)};}
  assert(Buffer.byteLength(pending)<=1_000_000,'Excessive unterminated JSONL record');
 }pending+=decoder.decode();assert.equal(last,10,'JSONL needs a terminal newline');assert.equal(pending,'');return{sha256:digest.digest('hex'),bytes};}finally{raw.destroy();unzip.destroy();}
}
async function readSmallStream(path){const result=[],iterator=lines(path);let digest;while(true){const n=await iterator.next();if(n.done){digest=n.value;break;}result.push(n.value);assert(result.length<=60,'Preflight evidence exceeds its declared 60 cases');}assert.equal(result.length,60);return{result,digest};}

// All imports and physical checks bind to the chosen original checkout, never to an archive's flattened filenames.
const {captureFingerprint,changedInputs}=await import(pathToFileURL(source('scripts/release-fingerprint.mjs')).href);
const {auditRecord,IDS}=await import(pathToFileURL(source('scripts/audit-v4-model.mjs')).href);
const api=await import(pathToFileURL(source('dist/sword-led-v4.js')).href);
const startedAt=new Date().toISOString();
const main=source(`${TASK}/formal`),pre=source(`${TASK}/preflight`);

async function processEvidence(kind,count,token){
 const base=`${TASK}/${kind}-process`,start=await json(source(`${base}/start.json`)),terminal=await json(source(`${base}/terminal.json`));
 assert.equal(start.kind,kind);assert.equal(terminal.kind,kind);assert.equal(start.token,token);assert.equal(terminal.token,token);assert.equal(terminal.validationComplete,true);assert.equal(terminal.exitCode,0);assert.equal(terminal.signal,null);assert.equal(terminal.error,null);assert.equal(terminal.resultError,null);assert.equal(terminal.cases,count);assert.equal(terminal.replayCount,count);assert.deepEqual(terminal.changedInputs,[]);
 assert.equal(start.pid,terminal.pid);assert.equal(start.childPid,terminal.childPid);assert(Number.isSafeInteger(start.pid)&&start.pid>0&&Number.isSafeInteger(start.childPid)&&start.childPid>0);assert.equal(start.startedAt,terminal.startedAt);assert(Number.isFinite(Date.parse(terminal.finishedAt))&&Date.parse(terminal.finishedAt)>=Date.parse(start.startedAt));
 const module=kind.endsWith('audit')?'scripts/audit-v4-model.mjs':'scripts/v4-model.mjs';assert.equal(start.command[1],module);
 assert.equal(start.wrapperSha256,(await fileHash(source(`${TASK}/run-process.mjs`))).sha256,'Process wrapper differs from the actual recorded source');
 const before=await json(source(`${base}/before.json`)),after=await json(source(`${base}/after.json`));assert.deepEqual(changedInputs(before,after),[],`${kind} process changed frozen inputs`);assert.deepEqual(before.extraInputs,EXTRA);assert.deepEqual(after.extraInputs,EXTRA);
 await stat(source(`${base}/console.log`));return{base,start,terminal,before,after};
}
const formal=await processEvidence('formal',FORMAL_CASES,'v4-balance-formal-01');
const formalAudit=await processEvidence('formal-audit',FORMAL_CASES,'v4-balance-formal-audit-01');
const preflight=await processEvidence('preflight',60,'v4-balance-preflight-01');
const preflightAudit=await processEvidence('preflight-audit',60,'v4-balance-preflight-audit-01');
assert.equal(formal.start.resultFile,`${TASK}/formal/summary.json`);assert.equal(formalAudit.start.resultFile,`${TASK}/formal-audit.json`);assert.equal(preflight.start.resultFile,`${TASK}/preflight/summary.json`);assert.equal(preflightAudit.start.resultFile,`${TASK}/preflight-audit.json`);
const baseline=await json(join(main,'baseline.json')),after=await json(join(main,'after.json')),summary=await json(join(main,'summary.json')),audit=await json(source(formalAudit.start.resultFile));
const preBaseline=await json(join(pre,'baseline.json')),preAfter=await json(join(pre,'after.json')),preSummary=await json(join(pre,'summary.json')),preAudit=await json(source(preflightAudit.start.resultFile));
for(const proof of [baseline,after,formal.before,formal.after,formalAudit.before,formalAudit.after,preBaseline,preAfter,preflight.before,preflight.after,preflightAudit.before,preflightAudit.after]){assert.deepEqual(proof.extraInputs,EXTRA);assert.deepEqual(changedInputs(baseline,proof),[],'A frozen input fingerprint differs across production, audit or preflight');}
const physicalBefore=await captureFingerprint(root,EXTRA);assert.deepEqual(changedInputs(baseline,physicalBefore),[],'Physical source/build already changed; collect before any UI edit');
const sdkGraph={},sdkVisited=new Set();
async function scanSdk(name){
 if(sdkVisited.has(name))return;sdkVisited.add(name);assert(SDK_FILES.includes(name),'Unexpected local module in the frozen v4 SDK closure');
 const text=await readFile(source(`dist/${name}`),'utf8'),specifiers=[...text.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)['"](\.[^'"]+)['"]/g)].map(m=>m[1]);
 assert(!/\bimport\s*\(\s*[^'"\s]/.test(text),'A nonliteral dynamic import needs explicit closure review');
 const dependencies=[];for(const specifier of specifiers){assert(specifier.endsWith('.js'),'A local SDK import is not plain JavaScript');const target=resolve(dirname(source(`dist/${name}`)),specifier);assert.equal(dirname(target),source('dist'));const dependency=relative(source('dist'),target);assert(SDK_FILES.includes(dependency),'SDK dependency is absent from the actual four-file model closure');dependencies.push(dependency);await scanSdk(dependency);}
 sdkGraph[name]={imports:[...new Set(dependencies)],...await fileHash(source(`dist/${name}`))};assert.deepEqual({sha256:sdkGraph[name].sha256,bytes:sdkGraph[name].bytes},baseline.buildFiles[`dist/${name}`]);
}
await scanSdk('sword-led-v4.js');assert.deepEqual([...sdkVisited].sort(),[...SDK_FILES].sort(),'The archived module set is not the exact model SDK import/re-export closure');
for(const [s,a,n]of [[summary,audit,FORMAL_CASES],[preSummary,preAudit,60]]){
 assert.equal(s.schemaVersion,1);assert.equal(a.schemaVersion,1);assert.equal(s.rulesVersion,'forge-v4');assert.equal(a.rulesVersion,'forge-v4');assert.equal(s.seedPrefix,'v4-balance');assert.equal(a.seedPrefix,'v4-balance');assert.equal(s.cases,n);assert.equal(a.cases,n);assert.equal(s.seeds,n/IDS.length);assert.equal(a.seeds,s.seeds);assert.equal(s.producerReplayedFinalStates,n);assert.equal(a.producerReplayedFinalStates,n);assert.equal(a.independentReplayedFinalStates,n);assert.equal(a.mirrorComparisons,s.seeds*2);
 assert.deepEqual(s.profiles.map(p=>p.id),IDS);assert.deepEqual(s.statistics,a.statistics);assert.equal(s.rowsSha256,a.rowsSha256);assert.equal(s.uncompressedRecordsSha256,a.uncompressedRecordsSha256);assert.equal(s.baselineSha256,a.baselineSha256);
}
assert.equal(summary.baselineSha256,(await fileHash(join(main,'baseline.json'))).sha256);assert.equal(preSummary.baselineSha256,(await fileHash(join(pre,'baseline.json'))).sha256);
assert.equal((await stat(join(main,'records.jsonl.gz'))).size<=MAX_RECORDS_GZIP,true,'Formal records gzip exceeds 90 MiB: stop and ask the parent to review storage; no silent splitting');
for(const name of ['records.jsonl.gz.partial','rows.jsonl.gz.partial'])await lstat(join(main,name)).then(()=>{throw Error(`Unfinished formal output remains: ${name}`);},e=>{if(e.code!=='ENOENT')throw e;});

const metadata=await json(source('docs/v0.7-balance-profiles.json'));assert.deepEqual(summary.profiles,metadata);assert.deepEqual(preSummary.profiles,metadata);
const sourceCommit=await json(source(`${TASK}/model-source-commit.json`));assert.match(sourceCommit.commit,/^[a-f0-9]{40}$/);assert.equal(sourceCommit.actualPushExitCode,0);assert.equal(sourceCommit.freshRemoteMainObserved,sourceCommit.commit);assert.equal(sourceCommit.frozenSourceFiles,Object.keys(baseline.sourceHashes).length);assert.equal(sourceCommit.runtimeFiles,Object.keys(baseline.buildFiles).length);assert.equal(sourceCommit.files.length,sourceCommit.frozenSourceFiles);
const commitPaths=new Set();for(const f of sourceCommit.files){assert(!commitPaths.has(f.path));commitPaths.add(f.path);assert.deepEqual({sha256:f.sha256,bytes:f.bytes},baseline.sourceHashes[f.path]);assert.match(f.gitBlob,/^[a-f0-9]{40}$/);}assert.deepEqual([...commitPaths].sort(),Object.keys(baseline.sourceHashes).sort());

const frozenIndex=await json(source(`${TASK}/frozen-tools/index.json`));assert.equal(frozenIndex.formalToken,'v4-balance-formal-01');assert.equal(frozenIndex.files.length,10);const frozenPaths=new Set();
for(const f of frozenIndex.files){assert(!frozenPaths.has(f.path));frozenPaths.add(f.path);assert.deepEqual({sha256:f.sha256,bytes:f.bytes},baseline.sourceHashes[f.path]);assert.deepEqual(await fileHash(source(f.copy)),{sha256:f.sha256,bytes:f.bytes});assert.equal(f.copy,`${TASK}/frozen-tools/${f.path.replaceAll('/','__')}`);}
assert.deepEqual([...frozenPaths].sort(),['scripts/v4-model-policy.mjs','scripts/v4-model-metrics.mjs','scripts/v4-model.mjs','scripts/audit-v4-model.mjs','tests/model/v4-model.test.mjs','tests/model/v4-policy.test.mjs','tests/model/v4-metrics.test.mjs','tests/model/v4-audit.test.mjs','docs/v0.7-balance-profiles.json','docs/v0.7-balance-validation-contract.md'].sort());
const nodeTap=await readFile(source(`${TASK}/node-unit-final.log`),'utf8');assert(/(?:^|\n)1\.\.18\n# tests 18\n# suites 0\n# pass 18\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms [\d.]+\s*$/.test(nodeTap),'The archived helper TAP does not end in its successful 18-test summary');
const auditObservation=await json(source(`${TASK}/audit-node-unit-final-observed-receipt.json`));assert.equal(auditObservation.kind,'observed-tool-terminal-receipt');assert.equal(auditObservation.observedExitCode,0);assert.equal(auditObservation.tests,8);assert.equal(auditObservation.pass,8);assert.equal(auditObservation.fail,0);assert.equal(auditObservation.rawTapFile,null);assert.equal(auditObservation.toolSessionId,54356);

const pRecords=await readSmallStream(join(pre,'records.jsonl.gz')),pRows=await readSmallStream(join(pre,'rows.jsonl.gz'));assert.equal(pRecords.digest.sha256,preSummary.uncompressedRecordsSha256);assert.equal(pRows.digest.sha256,preSummary.rowsSha256);
const key=(profile,index)=>`${profile}/${index}`,preRecords=new Map(),preRows=new Map();
for(let n=0;n<60;n++){const r=pRecords.result[n],v=pRows.result[n],profile=IDS[Math.floor(n/2)],index=n%2;assert.equal(r.value.profile,profile);assert.equal(r.value.index,index);assert.equal(v.value.profile,profile);assert.equal(v.value.index,index);assert.deepEqual(r.value.row,v.value);preRecords.set(key(profile,index),r);preRows.set(key(profile,index),v);}

// Reconstruct the complete expected taxonomy independently; deleting a report key must not hide missing content.
const traitIds=['steady','ember','inherit','echo','crackedEdge','pardon'],modificationIds=['windbox','warmRack','wideMouth'],eventIds=['donation','loan','salvage','credit','shelter','rest'],recipeIds=['light','guard','heavy'],endingIds=['victory','return','defeat'];
assert(Array.isArray(api.COMMISSIONS)&&api.COMMISSIONS.length===12);assert.deepEqual(api.COMMISSIONS.map(c=>c.id),Array.from({length:12},(_,i)=>i+1));
const routeFeatures=api.COMMISSIONS.flatMap(c=>{assert(Array.isArray(c.routes)&&c.routes.length>0);assert.equal(new Set(c.routes.map(r=>r.id)).size,c.routes.length);return c.routes.map(r=>{assert(typeof r.id==='string'&&r.id.length>0);return`route:${c.id}:${r.id}`;});});
const expectedFeatures=[...endingIds.map(id=>`ending:${id}`),...recipeIds.map(id=>`recipe:${id}:forged`),...routeFeatures,...traitIds.map(id=>`trait:${id}:equipped`),...modificationIds.map(id=>`modification:${id}:equipped`),...[...traitIds,...modificationIds,'loan','credit','shelter'].map(id=>`trigger:${id}`),...eventIds.map(id=>`event:${id}:accepted`),...eventIds.filter(id=>id!=='rest').map(id=>`event:${id}:consumed`),'inherit:consumed','reserve:crossed','failure:after-chapter','challenge:reordered'];
assert.equal(new Set(expectedFeatures).size,expectedFeatures.length);assert.equal(expectedFeatures.length,57);
function checkCoverage(report,cases){
 assert(report.witnesses&&report.contentCoverage&&Array.isArray(report.missingFeatures));assert.deepEqual(Object.keys(report.contentCoverage).sort(),[...expectedFeatures].sort(),'Coverage omitted or invented a required feature');
 assert.equal(new Set(report.missingFeatures).size,report.missingFeatures.length,'Missing-feature labels must be unique');
 const zeros=[],positive=[];for(const feature of expectedFeatures){const count=report.contentCoverage[feature];assert(Number.isSafeInteger(count)&&count>=0&&count<=cases,'Coverage count is outside the actual dataset');if(count===0)zeros.push(feature);else positive.push(feature);}
 assert.deepEqual([...report.missingFeatures].sort(),zeros.sort(),'Missing features must be exactly the complete zero-count set');assert.deepEqual(Object.keys(report.witnesses).sort(),positive.sort(),'Every and only observed feature requires a witness');
 assert.deepEqual(report.exemptCoverage,{'event:rest:consumed':'Rest preserves existing resources; it has no consumable benefit.'});
}
checkCoverage(audit,FORMAL_CASES);checkCoverage(preAudit,60);
const wanted=new Map(),featureMap={};
for(const [feature,identity]of Object.entries(audit.witnesses)){
 assert(audit.contentCoverage[feature]>0);assert(!audit.missingFeatures.includes(feature));assert(IDS.includes(identity.profile)&&Number.isInteger(identity.index)&&identity.index>=0&&identity.index<SEEDS);assert.equal(identity.seed,`v4-balance-${String(identity.index).padStart(4,'0')}`);assert.match(identity.stateSha256,/^[a-f0-9]{64}$/);
 const id=key(identity.profile,identity.index);if(!wanted.has(id))wanted.set(id,{identity,features:[]});assert.deepEqual(wanted.get(id).identity,identity);wanted.get(id).features.push(feature);featureMap[feature]=id;
}

// The following two scans verify byte identity and pick witnesses; they do not replay the other 30,000 journals.
let recordCount=0,overlapRecords=0;const selected=new Map(),embeddedRows=createHash('sha256'),recordIterator=lines(join(main,'records.jsonl.gz'));let recordsDigest;
while(true){const next=await recordIterator.next();if(next.done){recordsDigest=next.value;break;}const {value:r,line}=next.value,profile=IDS[Math.floor(recordCount/SEEDS)],index=recordCount%SEEDS;assert(recordCount<FORMAL_CASES);assert.equal(r.profile,profile);assert.equal(r.index,index);assert.equal(r.seed,`v4-balance-${String(index).padStart(4,'0')}`);assert.equal(r.row.stateSha256,r.stateSha256);embeddedRows.update(JSON.stringify(r.row)+'\n');
 if(index<2){const p=preRecords.get(key(profile,index));assert.deepEqual(r,p.value,'Formal first two complete records differ from the frozen preflight');assert.equal(line,p.line,'Formal/preflight complete-record bytes differ');overlapRecords++;}
 if(wanted.has(key(profile,index))){const expected=wanted.get(key(profile,index)).identity;assert.deepEqual({profile,index,seed:r.seed,phase:r.state.phase,stateSha256:r.stateSha256,commands:r.state.revision},expected);selected.set(key(profile,index),{record:r,lineSha256:sha(line+'\n')});}
 recordCount++;
}
assert.equal(recordCount,FORMAL_CASES);assert.equal(overlapRecords,60);assert.equal(recordsDigest.sha256,summary.uncompressedRecordsSha256);assert.equal(embeddedRows.digest('hex'),summary.rowsSha256);assert.equal(selected.size,wanted.size);
let rowCount=0,overlapRows=0;const rowIterator=lines(join(main,'rows.jsonl.gz'));let rowsDigest;
while(true){const next=await rowIterator.next();if(next.done){rowsDigest=next.value;break;}const {value:r,line}=next.value,profile=IDS[Math.floor(rowCount/SEEDS)],index=rowCount%SEEDS;assert(rowCount<FORMAL_CASES);assert.equal(r.profile,profile);assert.equal(r.index,index);if(index<2){const p=preRows.get(key(profile,index));assert.deepEqual(r,p.value,'Formal first two rows differ from preflight');assert.equal(line,p.line);overlapRows++;}rowCount++;}
assert.equal(rowCount,FORMAL_CASES);assert.equal(overlapRows,60);assert.equal(rowsDigest.sha256,summary.rowsSha256);

const checkedWitnesses=[];for(const [id,pick]of selected){
 const {record}=pick,validated=api.validateRun(record.state);assert(validated.ok,validated.detail);assert.deepEqual(validated.state,record.state);assert.equal(sha(record.state),record.stateSha256);
 const checked=auditRecord(record,{profile:record.profile,index:record.index,prefix:'v4-balance',qualification:audit.qualification.eligibility});assert.deepEqual(checked.row,record.row);
 for(const feature of wanted.get(id).features)assert(checked.features.includes(feature),`The selected journal does not exhibit ${feature}`);
 checkedWitnesses.push({id,identity:wanted.get(id).identity,features:wanted.get(id).features,checkedFeatures:checked.features,statePath:`witnesses/${record.profile}--${String(record.index).padStart(4,'0')}.json`,input:record.input,row:record.row,recordLineSha256:pick.lineSha256,state:record.state});
}
assert(checkedWitnesses.length>0);assert.equal(checkedWitnesses.length,wanted.size);
for(const phase of ['victory','return','defeat']){
 const original=summary.witnesses[phase],identity=audit.witnesses[`ending:${phase}`];if(!identity){assert.equal(original,undefined);continue;}
 assert.deepEqual(original,{...identity,path:`witness-${phase}.json`});const record=selected.get(key(identity.profile,identity.index)).record;assert.deepEqual(await json(join(main,original.path)),record.state,'Original canonical ending witness differs from the selected validated journal');
}
for(const phase of ['victory','return','defeat']){
 const original=preSummary.witnesses[phase],identity=preAudit.witnesses[`ending:${phase}`];if(!identity){assert.equal(original,undefined);continue;}
 assert.deepEqual(original,{...identity,path:`witness-${phase}.json`});assert.deepEqual(await json(join(pre,original.path)),preRecords.get(key(identity.profile,identity.index)).value.state,'Preflight witness differs from its full original record');
}

// Artifact creation begins only after the terminal, physical-input, complete-stream and selected-witness gates.
await mkdir(out,{recursive:false});const copies=[],generated=[];
async function copy(original,destination,role){const from=source(original),to=output(destination),beforeHash=await fileHash(from);await mkdir(dirname(to),{recursive:true});await copyFile(from,to,constants.COPYFILE_EXCL);const copied=await fileHash(to),afterHash=await fileHash(from);assert.deepEqual(copied,beforeHash);assert.deepEqual(afterHash,beforeHash);copies.push({original,destination,role,source:beforeHash,copy:copied});}
async function copyCollector(){const to=output('tools/collect-model.mjs');assert.deepEqual(await fileHash(SELF),collectorInitialHash,'Collector changed after startup');await mkdir(dirname(to),{recursive:true});await copyFile(SELF,to,constants.COPYFILE_EXCL);const copied=await fileHash(to);assert.deepEqual(copied,collectorInitialHash);copies.push({original:SELF,logicalExecutionPath:`${TASK}/collect-model.mjs`,destination:'tools/collect-model.mjs',role:'The collector module actually executing; an archived copy needs explicit --root/--out when outside its original tmp path',source:collectorInitialHash,copy:copied});}
async function generate(path,value,role){const to=output(path),bytes=typeof value==='string'?value:JSON.stringify(value,null,2)+'\n';await mkdir(dirname(to),{recursive:true});await writeFile(to,bytes,{flag:'wx'});generated.push({path,role,...await fileHash(to)});}
try{
 for(const name of ['records.jsonl.gz','rows.jsonl.gz','summary.json','baseline.json','after.json'])await copy(`${TASK}/formal/${name}`,`formal/${name}`,'Original complete formal data and frozen identities');
 for(const phase of ['victory','return','defeat'])if(summary.witnesses[phase])await copy(`${TASK}/formal/${summary.witnesses[phase].path}`,`formal/${summary.witnesses[phase].path}`,'Original producer canonical ending witness');
 await copy(formalAudit.start.resultFile,'formal-audit.json','Original independent full-30000 audit');
 for(const name of ['records.jsonl.gz','rows.jsonl.gz','summary.json','baseline.json','after.json'])await copy(`${TASK}/preflight/${name}`,`preflight/${name}`,'Original 60-case frozen formal-input preflight');
 for(const phase of ['victory','return','defeat'])if(preSummary.witnesses[phase])await copy(`${TASK}/preflight/${preSummary.witnesses[phase].path}`,`preflight/${preSummary.witnesses[phase].path}`,'Original preflight ending witness');
 await copy(preflightAudit.start.resultFile,'preflight-audit.json','Original independent 60-case preflight audit');
 for(const p of [formal,formalAudit,preflight,preflightAudit])for(const name of ['start.json','terminal.json','before.json','after.json','console.log'])await copy(`${p.base}/${name}`,`process/${p.terminal.kind}/${name}`,'Original raw process output or actual execution receipt');
 for(const [name,role]of [['model-source-commit.json','Recorded source commit, prior successful push observation and frozen Git blob map; not a fresh remote query'],['node-unit-final.log','Original 18-test producer, policy and metrics TAP'],['audit-node-unit-final-observed-receipt.json','Observed 8-test auditor terminal; explicitly not reconstructed raw TAP'],['cache-recovery-observation.json','Recorded cache-space recovery observation'],['continuation-checkpoint.json','Recorded continuation checkpoint, not a terminal proof']])await copy(`${TASK}/${name}`,`validation/${name}`,role);
 await copy(`${TASK}/run-process.mjs`,'tools/run-process.mjs','Original execution wrapper; its original module-relative location must be restored');
 await copy(`${TASK}/frozen-tools/index.json`,'frozen-tools/index.json','Original ten-file snapshot index');
 for(const f of frozenIndex.files){await copy(f.copy,`frozen-tools/${f.path.replaceAll('/','__')}`,'Original pre-edit frozen bytes with original logical path in index');await copy(f.copy,`reproduction/source/${f.path}`,'Same frozen bytes preserved at their logical repository paths for a restored checkout');}
 for(const path of ['scripts/release-fingerprint.mjs',...EXTRA.filter(p=>!frozenPaths.has(p))])await copy(path,`reproduction/source/${path}`,'Frozen runtime helper or original data/qualification/approved input');
 for(const name of SDK_FILES){const key=`dist/${name}`;assert(baseline.buildFiles[key]);await copy(key,`reproduction/runtime/${name}`,'Original actual v4 public SDK and its static module dependencies; not the full 75-file web build');assert.deepEqual(copies.at(-1).source,baseline.buildFiles[key]);}
 await copyCollector();await generate('reproduction/sdk-import-closure.json',{scope:'The exact four-file local import/re-export closure of the actual model v4 SDK; not the eight overall SDK files or the 75-file web build.',roots:['sword-led-v4.js'],modules:sdkGraph},'Static SDK dependency closure with preserved basenames and actual hashes');
 const witnessIndex=[];for(const entry of checkedWitnesses){const {state,...descriptor}=entry;await generate(entry.statePath,state,'Additional selected-witness SDK replay and independent auditRecord replay; not another full dataset replay');witnessIndex.push(descriptor);}
 await generate('witnesses/index.json',{scope:'The full independent audit chose each feature canonical earliest row. This collector verified only the deduplicated selected journals again.',selectionSource:'formal-audit.json#witnesses',additionalSdkWitnessReplays:checkedWitnesses.length,additionalIndependentWitnessReplays:checkedWitnesses.length,featureMap,witnesses:witnessIndex,contentCoverage:audit.contentCoverage,missingFeatures:audit.missingFeatures,exemptCoverage:audit.exemptCoverage},'Selected feature proof, canonical source identities, explicit zero coverage and exemption');
 await generate('preflight-comparison.json',{valid:true,scope:'First two seeds for each of 30 profiles compared as complete records and rows, both semantic fields and exact raw JSONL lines.',recordsCompared:overlapRecords,rowsCompared:overlapRows,formalRecords:recordsDigest,formalRows:rowsDigest,preflightRecords:pRecords.digest,preflightRows:pRows.digest},'Actual all-60 overlap comparison; no new model sample or third full replay');
 const physicalAfter=await captureFingerprint(root,EXTRA);assert.deepEqual(changedInputs(baseline,physicalAfter),[],'Physical source/build changed during collection');
 await generate('physical-collection-before.json',physicalBefore,'Actual complete physical input check before collection, before any UI edits');
 await generate('physical-collection-after.json',physicalAfter,'Actual complete physical input check after copying');
 const readme=`# forge-v4 model evidence\n\nThis archive contains the original complete 30,000-case production and the separate independent 30,000-case audit. The 60-case preflight is retained separately. Selected feature witnesses were replayed an additional ${checkedWitnesses.length} times by the SDK and ${checkedWitnesses.length} times by auditRecord; this is not a third complete 30,000-case replay. Missing coverage and the rest-event consumption exemption are retained without inventing witnesses.\n\n## Reproduction paths\n\nThe source execution identity is commit ${sourceCommit.commit}. Restore that complete commit into a separate checkout. The frozen source map is in validation/model-source-commit.json, and the full original source/build fingerprints are in formal/baseline.json. The ten original frozen files are in frozen-tools/ with their logical paths in its original index; reproduction/source/ repeats those bytes at their original repository paths and includes the fingerprint helper, qualification and approved inputs. The four actual v4 SDK dependency modules are in reproduction/runtime/. These four modules are not the complete 75-file web build. Restore or deterministically rebuild and verify the complete original dist and every frozen input before invoking the original audit, because its physical fingerprint check deliberately covers the complete source/build.\n\nArchive tools are evidence snapshots, not directly runnable from their renamed archive locations. Place source files at their original logical paths in the restored checkout, restore SDK modules under dist/, and run the original scripts from that checkout. For the collector snapshot, restore it to tmp/T11-4-2-3i6/collect-model.mjs or pass an explicit --root <restored checkout> --out <fresh directory>. Its relative defaults are valid only at the original tmp location. The process wrapper also originally ran at tmp/T11-4-2-3i6/run-process.mjs.\n\nOriginal commands and actual terminal receipts are in process/. For a new audit use node scripts/audit-v4-model.mjs --input <copied complete formal dataset> --out <fresh audit.json> --seeds 1000 --workers 6 from the restored checkout; audit output must not already exist. A new production experiment needs a new output path; do not overwrite this archive.\n\nThe original 18-test TAP is validation/node-unit-final.log. The separate auditor 8-test observation in validation/audit-node-unit-final-observed-receipt.json is explicitly not raw TAP. Publication of this artifact does not prove human enjoyment, final browser acceptance or whole-goal completion.\n`;
 const completionGate='Require collector exit 0, no COLLECTION-FAILED.json, a complete COMPLETED.json with validationComplete=true, matching manifest/index hashes, and every indexed file hash. Manifest or index alone never means success.';
 await generate('README.md',readme+'\n## Machine completion gate\n\n'+completionGate+' Both manifest.json and artifact-index.json deliberately retain validationComplete=false: only the final atomically published COMPLETED.json seals them. A .partial receipt, an absent receipt, any failed process exit, or COLLECTION-FAILED.json invalidates collection. The final receipt is written only after all copies, manifests, hashes and index are complete; its temporary file is synced and closed before atomic publication.\n','Reproduction instructions, exact evidence limits and mandatory machine completion gate');
 const manifest={schemaVersion:1,validationComplete:false,status:'awaiting-final-completion-receipt',completionGate,startedAt,finishedAt:new Date().toISOString(),root,out:relative(root,out),formalToken:formal.terminal.token,sourceCommit:sourceCommit.commit,scope:{producerTerminalReplays:FORMAL_CASES,independentTerminalReplays:FORMAL_CASES,additionalSdkWitnessReplays:checkedWitnesses.length,additionalIndependentWitnessReplays:checkedWitnesses.length,collectorFullThirdReplays:0,preflightCases:60,preflightIndependentReplays:60,overlapCompleteRecords:60,overlapRows:60},sourceInputs:Object.keys(baseline.sourceHashes).length,runtimeFiles:Object.keys(baseline.buildFiles).length,formalRecords:recordsDigest,formalRows:rowsDigest,contentCoverage:audit.contentCoverage,missingFeatures:audit.missingFeatures,exemptCoverage:audit.exemptCoverage,copies,generated,identityLimits:['The source commit receipt retains a prior push observation; this collector did not make a fresh remote query.','The selected-witness replays are additional checks of N representative journals, not a third full dataset replay.','The archived tools keep original bytes and logical paths but are not directly runnable under renamed archive paths.','The original auditor TAP exists only in tool history; its archived observation is not raw TAP.']};
 await writeFile(output('manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
 async function files(dir=''){const result=[];for(const e of (await readdir(join(out,dir),{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){assert(!e.isSymbolicLink());const path=dir?`${dir}/${e.name}`:e.name;if(e.isDirectory())result.push(...await files(path));else if(e.isFile())result.push({path,...await fileHash(output(path))});}return result;}
 const artifacts=await files();await writeFile(output('artifact-index.json'),JSON.stringify({schemaVersion:1,validationComplete:false,status:'awaiting-final-completion-receipt',completionGate,excludes:['artifact-index.json','COMPLETED.json','COMPLETED.json.partial','COLLECTION-FAILED.json'],files:artifacts},null,2)+'\n',{flag:'wx'});
 const completion={schemaVersion:1,validationComplete:true,status:'complete',completionGate,completedAt:new Date().toISOString(),formalToken:formal.terminal.token,sourceCommit:sourceCommit.commit,cases:FORMAL_CASES,independentReplays:FORMAL_CASES,additionalWitnessReplays:checkedWitnesses.length,files:artifacts.length+2,manifest:{path:'manifest.json',...await fileHash(output('manifest.json'))},artifactIndex:{path:'artifact-index.json',...await fileHash(output('artifact-index.json'))}};
 await lstat(output('COLLECTION-FAILED.json')).then(()=>{throw Error('A failure marker invalidates completion');},e=>{if(e.code!=='ENOENT')throw e;});
 await lstat(output('COMPLETED.json')).then(()=>{throw Error('A completion receipt already exists');},e=>{if(e.code!=='ENOENT')throw e;});
 const pending=await open(output('COMPLETED.json.partial'),'wx');try{await pending.writeFile(JSON.stringify(completion,null,2)+'\n');await pending.sync();}finally{await pending.close();}
 // Flush even the diagnostic output before the commit point. It explicitly does not claim completion.
 await new Promise((resolve,reject)=>process.stdout.write(JSON.stringify({complete:false,publicationPending:true,out:relative(root,out),completionReceipt:'COMPLETED.json',cases:FORMAL_CASES,additionalWitnessReplays:checkedWitnesses.length})+'\n',error=>error?reject(error):resolve()));
 // Last fallible success-path operation: readers only see a whole synced receipt, never a partial JSON file.
 await rename(output('COMPLETED.json.partial'),output('COMPLETED.json'));
}catch(error){await writeFile(output('COLLECTION-FAILED.json'),JSON.stringify({validationComplete:false,status:'failed',at:new Date().toISOString(),error:String(error),scope:'This marker or a nonzero collector exit invalidates collection even if other generated files exist. Manifest/index never independently assert success. A missing or partial final receipt cannot pass the completion gate.'},null,2)+'\n',{flag:'wx'}).catch(()=>{});throw error;}
