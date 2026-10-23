import type {DomainEvent,TargetId} from '../core-v7/model.js';
import type {RunView,TargetView,WeaponView} from '../core-v7/view.js';
import {createHammerMotion,HAMMER_ART} from '../presentation-v3/hammer.js';
import {SWORD_ART} from '../presentation-v6/sword-art.js';

interface SceneOptions {
 readonly reduced:()=>boolean;
 readonly onForge:(point:{x:number;y:number})=>void;
 readonly onStrike:(targetId:TargetId)=>void;
}
interface Particle {x:number;y:number;vx:number;vy:number;life:number;color:string;size:number;angle:number}
type Motion='forge'|'strike'|'followUp'|'guard'|'pressure'|'warm'|'donate'|'change';
interface Playback {
 readonly epoch:number;readonly events:readonly DomainEvent[];readonly before:RunView;readonly after:RunView;
 readonly mode:Motion;readonly start:number;readonly duration:number;readonly contactAt:number;
 readonly weaponId:string|null;readonly targetId:TargetId|null;readonly forgeX:number;readonly contact:()=>void;readonly resolve:()=>void;
 contacted:boolean;contactTime:number|null;
}
type SwordFrame=typeof SWORD_ART.frames[number];
interface SwordPose {left:number;axis:number;width:number;height:number;angle:number}

const SCENE_STYLE=`
.scene7{position:absolute;inset:0;isolation:isolate;pointer-events:none;overflow:hidden;--scene7-ink:#f5ebcb;--scene7-warm:#eac18b}
.scene7 canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:4}
.scene7-anvil{display:none}
.scene7-anvil[hidden],.scene7-hammer[hidden],.scene7-forge[hidden]{display:none}
.scene7-forge{position:absolute;left:26%;top:57%;width:54%;height:15%;min-height:56px;border:0;background:transparent;color:var(--scene7-ink);cursor:crosshair;pointer-events:auto;z-index:5;border-radius:50%}
.scene7-forge:focus-visible{outline:2px solid #ffe5a3;outline-offset:5px;background:#fff0b511}
.scene7-forge:disabled{cursor:default}
.scene7-forge span{position:absolute;top:100%;left:50%;transform:translateX(-50%);white-space:nowrap;font-family:inherit;font-size:12px;font-weight:500;line-height:1.5;letter-spacing:.1em;text-shadow:0 2px 8px #000,0 0 18px #000;opacity:.88}
.scene7-hammer{position:absolute;aspect-ratio:1.5;pointer-events:none;transform:rotate(8deg);transform-origin:89.84375% 50.29297%;z-index:6;filter:drop-shadow(0 13px 9px #0006);will-change:transform}
.scene7-hammer img{display:block;width:100%;height:100%;object-fit:contain}
.scene7-targets{position:absolute;inset:0;z-index:3;pointer-events:none}
.scene7-target{position:absolute;left:70%;top:43%;width:clamp(140px,17vw,230px);transform:translate(-50%,-50%);background:transparent;border:0;padding:0;color:var(--scene7-ink);text-align:center;pointer-events:auto;cursor:crosshair;min-width:44px;min-height:44px;font:inherit;filter:drop-shadow(0 9px 10px #0008)}
.scene7-target:focus-visible{outline:2px solid #ffe3a0;outline-offset:8px;border-radius:20px}
.scene7-target:disabled{cursor:default}
.scene7-target-art{display:block;height:clamp(122px,26vh,240px);width:100%;transform-origin:50% 86%;transition:filter .15s}
.scene7-target-art>img,.scene7-target-art>svg{display:block;width:100%;height:100%;object-fit:contain;overflow:visible}
.scene7-target:hover:not(:disabled) .scene7-target-art{filter:drop-shadow(0 0 8px #f3d19b88)}
.scene7-target[data-dead=true] .scene7-target-art{transform:translate(14px,20px) rotate(64deg) scale(.73);opacity:.3}
.scene7-target[data-mechanism=true][data-dead=true] .scene7-target-art{transform:translate(0,13px) rotate(13deg) scale(.86);opacity:.34}
.scene7-target-copy{display:block;position:relative;background:linear-gradient(90deg,transparent,#091519df 16%,#091519df 84%,transparent);padding:7px 8px 9px;text-shadow:0 2px 4px #000}
.scene7-target-copy>b{display:block;font-size:19px;letter-spacing:.08em}.scene7-health{display:block;font-size:14px;color:#eddfbc;margin-top:4px}
.scene7-hp-track{display:block;max-width:145px;margin:5px auto;background:#030c11c9;border:1px solid #bc9a5355;height:4px;border-radius:2px;overflow:hidden}
.scene7-hp-fill{display:block;height:100%;background:linear-gradient(90deg,#916e42,#dfbe76);width:100%}
.scene7-target-copy small{display:block;font-size:14px;line-height:1.6;color:#d9d7cb}.scene7-target-copy em{font-family:inherit;font-size:14px;font-style:normal;line-height:1.5;color:#f1bdb0;display:block;margin-top:3px}
.scene7-target:not(:hover):not(:focus-visible) .scene7-preview,.scene7-target:not(:hover):not(:focus-visible) em{display:none}
.scene7-target[data-dead=true] .scene7-target-copy{opacity:.67}.scene7-target[data-blocked=true]:not([data-dead=true]) .scene7-target-art{filter:saturate(.45) brightness(.78)}
.scene7-empty{position:absolute;left:21%;top:79%;color:#c9c8ba;font-size:12px;letter-spacing:.1em;text-shadow:0 2px 8px #000;z-index:2}
.scene7-message{position:absolute;left:50%;top:36%;transform:translate(-50%,-50%);color:#ffedbf;text-align:center;white-space:pre-line;font-size:clamp(17px,2vw,26px);letter-spacing:.1em;line-height:1.7;text-shadow:0 3px 10px #000;z-index:7;pointer-events:none;opacity:0}
.scene7-fade{position:absolute;inset:0;background:#031014;z-index:8;opacity:0;pointer-events:none}
.scene7-sigil{position:absolute;left:20%;top:79%;color:#d5d2bb;font-size:11px;letter-spacing:.1em;z-index:2;text-shadow:0 2px 6px #000}
@media(max-width:760px){.scene7-target{width:clamp(116px,25vw,170px);top:42%}.scene7-target-art{height:clamp(120px,24vh,195px)}.scene7-target-copy>b{font-size:13px}.scene7-target-copy small,.scene7-target-copy em{font-size:10px}.scene7-target-copy{padding:5px 5px 7px}.scene7-anvil{width:58vw}.scene7-forge{left:14%;width:74%;top:57%}.scene7-forge span{font-size:10px;letter-spacing:.03em}.scene7-sigil{left:13%;top:78%}.scene7-empty{left:13%;top:79%}}
@media(max-height:600px){.scene7-target{top:46%}.scene7-target-art{height:25vh;min-height:95px}.scene7-target-copy small{line-height:1.4}.scene7-target-copy{padding:4px}.scene7-sigil{top:82%}.scene7-forge span{top:90%}}
@media(prefers-reduced-motion:reduce){.scene7-target-art{transition:none}}
`;

