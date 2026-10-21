import type {Blade,RunState} from '../core-v4/index.js';
import {RECIPES} from '../core-v4/index.js';
import {forgeAppearance} from './forge.js';
import type {ForgeContactFrame} from './forge.js';

export interface FeedbackRect {readonly left:number;readonly top:number;readonly width:number;readonly height:number}
export type TransferTarget='customer'|'rack'|'shop';
export interface AcceptedTransfer {
 readonly blade:Blade;
 /** Capture before dispatch removes or rearranges the source. Never read inventory again to guess it. */
 readonly source:FeedbackRect|null;
 readonly target:TransferTarget;
 /** Factual receipt supplied by the controller, such as an accepted payment. */
 readonly copy?:string;
}
interface FeedbackHost {reduced():boolean;paintBlade(canvas:HTMLCanvasElement,blade:Blade):void}

/** Disposable presentation only. Accepted state owns every sword, payment and outcome. */
export function createWorkbenchFeedback(root:HTMLElement,host:FeedbackHost){
 const document=root.ownerDocument,window=document.defaultView;
 let disposed=false,generation=0,heldKey='';
 const animations=new Set<Animation>(),transients=new Set<HTMLElement>();
 const obscured=new Map<HTMLElement,string>();
 const figure=root.querySelector<HTMLElement>('#v4-customer-figure');
 const held=document.createElement('span');held.className='v4-customer-held';held.hidden=true;held.setAttribute('role','img');
 figure?.append(held);

 function rect(node:Element|null):FeedbackRect|null{
  if(!node||!node.isConnected||node.closest('[hidden]'))return null;
  const box=node.getBoundingClientRect();
  return box.width>0&&box.height>0&&[box.left,box.top,box.width,box.height].every(Number.isFinite)?box:null;
 }
 function usable(box:FeedbackRect|null):box is FeedbackRect{
  return !!box&&box.width>0&&box.height>0&&[box.left,box.top,box.width,box.height].every(Number.isFinite);
 }
 function remove(node:HTMLElement){node.remove();transients.delete(node);}
 function track(node:HTMLElement){node.setAttribute('aria-hidden','true');node.inert=true;transients.add(node);document.body.append(node);return node;}
 function animate(node:HTMLElement,keyframes:Keyframe[],duration:number,done:()=>void){
  if(disposed||host.reduced()||document.hidden||typeof node.animate!=='function'){done();return;}
  const own=generation;
  try{
   const animation=node.animate(keyframes,{duration,easing:'cubic-bezier(.18,.68,.27,1)',fill:'forwards'});animations.add(animation);
   void animation.finished.then(()=>{animations.delete(animation);if(!disposed&&own===generation)done();},()=>{animations.delete(animation);});
  }catch{done();}
 }
 function paint(canvas:HTMLCanvasElement,blade:Blade){
  try{host.paintBlade(canvas,blade);}catch{/* The accepted receipt and DOM name remain available when a drawing surface fails. */}
 }
 function canvas(blade:Blade){
  const node=document.createElement('canvas');node.className='v4-feedback-blade';node.width=360;node.height=132;node.setAttribute('aria-hidden','true');node.dataset.piece=blade.id;return node;
 }
 function cancel(){
  generation++;
  for(const animation of animations)animation.cancel();animations.clear();
  for(const node of transients)node.remove();transients.clear();
  for(const [node,visibility]of obscured)node.style.visibility=visibility;obscured.clear();
  // Held swords are a current-state projection, never an animation completion side effect.
 }
 function placeHeld(){
  if(held.hidden||!figure)return;const sprite=figure.querySelector('.v4-customer-sprite'),body=rect(sprite),box=rect(figure);if(!body||!box)return;
  // Palm landmarks in the original atlas cells differ between waiting and receiving poses.
  const receiving=figure.dataset.pose==='receiving',customer=figure.dataset.customer;
  const palm=receiving?(customer==='guard'?.60:.64):(customer==='courier'?.77:.75);
  held.style.top=`${body.top+body.height*palm-box.top-12}px`;
 }
 function syncHeld(state:RunState){
  if(disposed||!figure)return;
  const commissionId=state.commissionOrder[state.day-1];
  const blades=state.blades.filter(blade=>blade.status==='commissioned'&&blade.finalizedDay===state.day&&blade.commissionId===commissionId);
  const key=JSON.stringify([state.runId,state.day,commissionId,blades.map(blade=>[blade.id,blade.recipe,blade.level,blade.value,blade.cracked])]);
  if(key!==heldKey){
   heldKey=key;held.replaceChildren(...blades.map(blade=>canvas(blade)));held.hidden=blades.length===0;
   held.dataset.count=String(blades.length);figure.dataset.holding=String(blades.length>0);
   held.setAttribute('aria-label',blades.length?`来客已收${blades.length}柄：${blades.map(blade=>`${RECIPES[blade.recipe].name}，身价${blade.value}`).join('；')}`:'来客尚未收剑');
  }
  for(const [index,node]of [...held.querySelectorAll<HTMLCanvasElement>('canvas')].entries()){
   const blade=blades[index];if(blade)paint(node,blade);
  }
  placeHeld();
 }
 function targetRect(target:TransferTarget){
  if(target==='customer')return rect(held.hidden?figure:held);
  return target==='rack'?rect(root.querySelector('#v4-reserve-slot'))??rect(root.querySelector('#v4-reserve-zone')):rect(root.querySelector('#v4-shop'))??rect(root.querySelector('#v4-coins'));
 }
 function transfer(value:AcceptedTransfer){
  if(disposed||!window||host.reduced()||document.hidden)return;
  const end=targetRect(value.target),start=usable(value.source)?value.source:rect(root.querySelector('#v4-blade'));
  if(!usable(start)||!usable(end))return;
  const node=track(document.createElement('div'));node.className='v4-accepted-transfer';node.dataset.target=value.target;node.dataset.piece=value.blade.id;
  const blade=canvas(value.blade),caption=document.createElement('span');caption.className='v4-transfer-caption';caption.textContent=value.copy??(value.target==='customer'?'好剑，收到了。':value.target==='rack'?'留住这一炉的火。':'一柄剑，换一门手艺。');node.append(blade,caption);
  const width=Math.min(240,Math.max(130,start.width)),height=72;
  node.style.width=`${width}px`;node.style.height=`${height}px`;paint(blade,value.blade);
  const sx=start.left+start.width/2-width/2,sy=start.top+start.height/2-height/2;
  const ex=end.left+end.width/2-width/2,ey=end.top+end.height/2-height/2;
  node.style.left=`${sx}px`;node.style.top=`${sy}px`;
  const receiving=value.target==='customer'?[...held.querySelectorAll<HTMLCanvasElement>('canvas')].find(canvas=>canvas.dataset.piece===value.blade.id):undefined;
  if(receiving){obscured.set(receiving,receiving.style.visibility);receiving.style.visibility='hidden';}
  animate(node,[{opacity:.96,transform:'translate(0,0) rotate(-4deg) scale(1)'},{opacity:1,offset:.68,transform:`translate(${(ex-sx)*.78}px,${(ey-sy)*.78-20}px) rotate(-9deg) scale(.9)`},{opacity:0,transform:`translate(${ex-sx}px,${ey-sy}px) rotate(-13deg) scale(.68)`}],430,()=>{if(receiving&&obscured.has(receiving)){receiving.style.visibility=obscured.get(receiving)!;obscured.delete(receiving);}remove(node);});
 }
 function contact(frame:ForgeContactFrame){
  if(disposed||!window||document.hidden)return;
  if(frame.hit.result==='crack'||frame.hit.result==='broken'){for(const node of [...transients])if(node.classList.contains('v4-growth-reveal'))remove(node);return;}
  const before=forgeAppearance(frame.before),after=forgeAppearance(frame.after);
  if(after.stage<=before.stage)return;
  for(const node of [...transients])if(node.classList.contains('v4-growth-reveal'))remove(node);
  const bladeNode=root.querySelector<HTMLCanvasElement>('#v4-blade'),box=rect(bladeNode);if(!bladeNode||!usable(box))return;
  const node=track(document.createElement('div'));node.className='v4-growth-reveal';node.dataset.piece=frame.pieceId;node.dataset.rank=after.rank;
  node.style.left=`${box.left}px`;node.style.top=`${box.top}px`;node.style.width=`${box.width}px`;node.style.height=`${box.height}px`;
  const label=document.createElement('span');label.className='v4-growth-caption';label.textContent=`${before.rank} → ${after.rank}`;node.append(label);
  // A static result is retained briefly in reduced motion; no sweep, flash or moving weapon.
  if(host.reduced()||typeof node.animate!=='function'){
   node.classList.add('v4-growth-static');
   // The next explicit action calls cancel; no timer is needed to clear this factual short label.
   return;
  }
  const sheen=document.createElement('canvas');sheen.className='v4-growth-sheen';sheen.width=bladeNode.width;sheen.height=bladeNode.height;
  try{sheen.getContext('2d')?.drawImage(bladeNode,0,0);node.prepend(sheen);}catch{/* Keep the actual rank text when the bitmap cannot be copied. */}
  animate(sheen,[{opacity:0,clipPath:'polygon(0 0, 0 0, 0 100%, 0 100%)'},{opacity:.75,offset:.15},{opacity:.75,offset:.72},{opacity:0,clipPath:'polygon(90% 0, 100% 0, 100% 100%, 90% 100%)'}],520,()=>sheen.remove());
  animate(label,[{opacity:0,transform:'translate(-50%,5px)'},{opacity:1,offset:.17,transform:'translate(-50%,0)'},{opacity:1,offset:.72},{opacity:0,transform:'translate(-50%,-7px)'}],1100,()=>remove(node));
 }
 const hidden=()=>{if(document.hidden)cancel();},blur=()=>cancel();
 document.addEventListener('visibilitychange',hidden);window?.addEventListener('blur',blur);window?.addEventListener('resize',placeHeld);
 return{transfer,syncHeld,contact,cancel,dispose(){if(disposed)return;cancel();disposed=true;held.remove();figure?.removeAttribute('data-holding');document.removeEventListener('visibilitychange',hidden);window?.removeEventListener('blur',blur);window?.removeEventListener('resize',placeHeld);}};
}
