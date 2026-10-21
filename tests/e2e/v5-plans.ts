import type {Action,CreateRunInput,RunState} from '../../src/core-v5/model.js';
type Kernel=Pick<typeof import('../../src/core-v5/index.js'),'createRun'|'applyCommand'|'getRunView'|'assessBlade'|'commissionFor'|'commissionProgress'|'atCap'|'validateRun'|'deliveryQuote'>;
export interface JourneyOptions {readonly throughDay?:number;readonly preferOld?:boolean;readonly mixedRelay?:boolean;readonly skipDays?:readonly number[];readonly mod4?:'warmRack'|'windbox';readonly mod8?:'warmRack'|'windbox'|'wideMouth'}

/** Finite player policy, using public assessments only. Every returned action must still be played in UI. */
export function buildJourney(kernel:Kernel,input:CreateRunInput,options:JourneyOptions={}){
 const made=kernel.createRun(input);if(!made.ok)throw Error(made.error);let state=made.state;
 const states:RunState[]=[];const payments:{day:number;pieceId:string;amount:number;baseFee:number;route:string|null}[]=[];
 const send=(action:Action)=>{if(states.length>=400)throw Error('Finite400-command policy budget exceeded');const before=state,result=kernel.applyCommand(state,{runId:state.runId,expectedRevision:state.revision,action});if(!result.ok)throw Error(`${state.day}/${action.type}: ${result.error}`);state=result.state;states.push(state);if(action.type==='deliver'){const q=kernel.deliveryQuote(before,before.blades.find(b=>b.id===action.pieceId)!);payments.push({day:before.day,pieceId:action.pieceId,amount:q.amount,baseFee:q.baseFeeDelta,route:kernel.commissionProgress(state).routeId});}return state;};
 const active=()=>state.blades.filter(b=>b.status==='active'&&b.id!==state.reserveId);
 function grow(id:string,target?:number){
  for(let n=0;n<36;n++){
   const b=state.blades.find(b=>b.id===id)!;if(b.status!=='active'||kernel.atCap(b))return false;
   if(target!==undefined?b.value>=target:kernel.assessBlade(state,b).qualifies)return true;
   if(target===undefined&&kernel.commissionFor(state).routes.every(r=>(r.crack==='intact'&&b.cracked)||(r.maxHits!==undefined&&b.hits>=r.maxHits)||(r.age==='old'&&b.suppliedDay>=state.day)))return false;
   send({type:'strike',pieceId:id});
  }
  return false;
 }
 send({type:'continue'});
 for(let day=1;day<=Math.min(options.throughDay??12,12);day++){
  if(state.day!==day||state.phase!=='workshop')throw Error('Unexpected day/phase');
  if(!options.skipDays?.includes(day)){
   const commission=kernel.commissionFor(state);
   if(options.preferOld&&state.reserveId&&commission.routes.some(r=>r.age==='old')){
    if(options.mixedRelay&&commission.id===11){const fresh=active().find(b=>b.suppliedDay===state.day);if(fresh&&grow(fresh.id))send({type:'deliver',pieceId:fresh.id});}
    const old=state.reserveId;send({type:'reserve',pieceId:old});
    if(kernel.assessBlade(state,state.blades.find(b=>b.id===old)!).qualifies)send({type:'deliver',pieceId:old});
   }
   for(const item of active()){
    if(kernel.commissionProgress(state).complete)break;
    if(grow(item.id))send({type:'deliver',pieceId:item.id});
   }
  }
  if(state.gift==='available')send({type:'claimGift',traitId:'steady'});
  if(options.preferOld&&day<12){
   const next=state.commissionOrder[day]!;
   if(next===5||next===11){
    for(const b of active())if(grow(b.id,next===5?420:1300)){send({type:'reserve',pieceId:b.id});break;}
   }
  }
  const merchant=kernel.getRunView(state).merchant;if(merchant?.canUpgrade)send({type:'upgrade'});
  if(state.seals<3&&kernel.getRunView(state).merchant?.canRepair)send({type:'repair'});
  const settled=send({type:'settle'});
  if(settled.phase==='defeat')break;
  if(settled.phase==='chapter'){
   const preferred=day===4?(options.mod4??'warmRack'):(options.mod8??'windbox');
   send({type:'chooseModification',modification:settled.chapterChoices.includes(preferred)?preferred:settled.chapterChoices[0]!});
  }
  if(day<Math.min(options.throughDay??12,12))send({type:'advance'});
 }
 const checked=kernel.validateRun(state);if(!checked.ok)throw Error(checked.detail);
 return{input,options,actions:state.journal,state,states,payments,scope:'Finite public-assessment policy; this SDK plan alone is not a UI journey, fun judgement or balance simulation.'};
}

/** Replay an immutable approved witness prefix. Does not assign phase, resources or random state. */
export function replayV5(kernel:Kernel,input:CreateRunInput,actions:readonly Action[]){
 const made=kernel.createRun(input);if(!made.ok)throw Error(made.error);let state=made.state;
 for(const action of actions){const r=kernel.applyCommand(state,{runId:state.runId,expectedRevision:state.revision,action});if(!r.ok)throw Error(`${state.day}/${action.type}:${r.error}`);state=r.state;}
 const checked=kernel.validateRun(state);if(!checked.ok)throw Error(checked.detail);return state;
}
