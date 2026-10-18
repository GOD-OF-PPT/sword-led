import { freezeDeep } from '../core/immutable.js';
import { isRecord } from '../core/guards.js';
import { hashUtf8, nextRandom } from '../core/random.js';
import type { Action, CommandResult, Condition, ConditionKind, CreateResult, CreateRunInput, DomainEvent, ErrorCode,
  HammerMode, Material, Pattern, PieceOutcome, RunState, Stat, Technique, TimingGrade, Workpiece } from './model.js';
import { adjacent, gradeOf, HAMMERS, makePiece, marketValue, quotaFor, REQUEST_KINDS, requestBonus, requestFor,
  RULES_VERSION, salvageValue, STARTERS, statAt, TECHNIQUE_IDS, TECHNIQUES } from './rules.js';

type Mutable<T> = T extends readonly (infer U)[] ? Mutable<U>[] : T extends object ? {-readonly [K in keyof T]:Mutable<T[K]>}:T;
// All reducers edit a detached plain-data copy, never the supplied snapshot.
const copy = <T>(value:T):Mutable<T> => structuredClone(value) as Mutable<T>;
const technique = (value:unknown):value is Technique => typeof value==='string'&&TECHNIQUE_IDS.some(id=>id===value);
const integer = (value:unknown,min:number,max:number):value is number => typeof value==='number'&&Number.isInteger(value)&&value>=min&&value<=max;
const fail = (state:RunState,error:ErrorCode):CommandResult => ({ok:false,state,error,events:[]});

export function parseAction(value:unknown):{ok:true;action:Action}|{ok:false;error:ErrorCode} {
  if(!isRecord(value))return{ok:false,error:'invalid_command'};
  const pieceId=typeof value.pieceId==='string'?value.pieceId:null;
  switch(value.type){
    case 'chooseTechnique':return technique(value.techniqueId)?{ok:true,action:{type:value.type,techniqueId:value.techniqueId}}:{ok:false,error:'invalid_technique'};
    case 'chooseRequest':return value.requestId===null||typeof value.requestId==='string'?{ok:true,action:{type:value.type,requestId:value.requestId}}:{ok:false,error:'invalid_request'};
    case 'strike':{
      if(!pieceId)return{ok:false,error:'invalid_command'};
      if(!integer(value.node,0,9))return{ok:false,error:'invalid_node'};
      if(value.mode!=='light'&&value.mode!=='standard'&&value.mode!=='heavy')return{ok:false,error:'invalid_hammer'};
      if(!integer(value.timingMark,0,10000))return{ok:false,error:'invalid_timing'};
      return{ok:true,action:{type:'strike',pieceId,node:value.node,mode:value.mode,timingMark:value.timingMark}};
    }
    case 'reheat':case 'deliver':case 'scrap':return pieceId?{ok:true,action:{type:value.type,pieceId}}:{ok:false,error:'invalid_command'};
    case 'quench':return pieceId&&(value.medium==='water'||value.medium==='oil')?{ok:true,action:{type:'quench',pieceId,medium:value.medium}}:{ok:false,error:'invalid_command'};
    case 'settleRound':return typeof value.recycleRemaining==='boolean'?{ok:true,action:{type:'settleRound',recycleRemaining:value.recycleRemaining}}:{ok:false,error:'invalid_command'};
    case 'buy':{
      if(value.productId!=='repair'&&!technique(value.productId))return{ok:false,error:'invalid_technique'};
      if(value.replaceId!==undefined&&!technique(value.replaceId))return{ok:false,error:'invalid_replacement'};
      return{ok:true,action:{type:'buy',productId:value.productId,...(value.replaceId!==undefined?{replaceId:value.replaceId}:{})}};
    }
    case 'advanceSummary':case 'leaveMerchant':return{ok:true,action:{type:value.type}};
    default:return{ok:false,error:'invalid_command'};
  }
}

