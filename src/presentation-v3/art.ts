import { packageUrl } from '../security/package-url.mjs';
import {element} from '../presentation/dom.js';
import type {Trait} from '../core-v3/index.js';

export const V3_BLADES=['blade-jian-v2','blade-dao-v2','blade-cleaver-v1'] as const;
export const V3_TRAITS=['steady','ember','inherit','echo','crackedEdge','pardon'] as const;
export function traitArt(id:Trait){
  const node=element('span',undefined,`v3-trait-art trait-${id}`);node.setAttribute('aria-hidden','true');
  const index=V3_TRAITS.indexOf(id);node.style.backgroundPosition=`${index%3*50}% ${Math.floor(index/3)*100}%`;return node;
}
/** Asset callbacks invalidate presentation only; disposal detaches every owned callback. */
export function loadV3Art(ready:()=>void,problem:()=>void){
  let disposed=false;const images=new Map<string,HTMLImageElement>();
  for(const name of [...V3_BLADES,'metal-atlas-v1','customers-atlas-v2','notebook-cover-v1']){
    const image=new Image();images.set(name,image);image.onload=()=>{if(!disposed)ready();};image.onerror=()=>{if(!disposed)problem();};image.src=packageUrl(`/assets/d/${name}.webp`);
  }
  const get=(name:string)=>{const image=images.get(name);return image?.complete&&image.naturalWidth>0?image:undefined;};
  return{texture:()=>get('metal-atlas-v1'),weapon:(family:number)=>get(V3_BLADES[family]??V3_BLADES[0]),customersReady:()=>!!get('customers-atlas-v2'),coverReady:()=>!!get('notebook-cover-v1'),dispose(){disposed=true;for(const image of images.values()){image.onload=null;image.onerror=null;}}};
}
