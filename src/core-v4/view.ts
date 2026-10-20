import {freezeDeep} from '../core/immutable.js';
import {CHAPTERS,COMMISSIONS,RECIPES,MODIFICATIONS,EVENTS,ENDINGS,TRAITS,RECIPE_IDS,MERCHANTS} from './content.js';
import {assessBlade,atCap,chapterFor,commissionFor,commissionProgress,eventQuote,JOURNAL_SOFT_LIMIT,merchantFor,merchantPresent,recovery,recommendedRecipe,settlementPreview,strikeOdds,supplyBaseFor,unlockedRecipes,percent} from './rules.js';
import type {Recipe,RouteCondition,RunState} from './model.js';
export function describeRoute(r:RouteCondition){
 const words=[r.count>1?`${r.count}柄各自合格`:'一柄',...(r.recipe?[RECIPES[r.recipe].name]:[]),...(r.crack?[r.crack==='intact'?'无裂纹':'带裂纹']:[]),...(r.age?[r.age==='old'?'昨日留剑':'本日新剑']:[]),...(r.maxHits===undefined?[]:[`普通锤≤${r.maxHits}`]),...(r.minLevel===undefined?[]:[`等级≥${r.minLevel}`]),...(r.minBursts===undefined?[]:[`连锻≥${r.minBursts}次`]),`身价≥${r.value}`];return words.join(' · ');
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
 const commission=commissionFor(s),progress=commissionProgress(s),work=s.phase==='workshop',productive=s.journal.length<JOURNAL_SOFT_LIMIT,market=merchantFor(s);
 const next=s.day<12?{day:s.day+1,commission:COMMISSIONS[s.commissionOrder[s.day]!-1]!,normalBase:supplyBaseFor(s,s.day+1,s.pending.supplyPct),merchant:MERCHANTS.some(m=>m.day===s.day+1),reserve:s.reserveId?s.blades.filter(b=>b.id===s.reserveId).map(b=>({id:b.id,value:s.modifications.includes('warmRack')?percent(b.value,115):b.value,cracked:b.cracked,charge:b.charge}))[0]??null:null}:null;
 const nextSupply=next?{...next,inheritanceBonus:Math.min(next.normalBase*4,s.inheritance),firstBase:next.normalBase+Math.min(next.normalBase*4,s.inheritance)}:null;
 const missingCritical=[4,8,12].filter(day=>!s.history.some(h=>h.day===day&&h.met));
 return freezeDeep({
  rulesVersion:s.rulesVersion,revision:s.revision,phase:s.phase,day:s.day,chapter:CHAPTERS[chapterFor(s.day)-1]!,mode:s.mode,coins:s.coins,seals:s.seals,
  commission:{...commission,progress,routes:commission.routes.map(r=>({...r,description:describeRoute(r)})),outcome:progress.complete?commission.success:commission.failure},
  recipes:unlockedRecipes(s).map(id=>({id,...RECIPES[id]})),recommendedRecipe:recommendedRecipe(s),
  blades:s.blades.filter(b=>b.status==='active').map(b=>({blade:b,reserved:b.id===s.reserveId,assessment:assessBlade(s,b),odds:strikeOdds(s,b),recovery:recovery(b),willCommission:!progress.complete&&assessBlade(s,b).qualifies,canStrike:work&&productive&&b.id!==s.reserveId&&!atCap(b),canChangeRecipe:work&&productive&&b.id!==s.reserveId&&b.hits===0})),
  traits:s.traits.map(id=>({id,...TRAITS[id],used:id==='pardon'&&s.pardonUsed})),modifications:s.modifications.map(id=>({id,...MODIFICATIONS[id]})),chapterChoices:s.chapterChoices.map(id=>({id,...MODIFICATIONS[id]})),
  growth:{supplyBase:s.supplyBase,upgradeCount:s.upgradeCount,inheritance:s.inheritance,crackGuard:s.crackGuard,dayBuffs:s.dayBuffs,pending:s.pending},
  event:s.eventId?{id:s.eventId,...EVENTS[s.eventId],status:s.eventStatus,quote:eventQuote(s),canDecline:work&&s.eventStatus==='available'}:null,
  merchant:merchantPresent(s)&&market?{...market,offers:s.shop.map(id=>({id,...TRAITS[id],sold:s.sold.includes(id),owned:s.traits.includes(id)})),canUpgrade:productive&&!s.upgraded&&s.coins>=market.upgrade,canRepair:productive&&!s.repaired&&s.seals<3&&s.coins>=market.repair}:null,
  gift:{status:s.gift,canClaim:work&&productive&&s.gift==='available'},next:nextSupply,settlement:settlementPreview(s),
  canContinue:s.phase==='opening',canSettle:work,canAdvance:s.phase==='summary',
  ending:s.phase==='victory'||s.phase==='return'||s.phase==='defeat'?{...ENDINGS[s.phase],missingCritical,completed:s.history.filter(h=>h.met).length,finalBladeMade:s.history.some(h=>h.day===12&&h.met)}:null,
  history:s.history,eventHistory:s.eventHistory,collection:getCollectionAwards(s),
 });
}
