import {describe,expect,it} from 'vitest';
import * as api from '../../src/core-v6/index.js';
import type {Action,PieceId,RunState,School} from '../../src/core-v6/index.js';
import {nextRandom} from '../../src/core/random.js';

// These two literal seeds are declared before executing the new kernel. No seed
// search or edited state is used to construct a legal outcome or boundary.
const CONTRACT_SEED='v6-contract',RISK_SEED='v6-risk';
function created(seed=CONTRACT_SEED){
 const result=api.createRun({runId:'v6-finite-contract',seed});
 if(!result.ok)throw Error('Declared v6 input rejected: '+result.error);
 return result.state;
}
function accepted(state:RunState,action:Action){
 const before=JSON.stringify(state),result=api.applyCommand(state,{runId:state.runId,expectedRevision:state.revision,action});
 if(!result.ok)throw Error(`${state.seed}/${state.phase}/${JSON.stringify(action)}: ${result.error}`);
 expect(JSON.stringify(state)).toBe(before);expect(result.state.revision).toBe(state.revision+1);
 expect(result.state.journal).toEqual([...state.journal,action]);return result;
}
const step=(state:RunState,action:Action)=>accepted(state,action).state;
function blade(state:RunState,pieceId:string){const found=state.blades.find(value=>value.id===pieceId);if(!found)throw Error('Missing '+pieceId);return found;}
function choose(state:RunState,pieceId:PieceId,school:School){return step(state,{type:'chooseSchool',pieceId,school});}
function forge(state:RunState,pieceId:PieceId,count:number){for(let index=0;index<count;index++)state=step(state,{type:'forge',pieceId,useTechnique:false});return state;}
const technique=(state:RunState,pieceId:PieceId)=>step(state,{type:'forge',pieceId,useTechnique:true});
const seal=(state:RunState,pieceId:PieceId)=>step(state,{type:'seal',pieceId});
function rejected(state:RunState,action:unknown,error?:string){
 const before=JSON.stringify(state),result=api.applyCommand(state,{runId:state.runId,expectedRevision:state.revision,action});
 expect(result.ok).toBe(false);expect(result.state).toBe(state);expect(result.events).toEqual([]);
 if(!result.ok&&error!==undefined)expect(result.error).toBe(error);
 expect(JSON.stringify(state)).toBe(before);
}
function replay(state:RunState){
 const restored=api.validateRun(JSON.parse(JSON.stringify(state)));
 expect(restored.ok).toBe(true);if(restored.ok)expect(restored.state).toEqual(state);
 return state;
}
function safeMain(school:'steady'|'fissure'){
 let state=choose(created(),'main-1',school);state=forge(state,'main-1',3);state=technique(state,'main-1');
 return seal(state,'main-1');
}
function riskyMain(school:School){
 let state=choose(created(),'main-1',school);state=forge(state,'main-1',4);
 expect(blade(state,'main-1')).toMatchObject({strength:4,cracked:false,hits:4});
 state=technique(state,'main-1');return seal(state,'main-1');
}
function clearMain(state:RunState,school:School){
 if(school==='steady')state=step(state,{type:'guard'});
 return step(state,{type:'strike',targetId:'main-guard'});
}
function toolBranch(tool:'rebound'|'furnace'){
 const school=tool==='rebound'?'steady':'fissure';let state=clearMain(riskyMain(school),school);
 state=step(state,{type:'takeCache',target:tool==='rebound'?'rope':'latch'});
 expect(state.tool).toBe(tool);expect(state.phase).toBe('echo-forge');return state;
}

