import {test,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createRun,applyCommand,validateRun,VALUE_CAP} from '../../src/core-v3/index.js';
import type {RunState,Action,Blade} from '../../src/core-v3/index.js';
import {isRecord} from '../../src/core/guards.js';
import {requestFor,assessBlade,getNotebook,burstCommands,normalSupplyBase,notebookTitle} from '../../src/presentation-v3/notebook.js';
import type {NotebookKind,CustomerRequest} from '../../src/presentation-v3/notebook.js';

function fresh(seed='notebook-test',roundLimit:3|12=12){const r=createRun({runId:'notebook-unit',seed,roundLimit});if(!r.ok)throw Error(r.error);return r.state;}
function send(s:RunState,action:Action){const r=applyCommand(s,{runId:s.runId,expectedRevision:s.revision,action});if(!r.ok)throw Error(r.error);return r;}
function stored(path:string,key?:string){let raw:unknown=JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));if(key){if(!isRecord(raw))throw Error('Expected record');raw=raw[key];}const r=validateRun(raw);if(!r.ok)throw Error(r.detail);return r.state;}
function kindRequest(s:RunState,kind:NotebookKind):CustomerRequest{for(let r=1;r<=12;r++){const request=requestFor(s,r);if(request?.kind===kind)return request;}throw Error('Missing kind');}

test('same normalized seed gives stable view schedule without draws or input changes',()=>{
 const s=fresh(' e\u0301 '),before=JSON.stringify(s),view=getNotebook(s),again=getNotebook(s);
 expect(view).toBe(again);expect(JSON.stringify(s)).toBe(before);expect(view.current.kind).toBe('debut');expect(view.next?.kind).toBe('light');
 expect(view.pages.slice(2).every(p=>p.status==='unseen'&&p.request===null)).toBe(true);
 expect(Array.from({length:12},(_,i)=>requestFor(s,i+1))).toEqual(Array.from({length:12},(_,i)=>requestFor(fresh('é'),i+1)));
 for(const r of [0,13,1.5])expect(requestFor(s,r)).toBeNull();
});

test('all eight view labels have deterministic request coverage and no adjacent repeated kind',()=>{
 const kinds=new Set<string>();for(let n=0;n<32;n++){const s=fresh(`notebook-${n}`),requests=Array.from({length:12},(_,i)=>requestFor(s,i+1)!);
  expect(requests.slice(0,3).map(r=>r.kind)).toEqual(['debut','light','burst']);expect(requests.at(-1)?.kind).toBe('finale');
  for(let i=0;i<requests.length;i++){kinds.add(requests[i]!.kind);if(i)expect(requests[i]?.kind).not.toBe(requests[i-1]?.kind);}
 }expect([...kinds].sort()).toEqual(['burst','cracked','debut','doubleBurst','finale','light','masterwork','return']);
});

test('accepted delivery order recovers only the first matching work and never rewrites economy',()=>{
 let s=fresh();for(const id of ['r1-1','r1-2']){for(let i=0;i<3;i++)s=send(s,{type:'strike',pieceId:id}).state;s=send(s,{type:'deliver',pieceId:id}).state;}
 const before=JSON.stringify(s),book=getNotebook(s);expect(book.works).toHaveLength(1);expect(book.works[0]?.blade.id).toBe('r1-1');expect(book.currentWork).toBe(book.works[0]);
 expect(book.works[0]?.blade).toEqual(s.blades[0]);expect(Object.isFrozen(book.works[0]?.blade)).toBe(true);expect(JSON.stringify(s)).toBe(before);expect(validateRun(s).ok).toBe(true);
});

