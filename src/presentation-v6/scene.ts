import type {Blade,DomainEvent,RunView} from '../core-v6/index.js';
import type {StrikePoint} from '../platform/direct-strike-input.js';
import {createHammerMotion} from '../presentation-v3/hammer.js';
import {SWORD_ART} from './sword-art.js';

export interface ExpeditionSceneHost {
 reduced():boolean;
 /** Internal geometry/lifecycle cancellation, never a delayed contact. */
 cancelled?():void;
}
export interface ExpeditionScene {
 render(view:RunView):void;
 play(events:readonly DomainEvent[],before:RunView,after:RunView,callbacks:{contact():void;done():void}):void;
 aim(point:StrikePoint|null):void;
 preparing(value:boolean):void;
 cancel():void;
 dispose():void;
}
type ForgeEvent=Extract<DomainEvent,{type:'Forged'}>;
type ActionMotion='forge'|'guard'|'strike'|'cache'|'followUp'|'change';
interface SwordGhost {readonly node:HTMLCanvasElement;readonly rect:DOMRect;readonly pivot:{x:number;y:number};readonly metal:{x:number;y:number}}
interface PropMotion {
 readonly target:HTMLElement|null;readonly targetRect:DOMRect|null;readonly escort:HTMLElement|null;
 readonly escortRect:DOMRect|null;readonly rope:HTMLElement|null;readonly latch:HTMLElement|null;
 readonly tool:HTMLElement|null;readonly toolRect:DOMRect|null;readonly sword:SwordGhost|null;
 readonly toolOrigin:DOMRect|null;
}
interface Playing {
 readonly token:number;readonly before:RunView;readonly after:RunView;readonly event:ForgeEvent|null;
 readonly callbacks:{contact():void;done():void};readonly afterBlade:Blade|null;
 readonly point:{readonly x:number;readonly y:number};
 readonly events:readonly DomainEvent[];readonly mode:ActionMotion;readonly startedAt:number;
 readonly contactAt:number;readonly duration:number;
 props:PropMotion|null;
 contacted:boolean;contactedAt:number|null;contactFrames:number;rebounded:boolean;contactPose:string|null;
}
interface Geometry {readonly width:number;readonly height:number;readonly ratio:number}
type SwordFrame=typeof SWORD_ART.frames[number];

