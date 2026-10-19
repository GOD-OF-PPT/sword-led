import type {Blade} from '../core-v3/index.js';

/** A read-only projection: supplied piece identity and real level, never an RNG draw. */
export function bladeAppearance(blade:Blade){
  const family=Math.max(0,Math.min(2,Number(blade.id.split('-').at(-1))-1));
  const safeFamily=Number.isInteger(family)?family:0;
  const stage=blade.level>=9?4:blade.level>=6?3:blade.level>=3?2:blade.level>=1?1:0;
  return{family:safeFamily,stage,name:['青云剑','赤羽刀','镇岳重剑'][safeFamily]!,rank:['乌铁坯','初开锋','叠纹','流火','灯炉名器'][stage]!};
}