test('view freezes its own copies without freezing a caller-owned mutable state',()=>{
 let s=fresh();for(let i=0;i<3;i++)s=send(s,{type:'strike',pieceId:'r1-1'}).state;s=send(s,{type:'deliver',pieceId:'r1-1'}).state;
 const mutable={...s,blades:s.blades.map(b=>({...b}))},book=getNotebook(mutable);expect(Object.isFrozen(mutable)).toBe(false);expect(Object.isFrozen(mutable.blades[0])).toBe(false);
 const value=book.works[0]!.blade.value;mutable.blades[0]!.value=0;expect(book.works[0]?.blade.value).toBe(value);expect(getNotebook(mutable).works).toHaveLength(0);
});

test('normal birth base excludes real inheritance and survives later upgrades',()=>{
 const s=stored('../../docs/evidence/T11-4-2-3f/inherit.json','final'),b=s.blades.find(b=>b.id==='r7-1')!;
 expect(b.base).toBe(322);expect(s.base).toBe(320);expect(normalSupplyBase(s,b)).toBe(160);
 expect(assessBlade(s,b,kindRequest(s,'light')).target).toBe(576);
});

test('a real carried light work keeps its birth threshold after an upgrade',()=>{
 let reached:RunState|null=null;
 for(let n=0;n<64&&!reached;n++){
  let s=fresh(`notebook-carry-${n}`);if(requestFor(s,4)?.kind!=='light')continue;
  for(let round=1;round<=3;round++){
   if(round===3)s=send(s,{type:'upgrade'}).state;
   const ids=s.blades.filter(b=>b.status==='active').map(b=>b.id);
   for(const pieceId of ids)for(let i=0;i<3;i++)s=send(s,{type:'strike',pieceId}).state;
   const candidate=round===3?s.blades.find(b=>b.status==='active'&&b.value>=144&&b.value<288):undefined;
   if(round===3&&!candidate)break;
   if(candidate)s=send(s,{type:'reserve',pieceId:candidate.id}).state;
   for(const pieceId of ids)if(pieceId!==s.reserveId)s=send(s,{type:'deliver',pieceId}).state;
   s=send(s,{type:'settle'}).state;s=send(s,{type:'advance'}).state;
   if(round===3){const id=s.reserveId!;s=send(s,{type:'reserve',pieceId:id}).state;s=send(s,{type:'deliver',pieceId:id}).state;reached=s;}
  }
 }
 if(!reached)throw Error('No real carried-light witness');expect(validateRun(reached).ok).toBe(true);
 expect(requestFor(reached,4)?.target).toBe(288);expect(requestFor(reached,4)?.condition).toContain('新坯参考');const work=getNotebook(reached).currentWork;
 expect(work?.blade.suppliedRound).toBe(3);expect(work?.request.target).toBe(144);expect(work?.condition).toContain('144');
});

test('burst count is reconstructed from every accepted state including broken weapons',()=>{
 for(const path of ['../../docs/evidence/T11-4-2-3f/inherit.json','../../docs/evidence/T11-4-2-3f/crackedEdge.json']){
  const final=stored(path,'final'),created=createRun({runId:final.runId,seed:final.seed,roundLimit:final.roundLimit});if(!created.ok)throw Error(created.error);let s=created.state;const counts=new Map<string,number>(),born=new Map<string,number>();
  for(const b of s.blades)born.set(b.id,s.base);
  for(const action of final.journal){const r=send(s,action);s=r.state;for(const e of r.events)if(e.type==='Strike'&&e.burst)counts.set(e.pieceId,(counts.get(e.pieceId)??0)+1);
   for(const b of s.blades){if(!born.has(b.id))born.set(b.id,s.base);expect(burstCommands(b)).toBe(counts.get(b.id)??0);expect(normalSupplyBase(s,b)).toBe(born.get(b.id));}
  }expect(s).toEqual(final);
 }
});

test('partial-cap burst still counts one accepted burst, not the number of safe hits',()=>{
 // Isolated arithmetic fixture, not a reachable-save witness.
 const s=fresh(),b=s.blades[0]!,fixture={...s,traits:['ember']as const,blades:[{...b,value:VALUE_CAP-1,hits:6,charge:6},...s.blades.slice(1)]};
 const r=send(fixture,{type:'strike',pieceId:b.id}),event=r.events[0];if(event?.type!=='Strike')throw Error('Expected Strike');
 expect(event.burst).toBe(true);expect(event.hits).toHaveLength(1);expect(burstCommands(r.state.blades[0]!)).toBe(1);
 expect(r.state.rng.forge.draws-s.rng.forge.draws).toBe(1);
});