/** Painting and presentation only. Every fact comes from a supplied official view/event. */
export function createExpeditionScene(root:HTMLElement,host:ExpeditionSceneHost):ExpeditionScene {
 const find=<T extends HTMLElement>(id:string):T=>{
  const node=root.querySelector<T>(`#${id}`);if(!node)throw Error(`Missing expedition scene node ${id}`);return node;
 };
 const scene=find('x6-forge-scene'),canvas=find<HTMLCanvasElement>('x6-blade'),hammer=find('x6-hammer');
 const sparks=find('x6-sparks'),impact=find('x6-impact');
 const game=root.querySelector<HTMLElement>('.x6-game')??root;
 const primary=find('x6-primary'),guardArt=find<HTMLImageElement>('x6-guard-art'),escort=find('x6-escort');
 const gap=document.createElement('i');gap.setAttribute('aria-hidden','true');gap.dataset.sceneGap='';
 gap.style.cssText='position:absolute;pointer-events:none;z-index:2;display:none;background:linear-gradient(90deg,#153e42 8%,#9bdccdd9 30%,#fff7df 52%,#adebdbed 72%,#173b40 94%);filter:drop-shadow(0 0 6px #88dfc8);clip-path:polygon(35% 0,100% 10%,60% 43%,85% 65%,30% 100%,0 77%,30% 40%)';
 primary.append(gap);
 const animations=new Set<Animation>();
 const concealed=new Map<HTMLElement,string>();
 let transient:HTMLElement|null=null;
 const swordArt=new Image(),stamp=document.createElement('canvas');
 let artState:'loading'|'ready'|'failed'='loading',artGeneration=0;
 const swordFrames=SWORD_ART.frames;
 let disposed=false,epoch=0,watchFrame:number|null=null,latest:RunView|null=null,visual:Blade|null=null;
 let playing:Playing|null=null,pointer:StrikePoint|null=null,geometry:Geometry|null=null;

 function animate(node:HTMLElement|SVGElement,frames:Keyframe[],duration:number,easing='ease-out',fill:FillMode='none'){
  if(disposed||host.reduced()||typeof node.animate!=='function')return;
  const animation=node.animate(frames,{duration,easing,fill});animations.add(animation);
  // Filled clone poses remain owned until cancel/finish explicitly releases them.
  void animation.finished.then(()=>{if(fill==='none')animations.delete(animation);},()=>animations.delete(animation));
 }
 const motion=createHammerMotion(hammer,host.reduced,animate);
 function measure():Geometry|null{
  const rect=canvas.getBoundingClientRect();
  if(rect.width<=0||rect.height<=0)return null;
  const actual=window.devicePixelRatio;
  return{width:rect.width,height:rect.height,ratio:Number.isFinite(actual)&&actual>0?actual:1};
 }
 function projectPoint(before:Blade|null,after:Blade|null=null):{x:number;y:number}{
  const rect=scene.getBoundingClientRect();
  const x=pointer?(pointer.clientX-rect.left)/Math.max(1,rect.width):.57;
  let minimum=.30,maximum=.81;
  for(const blade of [before,after]){
   if(!blade||rect.width<=0||rect.height<=0)continue;
   const frame=swordFrames[formStage(blade)],placement=swordPlacement(frame,blade,rect.width,rect.height);
   minimum=Math.max(minimum,(placement.left+placement.width*(frame.bodyStart+.07))/rect.width);
   maximum=Math.min(maximum,(placement.left+placement.width*(frame.bodyEnd-.07))/rect.width);
  }
  // Aim follows the working edge; mouse precision never changes an outcome.
  return{x:minimum<=maximum?Math.max(minimum,Math.min(maximum,x)):.57,y:.56};
 }
 function contactPoint():{x:number;y:number}{
  return playing?.point??projectPoint(visual);
 }
 function positionHammer(){
  const rect=scene.getBoundingClientRect(),point=contactPoint();
  scene.style.setProperty('--aim-x',`${point.x*rect.width}px`);
  scene.style.setProperty('--aim-y',`${point.y*rect.height}px`);
  scene.style.setProperty('--hit-x',`${point.x*rect.width}px`);
  scene.style.setProperty('--hit-y',`${point.y*rect.height}px`);
 }
 function layer(){
  if(!transient){
   transient=document.createElement('div');transient.dataset.x6Transient='';transient.setAttribute('aria-hidden','true');transient.inert=true;
   transient.style.cssText='position:fixed;inset:0;z-index:32;pointer-events:none;overflow:hidden';game.append(transient);
  }
  return transient;
 }
 function conceal(node:HTMLElement){if(!concealed.has(node))concealed.set(node,node.style.visibility);node.style.visibility='hidden';}
 function cloneProp(source:HTMLElement|null):HTMLElement|null{
  if(!source)return null;
  const rect=source.getBoundingClientRect();if(rect.width<=0||rect.height<=0||source.closest('[hidden]'))return null;
  const clone=source.cloneNode(true) as HTMLElement;
  const originals=[source,...source.querySelectorAll('*')],copies=[clone,...clone.querySelectorAll('*')];
  for(let index=0;index<originals.length;index++){
   const original=originals[index]!,copy=copies[index]!;
   if(copy instanceof HTMLElement||copy instanceof SVGElement){
    const styles=getComputedStyle(original);
    for(let item=0;item<styles.length;item++){const name=styles.item(item);copy.style.setProperty(name,styles.getPropertyValue(name));}
   }
   copy.removeAttribute('id');copy.removeAttribute('name');copy.removeAttribute('hidden');copy.setAttribute('aria-hidden','true');
   if(copy instanceof HTMLElement)copy.tabIndex=-1;
  }
  Object.assign(clone.style,{position:'fixed',left:`${rect.left}px`,top:`${rect.top}px`,right:'auto',bottom:'auto',
   width:`${rect.width}px`,height:`${rect.height}px`,minWidth:'0',minHeight:'0',maxWidth:'none',maxHeight:'none',margin:'0',
   translate:'none',rotate:'none',scale:'none',transform:'none',transition:'none',animation:'none',pointerEvents:'none',visibility:'visible'});
  clone.inert=true;layer().append(clone);return clone;
 }
 function fittedRect(image:HTMLImageElement):DOMRect{
  const rect=image.getBoundingClientRect();
  if(!image.naturalWidth||!image.naturalHeight)return rect;
  const scale=Math.min(rect.width/image.naturalWidth,rect.height/image.naturalHeight);
  const width=image.naturalWidth*scale,height=image.naturalHeight*scale;
  const positions=getComputedStyle(image).objectPosition.split(/\s+/);
  const fraction=(value:string|undefined)=>value==='left'||value==='top'?0:value==='right'||value==='bottom'?1:
   value?.endsWith('%')?Number.parseFloat(value)/100:.5;
  return new DOMRect(rect.left+(rect.width-width)*fraction(positions[0]),rect.top+(rect.height-height)*fraction(positions[1]),width,height);
 }
 function syncProps(view:RunView){
  // Terminal results archive the actual trial. Its defeated pose must survive
  // the last contact; a null current trial does not mean a new living guard.
  const trial=view.trial??(view.ended?view.history.at(-1):null);
  const defeated=trial?.primary.health===0||view.phase==='cache'&&view.gateCleared;
  guardArt.style.transformOrigin='50% 95%';
  guardArt.style.transform=defeated?'translate(22px,24px) rotate(68deg) scale(.72)':'';
  guardArt.style.opacity=defeated?'.38':'';
  const opening=!!view.trial?.opening&&!defeated;
  gap.style.display=opening?'block':'none';
  if(opening){
   const image=fittedRect(guardArt),parent=primary.getBoundingClientRect();
   gap.style.left=`${image.left-parent.left+image.width*.49}px`;gap.style.top=`${image.top-parent.top+image.height*.31}px`;
   gap.style.width=`${Math.max(7.5,image.width*.0375)}px`;gap.style.height=`${image.height*.32}px`;
  }
 }
 function paintGhost(ghost:SwordGhost,blade:Blade|null,view:RunView){
  const context=ghost.node.getContext('2d');if(!context)return;
  const ratio=ghost.node.width/Math.max(1,ghost.rect.width);
  context.setTransform(ratio,0,0,ratio,0,0);context.clearRect(0,0,ghost.rect.width,ghost.rect.height);
  if(!blade)return;
  ghost.node.dataset.pieceId=blade.id;ghost.node.dataset.strength=String(blade.strength);
  const techniqueUsed=view.techniquePieceIds.includes(blade.id);
  if(artState==='ready')paintIllustratedSword(context,stamp,swordArt,swordFrames[formStage(blade)],blade,ghost.rect.width,ghost.rect.height,techniqueUsed,false);
  else if(artState==='failed')paintSword(context,blade,ghost.rect.width,ghost.rect.height,techniqueUsed);
 }
 function swordGhost(blade:Blade|null,view:RunView):SwordGhost|null{
  if(!blade)return null;
  const rect=canvas.getBoundingClientRect();if(rect.width<=0||rect.height<=0)return null;
  const node=document.createElement('canvas');node.width=canvas.width;node.height=canvas.height;
  node.dataset.x6MotionSword='';
  node.style.cssText=`position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;pointer-events:none`;
  const frame=swordFrames[formStage(blade)],placement=swordPlacement(frame,blade,rect.width,rect.height);
  const pivot={x:placement.left+placement.width*(formStage(blade)>=2?.10:.03),y:rect.height*.56};
  const metal={x:placement.left+placement.width*(frame.bodyStart+(frame.bodyEnd-frame.bodyStart)*.65),y:pivot.y};
  node.style.transformOrigin=`${pivot.x}px ${pivot.y}px`;
  layer().append(node);const ghost={node,rect,pivot,metal};paintGhost(ghost,blade,view);conceal(canvas);return ghost;
 }
 function prepareProps(own:Playing){
  const cache=own.events.find(event=>event.type==='CacheTaken');
  let target:HTMLElement|null=null,targetRect:DOMRect|null=null,rope:HTMLElement|null=null,latch:HTMLElement|null=null;
  let tool:HTMLElement|null=null,toolRect:DOMRect|null=null;
  if(cache?.type==='CacheTaken'){
   const button=find(cache.target==='rope'?'x6-rope':'x6-latch'),chest=button.querySelector<HTMLElement>('.x6-chest');
   const physical=button.querySelector<HTMLElement>(cache.target==='rope'?'.x6-hanging-rope':'.x6-iron-latch');
   targetRect=physical?.getBoundingClientRect()??button.getBoundingClientRect();target=cloneProp(chest);
   if(chest)conceal(chest);
   if(cache.target==='rope'){rope=cloneProp(physical);if(physical)conceal(physical);}
   else{latch=cloneProp(physical);const copy=target?.querySelector<HTMLElement>('.x6-iron-latch');if(copy)copy.style.visibility='hidden';}
   const image=chest?.querySelector<HTMLImageElement>('img')??null;
   if(image&&image.complete&&image.naturalWidth>0){toolRect=image.getBoundingClientRect();tool=cloneProp(image);if(tool)tool.style.visibility='hidden';}
  }else{
   const source=own.mode==='followUp'?find('x6-secondary').querySelector<HTMLElement>('.x6-practice-target'):guardArt;
   targetRect=source instanceof HTMLImageElement?fittedRect(source):source?.getBoundingClientRect()??null;
   target=cloneProp(source);if(source)conceal(source);
  }
  const gate=own.events.some(event=>event.type==='GateCleared');
  const escortRect=gate?escort.getBoundingClientRect():null,escortCopy=gate?cloneProp(escort):null;
  if(escortCopy)escortCopy.style.visibility='hidden';
  const toolElement=find('x6-tool-art'),toolBox=toolElement.getBoundingClientRect();
  const toolOrigin=toolBox.width>0&&toolBox.height>0&&!toolElement.closest('[hidden]')?toolBox:null;
  own.props={target,targetRect,rope,latch,tool,toolRect,toolOrigin,escort:escortCopy,escortRect,sword:swordGhost(visual,own.before)};
  const sword=own.props.sword;if(!sword||!targetRect)return;
  const angle=own.mode==='guard'?-57:-24,radians=angle*Math.PI/180;
  const mx=sword.pivot.x+(sword.metal.x-sword.pivot.x)*Math.cos(radians),my=sword.pivot.y+(sword.metal.x-sword.pivot.x)*Math.sin(radians);
  const tx=targetRect.left+targetRect.width*(own.mode==='cache'?.5:.68),ty=targetRect.top+targetRect.height*(own.mode==='cache'?.48:.47);
  const dx=tx-(sword.rect.left+mx),dy=ty-(sword.rect.top+my);
  const pose=`translate(${dx}px,${dy}px) rotate(${angle}deg)`;
  own.contactPose=pose;
  animate(sword.node,[{transform:'translate(0,0) rotate(0deg)'},
   {transform:`translate(${dx*.35}px,${dy*.48-12}px) rotate(-66deg)`,offset:.56},
   {transform:pose}],own.contactAt,'ease-in','forwards');
 }
 function paint(){
  if(disposed)return;
  const size=measure();if(!size)return;
  geometry=size;
  const width=Math.max(1,Math.round(size.width*size.ratio)),height=Math.max(1,Math.round(size.height*size.ratio));
  if(canvas.width!==width)canvas.width=width;if(canvas.height!==height)canvas.height=height;
  const context=canvas.getContext('2d');if(!context)return;
  context.setTransform(size.ratio,0,0,size.ratio,0,0);context.clearRect(0,0,size.width,size.height);
  if(visual){
   const projection=playing?(playing.contacted?playing.after:playing.before):latest;
   const techniqueUsed=projection?.techniquePieceIds.includes(visual.id)??false;
   if(artState==='ready')paintIllustratedSword(context,stamp,swordArt,swordFrames[formStage(visual)]!,visual,size.width,size.height,techniqueUsed);
   else if(artState==='failed')paintSword(context,visual,size.width,size.height,techniqueUsed);
  }
  canvas.dataset.art=artState==='failed'?'fallback':artState;
  canvas.dataset.pieceId=visual?.id??'';
  canvas.dataset.strength=String(visual?.strength??0);
  canvas.dataset.hits=String(visual?.hits??0);
  canvas.dataset.formStrength=String(visual?.sealedStrength??visual?.strength??0);
  canvas.dataset.condition=visual?.status==='broken'?'broken':visual?.fissureMarked?'fissure':visual?.cracked?'cracked':'intact';
  canvas.dataset.stage=String(visual?formStage(visual):0);
  canvas.setAttribute('aria-label',visual?
   `${visual.hits===0?'粗铁坯':visual.strength<3?'正在开锋的铁剑':visual.strength<5?'已成形的剑':'锻成的长剑'}，强度${visual.strength}，${visual.hits}记，${visual.status==='broken'?'已断裂':visual.fissureMarked?'贯穿崩纹':visual.cracked?'有意外裂纹':'剑身完整'}；造型不改变规则`:'空铁砧');
  positionHammer();
 }
 function clearTransient(){
  motion.reset();
  if(watchFrame!==null)cancelAnimationFrame(watchFrame);watchFrame=null;
  for(const animation of animations)animation.cancel();animations.clear();
  for(const[node,visibility]of concealed)node.style.visibility=visibility;concealed.clear();
  if(transient)for(const image of transient.querySelectorAll('img'))image.removeAttribute('src');
  transient?.remove();transient=null;
  sparks.replaceChildren();hammer.classList.remove('preparing');
  canvas.style.transform='';scene.removeAttribute('data-impact');scene.removeAttribute('data-playing');
  impact.style.opacity='';impact.style.transform='';
 }
 function cancelInternal(notify:boolean){
  const hadPlay=playing!==null;
  epoch++;playing=null;clearTransient();pointer=null;
  visual=latest?.activePiece??null;if(latest)syncProps(latest);paint();
  if(notify&&hadPlay)host.cancelled?.();
 }
 function finish(own:Playing){
  if(disposed||playing!==own||own.token!==epoch)return;
  playing=null;clearTransient();visual=own.after.activePiece;syncProps(own.after);paint();
  own.callbacks.done();
 }
 function feedback(event:ForgeEvent){
  const bad=event.result==='crack'||event.result==='broken';
  scene.dataset.impact=event.result;
  if(host.reduced())return;
  animate(canvas,[{transform:'translate(0,0)'},{transform:`translate(${bad?-4:2}px,3px)`,offset:.22},
   {transform:'translate(-1px,-1px)',offset:.5},{transform:'translate(0,0)'}],bad?230:160);
  impact.style.background=bad?'radial-gradient(ellipse,#ff6f484f,transparent 68%)':'radial-gradient(ellipse,#ffd48b69,transparent 68%)';
  animate(impact,[{opacity:0,transform:'translate(-50%,-50%) scale(.3)'},{opacity:1,offset:.16},
   {opacity:0,transform:'translate(-50%,-50%) scale(1.25)'}],bad?340:250);
  const count=event.result==='broken'?18:event.technique?18:12;
  const particles:HTMLElement[]=[];
  for(let index=0;index<count;index++){
   const particle=document.createElement('i');particles.push(particle);
   const angle=-Math.PI+(index/(count-1))*Math.PI;
   const reach=35+(index*31%95),x=Math.cos(angle)*reach,y=Math.sin(angle)*reach+(bad?35:0);
   particle.style.cssText=`position:absolute;left:var(--hit-x);top:var(--hit-y);width:${bad?4+index%4:2+index%2}px;height:${bad?5+index%5:5+index%6}px;background:${bad?'#db826b':index%3?'#ffc56a':'#fff3bc'};border-radius:1px;opacity:0;pointer-events:none`;
   animate(particle,[{opacity:0,transform:'translate(0,0)'},{opacity:1,offset:.08},{opacity:.9,offset:.5},
    {opacity:0,transform:`translate(${x}px,${y}px) rotate(${index*67}deg)`}],bad?350:240+index%3*40);
  }
  sparks.replaceChildren(...particles);
 }
 function touch(own:Playing){
  if(disposed||playing!==own||own.token!==epoch||own.contacted||document.hidden)return;
  own.contacted=true;own.contactedAt=performance.now();visual=own.afterBlade;paint();
  if(own.props?.sword&&own.contactPose){
   for(const animation of own.props.sword.node.getAnimations())animation.cancel();
   own.props.sword.node.style.transform=own.contactPose;
  }
  if(own.props?.sword)paintGhost(own.props.sword,own.afterBlade,own.after);
  if(own.event)feedback(own.event);
  own.callbacks.contact();
  if(playing!==own||own.token!==epoch)return;
  // The contact callback may intentionally switch road/forge layout. Adopt that
  // geometry now; its subsequent ResizeObserver delivery is not a new resize.
  syncProps(own.after);paint();
  if(own.mode!=='forge'&&own.mode!=='change')contactProps(own);
 }
 function flash(rect:DOMRect,color:string,xFraction:number){
  const node=document.createElement('i');
  node.style.cssText=`position:fixed;left:${rect.left+rect.width*xFraction}px;top:${rect.top+rect.height*.48}px;width:90px;height:4px;transform-origin:50% 50%;pointer-events:none;border-radius:100%;background:linear-gradient(90deg,transparent,${color},transparent);opacity:0`;
  layer().append(node);animate(node,[{opacity:0,transform:'translate(-50%,-50%) rotate(-28deg) scaleX(.15)'},
   {opacity:1,offset:.15},{opacity:0,transform:'translate(-50%,-50%) rotate(-28deg) scaleX(1.5)'}],210);
 }
 function toolPulse(own:Playing,kind:'stored'|'used'|'recharged'|'full',fallback:string){
  const source=find('x6-tool-pulse'),sourceBox=source.getBoundingClientRect();
  let pulse=cloneProp(source);
  if(pulse)conceal(source);
  else{
   const anchor=own.props?.toolOrigin;if(!anchor)return;
   pulse=document.createElement('span');pulse.textContent=fallback;
   pulse.style.cssText=`position:fixed;left:${Math.max(12,anchor.left-12)}px;top:${anchor.bottom+5}px;padding:5px 8px;color:#f6e4bd;background:#102a2de8;border:1px solid #ad9a6b88;font:600 16px/1.4 STKaiti,KaiTi,serif;pointer-events:none`;
   layer().append(pulse);
  }
  pulse.dataset.x6ToolEvent=kind;
  if(kind==='used')pulse.textContent=fallback;
  const remaining=Math.max(1,own.duration-own.contactAt);
  if(kind==='used'){
   animate(pulse,[{opacity:1,transform:'translate(0,0)'},{opacity:0,transform:'translate(8px,-12px)'}],Math.min(360,remaining),'ease-out','forwards');
  }else{
   const glow=kind==='full'?'#c7cbb75c':kind==='stored'?'#97dec89c':'#f0bb6ba6';
   pulse.style.color=kind==='full'?'#dbddcd':kind==='stored'?'#d7f4e5':'#ffe2ac';
   pulse.style.transformOrigin='50% 50%';
   animate(pulse,[{opacity:.45,transform:'scale(.96)',filter:'drop-shadow(0 0 0 transparent)'},
    {opacity:1,transform:'scale(1.035)',filter:`drop-shadow(0 0 7px ${glow})`,offset:.32},
    {opacity:1,transform:'scale(1)',filter:'drop-shadow(0 0 0 transparent)'}],remaining,'ease-out','forwards');
  }
  // Record the real source rectangle for this transient, without moving the UI.
  if(sourceBox.width>0)pulse.dataset.source='formal-tool-pulse';
 }
 function traceEnergy(from:{x:number;y:number},to:{x:number;y:number},duration:number,kind:'stored'|'recharged'){
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),path=document.createElementNS(ns,'path');
  svg.setAttribute('viewBox',`0 0 ${window.innerWidth} ${window.innerHeight}`);
  svg.style.cssText='position:fixed;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none';svg.dataset.x6Energy=kind;
  const control={x:(from.x+to.x)/2,y:Math.min(from.y,to.y)-45};
  path.setAttribute('d',`M${from.x} ${from.y} Q${control.x} ${control.y} ${to.x} ${to.y}`);
  path.setAttribute('fill','none');path.setAttribute('stroke',kind==='stored'?'#9ee2ca':'#f4c47f');path.setAttribute('stroke-width','2');
  path.style.filter=`drop-shadow(0 0 5px ${kind==='stored'?'#70bcaa':'#ea9e4f'})`;
  svg.append(path);layer().append(svg);
  const length=path.getTotalLength();path.style.strokeDasharray=String(length);path.style.strokeDashoffset=String(length);
  animate(path,[{opacity:0,strokeDashoffset:String(length)},{opacity:.8,offset:.10},
   {opacity:.8,strokeDashoffset:'0',offset:.77},{opacity:0,strokeDashoffset:'0'}],duration,'ease-in-out');
  const ember=document.createElement('i');
  ember.style.cssText=`position:fixed;left:${from.x-3}px;top:${from.y-3}px;width:6px;height:6px;border-radius:50%;background:${kind==='stored'?'#d9fae4':'#fff0c5'};box-shadow:0 0 9px ${kind==='stored'?'#93dbc3':'#efa952'};pointer-events:none;opacity:0`;
  layer().append(ember);
  const frames:Keyframe[]=[];
  for(let index=0;index<=8;index++){
   const t=index/8,x=(1-t)*(1-t)*from.x+2*(1-t)*t*control.x+t*t*to.x,y=(1-t)*(1-t)*from.y+2*(1-t)*t*control.y+t*t*to.y;
   frames.push({transform:`translate(${x-from.x}px,${y-from.y}px) scale(${index===8?.7:1})`,opacity:index===0||index===8?0:1,offset:t});
  }
  animate(ember,frames,duration,'linear');
 }
 function contactProps(own:Playing){
  const props=own.props;if(!props)return;
  const remaining=Math.max(1,own.duration-own.contactAt),gate=own.events.some(event=>event.type==='GateCleared');
  const hit=own.events.find(event=>event.type==='Struck'),cache=own.events.find(event=>event.type==='CacheTaken');
  const follow=own.events.find(event=>event.type==='FollowUpUsed'),stored=own.events.find(event=>event.type==='FollowUpStored');
  const restored=own.events.find(event=>event.type==='ChargeRestored');
  const defeated=hit?.type==='Struck'&&hit.after===0||follow?.type==='FollowUpUsed'&&follow.healthAfter===0;
  if(props.targetRect&&own.mode!=='guard')flash(props.targetRect,own.mode==='followUp'?'#c9f4df':hit?.type==='Struck'&&hit.damage===0?'#d9e0ce':'#ffe1a4',own.mode==='cache'?.5:.68);
  if(own.mode==='guard'){
   if(props.target)animate(props.target,[{transform:'rotate(0deg)'},{transform:'translate(8px,0) rotate(-4deg)',offset:.35},{transform:'rotate(0deg)'}],remaining);
   const opening=cloneProp(gap);if(opening)animate(opening,[{opacity:0,transform:'scaleX(.2)'},{opacity:1,transform:'scaleX(1)'}],remaining,'ease-out','forwards');
  }else if(props.target&&defeated){
   props.target.style.transformOrigin='50% 95%';
   animate(props.target,[{transform:'translate(0,0) rotate(0deg)',opacity:1},
    {transform:'translate(10px,4px) rotate(10deg)',offset:.18,opacity:1},
    {transform:'translate(22px,24px) rotate(68deg) scale(.72)',opacity:.38}],Math.min(500,remaining),'ease-in','forwards');
  }else if(props.target&&own.mode!=='cache'){
   const amount=hit?.type==='Struck'&&hit.damage===0?5:12;
   animate(props.target,[{transform:'translate(0,0) rotate(0deg)'},{transform:`translate(${amount}px,3px) rotate(3deg)`,offset:.18},
    {transform:'translate(-3px,0) rotate(-1deg)',offset:.45},{transform:'translate(0,0) rotate(0deg)'}],remaining);
  }
  if(gate&&props.escort&&props.escortRect){
   const destination=escort.getBoundingClientRect();conceal(escort);props.escort.style.visibility='visible';
   const dx=destination.left-props.escortRect.left,dy=destination.top-props.escortRect.top;
   animate(props.escort,[{transform:'translate(0,0)',opacity:.7},
    {transform:`translate(${dx*.22}px,${dy*.22-3}px)`,offset:.25,opacity:1},
    {transform:`translate(${dx*.46}px,${dy*.46}px)`,offset:.46},
    {transform:`translate(${dx*.7}px,${dy*.7-3}px)`,offset:.70},
    {transform:`translate(${dx}px,${dy}px)`,opacity:1}],remaining,'linear','forwards');
  }
  if(stored?.type==='FollowUpStored'&&stored.damage>0){
   toolPulse(own,'stored',`余力 ${stored.damage}`);
   if(props.toolOrigin&&props.targetRect)traceEnergy(
    {x:props.targetRect.left+props.targetRect.width*.68,y:props.targetRect.top+props.targetRect.height*.47},
    {x:props.toolOrigin.left+props.toolOrigin.width/2,y:props.toolOrigin.top+props.toolOrigin.height/2},Math.min(520,remaining),'stored');
  }
  if(follow?.type==='FollowUpUsed')toolPulse(own,'used','余力已用');
  if(restored?.type==='ChargeRestored'){
   toolPulse(own,restored.gained===1?'recharged':'full',restored.gained===1?'手艺＋1':'次数已满');
   const destination=find('x6-technique'),rect=destination.getBoundingClientRect();
   if(restored.gained===1&&own.after.phase==='echo-recharge'&&props.toolOrigin&&rect.width>0&&rect.height>0&&!destination.closest('[hidden]')){
    traceEnergy({x:props.toolOrigin.left+props.toolOrigin.width/2,y:props.toolOrigin.top+props.toolOrigin.height/2},
     {x:rect.left+rect.width/2,y:rect.top+rect.height/2},Math.min(560,remaining),'recharged');
    const rim=document.createElement('i');rim.dataset.x6ChargeTarget='1';
    rim.style.cssText=`position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;border:1px solid #f0c181;border-radius:3px;box-sizing:border-box;pointer-events:none;opacity:0`;
    layer().append(rim);animate(rim,[{opacity:0},{opacity:0,offset:.50},{opacity:1,boxShadow:'0 0 11px #edb66b8c',offset:.80},{opacity:0}],remaining);
   }
  }
  if(cache?.type==='CacheTaken'){
   if(props.rope){
    const lower=cloneProp(props.rope);props.rope.style.clipPath='inset(0 0 52% 0)';
    if(lower){lower.style.clipPath='inset(48% 0 0 0)';animate(lower,[{transform:'translate(0,0)',opacity:1},{transform:'translate(9px,65px) rotate(18deg)',opacity:0}],360,'ease-in','forwards');}
    animate(props.rope,[{transform:'translateY(0)'},{transform:'translateY(-9px) rotate(-7deg)'}],250,'ease-out','forwards');
   }
   if(props.latch)animate(props.latch,[{transform:'rotate(5deg)',opacity:1},{transform:'translate(24px,49px) rotate(48deg)',opacity:0}],360,'ease-in','forwards');
   if(props.target){
    const packed=props.target.querySelector<HTMLElement>('img');if(packed)packed.style.visibility='hidden';
    animate(props.target,[{transform:'translate(0,0)',opacity:1},{transform:'translate(0,29px) rotate(4deg)',offset:.55,opacity:.8},
     {transform:'translate(0,35px) rotate(4deg)',opacity:0}],remaining,'ease-in','forwards');
   }
   if(props.tool&&props.toolRect){
    const destination=find<HTMLImageElement>('x6-tool-art'),rect=destination.getBoundingClientRect();
    if(rect.width>0&&rect.height>0){
     conceal(destination);props.tool.style.visibility='visible';
     const dx=rect.left+rect.width/2-(props.toolRect.left+props.toolRect.width/2),dy=rect.top+rect.height/2-(props.toolRect.top+props.toolRect.height/2);
     const scale=Math.min(rect.width/props.toolRect.width,rect.height/props.toolRect.height);
     animate(props.tool,[{transform:'translate(0,0) scale(1)',opacity:1},
      {transform:'translate(0,18px) scale(1.05)',offset:.18},
      {transform:`translate(${dx*.50}px,${dy*.48-55}px) scale(${(1+scale)/2})`,offset:.57},
      {transform:`translate(${dx}px,${dy}px) scale(${scale})`,opacity:1}],remaining,'ease-in-out','forwards');
    }
   }
  }
 }
 function watch(own:Playing){
  watchFrame=null;
  if(disposed||playing!==own||own.token!==epoch)return;
  if(document.hidden||host.reduced()){cancelInternal(true);return;}
  const terminalHold=own.after.ended?own.duration-120:0;
  if(own.contacted&&hammer.dataset.phase==='idle'&&own.contactedAt!==null&&performance.now()-own.contactedAt>=terminalHold){finish(own);return;}
  watchFrame=requestAnimationFrame(()=>watch(own));
 }
 function watchAction(own:Playing){
  watchFrame=null;
  if(disposed||playing!==own||own.token!==epoch)return;
  if(document.hidden||host.reduced()){cancelInternal(true);return;}
  const elapsed=performance.now()-own.startedAt;
  if(!own.contacted&&elapsed>=own.contactAt)touch(own);
  if(playing!==own||own.token!==epoch)return;
  if(own.contacted){
   own.contactFrames++;
   if(own.contactFrames>=3&&!own.rebounded&&own.props?.sword&&own.contactPose){
    own.rebounded=true;
    animate(own.props.sword.node,[{transform:own.contactPose},{transform:own.contactPose,offset:.15},
     {transform:'translate(0,0) rotate(0deg)'}],Math.max(90,own.duration-own.contactAt-32),'ease-out','forwards');
   }
   if(own.contactFrames>=3&&own.contactedAt!==null&&performance.now()-own.contactedAt>=own.duration-own.contactAt){finish(own);return;}
  }
  watchFrame=requestAnimationFrame(()=>watchAction(own));
 }
 function resized(){
  if(disposed)return;
  const next=measure();if(!next)return;
  const changed=geometry!==null&&(Math.abs(next.width-geometry.width)>.25||Math.abs(next.height-geometry.height)>.25||next.ratio!==geometry.ratio);
  if(changed&&playing){cancelInternal(true);return;}
  paint();
 }
 const resize=typeof ResizeObserver==='undefined'?null:new ResizeObserver(resized);
 resize?.observe(scene);
 window.addEventListener('resize',resized);
 const hidden=()=>{if(document.hidden)cancelInternal(true);};
 document.addEventListener('visibilitychange',hidden);
 const artToken=++artGeneration;
 const loaded=()=>{
  if(disposed||artToken!==artGeneration||!swordArt.complete||swordArt.naturalWidth===0)return;
  try{
   if(swordArt.naturalWidth!==SWORD_ART.width||swordArt.naturalHeight!==SWORD_ART.height)throw Error('Sword atlas dimensions changed.');
   artState='ready';
  }catch{artState='failed';}
  // Artwork availability may repaint a before/contact projection, never advance it.
  paint();
 };
 const failed=()=>{
  if(disposed||artToken!==artGeneration||!swordArt.complete||swordArt.naturalWidth!==0)return;
  artState='failed';paint();
 };
 swordArt.addEventListener('load',loaded);swordArt.addEventListener('error',failed);swordArt.src=SWORD_ART.src;

 return{
  render(view){
   if(disposed)return;latest=view;
   if(playing&&(view.runId!==playing.after.runId||view.revision>playing.after.revision))cancelInternal(true);
   syncProps(view);
   // A session publication can update facts while the Accepted old blade still owns contact.
   if(!playing){visual=view.activePiece;paint();}
  },
  play(events,before,after,callbacks){
   if(disposed)return;
   const aim=pointer;cancelInternal(false);pointer=aim;latest=after;
   const event=events.find((value):value is ForgeEvent=>value.type==='Forged')??null;
   const strike=events.find(value=>value.type==='Struck'),guard=events.find(value=>value.type==='Guarded');
   const mode:ActionMotion=event?'forge':guard?'guard':strike?'strike':events.some(value=>value.type==='CacheTaken')?'cache':events.some(value=>value.type==='FollowUpUsed')?'followUp':'change';
   const pieceId=event?.pieceId??(strike?.type==='Struck'?strike.pieceId:guard?.type==='Guarded'?guard.pieceId:before.trial?.pieceId??before.activePiece?.id);
   const beforeBlade=before.blades.find(blade=>blade.id===pieceId)??before.activePiece;
   const afterBlade=after.blades.find(blade=>blade.id===pieceId)??after.activePiece;
   const major=events.some(value=>value.type==='GateCleared'||value.type==='CacheTaken');
   const toolMajor=events.some(value=>value.type==='FollowUpStored'||value.type==='FollowUpUsed'||value.type==='ChargeRestored')||after.ended;
   const own:Playing={token:++epoch,before,after,event,afterBlade,callbacks,point:projectPoint(beforeBlade,afterBlade),
    events,mode,startedAt:performance.now(),contactAt:120,duration:major?760:toolMajor?720:mode==='guard'?380:400,
    props:null,contacted:false,contactedAt:null,contactFrames:0,rebounded:false,contactPose:null};
   playing=own;visual=beforeBlade;scene.dataset.playing=mode;syncProps(before);paint();
   if(document.hidden||!measure()){cancelInternal(true);return;}
   if(mode==='change'||host.reduced()){
    touch(own);queueMicrotask(()=>{if(playing===own&&own.token===epoch)finish(own);});return;
   }
   if(mode!=='forge'){
    prepareProps(own);watchFrame=requestAnimationFrame(()=>watchAction(own));return;
   }
   positionHammer();motion.strike(event?.technique??false,()=>touch(own));
   watchFrame=requestAnimationFrame(()=>watch(own));
  },
  aim(point){if(!disposed&&!playing){pointer=point;positionHammer();}},
  preparing(value){if(!disposed)hammer.classList.toggle('preparing',value&&!playing);},
  cancel(){if(!disposed)cancelInternal(false);},
  dispose(){
   if(disposed)return;cancelInternal(false);disposed=true;
   resize?.disconnect();window.removeEventListener('resize',resized);document.removeEventListener('visibilitychange',hidden);
   artGeneration++;swordArt.removeEventListener('load',loaded);swordArt.removeEventListener('error',failed);
   if(artState==='loading')swordArt.removeAttribute('src');
   stamp.width=0;stamp.height=0;
   gap.remove();guardArt.style.transform='';guardArt.style.transformOrigin='';guardArt.style.opacity='';
   latest=null;visual=null;geometry=null;
  },
 };
}