describe('forge-v6 approved finite expedition kernel',()=>{
 it('creates a bounded new main forge and validates the whole initial snapshot',()=>{
  const state=created();expect(state.rulesVersion).toBe('forge-v6');expect(state.phase).toBe('main-forge');
  expect(state.blades.map(value=>value.id)).toEqual(['main-1','main-2','main-3']);
  expect(state.blades.every(value=>value.strength===0)).toBe(true);expect(state.charges).toEqual({main:1,echo:0});
  expect(state.coins).toBe(0);expect(state.gateCleared).toBe(false);expect(state.gatePaid).toBe(false);expect(state.tool).toBeNull();
  replay(state);
 });

 it('advances one ordinary RNG draw per safe opening hit and consumes one shared technique without a draw or refund',()=>{
  let state=choose(created(),'main-1','steady');const before=state.rng.forge;
  for(let index=0;index<3;index++){
   const expected=nextRandom(state.rng.forge);state=step(state,{type:'forge',pieceId:'main-1',useTechnique:false});expect(state.rng.forge).toEqual(expected.stream);
   expect(blade(state,'main-1').strength).toBe(index+1);expect(blade(state,'main-1').cracked).toBe(false);
  }
  expect(state.rng.forge.draws).toBe(before.draws+3);const afterOrdinary=state.rng;state=technique(state,'main-1');
  expect(blade(state,'main-1').strength).toBe(4);expect(blade(state,'main-1').cracked).toBe(false);expect(state.rng).toEqual(afterOrdinary);expect(state.charges.main).toBe(0);
  state=step(state,{type:'discard',pieceId:'main-1'});state=choose(state,'main-2','fissure');
  expect(state.charges.main).toBe(0);rejected(state,{type:'forge',pieceId:'main-2',useTechnique:true});replay(state);
 });

 it('uses declared 0/200/350 ticket risks and real damage outcomes in two finite ordinary-only runs',()=>{
  let firstCracks=0,secondCracks=0,capBoundaries=0;
  for(const seed of [CONTRACT_SEED,RISK_SEED]){
   let state=created(seed);
   for(const pieceId of ['main-1','main-2','main-3'] as const){
    if(state.phase!=='main-forge')break;
    state=choose(state,pieceId,'fissure');
    for(let index=0;index<6&&blade(state,pieceId).status!=='broken';index++){
     const before=blade(state,pieceId),expected=nextRandom(state.rng.forge),ticket=Math.floor(expected.value*1000);
     const threshold=before.hits<3?0:before.cracked?350:200;
     const result=accepted(state,{type:'forge',pieceId,useTechnique:false}),event=result.events.find(value=>value.type==='Forged');
     expect(event).toMatchObject({type:'Forged',ticket,crackTickets:threshold,technique:false,chargeBefore:1,chargeAfter:1});
     state=result.state;expect(state.rng.forge).toEqual(expected.stream);expect(blade(state,pieceId).hits).toBe(before.hits+1);
     if(ticket<threshold){
      if(before.cracked){secondCracks++;expect(event).toMatchObject({result:'broken'});expect(blade(state,pieceId).status).toBe('broken');}
      else{firstCracks++;expect(event).toMatchObject({result:'crack',after:Math.max(0,before.strength-1)});expect(blade(state,pieceId)).toMatchObject({cracked:true,fissureMarked:false,strength:Math.max(0,before.strength-1)});if(blade(state,pieceId).hits<6)rejected(state,{type:'forge',pieceId,useTechnique:true},'already_cracked');}
     }else{expect(event).toMatchObject({result:'success',after:before.strength+1});expect(blade(state,pieceId).strength).toBe(before.strength+1);}
    }
    if(blade(state,pieceId).status!=='broken'){
     capBoundaries++;expect(blade(state,pieceId).hits).toBe(6);rejected(state,{type:'forge',pieceId,useTechnique:false},'hammer_limit');
     state=step(state,{type:'discard',pieceId});
    }
    replay(state);
   }
  }
  expect(firstCracks).toBeGreaterThan(0);expect(secondCracks).toBeGreaterThan(0);expect(capBoundaries).toBeGreaterThan(0);
 });

 it('locks a chosen school after the first hit and refuses an empty or reused blade without side effects',()=>{
  let state=choose(created(),'main-1','steady');rejected(state,{type:'seal',pieceId:'main-1'},'empty_blade');
  state=forge(state,'main-1',1);rejected(state,{type:'chooseSchool',pieceId:'main-1',school:'fissure'},'school_locked');
  state=step(state,{type:'discard',pieceId:'main-1'});rejected(state,{type:'chooseSchool',pieceId:'main-1',school:'fissure'});replay(state);
 });

 it('resolves a real final-turn gate kill before exhaustion and pays fifteen exactly once',()=>{
  let state=seal(forge(choose(created(),'main-1','steady'),'main-1',3),'main-1');
  state=step(state,{type:'guard'});state=step(state,{type:'strike',targetId:'main-guard'});
  expect(state.trial).toMatchObject({turnsLeft:1,opening:false,primary:{health:1}});
  const result=accepted(state,{type:'strike',targetId:'main-guard'});state=result.state;
  expect(state.phase).toBe('cache');expect(state.trial).toMatchObject({turnsLeft:0,primary:{health:0}});
  expect(state.coins).toBe(15);expect(state.gatePaid).toBe(true);expect(state.gateCleared).toBe(true);
  expect(result.events.filter(event=>event.type==='GateCleared')).toEqual([{type:'GateCleared',amount:15,turnsLeft:0}]);
  rejected(state,{type:'strike',targetId:'main-guard'});replay(state);
  state=step(state,{type:'leaveCache'});expect(state.phase).toBe('recap');expect(state.coins).toBe(15);
  rejected(state,{type:'leaveCache'});rejected(state,{type:'strike',targetId:'main-guard'});replay(state);
 });

 it('spends repeated guard turns without stacking openings and retains the failed sword record',()=>{
  let state=seal(forge(choose(created(),'main-1','steady'),'main-1',3),'main-1');
  state=step(step(state,{type:'guard'}),{type:'guard'});state=step(state,{type:'strike',targetId:'main-guard'});
  expect(state.phase).toBe('main-forge');expect(state.coins).toBe(0);expect(state.charges.main).toBe(1);
  expect(blade(state,'main-1')).toMatchObject({status:'failed',strength:3});
  expect(state.trials.at(-1)).toMatchObject({turnsLeft:0,primary:{health:1}});replay(state);
 });

 it.each(['steady','fissure'] as const)('keeps the safe %s main route below both cache thresholds and refuses the post-gate guard bypass',school=>{
  const state=clearMain(safeMain(school),school);expect(state.phase).toBe('cache');expect(state.coins).toBe(15);expect(state.tool).toBeNull();
  expect(blade(state,'main-1').strength).toBe(4);expect(state.trial?.opening).toBe(false);
  rejected(state,{type:'takeCache',target:'rope'},'cache_unavailable');rejected(state,{type:'takeCache',target:'latch'},'cache_unavailable');
  rejected(state,{type:'guard'});rejected(state,{type:'strike',targetId:'main-guard'});rejected(state,{type:'chooseSchool',pieceId:'main-2',school:'steady'});
  const view=api.getRunView(state);expect(view.guard.allowed).toBe(false);expect(view.caches.find(cache=>cache.target==='latch')).toMatchObject({allowed:false,actual:school==='fissure'?6:2,required:7});
  const ended=step(state,{type:'leaveCache'});expect(ended.coins).toBe(15);expect(ended.tool).toBeNull();expect(ended.phase).toBe('recap');replay(ended);
 });

 it.each(['steady','fissure'] as const)('earns exactly the %s route tool only after its actual fourth ordinary risk',school=>{
  let state=riskyMain(school);expect(blade(state,'main-1').strength).toBe(school==='steady'?5:7);
  state=clearMain(state,school);expect(state.phase).toBe('cache');expect(state.coins).toBe(15);
  if(school==='fissure')expect(blade(state,'main-1').strength).toBe(5);
  const target=school==='steady'?'rope':'latch',result=accepted(state,{type:'takeCache',target});state=result.state;
  expect(state.tool).toBe(school==='steady'?'rebound':'furnace');expect(state.phase).toBe('echo-forge');expect(state.charges.echo).toBe(1);
  expect(state.blades.filter(piece=>piece.stage==='echo').map(piece=>piece.id)).toEqual(['echo-1','echo-2','echo-3']);
  expect(state.trials.at(-1)?.steps.at(-1)).toMatchObject({action:target,targetBefore:null,targetAfter:null});
  expect(state.coins).toBe(15);if(school==='fissure')expect(blade(state,'main-1').strength).toBe(3);
  rejected(state,{type:'takeCache',target:target==='rope'?'latch':'rope'});rejected(state,{type:'strike',targetId:'main-guard'});replay(state);
 });

 it('stores real rebound overkill and uses the final turn on one explicitly selected follow-up',()=>{
  let state=toolBranch('rebound');state=choose(state,'echo-1','steady');state=forge(state,'echo-1',3);state=technique(state,'echo-1');state=seal(state,'echo-1');
  state=step(state,{type:'guard'});const hit=accepted(state,{type:'strike',targetId:'echo-primary'});state=hit.state;
  expect(state.trial).toMatchObject({turnsLeft:1,storedOverkill:4,reboundTriggered:true,primary:{health:0},secondary:{health:4}});
  expect(hit.events.find(event=>event.type==='FollowUpStored')).toEqual({type:'FollowUpStored',damage:4});expect(state.echo.demonstrated).toBe(false);
  const follow=accepted(state,{type:'followUp',targetId:'echo-secondary'});state=follow.state;
  expect(follow.events.find(event=>event.type==='FollowUpUsed')).toMatchObject({damage:4,healthAfter:0});expect(state.phase).toBe('recap');expect(state.echo).toMatchObject({demonstrated:true,outcome:'demonstrated'});
  expect(state.coins).toBe(15);rejected(state,{type:'followUp',targetId:'echo-secondary'});rejected(state,{type:'takeCache',target:'rope'});replay(state);
 });

 it('ends an insufficient rebound epilogue once without resetting targets, turns, supply, charge or the earned main outcome',()=>{
  let state=toolBranch('rebound');state=seal(forge(choose(state,'echo-1','steady'),'echo-1',3),'echo-1');
  state=step(state,{type:'guard'});state=step(state,{type:'strike',targetId:'echo-primary'});state=step(state,{type:'followUp',targetId:'echo-secondary'});
  expect(state.phase).toBe('recap');expect(state.echo).toMatchObject({demonstrated:false,outcome:'incomplete'});expect(state.coins).toBe(15);expect(state.tool).toBe('rebound');
  expect(state.trials.at(-1)).toMatchObject({turnsLeft:0,primary:{health:0},secondary:{health:1}});expect(state.blades.filter(piece=>piece.stage==='echo')).toHaveLength(3);expect(state.charges.echo).toBe(1);
  rejected(state,{type:'chooseSchool',pieceId:'echo-2',school:'steady'});rejected(state,{type:'followUp',targetId:'echo-secondary'});replay(state);
 });

 it('demonstrates furnace recharge only once and spends that returned charge on another real blank without a new trial',()=>{
  let state=toolBranch('furnace');state=choose(state,'echo-1','fissure');state=forge(state,'echo-1',3);state=technique(state,'echo-1');state=seal(state,'echo-1');expect(state.charges.echo).toBe(0);
  const cleared=accepted(state,{type:'strike',targetId:'echo-primary'});state=cleared.state;
  expect(blade(state,'echo-1').strength).toBe(4);expect(state.phase).toBe('echo-recharge');expect(state.charges.echo).toBe(1);
  expect(cleared.events.filter(event=>event.type==='ChargeRestored')).toEqual([{type:'ChargeRestored',before:0,after:1,gained:1}]);expect(state.echo).toMatchObject({rechargeGained:1,demonstrated:false});
  rejected(state,{type:'strike',targetId:'echo-primary'});const trialBefore=state.trial;
  state=choose(state,'echo-2','fissure');const final=accepted(state,{type:'forge',pieceId:'echo-2',useTechnique:true});state=final.state;
  expect(blade(state,'echo-2')).toMatchObject({strength:3,cracked:true,fissureMarked:true,hits:1});expect(state.charges.echo).toBe(0);expect(state.phase).toBe('recap');expect(state.coins).toBe(15);
  expect(state.echo).toMatchObject({techniqueUsedAfterRecharge:true,demonstrated:true,outcome:'demonstrated'});expect(state.trial).toEqual(trialBefore);expect(final.events.some(event=>event.type==='ChargeRestored')).toBe(false);
  rejected(state,{type:'seal',pieceId:'echo-2'});rejected(state,{type:'forge',pieceId:'echo-3',useTechnique:true});replay(state);
 });

 it('retains weak failures, resets only a new main attempt and exhausts three distinct blanks without a fourth',()=>{
  let state=created();
  for(const pieceId of ['main-1','main-2','main-3'] as const){
   state=seal(forge(choose(state,pieceId,'steady'),pieceId,2),pieceId);expect(state.trial).toMatchObject({turnsLeft:3,primary:{health:6}});
   for(let turn=0;turn<3;turn++)state=step(state,{type:'strike',targetId:'main-guard'});
   expect(blade(state,pieceId)).toMatchObject({status:'failed',strength:2});expect(state.charges.main).toBe(1);expect(state.coins).toBe(0);rejected(state,{type:'seal',pieceId});
  }
  expect(state.phase).toBe('failed');expect(state.blades).toHaveLength(3);expect(state.trials).toHaveLength(3);expect(state.gatePaid).toBe(false);expect(state.tool).toBeNull();
  rejected(state,{type:'chooseSchool',pieceId:'main-4',school:'steady'});replay(state);
 });

 it('rejects malformed commands, stale identities and complete-snapshot or journal tampering',()=>{
  const state=step(safeMain('steady'),{type:'guard'}),before=JSON.stringify(state);
  for(const action of [{type:'future_action'},{type:'forge',pieceId:'main-1',useTechnique:'yes'},{type:'guard',extra:15}])rejected(state,action,'invalid_command');
  for(const command of [{runId:'another-run',expectedRevision:state.revision,action:{type:'guard'}},{runId:state.runId,expectedRevision:state.revision-1,action:{type:'guard'}}]){
   const result=api.applyCommand(state,command);expect(result.ok).toBe(false);expect(result.state).toBe(state);expect(result.events).toEqual([]);
  }
  expect(JSON.stringify(state)).toBe(before);replay(state);
  // These are explicitly invalid save candidates, never fed back as legal states.
  const invalid=[{...state,coins:state.coins+15},{...state,charges:{...state.charges,main:1}},{...state,tool:'furnace'},{...state,revision:state.revision+1},{...state,journal:[...state.journal,{type:'future_action'}]},{...state,journal:state.journal.slice(1)},{...state,rulesVersion:'forge-v5'},{...state,journal:Array.from({length:api.MAX_JOURNAL_ACTIONS+1},()=>({type:'guard'}))}];
  for(const candidate of invalid)expect(api.validateRun(candidate).ok).toBe(false);
 });
});
