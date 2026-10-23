import {nextRandom} from '../core/random.js';
import type {Action,DomainEvent,Draft,ErrorCode,RunState,Weapon} from './model.js';

export type ForgeAction=Extract<Action,{type:'beginForge'|'forge'|'seal'|'discardForge'}>;

export function isForgeAction(action:Action):action is ForgeAction {
 return action.type==='beginForge'||action.type==='forge'||action.type==='seal'||action.type==='discardForge';
}

function currentForge(state:RunState,id:string):Weapon|null {
 if(state.forgeId!==id)return null;
 return state.weapons.find(weapon=>weapon.id===id&&weapon.owner==='forge'&&weapon.status==='forging')??null;
}

/** Shared command/view permission check; it never consumes material or RNG. */
export function forgeError(state:RunState,action:ForgeAction):ErrorCode|null {
 if(action.type==='beginForge'){
  if(state.phase!=='prepare')return'wrong_phase';
  return state.blanks>0?null:'no_blanks';
 }
 if(state.phase!=='forging')return'wrong_phase';
 const weapon=currentForge(state,action.weaponId);if(!weapon)return'weapon_unavailable';
 if(action.type==='discardForge')return null;
 if(action.type==='seal'){
  if(weapon.hits===0||weapon.strength<=0)return'empty_blade';
  const occupied=action.slot==='hand'?state.handId:state.reserveId;
  return occupied!==null&&!action.replace?'slot_occupied':null;
 }
 if(weapon.hits>=6)return'hammer_limit';
 if(action.kind==='fissure'&&weapon.fissureMarked)return'already_fissure';
 return action.kind!=='ordinary'&&state.charge===0?'no_charge':null;
}

/** Mutates only the owner's private clone after forgeError has accepted it. */
export function applyForge(draft:Draft,action:ForgeAction,events:DomainEvent[]):void {
 if(action.type==='beginForge'){
  const id=`w-${++draft.weaponSerial}`;
  draft.weapons.push({id,source:'forged',madeInChapter:draft.chapter,status:'forging',owner:'forge',
   strength:0,sealedStrength:null,hits:0,cracked:false,fissureMarked:false,technique:null});
  draft.blanks--;draft.forgeId=id;draft.phase='forging';
  events.push({type:'ForgeStarted',weaponId:id});return;
 }
 const weapon=draft.weapons.find(weapon=>weapon.id===action.weaponId);
 if(!weapon)throw Error('Accepted forge weapon is missing');
 if(action.type==='discardForge'){
  weapon.status='discarded';weapon.owner='none';draft.forgeId=null;draft.phase='prepare';
  events.push({type:'Discarded',weaponId:weapon.id});return;
 }
 if(action.type==='seal'){
  const replacedId=action.slot==='hand'?draft.handId:draft.reserveId;
  if(replacedId!==null){
   const replaced=draft.weapons.find(value=>value.id===replacedId);
   if(!replaced)throw Error('Accepted replacement weapon is missing');
   replaced.status='discarded';replaced.owner='none';
   if(draft.handId===replacedId)draft.handId=null;
   if(draft.reserveId===replacedId)draft.reserveId=null;
  }
  weapon.status='sealed';weapon.owner='player';weapon.sealedStrength=weapon.strength;
  if(action.slot==='hand')draft.handId=weapon.id;else draft.reserveId=weapon.id;
  draft.forgeId=null;draft.phase='prepare';
  events.push({type:'Sealed',weaponId:weapon.id,slot:action.slot,replacedId});return;
 }
 const before=weapon.strength,chargeBefore=draft.charge;
 const risk=action.kind!=='ordinary'||weapon.hits<3?0:weapon.cracked?350:200;
 let ticket:number|null=null,result:'success'|'crack'|'broken'|'steady'|'fissure';
 weapon.hits++;
 if(action.kind==='ordinary'){
  const drawn=nextRandom(draft.rng);draft.rng=drawn.stream;ticket=Math.floor(drawn.value*1000);
  if(ticket<risk){
   if(weapon.cracked){weapon.status='broken';weapon.owner='none';result='broken';}
   else{weapon.cracked=true;weapon.strength=Math.max(0,weapon.strength-1);result='crack';}
  }else{weapon.strength++;result='success';}
 }else{
  draft.charge=0;weapon.technique=action.kind;
  if(action.kind==='steady'){weapon.strength++;result='steady';}
  else{weapon.strength+=weapon.cracked?1:3;weapon.cracked=true;weapon.fissureMarked=true;result='fissure';}
 }
 events.push({type:'Forged',weaponId:weapon.id,kind:action.kind,result,before,after:weapon.strength,
  ticket,crackTickets:risk,chargeBefore,chargeAfter:draft.charge});
 if(result==='broken'){
  draft.forgeId=null;draft.phase='prepare';events.push({type:'Broken',weaponId:weapon.id});
 }
}
