import {harness,assert,expect,sdk,readFile,writeFile} from './helpers.mjs';
const out=process.argv[2]??'tmp/T11-4-2-3l4/ui/branches-01',url=process.argv[3]??'http://127.0.0.1:4210/',fullOut=process.argv[4]??'tmp/T11-4-2-3l4/ui/run-01';
const envelopes=(state,collection)=>{
 const slots=new Map(),storage={getItem:k=>slots.get(k)??null,setItem:(k,v)=>slots.set(k,v)},now=()=>new Date().toISOString();
 const repo=sdk.createV5SaveRepository(()=>storage,now);repo.load();assert(repo.write(state).ok);
 const book=sdk.createCollectionRepository(()=>storage,now);book.load();assert(book.write(collection).ok);
 return Object.fromEntries(slots);
};
async function run(name,raw,work){const h=await harness(`${out}-${name}`,url,raw);try{await work(h);await h.finish({branch:name});}catch(e){await h.fail(e);throw e;}finally{await h.dispose();}}
const old=JSON.parse(await readFile('docs/evidence/T11-4-2-3l3/ui/run-02/states.json','utf8')).find(o=>o.label==='real-reload-summary');assert(old);assert.equal(old.state.day,4);assert.equal(old.state.phase,'summary');assert(sdk.validateRun(old.state).ok);assert(sdk.validateCollection(old.collection).ok);
await run('old-first-chapter-resume',envelopes(old.state,old.collection),async h=>{
 await h.page.goto(url);await h.page.locator('#v4-continue').click();assert.deepEqual(await h.keep('archived-real-UI-summary-resumed'),old.state);await expect(h.page.locator('#v4-stage')).toHaveAttribute('data-scene','receipt');await h.capture('old-first-chapter-resumable');
 const after=await h.ui({type:'advance'},0);assert.equal(after.day,5);assert.equal(after.blades.filter(b=>b.status==='active'&&b.suppliedDay===5).length,2);assert.equal(after.reserveId,'d4-2');await h.leaveIntro();await h.capture('old-summary-real-day-five');h.checks.push({label:'Explicit archive restoration, not a fresh full run',source:'docs/evidence/T11-4-2-3l3/ui/run-02/states.json#real-reload-summary',acceptedCommands:1});
});
const current=JSON.parse(await readFile(`${fullOut}/states.json`,'utf8')).find(o=>o.label==='a127-advance');assert(current);assert.equal(current.state.day,12);assert.equal(current.state.phase,'workshop');
await run('day-twelve-return',Object.fromEntries([[sdk.V5_SAVE_KEY,current.raw.save],[sdk.COLLECTION_KEY,current.raw.collection]]),async h=>{
 await h.page.goto(url);await h.page.locator('#v4-continue').click();assert.deepEqual(await h.keep('real-UI-day12-prefix-resumed'),current.state);const after=await h.ui({type:'settle'},0);assert.equal(after.phase,'return');await expect(h.page.locator('#v4-stage-copy [data-ending]')).toHaveAttribute('data-ending','return');await expect(h.page.locator('#v4-stage-copy')).toContainText('山口护灯剑尚未做成');await h.capture('return-ending');
 await h.page.reload();await h.page.locator('#v4-continue').click();assert.deepEqual(await h.keep('return-reload'),after);h.checks.push({label:'Real UI day12 prefix restoration, one explicit final settle; not another fresh twelve-day run',source:`${fullOut}/states.json#a127-advance`});
});
await run('fresh-three-misses',null,async h=>{
 await h.page.goto(url);await h.page.locator('.v4-journey-options summary').click();await h.page.locator('#v4-seed').fill('v5-missed-days');await h.page.locator('#v4-start').click();let s=await h.keep('fresh-created'),created=sdk.createRun({runId:s.runId,seed:'v5-missed-days',mode:'story',eligibility:{recipes:['light'],challenge:false}});assert(created.ok);assert.deepEqual(s,created.state);
 const guide=[{type:'continue'},{type:'settle'},{type:'advance'},{type:'settle'},{type:'advance'},{type:'settle'}];for(let i=0;i<guide.length;i++)s=await h.ui(guide[i],i);assert.equal(s.phase,'defeat');assert.equal(s.day,3);assert.equal(s.seals,0);await expect(h.page.locator('#v4-stage-copy [data-ending]')).toHaveAttribute('data-ending','defeat');await h.capture('fresh-three-misses-defeat');
 await h.page.reload();await h.page.locator('#v4-continue').click();assert.deepEqual(await h.keep('defeat-reload'),s);h.checks.push({label:'Fresh three missed days and real defeat; not a twelve-day run',acceptedCommands:6});
});
console.log(JSON.stringify({ok:true,out,branches:3,actualAcceptedCommands:8}));
