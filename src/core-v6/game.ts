import {freezeDeep} from '../core/immutable.js';
import {hashUtf8,nextRandom} from '../core/random.js';
import {canonicalJson} from '../core/validate.js';
import {MAX_JOURNAL_ACTIONS,MAX_SAVE_BYTES,RULES_VERSION} from './model.js';
import type {Action,Availability,Blade,CachePreview,CommandResult,CreateRunResult,DamagePreview,DomainEvent,
 ErrorCode,ForgeStage,PieceId,RunState,School,Tool,Trial,TrialStep} from './model.js';

type Mutable<T>=T extends readonly(infer U)[]?Mutable<U>[]:T extends object?{-readonly[K in keyof T]:Mutable<T[K]>}:T;
const copy=<T>(value:T):Mutable<T>=>structuredClone(value) as Mutable<T>;
const PIECES:readonly PieceId[]=['main-1','main-2','main-3','echo-1','echo-2','echo-3'];
const record=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const keys=(value:Record<string,unknown>,names:readonly string[])=>Object.keys(value).sort().join(',')===[...names].sort().join(',');
const pieceId=(value:unknown):value is PieceId=>typeof value==='string'&&PIECES.some(id=>id===value);
const school=(value:unknown):value is School=>value==='steady'||value==='fissure';
const availability=(reason:ErrorCode|null):Availability=>({allowed:reason===null,reason});
const fail=(state:RunState,error:ErrorCode):CommandResult=>({ok:false,state,error,events:[]});

function fresh(stage:ForgeStage):Blade[]{
 const ids=stage==='main'?PIECES.slice(0,3):PIECES.slice(3);
 return ids.map(id=>({id,stage,school:null,status:'blank',strength:0,cracked:false,fissureMarked:false,hits:0,
  sealedStrength:null,sealedCracked:null,sealedHits:null}));
}
export function createRun(input:unknown):CreateRunResult{
 const encoded=canonicalJson(input);
 if(encoded===null||encoded.length>4096)return{ok:false,error:'invalid_command'};
 const value:unknown=JSON.parse(encoded);
 if(!record(value)||!keys(value,['runId','seed']))return{ok:false,error:'invalid_command'};
 if(typeof value.runId!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(value.runId))return{ok:false,error:'invalid_run_id'};
 if(typeof value.seed!=='string')return{ok:false,error:'invalid_seed'};
 const seed=value.seed.normalize('NFC').trim();
 if(!seed||Array.from(seed).length>64)return{ok:false,error:'invalid_seed'};
 const state:RunState={rulesVersion:RULES_VERSION,runId:value.runId,seed,revision:0,phase:'main-forge',coins:0,
  gateCleared:false,gatePaid:false,tool:null,blades:fresh('main'),activePieceId:'main-1',charges:{main:1,echo:0},
  trial:null,trials:[],echo:{started:false,submitted:false,toolTriggered:false,rechargeGained:0,
   returnedToForge:false,techniqueUsedAfterRecharge:false,demonstrated:false,outcome:'not-started',reason:null},
  rng:{forge:{state:hashUtf8(`${seed}|v6|forge`),draws:0}},journal:[],endReason:null};
 return freezeDeep({ok:true,state});
}

// Called only after bounded canonical JSON has removed accessors and exotic prototypes.
export function parseAction(value:unknown):Action|null{
 if(!record(value))return null;
 switch(value.type){
  case'chooseSchool':return keys(value,['type','pieceId','school'])&&pieceId(value.pieceId)&&school(value.school)
   ?{type:'chooseSchool',pieceId:value.pieceId,school:value.school}:null;
  case'forge':return keys(value,['type','pieceId','useTechnique'])&&pieceId(value.pieceId)&&typeof value.useTechnique==='boolean'
   ?{type:'forge',pieceId:value.pieceId,useTechnique:value.useTechnique}:null;
  case'discard':case'seal':return keys(value,['type','pieceId'])&&pieceId(value.pieceId)?{type:value.type,pieceId:value.pieceId}:null;
  case'guard':case'leaveCache':return keys(value,['type'])?{type:value.type}:null;
  case'strike':return keys(value,['type','targetId'])&&(value.targetId==='main-guard'||value.targetId==='echo-primary')
   ?{type:'strike',targetId:value.targetId}:null;
  case'takeCache':return keys(value,['type','target'])&&(value.target==='rope'||value.target==='latch')
   ?{type:'takeCache',target:value.target}:null;
  case'followUp':return keys(value,['type','targetId'])&&value.targetId==='echo-secondary'?{type:'followUp',targetId:'echo-secondary'}:null;
  default:return null;
 }
}

