export type HandoffTarget='customer'|'rack';
export interface HandoffToken {
 readonly runId:string;
 readonly revision:number;
 readonly generation:number;
 readonly epoch:number;
 readonly pieceId:string;
}
export interface HandoffPreview {readonly allowed:boolean;readonly label:string}
export interface HandoffOrigin {readonly left:number;readonly top:number;readonly width:number;readonly height:number}
export interface HandoffHost {
 /** Capture a readable identity only; beginning a gesture never changes the game. */
 capture(pieceId:string):HandoffToken|null;
 preview(token:HandoffToken,target:HandoffTarget):HandoffPreview;
 /** A drop intent, including a blocked target. Revalidate before any action or confirmation. */
 commit(token:HandoffToken,target:HandoffTarget,origin?:HandoffOrigin):void;
}
interface Gesture {
 readonly pointerId:number;
 readonly startX:number;
 readonly startY:number;
 readonly source:HTMLButtonElement;
 readonly token:HandoffToken;
 dragging:boolean;
}

/** Inventory-only handoff. The forge surface keeps its independent immediate left-click input. */
export function createHandoff(root:HTMLElement,host:HandoffHost){
 const document=root.ownerDocument,view=document.defaultView;
 if(!view)return{cancel(){},isDragging(){return false;},dispose(){}};
 const window:Window=view;
 let disposed=false,gesture:Gesture|null=null,ghost:HTMLDivElement|null=null,label:HTMLSpanElement|null=null;
 let suppressed:{pointerId:number;until:number}|null=null;
 const marked=new Set<HTMLElement>();
 const targetName=(element:HTMLElement):HandoffTarget|null=>element.dataset.handoffTarget==='customer'?'customer':element.dataset.handoffTarget==='rack'?'rack':null;

 function clearMarks(){for(const node of marked)node.removeAttribute('data-handoff-state');marked.clear();}
 function suppressClick(pointerId:number){suppressed={pointerId,until:window.performance.now()+800};}
 function detachGesture(){
  window.removeEventListener('pointermove',move,true);window.removeEventListener('pointerup',up,true);window.removeEventListener('pointercancel',cancelPointer,true);
  window.removeEventListener('keydown',key,true);window.removeEventListener('blur',cancel);document.removeEventListener('visibilitychange',hidden);root.removeEventListener('lostpointercapture',lostCapture,true);
 }
 function clearGesture(){
  const current=gesture;gesture=null;detachGesture();clearMarks();ghost?.remove();ghost=null;label=null;root.classList.remove('v4-handoff-dragging');
  if(current?.dragging){try{if(root.hasPointerCapture(current.pointerId))root.releasePointerCapture(current.pointerId);}catch{/* The pointer or root may already have left this document. */}}
 }
 function cancel(){
  if(gesture?.dragging)suppressClick(gesture.pointerId);
  clearGesture();
  // A just-completed drag's click stays suppressed even if the host cancels presentation while committing it.
  // No timer or per-gesture listener remains; a fresh pointer-down clears this one-shot flag.
 }
 function copyGhost(source:HTMLButtonElement){
  const container=document.createElement('div'),copy=source.cloneNode(true) as HTMLButtonElement;
  container.className='v4-handoff-ghost';container.setAttribute('aria-hidden','true');container.inert=true;
  container.style.position='fixed';container.style.left='0';container.style.top='0';container.style.pointerEvents='none';
  copy.classList.add('v4-handoff-source');copy.tabIndex=-1;copy.removeAttribute('id');
  for(const child of copy.querySelectorAll<HTMLElement>('[id]'))child.removeAttribute('id');
  const originals=source.querySelectorAll('canvas'),canvases=copy.querySelectorAll('canvas');
  for(let i=0;i<originals.length;i++){
   const from=originals[i]!,to=canvases[i];if(!to)continue;
   to.width=from.width;to.height=from.height;
   try{if(from.width&&from.height)to.getContext('2d')?.drawImage(from,0,0);}catch{to.remove();/* Keep the actual card text when its bitmap is unavailable. */}
  }
  label=document.createElement('span');label.className='v4-handoff-label';container.append(copy,label);document.body.append(container);return container;
 }
 function position(x:number,y:number){
  if(!ghost)return;const box=ghost.getBoundingClientRect();
  const left=Math.max(8,Math.min(x+16,window.innerWidth-box.width-8)),top=Math.max(8,Math.min(y+14,window.innerHeight-box.height-8));
  ghost.style.transform=`translate3d(${left}px,${top}px,0)`;
 }
 function preview(x:number,y:number):HandoffTarget|null{
  const current=gesture;if(!current?.dragging)return null;
  clearMarks();const previews=new Map<HandoffTarget,HandoffPreview>();
  for(const node of root.querySelectorAll<HTMLElement>('[data-handoff-target]')){
   const target=targetName(node);if(!target)continue;
   let value=previews.get(target);if(!value){value=host.preview(current.token,target);previews.set(target,value);}
   if(gesture!==current)return null;
   node.dataset.handoffState=value.allowed?'allowed':'blocked';marked.add(node);
  }
  const node=document.elementFromPoint(x,y)?.closest<HTMLElement>('[data-handoff-target]'),target=node&&root.contains(node)?targetName(node):null;
  if(label)label.textContent=target?(previews.get(target)??host.preview(current.token,target)).label:'拖向来客，或留在剑架';
  return target;
 }
 function move(event:PointerEvent){
  const current=gesture;if(!current||event.pointerId!==current.pointerId)return;
  if(!root.isConnected){cancel();return;}
  if(!current.dragging){
   if(Math.hypot(event.clientX-current.startX,event.clientY-current.startY)<=7)return;
   current.dragging=true;root.classList.add('v4-handoff-dragging');ghost=copyGhost(current.source);
   try{root.setPointerCapture(current.pointerId);}catch{/* Window delegation still owns cancellation and release. */}
  }
  event.preventDefault();event.stopPropagation();
  try{preview(event.clientX,event.clientY);position(event.clientX,event.clientY);}catch(error){cancel();throw error;}
 }
 function up(event:PointerEvent){
  const current=gesture;if(!current||event.pointerId!==current.pointerId||event.button!==0)return;
  if(!current.dragging){clearGesture();return;}
  event.preventDefault();event.stopPropagation();
  let target:HandoffTarget|null=null,origin:HandoffOrigin|undefined;
  try{if(root.isConnected){target=preview(event.clientX,event.clientY);const box=ghost?.getBoundingClientRect();if(box)origin={left:box.left,top:box.top,width:box.width,height:box.height};}}finally{clearGesture();}
  try{if(target&&!disposed)host.commit(current.token,target,origin);}finally{if(!disposed)suppressClick(current.pointerId);}
 }
 function cancelPointer(event:PointerEvent){if(gesture?.pointerId===event.pointerId)cancel();}
 function lostCapture(event:PointerEvent){if(gesture?.dragging&&gesture.pointerId===event.pointerId)cancel();}
 function key(event:KeyboardEvent){if(event.key==='Escape'&&gesture){event.preventDefault();event.stopPropagation();cancel();}}
 function hidden(){if(document.hidden)cancel();}
 function resetSuppression(){suppressed=null;}
 function click(event:MouseEvent){
  if(!suppressed)return;
  if(window.performance.now()>suppressed.until){suppressed=null;return;}
  const pointerId='pointerId'in event?event.pointerId:null;
  if(event.button!==0||event.detail===0||pointerId!==null&&pointerId!==suppressed.pointerId)return;
  suppressed=null;event.preventDefault();event.stopImmediatePropagation();
 }
 function down(event:PointerEvent){
  if(disposed||event.button!==0||!event.isPrimary||event.pointerType==='touch'||event.ctrlKey||event.metaKey||event.altKey)return;
  const source=event.target instanceof Element?event.target.closest<HTMLButtonElement>('#v4-inventory button[data-piece]'):null;
  if(!source||!root.contains(source)||source.disabled)return;
  const pieceId=source.dataset.piece;if(!pieceId)return;
  const captured=host.capture(pieceId);if(!captured||captured.pieceId!==pieceId)return;
  cancel();suppressed=null;
  const token:HandoffToken=Object.freeze({runId:captured.runId,revision:captured.revision,generation:captured.generation,epoch:captured.epoch,pieceId:captured.pieceId});
  gesture={pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,source,token,dragging:false};
  window.addEventListener('pointermove',move,{capture:true,passive:false});window.addEventListener('pointerup',up,{capture:true,passive:false});window.addEventListener('pointercancel',cancelPointer,true);
  window.addEventListener('keydown',key,true);window.addEventListener('blur',cancel);document.addEventListener('visibilitychange',hidden);root.addEventListener('lostpointercapture',lostCapture,true);
 }
 function nativeDrag(event:DragEvent){if(gesture)event.preventDefault();}
 root.addEventListener('pointerdown',down);root.addEventListener('dragstart',nativeDrag,true);window.addEventListener('pointerdown',resetSuppression,true);window.addEventListener('click',click,true);
 return{cancel,isDragging:()=>gesture?.dragging===true,dispose(){if(disposed)return;disposed=true;clearGesture();suppressed=null;root.removeEventListener('pointerdown',down);root.removeEventListener('dragstart',nativeDrag,true);window.removeEventListener('pointerdown',resetSuppression,true);window.removeEventListener('click',click,true);}};
}
