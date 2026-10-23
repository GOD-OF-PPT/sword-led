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
interface Playing {
 readonly token:number;readonly before:RunView;readonly after:RunView;readonly event:ForgeEvent|null;
 readonly callbacks:{contact():void;done():void};readonly afterBlade:Blade|null;
 readonly point:{readonly x:number;readonly y:number};
 contacted:boolean;
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
 const animations=new Set<Animation>();
 const swordArt=new Image(),stamp=document.createElement('canvas');
 let artState:'loading'|'ready'|'failed'='loading',artGeneration=0;
 const swordFrames=SWORD_ART.frames;
 let disposed=false,epoch=0,watchFrame:number|null=null,latest:RunView|null=null,visual:Blade|null=null;
 let playing:Playing|null=null,pointer:StrikePoint|null=null,geometry:Geometry|null=null;

 function animate(node:HTMLElement,frames:Keyframe[],duration:number,easing='ease-out'){
  if(disposed||host.reduced()||typeof node.animate!=='function')return;
  const animation=node.animate(frames,{duration,easing,fill:'none'});animations.add(animation);
  void animation.finished.then(()=>animations.delete(animation),()=>animations.delete(animation));
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
  sparks.replaceChildren();hammer.classList.remove('preparing');
  canvas.style.transform='';scene.removeAttribute('data-impact');scene.removeAttribute('data-playing');
  impact.style.opacity='';impact.style.transform='';
 }
 function cancelInternal(notify:boolean){
  const hadPlay=playing!==null;
  epoch++;playing=null;clearTransient();pointer=null;
  visual=latest?.activePiece??null;paint();
  if(notify&&hadPlay)host.cancelled?.();
 }
 function finish(own:Playing){
  if(disposed||playing!==own||own.token!==epoch)return;
  playing=null;clearTransient();visual=own.after.activePiece;paint();
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
  own.contacted=true;visual=own.afterBlade;paint();
  if(own.event)feedback(own.event);
  own.callbacks.contact();
 }
 function watch(own:Playing){
  watchFrame=null;
  if(disposed||playing!==own||own.token!==epoch)return;
  if(document.hidden||host.reduced()){cancelInternal(true);return;}
  if(own.contacted&&hammer.dataset.phase==='idle'){finish(own);return;}
  watchFrame=requestAnimationFrame(()=>watch(own));
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
   // A session publication can update facts while the Accepted old blade still owns contact.
   if(!playing){visual=view.activePiece;paint();}
  },
  play(events,before,after,callbacks){
   if(disposed)return;
   const aim=pointer;cancelInternal(false);pointer=aim;latest=after;
   const event=events.find((value):value is ForgeEvent=>value.type==='Forged')??null;
   const beforeBlade=event?before.blades.find(blade=>blade.id===event.pieceId)??null:before.activePiece;
   const afterBlade=event?after.blades.find(blade=>blade.id===event.pieceId)??null:after.activePiece;
   const own:Playing={token:++epoch,before,after,event,afterBlade,callbacks,point:projectPoint(beforeBlade,afterBlade),contacted:false};
   playing=own;visual=beforeBlade;scene.dataset.playing=event?'forge':'change';paint();
   if(document.hidden||!measure()){cancelInternal(true);return;}
   if(!event||host.reduced()){
    touch(own);queueMicrotask(()=>{if(playing===own&&own.token===epoch)finish(own);});return;
   }
   positionHammer();motion.strike(event.technique,()=>touch(own));
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
function paintIllustratedSword(context:CanvasRenderingContext2D,stamp:HTMLCanvasElement,image:HTMLImageElement,frame:SwordFrame,blade:Blade,width:number,height:number,techniqueUsed:boolean){
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
  ink.fillStyle=`rgba(16,34,39,${Math.min(.5,wear*.075)})`;ink.fillRect(0,0,frame.width,frame.height);
  ink.strokeStyle='#d4b98c99';ink.lineWidth=Math.max(1,frame.height*.01);
  for(let index=0;index<wear*2;index++){
   const x=bodyStart+(bodyEnd-bodyStart)*(.2+index%7*.09);
   ink.beginPath();ink.moveTo(x,axis-frame.height*.15);ink.lineTo(x+frame.width*.014,axis-frame.height*.04);ink.stroke();
  }
 }
 ink.restore();
 context.save();context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
 context.fillStyle='#05121969';context.filter='blur(6px)';context.beginPath();
 context.ellipse(left+drawnWidth*.53,height*.56+Math.max(10,drawnHeight*.16),drawnWidth*.47,Math.max(5,drawnHeight*.10),0,0,Math.PI*2);context.fill();
 context.filter='none';context.shadowColor='#0009';context.shadowBlur=5;context.shadowOffsetY=4;
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
