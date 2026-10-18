import { describe, expect, test } from 'vitest';
import { applyCommand, createRun, getCollection, getRunView, getTrial, getCustomerVisits, previewStrike, validateRun } from '../../src/core-v2/index.js';
import type { Action, RunState, Technique } from '../../src/core-v2/index.js';

function fresh(seed='v2-contract',starter:Technique='bridgeClip',request:string|null='1:guard'):RunState {
  const created=createRun({runId:'test-v2',seed});if(!created.ok)throw Error(created.error);
  return step(step(created.state,{type:'chooseTechnique',techniqueId:starter}),{type:'chooseRequest',requestId:request});
}
function step(state:RunState,action:Action):RunState {
  const result=applyCommand(state,{runId:state.runId,expectedRevision:state.revision,action});if(!result.ok)throw Error(`${action.type}: ${result.error}`);return result.state;
}
function strike(state:RunState,node:number,mark=5000,mode:'light'|'standard'|'heavy'='standard',pieceId='1:1'){return step(state,{type:'strike',pieceId,node,mode,timingMark:mark});}
function sample(medium:'water'|'oil'){
  let state=fresh();for(const node of[0,1,2,7,8,9])state=strike(state,node);return step(state,{type:'quench',pieceId:'1:1',medium});
}

describe('forge-v2 actual public-command contract',()=>{
  test('a received customer visit preserves the actual delivered sword, performance and one paid thank-you',()=>{
    let state=step(sample('oil'),{type:'deliver',pieceId:'1:1'});expect(getCustomerVisits(state)).toEqual([]);state=step(state,{type:'settleRound',recycleRemaining:true});state=step(state,{type:'advanceSummary'});state=step(state,{type:'chooseRequest',requestId:null});state=step(state,{type:'settleRound',recycleRemaining:true});expect(getCustomerVisits(state)).toEqual([]);state=step(state,{type:'advanceSummary'});const raw=JSON.stringify(state),visits=getCustomerVisits(state);expect(visits).toHaveLength(1);expect(visits[0]).toMatchObject({pieceId:'1:1',kind:'guard',receivedRound:3,scrap:1,trial:{cut:2,block:4,handling:2},piece:{status:'delivered',paidValue:200,strikes:6,quench:'oil'}});expect(Object.isFrozen(visits[0]?.piece.nodes)).toBe(true);getCustomerVisits(state);expect(JSON.stringify(state)).toBe(raw);expect(validateRun(state).ok).toBe(true);
  });

  test('read-only technique status follows real per-sword activations without changing an existing save',()=>{
    let edge=fresh('status','edgeTooth');expect(getRunView(edge).techniques[0]).toMatchObject({short:'待巡锋'});
    for(const node of[0,1,2])edge=strike(edge,node);expect(getRunView(edge).techniques[0]).toMatchObject({short:'已生效'});
    let bridge=fresh('status','bridgeClip');for(const node of[0,5,6])bridge=strike(bridge,node);expect(getRunView(bridge).techniques[0]).toMatchObject({short:'保护就绪'});
    bridge=step(bridge,{type:'quench',pieceId:'1:1',medium:'water'});expect(getRunView(bridge).techniques[0]).toMatchObject({short:'已使用'});
    let sand=fresh('status','reheatSand');expect(getRunView(sand).techniques[0]).toMatchObject({short:'余1次'});sand=strike(sand,0);sand=step(sand,{type:'reheat',pieceId:'1:1'});expect(getRunView(sand).techniques[0]).toMatchObject({short:'已使用'});
    const raw=JSON.stringify(sand);getRunView(sand);expect(JSON.stringify(sand)).toBe(raw);expect(validateRun(sand)).toMatchObject({ok:true});
  });
  test('creation normalises once, freezes owned data and requires both explicit decisions',()=>{
    const input={runId:'valid',seed:'  e\u0301  '},created=createRun(input);expect(input.seed).toBe('  e\u0301  ');if(!created.ok)throw Error('creation');
    expect(created.state.seed).toBe('é');expect(created.state.pieces.map(p=>p.material)).toEqual(['iron','iron','steel']);expect(Object.isFrozen(created.state.pieces[0]?.nodes)).toBe(true);
    expect(applyCommand(created.state,{runId:'valid',expectedRevision:0,action:{type:'strike',pieceId:'1:1',node:0,mode:'standard',timingMark:5000}})).toMatchObject({ok:false,error:'choose_technique'});
    const chosen=step(created.state,{type:'chooseTechnique',techniqueId:'bridgeClip'});expect(applyCommand(chosen,{runId:'valid',expectedRevision:1,action:{type:'settleRound',recycleRemaining:true}})).toMatchObject({ok:false,error:'choose_request'});
    expect(createRun({runId:'<script>',seed:'ok'})).toMatchObject({ok:false,error:'invalid_run_id'});expect(createRun({runId:'a',seed:' '.repeat(4)})).toMatchObject({ok:false,error:'invalid_seed'});
  });

  test('approved six-strike sample includes low-heat stress and two different real quench outcomes',()=>{
    const oil=sample('oil'),water=sample('water');
    expect(oil.pieces[0]).toMatchObject({ratings:{edge:7,toughness:12,balance:6},stress:24,heat:4,integrity:4,patterns:['edge','spine']});
    expect(water.pieces[0]).toMatchObject({ratings:{edge:10,toughness:9,balance:6},stress:0,integrity:3});
    expect(getRunView(oil).selected).toMatchObject({value:160,requestBonus:40,trial:{cut:2,block:4,handling:2}});
    expect(getRunView(water).selected).toMatchObject({value:154,requestBonus:60,trial:{cut:3,block:3,handling:2}});
    const soldOil=step(oil,{type:'deliver',pieceId:'1:1'}),soldWater=step(water,{type:'deliver',pieceId:'1:1'});
    expect(soldOil.coins).toBe(200);expect(soldWater.coins).toBe(214);expect(soldOil.returns).toHaveLength(1);
    expect(validateRun(soldOil)).toMatchObject({ok:true});expect(validateRun(soldWater)).toMatchObject({ok:true});
  });

  test('every grade forecast matches settlement without consuming the caller or a random stream',()=>{
    for(const [mark,grade]of [[5000,'precise'],[6500,'ordinary'],[9999,'mishit']]as const){
      const state=fresh(),before=JSON.stringify(state),piece=state.pieces[0];if(!piece)throw Error('piece');
      const preview=previewStrike(state,piece,0,'heavy',grade),next=strike(state,0,mark,'heavy');
      expect(next.pieces[0]).toEqual(preview.piece);expect(next.rng).toEqual(state.rng);expect(JSON.stringify(state)).toBe(before);
      expect(next.revision).toBe(state.revision+1);expect(next.journal.at(-1)).toMatchObject({type:'strike',node:0,timingMark:mark});
    }
  });

  test('capacity, timing, stale and foreign inputs reject without state changes',()=>{
    let state=fresh();state=strike(strike(state,0),0);
    for(const command of[
      {runId:state.runId,expectedRevision:state.revision,action:{type:'strike',pieceId:'1:1',node:0,mode:'light',timingMark:5000}},
      {runId:'other',expectedRevision:state.revision,action:{type:'scrap',pieceId:'1:1'}},
      {runId:state.runId,expectedRevision:state.revision-1,action:{type:'scrap',pieceId:'1:1'}},
      {runId:state.runId,expectedRevision:state.revision,action:{type:'strike',pieceId:'1:1',node:10,mode:'light',timingMark:NaN}},
    ]){const before=JSON.stringify(state),result=applyCommand(state,command);expect(result.ok).toBe(false);expect(result.state).toBe(state);expect(JSON.stringify(state)).toBe(before);}
  });

  test('three different connected marks award once; repeat, jump, miss and reheat break the temporary chain',()=>{
    let state=fresh();for(const node of[0,1,2])state=strike(state,node);
    expect(state.pieces[0]?.patterns).toEqual(['edge']);expect(state.pieces[0]?.chain).toEqual([]);
    state=step(state,{type:'reheat',pieceId:'1:1'});for(const node of[0,1,2])state=strike(state,node);
    expect(state.pieces[0]?.patterns).toEqual(['edge']);expect(state.pieces[0]?.traces.map(t=>t.rewarded)).toEqual([true,false]);
    state=strike(state,4,5000,'light');expect(state.pieces[0]?.chain).toEqual([4]);state=strike(state,4,5000,'light');expect(state.pieces[0]?.chain).toEqual([4]);
    state=step(state,{type:'reheat',pieceId:'1:1'});expect(state.pieces[0]?.chain).toEqual([]);expect(state.pieces[0]?.nodes[0]).toBe(6);
    state=strike(state,9,0,'light');expect(state.pieces[0]?.chain).toEqual([]);
  });

  test('the three starters alter their named operations and no quench can be claimed twice',()=>{
    let edge=fresh('starter','edgeTooth');for(const node of[0,1,2])edge=strike(edge,node);expect(edge.pieces[0]?.ratings.edge).toBe(10);
    let bridge=fresh('starter','bridgeClip');for(const node of[0,5,6])bridge=strike(bridge,node);expect(bridge.pieces[0]?.patterns).toEqual(['bridge']);
    bridge=step(bridge,{type:'quench',pieceId:'1:1',medium:'water'});expect(bridge.pieces[0]).toMatchObject({stress:12,bridgeUsed:true});
    let sand=fresh('starter','reheatSand');sand=strike(sand,0);sand=step(sand,{type:'reheat',pieceId:'1:1'});expect(sand.pieces[0]?.ratings.toughness).toBe(4);
    sand=strike(sand,1);sand=step(sand,{type:'reheat',pieceId:'1:1'});expect(sand.pieces[0]?.ratings.toughness).toBe(4);expect(sand.coal).toBe(0);
    expect(applyCommand(bridge,{runId:bridge.runId,expectedRevision:bridge.revision,action:{type:'quench',pieceId:'1:1',medium:'oil'}})).toMatchObject({ok:false,error:'already_quenched'});
  });

  test('heavy ordinary heat work crosses the public threshold, never a hidden random failure',()=>{
    let state=fresh();for(const node of[0,1,2,3])state=strike(state,node,6500,'heavy');
    expect(state.pieces[0]).toMatchObject({heat:4,stress:8,integrity:3,strikes:4});
    expect(applyCommand(state,{runId:state.runId,expectedRevision:state.revision,action:{type:'strike',pieceId:'1:1',node:4,mode:'heavy',timingMark:5000}})).toMatchObject({ok:false,error:'no_heat'});
  });

  test('delivery, credit and the work collection are one-time, and view-only trials preserve the exact state',()=>{
    let state=step(sample('oil'),{type:'deliver',pieceId:'1:1'});const raw=JSON.stringify(state),p=state.pieces[0];if(!p)throw Error('piece');
    for(let i=0;i<4;i++){getTrial(p);getCollection(state);getRunView(state);}expect(JSON.stringify(state)).toBe(raw);
    expect(applyCommand(state,{runId:state.runId,expectedRevision:state.revision,action:{type:'deliver',pieceId:'1:1'}})).toMatchObject({ok:false,error:'piece_finalized'});
    state=step(state,{type:'settleRound',recycleRemaining:true});expect(state.history[0]).toMatchObject({delivered:200,quota:150,credit:0,nextCredit:25,met:true});expect(state.scrap).toBe(7);
    expect(getCollection(state)).toHaveLength(3);state=step(state,{type:'advanceSummary'});expect(state.credit).toBe(25);expect(getCollection(state)).toHaveLength(6);
    expect(validateRun(state)).toMatchObject({ok:true});
    const corrupted=structuredClone(state);Object.assign(corrupted,{coins:999999});expect(validateRun(corrupted)).toMatchObject({ok:false,error:'invalid_state'});
  });

  test('three genuine all-salvage rounds fail and cannot enter a final merchant',()=>{
    let state=fresh('salvage','bridgeClip',null);
    for(let round=1;round<=3;round++){
      state=step(state,{type:'settleRound',recycleRemaining:true});
      if(round<3){state=step(state,{type:'advanceSummary'});state=step(state,{type:'chooseRequest',requestId:null});}
    }
    expect(state).toMatchObject({phase:'defeat',round:3,seals:0,coins:0});expect(getCollection(state)).toHaveLength(9);expect(validateRun(state)).toMatchObject({ok:true});
    expect(applyCommand(state,{runId:state.runId,expectedRevision:state.revision,action:{type:'advanceSummary'}})).toMatchObject({ok:false,error:'wrong_phase'});
  });

  test('credit helps only one round and is not paid or recycled into future credit',()=>{
    let state=step(step(sample('oil'),{type:'deliver',pieceId:'1:1'}),{type:'settleRound',recycleRemaining:true});state=step(state,{type:'advanceSummary'});state=step(state,{type:'chooseRequest',requestId:null});
    for(const node of[0,1,2,7,8,9])state=strike(state,node,5000,'standard','2:1');state=step(state,{type:'quench',pieceId:'2:1',medium:'oil'});state=step(state,{type:'deliver',pieceId:'2:1'});state=step(state,{type:'settleRound',recycleRemaining:true});
    expect(state.history[1]).toMatchObject({delivered:160,quota:180,credit:25,met:true,nextCredit:0});expect(state.coins).toBe(360);expect(validateRun(state)).toMatchObject({ok:true});
  });

  test('early defeat cannot pay a future customer return before its due round',()=>{
    let state=step(step(sample('oil'),{type:'deliver',pieceId:'1:1'}),{type:'settleRound',recycleRemaining:true});state=step(state,{type:'advanceSummary'});state=step(state,{type:'chooseRequest',requestId:null});state=step(state,{type:'settleRound',recycleRemaining:true});state=step(state,{type:'advanceSummary'});
    const request=state.requests.find(r=>r.kind!=='protector');if(!request)throw Error('two unique templates');state=step(state,{type:'chooseRequest',requestId:request.id});
    for(const node of[0,1,2,7,8,9])state=strike(state,node,5000,'standard','3:1');state=step(state,{type:'quench',pieceId:'3:1',medium:request.kind==='hunter'?'water':'oil'});state=step(state,{type:'deliver',pieceId:'3:1'});state=step(state,{type:'settleRound',recycleRemaining:true});
    expect(state.history[2]?.met).toBe(false);state=step(state,{type:'advanceSummary'});expect(state.phase).toBe('merchant');state=step(state,{type:'leaveMerchant'});state=step(state,{type:'chooseRequest',requestId:null});state=step(state,{type:'settleRound',recycleRemaining:true});
    expect(state).toMatchObject({round:4,phase:'defeat',seals:0});expect(state.returns.find(r=>r.pieceId==='3:1')).toMatchObject({dueRound:5,received:false});expect(getCustomerVisits(state).some(v=>v.pieceId==='3:1')).toBe(false);expect(validateRun(state)).toMatchObject({ok:true});
  });

  test('reheat sand opens a short guard-request recipe that the same paid reheat cannot otherwise fulfil',()=>{
    const outcomes=[];
    for(const starter of['bridgeClip','reheatSand']as const){let state=fresh('paired-reheat',starter);for(const node of[0,1,2])state=strike(state,node);state=step(state,{type:'reheat',pieceId:'1:1'});state=step(state,{type:'quench',pieceId:'1:1',medium:'oil'});outcomes.push(getRunView(state).selected?.requestBonus);expect(state.coal).toBe(1);expect(validateRun(state).ok).toBe(true);}
    expect(outcomes).toEqual([0,40]);
  });

  test('bridge clip makes a genuinely reachable last-integrity water quench viable',()=>{
    const results=[];
    for(const starter of['edgeTooth','bridgeClip']as const){
      let state=fresh('paired-water',starter,null);
      for(const [i,node]of[0,5,6,1,2,7,3,8,4,9].entries()){if(i===4||i===8)state=step(state,{type:'reheat',pieceId:'1:3'});state=strike(state,node,6500,'heavy','1:3');}
      for(const node of[0,1,2,3])state=strike(state,node,6500,'light','1:3');
      expect(state.pieces[2]).toMatchObject({integrity:1,stress:28,heat:20,patterns:['bridge','edge']});
      state=step(state,{type:'quench',pieceId:'1:3',medium:'water'});results.push(state.pieces[2]?.status);expect(validateRun(state).ok).toBe(true);
    }
    expect(results).toEqual(['broken','active']);
  });
});
