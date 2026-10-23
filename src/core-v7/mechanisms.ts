import {handWeapon,retire,usable} from './inventory.js';
import type {Action,CutTarget,DomainEvent,Draft,EncounterId,ErrorCode,NodeId,RunState,TargetId} from './model.js';

const CUTS:Readonly<Record<CutTarget,{readonly node:NodeId;readonly encounter:EncounterId;readonly strength:number}>>={
 'bridge-rope':{node:2,encounter:'n2',strength:3},
 'south-rope':{node:5,encounter:'n5-south',strength:4},
 'relay-rope':{node:8,encounter:'n8',strength:4},
};

function destroyed(state:RunState,id:TargetId):boolean{
 return state.encounter?.targets.some(target=>target.id===id&&target.health===0)??false;
}

export function mechanismError(state:RunState,action:Action):ErrorCode|null{
 switch(action.type){
  case'cut':case'ferryAssist':case'useSideRoute':case'placeCore':case'assistBrace':case'ignite':break;
  default:return null;
 }
 const encounter=state.encounter;
 if(state.phase!=='encounter'||!encounter)return'wrong_phase';
 switch(action.type){
  case'cut':{
   const rule=CUTS[action.targetId];
   if(state.node!==rule.node||encounter.id!==rule.encounter)return'invalid_target';
   if(encounter.routeOpened)return'unavailable';
   const current=handWeapon(state);
   if(!current||!usable(state,current.id)||current.cracked||current.strength<rule.strength)return'weapon_unavailable';
   return encounter.actions<1?'not_enough_actions':null;
  }
  case'ferryAssist':
   if(state.node!==5||(encounter.id!=='n5-north'&&encounter.id!=='n5-south'))return'invalid_target';
   return state.flags.ferrymanSaved&&!state.flags.ferryAssistUsed&&!encounter.routeOpened?null:'unavailable';
  case'useSideRoute':
   if(state.node!==8||encounter.id!=='n8')return'invalid_target';
   if(encounter.routeOpened||!((state.flags.southSaved&&state.flags.ring==='left')||state.flags.crossingHeld))return'unavailable';
   return encounter.actions<1?'not_enough_actions':null;
  case'placeCore':
   if(state.node!==9||encounter.id!=='n9')return'invalid_target';
   if(state.flags.carrier!=='player'||state.flags.coreOwner!=='player')return'not_ready';
   return encounter.actions<1?'not_enough_actions':null;
  case'assistBrace':
   if(state.node!==9||encounter.id!=='n9')return'invalid_target';
   return state.flags.carrier==='player'&&destroyed(state,'reverse-wheel')&&!encounter.braceAssistUsed?null:'not_ready';
  case'ignite':{
   if(state.node!==9||encounter.id!=='n9')return'invalid_target';
   const current=handWeapon(state);
   if(!current||current.id!==action.weaponId||!usable(state,current.id)||current.source!=='forged')return'weapon_unavailable';
   const fits=!current.cracked?current.strength>=3:current.fissureMarked&&current.strength>=1;
   if(!fits)return'weapon_unavailable';
   if(!destroyed(state,'drive-lock')||!destroyed(state,'reverse-wheel')||state.flags.coreOwner!=='socket'||!encounter.braced)return'not_ready';
   return encounter.actions<1?'not_enough_actions':null;
  }
  default:return null;
 }
}

function currentEncounter(draft:Draft):NonNullable<Draft['encounter']>{
 if(!draft.encounter)throw new Error('Mechanism action requires an encounter.');
 return draft.encounter;
}
function record(draft:Draft,action:string,weaponId:string|null,targetId:string|null):void{
 const encounter=currentEncounter(draft);
 encounter.steps.push({round:encounter.round,action,weaponId,targetId,amount:0,before:null,after:null});
}

/** Applies a checked action to a private draft. Opening a route never fabricates a kill. */
export function applyMechanism(draft:Draft,action:Action,events:DomainEvent[]):void{
 switch(action.type){
  case'cut':{
   const encounter=currentEncounter(draft);
   encounter.actions--;encounter.braced=false;encounter.routeOpened=true;
   record(draft,action.type,draft.handId,action.targetId);
   events.push({type:'MechanismUsed',mechanism:action.targetId,targetId:action.targetId});
   break;
  }
  case'ferryAssist':{
   const encounter=currentEncounter(draft),targetId=encounter.id==='n5-north'?'north-latch':'south-latch';
   encounter.braced=false;encounter.routeOpened=true;draft.flags.ferryAssistUsed=true;
   record(draft,action.type,null,targetId);
   events.push({type:'MechanismUsed',mechanism:'ferry',targetId});
   break;
  }
  case'useSideRoute':{
   const encounter=currentEncounter(draft);
   encounter.actions--;encounter.braced=false;encounter.routeOpened=true;
   record(draft,action.type,null,'relay-latch');
   events.push({type:'MechanismUsed',mechanism:'side-route',targetId:'relay-latch'});
   break;
  }
  case'placeCore':{
   const encounter=currentEncounter(draft);
   encounter.actions--;encounter.braced=false;draft.flags.coreOwner='socket';
   record(draft,action.type,null,'core');
   events.push({type:'MechanismUsed',mechanism:'core',targetId:'core'});
   break;
  }
  case'assistBrace':{
   const encounter=currentEncounter(draft);
   encounter.braceAssistUsed=true;encounter.braced=true;
   record(draft,action.type,null,'reverse-wheel');
   events.push({type:'MechanismUsed',mechanism:'brace-assist',targetId:'reverse-wheel'});
   break;
  }
  case'ignite':{
   const encounter=currentEncounter(draft);
   retire(draft,action.weaponId,'donated','lamp');encounter.actions--;
   record(draft,action.type,action.weaponId,'core');
   draft.ending={kind:'relit',node:9,dedicatedWeaponId:action.weaponId};draft.phase='ending';draft.choice=null;
   events.push({type:'Donated',weaponId:action.weaponId,recipient:'lamp'},
    {type:'EndingReached',kind:'relit',dedicatedWeaponId:action.weaponId});
   break;
  }
  default:break;
 }
}
