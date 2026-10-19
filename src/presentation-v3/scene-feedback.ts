import type {Blade,DomainEvent,RunState} from '../core-v3/index.js';
import {quotaFor,TRAITS} from '../core-v3/index.js';
import {element} from '../presentation/dom.js';

interface Host {reduced():boolean;draw(canvas:HTMLCanvasElement,blade:Blade):void}
/** Cosmetic only. Every node and callback is owned, bounded and explicitly cancellable. */
export function createSceneFeedback(root:HTMLElement,layer:HTMLElement,host:Host){
 const owned=new Map<HTMLElement,{animation:Animation|null;timer:ReturnType<typeof setTimeout>|null}>();
 function remove(node:HTMLElement){const entry=owned.get(node);if(!entry)return;owned.delete(node);if(entry.timer!==null)clearTimeout(entry.timer);entry.animation?.cancel();node.remove();}
 function reset(){for(const node of [...owned.keys()])remove(node);}
 function show(node:HTMLElement,frames:Keyframe[],duration:number){
  if(document.hidden)return;while(owned.size>=8)remove(owned.keys().next().value!);layer.append(node);const entry={animation:null as Animation|null,timer:null as ReturnType<typeof setTimeout>|null};owned.set(node,entry);
  if(host.reduced()){entry.timer=setTimeout(()=>remove(node),900);return;}
  entry.animation=node.animate(frames,{duration,easing:'cubic-bezier(.2,.65,.25,1)',fill:'both'});void entry.animation.finished.catch(()=>{}).finally(()=>remove(node));
 }
 function banner(kind:string,title:string,copy:string){const node=element('div',undefined,'v3-scene-banner');node.dataset.sceneCue=kind;node.append(element('b',title),element('small',copy));show(node,[{opacity:0,transform:'translate(-50%,-16px) scale(.96)'},{opacity:1,transform:'translate(-50%,0) scale(1)',offset:.14},{opacity:1,offset:.76},{opacity:0,transform:'translate(-50%,-8px)'}],1700);}
 function fly(kind:string,b:Blade,targetId:string){
  if(host.reduced())return;
  const from=root.querySelector('#v3-blade')?.getBoundingClientRect(),to=root.querySelector('#'+targetId)?.getBoundingClientRect();if(!from||!to||!from.width||!to.width)return;
  const node=element('div',undefined,'v3-flying-blade'),canvas=element('canvas');node.dataset.sceneCue=kind;node.append(canvas);node.style.left=`${from.x+from.width*.5}px`;node.style.top=`${from.y+from.height*.6}px`;node.style.setProperty('--flight-x',`${to.x+to.width*.5-from.x-from.width*.5}px`);node.style.setProperty('--flight-y',`${to.y+to.height*.5-from.y-from.height*.6}px`);
  show(node,[{opacity:.95,transform:'translate(-50%,-50%) scale(1)'},{opacity:1,offset:.22,transform:'translate(-50%,-70%) scale(1.06)'},{opacity:0,transform:'translate(calc(-50% + var(--flight-x)),calc(-50% + var(--flight-y))) scale(.28)'}],620);host.draw(canvas,b);
 }
 function pulse(id:string){const node=root.querySelector<HTMLElement>('#'+id);if(!node||host.reduced()||document.hidden)return;const ring=element('div',undefined,'v3-target-halo'),box=node.getBoundingClientRect();ring.style.left=`${box.x}px`;ring.style.top=`${box.y}px`;ring.style.width=`${box.width}px`;ring.style.height=`${box.height}px`;show(ring,[{opacity:1,transform:'scale(.97)'},{opacity:0,transform:'scale(1.08)'}],700);}
 return{reset,play(events:readonly DomainEvent[],s:RunState){
  if(document.hidden)return;
  for(const event of events){
   if(event.type==='Delivered'){const b=s.blades.find(b=>b.id===event.pieceId);if(b)fly('delivery',b,'v3-order-paper');pulse('v3-wallet');const met=s.delivered>=quotaFor(s.round)&&s.delivered-event.amount<quotaFor(s.round);banner(met?'met':'delivery',met?'委托达成！':`交差 +${event.amount.toLocaleString('zh-CN')}`,met?'印记保住了 · 余剑可以留一手':'身价已变成金币，也计入今天的目标');if(met)pulse('v3-order-paper');}
   else if(event.type==='Reserved'){const b=s.blades.find(b=>b.id===event.pieceId);if(b&&s.reserveId===b.id){fly('reserve',b,'v3-reserve-slot');banner('reserve','好剑归架','身价、裂纹和锤势原样保留');}else banner('retrieve','留剑重上铁砧','原来的风险仍在，取下不会重置');}
   else if(event.type==='Traded'){const b=s.blades.find(b=>b.id===event.pieceId);if(b)fly('trade',b,'v3-traits');}
   else if(event.type==='Trait'){banner('trait',event.traitId?`${TRAITS[event.traitId].name} · 已入袋`:'补给已收下',event.traitId?TRAITS[event.traitId].text:'两门赠品都已持有，金币已到账');pulse('v3-traits');}
   else if(event.type==='Upgraded')banner('upgrade','炉火升阶',`下一轮来料底价 ${s.base.toLocaleString('zh-CN')} · 当前剑不变`);
   else if(event.type==='Repaired')banner('repair','契约印记 · 已修补',`现在保有 ${s.seals} 枚印记`);
   else if(event.type==='Advanced'){banner('round',`第 ${s.round} 轮 · 新铁入炉`,[3,6,9].includes(s.round)?'行脚商人到场了 · 留意剑与手艺的取舍':`三柄新配给 · 今日交差目标 ${quotaFor(s.round).toLocaleString('zh-CN')}`);}
  }
 }};
}