function formStage(blade:Blade):0|1|2|3{
 const strength=blade.sealedStrength??blade.strength;
 return blade.hits===0||strength===0?0:strength<3?1:strength<5?2:3;
}
function swordPlacement(frame:SwordFrame,blade:Blade,width:number,height:number){
 const stage=formStage(blade),maximumWidth=width*([.43,.55,.66,.73][stage]??.73);
 const scale=Math.min(maximumWidth/frame.width,height*.59/frame.height);
 const drawnWidth=frame.width*scale,drawnHeight=frame.height*scale;
 return{left:width*.54-drawnWidth/2,top:height*.56-drawnHeight*frame.axisY,width:drawnWidth,height:drawnHeight};
}
function paintIllustratedSword(context:CanvasRenderingContext2D,stamp:HTMLCanvasElement,image:HTMLImageElement,frame:SwordFrame,blade:Blade,width:number,height:number,techniqueUsed:boolean,grounded=true){
 const stage=formStage(blade),placement=swordPlacement(frame,blade,width,height);
 const{left,top}=placement,drawnWidth=placement.width,drawnHeight=placement.height;
 if(stamp.width!==frame.width)stamp.width=frame.width;if(stamp.height!==frame.height)stamp.height=frame.height;
 const ink=stamp.getContext('2d');if(!ink)return;
 ink.setTransform(1,0,0,1,0,0);ink.clearRect(0,0,stamp.width,stamp.height);
 ink.drawImage(image,frame.x,frame.y,frame.width,frame.height,0,0,frame.width,frame.height);
 ink.save();ink.globalCompositeOperation='source-atop';
 const axis=frame.height*frame.axisY,bodyStart=frame.width*frame.bodyStart,bodyEnd=frame.width*frame.bodyEnd;
 if(stage>0&&techniqueUsed&&blade.school==='steady'&&!blade.cracked){
  ink.strokeStyle='#f5de9e8c';ink.lineWidth=Math.max(1,frame.height*.018);
  ink.beginPath();ink.moveTo(bodyStart,axis-frame.height*.09);ink.lineTo(bodyEnd-frame.width*.08,axis-frame.height*.08);
  ink.lineTo(bodyEnd,axis);ink.stroke();
 }
 if(blade.cracked){
  const x=bodyStart+(bodyEnd-bodyStart)*.47;
  const crack=new Path2D();crack.moveTo(x,0);crack.lineTo(x+frame.width*.022,axis*.72);
  crack.lineTo(x-frame.width*.010,axis);crack.lineTo(x+frame.width*.032,axis*1.23);crack.lineTo(x+frame.width*.012,frame.height);
  ink.strokeStyle='#152329';ink.lineWidth=Math.max(3,frame.height*(blade.fissureMarked?.075:.044));ink.stroke(crack);
  ink.strokeStyle=blade.fissureMarked?'#e7a268':'#a96852';ink.lineWidth=Math.max(1,frame.height*(blade.fissureMarked?.026:.012));ink.stroke(crack);
  if(blade.fissureMarked){
   ink.strokeStyle='#ffd39b';ink.lineWidth=Math.max(1,frame.height*.012);
   ink.beginPath();ink.moveTo(x+frame.width*.01,axis*.9);ink.lineTo(x+frame.width*.11,axis*.35);
   ink.moveTo(x+frame.width*.025,axis*1.15);ink.lineTo(x+frame.width*.15,axis*1.65);ink.stroke();
  }
 }
 const wear=Math.max(0,(blade.sealedStrength??blade.strength)-blade.strength);
 if(wear>0){
  ink.fillStyle=`rgba(16,34,39,${Math.min(.5,wear*.075)})`;ink.fillRect(bodyStart,0,bodyEnd-bodyStart,frame.height);
  ink.strokeStyle='#d4b98c99';ink.lineWidth=Math.max(1,frame.height*.01);
  for(let index=0;index<wear*2;index++){
   const x=bodyStart+(bodyEnd-bodyStart)*(.2+index%7*.09);
   ink.beginPath();ink.moveTo(x,axis-frame.height*.15);ink.lineTo(x+frame.width*.014,axis-frame.height*.04);ink.stroke();
  }
 }
 ink.restore();
 context.save();context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
 if(grounded){
  context.fillStyle='#05121969';context.filter='blur(6px)';context.beginPath();
  context.ellipse(left+drawnWidth*.53,height*.56+Math.max(10,drawnHeight*.16),drawnWidth*.47,Math.max(5,drawnHeight*.10),0,0,Math.PI*2);context.fill();
  context.filter='none';
 }
 context.shadowColor='#0009';context.shadowBlur=5;context.shadowOffsetY=4;
 if(blade.status==='broken'){
  const fracture=left+drawnWidth*.59;
  context.save();context.beginPath();context.rect(left-10,0,fracture-left-3,height);context.clip();context.drawImage(stamp,left,top,drawnWidth,drawnHeight);context.restore();
  context.save();context.translate(fracture+15,height*.56+11);context.rotate(.075);context.translate(-fracture,-height*.56);
  context.beginPath();context.rect(fracture+4,0,width,height);context.clip();context.drawImage(stamp,left,top,drawnWidth,drawnHeight);context.restore();
 }else context.drawImage(stamp,left,top,drawnWidth,drawnHeight);
 context.restore();
}
function paintSword(context:CanvasRenderingContext2D,blade:Blade,width:number,height:number,techniqueUsed:boolean){
 const stage=formStage(blade),y=height*.56;
 const start=width*(stage===0?.34:.28),length=width*(stage===0?.37:stage===1?.43:stage===2?.52:.58);
 const half=Math.min(stage===0?17:stage===1?14:stage===2?17:21,height*.085);
 const broken=blade.status==='broken',fracture=start+length*.51;
 context.save();context.lineJoin='round';context.lineCap='round';
 context.shadowColor='#000b';context.shadowBlur=8;context.shadowOffsetY=6;
 const draw=()=>{
  const path=new Path2D();
  if(stage===0){
   path.moveTo(start,y-half*.78);path.lineTo(start+length*.19,y-half);path.lineTo(start+length,y-half*.84);
   path.lineTo(start+length+3,y+half*.70);path.lineTo(start+length*.26,y+half);path.lineTo(start-3,y+half*.68);path.closePath();
  }else{
   const tip=stage===1?length*.92:length;
   path.moveTo(start,y-half);path.lineTo(start+length*.73,y-half*(stage===1?.86:.91));
   path.lineTo(start+tip,y-(stage===1?half*.26:0));path.lineTo(start+length*.73,y+half*(stage===1?.82:.91));
   path.lineTo(start,y+half);path.closePath();
  }
  const steel=context.createLinearGradient(0,y-half,0,y+half);
  if(stage===0){steel.addColorStop(0,'#554c42');steel.addColorStop(.32,'#665e51');steel.addColorStop(.7,'#393a36');steel.addColorStop(1,'#292c2a');}
  else{steel.addColorStop(0,'#e4e6d9');steel.addColorStop(.10,'#9bafad');steel.addColorStop(.42,'#6f8588');steel.addColorStop(.47,'#d1ddd7');steel.addColorStop(.56,'#748f94');steel.addColorStop(.89,'#2b4d58');steel.addColorStop(1,'#c8d8ce');}
  context.fillStyle=steel;context.strokeStyle=stage===0?'#8d7a5d':'#d8e2d7';context.lineWidth=stage===0?1.5:1;
  context.fill(path);context.stroke(path);context.shadowBlur=0;context.shadowOffsetY=0;
  context.save();context.clip(path);
  // Deterministic surface marks are paint, never gameplay randomness.
  for(let index=0;index<36;index++){
   const x=start+(index*47%997)/997*length,dy=((index*31%29)/29-.5)*half*1.7;
   context.strokeStyle=stage===0?'#171e1f80':'#e3ece02c';context.lineWidth=stage===0?1.6:.6;
   context.beginPath();context.moveTo(x,y+dy);context.lineTo(x+3+index%5,y+dy-1);context.stroke();
  }
  if(stage>0){
   context.strokeStyle=stage===3?'#f5f1d7':'#c4dcd2';context.lineWidth=stage===3?2:1;
   context.beginPath();context.moveTo(start+4,y-half+2);context.lineTo(start+length*.73,y-half*.81);context.lineTo(start+length-7,y);context.stroke();
   if(techniqueUsed&&blade.school==='steady'&&!blade.cracked){
    context.strokeStyle=stage===3?'#fff2bb':'#dfebe0';context.lineWidth=stage===3?2:1;
    context.beginPath();context.moveTo(start+8,y-half*.55);context.lineTo(start+length*.72,y-half*.50);context.lineTo(start+length*.9,y-1);context.stroke();
   }
  }
  if(blade.cracked){
   const fissure=new Path2D();const origin=start+length*.36;
   fissure.moveTo(origin,y-half-2);fissure.lineTo(origin+length*.06,y-half*.35);
   fissure.lineTo(origin+length*.015,y+half*.03);fissure.lineTo(origin+length*.10,y+half*.32);fissure.lineTo(origin+length*.075,y+half+3);
   context.strokeStyle='#132027';context.lineWidth=blade.fissureMarked?5:3;context.stroke(fissure);
   context.strokeStyle=blade.fissureMarked?'#ef9e62':'#b97561';context.lineWidth=blade.fissureMarked?2:1;context.stroke(fissure);
   if(blade.fissureMarked){
    context.strokeStyle='#ffd293';context.lineWidth=1;
    context.beginPath();context.moveTo(origin+length*.03,y-half*.1);context.lineTo(origin+length*.20,y-half*.62);
    context.moveTo(origin+length*.09,y+half*.26);context.lineTo(origin+length*.26,y+half*.70);context.stroke();
   }
  }
  const wear=Math.max(0,(blade.sealedStrength??blade.strength)-blade.strength);
  if(wear>0){
   context.fillStyle=`rgba(13,35,43,${Math.min(.6,wear*.10)})`;context.fill(path);
   context.strokeStyle='#d2b28a';context.lineWidth=.9;
   for(let index=0;index<wear*2;index++){
    const x=start+length*(.40+index%7*.07);context.beginPath();context.moveTo(x,y-half*.8);context.lineTo(x+5,y-half*.45);context.stroke();
   }
  }
  context.restore();
  // A fresh billet has no ornate hilt, guard or already-finished tip.
  if(stage>=2){
   const handleLength=width*(stage===3?.105:.085),guardHeight=half*(stage===3?2.0:1.65);
   const handle=context.createLinearGradient(0,y-9,0,y+9);handle.addColorStop(0,'#5c5141');handle.addColorStop(.5,'#182d32');handle.addColorStop(1,'#0d1e24');
   context.fillStyle=handle;context.strokeStyle='#baa475';context.lineWidth=1;
   context.beginPath();context.roundRect(start-handleLength-8,y-8,handleLength,16,4);context.fill();context.stroke();
   context.strokeStyle='#9c8a65';
   for(let index=0;index<6;index++){
    const x=start-handleLength+index*handleLength/7;context.beginPath();context.moveTo(x-3,y-7);context.lineTo(x+4,y+7);context.stroke();
   }
   context.fillStyle=stage===3?'#cbb879':'#6e7b73';context.strokeStyle='#e5d4a1';
   context.beginPath();context.moveTo(start-7,y-guardHeight);context.lineTo(start+6,y-guardHeight*.86);
   context.lineTo(start+4,y+guardHeight*.86);context.lineTo(start-7,y+guardHeight);context.closePath();context.fill();context.stroke();
   context.fillStyle='#84928b';context.beginPath();context.ellipse(start-handleLength-11,y,5,11,0,0,Math.PI*2);context.fill();
  }else if(stage===1){
   context.fillStyle='#3e4845';context.beginPath();context.moveTo(start-40,y-6);context.lineTo(start,y-8);context.lineTo(start,y+8);context.lineTo(start-40,y+5);context.closePath();context.fill();
  }
 };
 if(broken){
  context.save();context.beginPath();context.rect(0,0,fracture-3,height);context.clip();draw();context.restore();
  context.save();context.translate(fracture+13,y+10);context.rotate(.065);context.translate(-fracture,-y);
  context.beginPath();context.rect(fracture+4,0,width,height);context.clip();draw();context.restore();
 }else draw();
 context.restore();
}
