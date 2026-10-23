import type {Action,DomainEvent,Draft,ErrorCode,RunState,Weapon} from './model.js';
import {encounterOutcome,legalTarget,pressurePreview} from './encounters.js';
import type {EncounterOutcome} from './encounters.js';
import {retire,usable,weapon} from './inventory.js';

export interface DamagePreview {
 readonly damage:number;readonly strengthBefore:number;readonly strengthAfter:number;
 readonly ignoresArmor:boolean;readonly openingBonus:number;readonly fissureBonus:number;readonly wear:number;
}

/** Damage forecast only; combatError separately owns weapon/target usability. */
export function damagePreview(value:Weapon,armor:number,opening:boolean):DamagePreview {
 const fissure=value.cracked&&value.fissureMarked,ignoresArmor=fissure||opening;
 const strengthAfter=fissure?Math.max(0,value.strength-2):value.strength;
 const openingBonus=opening?2:0,fissureBonus=fissure?2:0;
 return{damage:Math.max(0,value.strength-(ignoresArmor?0:armor))+openingBonus+fissureBonus,
  strengthBefore:value.strength,strengthAfter,ignoresArmor,openingBonus,fissureBonus,wear:value.strength-strengthAfter};
}

export function combatError(state:RunState,action:Action):ErrorCode|null {
 if(action.type==='temper'){
  if(state.phase!=='prepare'&&state.phase!=='encounter')return'wrong_phase';
  if(!state.tool||state.tool.kind!=='furnace')return'no_tool';
  const value=weapon(state,action.weaponId);
  if(state.handId!==action.weaponId||!usable(state,action.weaponId)||!value||value.sealedStrength===null)return'weapon_unavailable';
  if(state.charge===0)return'no_charge';
  if(state.phase==='encounter'&&(!state.encounter||state.encounter.actions<1))return'not_enough_actions';
  const clearsCrack=state.tool.level===2&&value.cracked&&!value.fissureMarked;
  return value.strength<value.sealedStrength||clearsCrack?null:'not_worn';
 }
 if(action.type!=='strike'&&action.type!=='followUp'&&action.type!=='guard'&&action.type!=='endRound')return null;
 const e=state.encounter;if(state.phase!=='encounter'||!e)return'wrong_phase';
 switch(action.type){
  case'endRound':return null;
  case'guard':
   if(e.actions<1)return'not_enough_actions';
   return e.guarded?'guard_already_used':null;
  case'strike':
   if(e.actions<1)return'not_enough_actions';
   if(!usable(state,state.handId))return'weapon_unavailable';
   return legalTarget(state,action.targetId)?null:'invalid_target';
  case'followUp':
   if(!state.tool||state.tool.kind!=='rebound'||state.tool.stored<=0||e.followUpUsed)return'no_rebound';
   return legalTarget(state,action.targetId)?null:'invalid_target';
 }
}

