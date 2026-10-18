import {test,expect} from 'vitest';
import {createRun,applyCommand} from '../../src/core-v2/index.js';
import type {Action,RunState} from '../../src/core-v2/index.js';

test('v2 formal strikes include both timing-band endpoints and reject bad timing independently of a valid target',()=>{
  const created=createRun({runId:'timing-bounds',seed:'timing-bounds'});if(!created.ok)throw Error(created.error);let state:RunState=created.state;
  for(const action of [{type:'chooseTechnique',techniqueId:'bridgeClip'},{type:'chooseRequest',requestId:null}] satisfies Action[]){const r=applyCommand(state,{runId:state.runId,expectedRevision:state.revision,action});if(!r.ok)throw Error(r.error);state=r.state;}
  const before=JSON.stringify(state);
  for(const [mark,grade,gained,stress] of [[0,'mishit',4,22],[2999,'mishit',4,22],[3000,'ordinary',5,12],[4399,'ordinary',5,12],[4400,'precise',5,10],[5000,'precise',5,10],[5600,'precise',5,10],[5601,'ordinary',5,12],[7000,'ordinary',5,12],[7001,'mishit',4,22],[10000,'mishit',4,22]] as const){
    const r=applyCommand(state,{runId:state.runId,expectedRevision:state.revision,action:{type:'strike',pieceId:'1:1',node:0,mode:'heavy',timingMark:mark}});if(!r.ok)throw Error(r.error);
    expect(r.events[0]).toMatchObject({type:'strike',grade});expect(r.state.pieces[0]).toMatchObject({ratings:{edge:gained,toughness:2,balance:0},heat:76,stress,integrity:4,nodes:[5,0,0,0,0,0,0,0,0,0]});expect(r.state.rng).toEqual(state.rng);
  }
  for(const mark of [-1,10001,5000.5,NaN,Infinity,-Infinity,'5000',undefined,null]){const r=applyCommand(state,{runId:state.runId,expectedRevision:state.revision,action:{type:'strike',pieceId:'1:1',node:0,mode:'heavy',timingMark:mark}});expect(r).toMatchObject({ok:false,error:'invalid_timing',events:[]});expect(r.state).toBe(state);}
  expect(JSON.stringify(state)).toBe(before);
});
