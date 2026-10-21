import {freezeDeep} from '../core/immutable.js';
import {CHAPTERS,COMMISSIONS,RECIPES,MODIFICATIONS,EVENTS,ENDINGS,TRAITS,RECIPE_IDS,MERCHANTS} from './content.js';
import {assessBlade,atCap,barterAssessment,chapterFor,commissionFor,commissionProgress,cumulativeBaseFee,deliveryQuote,eventQuote,JOURNAL_SOFT_LIMIT,marketFor,marketRemaining,merchantFor,merchantPresent,recoveryQuote,recommendedRecipe,routeAssessment,settlementPreview,strikeOdds,supplyBaseFor,unlockedRecipes,percent} from './rules.js';
import type {Commission,Recipe,RouteCondition,RunState} from './model.js';

const describeCommission=(commission:Commission)=>({...commission,request:commission.request.replaceAll('昨日','此前')});

export function describeRoute(r:RouteCondition){
 const words=[r.count>1?`${r.count}柄各自合格`:'一柄',...(r.recipe?[RECIPES[r.recipe].name]:[]),...(r.crack?[r.crack==='intact'?'无裂纹':'带裂纹']:[]),...(r.age?[r.age==='old'?'此前留剑':'本日新剑']:[]),...(r.maxHits===undefined?[]:[`普通锤≤${r.maxHits}`]),...(r.minLevel===undefined?[]:[`等级≥${r.minLevel}`]),...(r.minBursts===undefined?[]:[`连锻≥${r.minBursts}次`]),`身价≥${r.value}`];return words.join(' · ');
}
export function getCollectionAwards(s:RunState){
 const chapters=s.history.filter(h=>[4,8,12].includes(h.day)&&h.sealsAfter>0).map(h=>chapterFor(h.day));
 const recipes:Recipe[]=['light'];if(chapters.includes(1))recipes.push('guard');if(chapters.includes(2))recipes.push('heavy');
 const works=s.history.filter(h=>h.met).map(h=>({commissionId:h.commissionId,day:h.day,routeId:h.routeId!,blades:h.pieceIds.map(id=>s.blades.find(b=>b.id===id)!),runId:s.runId}));
 const mastery=RECIPE_IDS.filter(recipe=>works.some(w=>w.blades.some(b=>b.recipe===recipe&&b.level>=9)));
 const traits=[...new Set(s.journal.flatMap(a=>(a.type==='buy'||a.type==='claimGift')&&a.traitId?[a.traitId]:[]))];
 return freezeDeep({chapters,recipes,challenge:s.phase==='victory',mastery,traits,works});
}
export function getRunView(s:RunState){
 const commission=describeCommission(commissionFor(s)),progress=commissionProgress(s),work=s.phase==='workshop',productive=s.journal.length<JOURNAL_SOFT_LIMIT,merchant=merchantFor(s),market=marketFor(s);
 const reserved=s.blades.find(b=>b.id===s.reserveId&&b.status==='active');
 const nextCommission=s.day<12?describeCommission(COMMISSIONS[s.commissionOrder[s.day]!-1]!):null;
 const reserve=reserved&&nextCommission?(()=>{
  const value=s.modifications.includes('warmRack')?percent(reserved.value,115):reserved.value;
  const blade={...reserved,value,peak:Math.max(reserved.peak,value)};
  const routes=nextCommission.routes.map(r=>({id:r.id,...routeAssessment({day:s.day+1},blade,r)}));
  return{...blade,recipeName:RECIPES[blade.recipe].name,assessment:{qualifies:routes.some(r=>r.matches),routes}};
 })():null;
 const next=nextCommission?{day:s.day+1,commission:nextCommission,normalBase:supplyBaseFor(s,s.day+1,s.pending.supplyPct),merchant:MERCHANTS.some(m=>m.day===s.day+1),reserve,newCount:reserve?2:3,oldCount:reserve?1:0,totalCount:3}:null;
 const nextSupply=next?{...next,inheritanceBonus:Math.min(next.normalBase*4,s.inheritance),firstBase:next.normalBase+Math.min(next.normalBase*4,s.inheritance)}:null;
 const missingCritical=[4,8,12].filter(day=>!s.history.some(h=>h.day===day&&h.met));
 const event=s.eventId?{id:s.eventId,...EVENTS[s.eventId],status:s.eventStatus,quote:eventQuote(s),canDecline:work&&s.eventStatus==='available'}:null;
 return freezeDeep({
  rulesVersion:s.rulesVersion,revision:s.revision,phase:s.phase,day:s.day,chapter:CHAPTERS[chapterFor(s.day)-1]!,mode:s.mode,coins:s.coins,seals:s.seals,
  commission:{...commission,progress,routes:commission.routes.map(r=>({...r,description:describeRoute(r)})),outcome:progress.complete?commission.success:commission.failure},
  market:{...market,spent:s.marketSpent,remaining:marketRemaining(s),baseFeesPaid:cumulativeBaseFee(progress,market.baseFee)},
  recipes:unlockedRecipes(s).map(id=>({id,...RECIPES[id]})),recommendedRecipe:recommendedRecipe(s),
  blades:s.blades.filter(b=>b.status==='active').map(b=>{
   const quote=deliveryQuote(s,b),assessment=assessBlade(s,b);
   return{blade:b,reserved:b.id===s.reserveId,assessment:{...assessment,canDeliver:quote.allowed},quote,odds:strikeOdds(s,b),recovery:recoveryQuote(s,b),barter:barterAssessment(s,b),willCommission:quote.matched,canStrike:work&&productive&&b.id!==s.reserveId&&!atCap(b),canChangeRecipe:work&&productive&&b.id!==s.reserveId&&b.hits===0};
  }),
  traits:s.traits.map(id=>({id,...TRAITS[id],used:id==='pardon'&&s.pardonUsed})),modifications:s.modifications.map(id=>({id,...MODIFICATIONS[id]})),chapterChoices:s.chapterChoices.map(id=>({id,...MODIFICATIONS[id]})),
  growth:{supplyBase:s.supplyBase,upgradeCount:s.upgradeCount,inheritance:s.inheritance,crackGuard:s.crackGuard,dayBuffs:s.dayBuffs,pending:s.pending},
  event:event&&event.id==='donation'?{...event,result:'明天实际发出的新坯底价增加20%：留剑时两柄，否则三柄。'}:event,
  merchant:merchantPresent(s)&&merchant?{...merchant,offers:s.shop.map(id=>({id,...TRAITS[id],sold:s.sold.includes(id),owned:s.traits.includes(id)})),canUpgrade:productive&&!s.upgraded&&s.coins>=merchant.upgrade,canRepair:productive&&!s.repaired&&s.seals<3&&s.coins>=merchant.repair}:null,
  gift:{status:s.gift,canClaim:work&&productive&&s.gift==='available'},next:nextSupply,settlement:settlementPreview(s),
  canContinue:s.phase==='opening',canSettle:work,canAdvance:s.phase==='summary',
  ending:s.phase==='victory'||s.phase==='return'||s.phase==='defeat'?{...ENDINGS[s.phase],missingCritical,completed:s.history.filter(h=>h.met).length,finalBladeMade:s.history.some(h=>h.day===12&&h.met)}:null,
  history:s.history,eventHistory:s.eventHistory,collection:getCollectionAwards(s),
 });
}
