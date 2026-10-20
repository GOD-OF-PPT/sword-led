import{test,expect}from'@playwright/test';
import{readFileSync}from'node:fs';
import{verifyNativeV4Bfcache}from'./v4-native-bfcache.mjs';
import{validateRun}from'../../src/core-v4/index.js';
import type{Action,RunState}from'../../src/core-v4/index.js';
const witness=JSON.parse(readFileSync('docs/evidence/T11-4-2-3i1/witness-fixed/complete.json','utf8'))as RunState;
const transitions=JSON.parse(readFileSync('docs/evidence/T11-4-2-3i1/witness-fixed/complete-commands.json','utf8'))as {day:number;action:Action}[];
test('native Chrome restores actual v4 cached heap with latest saved chapter and collection',async({baseURL},info)=>{
 if(!baseURL)throw Error('Missing native fixture origin');
 const first=transitions.findIndex(t=>t.day===4&&t.action.type==='settle')+1,end=transitions.findIndex(t=>t.day===5&&t.action.type==='settle')+1;
 expect(first).toBeGreaterThan(1);expect(end).toBeGreaterThan(first);
 const result=await verifyNativeV4Bfcache(baseURL,{runId:witness.runId,seed:witness.seed,first:witness.journal.slice(0,first),following:witness.journal.slice(first,end)});
 expect(result).toMatchObject({nativePersisted:true,heapRetained:true,restoredMode:'readonly',resumedMode:'writer',staleRejected:'stale_session'});
 for(const s of result.states)expect(validateRun(s).ok).toBe(true);
 expect(result.collection).toMatchObject({data:{chapters:[1],challenge:false},pending:false});
 await info.attach('native-v4-bfcache',{body:JSON.stringify(result,null,2),contentType:'application/json'});
});
