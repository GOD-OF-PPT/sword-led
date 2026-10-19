import type {Blade,RunState,Trait} from './model.js';
export const TRAITS:Readonly<Record<Trait,{readonly name:string;readonly text:string}>>=Object.freeze({
  steady:{name:'稳手护符',text:'首次裂损保住身价，剑仍会留下裂纹。'},ember:{name:'炉心余烬',text:'连锻多一记安全锤。'},
  inherit:{name:'余温铁夹',text:'碎剑峰值的20%传给下轮第一柄，最多增加普通底价的4倍。'},
  echo:{name:'回响锤纹',text:'每第三次普通成功，身价额外增长25%。'},crackedEdge:{name:'裂锋印',text:'裂纹剑的大成率增加10个百分点，裂损率不变。'},
  pardon:{name:'护炉契',text:'本局首次失约免扣印记；卸下再装备也不会恢复次数。'},
});
export const TRAIT_IDS=Object.keys(TRAITS) as Trait[];
export const QUOTAS=[180,300,520,850,1400,2300,3800,6200,10000,16000,26000,42000] as const;
export const VALUE_CAP=1_000_000_000;
export const quotaFor=(round:number)=>QUOTAS[round-1]??QUOTAS[11];
export const recovery=(blade:Blade)=>Math.floor(blade.base/4);
export const atCap=(blade:Blade)=>blade.value>=VALUE_CAP||blade.level>=99;
export const merchantPresent=(state:RunState)=>state.phase==='workshop'&&[3,6,9].includes(state.round);
export const upgradePrice=(round:number)=>round===3?180:round===6?900:4500;
export function strikeOdds(state:RunState,blade:Blade){
  const crack=[0,0,0,50,80,120,180,240,300,360,420,480,500][Math.min(12,blade.hits)]??500;
  const burst=blade.charge===6;
  const great=burst?350:150+(blade.cracked&&state.traits.includes('crackedEdge')?100:0);
  return{burst,crack:burst?0:crack,great,success:1000-great-(burst?0:crack),afterBurstCrack:crack};
}
export function settlementPreview(state:RunState){
  const remaining=state.blades.filter(b=>b.status==='active'&&b.id!==state.reserveId);
  const met=state.delivered>=quotaFor(state.round),protectedMiss=!met&&state.traits.includes('pardon')&&!state.pardonUsed;
  return{remaining,recovered:remaining.reduce((n,b)=>n+recovery(b),0),met,protected:protectedMiss,sealsAfter:state.seals-(met||protectedMiss?0:1)};
}
