import { canonicalJson, MAX_JOURNAL_ACTIONS } from '../core/validate.js';
import { isRecord } from '../core/guards.js';
import { applyCommand, createRun } from './game.js';
import { RULES_VERSION } from './rules.js';
import type { RunState } from './model.js';

export function validateRun(input:unknown):{readonly ok:true;readonly state:RunState}|{readonly ok:false;readonly error:'invalid_state'|'invalid_rules_version'|'invalid_journal';readonly detail:string}{
  const encoded=canonicalJson(input);if(encoded===null)return{ok:false,error:'invalid_state',detail:'Expected bounded plain JSON data.'};
  const data:unknown=JSON.parse(encoded);
  if(!isRecord(data)||typeof data.runId!=='string'||typeof data.seed!=='string')return{ok:false,error:'invalid_state',detail:'Run identity and seed are required.'};
  if(data.rulesVersion!==RULES_VERSION)return{ok:false,error:'invalid_rules_version',detail:'Expected forge-v2.'};
  if(!Array.isArray(data.journal)||data.journal.length>MAX_JOURNAL_ACTIONS)return{ok:false,error:'invalid_journal',detail:'Expected a bounded accepted-command journal.'};
  const created=createRun({runId:data.runId,seed:data.seed});if(!created.ok)return{ok:false,error:'invalid_state',detail:created.error};
  let state=created.state;
  for(const [index,action] of data.journal.entries()){
    const result=applyCommand(state,{runId:state.runId,expectedRevision:state.revision,action});if(!result.ok)return{ok:false,error:'invalid_journal',detail:`Command ${index}: ${result.error}`};state=result.state;
  }
  if(canonicalJson(state)!==encoded)return{ok:false,error:'invalid_state',detail:'Snapshot differs from its deterministic replay.'};
  return{ok:true,state};
}
