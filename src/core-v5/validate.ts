import {canonicalJson} from '../core/validate.js';
import {isRecord} from '../core/guards.js';
import {createRun,applyCommand} from './game.js';
import {JOURNAL_LIMIT} from './rules.js';
import type {CreateRunInput,RunState} from './model.js';
export function validateRun(input:unknown):{ok:true;state:RunState}|{ok:false;error:string;detail:string}{
 const encoded=canonicalJson(input);if(!encoded)return{ok:false,error:'invalid_state',detail:'Expected bounded plain JSON with safe integer fields.'};
 const p:unknown=JSON.parse(encoded);if(!isRecord(p)||p.rulesVersion!=='forge-v5')return{ok:false,error:'invalid_rules_version',detail:'Expected forge-v5.'};
 if(typeof p.runId!=='string'||typeof p.seed!=='string'||!Array.isArray(p.journal)||p.journal.length>JOURNAL_LIMIT)return{ok:false,error:'invalid_state',detail:'Missing identity or bounded Accepted journal.'};
 const created=createRun({runId:p.runId,seed:p.seed,mode:p.mode,eligibility:p.initialEligibility}as CreateRunInput);if(!created.ok)return{ok:false,error:'invalid_state',detail:created.error};
 let state=created.state;for(const [i,action]of p.journal.entries()){const r=applyCommand(state,{runId:state.runId,expectedRevision:state.revision,action});if(!r.ok)return{ok:false,error:'invalid_journal',detail:`Command ${i}: ${r.error}`};state=r.state;}
 return canonicalJson(state)===encoded?{ok:true,state}:{ok:false,error:'invalid_state',detail:'Snapshot differs from full deterministic replay.'};
}
