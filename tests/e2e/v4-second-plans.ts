import type {Action,CreateRunInput,RunState} from '../../src/core-v4/index.js';
type Kernel=Pick<typeof import('../../src/core-v4/index.js'),'createRun'|'applyCommand'|'getRunView'|'eventQuote'>;

/** Full legal command plans. Selection reads public assessments, never random-stream contents. */
export function buildSecondPlan(kernel:Kernel,witness:RunState,kind:'warm'|'new'){
  const input:CreateRunInput={runId:`second-plan-${kind}`,seed:witness.seed},made=kernel.createRun(input);if(!made.ok)throw Error(made.error);let state=made.state,commands=0;
  const states:RunState[]=[];
  const send=(action:Action)=>{if(++commands>400)throw Error('Second-chapter command plan exceeded finite budget');const result=kernel.applyCommand(state,{runId:state.runId,expectedRevision:state.revision,action});if(!result.ok)throw Error(`${kind}/${state.day}/${action.type}: ${result.error}`);state=result.state;states.push(state);};
  if(kind==='warm'){
    for(const action of witness.journal.slice(0,126))send(action.type==='chooseModification'&&action.modification==='windbox'?{type:'chooseModification',modification:'warmRack'}:action);
  }else{
    for(const action of witness.journal.slice(0,63))send(action.type==='reserve'&&action.pieceId==='d4-2'?{type:'deliver',pieceId:'d4-2'}:action);
    send({type:'advance'});
    if(state.reserveId!==null)throw Error('New-sword plan unexpectedly has an old reserve');
    const view=()=>kernel.getRunView(state);
    const finishExtras=()=>{
      for(const id of view().blades.filter(p=>!p.reserved).map(p=>p.blade.id)){
        for(let i=0;i<3;i++){const p=view().blades.find(p=>p.blade.id===id);if(!p?.canStrike||p.blade.hits>=3)break;send({type:'strike',pieceId:id});}
        if(view().blades.some(p=>p.blade.id===id&&!p.reserved))send({type:'deliver',pieceId:id});
      }
    };
    for(const day of [5,6,7,8]){
      if(state.day!==day||state.phase!=='workshop')throw Error('Unexpected second-chapter day');
      if(view().merchant?.canUpgrade)send({type:'upgrade'});
      const ids=view().blades.filter(p=>!p.reserved).map(p=>p.blade.id);
      for(const id of ids){
        if(view().commission.progress.complete)break;
        const desired=day===5?'light':view().recommendedRecipe,p=view().blades.find(p=>p.blade.id===id);
        if(p?.canChangeRecipe&&p.blade.recipe!==desired)send({type:'setRecipe',pieceId:id,recipe:desired});
        for(let i=0;i<40;i++){const current=view().blades.find(p=>p.blade.id===id);if(!current||current.assessment.qualifies||!current.canStrike)break;if(day===8&&current.blade.cracked)break;send({type:'strike',pieceId:id});}
        if(view().blades.some(p=>p.blade.id===id))send({type:'deliver',pieceId:id});
      }
      if(!view().commission.progress.complete)throw Error(`${kind} plan did not complete day ${day}`);
      const event=view().event;
      if(event?.status==='available'){
        let pieceId:string|undefined;
        if(event.piece!=='none'){
          const spare=view().blades.find(p=>!p.reserved)?.blade.id;
          if(spare&&event.piece==='reserve'){send({type:'reserve',pieceId:spare});pieceId=spare;}else if(event.piece==='active')pieceId=spare;
        }
        const quote=kernel.eventQuote(state,pieceId);send(quote.allowed?{type:'chooseEvent',choice:'accept',...(pieceId?{pieceId}:{})}:{type:'chooseEvent',choice:'decline'});
      }
      finishExtras();send({type:'settle'});
      if(day<8)send({type:'advance'});else send({type:'chooseModification',modification:'wideMouth'});
    }
  }
  if(state.day!==8||state.phase!=='summary'||!state.history.every(h=>h.met))throw Error('Second-chapter plan did not end with eight genuine commissions');
  return {kind,input,actions:state.journal,state,states};
}
