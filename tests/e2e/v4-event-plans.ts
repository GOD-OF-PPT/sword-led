import type {Action,DomainEvent,EventId} from '../../src/core-v4/index.js';
type Kernel=Pick<typeof import('../../src/core-v4/index.js'),'createRun'|'applyCommand'|'getRunView'>;
const IDS:readonly EventId[]=['donation','loan','salvage','credit','shelter','rest'];

/** Earn one genuine commission before day three, then keep the next two choices open. */
function opening(kernel:Kernel,seed:string){
  const made=kernel.createRun({runId:'event-frontier',seed});if(!made.ok)throw Error(made.error);let state=made.state;
  const send=(action:Action)=>{const result=kernel.applyCommand(state,{runId:state.runId,expectedRevision:state.revision,action});if(!result.ok)throw Error(result.error);state=result.state;};
  send({type:'continue'});
  for(let i=0;i<3;i++){const visible=kernel.getRunView(state).blades.find(p=>p.blade.id==='d1-1')!;if(visible.assessment.qualifies)break;send({type:'strike',pieceId:'d1-1'});}
  send({type:'deliver',pieceId:'d1-1'});send({type:'settle'});send({type:'advance'});send({type:'settle'});send({type:'advance'});
  if(state.day!==3||state.phase!=='workshop'||!state.history[0]?.met)throw Error('Unreachable event opening');
  return state;
}

/** Finite seed discovery reads the public event after reaching it; random streams are never inspected. */
export function findEventSeeds(kernel:Kernel,limit=192){
  const found:Partial<Record<EventId,{seed:string;prefixCommands:number}>>={},attempts:{seed:string;event:EventId;prefixCommands:number}[]=[];
  for(let i=0;i<limit;i++){
    const seed=`event-frontier-${i}`,state=opening(kernel,seed),id=kernel.getRunView(state).event!.id,entry={seed,prefixCommands:state.journal.length};attempts.push({seed,event:id,prefixCommands:entry.prefixCommands});
    if(!found[id]||entry.prefixCommands<found[id]!.prefixCommands)found[id]=entry;
    // Two hits are the theoretical minimum to reach the day-one 100-value commission from 40.
    if(IDS.every(id=>found[id]?.prefixCommands===8))break;
  }
  if(!IDS.every(id=>found[id]?.prefixCommands===8))throw Error(`Did not find all six minimal legal event openings within ${limit} candidates`);
  return {scope:'Seed discovery through accepted public-SDK commands and visible event views. No injected resources, eligibility or phase.',limit,attempts,seeds:found as Record<EventId,{seed:string;prefixCommands:number}>};
}

export function buildEventPlan(kernel:Kernel,seed:string,eventId:EventId,choice:'accept'|'decline'){
  let state=opening(kernel,seed);if(kernel.getRunView(state).event?.id!==eventId)throw Error('Event seed identity changed');
  const records:{revision:number;events:readonly DomainEvent[]}[]=[];
  const send=(action:Action)=>{const result=kernel.applyCommand(state,{runId:state.runId,expectedRevision:state.revision,action});if(!result.ok)throw Error(`${eventId}/${choice}/${state.day}/${action.type}: ${result.error}`);state=result.state;records.push({revision:state.revision,events:result.events});};
  const first='d3-1';if(choice==='accept'&&eventId==='salvage')send({type:'reserve',pieceId:first});
  send({type:'chooseEvent',choice,...(choice==='accept'&&(eventId==='donation'||eventId==='salvage')?{pieceId:first}:{})});const choiceRevision=state.revision;
  send({type:'settle'});send({type:'advance'});const nextDayRevision=state.revision;
  if(state.day!==4||state.phase!=='workshop')throw Error('Event route did not reach the genuine next day');
  if(choice==='accept'){
    if(eventId==='loan'){for(let i=0;i<4;i++)send({type:'strike',pieceId:'d4-1'});send({type:'strike',pieceId:'d4-2'});}
    if(eventId==='shelter'){for(const id of ['d4-1','d4-2'])for(let i=0;i<3;i++)send({type:'strike',pieceId:id});send({type:'strike',pieceId:'d4-1'});}
    if(eventId==='credit'){
      for(let i=0;i<40;i++){const piece=kernel.getRunView(state).blades.find(p=>p.blade.id==='d4-1');if(!piece?.canStrike)break;send({type:'strike',pieceId:'d4-1'});if(state.blades.find(b=>b.id==='d4-1')!.status==='broken')break;}
      if(state.crackGuard||state.blades.find(b=>b.id==='d4-1')!.status!=='broken')throw Error('Bounded credit route did not observe first-crack protection followed by real breakage');
    }
  }
  return {scope:'Legal public-SDK event route; browser consumer must execute every action through UI.',seed,eventId,choice,choiceRevision,nextDayRevision,actions:state.journal,state,records};
}
