import {sameInput} from './timing.js';
import type {InputIdentity} from './timing.js';
export interface StrikePoint {readonly clientX:number;readonly clientY:number}
interface DirectHost {
  context():InputIdentity|null;
  navigationContext():InputIdentity|null;
  navigate():void;
  commit(identity:InputIdentity,point:StrikePoint|null):void;
  aim(point:StrikePoint|null):void;
  preparing(value:boolean):void;
}
/** Pointer-down is a complete hit; holding/releasing never adds a second command. */
export function bindDirectStrikeInput(surfaces:readonly HTMLButtonElement[],host:DirectHost){
  let pointer:number|null=null,owner:HTMLButtonElement|null=null,consume:HTMLButtonElement|null=null;
  let key:{code:string;identity:InputIdentity;kind:'forge'|'navigate'}|null=null,disposed=false;
  const releasePointer=()=>{if(pointer!==null&&owner){try{if(owner.hasPointerCapture(pointer))owner.releasePointerCapture(pointer);}catch{/* Capture may have ended with the surface. */}}pointer=null;owner=null;};
  const cancel=()=>{key=null;releasePointer();host.preparing(false);};
  const down=(event:PointerEvent)=>{
    const surface=event.currentTarget as HTMLButtonElement;
    if(event.button!==0||!event.isPrimary||event.ctrlKey||event.metaKey||event.altKey||surface.disabled)return;
    if(pointer!==null||key){event.preventDefault();consume=surface;return;}
    const identity=host.context(),navigation=identity?null:host.navigationContext();
    event.preventDefault();surface.focus({preventScroll:true});pointer=event.pointerId;owner=surface;consume=surface;
    try{surface.setPointerCapture(pointer);}catch{/* Synthetic test events have no native pointer capture. */}
    if(identity&&sameInput(identity,host.context()))host.commit(Object.freeze({...identity}),surface===surfaces[0]?{clientX:event.clientX,clientY:event.clientY}:null);
    else if(navigation&&sameInput(navigation,host.navigationContext()))host.navigate();
  };
  const up=(event:PointerEvent)=>{if(event.pointerId===pointer)releasePointer();};
  const move=(event:PointerEvent)=>{if(!disposed&&event.currentTarget===surfaces[0]&&event.pointerType!=='touch')host.aim({clientX:event.clientX,clientY:event.clientY});};
  const leave=()=>host.aim(null);
  const click=(event:MouseEvent)=>{
    const surface=event.currentTarget as HTMLButtonElement;
    if(consume===surface&&event.detail!==0){consume=null;event.preventDefault();event.stopImmediatePropagation();return;}
    // Accessibility activation has no pointer-down. Native keyboard clicks are prevented below.
    if(event.detail!==0||key||pointer!==null)return;
    const identity=host.context();if(identity){event.preventDefault();event.stopImmediatePropagation();host.commit(identity,null);}
    else if(host.navigationContext()){event.preventDefault();event.stopImmediatePropagation();host.navigate();}
  };
  const keydown=(event:KeyboardEvent)=>{
    const code=event.code==='Space'||event.key===' '?'Space':event.key==='Enter'?'Enter':null;
    if(!code)return;
    if(event.ctrlKey||event.metaKey||event.altKey){cancel();return;}
    if(event.repeat||key||pointer!==null){event.preventDefault();return;}
    event.preventDefault();const forge=host.context(),identity=forge??host.navigationContext();if(!identity)return;
    consume=null;key={code,identity:Object.freeze({...identity}),kind:forge?'forge':'navigate'};
    if(code==='Enter'){if(forge)host.commit(key.identity,null);else host.navigate();}else if(forge)host.preparing(true);
  };
  const keyup=(event:KeyboardEvent)=>{
    const code=event.code==='Space'||event.key===' '?'Space':event.key==='Enter'?'Enter':null;
    if(!key||key.code!==code)return;event.preventDefault();const pending=key;key=null;host.preparing(false);
    const latest=pending.kind==='forge'?host.context():host.navigationContext();
    if(code==='Space'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&sameInput(pending.identity,latest)){if(pending.kind==='forge')host.commit(pending.identity,null);else host.navigate();}
  };
  const hidden=()=>{if(document.hidden)cancel();};
  const blurSurface=()=>{key=null;host.preparing(false);};
  for(const surface of surfaces){surface.addEventListener('pointerdown',down);surface.addEventListener('pointermove',move);surface.addEventListener('pointerleave',leave);surface.addEventListener('click',click);surface.addEventListener('keydown',keydown);surface.addEventListener('blur',blurSurface);}
  window.addEventListener('pointerup',up,true);window.addEventListener('pointercancel',up,true);window.addEventListener('keyup',keyup,true);window.addEventListener('blur',cancel);document.addEventListener('visibilitychange',hidden);
  return{cancel,refresh(){if(key?.code==='Space'&&!sameInput(key.identity,key.kind==='forge'?host.context():host.navigationContext())){key=null;host.preparing(false);}},dispose(){disposed=true;cancel();for(const surface of surfaces){surface.removeEventListener('pointerdown',down);surface.removeEventListener('pointermove',move);surface.removeEventListener('pointerleave',leave);surface.removeEventListener('click',click);surface.removeEventListener('keydown',keydown);surface.removeEventListener('blur',blurSurface);}window.removeEventListener('pointerup',up,true);window.removeEventListener('pointercancel',up,true);window.removeEventListener('keyup',keyup,true);window.removeEventListener('blur',cancel);document.removeEventListener('visibilitychange',hidden);}};
}