test('light guidance distinguishes achievable price, spent ordinary hits, cracks and reserve retrieval',()=>{
 // Local presentation boundary fixtures; actual journal integration is tested separately.
 const s=fresh(),request=kindRequest(s,'light'),b:Blade={...s.blades[0]!,level:3,hits:3,charge:3,value:144};
 expect(assessBlade(s,b,request)).toMatchObject({matches:true,target:144,canDeliver:true});
 expect(assessBlade(s,{...b,value:143},request)).toMatchObject({matches:false,canDeliver:true});
 expect(assessBlade(s,{...b,value:143},request).reason).toContain('三锤内身价不足');
 expect(assessBlade(s,{...b,hits:4,value:999},request).reason).toContain('超过三锤');
 expect(assessBlade(s,{...b,cracked:true},request).matches).toBe(false);
 expect(assessBlade({...s,reserveId:b.id},b,request)).toMatchObject({matches:true,canDeliver:false});
 expect(assessBlade({...s,reserveId:b.id},b,request).reason).toContain('取下留剑');
});

test('all request boundaries describe original blade facts without adding a gate',()=>{
 const s=fresh();for(const kind of ['debut','burst','return','cracked','masterwork','doubleBurst','finale']as const){
  const request=kindRequest(s,kind),b:Blade={...s.blades[0]!,level:9,value:request.target,hits:12,charge:0,cracked:kind==='cracked'};
  expect(assessBlade(s,b,request).matches).toBe(true);
  expect(assessBlade(s,{...b,value:request.target-1},request).matches).toBe(false);
  expect(assessBlade(s,{...b,status:'broken',value:0},request).matches).toBe(false);
  expect(assessBlade(s,{...b,status:'traded'},request).matches).toBe(false);
  if(kind==='return')expect(assessBlade(s,{...b,suppliedRound:request.round},request).matches).toBe(false);
  if(kind==='burst')expect(assessBlade(s,{...b,hits:6,charge:6},request).matches).toBe(false);
  if(kind==='doubleBurst')expect(assessBlade(s,{...b,hits:12,charge:6},request).matches).toBe(false);
 }
});

test('actual practice/defeat endings never promise another customer or a false full-run title',()=>{
 let s=fresh('practice-notebook',3);for(let round=1;round<=3;round++){
  for(const b of s.blades.filter(b=>b.status==='active')){for(let i=0;i<3;i++)s=send(s,{type:'strike',pieceId:b.id}).state;s=send(s,{type:'deliver',pieceId:b.id}).state;}
  s=send(s,{type:'settle'}).state;if(round<3)s=send(s,{type:'advance'}).state;
 }expect(s.phase).toBe('experienceComplete');const practice=getNotebook(s);expect(practice.pages).toHaveLength(3);expect(practice.next).toBeNull();expect(practice.title).toBe(`练手 ${practice.works.length}/3`);
 const defeated=stored('../../docs/evidence/T12-v3/defeat.json'),book=getNotebook(defeated);expect(book.next).toBeNull();expect(book.pages.slice(defeated.round).every(p=>p.status==='unseen'&&p.request===null)).toBe(true);
});

test('chapter names are presentation milestones with no economy output',()=>{
 for(const [count,title]of [[0,'初炉'],[2,'初炉'],[3,'行脚'],[5,'行脚'],[6,'匠作'],[8,'匠作'],[9,'灯炉'],[11,'灯炉'],[12,'灯炉留名']]as const)expect(notebookTitle(count,12)).toBe(title);
 expect(notebookTitle(3,3)).toBe('练手 3/3');
});
