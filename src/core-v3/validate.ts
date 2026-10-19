import {canonicalJson} from '../core/validate.js';
import {isRecord} from '../core/guards.js';
import {createRun,applyCommand} from './game.js';
import type {RunState} from './model.js';
export function validateRun(input:unknown):{ok:true;state:RunState}|{ok:false;error:string;detail:string}{
  const encoded=canonicalJson(input);if(!encoded)return{ok:false,error:'invalid_state',detail:'Expected bounded plain JSON.'};
  const data:unknown=JSON.parse(encoded);if(!isRecord(data)||data.rulesVersion!=='forge-v3')return{ok:false,error:'invalid_rules_version',detail:'Expected forge-v3.'};
  if(typeof data.runId!=='string'||typeof data.seed!=='string'||(data.roundLimit!==3&&data.roundLimit!==12)||!Array.isArray(data.journal))return{ok:false,error:'invalid_state',detail:'Missing identity or accepted journal.'};
  const created=createRun({runId:data.runId,seed:data.seed,roundLimit:data.roundLimit});if(!created.ok)return{ok:false,error:'invalid_state',detail:created.error};
  let state=created.state;for(const action of data.journal){const result=applyCommand(state,{runId:state.runId,expectedRevision:state.revision,action});if(!result.ok)return{ok:false,error:'invalid_journal',detail:result.error};state=result.state;}
  return canonicalJson(state)===encoded?{ok:true,state}:{ok:false,error:'invalid_state',detail:'Snapshot differs from deterministic replay.'};
}