/** Visual projection only. Supplied view and event facts are the sole rules authority. */
export function createCampaignScene(host:HTMLElement,options:SceneOptions):{
 render(view:RunView):void;
 play(events:readonly DomainEvent[],before:RunView,after:RunView,contact:()=>void):Promise<void>;
 cancel():void;dispose():void;
}{
 const root=document.createElement('div');root.className='scene7';root.setAttribute('aria-label','炉台与道路实体');
 const style=document.createElement('style');style.textContent=SCENE_STYLE;
 const anvil=document.createElement('div');anvil.className='scene7-anvil';anvil.setAttribute('aria-hidden','true');anvil.innerHTML=anvilArt();
 const canvas=document.createElement('canvas');canvas.dataset.scene7Blade='';canvas.setAttribute('role','img');
 const targets=document.createElement('div');targets.className='scene7-targets';
 const forge=document.createElement('button');forge.type='button';forge.className='scene7-forge';forge.dataset.scene7Forge='';forge.innerHTML='<span>落下普通锤 · 点击剑面，或 Enter / 空格</span>';
 const hammer=document.createElement('div');hammer.className='scene7-hammer';hammer.setAttribute('aria-hidden','true');
 const hammerImage=new Image();hammerImage.src='/assets/d/hammer-forge-v2.webp';hammerImage.alt='';hammer.append(hammerImage);
 const empty=document.createElement('span');empty.className='scene7-empty';empty.textContent='手中无剑 · 可从剑架换手，或开炉锻造';
 const sigil=document.createElement('span');sigil.className='scene7-sigil';
 const message=document.createElement('div');message.className='scene7-message';message.setAttribute('aria-hidden','true');
 const fade=document.createElement('div');fade.className='scene7-fade';
 root.append(style,anvil,targets,canvas,forge,hammer,empty,sigil,message,fade);host.append(root);
 const context=canvas.getContext('2d'),stamp=document.createElement('canvas'),swordArt=new Image();
 const animations=new Set<Animation>(),targetNodes=new Map<TargetId,HTMLButtonElement>();
 let artReady=false,disposed=false,epoch=0,latest:RunView|null=null,visual:RunView|null=null,active:Playback|null=null;
 let frame:number|null=null,width=0,height=0,ratio=1,aimX=.58,lastTime=0;
 let particles:Particle[]=[];
 const animate=(node:HTMLElement,frames:Keyframe[],ms:number,easing='ease-out'):void=>{
  if(disposed||options.reduced()||typeof node.animate!=='function')return;
  const a=node.animate(frames,{duration:ms,easing});animations.add(a);
  void a.finished.then(()=>animations.delete(a),()=>animations.delete(a));
 };
 const hammerMotion=createHammerMotion(hammer,options.reduced,animate);
 function currentWeapon(view:RunView):WeaponView|null{return view.phase==='forging'?view.forge?.weapon??null:view.slots.hand;}
 function findWeapon(view:RunView,id:string|null):WeaponView|null{return id===null?null:view.works.find(w=>w.id===id)??null;}
 function liveWeapon():WeaponView|null{
  if(active?.weaponId){return findWeapon(active.contacted?active.after:active.before,active.weaponId)??findWeapon(active.before,active.weaponId);}
  return visual?currentWeapon(visual):null;
 }
 function setGeometry():void{
  const rect=root.getBoundingClientRect();width=rect.width;height=rect.height;ratio=Math.min(2,window.devicePixelRatio||1);
  const w=Math.max(1,Math.round(width*ratio)),h=Math.max(1,Math.round(height*ratio));
  if(canvas.width!==w)canvas.width=w;if(canvas.height!==h)canvas.height=h;
  placeHammer();
 }
 function pose(weapon:WeaponView,view:RunView):SwordPose{
  const stage=stageOf(weapon),f=SWORD_ART.frames[stage],forging=view.phase==='forging';
  const screenFactor=width<760?(forging?.76:.65):(forging?.59:.53);
  const drawnWidth=Math.min(width*screenFactor,forging?840:700),drawnHeight=drawnWidth*f.height/f.width;
  return{left:forging?(width-drawnWidth)/2:width*.075,axis:height*(forging?.64:.80),width:drawnWidth,height:drawnHeight,angle:forging?0:-.10};
 }
 function projectedAim():number{
  const blade=visual?currentWeapon(visual):null;
  if(!blade)return width*.58;
  const p=pose(blade,visual!),f=SWORD_ART.frames[stageOf(blade)];
  return Math.max(p.left+p.width*(f.bodyStart+.12),Math.min(p.left+p.width*(f.bodyEnd-.09),aimX*width));
 }
 function placeHammer():void{
  const hammerWidth=Math.min(690,Math.max(250,width*(width<760?.77:.56))),x=projectedAim(),y=height*.64;
  hammer.style.width=`${hammerWidth}px`;hammer.style.left=`${x-hammerWidth*HAMMER_ART.face.x/HAMMER_ART.width}px`;
  hammer.style.top=`${y-hammerWidth*HAMMER_ART.face.y/HAMMER_ART.width}px`;
 }
 function syncTargets(view:RunView):void{
  const shown=view.phase==='encounter'?view.encounter?.targets??[]:[];
  for(const [id,node]of targetNodes)if(!shown.some(t=>t.id===id)){node.remove();targetNodes.delete(id);}
  shown.forEach((target,index)=>{
   let node=targetNodes.get(target.id);
   if(!node){
    node=document.createElement('button');node.type='button';node.className='scene7-target';node.dataset.scene7Target=target.id;
    const art=document.createElement('span');art.className='scene7-target-art';art.setAttribute('aria-hidden','true');
    if(target.asset){const image=new Image();image.src=target.asset;image.alt='';image.draggable=false;art.append(image);}
    else art.innerHTML=targetArt(target.id);
    const copy=document.createElement('span');copy.className='scene7-target-copy';copy.innerHTML='<b></b><span class="scene7-health"></span><span class="scene7-hp-track"><span class="scene7-hp-fill"></span></span><small></small><small class="scene7-preview"></small><em></em>';
    node.append(art,copy);const id=target.id;
    node.addEventListener('click',()=>{if(!active&&!disposed&&latest?.phase==='encounter'&&latest.encounter?.targets.find(t=>t.id===id)?.strike.allowed)options.onStrike(id);});
    targetNodes.set(target.id,node);targets.append(node);
   }
   const multiple=shown.length>1;
   const x=multiple?(width<760?[.49,.73][index]??.61:[.49,.67][index]??.61):.61;
   node.style.left=`${x*100}%`;node.style.top=`${multiple?(index%2===0?43:49):43}%`;
   node.dataset.dead=String(target.health===0);node.dataset.mechanism=String(target.role==='mechanism');node.dataset.blocked=String(!target.strike.allowed);
   node.disabled=!!active||!target.strike.allowed;
   node.querySelector('b')!.textContent=target.name;
   node.querySelector('.scene7-health')!.textContent=`耐久 ${target.health} / ${target.maxHealth} · 甲 ${target.armor}`;
   (node.querySelector('.scene7-hp-fill') as HTMLElement).style.width=`${target.health/Math.max(1,target.maxHealth)*100}%`;
   node.querySelector('small')!.textContent=target.intent;
   const preview=target.preview;
   node.querySelector('.scene7-preview')!.textContent=target.health===0?'道路已打开':preview?`本剑伤害 ${preview.damage} · 磨损 ${preview.wear} · 强度 ${preview.strengthBefore}→${preview.strengthAfter}${preview.breaksWeapon?'，本击后剑断':''}`:'手中没有可用剑';
   node.querySelector('em')!.textContent=target.health===0?'':target.blockedReason??'';
   node.setAttribute('aria-label',`${target.name}，耐久${target.health}/${target.maxHealth}，甲${target.armor}。${target.intent}。${target.strike.detail}${target.blockedReason?'。'+target.blockedReason:''}`);
  });
 }
 function sync(view:RunView):void{
  const forging=view.phase==='forging',blade=currentWeapon(view);
  root.dataset.phase=view.phase;root.dataset.node=String(view.node);root.dataset.chapter=String(view.chapter);
  anvil.hidden=!forging;hammer.hidden=!forging;forge.hidden=!forging;
  const ordinary=view.actions.find(a=>a.action.type==='forge'&&a.action.kind==='ordinary');
  forge.disabled=!!active||!ordinary?.allowed;forge.setAttribute('aria-label',ordinary?`${ordinary.label}。${ordinary.detail}${ordinary.reason?'。'+ordinary.reason:''}`:'当前不能落锤');
  forge.querySelector('span')!.textContent=ordinary?.allowed?'落下普通锤 · 点击剑面，或 Enter / 空格':ordinary?.reason??'请先开炉';
  empty.hidden=forging||view.phase==='choice'||view.phase==='failed'||view.phase==='ending'||!!blade;
  sigil.hidden=forging||!blade||view.phase==='ending';
  sigil.textContent=blade?`${blade.name} · 强度 ${blade.strength} / ${blade.sealedStrength??blade.strength}${blade.fissureMarked?' · 真正崩纹':blade.cracked?' · 意外裂纹':''}`:'';
  syncTargets(view);placeHammer();
 }
 function targetPoint(id:TargetId|null):{x:number;y:number}{
  const node=id?targetNodes.get(id):targetNodes.values().next().value;
  if(node){const r=node.querySelector('.scene7-target-art')!.getBoundingClientRect(),base=root.getBoundingClientRect();return{x:r.left-base.left+r.width*.52,y:r.top-base.top+r.height*.48};}
  return{x:width*.68,y:height*.46};
 }
 function paintSword(weapon:WeaponView,view:RunView,now:number):void{
  if(!context)return;
  const f=SWORD_ART.frames[stageOf(weapon)],p=pose(weapon,view),play=active;
  let pivotX=p.left+p.width*.10,pivotY=p.axis,angle=p.angle,opacity=1;
  if(play&&play.mode!=='forge'&&play.weaponId){
   const elapsed=now-play.start,t=elapsed/play.contactAt,returnT=play.contacted?Math.min(1,(now-(play.contactTime??now))/Math.max(1,play.duration-play.contactAt)):0;
   if(play.mode==='strike'){
    const target=targetPoint(play.targetId),contactAngle=-.42,metal=p.width*.65;
    const tx=target.x-Math.cos(contactAngle)*metal,ty=target.y-Math.sin(contactAngle)*metal;
    if(!play.contacted){const approach=ease(Math.min(1,t));pivotX=lerp(pivotX,tx,approach);pivotY=lerp(pivotY,ty,approach);angle=t<.45?lerp(p.angle,-1.12,t/.45):lerp(-1.12,contactAngle,(t-.45)/.55);}
    else{pivotX=lerp(tx,pivotX,ease(returnT));pivotY=lerp(ty,pivotY,ease(returnT));angle=lerp(contactAngle,p.angle,ease(returnT));}
   }else if(play.mode==='guard')angle=lerp(p.angle,-.85,play.contacted?1-ease(returnT):ease(Math.min(1,t)));
   else if(play.mode==='donate'){
    const amount=ease(Math.min(1,elapsed/play.duration));pivotX=lerp(pivotX,width*.68,amount);pivotY=lerp(pivotY,height*.46,amount);angle=lerp(p.angle,-.85,amount);opacity=1-Math.max(0,(amount-.65)/.35);
   }
  }
  context.save();context.globalAlpha=opacity;context.translate(pivotX,pivotY);context.rotate(angle);context.translate(-p.width*.10,-f.axisY*p.height);
  if(artReady){
   stamp.width=f.width;stamp.height=f.height;const ink=stamp.getContext('2d');
   if(ink){
    ink.clearRect(0,0,f.width,f.height);ink.drawImage(swordArt,f.x,f.y,f.width,f.height,0,0,f.width,f.height);ink.save();ink.globalCompositeOperation='source-atop';
    decorateBlade(ink,f,weapon);ink.restore();
    context.shadowColor='#02080dcc';context.shadowBlur=8;context.shadowOffsetY=6;
    if(weapon.status==='broken'){
     const split=p.width*.58,drop=play?.contactTime?Math.min(1,(now-play.contactTime)/260):1;
     context.save();context.beginPath();context.rect(-4,-20,split-2,p.height+50);context.clip();context.drawImage(stamp,0,0,p.width,p.height);context.restore();
     context.save();context.translate(split+12*drop,p.height*.5+16*drop);context.rotate(.12*drop);context.translate(-split,-p.height*.5);context.beginPath();context.rect(split+3,-20,p.width,p.height+50);context.clip();context.drawImage(stamp,0,0,p.width,p.height);context.restore();
    }else context.drawImage(stamp,0,0,p.width,p.height);
   }
  }else drawNativeSword(context,weapon,p.width,p.height);
  context.restore();
 }
 function draw(now=performance.now()):void{
  if(disposed||!context||width<=0||height<=0)return;
  context.setTransform(ratio,0,0,ratio,0,0);context.clearRect(0,0,width,height);
  const blade=liveWeapon(),view=active?.before??visual;
  if(blade&&view)paintSword(blade,view,now);
  canvas.dataset.weaponId=blade?.id??'';canvas.dataset.strength=String(blade?.strength??0);canvas.dataset.sealedStrength=String(blade?.sealedStrength??0);canvas.dataset.hits=String(blade?.hits??0);
  canvas.dataset.stage=String(blade?stageOf(blade):0);canvas.dataset.condition=blade?.status==='broken'?'broken':blade?.fissureMarked?'fissure':blade?.cracked?'cracked':'intact';canvas.dataset.art=artReady?'atlas':'native';
  canvas.setAttribute('aria-label',blade?`${blade.name}，强度${blade.strength}，原收锻强度${blade.sealedStrength??blade.strength}，${blade.hits}锤，${blade.status==='broken'?'已经断裂':blade.fissureMarked?'真正崩纹':blade.cracked?'意外裂纹':'完好'}。`:'当前没有手中剑');
  const play=active;
  if(play){
   const elapsed=now-play.start,progress=Math.min(1,elapsed/play.duration),afterContact=play.contactTime===null?0:now-play.contactTime;
   if(play.mode==='strike'&&play.contacted){
    const point=targetPoint(play.targetId),alpha=Math.max(0,1-afterContact/220);
    context.save();context.globalAlpha=alpha;context.strokeStyle='#fff0bf';context.shadowColor='#eecf83';context.shadowBlur=18;context.lineWidth=3;context.beginPath();context.ellipse(point.x-8,point.y-4,Math.min(width*.16,160),height*.11,-.48,-1.7,1.1);context.stroke();context.restore();
   }
   if(play.mode==='followUp'){
    const p=targetPoint(play.targetId),t=Math.min(1,elapsed/play.contactAt);context.save();context.globalAlpha=play.contacted?Math.max(0,1-afterContact/300):t;
    context.strokeStyle='#f1cf81';context.lineWidth=3;context.shadowColor='#f0cd76';context.shadowBlur=14;context.beginPath();context.moveTo(width*.19,height*.72);context.quadraticCurveTo(width*.50,height*.25,lerp(width*.19,p.x,t),lerp(height*.72,p.y,t));context.stroke();context.restore();
   }
   if(play.mode==='guard'||play.events.some(e=>e.type==='MechanismUsed'&&e.mechanism==='brace-assist')){
    context.save();context.globalAlpha=Math.sin(progress*Math.PI)*.8;context.strokeStyle='#b4dedb';context.lineWidth=5;context.shadowColor='#91cacd';context.shadowBlur=17;context.beginPath();context.ellipse(width*.39,height*.73,width*.21,height*.30,-.15,-2.9,-.25);context.stroke();context.restore();
   }
   if(play.mode==='warm'){
    context.save();context.globalAlpha=Math.sin(progress*Math.PI)*.75;context.strokeStyle='#f6c781';context.lineWidth=3;context.shadowColor='#f6b35e';context.shadowBlur=20;context.beginPath();context.ellipse(width*.31,height*.76,width*.17,height*.10,0,0,Math.PI*2);context.stroke();context.restore();
   }
   if(play.mode==='pressure'){
    const event=play.events.find(e=>e.type==='RoundEnded');
    if(event?.type==='RoundEnded'){
     context.save();context.globalAlpha=Math.sin(progress*Math.PI)*.38;const warm=play.before.chapter===1?'#cf8c50':'#b8dae4';context.strokeStyle=warm;context.lineWidth=2;
     for(let i=0;i<16;i++){const y=height*(.2+(i*.047)% .65),x=width*((i*.173+progress*.75)%1);context.beginPath();context.moveTo(x,y);context.lineTo(x+width*.15,y-height*.045);context.stroke();}
     const light=lerp(event.before,event.after,progress),radius=height*(.12+light*.021);const glow=context.createRadialGradient(width*.19,height*.74,0,width*.19,height*.74,radius);glow.addColorStop(0,'#f3b75b70');glow.addColorStop(1,'#f3b75b00');context.fillStyle=glow;context.beginPath();context.arc(width*.19,height*.74,radius,0,Math.PI*2);context.fill();context.restore();
    }
   }
  }
  const delta=Math.min(.05,Math.max(0,(now-lastTime)/1000));lastTime=now;
  particles=particles.filter(p=>p.life>0);
  for(const p of particles){p.life-=delta;p.x+=p.vx*delta;p.y+=p.vy*delta;p.vy+=190*delta;p.angle+=delta*3;
   context.save();context.globalAlpha=Math.max(0,Math.min(1,p.life*3));context.translate(p.x,p.y);context.rotate(p.angle);context.fillStyle=p.color;context.fillRect(-p.size/2,-p.size/2,p.size,p.size*1.8);context.restore();
  }
 }
 function spark(x:number,y:number,bad=false,gold=false):void{
  if(options.reduced())return;
  const count=bad?34:24;
  for(let i=0;i<count&&particles.length<120;i++){
   const angle=-Math.PI+(i/(count-1))*Math.PI,speed=65+(i*31%145);
   particles.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-25,life:.35+(i%4)*.06,color:bad?'#d68e72':gold?'#f9dc8d':i%3?'#f4bb67':'#fff3bd',size:bad?3+i%3:1.5+i%2,angle:i});
  }
 }
 function announce(text:string,bad=false):void{
  message.textContent=text;message.style.color=bad?'#f4c1ae':'#ffedbf';
  if(options.reduced()){message.style.opacity='1';return;}
  animate(message,[{opacity:0,transform:'translate(-50%,-40%)'},{opacity:1,transform:'translate(-50%,-50%)',offset:.16},{opacity:1,offset:.70},{opacity:0,transform:'translate(-50%,-62%)'}],600);
 }
 function touched(play:Playback):void{
  if(disposed||active!==play||play.epoch!==epoch||play.contacted)return;
  play.contacted=true;play.contactTime=performance.now();visual=play.after;
  // Entity identity survives a lethal contact even when the accepted hand slot is now empty.
  const selected=play.after.encounter?.targets??[];
  for(const target of play.before.encounter?.targets??[]){
   const after=selected.find(t=>t.id===target.id);
   if(after){patchTarget(after);}else if(play.events.some(e=>e.type==='Struck'&&e.targetId===target.id&&e.after===0))patchTarget({...target,health:0});
  }
  const forged=play.events.find(e=>e.type==='Forged'),struck=play.events.find(e=>e.type==='Struck');
  if(forged?.type==='Forged'){
   const broken=forged.result==='broken',bad=broken||forged.result==='crack';spark(play.forgeX,height*.64,bad,forged.kind!=='ordinary');
   announce(broken?'剑身断了':forged.result==='crack'?`意外裂纹 · 强度 ${forged.before}→${forged.after}`:forged.result==='fissure'?`崩纹贯身 · 强度 ${forged.before}→${forged.after}`:forged.result==='steady'?`定线成形 · 强度 ${forged.before}→${forged.after}`:`落锤 · 强度 ${forged.before}→${forged.after}`,bad);
   animate(anvil,[{transform:'translate(-50%,-7%)'},{transform:'translate(-50%,calc(-7% + 3px))',offset:.20},{transform:'translate(-50%,-7%)'}],160);
  }
  if(struck?.type==='Struck'){
   const point=targetPoint(struck.targetId);spark(point.x,point.y,struck.after===0,struck.source==='followUp');
   const label=struck.source==='followUp'?`余力追斩 ${struck.damage}`:`斩击 ${struck.damage}${struck.strengthBefore!==null&&struck.strengthAfter!==null?` · 剑 ${struck.strengthBefore}→${struck.strengthAfter}`:''}`;
   announce(`${label}${struck.after===0?'\n道路破开':''}`,false);
   const node=targetNodes.get(struck.targetId)?.querySelector<HTMLElement>('.scene7-target-art');
   if(node)animate(node,struck.after===0?[{transform:'translate(0,0)',opacity:1},{transform:'translate(18px,22px) rotate(64deg) scale(.73)',opacity:.3}]:[{transform:'translate(0,0)'},{transform:'translate(9px,-2px) rotate(3deg)',offset:.2},{transform:'translate(0,0)'}],struck.after===0?360:170);
  }
  const pressure=play.events.find(e=>e.type==='RoundEnded');if(pressure?.type==='RoundEnded')announce(`这一轮，灯火 ${pressure.before}→${pressure.after}${pressure.loss?'':' · 护住了'}`,pressure.loss>0);
  const temper=play.events.find(e=>e.type==='Tempered');if(temper?.type==='Tempered')announce(`续炉 · 强度 ${temper.before}→${temper.after}${temper.crackCleared?'\n意外裂纹已修复':''}`);
  if(play.events.some(e=>e.type==='Guarded'))announce(play.after.encounter?.braced?'母灯已架稳':'架剑 · 护弧张开');
  if(play.events.some(e=>e.type==='Recharged'))spark(width*.25,height*.70,false,true);
  if(play.mode==='change'){
   const chapter=play.events.find(e=>e.type==='ChapterStarted');
   if(chapter?.type==='ChapterStarted')announce(`第${chapter.chapter}章\n${play.after.chapterTitle}`);
  }
  play.contact();draw();
 }
 function patchTarget(target:TargetView):void{
  const node=targetNodes.get(target.id);if(!node)return;
  node.dataset.dead=String(target.health===0);node.disabled=true;
  node.querySelector('.scene7-health')!.textContent=`耐久 ${target.health} / ${target.maxHealth} · 甲 ${target.armor}`;
  (node.querySelector('.scene7-hp-fill') as HTMLElement).style.width=`${target.health/Math.max(1,target.maxHealth)*100}%`;
  node.querySelector('small')!.textContent=target.health===0?'已完成':target.intent;
 }
 function finish(play:Playback):void{
  if(active!==play)return;active=null;latest=play.after;visual=play.after;clearMotion();sync(play.after);draw();play.resolve();
 }
 function tick(now:number):void{
  frame=null;const play=active;if(disposed||!play)return;
  if(document.hidden){cancel();return;}
  if(options.reduced()){touched(play);finish(play);return;}
  if(!play.contacted&&play.mode!=='forge'&&now-play.start>=play.contactAt)touched(play);
  if(active!==play)return;
  const elapsed=now-play.start;
  // Hammer contact owns its physical face landing. A hidden tab is cancelled, never advanced.
  if(play.contacted&&elapsed>=play.duration){finish(play);return;}
  draw(now);frame=requestAnimationFrame(tick);
 }
 function clearMotion():void{
  hammerMotion.reset();if(frame!==null)cancelAnimationFrame(frame);frame=null;
  for(const a of animations)a.cancel();animations.clear();particles=[];message.style.opacity='0';fade.style.opacity='0';root.removeAttribute('data-playing');
 }
 function cancel():void{
  epoch++;const old=active;active=null;clearMotion();
  if(latest){visual=latest;sync(latest);}draw();old?.resolve();
 }
 function resized():void{
  if(disposed)return;const rect=root.getBoundingClientRect();
  if(active&&(Math.abs(rect.width-width)>1||Math.abs(rect.height-height)>1))cancel();
  setGeometry();if(visual)syncTargets(visual);draw();
 }
 const resize=typeof ResizeObserver==='undefined'?null:new ResizeObserver(resized);resize?.observe(root);window.addEventListener('resize',resized);
 const visibility=():void=>{if(document.hidden)cancel();};document.addEventListener('visibilitychange',visibility);
 const loaded=():void=>{if(disposed)return;artReady=swordArt.naturalWidth===SWORD_ART.width&&swordArt.naturalHeight===SWORD_ART.height;draw();};
 swordArt.addEventListener('load',loaded);swordArt.src=SWORD_ART.src;
 const forgeClick=(event:MouseEvent):void=>{
  if(disposed||active||latest?.phase!=='forging'||forge.disabled)return;
  const rect=root.getBoundingClientRect();if(event.detail!==0)aimX=Math.max(0,Math.min(1,(event.clientX-rect.left)/Math.max(1,rect.width)));
  else aimX=.58;placeHammer();options.onForge({x:projectedAim()/Math.max(1,width),y:.64});
 };
 forge.addEventListener('click',forgeClick);setGeometry();
 return{
  render(view){if(disposed)return;latest=view;if(active)return;visual=view;sync(view);draw();},
  play(events,before,after,contact){
   if(disposed)return Promise.resolve();cancel();latest=before;visual=before;sync(before);
   const forged=events.find(e=>e.type==='Forged'),struck=events.find(e=>e.type==='Struck'),donated=events.find(e=>e.type==='Donated');
   const cut=events.some(e=>e.type==='MechanismUsed'&&(e.mechanism==='bridge-rope'||e.mechanism==='south-rope'||e.mechanism==='relay-rope'));
   const mode:Motion=forged?'forge':struck?(struck.source==='followUp'?'followUp':'strike'):events.some(e=>e.type==='Guarded')?'guard':events.some(e=>e.type==='RoundEnded')?'pressure':donated?'donate':events.some(e=>e.type==='Tempered'||e.type==='Recharged'||e.type==='ToolChanged'||e.type==='ShopUsed')?'warm':cut?'strike':'change';
   const weaponId=forged?.type==='Forged'?forged.weaponId:struck?.type==='Struck'?struck.weaponId:donated?.type==='Donated'?donated.weaponId:cut?before.slots.hand?.id??null:mode==='guard'?before.slots.hand?.id??null:null;
   const targetId=struck?.type==='Struck'?struck.targetId:null;
   const transition=events.some(e=>e.type==='ChapterStarted'||e.type==='ChoiceMade'||e.type==='EncounterStarted'||e.type==='EndingReached');
   const duration=mode==='forge'?forged?.type==='Forged'&&forged.result==='broken'?650:440:mode==='strike'?680:mode==='pressure'?720:mode==='change'?(transition?620:280):580;
   return new Promise<void>(resolve=>{
    const play:Playback={epoch:++epoch,events,before,after,mode,start:performance.now(),duration,contactAt:mode==='forge'?55:mode==='strike'?235:mode==='followUp'?180:transition?240:120,weaponId,targetId,forgeX:projectedAim(),contact,resolve,contacted:false,contactTime:null};
    active=play;root.dataset.playing=mode;forge.disabled=true;for(const node of targetNodes.values())node.disabled=true;
    if(document.hidden||width<=0||height<=0){cancel();return;}
    if(options.reduced()){touched(play);finish(play);return;}
    if(transition)animate(fade,[{opacity:0},{opacity:.68,offset:.42},{opacity:.68,offset:.65},{opacity:0}],duration,'ease-in-out');
    if(mode==='forge')hammerMotion.strike(forged?.type==='Forged'&&forged.kind!=='ordinary',()=>touched(play));
    lastTime=performance.now();draw();frame=requestAnimationFrame(tick);
   });
  },
  cancel,
  dispose(){if(disposed)return;cancel();disposed=true;resize?.disconnect();window.removeEventListener('resize',resized);document.removeEventListener('visibilitychange',visibility);swordArt.removeEventListener('load',loaded);swordArt.removeAttribute('src');forge.removeEventListener('click',forgeClick);targetNodes.clear();stamp.width=0;stamp.height=0;root.remove();latest=null;visual=null;}
 };
}

