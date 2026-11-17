import { packageUrl } from '../security/package-url.mjs';
import type {Blade,DomainEvent,EventId,Hit,Modification,Recipe} from '../core-v4/index.js';
import type {Blade as PaintedBlade,Hit as PaintedHit} from '../core-v3/index.js';
import type {Cue} from '../platform/audio.js';
import type {StrikePoint} from '../platform/direct-strike-input.js';
import {V3_BLADES} from '../presentation-v3/art.js';
import {paintBlade} from '../presentation-v3/blade.js';
import {createImpactFeedback} from '../presentation-v3/impact.js';
import type {ImpactPoint} from '../presentation-v3/impact.js';
import {bladeContact} from '../presentation-v3/surface.js';

type Strike=Extract<DomainEvent,{type:'Strike'}>;
export interface ForgeContactFrame {
  readonly pieceId:string;readonly hit:Hit;readonly index:number;readonly total:number;readonly burst:boolean;
  readonly before:Blade;readonly after:Blade;
}
interface ForgeHost {reduced():boolean;valueLabel?:string;cue(cue:Cue):void;ready():void;problem():void;contact?(frame:ForgeContactFrame):void}
const FAMILY:Readonly<Record<Recipe,number>>=Object.freeze({light:0,guard:1,heavy:2});
const MODS:readonly Modification[]=['windbox','warmRack','wideMouth'];
const EVENTS:readonly EventId[]=['donation','loan','salvage','credit','shelter','rest'];

/** Appearance belongs to the chosen recipe, never to the real piece ID or an RNG draw. */
export function forgeAppearance(blade:Pick<Blade,'recipe'|'level'>){
  const family=FAMILY[blade.recipe],stage=blade.level>=9?4:blade.level>=6?3:blade.level>=3?2:blade.level>=1?1:0;
  return {family,stage,name:['青云轻刃','巡灯护刃','镇岳重锋'][family]!,rank:['乌铁坯','初开锋','叠纹','流火','灯炉名器'][stage]!};
}

/** This disposable projection is consumed only by the existing read-only canvas painter. */
function painted(blade:Blade):PaintedBlade{
  return {id:`display-${FAMILY[blade.recipe]+1}`,suppliedRound:blade.suppliedDay,
    status:blade.status==='broken'?'broken':blade.status==='active'?'active':blade.status==='recycled'?'recycled':blade.status==='traded'?'traded':'delivered',
    base:blade.base,value:blade.value,peak:blade.peak,level:blade.level,cracked:blade.cracked,hits:blade.hits,charge:blade.charge,successes:blade.successes,finalizedRound:blade.finalizedDay};
}

/** Map the measured atlas upper edge into the actual, aspect-preserving canvas rectangle. */
export function forgeContact(blade:Blade|null,point:ImpactPoint,illustrated:boolean,
  scene:{left:number;top:number;width:number;height:number},canvas:{left:number;top:number;width:number;height:number}):ImpactPoint{
  const sw=Math.max(1,scene.width),sh=Math.max(1,scene.height),cw=Math.max(1,canvas.width),ch=Math.max(1,canvas.height);
  const local={x:(scene.left+point.x*sw-canvas.left)/cw,y:point.y};
  const contact=bladeContact(blade?painted(blade):null,local,illustrated);
  return {x:(canvas.left+contact.x*cw-scene.left)/sw,y:(canvas.top+contact.y*ch-scene.top)/sh};
}

