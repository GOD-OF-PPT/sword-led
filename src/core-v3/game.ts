import {freezeDeep} from '../core/immutable.js';
import {canonicalJson} from '../core/validate.js';
import {isRecord} from '../core/guards.js';
import {hashUtf8,nextRandom} from '../core/random.js';
import {TRAIT_IDS,quotaFor,recovery,atCap,merchantPresent,upgradePrice,strikeOdds,settlementPreview,VALUE_CAP} from './rules.js';
import type {Action,Blade,CommandResult,CreateRunInput,DomainEvent,ErrorCode,Hit,RunState,Trait} from './model.js';
type Mutable<T>=T extends readonly (infer U)[]?Mutable<U>[]:T extends object?{-readonly[K in keyof T]:Mutable<T[K]>}:T;
const copy=<T>(value:T)=>structuredClone(value) as Mutable<T>;
const isTrait=(v:unknown):v is Trait=>typeof v==='string'&&TRAIT_IDS.some(id=>id===v);
const fail=(state:RunState,error:ErrorCode):CommandResult=>({ok:false,state,error,events:[]});
function draw(s:Mutable<RunState>,domain:'forge'|'shop',count:number){const d=nextRandom(s.rng[domain]);s.rng[domain]=d.stream;return Math.floor(d.value*count);}
function supply(s:Mutable<RunState>){
  const bonus=Math.min(s.base*4,s.pendingInheritance);s.pendingInheritance=0;
  for(let i=1;i<=3;i++){const base=s.base+(i===1?bonus:0);s.blades.push({id:`r${s.round}-${i}`,suppliedRound:s.round,status:'active',base,value:base,peak:base,level:0,cracked:false,hits:0,charge:0,successes:0,finalizedRound:null});}
  s.shop=[];s.sold=[];s.upgraded=false;s.repaired=false;
  if([3,6,9].includes(s.round)){const pool=TRAIT_IDS.filter(t=>!s.traits.includes(t));while(s.shop.length<2&&pool.length){const id=pool.splice(draw(s,'shop',pool.length),1)[0];if(id)s.shop.push(id);}}
}
export function createRun(input:CreateRunInput):{ok:true;state:RunState}|{ok:false;error:ErrorCode}{
  if(!isRecord(input)||typeof input.runId!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(input.runId))return{ok:false,error:'invalid_run_id'};
  if(typeof input.seed!=='string')return{ok:false,error:'invalid_seed'};
  const seed=input.seed.normalize('NFC').trim();if(!seed||Array.from(seed).length>64)return{ok:false,error:'invalid_seed'};
  if(input.roundLimit!==undefined&&input.roundLimit!==3&&input.roundLimit!==12)return{ok:false,error:'invalid_command'};
  const s:Mutable<RunState>={rulesVersion:'forge-v3',runId:input.runId,seed,roundLimit:input.roundLimit??3,revision:0,phase:'workshop',round:1,coins:0,seals:3,base:40,blades:[],reserveId:null,delivered:0,traits:[],gift:'locked',pardonUsed:false,pendingInheritance:0,shop:[],sold:[],upgraded:false,repaired:false,history:[],rng:{forge:{state:hashUtf8(`${seed}|v3|forge`),draws:0},shop:{state:hashUtf8(`${seed}|v3|shop`),draws:0}},journal:[]};
  supply(s);return freezeDeep({ok:true,state:s});
}
export function parseAction(value:unknown):Action|null{
  if(!isRecord(value))return null;
  const keys=Object.keys(value).sort().join(',');
  switch(value.type){
    case'strike':case'deliver':case'scrap':case'reserve':return keys==='pieceId,type'&&typeof value.pieceId==='string'?{type:value.type,pieceId:value.pieceId}:null;
    case'upgrade':case'repair':case'settle':case'advance':return keys==='type'?{type:value.type}:null;
    case'buy':case'claimGift':{
      if(value.type==='buy'&&typeof value.pieceId!=='string')return null;
      if(!isTrait(value.traitId)&&!(value.type==='claimGift'&&value.traitId===null))return null;
      if(value.replaceId!==undefined&&!isTrait(value.replaceId))return null;
      const expected=[...(value.type==='buy'?['pieceId']:[]),'traitId','type',...(value.replaceId===undefined?[]:['replaceId'])].sort().join(',');
      if(keys!==expected)return null;
      return value as unknown as Action;
    }
    default:return null;
  }
}
function equip(s:Mutable<RunState>,id:Trait,replace:Trait|undefined):ErrorCode|null{
  if(s.traits.includes(id))return'already_owned';
  if(s.traits.length===3){if(!replace||!s.traits.includes(replace))return'invalid_replacement';s.traits.splice(s.traits.indexOf(replace),1);}
  else if(replace!==undefined)return'invalid_replacement';
  s.traits.push(id);return null;
}
function hit(s:Mutable<RunState>,b:Mutable<Blade>,safe:boolean):Hit{
  const odds=strikeOdds(s,b),ticket=draw(s,'forge',1000),before=b.value,triggers:Trait[]=[];
  let result:Hit['result']=ticket<(safe?350:odds.great)?'great':!safe&&ticket<odds.great+odds.crack?'crack':'success';
  if(!safe)b.hits++;
  if(result==='crack'){
    if(b.cracked){result='broken';b.status='broken';b.finalizedRound=s.round;b.value=0;s.coins+=recovery(b);
      if(s.traits.includes('inherit')){s.pendingInheritance+=Math.floor(b.peak/5);triggers.push('inherit');}}
    else{b.cracked=true;if(s.traits.includes('steady'))triggers.push('steady');else b.value=Math.floor(b.value*80/100);}
  }else{
    b.value=Math.min(VALUE_CAP,Math.floor(b.value*(result==='great'?220:145)/100));b.level=Math.min(99,b.level+(result==='great'?2:1));
    if(!safe){b.successes++;if(s.traits.includes('echo')&&b.successes%3===0){b.value=Math.min(VALUE_CAP,Math.floor(b.value*125/100));triggers.push('echo');}}
    if(!safe&&b.cracked&&s.traits.includes('crackedEdge')&&result==='great')triggers.push('crackedEdge');
  }
  b.peak=Math.max(b.peak,b.value);if(!safe&&b.status==='active')b.charge=Math.min(6,b.charge+1);
  return{result,before,after:b.value,level:b.level,triggers};
}
export function applyCommand(state:RunState,command:unknown):CommandResult{
  const encoded=canonicalJson(command);if(!encoded)return fail(state,'invalid_command');
  const c:unknown=JSON.parse(encoded);if(!isRecord(c))return fail(state,'invalid_command');
  if(c.runId!==state.runId)return fail(state,'wrong_run');if(c.expectedRevision!==state.revision)return fail(state,'stale_revision');
  const action=parseAction(c.action);if(!action)return fail(state,'invalid_command');
  if(action.type==='advance'?state.phase!=='summary':state.phase!=='workshop')return fail(state,'wrong_phase');
  if(state.journal.length>=2048)return fail(state,'record_limit');
  // Reserve journal space for disposition/settlement if nonproductive toggling fills it.
  if(state.journal.length>=1900&&['strike','buy','claimGift','upgrade','repair'].includes(action.type))return fail(state,'record_limit');
  if(state.journal.length>=1900&&action.type==='reserve'&&state.reserveId!==action.pieceId)return fail(state,'record_limit');
  const s=copy(state),events:DomainEvent[]=[];
  const b='pieceId'in action?s.blades.find(p=>p.id===action.pieceId):undefined;
  if('pieceId'in action&&(!b||b.status!=='active'))return fail(state,'piece_unavailable');
  if('pieceId'in action&&action.type!=='reserve'&&s.reserveId===action.pieceId)return fail(state,'reserved_piece');
  switch(action.type){
    case'strike':{
      if(!b)return fail(state,'piece_unavailable');if(atCap(b))return fail(state,'at_cap');
      const burst=b.charge===6,hits:Hit[]=[];
      if(burst){b.charge=0;const count=s.traits.includes('ember')?3:2;for(let i=0;i<count&&!atCap(b);i++){const h=hit(s,b,true);hits.push({...h,triggers:[...h.triggers,...(count===3?['ember' as const]:[])]});}}
      else hits.push(hit(s,b,false));
      events.push({type:'Strike',pieceId:b.id,burst,hits});break;
    }
    case'deliver':case'scrap':{
      if(!b)return fail(state,'piece_unavailable');const amount=action.type==='deliver'?b.value:recovery(b);
      b.status=action.type==='deliver'?'delivered':'recycled';b.finalizedRound=s.round;s.coins+=amount;
      if(action.type==='deliver'){s.delivered+=amount;if(s.gift==='locked'&&s.delivered>=quotaFor(s.round))s.gift='available';}
      events.push({type:action.type==='deliver'?'Delivered':'Recycled',pieceId:b.id,amount});break;
    }
    case'reserve':{if(!b)return fail(state,'piece_unavailable');const previousId=s.reserveId;s.reserveId=previousId===b.id?null:b.id;events.push({type:'Reserved',pieceId:b.id,previousId});break;}
    case'claimGift':{
      if(s.gift!=='available')return fail(state,'unavailable');
      const options=(['steady','ember'] as const).filter(id=>!s.traits.includes(id));
      if(options.length===0){if(action.traitId!==null||action.replaceId!==undefined)return fail(state,'unavailable');s.coins+=40;}
      else{if(action.traitId===null||!options.some(id=>id===action.traitId))return fail(state,'unavailable');const error=equip(s,action.traitId,action.replaceId);if(error)return fail(state,error);}
      s.gift='claimed';events.push({type:'Trait',traitId:action.traitId});break;
    }
    case'buy':{
      if(!merchantPresent(s))return fail(state,'no_shop');if(!s.shop.includes(action.traitId)||s.sold.includes(action.traitId))return fail(state,'sold_out');
      const error=equip(s,action.traitId,action.replaceId);if(error)return fail(state,error);
      if(!b)return fail(state,'piece_unavailable');b.status='traded';b.finalizedRound=s.round;s.sold.push(action.traitId);
      events.push({type:'Traded',pieceId:b.id,amount:b.value},{type:'Trait',traitId:action.traitId});break;
    }
    case'upgrade':case'repair':{
      if(!merchantPresent(s))return fail(state,'no_shop');
      if(action.type==='upgrade'?s.upgraded:s.repaired||s.seals===3)return fail(state,'unavailable');
      const cost=action.type==='upgrade'?upgradePrice(s.round):Math.ceil(quotaFor(s.round)/2);if(s.coins<cost)return fail(state,'insufficient_coins');s.coins-=cost;
      if(action.type==='upgrade'){s.base*=2;s.upgraded=true;events.push({type:'Upgraded'});}else{s.seals++;s.repaired=true;events.push({type:'Repaired'});}break;
    }
    case'settle':{
      const preview=settlementPreview(s),summary={round:s.round,quota:quotaFor(s.round),delivered:s.delivered,met:preview.met,recovered:preview.recovered,recoveredIds:preview.remaining.map(p=>p.id),reserveId:s.reserveId,sealsBefore:s.seals,sealsAfter:preview.sealsAfter,protected:preview.protected};
      for(const p of s.blades)if(summary.recoveredIds.includes(p.id)){p.status='recycled';p.finalizedRound=s.round;}
      s.coins+=preview.recovered;s.seals=preview.sealsAfter;if(preview.protected)s.pardonUsed=true;s.history.push(summary);
      s.phase=s.seals===0?'defeat':s.round===s.roundLimit?(s.roundLimit===3?'experienceComplete':'victory'):'summary';events.push({type:'Settled',summary});break;
    }
    case'advance':s.round++;s.phase='workshop';s.delivered=0;supply(s);events.push({type:'Advanced'});break;
  }
  s.revision++;s.journal.push(action);return freezeDeep({ok:true,state:s,events});
}