function stageOf(weapon:WeaponView):0|1|2|3{
 if(weapon.status!=='forging'&&weapon.sealedStrength!==null)return 3;
 return weapon.hits===0?0:weapon.hits===1?1:weapon.hits<=3?2:3;
}
function lerp(a:number,b:number,t:number):number{return a+(b-a)*Math.max(0,Math.min(1,t));}
function ease(t:number):number{return t*t*(3-2*t);}
function decorateBlade(ink:CanvasRenderingContext2D,f:SwordFrame,w:WeaponView):void{
 const start=f.width*f.bodyStart,end=f.width*f.bodyEnd,axis=f.height*f.axisY;
 if(w.kind==='steady'){
  ink.strokeStyle='#ffe4a6aa';ink.lineWidth=f.height*.025;ink.beginPath();ink.moveTo(start,axis-f.height*.12);ink.lineTo(end-f.width*.09,axis-f.height*.10);ink.lineTo(end,axis);ink.stroke();
 }
 if(w.fissureMarked){
  const x=start+(end-start)*.43;ink.lineCap='round';ink.strokeStyle='#102c31';ink.lineWidth=f.height*.09;ink.beginPath();ink.moveTo(x,0);ink.lineTo(x+f.width*.028,axis*.67);ink.lineTo(x-f.width*.009,axis);ink.lineTo(x+f.width*.035,axis*1.28);ink.lineTo(x+f.width*.018,f.height);ink.stroke();
  ink.strokeStyle='#f5bf77';ink.lineWidth=f.height*.027;ink.stroke();ink.strokeStyle='#ffe1aa';ink.lineWidth=f.height*.013;ink.beginPath();ink.moveTo(x+f.width*.008,axis*.94);ink.lineTo(x+f.width*.12,axis*.35);ink.moveTo(x+f.width*.025,axis*1.16);ink.lineTo(x+f.width*.14,axis*1.7);ink.stroke();
 }
 // The formal cracked flag also marks a true fissure; its own branch supplies that pattern.
 if(w.cracked&&!w.fissureMarked){
  const x=start+(end-start)*.70;ink.strokeStyle='#19282d';ink.lineWidth=f.height*.044;ink.beginPath();ink.moveTo(x,0);ink.lineTo(x-f.width*.018,axis*.60);ink.lineTo(x+f.width*.008,axis*.94);ink.lineTo(x-f.width*.017,f.height);ink.stroke();ink.strokeStyle='#ad6d5b';ink.lineWidth=f.height*.014;ink.stroke();
 }
 const wear=Math.max(0,(w.sealedStrength??w.strength)-w.strength);
 if(wear>0){
  ink.fillStyle=`rgba(17,34,39,${Math.min(.55,wear*.085)})`;ink.fillRect(start,0,end-start,f.height);ink.strokeStyle='#debf8c99';ink.lineWidth=f.height*.012;
  for(let i=0;i<Math.min(20,wear*3);i++){const x=start+(end-start)*(.16+(i*13%65)/100);ink.beginPath();ink.moveTo(x,axis-f.height*.24);ink.lineTo(x+f.width*.018,axis-f.height*.04);ink.stroke();}
 }
}
function drawNativeSword(ctx:CanvasRenderingContext2D,w:WeaponView,width:number,height:number):void{
 const stage=stageOf(w),y=height*.5,body=width*(stage===0?.05:.24),tip=width*.99;
 const gradient=ctx.createLinearGradient(0,0,0,height);gradient.addColorStop(0,stage===0?'#6f6251':'#dce1d4');gradient.addColorStop(.46,stage===0?'#3d423b':'#66878b');gradient.addColorStop(.52,'#c6d1c1');gradient.addColorStop(1,'#304f57');
 ctx.fillStyle=gradient;ctx.strokeStyle='#a4b5ab';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(body,y-height*.18);ctx.lineTo(tip-width*.06,y-height*.17);ctx.lineTo(tip,stage===0?y-height*.13:y);ctx.lineTo(tip-width*.06,y+height*.17);ctx.lineTo(body,y+height*.18);ctx.closePath();ctx.fill();ctx.stroke();
 if(stage>=2){ctx.fillStyle='#1d3338';ctx.strokeStyle='#ab9365';ctx.fillRect(width*.02,y-height*.11,width*.17,height*.22);ctx.strokeRect(width*.02,y-height*.11,width*.17,height*.22);ctx.fillStyle='#b3a176';ctx.fillRect(width*.19,y-height*.40,width*.025,height*.8);ctx.beginPath();ctx.ellipse(width*.018,y,width*.013,height*.19,0,0,Math.PI*2);ctx.fill();}
 if(w.fissureMarked||w.cracked){ctx.strokeStyle=w.fissureMarked?'#f6bb74':'#ad7162';ctx.lineWidth=w.fissureMarked?3:2;ctx.beginPath();ctx.moveTo(width*.56,y-height*.2);ctx.lineTo(width*.59,y);ctx.lineTo(width*.57,y+height*.2);ctx.stroke();}
 if(w.status==='broken'){ctx.clearRect(width*.59,0,width*.015,height);}
}
function anvilArt():string{return `<svg viewBox="0 0 500 275" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="scene7-anvil-steel" x2="0" y2="1"><stop stop-color="#667674"/><stop offset=".25" stop-color="#344c51"/><stop offset="1" stop-color="#10232c"/></linearGradient><linearGradient id="scene7-anvil-log" x2="1" y2="1"><stop stop-color="#4e3b2c"/><stop offset="1" stop-color="#1b2223"/></linearGradient></defs><path d="M123 91 L388 91 376 244 120 247Z" fill="url(#scene7-anvil-log)" stroke="#8a7350" stroke-width="3"/><path d="M135 119l8 103M180 109l-3 124M229 109l10 131M289 106l-7 135M344 107l3 129" stroke="#121b1d" stroke-width="6" opacity=".7"/><path d="M94 238q154 29 299-3l-8 29q-133 21-283-1Z" fill="#12272c" stroke="#7a7761" stroke-width="3"/><path d="M145 15h221l19 30 84 3-16 23-89 16-29 39H180l-18-42-76-12-64-44 123 3Z" fill="url(#scene7-anvil-steel)" stroke="#82918a" stroke-width="3"/><path d="M146 15h219l15 28H145Z" fill="#87938a"/><path d="M180 125h156l22 19H162Z" fill="#1b3036"/><path d="M150 46h201" stroke="#c2c1a0" stroke-width="2" opacity=".6"/></svg>`;}
function targetArt(id:TargetId):string{
 const defs='<defs><linearGradient id="scene7-metal" x2="1" y2="1"><stop stop-color="#8d9a91"/><stop offset=".4" stop-color="#3e5b60"/><stop offset="1" stop-color="#172e39"/></linearGradient><linearGradient id="scene7-wood" x2="1" y2="0"><stop stop-color="#4b3829"/><stop offset=".5" stop-color="#896446"/><stop offset="1" stop-color="#3e3027"/></linearGradient><radialGradient id="scene7-eye"><stop stop-color="#ffe0a0"/><stop offset="1" stop-color="#cf6d3c"/></radialGradient></defs>';
 let body='';
 if(id==='main-rock'||id==='loose-rock')body=`<path d="M27 184 42 93 92 37 157 28 206 80 226 177 188 216 71 216Z" fill="#4f6268" stroke="#adbbb0" stroke-width="3"/><path d="M43 94l59 17-10-73m10 73 55-82m-55 82 49 56 55-87m-55 87 36 49m-36-49-80 48m-29-121 28 121" fill="none" stroke="#223d48" stroke-width="7"/><path d="M50 84 93 39 151 31 115 70Z" fill="#a5b4aa" opacity=".42"/><path d="M42 183h177M74 202h124" stroke="#b6bdad" stroke-width="3" opacity=".3"/>`;
 else if(id==='reverse-wheel')body=`<path d="M79 222 89 153h70l14 69Z" fill="#263e43" stroke="#ab9570" stroke-width="3"/><g fill="url(#scene7-metal)" stroke="#c8bc90" stroke-width="4"><path d="m112 12 28 0 5 21 20 8 20-10 19 20-11 21 9 20 22 5v28l-23 5-8 20 11 20-20 20-21-11-18 9-6 22h-28l-5-22-20-9-21 11-19-20 11-20-9-20-22-5V97l22-5 9-20-11-21 19-20 21 10 20-8Z"/><circle cx="126" cy="111" r="65" fill="#122e38"/><circle cx="126" cy="111" r="22" fill="#b49761"/><path d="M126 46v43m0 44v43M61 111h43m44 0h43M80 65l30 30m31 31 31 31M80 157l30-30m31-31 31-31" stroke-width="12"/></g><path d="M86 212h80" stroke="#e9be77" stroke-width="5"/>`;
 else if(id==='charger'||id==='flanker'||id==='rammer'){
  const ram=id==='rammer';body=`<path d="M56 204 68 122 89 83h74l29 42 16 79-48-13-19-57-17 1-18 59Z" fill="#343d37" stroke="#a08c67" stroke-width="3"/><path d="m86 62 22-40 38-4 31 30-11 42-65 6Z" fill="url(#scene7-wood)" stroke="#baa17a" stroke-width="3"/><path d="m84 60-38-21 8 36 36 10m83-27 34-26-4 41-32 15" fill="#4a4b3c" stroke="#9b8c67" stroke-width="4"/><path d="M103 58h18m21-1h15" stroke="#e5a968" stroke-width="7"/><path d="M91 108 63 153 41 183m129-76 34 42 20 33" fill="none" stroke="#635842" stroke-width="18"/><path d="M86 112h89l13 61-56 27-61-27Z" fill="url(#scene7-metal)" stroke="#a9a57c" stroke-width="4"/><path d="M132 119v66m-35-48 70 34m-70-3 71-33" stroke="#272f2d" stroke-width="6"/>${ram?'<path d="M34 160h184v35H34Z" fill="url(#scene7-wood)" stroke="#bca579" stroke-width="4"/><path d="M70 159v36m111-36v36" stroke="#2a4246" stroke-width="12"/>':''}`;
 }else{
  const bridge=id==='bridge-latch'||id==='north-latch',roof=id==='roof-lock',drive=id==='drive-lock';
  body=`<path d="M47 31h160v196H47Z" fill="url(#scene7-wood)" stroke="#9d7b55" stroke-width="4"/><path d="M86 33v193m43-193v193m40-193v193" stroke="#2a2d29" stroke-width="7"/><path d="M38 61h179v25H38Zm0 119h179v24H38Z" fill="#2c4143" stroke="#9a9a7b" stroke-width="3"/>${bridge?'<path d="M20 110h216v41H20Z" fill="url(#scene7-metal)" stroke="#bbc1a3" stroke-width="4"/><path d="M58 104v53m137-53v53" stroke="#9d956f" stroke-width="10"/><circle cx="127" cy="130" r="12" fill="#102b35"/>':`<path d="M91 119V88a36 36 0 0 1 72 0v32" fill="none" stroke="#b3aa86" stroke-width="15"/><rect x="78" y="108" width="98" height="70" rx="7" fill="url(#scene7-metal)" stroke="#bdad80" stroke-width="4"/><circle cx="126" cy="137" r="10" fill="#112d36"/><path d="M122 141h8l5 19h-18Z" fill="#112d36"/>`}${roof?'<path d="M26 22 128 5 232 22M129 9v52" fill="none" stroke="#b59e72" stroke-width="9"/>':''}${drive?'<path d="m21 15 38 37-17 19-38-36m211 146 37 37-17 19-38-37" stroke="#a9a17c" stroke-width="8" fill="#40565a"/>':''}`;
 }
 return `<svg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">${defs}${body}<ellipse cx="127" cy="237" rx="92" ry="8" fill="#07151a" opacity=".5"/></svg>`.replaceAll('scene7-metal',`scene7-metal-${id}`).replaceAll('scene7-wood',`scene7-wood-${id}`).replaceAll('scene7-eye',`scene7-eye-${id}`);
}
