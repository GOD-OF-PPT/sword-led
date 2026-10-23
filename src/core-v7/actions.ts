import {canonicalJson} from '../core/validate.js';
import type {Action} from './model.js';

const choices=new Set(['escort','salvage','rescue-ferryman','save-cargo','take-rebound','take-furnace','leave-crossing','hold-crossing','keep-old','dismantle-old','pay-upgrade','north-first','south-first','leave-station','continue-station','take-ring','leave-ring','courier-carries','player-carries']);
const targets=new Set(['wood-guard','bridge-latch','charger','flanker','rammer','north-latch','south-latch','roof-lock','main-rock','loose-rock','relay-latch','drive-lock','reverse-wheel']);
const cuts=new Set(['bridge-rope','south-rope','relay-rope']);
const empty=new Set(['beginForge','depart','guard','endRound','ferryAssist','useSideRoute','placeCore','assistBrace','retryChapter','evacuate','acceptFailure']);
const weaponActions=new Set(['discardForge','equip','discardWeapon','temper','ignite']);
function keys(value:Record<string,unknown>,names:string[]):boolean{
 return Object.keys(value).sort().join(',')===names.sort().join(',');
}
function id(value:unknown):value is string{return typeof value==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(value);}

/** Exact, bounded action grammar shared by live commands and journal replay. */
export function parseAction(input:unknown):Action|null{
 const encoded=canonicalJson(input);if(encoded===null||encoded.length>1024)return null;
 const value:unknown=JSON.parse(encoded);
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const v=value as Record<string,unknown>;
 if(typeof v.type!=='string')return null;
 let valid=false;
 if(empty.has(v.type))valid=keys(v,['type']);
 else if(weaponActions.has(v.type))valid=keys(v,['type','weaponId'])&&id(v.weaponId);
 else switch(v.type){
  case'forge':valid=keys(v,['type','weaponId','kind'])&&id(v.weaponId)&&typeof v.kind==='string'&&['ordinary','steady','fissure'].includes(v.kind);break;
  case'seal':valid=keys(v,['type','weaponId','slot','replace'])&&id(v.weaponId)&&(v.slot==='hand'||v.slot==='reserve')&&typeof v.replace==='boolean';break;
  case'choose':valid=keys(v,['type','choice'])&&typeof v.choice==='string'&&choices.has(v.choice);break;
  case'strike':case'followUp':valid=keys(v,['type','targetId'])&&typeof v.targetId==='string'&&targets.has(v.targetId);break;
  case'cut':valid=keys(v,['type','targetId'])&&typeof v.targetId==='string'&&cuts.has(v.targetId);break;
  case'donate':valid=keys(v,['type','weaponId','recipient'])&&id(v.weaponId)&&(v.recipient==='shelter'||v.recipient==='alan');break;
  case'shop':valid=keys(v,['type','item'])&&typeof v.item==='string'&&['coal','blank','upgrade','exchange'].includes(v.item);break;
 }
 return valid?v as unknown as Action:null;
}