export function createForgeRenderer(root:HTMLElement,host:ForgeHost){
  const find=<T extends HTMLElement>(id:string)=>{const node=root.querySelector<T>(`#${id}`);if(!node)throw new Error(`Missing forge surface: ${id}`);return node;};
  const scene=find('v4-scene'),canvas=find<HTMLCanvasElement>('v4-blade'),hammer=find('v4-hammer');
  const image=hammer.querySelector('img');
  if(!image)throw new Error('Missing forge hammer image');
  let disposed=false,epoch=0,frame:number|null=null,target:Blade|null=null,previous:Blade|null=null,visual:Blade|null=null;
  let playing:{event:Strike;index:number;touched:boolean;done:()=>void;epoch:number}|null=null;
  const animations=new Set<Animation>(),images=new Map<string,HTMLImageElement>();
  let pixelCache=new WeakMap<HTMLCanvasElement,{key:string;width:number;height:number}>();
  type Asset={name:string;url:string;image:HTMLImageElement;status:'idle'|'loading'|'ready'|'failed';attempt:number;detach:()=>void};
  const assets=new Map<string,Asset>();
  const get=(name:string)=>{const item=images.get(name);return assets.get(name)?.status==='ready'&&item?.complete&&item.naturalWidth>0?item:undefined;};
  const weapon=(blade:Blade|null)=>blade?get(V3_BLADES[FAMILY[blade.recipe]]!):undefined;
  const assetVersion=(name:string)=>{
    const asset=assets.get(name),picture=asset?.image;
    return {name,attempt:asset?.attempt??0,status:asset?.status??'absent',src:picture?.getAttribute('src')??null,currentSrc:picture?.currentSrc??'',complete:picture?.complete??false,width:picture?.naturalWidth??0,height:picture?.naturalHeight??0};
  };
  function paintWhenChanged(node:HTMLCanvasElement,input:unknown,paint:()=>void){
    const width=node.clientWidth,height=node.clientHeight,dpr=devicePixelRatio||1,ratio=Math.min(2,dpr);
    // Preserve the original painter's zero-size/fallback behavior, but never mark it painted.
    // A later hidden→visible projection must perform its first real draw at the visible size.
    if(!width||!height){pixelCache.delete(node);paint();return;}
    const backingWidth=Math.round(width*ratio),backingHeight=Math.round(height*ratio),key=JSON.stringify([width,height,dpr,ratio,input]),previous=pixelCache.get(node);
    if(previous?.key===key&&previous.width===backingWidth&&previous.height===backingHeight&&node.width===backingWidth&&node.height===backingHeight)return;
    // Cache misses keep the existing full resize/context reset, transforms, shadows and source pixels.
    paint();
    if(node.width===backingWidth&&node.height===backingHeight&&node.getContext('2d'))pixelCache.set(node,{key,width:backingWidth,height:backingHeight});
    else pixelCache.delete(node);
  }
  function paintBladeProjection(node:HTMLCanvasElement,blade:Blade|null){
    const projection=blade?painted(blade):null,name=blade?V3_BLADES[FAMILY[blade.recipe]]:null;
    // Full painted input deliberately favors correctness over a narrower appearance-only key.
    // Asset attempt and actual src/decode metadata invalidate retries even when the Image is reused.
    paintWhenChanged(node,['blade',projection,assetVersion('metal-atlas-v1'),name?assetVersion(name):null],()=>paintBlade(node,projection,get('metal-atlas-v1'),weapon(blade)));
  }
  const animate=(node:HTMLElement,frames:Keyframe[],ms:number,easing='ease-out')=>{
    if(disposed||host.reduced()||document.hidden)return;
    try{const animation=node.animate(frames,{duration:ms,easing});animations.add(animation);void animation.finished.then(()=>animations.delete(animation),()=>animations.delete(animation));}catch{/* Native drawing and the real contact remain available without animation. */}
  };
  const impact=createImpactFeedback({scene,canvas,hammer,sparks:find('v4-sparks'),glow:find('v4-impact-glow'),ring:find('v4-impact-ring'),reticle:find('v4-reticle'),float:find('v4-float'),badge:find('v4-impact-badge'),value:find('v4-value')},
    {reduced:host.reduced,animate,cue:cue=>{
      if(disposed||!playing)return;
      const hit=playing.event.hits[playing.index];
      if(hit&&target){
        const before=Object.freeze({...visual??target});
        visual={...target,value:hit.after,level:hit.level,cracked:hit.result==='crack'||hit.result==='broken'||(visual?.cracked??false),status:hit.result==='broken'?'broken':'active'};
        render();playing.touched=true;pinHit();
        host.contact?.({pieceId:playing.event.pieceId,hit,index:playing.index,total:playing.event.hits.length,burst:playing.event.burst,before,after:Object.freeze({...visual})});
      }
      host.cue(cue);
    },project:point=>forgeContact(visual,point,!!weapon(visual),scene.getBoundingClientRect(),canvas.getBoundingClientRect())});

  // The fallback uses the same 1536×1024 landmarks as the approved natural hammer.
  const fallback=document.createElement('canvas');fallback.className='v4-hammer-fallback';fallback.width=1536;fallback.height=1024;fallback.setAttribute('aria-hidden','true');hammer.append(fallback);
  const hc=fallback.getContext('2d');
  if(hc){
    const wood=hc.createLinearGradient(0,455,0,575);wood.addColorStop(0,'#a67c45');wood.addColorStop(.5,'#724d2c');wood.addColorStop(1,'#3d2c22');hc.fillStyle=wood;hc.strokeStyle='#211e1b';hc.lineWidth=18;hc.beginPath();hc.roundRect(270,455,1215,120,35);hc.fill();hc.stroke();
    hc.strokeStyle='#2b3940';hc.lineWidth=32;for(let x=1175;x<1450;x+=44){hc.beginPath();hc.moveTo(x,456);hc.lineTo(x-36,574);hc.stroke();}
    const steel=hc.createLinearGradient(93,0,345,0);steel.addColorStop(0,'#b4b6a3');steel.addColorStop(.2,'#4b5555');steel.addColorStop(.75,'#303e44');steel.addColorStop(1,'#19292f');hc.fillStyle=steel;hc.strokeStyle='#d9c69b';hc.lineWidth=12;hc.beginPath();hc.roundRect(94,309,211,457,12);hc.fill();hc.stroke();hc.strokeStyle='#efa85d';hc.lineWidth=6;hc.beginPath();hc.moveTo(110,766);hc.lineTo(289,766);hc.stroke();
  }
  function loadAsset(asset:Asset,retry=false){
    if(disposed||asset.status==='loading')return;
    asset.detach();asset.status='loading';const attempt=++asset.attempt;
    if(asset.image===image)hammer.dataset.art='loading';
    const current=()=>!disposed&&asset.attempt===attempt&&asset.status==='loading';
    const ready=()=>{
      // A queued event from an older request must not settle a newer, still-loading request.
      if(!current()||!asset.image.complete||asset.image.naturalWidth===0)return;
      asset.status='ready';asset.detach();if(asset.image===image)hammer.dataset.art='ready';render();host.ready();
    };
    const failed=()=>{
      if(!current()||!asset.image.complete||asset.image.naturalWidth>0)return;
      asset.status='failed';asset.detach();if(asset.image===image)hammer.dataset.art='fallback';render();host.problem();
    };
    asset.image.addEventListener('load',ready);asset.image.addEventListener('error',failed);
    asset.detach=()=>{asset.image.removeEventListener('load',ready);asset.image.removeEventListener('error',failed);};
    // Failed HTTP responses may be cached. The source path and original image remain unchanged.
    asset.image.src=packageUrl(asset.url+(retry?`?retry=${attempt-1}`:''));
  }
  function registerAsset(name:string,item:HTMLImageElement){
    const asset:Asset={name,url:`/assets/d/${name}.webp`,image:item,status:'idle',attempt:0,detach:()=>{}};
    assets.set(name,asset);loadAsset(asset);
  }
  function assetStatus():{loading:boolean;failed:readonly string[]}{
    return{loading:!disposed&&[...assets.values()].some(asset=>asset.status==='loading'),failed:Object.freeze(disposed?[]:[...assets.values()].filter(asset=>asset.status==='failed').map(asset=>asset.url))};
  }
  function retryAssets(){
    if(disposed||assetStatus().loading)return;
    for(const asset of assets.values())if(asset.status==='failed')loadAsset(asset,true);
  }
  registerAsset('hammer-forge-v2',image);

  function pinHit(){const point=impact.point();scene.style.setProperty('--hit-x',`${point.x*100}%`);scene.style.setProperty('--hit-y',`${point.y*100}%`);}
  function render(){
    if(disposed)return;
    const look=visual?forgeAppearance(visual):null;
    scene.dataset.empty=String(!visual);
    scene.dataset.reduced=String(host.reduced());
    canvas.setAttribute('aria-label',visual?`${look!.name}，${look!.rank}，等级${visual.level}，${host.valueLabel??'身价'}${visual.value}，${visual.status==='broken'?'断裂':visual.cracked?'有裂纹':'完好'}；仅造型展示`:'空铁砧');
    if(!visual)for(const key of ['family','stage','illustrated','condition'])delete canvas.dataset[key];
    paintBladeProjection(canvas,visual);impact.refresh();
  }
  for(const name of [...V3_BLADES,'metal-atlas-v1','v07/modifications-v1','v07/events-v1']){
    const item=new Image();images.set(name,item);registerAsset(name,item);
  }
  const resize=typeof ResizeObserver==='undefined'?null:new ResizeObserver(()=>{if(!disposed)render();});resize?.observe(scene);
  const hidden=()=>{if(document.hidden)cancel();};document.addEventListener('visibilitychange',hidden);

  function cancel(){
    if(disposed)return;
    epoch++;playing=null;if(frame!==null)cancelAnimationFrame(frame);frame=null;
    for(const animation of animations)animation.cancel();animations.clear();impact.reset();hammer.classList.remove('preparing');
    if(!disposed){visual=target;render();}
  }
  function contact(){
    const own=playing;if(!own||disposed||own.epoch!==epoch)return;
    const hit=own.event.hits[own.index];if(!hit)return;
    own.touched=false;
    // The legacy impact renderer never consumes trigger metadata; rules stay in V4.
    const displayHit:PaintedHit={result:hit.result,before:hit.before,after:hit.after,level:hit.level,triggers:[]};
    impact.contact(displayHit,own.index,own.event.hits.length);
  }
  function watch(){
    frame=null;const own=playing;if(!own||disposed||own.epoch!==epoch)return;
    if(document.hidden||host.reduced()){cancel();return;}
    if(own.touched&&hammer.dataset.phase==='idle'){
      own.index++;
      if(own.index===own.event.hits.length){playing=null;visual=target;render();own.done();return;}
      contact();
    }
    if(playing)frame=requestAnimationFrame(watch);
  }
  function draw(blade:Blade|null){
    if(disposed)return;
    if(playing&&blade?.id!==playing.event.pieceId)cancel();
    if(target!==blade)previous=target;target=blade;if(!playing){visual=blade;render();}
  }
  function play(event:Strike,point:StrikePoint|null,done:()=>void,beforeBlade?:Blade){
    if(disposed)return;cancel();const own=++epoch;
    if(!target||target.id!==event.pieceId||!event.hits.length){host.problem();queueMicrotask(()=>{if(!disposed&&own===epoch)done();});return;}
    const first=event.hits[0]!;
    const suppliedBefore=beforeBlade?.id===target.id&&beforeBlade.value===first.before?beforeBlade:null;
    visual=suppliedBefore??(previous?.id===target.id&&previous.value===first.before?previous:{...target,value:first.before,cracked:first.result==='crack'?false:first.result==='broken'?true:target.cracked,status:'active'});
    render();impact.start(point,event.burst);playing={event,index:0,touched:false,done,epoch:own};
    if(document.hidden){cancel();return;}
    if(host.reduced()){
      for(let i=0;i<event.hits.length;i++){if(!playing||own!==epoch)return;playing.index=i;contact();}
      if(playing&&own===epoch){playing=null;visual=target;render();queueMicrotask(()=>{if(!disposed&&own===epoch)done();});}return;
    }
    contact();frame=requestAnimationFrame(watch);
  }
  function paintThumb(node:HTMLCanvasElement,blade:Blade){if(!disposed)paintBladeProjection(node,blade);}
  function paintProp(node:HTMLCanvasElement,id:Modification|EventId){
    if(disposed)return;
    const mod=MODS.indexOf(id as Modification),index=mod<0?EVENTS.indexOf(id as EventId):mod,rows=mod<0?2:1,name=mod<0?'v07/events-v1':'v07/modifications-v1',atlas=get(name);
    // DOM metadata stays current even when the identical bitmap needs no repaint.
    node.dataset.prop=id;node.dataset.illustrated=String(!!atlas);
    paintWhenChanged(node,['prop',id,index,rows,assetVersion(name)],()=>{
      const width=node.clientWidth||96,height=node.clientHeight||96,ratio=Math.min(2,devicePixelRatio||1);node.width=Math.round(width*ratio);node.height=Math.round(height*ratio);
      const c=node.getContext('2d');if(!c)return;c.clearRect(0,0,node.width,node.height);
      const unit=Math.min(node.width,node.height)/120;
      c.translate((node.width-120*unit)/2,(node.height-120*unit)/2);c.scale(unit,unit);
      if(atlas&&index>=0){const sw=atlas.naturalWidth/3,sh=atlas.naturalHeight/rows,scale=Math.min(112/sw,112/sh),dw=sw*scale,dh=sh*scale;c.drawImage(atlas,index%3*sw,Math.floor(index/3)*sh,sw,sh,(120-dw)/2,(120-dh)/2,dw,dh);return;}
      paintPropFallback(c,id);
    });
  }
  return {draw,paintThumb,paintProp,play,retryAssets,assetStatus,
    aim(point:StrikePoint|null){if(!disposed&&!playing)impact.aim(point);},
    preparing(value:boolean){if(!disposed)hammer.classList.toggle('preparing',value&&!playing);},cancel,
    dispose(){if(disposed)return;cancel();disposed=true;resize?.disconnect();document.removeEventListener('visibilitychange',hidden);for(const asset of assets.values()){asset.detach();asset.attempt++;if(asset.status==='loading')asset.image.removeAttribute('src');}assets.clear();images.clear();pixelCache=new WeakMap();fallback.remove();}
  };
}

