import {freezeDeep} from '../core/immutable.js';
import {canonicalJson} from '../core/validate.js';
import {parseAction} from './actions.js';
import {applyForge,forgeError,isForgeAction} from './forge.js';
import {applyInventory,inventoryError} from './inventory.js';
import {applyCombat,combatError} from './combat.js';
import {applyMechanism,mechanismError} from './mechanisms.js';
import {applyShop,shopError} from './shop.js';
import {applyCampaign,campaignError,completeNode,finishEncounter,syncPreparation} from './campaign.js';
import {applyJourney,archiveEncounter,failRun,journeyError} from './journey.js';
import {encounterOutcome} from './encounters.js';
import type {EncounterOutcome} from './encounters.js';
import {MAX_JOURNAL_ACTIONS,MAX_SAVE_BYTES,RULES_VERSION} from './model.js';
import type {Action,CommandResult,DomainEvent,Draft,ErrorCode,RunState} from './model.js';
export {createRun} from './initial.js';
export {parseAction} from './actions.js';

/** One exhaustive permission router; unrelated module no-ops are never public acceptance. */
export function actionError(state:RunState,action:Action):ErrorCode|null{
 if(state.rulesVersion!==RULES_VERSION)return'wrong_rules';
 if(state.journal.length>=MAX_JOURNAL_ACTIONS)return'record_limit';
 if(isForgeAction(action))return forgeError(state,action);
 switch(action.type){
  case'equip':case'discardWeapon':case'donate':return inventoryError(state,action);
  case'strike':case'followUp':case'guard':case'endRound':case'temper':return combatError(state,action);
  case'cut':case'ferryAssist':case'useSideRoute':case'placeCore':case'assistBrace':case'ignite':return mechanismError(state,action);
  case'shop':return shopError(state,action);
  case'depart':case'choose':return campaignError(state,action);
  case'retryChapter':case'evacuate':case'acceptFailure':return journeyError(state,action);
 }
}
const fail=(state:RunState,error:ErrorCode):CommandResult=>({ok:false,state,error,events:[]});
export function applyCommand(state:RunState,input:unknown):CommandResult{
 const encoded=canonicalJson(input);if(encoded===null||encoded.length>4096)return fail(state,'invalid_command');
 const value:unknown=JSON.parse(encoded);
 if(!value||typeof value!=='object'||Array.isArray(value))return fail(state,'invalid_command');
 const command=value as Record<string,unknown>;
 if(Object.keys(command).sort().join(',')!=='action,expectedRevision,runId')return fail(state,'invalid_command');
 if(state.rulesVersion!==RULES_VERSION)return fail(state,'wrong_rules');
 if(command.runId!==state.runId)return fail(state,'wrong_run');
 if(!Number.isSafeInteger(command.expectedRevision)||command.expectedRevision!==state.revision)return fail(state,'stale_revision');
 const action=parseAction(command.action);if(!action)return fail(state,'invalid_command');
 const error=actionError(state,action);if(error)return fail(state,error);
 const next=structuredClone(state) as Draft,events:DomainEvent[]=[];
 let outcome:EncounterOutcome=null;
 if(isForgeAction(action))applyForge(next,action,events);
 else switch(action.type){
  case'equip':case'discardWeapon':case'donate':applyInventory(next,action,events);break;
  case'strike':case'followUp':case'guard':case'endRound':case'temper':outcome=applyCombat(next,action,events);break;
  case'cut':case'ferryAssist':case'useSideRoute':case'placeCore':case'assistBrace':case'ignite':applyMechanism(next,action,events);break;
  case'shop':applyShop(next,action,events);break;
  case'depart':case'choose':applyCampaign(next,action,events);break;
  case'retryChapter':case'evacuate':case'acceptFailure':applyJourney(next,action,events);break;
 }
 if(next.phase==='encounter')outcome??=encounterOutcome(next);
 if(outcome==='completed')finishEncounter(next,events);
 else if(outcome)failRun(next,outcome,events);
 if(action.type==='ignite'){
  archiveEncounter(next,'completed',false);completeNode(next,events);
  const ending=events.find(e=>e.type==='EndingReached');
  if(ending){events.splice(events.indexOf(ending),1);events.push(ending);}
 }
 syncPreparation(next);
 next.revision++;next.journal.push(structuredClone(action));
 const saved=canonicalJson(next);
 if(saved===null||new TextEncoder().encode(saved).byteLength>MAX_SAVE_BYTES)return fail(state,'record_limit');
 return freezeDeep({ok:true,state:next,events});
}
