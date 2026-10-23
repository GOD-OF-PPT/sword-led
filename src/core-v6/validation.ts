import {canonicalJson} from '../core/validate.js';
import {applyCommand,createRun,parseAction} from './game.js';
import {MAX_JOURNAL_ACTIONS,MAX_SAVE_BYTES,RULES_VERSION} from './model.js';
import type {ValidationResult} from './model.js';

export function validateRun(input:unknown,expectedRulesVersion:string=RULES_VERSION):ValidationResult{
 const encoded=canonicalJson(input);
 if(encoded===null||new TextEncoder().encode(encoded).byteLength>MAX_SAVE_BYTES)
  return{ok:false,error:'invalid_state',detail:'Expected bounded plain JSON with safe integer fields.'};
 const value:unknown=JSON.parse(encoded);
 if(value===null||typeof value!=='object'||Array.isArray(value))return{ok:false,error:'invalid_state',detail:'State must be an object.'};
 const data=value as Record<string,unknown>;
 if(expectedRulesVersion!==RULES_VERSION||data.rulesVersion!==RULES_VERSION)
  return{ok:false,error:'invalid_rules_version',detail:'Rules version does not match the installed rules.'};
 if(!Array.isArray(data.journal)||data.journal.length>MAX_JOURNAL_ACTIONS)
  return{ok:false,error:'invalid_journal',detail:'A bounded accepted-command journal is required.'};
 const created=createRun({runId:data.runId,seed:data.seed});
 if(!created.ok)return{ok:false,error:'invalid_state',detail:created.error};
 let state=created.state;
 for(const [index,entry]of data.journal.entries()){
  const action=parseAction(entry);
  if(!action)return{ok:false,error:'invalid_journal',detail:`Command ${index}: invalid_command`};
  const result=applyCommand(state,{runId:state.runId,expectedRevision:state.revision,action});
  if(!result.ok)return{ok:false,error:'invalid_journal',detail:`Command ${index}: ${result.error}`};
  state=result.state;
 }
 if(canonicalJson(state)!==encoded)return{ok:false,error:'invalid_state',detail:'State does not match its seed and accepted-command journal.'};
 return{ok:true,state};
}
