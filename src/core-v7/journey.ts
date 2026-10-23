import {canonicalJson} from '../core/validate.js';
import {usable,weapon} from './inventory.js';
import type {Action,DomainEvent,Draft,ErrorCode,Failure,PlayableState,RunState} from './model.js';

/** Only these fields roll back; run identity and accepted-action history keep advancing. */
export function snapshotPlayable(state:RunState):PlayableState{
 return structuredClone({chapter:state.chapter,node:state.node,phase:state.phase,choice:state.choice,
  lamp:state.lamp,coins:state.coins,blanks:state.blanks,charge:state.charge,weapons:state.weapons,
  handId:state.handId,reserveId:state.reserveId,forgeId:state.forgeId,tool:state.tool,
  upgradeUsed:state.upgradeUsed,flags:state.flags,encounter:state.encounter,
  encounterHistory:state.encounterHistory,nodes:state.nodes,rng:state.rng,
  failure:state.failure,ending:state.ending});
}

/** The caller establishes a chapter start after its one-time supply and before choices. */
export function setCheckpoint(draft:Draft):void{
 // snapshotPlayable owns a fresh deep clone, so this private checkpoint is mutable too.
 draft.checkpoint=snapshotPlayable(draft) as Draft['checkpoint'];
}

/** Keep the real scene in history, optionally retaining it for a failure or ending view. */
export function archiveEncounter(draft:Draft,outcome:'completed'|'failed',clear=true):void{
 const encounter=draft.encounter;
 if(!encounter)return;
 const current=canonicalJson(encounter);
 if(!draft.encounterHistory.some(record=>canonicalJson(record.encounter)===current)){
  draft.encounterHistory.push({encounter:structuredClone(encounter),outcome,lampAfter:draft.lamp});
 }
 if(draft.tool?.level===1)draft.tool.stored=0;
 if(clear)draft.encounter=null;
}

/** Departure may inspect either owned slot; embedding still requires the actual hand. */
export function finalEligible(state:RunState,id:string|null):boolean{
 const value=weapon(state,id);
 return value!==null&&usable(state,id)&&value.source==='forged'&&
  (!value.cracked?value.strength>=3:value.fissureMarked&&value.strength>=1);
}

function rememberAttempt(draft:Draft,reason:Failure['reason']):void{
 draft.failedAttempts.push({atRevision:draft.revision+1,chapter:draft.chapter,node:draft.node,reason,
  lamp:draft.lamp,coins:draft.coins,weapons:structuredClone(draft.weapons),
  encounter:structuredClone(draft.encounter),flags:structuredClone(draft.flags)});
}

/** Combat has already applied its actual cost and wear before reporting this failure. */
export function failRun(draft:Draft,reason:Failure['reason'],events:DomainEvent[]):void{
 if(draft.phase==='failed')return;
 archiveEncounter(draft,'failed',false);
 draft.phase='failed';draft.choice=null;draft.failure={reason,node:draft.node};
 rememberAttempt(draft,reason);
 events.push({type:'Failed',reason,node:draft.node});
}

/** Read-only permission checks; unowned actions remain for the command owner's router. */
export function journeyError(state:RunState,action:Action):ErrorCode|null{
 switch(action.type){
  case'retryChapter':
   if(state.phase!=='prepare'&&state.phase!=='encounter'&&state.phase!=='failed')return'wrong_phase';
   return state.retries[state.chapter]===1?'no_retry':null;
  case'evacuate':
   if(state.phase!=='prepare'&&state.phase!=='forging'&&state.phase!=='choice'&&state.phase!=='encounter')return'wrong_phase';
   return state.lamp>0?null:'not_enough_light';
  case'acceptFailure':return state.phase==='failed'?null:'wrong_phase';
  default:return null;
 }
}

/** Mutates only the command owner's private draft after journeyError accepts it. */
export function applyJourney(draft:Draft,action:Action,events:DomainEvent[]):void{
 switch(action.type){
  case'retryChapter':{
   const chapter=draft.chapter;
   if(draft.phase!=='failed')rememberAttempt(draft,'retreat');
   Object.assign(draft,structuredClone(draft.checkpoint));
   draft.retries[chapter]=1;
   events.push({type:'Retried',chapter,used:1});
   break;
  }
  case'evacuate':{
   rememberAttempt(draft,'retreat');
   archiveEncounter(draft,'failed',false);
   if(draft.forgeId!==null){
    const current=draft.weapons.find(value=>value.id===draft.forgeId);
    if(!current)throw new Error('Accepted evacuation is missing its forge weapon.');
    current.status='discarded';current.owner='none';
    events.push({type:'Discarded',weaponId:current.id});
    draft.forgeId=null;
   }
   draft.flags.coreOwner='party';draft.phase='ending';draft.choice=null;
   draft.ending={kind:'homeward',node:draft.node,dedicatedWeaponId:null};
   events.push({type:'EndingReached',kind:'homeward',dedicatedWeaponId:null});
   break;
  }
  case'acceptFailure':
   draft.phase='ending';draft.choice=null;
   draft.ending={kind:'embers',node:draft.node,dedicatedWeaponId:null};
   events.push({type:'EndingReached',kind:'embers',dedicatedWeaponId:null});
   break;
  default:break;
 }
}
