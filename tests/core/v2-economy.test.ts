import { expect, test } from 'vitest';
import { applyCommand, createRun, getCollection, previewQuench, previewStrike, validateRun } from '../../src/core-v2/index.js';
import type { Action, RunState, Technique } from '../../src/core-v2/index.js';
import { MATERIALS, TECHNIQUES } from '../../src/core-v2/rules.js';
import { simulateV2 } from '../../scripts/v2/policy.js';

function step(state:RunState,action:Action){const result=applyCommand(state,{runId:state.runId,expectedRevision:state.revision,action});if(!result.ok)throw Error(`${action.type}: ${result.error}`);return result.state;}
function atMerchant(predicate:(state:RunState)=>boolean):RunState{
  const witness=simulateV2('v2-trade-contract','balanced','bridgeClip').state,created=createRun({runId:witness.runId,seed:witness.seed});if(!created.ok)throw Error('run');let state=created.state;
  for(const action of witness.journal){state=step(state,action);if(state.phase==='merchant'&&predicate(state))return state;}
  throw Error('No reachable matching merchant');
}
function acquire(id:Technique):RunState{
  let state=atMerchant(s=>s.merchant.includes(id)&&!s.techniques.includes(id)&&s.coins>=TECHNIQUES[id].coins&&s.scrap>=TECHNIQUES[id].scrap);
  state=step(state,{type:'buy',productId:id,...(state.techniques.length>=3&&state.techniques[0]?{replaceId:state.techniques[0]}:{})});state=step(state,{type:'leaveMerchant'});return step(state,{type:'chooseRequest',requestId:null});
}

test('full v2 campaign is reachable and seeded later-round conditions are complete and replayable',()=>{
  const result=simulateV2('v2-full-proof','balanced','edgeTooth');expect(result.state.phase).toBe('victory');expect(result.state.history).toHaveLength(12);expect(getCollection(result.state)).toHaveLength(36);
  for(const [i,h]of result.state.history.entries()){
    expect(h.pieces).toHaveLength(3);expect(h.pieces.every(p=>p.status!=='active')).toBe(true);
    if(i>=4)expect(h.condition.kind).not.toBe(result.state.history[i-1]?.condition.kind);
    for(const p of h.pieces){expect(p.threshold).toBe(MATERIALS[p.material].threshold-(h.condition.kind==='brittle'?4:0));expect(p.baseValue).toBe(MATERIALS[p.material].value-(h.condition.kind==='reclaimed'?4:0));}
  }
  expect(result.state.rng.stock.draws).toBe(11);expect(result.state.rng.requests.draws).toBe(22);expect(result.state.history[11]?.round).toBe(12);expect(validateRun(result.state).ok).toBe(true);
  expect(simulateV2('v2-full-proof','balanced','edgeTooth').state).toEqual(result.state);
},15000);

test('full slots require an atomic paid replacement, preserving the exact old build on a refusal',()=>{
  const available=(s:RunState,id:Technique)=>!s.techniques.includes(id)&&!s.purchases.some(p=>p.afterRound===s.round&&p.productId===id);
  const state=atMerchant(s=>s.techniques.length===3&&s.coins>=160&&s.scrap>=5&&s.merchant.some(id=>available(s,id))),id=state.merchant.find(id=>available(state,id)),old=state.techniques[0];if(!id||!old)throw Error('merchant');
  const command={runId:state.runId,expectedRevision:state.revision,action:{type:'buy',productId:id}};
  expect(applyCommand(state,command)).toMatchObject({ok:false,error:'replacement_required',state});
  expect(applyCommand(state,{...command,action:{type:'buy',productId:id,replaceId:id}})).toMatchObject({ok:false,error:'invalid_replacement',state});
  const next=step(state,{type:'buy',productId:id,replaceId:old});expect(next.techniques).toHaveLength(3);expect(next.techniques).toContain(id);expect(next.techniques).not.toContain(old);
  expect(next.coins).toBe(state.coins-TECHNIQUES[id].coins);expect(next.scrap).toBe(state.scrap-TECHNIQUES[id].scrap);expect(next.purchases.at(-1)?.replaced).toBe(old);expect(validateRun(next).ok).toBe(true);
},15000);

test('warm tongs count only two real heavy strikes and publish both their saving and stress cost',()=>{
  let state=acquire('warmTongs');const pieceId=state.pieces[0]?.id;if(!pieceId)throw Error('piece');
  for(let i=0;i<3;i++){const p=state.pieces[0];if(!p)throw Error('piece');const outcome=previewStrike(state,p,i,'heavy','precise');expect(outcome.allowed).toBe(true);expect(outcome.heatCost).toBe(i<2?20:24);expect(outcome.stressAdded).toBe(10+(i<2?2:0)+(state.condition.kind==='brightFire'?2:0));state=step(state,{type:'strike',pieceId,node:i,mode:'heavy',timingMark:5000});}
  expect(state.pieces[0]?.heavyStrikes).toBe(3);expect(validateRun(state).ok).toBe(true);
},15000);

test('balance weight checks the pre-quench spread and cannot be applied twice',()=>{
  let state=acquire('balanceWeight');const piece=state.pieces[0];if(!piece)throw Error('piece');
  const min=Object.entries(piece.ratings).sort((a,b)=>a[1]-b[1])[0]?.[0],node=min==='edge'?0:min==='toughness'?5:2;
  state=step(state,{type:'strike',pieceId:piece.id,node,mode:'light',timingMark:5000});const before=state.pieces[0];if(!before)throw Error('piece');expect(Math.max(...Object.values(before.ratings))-Math.min(...Object.values(before.ratings))).toBeLessThanOrEqual(4);
  const preview=previewQuench(state,before,'oil');expect(preview.piece.ratings.balance).toBe(before.ratings.balance+3);state=step(state,{type:'quench',pieceId:piece.id,medium:'oil'});expect(state.pieces[0]).toEqual(preview.piece);expect(validateRun(state).ok).toBe(true);
  expect(applyCommand(state,{runId:state.runId,expectedRevision:state.revision,action:{type:'quench',pieceId:piece.id,medium:'oil'}})).toMatchObject({ok:false,error:'already_quenched'});
},15000);

test('the first actual broken sword pays the shard-box recovery instead of order progress',()=>{
  let state=acquire('shardBox');const initialScrap=state.scrap,id=state.pieces[0]?.id;if(!id)throw Error('piece');
  for(let node=0;node<10&&state.pieces[0]?.status==='active';node++){
    let p=state.pieces[0];if(!p)throw Error('piece');let o=previewStrike(state,p,node,'heavy','mishit');
    if(!o.allowed&&o.reason==='no_heat'&&state.coal>0){state=step(state,{type:'reheat',pieceId:id});const refreshed=state.pieces[0];if(!refreshed)throw Error('piece');o=previewStrike(state,refreshed,node,'heavy','mishit');}
    if(o.allowed)state=step(state,{type:'strike',pieceId:id,node,mode:'heavy',timingMark:0});
  }
  if(state.pieces[0]?.status==='active')state=step(state,{type:'quench',pieceId:id,medium:'water'});
  expect(state.pieces[0]).toMatchObject({status:'broken',recoveredScrap:5,paidValue:0});expect(state.scrap).toBe(initialScrap+5);expect(state.roundBreaks).toBe(1);expect(validateRun(state).ok).toBe(true);
},15000);
