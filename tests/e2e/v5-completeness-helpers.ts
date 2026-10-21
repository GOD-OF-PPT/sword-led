// Current v5 UI boundaries. Each test labels restored fixtures and fresh openings explicitly.
import type {Action,CreateRunInput,RunState} from '../../src/core-v5/index.js';

type Kernel=Pick<typeof import('../../src/v5-sdk.js'),'createRun'|'applyCommand'|'getRunView'|'assessBlade'|'commissionProgress'|'validateRun'>;

/** Reuse the actual merchant witness, then finish days6/7 through public assessments.
 * No resource, trait, pardonUsed, phase or random-state assignment is permitted here.
 * The two returned states are explicitly restored boundaries, not UI playthroughs.
 */
export function protectedTwinBoundaries(sdk:Kernel,input:CreateRunInput,marketActions:readonly Action[]):readonly [RunState,RunState]{
 const made=sdk.createRun(input);if(!made.ok)throw Error(made.error);let state=made.state;
 const send=(action:Action)=>{const next=sdk.applyCommand(state,{runId:state.runId,expectedRevision:state.revision,action});if(!next.ok)throw Error(`Protected twin prefix ${state.day}/${action.type}: ${next.error}`);state=next.state;};
 for(const action of marketActions)send(action);
 if(state.day!==6||state.phase!=='workshop'||!state.traits.includes('pardon')||state.pardonUsed)throw Error('Merchant witness must legally obtain an unused pardon on day6');
 const grow=(id:string)=>{
  for(let attempt=0;attempt<36;attempt++){
   const blade=state.blades.find(item=>item.id===id),projection=sdk.getRunView(state).blades.find(item=>item.blade.id===id);
   if(blade?.status!=='active')return false;
   if(sdk.assessBlade(state,blade).qualifies)return true;
   if(!projection?.canStrike)return false;
   send({type:'strike',pieceId:id});
  }
  throw Error('Protected twin prefix exceeded its finite36-hit policy');
 };
 for(const day of [6,7]){
  if(state.day!==day||state.phase!=='workshop')throw Error('Unexpected protected-prefix day');
  for(const blade of state.blades.filter(item=>item.status==='active'&&item.id!==state.reserveId)){
   if(sdk.commissionProgress(state).complete)break;
   if(grow(blade.id))send({type:'deliver',pieceId:blade.id});
  }
  if(!sdk.commissionProgress(state).complete)throw Error(`Finite public policy did not complete day${day}`);
  send({type:'settle'});if(state.pardonUsed)throw Error('Pardon was consumed before the day8 boundary');send({type:'advance'});
 }
 const zero=state;let one:RunState|null=null;
 for(const blade of state.blades.filter(item=>item.status==='active'&&item.id!==state.reserveId))if(grow(blade.id)){send({type:'deliver',pieceId:blade.id});one=state;break;}
 if(!one)throw Error('No legally crafted first sword for the partial twin boundary');
 const result=[zero,one]as const;
 for(const[count,source]of result.entries()){
  const checked=sdk.validateRun(source);if(!checked.ok)throw Error(checked.detail);
  if(source.day!==8||source.phase!=='workshop'||source.pardonUsed||source.seals!==3||source.history.some(record=>!record.met)||sdk.commissionProgress(source).routes[0]?.count!==count)throw Error('Protected twin source does not preserve the intended legitimate boundary');
 }
 return result;
}
