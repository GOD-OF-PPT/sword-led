import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const base='tmp/T11-4-2-3l5/ui',read=async p=>JSON.parse(await readFile(p)),sha=async p=>createHash('sha256').update(await readFile(p)).digest('hex');
const stable=x=>Array.isArray(x)?x.map(stable):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])])):x;
const groups=[
 {name:'main full run',execution:48426,exitCode:0,buildExecution:70067,consumedManifest:'tmp/T11-4-2-3l5/main-consumed-build.json',inputs:`${base}/main-inputs.json`,directories:['run-01']},
 {name:'six growth windows',execution:64773,exitCode:0,buildExecution:83547,consumedManifest:'tmp/T11-4-2-3l5/windows-consumed-build.json',inputs:`${base}/windows-inputs.json`,directories:['specific-sword-trade','day-six-cash-shortfall','day-nine-unaffordable-benefit','warm-rack-packing','reduced-loan-pending-prop','credit-real-first-crack'].map(x=>'windows-01/'+x)},
 {name:'final trade purpose correction',execution:25142,exitCode:0,buildExecution:5917,consumedManifest:'tmp/T11-4-2-3l5/build.json',inputs:`${base}/trade-final-inputs.json`,directories:['trade-final-01/specific-sword-trade']},
];
const unique=new Set(),uniqueBooks=new Set(),geometry=[];let actions=0,observations=0,books=0,screenshots=0;
for(const group of groups){
 const input=await read(group.inputs);group.consumedManifestSha256=await sha(group.consumedManifest);
 for(const file of input.files){const resolved=file.path==='tmp/T11-4-2-3l5/build.json'?group.consumedManifest:file.path;assert.equal(await sha(resolved),file.sha256,`frozen input drift ${file.path}`);}
 group.inputHashesStillMatch=true;group.results=[];
 for(const directory of group.directories){
  const path=`${base}/${directory}`,r=await read(path+'/result.json'),ss=await read(path+'/states.json'),cs=await read(path+'/captures.json');assert(r.ok);assert.equal(r.errors.length,0);assert.equal(ss.length,r.observations);const bad=[];
  for(const c of cs){const modal=c.bounds.find(n=>n.id==='v4-dialog')?.visible,stage=c.bounds.find(n=>n.id==='v4-stage')?.visible;if(!modal&&!stage)for(const n of c.bounds.filter(n=>['v4-deliver','v4-settle','v4-event-open','v4-shop'].includes(n.id)&&n.visible&&!n.disabled))if(!n.centerOwned||n.rect.bottom>c.size.height||n.rect.x<0)bad.push({label:c.label,size:c.size,id:n.id,rect:n.rect,centerOwned:n.centerOwned});}
  geometry.push({directory,frames:cs.length,workshopEnabledRecordedActionViolations:bad,packingFooterChecks:r.checks.filter(c=>c.label==='packing confirmation fully visible')});
  for(const s of ss){unique.add(JSON.stringify(stable(s.state)));if(s.collection){books++;uniqueBooks.add(JSON.stringify(stable(s.collection)));}}
  actions+=r.actions;observations+=ss.length;screenshots+=cs.length;
  group.results.push({directory,actions:r.actions,observations:ss.length,captures:cs.length,errors:r.errors,statesSha256:await sha(path+'/states.json'),actionsSha256:r.actions?await sha(path+'/actions.json'):null,resultSha256:await sha(path+'/result.json')});
 }
}
assert.equal(actions,172);assert.equal(observations,182);assert.equal(screenshots,94);
await writeFile(`${base}/geometry-summary.json`,JSON.stringify({scope:'Only recorded nonmodal workshop enabled deliver/settle/event/shop buttons; packing footer separately records both viewports. Arrange button also exercised by actual click and visually inspected at1280/1920; not a claim that all DOM nodes have geometry assertions.',batches:geometry},null,2));
await writeFile(`${base}/run-meta.json`,JSON.stringify({ok:true,groups,totals:{actualAcceptedCommands:actions,stateOccurrences:observations,canonicalUniqueStates:unique.size,collectionOccurrences:books,canonicalUniqueCollections:uniqueBooks.size,capturedFrames:screenshots},limits:'One fresh full twelve-day run using same prior route; six restored real UI windows and one final repeated trade case. No fun, compatibility, or complete-goal claim. All exact consumed source/build stages separately retained.'},null,2));
console.log(JSON.stringify({ok:true,actions,observations,uniqueStates:unique.size,books,uniqueBooks:uniqueBooks.size,screenshots,geometryViolations:geometry.flatMap(x=>x.workshopEnabledRecordedActionViolations).length}));