export function activeBlade(state:RunState):Blade|null{
 return state.blades.find(blade=>blade.id===state.activePieceId)??null;
}
export function crackTickets(blade:Blade):0|200|350{
 return blade.hits<3?0:blade.cracked?350:200;
}
export function damagePreview(blade:Blade,armor:number,opening:boolean):DamagePreview{
 const fissure=blade.fissureMarked&&blade.cracked;
 const ignoresArmor=fissure||opening;
 const damage=Math.max(0,blade.strength-(ignoresArmor?0:armor))+(fissure?2:0)+(opening?2:0);
 const strengthAfter=fissure?Math.max(0,blade.strength-2):blade.strength;
 return{damage,strengthBefore:blade.strength,strengthAfter,ignoresArmor,openingBonus:opening?2:0,
  fissureBonus:fissure?2:0,wear:blade.strength-strengthAfter};
}
export function cachePreview(state:RunState,blade:Blade,target:'rope'|'latch',options?:{readonly turns:number;readonly eligiblePhase:boolean}):CachePreview{
 const strike=damagePreview(blade,2,false);
 const rope=target==='rope';
 const actual=rope?blade.strength:strike.damage;
 const required=rope?5:7;
 const turns=options?.turns??state.trial?.turnsLeft??0;
 let reason:ErrorCode|null=null;
 if(!(options?.eligiblePhase??state.phase==='cache'))reason='wrong_phase';
 else if(state.tool!==null)reason='tool_unavailable';
 else if(turns<1)reason='turns_exhausted';
 else if((rope&&blade.cracked)||actual<required)reason='cache_unavailable';
 return{...availability(reason),target,tool:rope?'rebound':'furnace',required,actual,intactRequired:rope,
  intact:!blade.cracked,turnsRequired:1,damage:rope?0:strike.damage,strengthAfter:rope?blade.strength:strike.strengthAfter};
}

function forgePhase(state:RunState):boolean{
 return state.phase==='main-forge'||state.phase==='echo-forge'||state.phase==='echo-recharge';
}
function currentUsable(state:RunState,piece:PieceId):Blade|null{
 const blade=activeBlade(state);
 return blade?.id===piece&&(blade.status==='blank'||blade.status==='forging')?blade:null;
}
export function actionError(state:RunState,action:Action):ErrorCode|null{
 if(state.rulesVersion!==RULES_VERSION)return'wrong_rules';
 if(state.journal.length>=MAX_JOURNAL_ACTIONS)return'record_limit';
 switch(action.type){
  case'chooseSchool':{
   if(!forgePhase(state))return'wrong_phase';
   const blade=currentUsable(state,action.pieceId);if(!blade)return'piece_unavailable';
   if(blade.hits!==0)return'school_locked';
   return blade.school===action.school?'unavailable':null;
  }
  case'forge':{
   if(!forgePhase(state))return'wrong_phase';
   const blade=currentUsable(state,action.pieceId);if(!blade)return'piece_unavailable';
   if(!blade.school)return'school_required';
   if(blade.hits>=6)return'hammer_limit';
   if(state.phase==='echo-recharge'&&!action.useTechnique)return'wrong_phase';
   if(action.useTechnique){
    if(state.charges[blade.stage]!==1)return'no_charge';
    if(blade.school==='fissure'&&blade.cracked)return'already_cracked';
   }
   return null;
  }
  case'discard':{
   if(state.phase!=='main-forge'&&state.phase!=='echo-forge')return'wrong_phase';
   return currentUsable(state,action.pieceId)?null:'piece_unavailable';
  }
  case'seal':{
   if(state.phase!=='main-forge'&&state.phase!=='echo-forge')return'wrong_phase';
   const blade=currentUsable(state,action.pieceId);if(!blade)return'piece_unavailable';
   return blade.hits>0?null:'empty_blade';
  }
  case'guard':
   if(state.phase!=='main-trial'&&state.phase!=='echo-trial')return'wrong_phase';
   if(!state.trial||state.trial.turnsLeft<1)return'turns_exhausted';
   return state.trial.primary.health>0?null:'target_unavailable';
  case'strike':{
   if(state.phase!=='main-trial'&&state.phase!=='echo-trial')return'wrong_phase';
   const trial=state.trial;if(!trial||trial.turnsLeft<1)return'turns_exhausted';
   if(trial.primary.id!==action.targetId||trial.primary.health<=0)return'target_unavailable';
   return null;
  }
  case'takeCache':{
   const blade=activeBlade(state);if(!blade)return'piece_unavailable';
   return cachePreview(state,blade,action.target).reason;
  }
  case'leaveCache':return state.phase==='cache'?null:'wrong_phase';
  case'followUp':{
   if(state.phase!=='echo-trial')return'wrong_phase';
   const trial=state.trial;if(!trial||trial.turnsLeft<1)return'turns_exhausted';
   if(state.tool!=='rebound'||trial.kind!=='rebound')return'tool_unavailable';
   if(!trial.secondary||trial.secondary.health<=0||trial.primary.health>0||trial.storedOverkill<=0||trial.followUpUsed)return'target_unavailable';
   return null;
  }
 }
}

