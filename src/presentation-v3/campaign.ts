import type {Blade,RunState,Trait} from '../core-v3/index.js';
export type ContractLength=3|12;
export const contractName=(length:ContractLength)=>length===12?'十二轮契约':'三轮练手';
export function traitStatus(s:RunState,b:Blade|null,id:Trait):string{
 switch(id){
  case 'pardon':return s.pardonUsed?'本局已使用 · 不会重置':'首次失约时保住印记';
  case 'inherit':return`下轮来料额外 +${Math.min(s.base*4,s.pendingInheritance).toLocaleString('zh-CN')}`;
  case 'ember':return b?.charge===6?'连锻就绪 · 额外一记安全锤':'连锻多一记安全锤';
  case 'steady':return b?.cracked?'此剑已裂 · 再裂仍会断':'首次裂损可保住身价';
  case 'crackedEdge':return b?.cracked?'裂剑生效 · 普通大成+10%':'完好剑暂不生效';
  case 'echo':return b?`普通成功 ${b.successes%3}/3 · 第三次额外+25%`:'选一柄剑查看回响进度';
 }
}
export function campaignTotals(s:RunState){
 return{met:s.history.filter(h=>h.met).length,earned:s.history.reduce((n,h)=>n+h.delivered,0),peak:Math.max(0,...s.blades.map(b=>b.peak)),traded:s.blades.filter(b=>b.status==='traded').length};
}
