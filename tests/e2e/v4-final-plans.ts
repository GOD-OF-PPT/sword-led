import type {Action,RunState} from '../../src/core-v4/index.js';
type Kernel=Pick<typeof import('../../src/core-v4/index.js'),'createRun'|'applyCommand'|'getRunView'|'eventQuote'|'validateRun'>;
type SDK=Kernel&Pick<typeof import('../../src/v4-sdk.js'),'createV4SaveRepository'|'createCollectionRepository'|'collectionFromRun'|'decodeV4Save'|'decodeCollection'>;
export type FinalBranch='two-new'|'mixed-return';

/** Legitimate alternate story plans. No wallet, phase, eligibility or random stream is assigned. */
export function buildFinalBranch(kernel:Kernel,witness:RunState,kind:FinalBranch){
  const rejectedAttempts:{extraHits:number;reason:string}[]=[];
  for(let extraHits=0;extraHits<4;extraHits++){
    try{
      const input={runId:`final-${kind}-${extraHits}`,seed:witness.seed},made=kernel.createRun(input);if(!made.ok)throw Error(made.error);let state=made.state,commands=0;
      const send=(action:Action)=>{if(++commands>300)throw Error('Finite alternate-route budget exceeded');const result=kernel.applyCommand(state,{runId:state.runId,expectedRevision:state.revision,action});if(!result.ok)throw Error(`${state.day}/${action.type}: ${result.error}`);state=result.state;};
      const view=()=>kernel.getRunView(state);
      for(const original of witness.journal.slice(0,176)){
        let action=original;
        if(kind==='mixed-return'&&action.type==='deliver'&&action.pieceId==='d4-1')action={type:'scrap',pieceId:action.pieceId};
        if(kind==='two-new'&&action.type==='reserve'&&action.pieceId==='d10-2')action={type:'deliver',pieceId:action.pieceId};
        send(action);
      }
      if(state.day!==11||state.phase!=='workshop')throw Error('Expected real day-eleven prefix');
      const growNew=(id:string)=>{
        const piece=view().blades.find(p=>p.blade.id===id);if(piece?.canChangeRecipe&&piece.blade.recipe!=='light')send({type:'setRecipe',pieceId:id,recipe:'light'});
        for(let i=0;i<8;i++){const current=view().blades.find(p=>p.blade.id===id);if(!current||current.assessment.qualifies||!current.canStrike)break;send({type:'strike',pieceId:id});}
        if(!view().blades.find(p=>p.blade.id===id)?.assessment.qualifies)throw Error('New relay sword was not qualified');send({type:'deliver',pieceId:id});
      };
      growNew('d11-1');const partialRevision=state.revision;
      if(view().commission.progress.complete)throw Error('One new sword must not complete the relay');
      if(kind==='two-new'){if(state.reserveId!==null)throw Error('Unexpected old sword in the two-new plan');growNew('d11-2');}
      else{const old=state.reserveId;if(!old)throw Error('Missing genuinely reserved old sword');send({type:'reserve',pieceId:old});send({type:'deliver',pieceId:old});}
      if(!view().commission.progress.complete)throw Error('Relay was not completed');const relayRevision=state.revision;
      if(view().event?.status==='available'){const q=kernel.eventQuote(state);send({type:'chooseEvent',choice:q.allowed?'accept':'decline'});}
      const extras=view().blades.filter(p=>!p.reserved).map(p=>p.blade.id);
      for(const [index,id]of extras.entries()){
        for(let i=0;i<3+(index===extras.length-1?extraHits:0);i++){const p=view().blades.find(p=>p.blade.id===id);if(!p?.canStrike)break;send({type:'strike',pieceId:id});}
        if(view().blades.some(p=>p.blade.id===id))send({type:'deliver',pieceId:id});
      }
      send({type:'settle'});send({type:'advance'});
      for(const id of view().blades.filter(p=>!p.reserved).map(p=>p.blade.id)){
        if(view().commission.progress.complete)break;
        for(let i=0;i<32;i++){const p=view().blades.find(p=>p.blade.id===id);if(!p||p.assessment.qualifies||!p.canStrike||p.blade.cracked)break;send({type:'strike',pieceId:id});}
        if(view().blades.some(p=>p.blade.id===id))send({type:'deliver',pieceId:id});
      }
      if(!view().commission.progress.complete)throw Error('Three actual blanks did not make the intact final sword');
      for(const id of view().blades.filter(p=>!p.reserved).map(p=>p.blade.id)){
        for(let i=0;i<3;i++){const p=view().blades.find(p=>p.blade.id===id);if(!p?.canStrike||p.blade.hits>=3)break;send({type:'strike',pieceId:id});}
        if(view().blades.some(p=>p.blade.id===id))send({type:'deliver',pieceId:id});
      }
      send({type:'settle'});
      const ended=view();if(ended.phase!==(kind==='two-new'?'victory':'return')||!ended.ending?.finalBladeMade)throw Error('Alternate final outcome mismatch');
      const checked=kernel.validateRun(state);if(!checked.ok)throw Error(checked.detail);
      return {scope:'Accepted public-kernel commands from a fresh ordinary story; browser must execute every action through UI.',kind,input,extraHits,rejectedAttempts,partialRevision,relayRevision,actions:state.journal,state};
    }catch(error){rejectedAttempts.push({extraHits,reason:String(error)});}
  }
  throw Error(`No bounded ${kind} route: ${JSON.stringify(rejectedAttempts)}`);
}

/** Only for explicitly labelled load/readonly boundary checks, never a full-journey UI claim. */
export function endingBoundaryEnvelopes(api:SDK,source:RunState){
  const checked=api.validateRun(source);if(!checked.ok)throw Error(checked.detail);const values=new Map<string,string>();
  const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}};
  const savedAt=()=> '2026-10-20T00:00:00.000Z',run=api.createV4SaveRepository(()=>storage,savedAt),collection=api.createCollectionRepository(()=>storage,savedAt);
  const awards=api.collectionFromRun(checked.state);if(!awards.ok)throw Error(awards.detail);
  run.load();collection.load();const a=run.write(checked.state),b=collection.write(awards.state);if(!a.ok||!b.ok)throw Error('Could not encode the formally validated boundary fixture');
  const runRaw=values.get('sword-led.save.v4')!,collectionRaw=values.get('sword-led.collection.v1')!;
  if(api.decodeV4Save(runRaw).status!=='valid'||api.decodeCollection(collectionRaw).status!=='valid')throw Error('Encoded recovery-boundary envelopes did not validate');
  return {scope:'Restored-existing-run boundary from a fully replayed SDK journal; not a UI journey.',run:runRaw,collection:collectionRaw};
}