/** Called only on the command owner's private draft after permission succeeds. */
export function applyCombat(draft:Draft,action:Action,events:DomainEvent[]):EncounterOutcome {
 if(action.type==='temper'){
  const value=draft.weapons.find(value=>value.id===action.weaponId),tool=draft.tool;
  if(!value||!tool||value.sealedStrength===null)throw Error('Accepted temper is missing its weapon or tool');
  const before=value.strength,crackCleared=tool.level===2&&value.cracked&&!value.fissureMarked;
  value.strength=Math.min(value.sealedStrength,value.strength+(tool.level===2?4:2));
  if(crackCleared)value.cracked=false;
  draft.charge=0;
  if(draft.phase==='encounter'&&draft.encounter){
   draft.encounter.actions--;draft.encounter.braced=false;
   draft.encounter.steps.push({round:draft.encounter.round,action:'temper',weaponId:value.id,targetId:null,
    amount:value.strength-before,before,after:value.strength});
  }
  events.push({type:'Tempered',weaponId:value.id,before,after:value.strength,crackCleared});
  return encounterOutcome(draft);
 }
 if(action.type!=='strike'&&action.type!=='followUp'&&action.type!=='guard'&&action.type!=='endRound')return null;
 const e=draft.encounter;if(!e)throw Error('Accepted combat action is missing its encounter');
 if(action.type==='endRound'){
  const pressure=pressurePreview(draft),before=draft.lamp;
  draft.lamp=Math.max(0,before-pressure.loss);
  e.steps.push({round:e.round,action:'endRound',weaponId:null,targetId:null,amount:pressure.loss,before,after:draft.lamp});
  events.push({type:'RoundEnded',round:e.round,...pressure,before,after:draft.lamp});
  e.block=0;
  const outcome=encounterOutcome(draft,true);if(outcome!==null)return outcome;
  e.round++;e.actions=2;e.block=0;e.guarded=false;
  return null;
 }
 if(action.type==='guard'){
  e.actions--;e.block+=3;e.opening=true;e.guarded=true;
  if(e.id==='n9'&&e.targets.some(target=>target.id==='reverse-wheel'&&target.health===0))e.braced=true;
  e.steps.push({round:e.round,action:'guard',weaponId:usable(draft,draft.handId)?draft.handId:null,targetId:null,amount:3,before:null,after:null});
  events.push({type:'Guarded',block:e.block,braced:e.braced});
  return encounterOutcome(draft);
 }
 if(action.type!=='strike'&&action.type!=='followUp')return null;
 const target=e.targets.find(target=>target.id===action.targetId);
 if(!target)throw Error('Accepted combat action is missing its target');
 const before=target.health;
 e.braced=false;
 if(action.type==='followUp'){
  const tool=draft.tool;if(!tool)throw Error('Accepted follow-up is missing its tool');
  const damage=tool.stored;tool.stored=0;e.followUpUsed=true;
  target.health=Math.max(0,before-damage);
  e.steps.push({round:e.round,action:'followUp',weaponId:null,targetId:target.id,amount:damage,before,after:target.health});
  events.push({type:'Struck',source:'followUp',weaponId:null,targetId:target.id,damage,before,after:target.health,
   strengthBefore:null,strengthAfter:null,opening:false});
  return encounterOutcome(draft);
 }
 const value=draft.weapons.find(value=>value.id===draft.handId);
 if(!value)throw Error('Accepted strike is missing its hand weapon');
 const opening=e.opening,hit=damagePreview(value,target.armor,opening);
 e.actions--;e.opening=false;target.health=Math.max(0,before-hit.damage);value.strength=hit.strengthAfter;
 e.steps.push({round:e.round,action:'strike',weaponId:value.id,targetId:target.id,amount:hit.damage,before,after:target.health});
 events.push({type:'Struck',source:'strike',weaponId:value.id,targetId:target.id,damage:hit.damage,before,after:target.health,
  strengthBefore:hit.strengthBefore,strengthAfter:hit.strengthAfter,opening});
 if(value.strength===0){retire(draft,value.id,'broken','none');events.push({type:'Broken',weaponId:value.id});}
 const tool=draft.tool;
 if(target.health===0&&tool){
  if(tool.kind==='rebound'&&!e.reboundClaimed&&hit.damage>before){
   const storedBefore=tool.stored,overkill=hit.damage-before;
   tool.stored=tool.level===2?Math.max(storedBefore,overkill):overkill;e.reboundClaimed=true;
   events.push({type:'ReboundStored',before:storedBefore,after:tool.stored});
  }else if(tool.kind==='furnace'&&!e.furnaceTriggered&&target.armor>0){
   const chargeBefore=draft.charge;draft.charge=1;e.furnaceTriggered=true;
   events.push({type:'Recharged',before:chargeBefore,after:1,gained:1-chargeBefore});
  }
 }
 return encounterOutcome(draft);
}