function archiveTrial(state:Mutable<RunState>){
 if(state.trial){state.trials.push(copy(state.trial));state.trial=null;}
}
function recap(state:Mutable<RunState>,events:DomainEvent[],reason:string,demonstrated=false){
 archiveTrial(state);
 state.phase='recap';state.activePieceId=null;state.endReason=reason;
 if(state.echo.started){state.echo.demonstrated=demonstrated;state.echo.outcome=demonstrated?'demonstrated':'incomplete';state.echo.reason=reason;}
 events.push({type:'Recap',demonstrated,reason});
}
function nextBlank(state:Mutable<RunState>,stage:ForgeStage,events:DomainEvent[]){
 const next=state.blades.find(blade=>blade.stage===stage&&blade.status==='blank'&&blade.hits===0);
 if(next){state.activePieceId=next.id;state.phase=stage==='main'?'main-forge':'echo-forge';return;}
 state.activePieceId=null;
 if(stage==='main'){
  state.phase='failed';state.endReason='main-blanks-exhausted';events.push({type:'Failed',reason:state.endReason});
 }else recap(state,events,'echo-blanks-exhausted');
}
function newTrial(blade:Blade,kind:Trial['kind']):Trial{
 return{kind,pieceId:blade.id,turnsLeft:3,opening:false,
  primary:{id:kind==='main'?'main-guard':'echo-primary',health:kind==='main'?6:2,armor:2},
  secondary:kind==='rebound'?{id:'echo-secondary',health:4,armor:0}:null,
  storedOverkill:0,reboundTriggered:false,followUpUsed:false,steps:[]};
}
function startEcho(state:Mutable<RunState>,events:DomainEvent[],tool:Tool){
 archiveTrial(state);state.tool=tool;state.echo.started=true;state.echo.outcome='pending';
 state.blades.push(...copy(fresh('echo')));state.charges.echo=1;state.phase='echo-forge';state.activePieceId='echo-1';
 events.push({type:'EchoStarted',tool});
}
function failedTrial(state:Mutable<RunState>,events:DomainEvent[]){
 const trial=state.trial!;const blade=state.blades.find(value=>value.id===trial.pieceId)!;
 blade.status='failed';events.push({type:'TrialFailed',pieceId:blade.id,stage:blade.stage});
 if(trial.kind==='main'){archiveTrial(state);nextBlank(state,'main',events);}
 else recap(state,events,'echo-turns-exhausted');
}
function finishPrimary(state:Mutable<RunState>,events:DomainEvent[],usedOpening:boolean,overkill:number){
 const trial=state.trial!;const blade=state.blades.find(value=>value.id===trial.pieceId)!;
 if(trial.kind==='main'){
  blade.status='used';state.gateCleared=true;
  if(!state.gatePaid){state.gatePaid=true;state.coins+=15;events.push({type:'GateCleared',amount:15,turnsLeft:trial.turnsLeft});}
  trial.opening=false;
  state.phase='cache';
  return;
 }
 if(trial.kind==='rebound'){
  if(usedOpening&&overkill>0&&!trial.reboundTriggered){
   trial.reboundTriggered=true;trial.storedOverkill=overkill;state.echo.toolTriggered=true;
   events.push({type:'FollowUpStored',damage:overkill});
  }
  if(trial.turnsLeft===0)recap(state,events,'echo-turns-exhausted');
  else if(trial.storedOverkill===0)recap(state,events,'rebound-no-overkill');
  return;
 }
 if(!state.echo.toolTriggered){
  state.echo.toolTriggered=true;
  const before=state.charges.echo;state.charges.echo=1;state.echo.rechargeGained=before===0?1:0;
  events.push({type:'ChargeRestored',before,after:1,gained:state.echo.rechargeGained});
 }
 blade.status='used';
 const next=state.blades.find(value=>value.stage==='echo'&&value.status==='blank'&&value.hits===0);
 if(!next){recap(state,events,'echo-no-blank-after-recharge');return;}
 archiveTrial(state);state.echo.returnedToForge=true;state.phase='echo-recharge';state.activePieceId=next.id;
}
function addStep(trial:Mutable<Trial>,step:Omit<TrialStep,'turn'>){
 trial.steps.push({...step,turn:3-trial.turnsLeft});
}