function draw(state:Mutable<RunState>,domain:keyof RunState['rng'],count:number):number {
  const next=nextRandom(state.rng[domain]);state.rng[domain]=copy(next.stream);return Math.floor(next.value*count);
}
function roundContent(state:Mutable<RunState>,round:number){
  const previous=state.condition.kind;
  let condition:Condition={kind:'steady',stat:null,pattern:null};
  if(round>=4){
    const kinds:ConditionKind[]=['steady','wetCoal','brightFire','brittle','urgent','reclaimed'].filter(kind=>kind!==previous) as ConditionKind[];
    const kind=kinds[draw(state,'conditions',kinds.length)]??'steady';
    condition={kind,stat:kind==='reclaimed'?(['edge','toughness','balance'] as const)[draw(state,'conditions',3)]??'edge':null,
      pattern:kind==='urgent'?(['edge','spine','bridge'] as const)[draw(state,'conditions',3)]??'edge':null};
  }
  state.condition=copy(condition);state.coal=condition.kind==='wetCoal'?1:2;
  const third:Material=round===1?'steel':(['iron','steel','meteorite'] as const)[(()=>{const r=draw(state,'stock',100);return r<35?0:r<80?1:2;})()]??'iron';
  const materials:Material[]=round===1?['iron','iron','steel']:['iron','steel',third];
  state.pieces=materials.map((material,index)=>copy(makePiece(round,index+1,material,condition)));
  const pool=round<4?REQUEST_KINDS.slice(0,4):[...REQUEST_KINDS];
  const kinds=round===1?(['guard','courier'] as const):Array.from({length:2},()=>pool.splice(draw(state,'requests',pool.length),1)[0]??'guard');
  state.requests=kinds.map(kind=>copy(requestFor(kind,round,condition)));
  state.requestDecided=false;state.acceptedRequestId=null;state.fulfilledRequestId=null;state.roundBreaks=0;state.merchant=[];
}
export function createRun(input:CreateRunInput):CreateResult {
  if(!isRecord(input)||typeof input.runId!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(input.runId))return{ok:false,error:'invalid_run_id'};
  if(typeof input.seed!=='string')return{ok:false,error:'invalid_seed'};
  const seed=input.seed.normalize('NFC').trim();if(Array.from(seed).length<1||Array.from(seed).length>64)return{ok:false,error:'invalid_seed'};
  const state:Mutable<RunState>={rulesVersion:RULES_VERSION,runId:input.runId,seed,revision:0,phase:'workshop',round:1,coins:0,scrap:0,coal:2,seals:3,
    starterChosen:false,techniques:[],pieces:[],condition:{kind:'steady',stat:null,pattern:null},credit:0,pendingCredit:0,
    requests:[],requestDecided:false,acceptedRequestId:null,fulfilledRequestId:null,returns:[],roundBreaks:0,merchant:[],purchases:[],history:[],
    rng:{stock:{state:hashUtf8(`${seed}|v2|stock`),draws:0},requests:{state:hashUtf8(`${seed}|v2|requests`),draws:0},conditions:{state:hashUtf8(`${seed}|v2|conditions`),draws:0},merchant:{state:hashUtf8(`${seed}|v2|merchant`),draws:0}},journal:[]};
  roundContent(state,1);return freezeDeep({ok:true,state});
}
export function productionError(state:RunState,piece?:Workpiece):ErrorCode|null {
  if(state.phase!=='workshop')return'wrong_phase';
  if(!state.starterChosen)return'choose_technique';
  if(!state.requestDecided)return'choose_request';
  if(piece===undefined)return'piece_not_found';
  return piece.status==='active'?null:'piece_finalized';
}
function damage(piece:Mutable<Workpiece>,amount:number):number {
  const before=piece.integrity;piece.stress=Math.max(0,piece.stress+amount);
  while(piece.stress>=piece.threshold&&piece.integrity>0){piece.stress-=piece.threshold;piece.integrity--;}
  if(piece.integrity===0)piece.status='broken';
  return before-piece.integrity;
}
function denied(piece:Workpiece,reason:ErrorCode):PieceOutcome {return{allowed:false,reason,piece,heatCost:0,stressAdded:0,gained:0,damaged:0,pattern:null};}
export function previewStrike(state:RunState,piece:Workpiece,node:number,mode:HammerMode,grade:TimingGrade):PieceOutcome {
  const error=productionError(state,piece);if(error)return denied(piece,error);
  if(piece.quench!==null)return denied(piece,'already_quenched');
  if(!integer(node,0,9))return denied(piece,'invalid_node');
  const hammer=HAMMERS[mode],tongs=mode==='heavy'&&piece.heavyStrikes<2&&state.techniques.includes('warmTongs');
  const heatCost=hammer.heat-(tongs?4:0);if(piece.heat<heatCost)return denied(piece,'no_heat');
  if((piece.nodes[node]??0)+hammer.force>6)return denied(piece,'node_full');
  const p=copy(piece),gained=hammer.force-(grade==='mishit'?1:0);
  const stressAdded=Math.max(0,hammer.stress+(tongs?2:0)+(mode==='heavy'&&state.condition.kind==='brightFire'?2:0)-(grade==='precise'?2:0))+(grade==='mishit'?10:0)+(piece.heat<24?8:0);
  p.nodes[node]=(p.nodes[node]??0)+hammer.force;p.heat-=heatCost;p.ratings[statAt(node)]+=gained;p.strikes++;if(mode==='heavy')p.heavyStrikes++;
  let pattern:Pattern|null=null;
  if(grade==='mishit')p.chain=[];
  else{
    const last=p.chain.at(-1);p.chain=last!==undefined&&!p.chain.includes(node)&&adjacent(last,node)?[...p.chain,node]:[node];
    if(p.chain.length===3){
      const formed:Pattern=p.chain.every(n=>n<5)?'edge':p.chain.every(n=>n>=5)?'spine':'bridge';
      const rewarded=!p.patterns.includes(formed);p.traces.push({pattern:formed,nodes:[...p.chain],rewarded});p.chain=[];
      if(rewarded){p.patterns.push(formed);pattern=formed;const stat:Stat=formed==='edge'?'edge':formed==='spine'?'toughness':'balance';p.ratings[stat]+=formed==='edge'&&state.techniques.includes('edgeTooth')?4:2;}
    }
  }
  const damaged=damage(p,stressAdded);return{allowed:true,reason:null,piece:p,heatCost,stressAdded,gained,damaged,pattern};
}
export function previewQuench(state:RunState,piece:Workpiece,medium:'water'|'oil'):PieceOutcome {
  const error=productionError(state,piece);if(error)return denied(piece,error);
  if(piece.quench!==null)return denied(piece,'already_quenched');if(piece.strikes===0)return denied(piece,'not_forged');
  const p=copy(piece);let stressAdded=medium==='water'?8:-8;
  if(medium==='water'){
    p.ratings.edge+=2;p.ratings.toughness=Math.max(0,p.ratings.toughness-1);
    if(state.techniques.includes('bridgeClip')&&p.patterns.includes('bridge')&&!p.bridgeUsed){stressAdded=0;p.bridgeUsed=true;}
  }else{
    const r=piece.ratings;if(state.techniques.includes('balanceWeight')&&Math.max(r.edge,r.toughness,r.balance)-Math.min(r.edge,r.toughness,r.balance)<=4)p.ratings.balance+=3;
    p.ratings.toughness+=2;p.ratings.edge=Math.max(0,p.ratings.edge-1);
  }
  p.quench=medium;const damaged=damage(p,stressAdded);return{allowed:true,reason:null,piece:p,heatCost:0,stressAdded,gained:0,damaged,pattern:null};
}
function registerBroken(state:Mutable<RunState>,piece:Mutable<Workpiece>,events:DomainEvent[]){
  if(piece.status!=='broken')return;
  const scrap=1+(state.roundBreaks===0&&state.techniques.includes('shardBox')?4:0);state.roundBreaks++;piece.recoveredScrap=scrap;state.scrap+=scrap;events.push({type:'broken',pieceId:piece.id,scrap});
}
function recycle(state:Mutable<RunState>,piece:Mutable<Workpiece>,events:DomainEvent[]){const scrap=salvageValue(piece,state.condition);piece.status='recycled';piece.recoveredScrap=scrap;state.scrap+=scrap;events.push({type:'scrap',pieceId:piece.id,scrap});}
function returnsDue(state:Mutable<RunState>,events:DomainEvent[],ending=false){
  for(const visit of state.returns)if(!visit.received&&(visit.dueRound<=state.round||(ending&&state.round===12))){visit.received=true;state.scrap++;events.push({type:'return',pieceId:visit.pieceId,scrap:1,label:visit.label});}
}
function enterRound(state:Mutable<RunState>,events:DomainEvent[]){state.round++;state.phase='workshop';state.credit=state.pendingCredit;state.pendingCredit=0;roundContent(state,state.round);returnsDue(state,events);events.push({type:'round',value:state.round});}