/** Native silhouettes keep unavailable optional atlases readable, without changing a rule. */
function paintPropFallback(c:CanvasRenderingContext2D,id:Modification|EventId){
  c.lineWidth=5;c.lineCap='round';c.lineJoin='round';c.strokeStyle='#dab575';c.fillStyle='#263c3c';
  const line=(points:readonly (readonly [number,number])[])=>{c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();};
  const sword=()=>{c.fillStyle='#adbfc0';c.beginPath();c.moveTo(58,15);c.lineTo(70,43);c.lineTo(65,80);c.lineTo(51,80);c.lineTo(48,43);c.closePath();c.fill();line([[38,82],[79,82]]);line([[59,83],[59,106]]);};
  if(id==='windbox'){c.fillStyle='#765333';c.fillRect(20,34,72,57);for(let x=31;x<87;x+=13)line([[x,40],[x-5,62],[x,85]]);line([[91,47],[108,57],[108,72],[91,80]]);}
  else if(id==='warmRack'){c.fillStyle='#744b30';c.fillRect(15,39,91,13);for(let x=25;x<105;x+=18)line([[x,52],[x,79]]);line([[23,52],[23,103]]);line([[97,52],[97,103]]);c.fillStyle='#e98140';c.fillRect(28,84,63,7);}
  else if(id==='wideMouth'){c.beginPath();c.roundRect(14,27,93,77,9);c.fill();c.stroke();c.fillStyle='#e7803e';c.beginPath();c.roundRect(29,47,63,41,13);c.fill();c.fillStyle='#ffd396';c.beginPath();c.moveTo(45,87);c.lineTo(53,59);c.lineTo(64,76);c.lineTo(76,61);c.lineTo(81,87);c.fill();}
  else if(id==='loan'){c.save();c.translate(60,60);c.rotate(-.4);c.fillStyle='#96673c';c.fillRect(-6,-8,12,62);c.fillStyle='#6f8386';c.fillRect(-34,-30,68,31);c.strokeRect(-34,-30,68,31);c.restore();}
  else if(id==='shelter'){line([[15,51],[60,19],[105,51]]);line([[28,48],[28,103],[94,103],[94,48]]);c.fillStyle='#d98343';c.beginPath();c.moveTo(49,94);c.lineTo(54,67);c.lineTo(65,81);c.lineTo(75,65);c.lineTo(77,95);c.fill();}
  else if(id==='rest'){line([[45,29],[45,18],[76,18],[76,29]]);c.fillStyle='#ce8741';c.beginPath();c.roundRect(30,31,60,64,12);c.fill();c.stroke();line([[23,103],[97,103]]);c.fillStyle='#ffe0a2';c.fillRect(54,43,12,36);}
  else if(id==='credit'){c.beginPath();c.moveTo(60,15);c.lineTo(97,31);c.lineTo(91,74);c.quadraticCurveTo(83,96,60,108);c.quadraticCurveTo(36,97,29,74);c.lineTo(23,31);c.closePath();c.fill();c.stroke();line([[43,62],[56,77],[81,46]]);}
  else {sword();if(id==='salvage'){c.fillStyle='#b8934f';c.beginPath();c.arc(87,84,22,0,Math.PI*2);c.fill();c.stroke();}else{c.strokeStyle='#c2a174';line([[28,54],[17,69],[26,91],[41,100]]);line([[89,54],[103,69],[94,91],[78,100]]);}}
}