export function applyCommand(state:RunState,input:unknown):CommandResult{
 const encoded=canonicalJson(input);
 if(encoded===null||encoded.length>4096)return fail(state,'invalid_command');
 const command:unknown=JSON.parse(encoded);
 if(!record(command)||!keys(command,['runId','expectedRevision','action']))return fail(state,'invalid_command');
 if(state.rulesVersion!==RULES_VERSION)return fail(state,'wrong_rules');
 if(typeof command.runId!=='string'||command.runId!==state.runId)return fail(state,'wrong_run');
 if(!Number.isSafeInteger(command.expectedRevision)||command.expectedRevision!==state.revision)return fail(state,'stale_revision');
 const action=parseAction(command.action);if(!action)return fail(state,'invalid_command');
 const error=actionError(state,action);if(error)return fail(state,error);
 const next=copy(state);const events:DomainEvent[]=[];
 switch(action.type){
  case'chooseSchool':{
   const blade=next.blades.find(value=>value.id===action.pieceId)!;
   blade.school=action.school;events.push({type:'SchoolChosen',pieceId:blade.id,school:action.school});break;
  }
  case'forge':{
   const blade=next.blades.find(value=>value.id===action.pieceId)!;
   const before=blade.strength;const chargeBefore=next.charges[blade.stage];
   const risk=action.useTechnique?0:crackTickets(blade);
   let ticket:number|null=null;let result:'success'|'crack'|'broken'|'steady'|'fissure';
   blade.status='forging';blade.hits++;
   if(action.useTechnique){
    next.charges[blade.stage]=0;
    if(blade.school==='steady'){blade.strength++;result='steady';}
    else{blade.strength+=3;blade.cracked=true;blade.fissureMarked=true;result='fissure';}
   }else{
    const drawn=nextRandom(next.rng.forge);next.rng.forge=drawn.stream;ticket=Math.floor(drawn.value*1000);
    if(ticket<risk){
     if(blade.cracked){blade.status='broken';result='broken';}
     else{blade.cracked=true;blade.strength=Math.max(0,blade.strength-1);result='crack';}
    }else{blade.strength++;result='success';}
   }
   events.push({type:'Forged',pieceId:blade.id,technique:action.useTechnique,school:blade.school!,result,before,after:blade.strength,
    ticket,crackTickets:risk,chargeBefore,chargeAfter:next.charges[blade.stage]});
   if(next.phase==='echo-recharge'){
    blade.status='used';next.echo.techniqueUsedAfterRecharge=true;
    recap(next,events,next.echo.rechargeGained===1?'furnace-demonstrated':'furnace-charge-was-full',next.echo.rechargeGained===1);
   }else if(blade.status==='broken')nextBlank(next,blade.stage,events);
   break;
  }
  case'discard':{
   const blade=next.blades.find(value=>value.id===action.pieceId)!;blade.status='abandoned';
   events.push({type:'Discarded',pieceId:blade.id});nextBlank(next,blade.stage,events);break;
  }
  case'seal':{
   const blade=next.blades.find(value=>value.id===action.pieceId)!;
   blade.status='sealed';blade.sealedStrength=blade.strength;blade.sealedCracked=blade.cracked;blade.sealedHits=blade.hits;
   const kind=blade.stage==='main'?'main':next.tool!;
   next.trial=copy(newTrial(blade,kind));next.phase=blade.stage==='main'?'main-trial':'echo-trial';
   if(blade.stage==='echo')next.echo.submitted=true;
   events.push({type:'Sealed',pieceId:blade.id});break;
  }
  case'guard':{
   const trial=next.trial!;const blade=next.blades.find(value=>value.id===trial.pieceId)!;
   trial.turnsLeft--;trial.opening=true;
   addStep(trial,{action:'guard',targetId:trial.primary.id,strengthBefore:blade.strength,strengthAfter:blade.strength,
    damage:0,targetBefore:trial.primary.health,targetAfter:trial.primary.health,usedOpening:false});
   events.push({type:'Guarded',pieceId:blade.id,turnsLeft:trial.turnsLeft});
   if(trial.turnsLeft===0)failedTrial(next,events);break;
  }
  case'strike':{
   const trial=next.trial!;const blade=next.blades.find(value=>value.id===trial.pieceId)!;
   const usedOpening=trial.opening;const hit=damagePreview(blade,trial.primary.armor,usedOpening);
   const before=trial.primary.health;trial.primary.health=Math.max(0,before-hit.damage);
   trial.opening=false;trial.turnsLeft--;blade.strength=hit.strengthAfter;
   addStep(trial,{action:'strike',targetId:trial.primary.id,strengthBefore:hit.strengthBefore,strengthAfter:hit.strengthAfter,
    damage:hit.damage,targetBefore:before,targetAfter:trial.primary.health,usedOpening});
   const overkill=Math.max(0,hit.damage-before);
   events.push({type:'Struck',pieceId:blade.id,targetId:trial.primary.id,damage:hit.damage,overkill,before,after:trial.primary.health,
    usedOpening,turnsLeft:trial.turnsLeft});
   if(trial.primary.health===0)finishPrimary(next,events,usedOpening,overkill);
   else if(trial.turnsLeft===0)failedTrial(next,events);
   break;
  }
  case'takeCache':{
   const trial=next.trial!;const blade=next.blades.find(value=>value.id===trial.pieceId)!;
   const quote=cachePreview(next,blade,action.target);trial.turnsLeft--;trial.opening=false;
   const before=blade.strength;blade.strength=quote.strengthAfter;
   addStep(trial,{action:action.target,targetId:action.target,strengthBefore:before,strengthAfter:blade.strength,
    damage:quote.damage,targetBefore:null,targetAfter:null,usedOpening:false});
   events.push({type:'CacheTaken',target:action.target,tool:quote.tool,damage:quote.damage,strengthAfter:blade.strength});
   startEcho(next,events,quote.tool);break;
  }
  case'leaveCache':recap(next,events,'gate-cleared-without-tool');break;
  case'followUp':{
   const trial=next.trial!;const secondary=trial.secondary!;const damage=trial.storedOverkill;
   const blade=next.blades.find(value=>value.id===trial.pieceId)!;const before=secondary.health;
   secondary.health=Math.max(0,before-damage);trial.turnsLeft--;trial.storedOverkill=0;trial.followUpUsed=true;
   addStep(trial,{action:'followUp',targetId:'echo-secondary',strengthBefore:blade.strength,strengthAfter:blade.strength,
    damage,targetBefore:before,targetAfter:secondary.health,usedOpening:false});
   events.push({type:'FollowUpUsed',targetId:'echo-secondary',damage,healthAfter:secondary.health});
   if(secondary.health===0){blade.status='used';recap(next,events,'rebound-demonstrated',true);}
   else if(trial.turnsLeft===0)failedTrial(next,events);
   break;
  }
 }
 next.revision++;next.journal.push(copy(action));
 const serialized=canonicalJson(next);
 if(serialized===null||new TextEncoder().encode(serialized).byteLength>MAX_SAVE_BYTES)return fail(state,'record_limit');
 return freezeDeep({ok:true,state:next,events});
}
