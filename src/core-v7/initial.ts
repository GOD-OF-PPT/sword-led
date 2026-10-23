import {freezeDeep} from '../core/immutable.js';
import {hashUtf8} from '../core/random.js';
import {canonicalJson} from '../core/validate.js';
import {RULES_VERSION} from './model.js';
import type {CreateRunResult,PlayableState,RunState,Weapon} from './model.js';

export const OLD_SWORD_ID='du-old-sword';
export function initialPlayable(seed:string):PlayableState{
 const old:Weapon={id:OLD_SWORD_ID,source:'inherited',madeInChapter:1,status:'sealed',owner:'player',strength:3,
  sealedStrength:3,hits:0,cracked:false,fissureMarked:false,technique:null};
 return{chapter:1,node:1,phase:'prepare',choice:null,lamp:8,coins:4,blanks:3,charge:1,weapons:[old],
  handId:old.id,reserveId:null,forgeId:null,tool:null,upgradeUsed:false,
  flags:{escortFirst:null,ferrymanSaved:null,crossingHeld:false,northSaved:false,southSaved:false,
   firstStation:null,ferryAssistUsed:false,ring:null,oldDecision:null,donatedToAlan:null,shelterSword:null,
   carrier:null,coreOwner:'player'},encounter:null,encounterHistory:[],nodes:[],
  rng:{state:hashUtf8(`${seed}|v7|forge`),draws:0},failure:null,ending:null};
}
export function createRun(input:unknown):CreateRunResult{
 const encoded=canonicalJson(input);if(encoded===null||encoded.length>4096)return{ok:false,error:'invalid_command'};
 const value:unknown=JSON.parse(encoded);
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!=='runId,seed')return{ok:false,error:'invalid_command'};
 const record=value as Record<string,unknown>;
 if(typeof record.runId!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(record.runId))return{ok:false,error:'invalid_run_id'};
 if(typeof record.seed!=='string')return{ok:false,error:'invalid_seed'};
 const seed=record.seed.normalize('NFC').trim();if(!seed||Array.from(seed).length>64)return{ok:false,error:'invalid_seed'};
 const playable=initialPlayable(seed);
 const state:RunState={...playable,rulesVersion:RULES_VERSION,runId:record.runId,seed,revision:0,weaponSerial:0,
  retries:{1:0,2:0,3:0},failedAttempts:[],checkpoint:structuredClone(playable),journal:[]};
 return freezeDeep({ok:true,state});
}
