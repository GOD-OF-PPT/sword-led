import {expect,test} from 'vitest';
import {createRun,applyCommand,validateRun,strikeOdds,settlementPreview,quotaFor,VALUE_CAP} from '../../src/core-v3/index.js';
import type {Action,RunState,Blade} from '../../src/core-v3/index.js';
import {nextRandom} from '../../src/core/random.js';
function fresh(seed='v3-test',roundLimit:3|12=3){const r=createRun({runId:'unit-v3',seed,roundLimit});if(!r.ok)throw Error(r.error);return r.state;}
function send(s:RunState,action:Action){const r=applyCommand(s,{runId:s.runId,expectedRevision:s.revision,action});if(!r.ok)throw Error(`${action.type}:${r.error}`);return r;}
const strike=(s:RunState,id='r1-1')=>send(s,{type:'strike',pieceId:id});
// Named boundary fixtures prove individual arithmetic, not reachable saves.
function boundary(s:RunState,b:Partial<Blade>,ticket:number):RunState{let n=0;while(Math.floor(nextRandom({state:n,draws:0}).value*1000)!==ticket)n++;return{...s,rng:{...s.rng,forge:{state:n,draws:0}},blades:[{...s.blades[0]!,...b},...s.blades.slice(1)]};}
test('fresh slice is immediately forgeable, deterministic, normalized and isolated',()=>{
 const a=fresh(' e\u0301 ');expect(a.seed).toBe('é');expect(a.blades.map(b=>b.value)).toEqual([40,40,40]);expect(a.gift).toBe('locked');expect(a.roundLimit).toBe(3);expect(strike(a).ok).toBe(true);expect(strike(a).state).toEqual(strike(a).state);expect(validateRun(a).ok).toBe(true);expect(createRun({runId:'bad/path',seed:'x'}).ok).toBe(false);expect(createRun({runId:'ok',seed:''}).ok).toBe(false);
});
test('safe normal arithmetic is immediately available and every ordinary strike uses one draw',()=>{
 let s=fresh();for(const value of [58,84,121]){s=strike(boundary(s,{},500)).state;expect(s.blades[0]?.value).toBe(value);expect(s.rng.forge.draws).toBe(1);}expect(s.blades[0]?.charge).toBe(3);
});
test('great gives two levels but only one risk count and charge',()=>{const s=strike(boundary(fresh(),{},0)).state;expect(s.blades[0]).toMatchObject({value:88,level:2,hits:1,charge:1});});
test('published ordinary risk schedule and cracked-edge ticket conservation',()=>{const s=fresh();for(const [hits,crack]of [0,0,0,50,80,120,180,240,300,360,420,480,500].entries()){const b={...s.blades[0]!,hits,cracked:true};const odds=strikeOdds({...s,traits:['crackedEdge']},b);expect(odds.crack).toBe(crack);expect(odds.great).toBe(250);expect(odds.success+odds.crack+odds.great).toBe(1000);}});
test('first crack preserves a decision; second crack recovers once and cannot pay quota',()=>{
 let s=boundary(fresh(),{value:175,hits:4},160);s=strike(s).state;expect(s.blades[0]).toMatchObject({value:140,cracked:true,status:'active',charge:1});s=boundary(s,{},160);const result=strike(s);s=result.state;expect(s.blades[0]?.status).toBe('broken');expect(s.coins).toBe(10);expect(s.delivered).toBe(0);expect(applyCommand(s,{runId:s.runId,expectedRevision:s.revision,action:{type:'scrap',pieceId:'r1-1'}})).toMatchObject({ok:false,error:'piece_unavailable',state:s});
});
test('burst is atomic, safe, keeps ordinary risk and consumes exactly two draws',()=>{
 const before=boundary(fresh(),{value:366,hits:6,charge:6,cracked:true},500),r=strike(before),b=r.state.blades[0]!;
 expect(r.events[0]).toMatchObject({type:'Strike',burst:true,hits:expect.arrayContaining([expect.objectContaining({result:expect.stringMatching(/success|great/)})])});expect(r.state.rng.forge.draws).toBe(2);expect(b.hits).toBe(6);expect(b.charge).toBe(0);expect(b.cracked).toBe(true);expect(strikeOdds(r.state,b).crack).toBe(180);
});
test('burst cap stops invalid draws; ordinary cap rejection preserves input identity',()=>{
 const s=boundary(fresh(),{value:VALUE_CAP-1,charge:6,hits:6},500),r=strike(s);expect(r.state.rng.forge.draws).toBe(1);expect(r.state.blades[0]?.value).toBe(VALUE_CAP);expect(applyCommand(r.state,{runId:s.runId,expectedRevision:r.state.revision,action:{type:'strike',pieceId:'r1-1'}})).toMatchObject({ok:false,error:'at_cap',state:r.state});
});
test('guard, echo, inheritance, cracked great and ember produce attributed effects',()=>{
 let s=boundary({...fresh(),traits:['steady','echo','inherit']},{value:175,hits:4,successes:2},160);let r=strike(s);expect(r.state.blades[0]?.value).toBe(175);expect(r.events[0]).toMatchObject({hits:[{triggers:['steady']}]});
 s=boundary(r.state,{},500);r=strike(s);expect(r.state.blades[0]?.value).toBe(316);expect(r.events[0]).toMatchObject({hits:[{triggers:['echo']}]});
 s=boundary(r.state,{peak:1000},160);r=strike(s);expect(r.state.pendingInheritance).toBe(200);expect(r.events[0]).toMatchObject({hits:[{triggers:['inherit']}]});
 s=send(r.state,{type:'settle'}).state;s=send(s,{type:'advance'}).state;expect(s.blades.find(b=>b.id==='r2-1')?.base).toBe(200);expect(s.pendingInheritance).toBe(0);expect(s.blades.find(b=>b.id==='r2-2')?.base).toBe(40);
 r=strike(boundary({...fresh(),traits:['crackedEdge']},{cracked:true,hits:5},200));expect(r.events[0]).toMatchObject({hits:[{result:'great',triggers:['crackedEdge']}]});
 r=strike(boundary({...fresh(),traits:['ember']},{charge:6,hits:6},500));expect(r.state.rng.forge.draws).toBe(3);expect(r.events[0]).toMatchObject({hits:[{triggers:['ember']},{triggers:['ember']},{triggers:['ember']}]});
});
test('reserve swaps one reference; stored state crosses rounds without copied value or reset',()=>{
 let s=fresh();for(let i=0;i<4;i++)s=strike(s).state;const exact=s.blades[0];s=send(s,{type:'reserve',pieceId:'r1-1'}).state;
 expect(applyCommand(s,{runId:s.runId,expectedRevision:s.revision,action:{type:'deliver',pieceId:'r1-1'}})).toMatchObject({ok:false,error:'reserved_piece'});
 s=send(s,{type:'settle'}).state;expect(s.history[0]?.recoveredIds).toEqual(['r1-2','r1-3']);s=send(s,{type:'advance'}).state;expect(s.blades.filter(b=>b.status==='active')).toHaveLength(4);expect(s.blades[0]).toEqual(exact);expect(s.rng.forge.draws).toBe(4);
 s=send(s,{type:'reserve',pieceId:'r2-1'}).state;expect(s.reserveId).toBe('r2-1');s=send(s,{type:'reserve',pieceId:'r2-1'}).state;expect(s.reserveId).toBeNull();expect(s.coins).toBe(20);expect(validateRun(s).ok).toBe(true);
});
test('delivery dual counts once, recycle never adds quota, gift and settlement do not duplicate',()=>{
 let s=fresh();for(const pieceId of ['r1-1','r1-2','r1-3']){for(let i=0;i<3;i++)s=strike(s,pieceId).state;s=send(s,{type:'deliver',pieceId}).state;}expect(s.coins).toBe(s.delivered);expect(s.delivered).toBeGreaterThanOrEqual(363);expect(s.gift).toBe('available');
 s=send(s,{type:'claimGift',traitId:'steady'}).state;expect(applyCommand(s,{runId:s.runId,expectedRevision:s.revision,action:{type:'claimGift',traitId:'ember'}}).ok).toBe(false);s=send(s,{type:'settle'}).state;expect(applyCommand(s,{runId:s.runId,expectedRevision:s.revision,action:{type:'settle'}}).ok).toBe(false);expect(validateRun(s).ok).toBe(true);
});
test('third missed round fails before experience end; supplies remain three after missing',()=>{
 let s=fresh();for(let i=1;i<=3;i++){expect(s.blades.filter(b=>b.status==='active')).toHaveLength(3);s=send(s,{type:'settle'}).state;if(i<3)s=send(s,{type:'advance'}).state;}expect(s.phase).toBe('defeat');expect(s.round).toBe(3);expect(s.blades).toHaveLength(9);expect(s.coins).toBe(90);expect(validateRun(s).ok).toBe(true);expect(applyCommand(s,{runId:s.runId,expectedRevision:s.revision,action:{type:'advance'}}).ok).toBe(false);
});
test('pardon is one use per run even when reequipped, and preview agrees with settlement',()=>{
 let s:RunState={...fresh(),traits:['pardon']};expect(settlementPreview(s).protected).toBe(true);s=send(s,{type:'settle'}).state;expect(s.seals).toBe(3);expect(s.pardonUsed).toBe(true);s=send(s,{type:'advance'}).state;expect(settlementPreview(s).protected).toBe(false);s=send(s,{type:'settle'}).state;expect(s.seals).toBe(2);
});
test('merchant opens at fresh round3, quotes persist, trade is exclusive, upgrade is future-only',()=>{
 let s=fresh();for(let i=0;i<2;i++){s=send(s,{type:'settle'}).state;s=send(s,{type:'advance'}).state;}expect(s.shop).toHaveLength(2);expect(new Set(s.shop).size).toBe(2);expect(s.blades.filter(b=>b.status==='active')).toHaveLength(3);const offer=s.shop[0]!;
 s=send(s,{type:'buy',pieceId:'r3-1',traitId:offer}).state;expect(s.blades.find(b=>b.id==='r3-1')?.status).toBe('traded');expect(s.coins).toBe(60);expect(s.delivered).toBe(0);expect(validateRun(s).ok).toBe(true);
 const upgraded=send({...s,coins:1000},{type:'upgrade'}).state;expect(upgraded.base).toBe(80);expect(upgraded.blades.find(b=>b.id==='r3-2')?.base).toBe(40);expect(upgraded.coins).toBe(820);expect(applyCommand(upgraded,{runId:s.runId,expectedRevision:upgraded.revision,action:{type:'upgrade'}}).ok).toBe(false);
 const full={...s,traits:['steady','echo','ember']as const};expect(applyCommand(full,{runId:full.runId,expectedRevision:full.revision,action:{type:'buy',pieceId:'r3-2',traitId:s.shop[1]!}}).ok).toBe(false);
});
test('bad commands, getters, stale identity and malformed journal do not touch a state',()=>{
 const s=fresh();for(const action of [{type:'strike',pieceId:'r1-1',timingMark:5000},{type:'claimGift',traitId:'unknown'},{type:'strike',pieceId:123},{type:'quench'},null])expect(applyCommand(s,{runId:s.runId,expectedRevision:0,action})).toMatchObject({ok:false,state:s});
 expect(applyCommand(s,{runId:'other',expectedRevision:0,action:{type:'settle'}})).toMatchObject({ok:false,error:'wrong_run'});expect(applyCommand(s,{runId:s.runId,expectedRevision:1,action:{type:'settle'}})).toMatchObject({ok:false,error:'stale_revision'});
 let invoked=false;const command={get runId(){invoked=true;return s.runId;}};expect(applyCommand(s,command).ok).toBe(false);expect(invoked).toBe(false);expect(validateRun({...s,coins:99}).ok).toBe(false);expect(validateRun({...s,rulesVersion:'forge-v2'}).ok).toBe(false);
});
test('reachable three-round plans replay across fixed seeds and stop honestly at the slice boundary',()=>{
 for(let seed=0;seed<20;seed++){let s=fresh(`slice-${seed}`);for(let round=1;round<=3;round++){
   for(const b of s.blades.filter(b=>b.status==='active')){let p=s.blades.find(piece=>piece.id===b.id)!;let guard=0;while(p.status==='active'&&p.value<quotaFor(round)-s.delivered&&guard++<12){s=strike(s,p.id).state;p=s.blades.find(piece=>piece.id===b.id)!;}if(p.status==='active')s=send(s,{type:'deliver',pieceId:p.id}).state;}
   s=send(s,{type:'settle'}).state;if(round<3)s=send(s,{type:'advance'}).state;
 }expect(['experienceComplete','defeat']).toContain(s.phase);expect(s.round).toBe(3);expect(s.blades).toHaveLength(9);expect(validateRun(s).ok).toBe(true);const restored=validateRun(JSON.parse(JSON.stringify(s)));expect(restored.ok&&restored.state).toEqual(s);}
});
