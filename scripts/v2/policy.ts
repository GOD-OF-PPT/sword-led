import { applyCommand, createRun, getCollection, previewQuench, previewStrike, validateRun } from '../../src/core-v2/index.js';
import type { Action, HammerMode, RunState, Technique } from '../../src/core-v2/index.js';
import { HAMMERS, marketValue, quotaFor, requestBonus, TECHNIQUES } from '../../src/core-v2/rules.js';
import { hashUtf8, nextRandom } from '../../src/core/random.js';
import { timingMarkAt } from '../../src/platform/timing.js';

export type Policy='light'|'balanced'|'heavy'|'raw'|'salvage';
export type Accuracy='perfect'|'steady'|'shaky';
export interface RecordRow { readonly seed:string;readonly policy:Policy;readonly starter:Technique;readonly accuracy:Accuracy;readonly phase:RunState['phase'];readonly rounds:number;readonly met:number;readonly strikes:number;readonly broken:number;readonly orders:number;readonly coins:number;readonly scrap:number;readonly patterns:number;readonly actions:number }
export function simulateV2(seed:string,policy:Policy,starter:Technique,accuracy:Accuracy='perfect'):{row:RecordRow;state:RunState}{
  const created=createRun({runId:'v2-strategy',seed});if(!created.ok)throw Error(created.error);let state=created.state;
  let inputRandom={state:hashUtf8(`${seed}|v2-input-error`),draws:0};
  function send(action:Action){const r=applyCommand(state,{runId:state.runId,expectedRevision:state.revision,action});if(!r.ok)throw Error(`${policy}/${state.round}/${action.type}: ${r.error}`);state=r.state;}
  send({type:'chooseTechnique',techniqueId:starter});
  for(let guard=0;guard<1000;guard++){
    if(state.phase==='victory'||state.phase==='defeat')break;
    if(state.phase==='roundSummary'){send({type:'advanceSummary'});continue;}
    if(state.phase==='merchant'){
      for(const id of state.merchant){const price=TECHNIQUES[id];if(state.techniques.length<3&&!state.techniques.includes(id)&&state.coins>=price.coins&&state.scrap>=price.scrap)send({type:'buy',productId:id});}
      if(state.seals<3&&state.coins>=240&&state.scrap>=6)send({type:'buy',productId:'repair'});send({type:'leaveMerchant'});continue;
    }
    if(!state.requestDecided){const preference=starter==='bridgeClip'?'courier':'guard',chosen=state.requests.find(r=>r.kind===preference)??state.requests[0];send({type:'chooseRequest',requestId:policy==='raw'||policy==='salvage'?null:chosen?.id??null});}
    for(let slot=0;slot<3;slot++){
      let p=state.pieces[slot];if(!p||p.status!=='active')continue;
      const delivered=state.pieces.reduce((n,p)=>n+p.paidValue,0);
      if(policy==='salvage'||(policy!=='raw'&&delivered+state.credit>=quotaFor(state.round))){send({type:'scrap',pieceId:p.id});continue;}
      if(policy==='raw'){send({type:'deliver',pieceId:p.id});continue;}
      const route=starter==='bridgeClip'?[2,7,8,0,1,6]:[0,1,2,7,8,9];
      const plan=policy==='heavy'?[0,1,2,3,4,9,8,7,6]:[...route,...(policy==='balanced'&&slot<2?[0,5,6,1,2,3]:[])];
      let reheated=false;
      for(const node of plan){
        p=state.pieces[slot];if(!p||p.status!=='active')break;
        let mode:HammerMode=policy==='light'?'light':policy==='heavy'?'heavy':'standard';
        let preview=previewStrike(state,p,node,mode,'precise');
        if(!preview.allowed&&preview.reason==='no_heat'&&policy!=='light'&&slot<2&&!reheated&&state.coal>0){send({type:'reheat',pieceId:p.id});reheated=true;p=state.pieces[slot];if(!p)throw Error('piece');preview=previewStrike(state,p,node,mode,'precise');}
        if(!preview.allowed){mode='light';preview=previewStrike(state,p,node,mode,'precise');}
        if(preview.allowed){const d=nextRandom(inputRandom);inputRandom=d.stream;const error=(2*d.value-1)*(accuracy==='perfect'?0:accuracy==='steady'?90:190);const timingMark=timingMarkAt(HAMMERS[mode].periodMs/4+error,HAMMERS[mode].periodMs);send({type:'strike',pieceId:p.id,node,mode,timingMark});}
      }
      p=state.pieces[slot];if(!p||p.status!=='active')continue;
      const request=state.requests.find(r=>r.id===state.acceptedRequestId);
      const candidates=(['water','oil']as const).map(medium=>{const o=previewQuench(state,p,medium);return{medium,o,value:o.allowed?marketValue(o.piece)+(request&&state.fulfilledRequestId===null?requestBonus(o.piece,request,state.condition):0):-1};}).filter(c=>c.o.allowed&&c.o.piece.status!=='broken').sort((a,b)=>b.value-a.value);
      const selected=candidates[0];if(selected)send({type:'quench',pieceId:p.id,medium:selected.medium});
      if(state.pieces[slot]?.status==='active')send({type:'deliver',pieceId:p.id});
    }
    send({type:'settleRound',recycleRemaining:true});
  }
  if(state.phase!=='victory'&&state.phase!=='defeat')throw Error('Policy did not terminate');
  const checked=validateRun(state);if(!checked.ok)throw Error(checked.detail);
  const pieces=getCollection(state);return{state,row:{seed,policy,starter,accuracy,phase:state.phase,rounds:state.round,met:state.history.filter(h=>h.met).length,strikes:pieces.reduce((n,p)=>n+p.strikes,0),broken:pieces.filter(p=>p.status==='broken').length,orders:state.returns.length,coins:state.coins,scrap:state.scrap,patterns:pieces.reduce((n,p)=>n+p.patterns.length,0),actions:state.journal.length}};
}