export function applyCommand(state:RunState,command:unknown):CommandResult {
  if(!isRecord(command)||!Number.isInteger(command.expectedRevision)||typeof command.runId!=='string')return fail(state,'invalid_command');
  if(command.runId!==state.runId)return fail(state,'foreign_run');if(command.expectedRevision!==state.revision)return fail(state,'stale_revision');
  const parsed=parseAction(command.action);if(!parsed.ok)return fail(state,parsed.error);const action=parsed.action;
  const next=copy(state),events:DomainEvent[]=[];
  if('pieceId'in action){
    const p=next.pieces.find(piece=>piece.id===action.pieceId),error=productionError(state,p);if(error)return fail(state,error);if(!p)return fail(state,'piece_not_found');
    switch(action.type){
      case 'strike':case 'quench':{
        const outcome=action.type==='strike'?previewStrike(state,p,action.node,action.mode,gradeOf(action.timingMark)):previewQuench(state,p,action.medium);
        if(!outcome.allowed)return fail(state,outcome.reason??'invalid_command');
        const replacement=copy(outcome.piece);next.pieces=next.pieces.map(piece=>piece.id===p.id?replacement:piece);
        events.push({type:action.type,pieceId:p.id,...(action.type==='strike'?{grade:gradeOf(action.timingMark)}:{})});
        if(outcome.pattern)events.push({type:'pattern',pieceId:p.id,pattern:outcome.pattern});registerBroken(next,replacement,events);break;
      }
      case 'reheat':{
        if(p.quench!==null)return fail(state,'already_quenched');if(next.coal<=0)return fail(state,'no_coal');if(p.heat>=100&&p.stress===0)return fail(state,'already_hot');
        next.coal--;p.heat=100;p.stress=Math.max(0,p.stress-18);p.chain=[];if(p.reheats===0&&next.techniques.includes('reheatSand'))p.ratings.toughness+=2;p.reheats++;events.push({type:'reheat',pieceId:p.id});break;
      }
      case 'deliver':{
        const request=next.requests.find(r=>r.id===next.acceptedRequestId),bonus=request&&next.fulfilledRequestId===null?requestBonus(p,request,next.condition):0;
        const value=marketValue(p)+bonus;p.status='delivered';p.paidValue=value;next.coins+=value;
        if(bonus&&request){next.fulfilledRequestId=request.id;next.returns.push({requestId:request.id,label:request.label,pieceId:p.id,dueRound:next.round+2,received:false});}
        events.push({type:'delivery',pieceId:p.id,value,...(bonus?{label:request?.label??''}:{})});break;
      }
      case 'scrap':recycle(next,p,events);break;
    }
  }else switch(action.type){
    case 'chooseTechnique':{
      if(next.phase!=='workshop')return fail(state,'wrong_phase');if(next.starterChosen)return fail(state,'already_chosen');if(!STARTERS.includes(action.techniqueId))return fail(state,'invalid_technique');
      next.starterChosen=true;next.techniques.push(action.techniqueId);events.push({type:'starter',label:TECHNIQUES[action.techniqueId].label});break;
    }
    case 'chooseRequest':{
      if(next.phase!=='workshop')return fail(state,'wrong_phase');if(!next.starterChosen)return fail(state,'choose_technique');if(next.requestDecided)return fail(state,'already_chosen');
      if(action.requestId!==null&&!next.requests.some(r=>r.id===action.requestId))return fail(state,'invalid_request');next.requestDecided=true;next.acceptedRequestId=action.requestId;events.push({type:'request'});break;
    }
    case 'settleRound':{
      if(next.phase!=='workshop')return fail(state,'wrong_phase');if(!next.starterChosen)return fail(state,'choose_technique');if(!next.requestDecided)return fail(state,'choose_request');
      if(!action.recycleRemaining&&next.pieces.some(p=>p.status==='active'))return fail(state,'unprocessed_pieces');
      for(const p of next.pieces)if(p.status==='active')recycle(next,p,events);
      const delivered=next.pieces.reduce((n,p)=>n+p.paidValue,0),quota=quotaFor(next.round),met=delivered+next.credit>=quota;
      const before=next.seals;next.seals-=met?0:1;next.pendingCredit=next.round===12?0:Math.min(Math.floor(Math.max(0,delivered-quota)/2),Math.floor(quotaFor(next.round+1)/4));
      next.history.push({round:next.round,quota,delivered,credit:next.credit,met,sealsBefore:before,sealsAfter:next.seals,nextCredit:next.pendingCredit,pieces:copy(next.pieces),condition:copy(next.condition),request:copy(next.requests.find(r=>r.id===next.acceptedRequestId)??null)});
      next.phase=next.seals===0?'defeat':next.round===12?'victory':'roundSummary';if(next.phase==='victory'||next.phase==='defeat')returnsDue(next,events,true);events.push({type:'settled',value:delivered});break;
    }
    case 'advanceSummary':{
      if(next.phase!=='roundSummary')return fail(state,'wrong_phase');
      if([3,6,9].includes(next.round)){
        const pool=TECHNIQUE_IDS.filter(id=>!next.techniques.includes(id));next.merchant=[];
        while(pool.length&&next.merchant.length<3)next.merchant.push(pool.splice(draw(next,'merchant',pool.length),1)[0]??'edgeTooth');next.phase='merchant';events.push({type:'merchant'});
      }else enterRound(next,events);break;
    }
    case 'leaveMerchant':if(next.phase!=='merchant')return fail(state,'wrong_phase');enterRound(next,events);break;
    case 'buy':{
      if(next.phase!=='merchant')return fail(state,'wrong_phase');
      if(next.purchases.some(p=>p.afterRound===next.round&&p.productId===action.productId))return fail(state,'already_purchased');
      const id=action.productId,price=id==='repair'?{coins:240,scrap:6}:TECHNIQUES[id];
      if(id==='repair'){if(action.replaceId!==undefined)return fail(state,'invalid_replacement');if(next.seals>=3)return fail(state,'repair_not_needed');}
      else{
        if(!next.merchant.includes(id))return fail(state,'not_offered');if(next.techniques.includes(id))return fail(state,'already_owned');
        if(action.replaceId!==undefined&&!next.techniques.includes(action.replaceId))return fail(state,'invalid_replacement');
        if(next.techniques.length>=3&&action.replaceId===undefined)return fail(state,'replacement_required');
      }
      if(next.coins<price.coins)return fail(state,'insufficient_coins');if(next.scrap<price.scrap)return fail(state,'insufficient_scrap');
      next.coins-=price.coins;next.scrap-=price.scrap;
      if(id==='repair')next.seals++;else{if(action.replaceId!==undefined)next.techniques=next.techniques.filter(t=>t!==action.replaceId);next.techniques.push(id);}
      next.purchases.push({afterRound:next.round,productId:id,replaced:action.replaceId??null,coins:price.coins,scrap:price.scrap});events.push({type:'purchase',label:id==='repair'?'契约修补':TECHNIQUES[id].label});break;
    }
  }
  next.revision++;next.journal.push(copy(action));return freezeDeep({ok:true,state:next,events});
}
