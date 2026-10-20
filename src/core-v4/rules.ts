import {CHAPTERS,COMMISSIONS,RECIPES,MERCHANTS,EVENTS} from './content.js';
import type {Blade,Recipe,RouteCondition,RunState,ErrorCode} from './model.js';
export const VALUE_CAP=1_000_000_000;
export const LEVEL_CAP=99;
export const JOURNAL_SOFT_LIMIT=1900;
export const JOURNAL_LIMIT=2048;
export const chapterFor=(day:number)=>day<=4?1:day<=8?2:3;
export const recovery=(b:Blade)=>Math.floor(b.base/4);
export const atCap=(b:Blade)=>b.value>=VALUE_CAP||b.level>=LEVEL_CAP;
export const percent=(value:number,rate:number)=>Math.min(VALUE_CAP,Math.floor(value*rate/100));
export function supplyBaseFor(s:RunState,day:number,pct:number){return Math.floor(CHAPTERS[chapterFor(day)-1]!.base*3**s.upgradeCount/2**s.upgradeCount*pct/100);}
export function commissionFor(s:RunState){return COMMISSIONS[s.commissionOrder[s.day-1]!-1]!;}
export function unlockedRecipes(s:RunState):readonly Recipe[]{
 const set=new Set<Recipe>(s.initialEligibility.recipes);
 if(s.history.some(h=>h.day===4&&h.sealsAfter>0))set.add('guard');
 if(s.history.some(h=>h.day===8&&h.sealsAfter>0))set.add('heavy');
 for(const route of commissionFor(s).routes)if(route.recipe)set.add(route.recipe);
 return (['light','guard','heavy']as const).filter(r=>set.has(r));
}
export function recommendedRecipe(s:RunState):Recipe{
 const needed=commissionFor(s).routes.find(r=>r.recipe)?.recipe;if(needed)return needed;
 return unlockedRecipes(s).includes('guard')?'guard':'light';
}
export function strikeOdds(s:RunState,b:Blade){
 const r=RECIPES[b.recipe],sheltered=s.dayBuffs.shelter&&b.suppliedDay===s.day&&b.slot===1;
 const normalCrack=Math.max(0,(b.hits<3?0:r.cracks[Math.min(b.hits-3,8)]!)-(sheltered?30:0));
 const burst=b.charge===6,great=burst?350:r.greatOdds+(b.cracked&&s.traits.includes('crackedEdge')?100:0);
 return{burst,crack:burst?0:normalCrack,great,success:1000-great-(burst?0:normalCrack),afterBurstCrack:normalCrack};
}
export function routeAssessment(s:RunState,b:Blade,r:RouteCondition){
 const missing:string[]=[];
 if(r.recipe&&b.recipe!==r.recipe)missing.push(`需要${RECIPES[r.recipe].name}`);
 if(r.crack==='intact'&&b.cracked)missing.push('需要无裂纹');
 if(r.crack==='cracked'&&!b.cracked)missing.push('需要带裂纹');
 if(r.age==='old'&&b.suppliedDay>=s.day)missing.push('需要昨日留下的旧剑');
 if(r.age==='new'&&b.suppliedDay!==s.day)missing.push('需要本日新剑');
 if(r.maxHits!==undefined&&b.hits>r.maxHits)missing.push(`普通锤不得超过${r.maxHits}次`);
 if(r.minLevel!==undefined&&b.level<r.minLevel)missing.push(`需要等级${r.minLevel}`);
 if(r.minBursts!==undefined&&b.bursts<r.minBursts)missing.push(`需要${r.minBursts}次连锻`);
 if(b.value<r.value)missing.push(`还差${r.value-b.value}身价`);
 return{matches:missing.length===0,missing};
}
export function commissionProgress(s:RunState){
 const commission=commissionFor(s),pieces=s.blades.filter(b=>b.status==='commissioned'&&b.commissionId===commission.id&&b.finalizedDay===s.day);
 const order=new Map(s.journal.flatMap((a,i)=>a.type==='deliver'?[[a.pieceId,i]as const]:[]));pieces.sort((a,b)=>(order.get(a.id)??Number.MAX_SAFE_INTEGER)-(order.get(b.id)??Number.MAX_SAFE_INTEGER));
 const routes=commission.routes.map(r=>{const ids=pieces.filter(b=>routeAssessment(s,b,r).matches).map(b=>b.id);return{id:r.id,required:r.count,count:ids.length,pieceIds:ids,complete:ids.length>=r.count};});
 const winning=routes.find(r=>r.complete);
 return{commissionId:commission.id,complete:!!winning,routeId:winning?.id??null,pieceIds:winning?.pieceIds.slice(0,winning.required)??[],routes};
}
export function assessBlade(s:RunState,b:Blade){
 const routes=commissionFor(s).routes.map(r=>({id:r.id,...routeAssessment(s,b,r)}));
 return{canDeliver:s.phase==='workshop'&&b.status==='active'&&b.id!==s.reserveId,qualifies:routes.some(r=>r.matches),routes};
}
export function settlementPreview(s:RunState){
 const remaining=s.blades.filter(b=>b.status==='active'&&b.id!==s.reserveId),progress=commissionProgress(s);
 const protectedMiss=!progress.complete&&s.traits.includes('pardon')&&!s.pardonUsed;
 return{...progress,remaining,recovered:remaining.reduce((n,b)=>n+recovery(b),0),protected:protectedMiss,sealsAfter:s.seals-(progress.complete||protectedMiss?0:1)};
}
export const merchantFor=(s:RunState)=>MERCHANTS.find(m=>m.day===s.day)??null;
export const merchantPresent=(s:RunState)=>s.phase==='workshop'&&merchantFor(s)!==null;
export function eventQuote(s:RunState,pieceId?:string){
 const event=s.eventId?EVENTS[s.eventId]:null,cost=event?.cost[chapterFor(s.day)-1]??0;
 let error:ErrorCode|null=null;
 if(s.phase!=='workshop'||s.eventStatus!=='available'||!event)error='unavailable';
 else if(s.coins<cost)error='insufficient_coins';
 else if(s.eventId==='credit'&&s.crackGuard)error='already_owned';
 else if(event.piece!=='none'){
  const b=s.blades.find(b=>b.id===pieceId);
  if(!b||b.status!=='active'||(event.piece==='reserve'?s.reserveId!==b.id:s.reserveId===b.id))error='piece_unavailable';
 }else if(pieceId!==undefined)error='invalid_command';
 return{eventId:s.eventId,cost,requiresPiece:event?.piece??'none',allowed:error===null,error};
}
