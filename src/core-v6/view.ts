import {freezeDeep} from '../core/immutable.js';
import {actionError,activeBlade,cachePreview,crackTickets,damagePreview} from './game.js';
import type {Action,Availability,Blade,ForgePreview,RunState,RunView} from './model.js';

const available=(state:RunState,action:Action):Availability=>{
 const reason=actionError(state,action);return{allowed:reason===null,reason};
};

// Eight bounded three-turn action paths, with the same damage/wear function as Accepted resolution.
// This forecasts the current blade, without inventing future forge outcomes or spending a turn.
function mainPlan(state:RunState,blade:Blade):NonNullable<RunView['bladeUses']>['mainPlan']{
 const routes:{actions:('guard'|'strike')[];damage:number;remainingTurns:number;strengthAfterGate:number;rope:boolean;latch:boolean}[]=[];
 const walk=(current:Blade,health:number,opening:boolean,turns:number,actions:('guard'|'strike')[],damage:number):void=>{
  if(turns===0)return;
  const hit=damagePreview(current,2,opening);
  const after:Blade={...current,strength:hit.strengthAfter};
  const strikeActions=[...actions,'strike' as const];
  if(hit.damage>=health){
   const remaining=turns-1;
   routes.push({actions:strikeActions,damage:damage+hit.damage,remainingTurns:remaining,strengthAfterGate:after.strength,
    rope:cachePreview(state,after,'rope',{turns:remaining,eligiblePhase:true}).allowed,
    latch:cachePreview(state,after,'latch',{turns:remaining,eligiblePhase:true}).allowed});
  }else walk(after,health-hit.damage,false,turns-1,strikeActions,damage+hit.damage);
  walk(current,health,true,turns-1,[...actions,'guard'],damage);
 };
 walk(blade,6,false,3,[],0);
 return{clearable:routes.length>0,maxRemainingTurns:routes.length?Math.max(...routes.map(route=>route.remainingTurns)):null,routes};
}
function forgePreview(state:RunState,blade:Blade):ForgePreview{
 const techniqueAction:Action={type:'forge',pieceId:blade.id,useTechnique:true};
 const fissure=blade.school==='fissure';
 return{
  ordinary:{...available(state,{type:'forge',pieceId:blade.id,useTechnique:false}),crackTickets:crackTickets(blade),totalTickets:1000,
   successStrength:blade.strength+1,crackStrength:blade.cracked?blade.strength:Math.max(0,blade.strength-1),
   crackBreaks:blade.cracked,draws:1},
  technique:{...available(state,techniqueAction),school:blade.school,strengthAfter:blade.strength+(fissure?3:1),
   crackedAfter:blade.cracked||fissure,fissureMarkedAfter:blade.fissureMarked||fissure,chargeAfter:0,draws:0},
  seal:available(state,{type:'seal',pieceId:blade.id}),discard:available(state,{type:'discard',pieceId:blade.id}),
  chooseSchool:available(state,{type:'chooseSchool',pieceId:blade.id,school:blade.school==='steady'?'fissure':'steady'})
 };
}
export function getRunView(state:RunState):RunView{
 const blade=activeBlade(state);const stage=state.echo.started?'echo':'main';
 const unusedIds=state.blades.filter(value=>value.stage===stage&&value.status==='blank'&&value.hits===0).map(value=>value.id);
 const forgePhase=state.phase==='main-forge'||state.phase==='echo-forge'||state.phase==='echo-recharge';
 const targetId=state.trial?.primary.id??(stage==='main'?'main-guard':'echo-primary');
 const plan=blade?mainPlan(state,blade):null;
 const best=plan?.routes.reduce<NonNullable<RunView['bladeUses']>['mainPlan']['routes'][number]|null>((previous,route)=>
  !previous||route.remainingTurns>previous.remainingTurns?route:previous,null)??null;
 const afterGate=blade&&best?{...blade,strength:best.strengthAfterGate}:blade;
 const predictedPhase=blade?.stage==='main'&&best!==null;
 const uses=blade&&afterGate&&plan?{
  direct:damagePreview(blade,2,false),opening:damagePreview(blade,2,true),
  ropeAfterGate:cachePreview(state,afterGate,'rope',{turns:best?.remainingTurns??0,eligiblePhase:predictedPhase}),
  latchAfterGate:cachePreview(state,afterGate,'latch',{turns:best?.remainingTurns??0,eligiblePhase:predictedPhase}),mainPlan:plan
 }:null;
 const currentTrial=state.trial;
 const view:RunView={rulesVersion:state.rulesVersion,runId:state.runId,revision:state.revision,phase:state.phase,
  activePiece:blade,blades:state.blades,unusedBlanks:unusedIds.length,charge:state.charges[stage],
  techniquePieceIds:[...new Set(state.journal.flatMap(action=>action.type==='forge'&&action.useTechnique?[action.pieceId]:[]))],
  batch:{stage,total:3,unusedIds,charge:state.charges[stage]},
  coins:state.coins,gateCleared:state.gateCleared,gatePaid:state.gatePaid,tool:state.tool,
  forge:blade&&forgePhase?forgePreview(state,blade):null,trial:currentTrial,history:state.trials,
  guard:available(state,{type:'guard'}),
  strike:{...available(state,{type:'strike',targetId}),targetId,
   preview:blade&&currentTrial?damagePreview(blade,currentTrial.primary.armor,currentTrial.opening):null},
  followUp:{...available(state,{type:'followUp',targetId:'echo-secondary'}),targetId:'echo-secondary',damage:currentTrial?.storedOverkill??0},
  caches:blade?(['rope','latch'] as const).map(target=>cachePreview(state,blade,target)):[],
  leaveCache:available(state,{type:'leaveCache'}),bladeUses:uses,echo:state.echo,
  ended:state.phase==='recap'||state.phase==='failed',endReason:state.endReason};
 return freezeDeep(view);
}
