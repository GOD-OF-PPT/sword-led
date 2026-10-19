// Offline QA only. A policy receives visible state and its own accepted strike counts.
import {atCap,merchantPresent,quotaFor,upgradePrice,strikeOdds} from '../dist/sword-led-v3.js';

const rank=['ember','echo','steady','pardon','inherit','crackedEdge'];
const base={risk:'balanced',gift:'ember',reserve:true,trade:true,upgrade:true,repair:true,shop:true,traits:true,rank};
export const PROFILES=Object.freeze([
 ...['conservative','balanced','aggressive'].flatMap(risk=>['steady','ember'].map(gift=>({id:`${risk}-${gift}`,...base,risk,gift}))),
 ...[3,6,7,10].map(clicks=>({id:`fixed-${clicks}`,...base,risk:'fixed',clicks})),
 ...['reserve','trade','upgrade','repair','shop','traits'].map(flag=>({id:`without-${flag}`,...base,[flag]:false})),
 ...rank.filter(t=>t!=='ember').map(t=>({id:`prefer-${t}`,...base,rank:[t,...rank.filter(x=>x!==t)]})),
 ...['duplicate','reload'].map(probe=>({id:`balanced-${probe}`,...base,probe})),
 ...['raw','scrap','blind'].map(risk=>({id:risk,...base,risk,shop:false,traits:false,reserve:false})),
].map(p=>Object.freeze({...p,rank:Object.freeze([...p.rank])})));

export function observe(s){
 return Object.freeze({phase:s.phase,round:s.round,quota:quotaFor(s.round),coins:s.coins,seals:s.seals,base:s.base,
  blades:s.blades,reserveId:s.reserveId,delivered:s.delivered,traits:s.traits,gift:s.gift,
  shop:s.shop,sold:s.sold,upgraded:s.upgraded,repaired:s.repaired,pardonUsed:s.pardonUsed});
}
const byValue=(a,b)=>b.value-a.value||a.id.localeCompare(b.id);
export function decide(v,p,clicks){
 if(v.phase==='summary')return{type:'advance'};
 if(v.phase!=='workshop')return null;
 const usable=v.blades.filter(b=>b.status==='active'),active=usable.filter(b=>b.id!==v.reserveId),reserve=usable.find(b=>b.id===v.reserveId);
 if(v.gift==='available'&&p.traits){
  const id=[p.gift,p.gift==='ember'?'steady':'ember'].find(t=>!v.traits.includes(t));
  const worst=[...v.traits].sort((a,b)=>p.rank.indexOf(b)-p.rank.indexOf(a))[0];
  return{type:'claimGift',traitId:id??null,...(id&&v.traits.length===3?{replaceId:worst}:{})};
 }
 if(p.shop&&merchantPresent(v)){
  if(p.traits&&p.trade&&!v.sold.length&&active.length){
   const traitId=[...v.shop].filter(t=>!v.traits.includes(t)).sort((a,b)=>p.rank.indexOf(a)-p.rank.indexOf(b))[0];
   const worst=[...v.traits].sort((a,b)=>p.rank.indexOf(b)-p.rank.indexOf(a))[0];
   if(traitId&&(v.traits.length<3||p.rank.indexOf(traitId)<p.rank.indexOf(worst))){
    const cheapest=[...active].sort((a,b)=>a.value-b.value||a.id.localeCompare(b.id))[0];
    return{type:'buy',pieceId:cheapest.id,traitId,...(v.traits.length===3?{replaceId:worst}:{})};
   }
  }
  if(p.upgrade&&!v.upgraded&&v.coins>=upgradePrice(v.round))return{type:'upgrade'};
  if(p.repair&&!v.repaired&&v.seals<3&&v.coins>=Math.ceil(v.quota/2))return{type:'repair'};
 }
 if(p.risk==='raw'||p.risk==='scrap')return active[0]?{type:p.risk==='raw'?'deliver':'scrap',pieceId:active[0].id}:{type:'settle'};
 const best=[...active].sort(byValue)[0];
 if(p.risk==='blind')return best?{type:atCap(best)?'deliver':'strike',pieceId:best.id}:{type:'settle'};
 if(v.delivered>=v.quota){
  if(p.reserve&&best){
   if(!best.cracked&&best.hits<3)return{type:'strike',pieceId:best.id};
   if(best.value>(reserve?.value??0))return{type:'reserve',pieceId:best.id};
  }
  return{type:'settle'};
 }
 if(!best)return reserve?{type:'reserve',pieceId:reserve.id}:{type:'settle'};
 let stop=atCap(best);
 if(p.risk==='fixed')stop ||= (clicks.get(best.id)??0)>=p.clicks;
 else{
  stop ||= best.value>=v.quota-v.delivered;
  const odds=strikeOdds(v,best);
  if(!odds.burst){
   if(p.risk==='conservative')stop ||= best.cracked||odds.crack>=120;
   if(p.risk==='balanced')stop ||= best.cracked||odds.crack>=300;
   if(p.risk==='aggressive')stop ||= odds.crack>=500;
  }
 }
 return{type:stop?'deliver':'strike',pieceId:best.id};
}
