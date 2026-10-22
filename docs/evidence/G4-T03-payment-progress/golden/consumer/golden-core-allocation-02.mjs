// UNEXECUTED isolated candidate. Importing/running this file performs SDK work.
// Root must authorize execution after the current frozen browser process ends.
import assert from 'node:assert/strict';
import {readFile,readdir,mkdir,writeFile,open} from 'node:fs/promises';
import {resolve,join,relative,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {performance} from 'node:perf_hooks';

const repository=fileURLToPath(new URL('../../../',import.meta.url));
const args=process.argv.slice(2),arg=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
for(let i=0;i<args.length;i+=2)assert(['--old','--new','--out'].includes(args[i])&&args[i+1],'Expected --old/--new/--out value pairs');
const oldRoot=resolve(repository,arg('--old','tmp/goal4-T03/runtime-build-11'));
const newRoot=resolve(repository,arg('--new','dist'));
const output=resolve(repository,arg('--out','tmp/goal4-T03/runs/golden-core-allocation-CANDIDATE'));
assert(output.startsWith(join(repository,'tmp')+sep),'Output must be isolated beneath repository/tmp');
assert.notEqual(oldRoot,newRoot,'Old and new SDK directories must be different');
await mkdir(output,{recursive:false});
const startedAt=new Date().toISOString(),start=performance.now(),fixedTime='2026-10-22T00:00:00.000Z';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const clone=value=>structuredClone(value),json=value=>JSON.stringify(value),digest=value=>sha(json(value));
const inputs=new Map(),comparisons=[],ownership=[],rejections=[],checkpoints=[],sources=[],prefixes=[],representatives=new Map();
const actionTypes=new Set(),eventTypes=new Set(),coveredEvents=new Set();
const log=await open(join(output,'command-results.jsonl'),'wx');
let oldSdk,newSdk,oldManifest,newManifest,stepCount=0,completed=false;
const relativeName=path=>relative(repository,path).split(sep).join('/');
async function input(path){const absolute=resolve(repository,path),bytes=await readFile(absolute);const entry={path:relativeName(absolute),bytes:bytes.length,sha256:sha(bytes)};const previous=inputs.get(absolute);if(previous)assert.deepEqual(entry,previous,'Input changed while being read');else inputs.set(absolute,entry);return bytes;}
async function data(path){const bytes=await input(path);return JSON.parse((path.endsWith('.gz')?gunzipSync(bytes):bytes).toString());}
async function sdkManifest(root){const names=(await readdir(root)).filter(name=>name.endsWith('.js')).sort();assert.equal(names.length,9,'Exactly nine existing SDK/root JS files expected');return Promise.all(names.map(async name=>{const bytes=await input(join(root,name));return{name,bytes:bytes.length,sha256:sha(bytes)};}));}
function same(actual,expected,label){assert.deepEqual(actual,expected,label);}
function deepFrozen(value,path='$',seen=new Set()){if(value===null||typeof value!=='object'||seen.has(value))return;seen.add(value);assert(Object.isFrozen(value),'Output is mutable at '+path);for(const[k,v]of Object.entries(value))deepFrozen(v,path+'.'+k,seen);}
function freezeTree(value){if(value&&typeof value==='object'){for(const child of Object.values(value))freezeTree(child);Object.freeze(value);}return value;}
function freezeFlags(value,path='$',rows=[],seen=new Set()){if(value===null||typeof value!=='object'||seen.has(value))return rows;seen.add(value);rows.push([path,Object.isFrozen(value)]);for(const[k,v]of Object.entries(value))freezeFlags(v,path+'.'+k,rows,seen);return rows;}
function mutableNodes(value,set=new Set(),seen=new Set()){if(value===null||typeof value!=='object'||seen.has(value))return set;seen.add(value);if(!Object.isFrozen(value))set.add(value);for(const child of Object.values(value))mutableNodes(child,set,seen);return set;}
function detached(value,forbidden,seen=new Set()){if(value===null||typeof value!=='object'||seen.has(value))return;seen.add(value);assert(!forbidden.has(value),'Output aliases a mutable caller node');for(const child of Object.values(value))detached(child,forbidden,seen);}
function initialInput(state){return{runId:state.runId,seed:state.seed,mode:state.mode,eligibility:state.initialEligibility};}
function command(state,action){return{runId:state.runId,expectedRevision:state.revision,action};}
function storage(){const values=new Map();return{values,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};}
function encodeWith(sdk,state,collection=false){const store=storage(),repository=collection?sdk.createCollectionRepository(()=>store,()=>fixedTime):sdk.createV5SaveRepository(()=>store,()=>fixedTime);const before=repository.load(),written=repository.write(state);assert(written.ok,'Official repository could not serialize checkpoint');const key=collection?sdk.COLLECTION_KEY:sdk.V5_SAVE_KEY,raw=store.getItem(key);assert.equal(typeof raw,'string');const decoded=collection?sdk.decodeCollection(raw):sdk.decodeV5Save(raw);assert.equal(decoded.status,'valid');same(decoded.state,state,'Official repository roundtrip');return{before,written,raw,decoded};}
async function checkpoint(state,label,archived=null){
 const begin=performance.now(),a=oldSdk.validateRun(state),b=newSdk.validateRun(state);same(b,a,label+' complete validator');assert(a.ok,label+' must be a replay-valid state');same(a.state,state,label+' old validator state');
 const ae=encodeWith(oldSdk,state),be=encodeWith(newSdk,state);same(be,ae,label+' official run codec/error/export text');
 const ac=oldSdk.collectionFromRun(state),bc=newSdk.collectionFromRun(state);same(bc,ac,label+' collection awards');assert(ac.ok,label+' collection must be valid');same(encodeWith(newSdk,bc.state,true),encodeWith(oldSdk,ac.state,true),label+' collection repository codec');
 same(newSdk.collectionEligibility(bc.state),oldSdk.collectionEligibility(ac.state),label+' qualification');
 if(archived?.raw?.save){const oa=oldSdk.decodeV5Save(archived.raw.save),nb=newSdk.decodeV5Save(archived.raw.save);same(nb,oa,label+' actual archived raw save');assert.equal(oa.status,'valid');same(oa.state,state,label+' archive state');}
 if(archived?.collection){same(newSdk.validateCollection(archived.collection),oldSdk.validateCollection(archived.collection),label+' archived book');assert(oldSdk.validateCollection(archived.collection).ok);}
 if(archived?.raw?.collection){const oa=oldSdk.decodeCollection(archived.raw.collection),nb=newSdk.decodeCollection(archived.raw.collection);same(nb,oa,label+' actual archived raw book');assert.equal(oa.status,'valid');if(archived.collection)same(oa.state,archived.collection,label+' archive book full state');}
 const row={label,revision:state.revision,phase:state.phase,mode:state.mode,stateSHA256:digest(state),rawSHA256:sha(ae.raw),collectionSHA256:digest(ac.state),milliseconds:performance.now()-begin};checkpoints.push(row);await writeFile(join(output,'checkpoints.json'),json(checkpoints)+'\n');return ac.state;
}
async function pairedStep(a,b,action,label){
 const beforeA=digest(a),beforeB=digest(b),cmd=command(a,clone(action)),commandBefore=json(cmd),ra=oldSdk.applyCommand(a,cmd),rb=newSdk.applyCommand(b,cmd);
 same(rb,ra,label+' complete CommandResult');same(ra.state.rng,rb.state.rng,label+' complete RNG');assert.equal(digest(a),beforeA,label+' old input changed');assert.equal(digest(b),beforeB,label+' new input changed');assert.equal(json(cmd),commandBefore,label+' command changed');
 if(ra.ok){deepFrozen(ra);deepFrozen(rb);assert.notEqual(ra.state,a);assert.notEqual(rb.state,b);assert.notEqual(ra.state.journal,a.journal);assert.notEqual(rb.state.journal,b.journal);actionTypes.add(action.type);for(const event of ra.events)eventTypes.add(event.type);if(action.type==='chooseEvent')coveredEvents.add(a.eventId+'/'+action.choice);if(!representatives.has(action.type))representatives.set(action.type,{before:a,action:clone(action),label});if(action.type==='buy'&&a.traits.length===3&&!representatives.has('buy-full-slot'))representatives.set('buy-full-slot',{before:a,action:clone(action),label});if(a.journal.length<400&&prefixes.length<1200)prefixes.push(a);}
 else{assert.equal(ra.state,a);assert.equal(rb.state,b);same(ra.events,[]);same(rb.events,[]);}
 same(newSdk.getRunView(rb.state),oldSdk.getRunView(ra.state),label+' full public view');
 await log.write(json({index:++stepCount,label,action,ok:ra.ok,error:ra.ok?null:ra.error,revision:ra.state.revision,resultSHA256:digest(ra),stateSHA256:digest(ra.state),rngSHA256:digest(ra.state.rng),eventsSHA256:digest(ra.events)})+'\n');return[ra,rb];
}
async function replay(source,label,{archived=null,expectedPrefixes=new Map()}={}){
 const ca=oldSdk.createRun(initialInput(source)),cb=newSdk.createRun(initialInput(source));same(cb,ca,label+' createRun');assert(ca.ok);let a=ca.state,b=cb.state;const begin=performance.now();
 for(const[index,action]of source.journal.entries()){const[ra,rb]=await pairedStep(a,b,action,label+'/'+index);assert(ra.ok,label+' archived accepted command rejected: '+ra.error);a=ra.state;b=rb.state;if(expectedPrefixes.has(a.revision))same(a,expectedPrefixes.get(a.revision),label+' actual archived prefix '+a.revision);}
 same(a,source,label+' archived final state');same(b,source,label+' new final state');await checkpoint(a,label+'-final',archived);comparisons.push({label,steps:source.journal.length,phase:source.phase,mode:source.mode,sourceSHA256:digest(source),milliseconds:performance.now()-begin});return a;
}
function variant(state,kind){const value=clone(state);if(kind==='frozen')return freezeTree(value);if(kind==='mixed')for(let i=0;i<value.journal.length;i+=2)freezeTree(value.journal[i]);return value;}
function mutateCaller(state,cmd){if(!Object.isFrozen(state)){state.coins+=1;if(state.blades[0]&&!Object.isFrozen(state.blades[0]))state.blades[0].value+=1;if(!Object.isFrozen(state.rng.forge))state.rng.forge.state^=1;if(!Object.isFrozen(state.journal))state.journal.push({type:'continue'});}const entry=state.journal.find(item=>!Object.isFrozen(item));if(entry)entry.type='__mutation_probe__';if(!Object.isFrozen(cmd.action))cmd.action.type='__mutation_probe__';}
async function ownershipCase(before,action,label,{makeCommand=null,makeState=null,requireFailure=false}={}){
 for(const kind of ['frozen','mutable','mixed']){
  const results=[];
  for(const[sdkName,sdk]of [['old',oldSdk],['new',newSdk]]){
   let state=variant(before,kind);if(makeState)state=makeState(state);const cmd=makeCommand?makeCommand(state):command(state,clone(action)),stateBefore=json(state),flagsBefore=freezeFlags(state),cmdBefore=json(cmd),commandFlags=freezeFlags(cmd),forbidden=new Set([...mutableNodes(state),...mutableNodes(cmd)]);
   const result=sdk.applyCommand(state,cmd);assert.equal(json(state),stateBefore,label+' input changed');same(freezeFlags(state),flagsBefore,label+' input freeze flags changed');assert.equal(json(cmd),cmdBefore,label+' command changed');same(freezeFlags(cmd),commandFlags,label+' command freeze flags changed');
   const frozenPrefixEntries=state.journal.filter(Object.isFrozen).length,sharedFrozenPrefixEntries=result.ok?state.journal.filter((entry,index)=>Object.isFrozen(entry)&&result.state.journal[index]===entry).length:null;
   if(requireFailure)assert(!result.ok,label+' unexpectedly accepted');
   if(result.ok){deepFrozen(result);detached(result,forbidden);assert.notEqual(result.state.journal,state.journal);if(sdkName==='new')assert.equal(sharedFrozenPrefixEntries,frozenPrefixEntries,label+' candidate did not reuse immutable Action prefixes');const outputBefore=digest(result);mutateCaller(state,cmd);assert.equal(digest(result),outputBefore,label+' later caller mutation leaked');}
   else{assert.equal(result.state,state,label+' failure lost input reference');same(result.events,[]);}
   results.push(result.ok?{ok:true,state:result.state,events:result.events}:{ok:false,error:result.error,state:clone(result.state),events:result.events});
   ownership.push({label,kind,sdk:sdkName,ok:result.ok,error:result.ok?null:result.error,inputStateSHA256:sha(stateBefore),inputUnchangedAndFreezeFlagsPreserved:true,deepFrozenAndDetached:result.ok,frozenPrefixEntries,sharedFrozenPrefixEntries,failureStateIdentity:!result.ok});
  }
  same(results[1],results[0],label+'/'+kind+' old/new full ownership result');
 }
}

try{
 await input(fileURLToPath(import.meta.url));oldManifest=await sdkManifest(oldRoot);newManifest=await sdkManifest(newRoot);same(newManifest.map(x=>x.name),oldManifest.map(x=>x.name),'SDK names');
 assert.equal(oldManifest.find(x=>x.name==='sword-led-v5.js')?.sha256,'77f420f6c1e897f6c6167b636f882f7340a92df81f565b7c7e17d3780cd042cc','Old golden must be the captured original build11 v5 SDK');
 for(const old of oldManifest){const next=newManifest.find(x=>x.name===old.name);if(old.name==='sword-led-v5.js')assert.notEqual(next.sha256,old.sha256,'Candidate v5 SDK equals golden: do not call an unchanged allocation candidate verified');else same(next,old,'Original eight SDK/shared files must stay byte-identical: '+old.name);}
 oldSdk=await import(pathToFileURL(join(oldRoot,'sword-led-v5.js')).href);newSdk=await import(pathToFileURL(join(newRoot,'sword-led-v5.js')).href);
 same(newSdk.JOURNAL_LIMIT,oldSdk.JOURNAL_LIMIT);same(newSdk.JOURNAL_SOFT_LIMIT,oldSdk.JOURNAL_SOFT_LIMIT);assert.equal(oldSdk.JOURNAL_SOFT_LIMIT,1900);assert.equal(oldSdk.JOURNAL_LIMIT,2048);
 const guide=await data('docs/evidence/T11-4-2-3l1/journeys/victory.json'),story=guide.state;assert.equal(story.phase,'victory');await replay(story,'published-story-victory');
 const corpusRoot=join(repository,'docs/evidence/G4-T02/runs/matrix-01/artifacts'),directories=(await readdir(corpusRoot)).filter(name=>name.endsWith('-chromium-dpr1')).sort();
 async function observations(prefix){const matches=directories.filter(name=>name.startsWith(prefix));assert.equal(matches.length,1,'One frozen T02 case expected for '+prefix);const dir=join(corpusRoot,matches[0]),files=await readdir(dir),name=files.includes('v5-states.json.gz')?'v5-states.json.gz':'v5-states.json';return{path:join(dir,name),rows:await data(join(dir,name))};}
 const returning=await observations('v5-journeys-fresh-mixed-re-'),defeat=await observations('v5-journeys-fresh-pure-key-'),challenge=await observations('v5-keyboard-current-v5-fre-');
 for(const[item,label,phase]of [[returning,'actual-T02-return','return'],[defeat,'actual-T02-defeat','defeat']]){const archived=item.rows.findLast(row=>row.state.phase===phase);assert(archived);sources.push({label,path:relativeName(item.path),recordLabel:archived.label});await replay(archived.state,label,{archived});}
 const earnedStory=challenge.rows.findLast(row=>row.state.mode==='story'&&row.state.phase==='victory'),opening=challenge.rows.find(row=>row.state.mode==='challenge'&&row.state.revision===0),earnedFinal=challenge.rows.findLast(row=>row.state.mode==='challenge'&&row.state.phase==='victory');assert(earnedStory&&opening&&earnedFinal,'Actual earned challenge chain missing');
 await replay(earnedStory.state,'actual-T02-earned-story',{archived:earnedStory});const oldEligibility=oldSdk.collectionEligibility(earnedStory.collection),newEligibility=newSdk.collectionEligibility(earnedStory.collection);same(newEligibility,oldEligibility,'Earned actual book eligibility');assert(oldEligibility.challenge);same(opening.state.initialEligibility,oldEligibility,'Challenge qualification must come from the preceding actual story book');await checkpoint(opening.state,'actual-earned-challenge-opening',opening);await replay(earnedFinal.state,'actual-T02-earned-full-challenge',{archived:earnedFinal});
 // Only bounded existing T02 supplemental cases: four interaction leaves plus all six event accept/decline leaves.
 const extras=[];for(const prefix of ['v5-interactions-v5-borrowe-','v5-interactions-v5-full-sl-','v5-interactions-v5-delayed-','v5-interactions-v5-cash-pu-'])extras.push(await observations(prefix));
 const eventDirs=directories.filter(name=>name.startsWith('v5-events-'));assert.equal(eventDirs.length,12,'All original six event accept/decline cases expected');for(const name of eventDirs){const dir=join(corpusRoot,name),files=await readdir(dir),file=files.includes('v5-states.json.gz')?'v5-states.json.gz':'v5-states.json';extras.push({path:join(dir,file),rows:await data(join(dir,file))});}
 for(const item of extras){const unique=new Map();for(const row of item.rows){const key=digest({input:initialInput(row.state),journal:row.state.journal});if(unique.has(key))same(row.state,unique.get(key).state,'Archived identical input/journal has inconsistent state');unique.set(key,row);}const leaves=[...unique.values()].filter(row=>![...unique.values()].some(other=>json(initialInput(other.state))===json(initialInput(row.state))&&other.state.journal.length>row.state.journal.length&&json(other.state.journal.slice(0,row.state.journal.length))===json(row.state.journal)));assert(leaves.length<=8,'Unexpected supplemental branch expansion');for(const[index,row]of leaves.entries()){const label=relativeName(item.path)+'-leaf-'+index;sources.push({label,path:relativeName(item.path),recordLabel:row.label});await replay(row.state,label,{archived:row});}}
 const pressurePath='tmp/goal4-T03/runs/forge-perf-preflight-02/artifacts/performance-v5-native-call-80a7f-ndlers-pressure-long-at1280-firefox-dpr2/native-pressure-long-1280-pointer.json',pressure=await data(pressurePath);assert.equal(pressure.source.journal.length,1890);await replay(pressure.source,'actual-legal-pressure1890');
 const softPath='tmp/goal4-T03/runs/pressure-response-02/artifacts/resilience-v5-legitimate-1-c9e5b-livery-and-settlement-exits-chromium-dpr1/legal-soft-limit.json',soft=await data(softPath);assert.equal(soft.initial.journal.length,1898);assert.equal(soft.softLimit.journal.length,1900);assert(soft.main.events.some(event=>event.type==='Delivered'&&event.matched));assert(soft.ordinarySale.events.some(event=>event.type==='Delivered'&&!event.matched));assert(soft.recovery.events.some(event=>event.type==='Disposed'));
 const softPrefixes=[['qualified1898',soft.initial],['soft1900',soft.softLimit],['actual-main-delivery',soft.main.state],['actual-ordinary-sale',soft.ordinarySale.state],['actual-recovery',soft.recovery.state]];
 await replay(soft.state,'actual-qualified1898-to1900-allowed-exits',{expectedPrefixes:new Map(softPrefixes.map(([,state])=>[state.revision,state]))});for(const[label,state]of softPrefixes)await checkpoint(state,label);
 await ownershipCase(soft.softLimit,{type:'strike',pieceId:soft.fixture.commissionPieceId},'soft1900-rejected-strike',{requireFailure:true});await ownershipCase(soft.initial,{type:'reserve',pieceId:soft.fixture.paddingPieceId},'qualified1898-next-toggle');
 const negative={...clone(soft.initial),revision:2049,journal:[...clone(soft.initial.journal),...Array.from({length:2049-soft.initial.journal.length},()=>({type:'reserve',pieceId:'d4-1'}))]},negativeRaw=json({schemaVersion:5,rulesVersion:'forge-v5',savedAt:fixedTime,state:negative});
 same(newSdk.validateRun(negative),oldSdk.validateRun(negative),'2049 invalid-state exact validator/error text');assert(!oldSdk.validateRun(negative).ok);same(newSdk.decodeV5Save(negativeRaw),oldSdk.decodeV5Save(negativeRaw),'2049 exact codec/error text');assert.equal(oldSdk.decodeV5Save(negativeRaw).status,'invalid');
 for(const type of ['continue','strike','deliver','scrap','reserve','setRecipe','buy','claimGift','upgrade','repair','chooseEvent','settle','chooseModification','advance']){assert(representatives.has(type),'Existing finite corpus lacks Action '+type);const r=representatives.get(type);await ownershipCase(r.before,r.action,'accepted-'+type);}
 for(const id of oldSdk.EVENT_IDS)for(const choice of ['accept','decline'])assert(coveredEvents.has(id+'/'+choice),'Missing actual event branch '+id+'/'+choice);
 const workshop=prefixes.find(state=>state.phase==='workshop'&&state.day===1),openingState=oldSdk.createRun(initialInput(story)).state;assert(workshop);
 const negatives=[['wrong-run',workshop,null,s=>({...command(s,{type:'settle'}),runId:'different-golden-run'})],['stale-revision',workshop,null,s=>({...command(s,{type:'settle'}),expectedRevision:s.revision+1})],['invalid-nested-action',workshop,null,s=>command(s,{type:'strike',pieceId:{nested:'illegal'}})],['wrong-phase',openingState,{type:'strike',pieceId:'d1-1'}],['missing-piece',workshop,{type:'strike',pieceId:'missing-golden-piece'}],['no-shop',workshop,{type:'upgrade'}],['same-recipe',workshop,{type:'setRecipe',pieceId:workshop.blades[0].id,recipe:workshop.blades[0].recipe}]];
 const reserved=prefixes.find(s=>s.reserveId&&s.blades.some(b=>b.id===s.reserveId&&b.status==='active'));assert(reserved);negatives.push(['reserved-piece',reserved,{type:'strike',pieceId:reserved.reserveId}]);
 const locked=prefixes.find(s=>s.phase==='workshop'&&s.blades.some(b=>b.status==='active'&&b.hits>0&&b.id!==s.reserveId));assert(locked);const lockedBlade=locked.blades.find(b=>b.status==='active'&&b.hits>0&&b.id!==locked.reserveId);negatives.push(['locked-recipe',locked,{type:'setRecipe',pieceId:lockedBlade.id,recipe:'light'}]);
 const barter=representatives.get('buy-full-slot');assert(barter,'Existing full-slot accepted buy representative required');assert.equal(barter.before.traits.length,3,'Existing full-slot barter boundary required');negatives.push(['invalid-replacement',barter.before,{...barter.action,replaceId:barter.action.traitId}]);
 for(const[label,state,action,makeCommand]of negatives){await ownershipCase(state,action,label,{makeCommand,requireFailure:true});rejections.push(label);}
 // Exact finite legal recipe already present in tests/core/v5-economy.test.ts; no seed search.
 await input('tests/core/v5-economy.test.ts');const purseInput={runId:'economy-v5',seed:'v5-purse-0'};let pa=oldSdk.createRun(purseInput).state,pb=newSdk.createRun(purseInput).state;
 for(const[index,action]of [{type:'continue'},...Array.from({length:3},()=>({type:'strike',pieceId:'d1-1'})),{type:'deliver',pieceId:'d1-1'},...Array.from({length:4},()=>({type:'strike',pieceId:'d1-2'})),{type:'deliver',pieceId:'d1-2'}].entries()){const[ra,rb]=await pairedStep(pa,pb,action,'existing-core-purse-recipe/'+index);assert(ra.ok);pa=ra.state;pb=rb.state;}
 assert.equal(oldSdk.marketRemaining(pa),0,'Existing finite core fixture must actually exhaust the purse');await checkpoint(pa,'existing-core-zero-purse');await ownershipCase(pa,{type:'deliver',pieceId:'d1-3'},'market-exhausted-zero-sale',{requireFailure:true});await ownershipCase(pa,{type:'scrap',pieceId:'d1-3'},'explicit-zero-recovery');rejections.push('market-exhausted-zero-sale');
 await ownershipCase(workshop,{type:'settle'},'wrong-rules',{makeState:state=>({...state,rulesVersion:'forge-v4'}),requireFailure:true});
 // Exact parser/validator negative behavior, including accessor non-invocation and illegal nested history.
 for(const sdk of [oldSdk,newSdk]){let calls=0;const bad={get type(){calls++;return'settle';}};assert.equal(sdk.applyCommand(workshop,command(workshop,bad)).ok,false);assert.equal(calls,0,'Command getter was invoked');}
 const invalidNested=clone(workshop);invalidNested.journal[0]={type:'continue',nested:{mutable:true}};same(newSdk.validateRun(invalidNested),oldSdk.validateRun(invalidNested),'Illegal nested historical Action rejected equally');assert(!oldSdk.validateRun(invalidNested).ok);
 completed=true;
}catch(error){await writeFile(join(output,'failure.json'),json({at:new Date().toISOString(),message:String(error),stack:error.stack,actual:error.actual,expected:error.expected,operator:error.operator,stepCount,comparisons,checkpoints,ownership,rejections,sources})+'\n');throw error;
}finally{
 await log.close();let unchanged=true;const changes=[];for(const[absolute,entry]of inputs){const current=await readFile(absolute);if(sha(current)!==entry.sha256){unchanged=false;changes.push(entry.path);}}
 const result={ok:completed&&unchanged,startedAt,endedAt:new Date().toISOString(),milliseconds:performance.now()-start,oldRoot,newRoot,oldManifest,newManifest,inputs:[...inputs.values()],inputsUnchanged:unchanged,inputChanges:changes,stepCount,comparisons,checkpoints,ownership,rejections,actionTypes:[...actionTypes].sort(),eventTypes:[...eventTypes].sort(),coveredEvents:[...coveredEvents].sort(),sources,scope:'Finite existing archived transcripts and exact original SDK versus candidate. Complete CommandResult/state/RNG/events/view equality on every replayed edge; official codec/collection checks at declared checkpoints; mutable/frozen/mixed ownership and original failure identity. No seed/model sweep, browser, fun, performance-budget or linear-complexity claim.'};await writeFile(join(output,'result.json'),json(result)+'\n');process.stdout.write(json({ok:result.ok,stepCount,paths:comparisons.length,checkpoints:checkpoints.length,ownershipRows:ownership.length,inputsUnchanged:unchanged,result:join(output,'result.json')})+'\n');if(!unchanged)throw Error('Frozen input bytes changed: '+changes.join(','));
}
