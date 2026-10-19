import type {Page} from '@playwright/test';
declare global{interface Window{v3HammerGeometry:{frames:{gap:number;angle:number;pivotGap:number;headHeight:number;metalGap:number;time:number}[];complete:boolean;source:string;sourceAlpha:number[]};v3HammerProbeCleanup?:()=>void}}
/** Independently inspected physical face edge and grip landmarks, not the game's FX anchor. */
export async function installHammerProbe(page:Page){await page.locator('#v3-scene').evaluate(async scene=>{
 const hammer=scene.querySelector<HTMLElement>('#v3-hammer')!,image=hammer.querySelector('img')!;
 window.v3HammerProbeCleanup?.();
 await image.decode();const legacy=image.src.includes('hammer-standard-v1');
 const landmarks=legacy?{a:[110,450],b:[330,595],grip:[1090,1090],head:[400,330]}:{a:[120,765],b:[280,766],grip:[1380,515],head:[220,500]};
 const readPoint=(source:number[])=>{const hs=getComputedStyle(hammer),is=getComputedStyle(image),w=image.clientWidth,h=image.clientHeight,fit=Math.min(w/image.naturalWidth,h/image.naturalHeight),fw=image.naturalWidth*fit,fh=image.naturalHeight*fit;
  const io=is.transformOrigin.split(' ').map(parseFloat),ho=hs.transformOrigin.split(' ').map(parseFloat),local=new DOMMatrix(is.transform==='none'?undefined:is.transform).transformPoint({x:(w-fw)/2+source[0]!*fit-io[0]!,y:(h-fh)/2+source[1]!*fit-io[1]!});
  const p=new DOMMatrix(hs.transform==='none'?undefined:hs.transform).transformPoint({x:local.x+io[0]!+image.offsetLeft-ho[0]!,y:local.y+io[1]!+image.offsetTop-ho[1]!});return{x:hammer.offsetLeft+p.x+ho[0]!,y:hammer.offsetTop+p.y+ho[1]!,pivotX:hammer.offsetLeft+ho[0]!,pivotY:hammer.offsetTop+ho[1]!};};
 const texture=document.createElement('canvas');texture.width=image.naturalWidth;texture.height=image.naturalHeight;const ctx=texture.getContext('2d')!;ctx.drawImage(image,0,0);const sourceAlpha=[landmarks.a,landmarks.b,landmarks.grip].map(p=>ctx.getImageData(p[0]!,p[1]!,1,1).data[3]!);window.v3HammerGeometry={frames:[],complete:false,source:image.currentSrc||image.src,sourceAlpha};let started=0,contacts=0;
 function sample(){const probe=window.v3HammerGeometry,a=readPoint(landmarks.a),b=readPoint(landmarks.b),grip=readPoint(landmarks.grip),head=readPoint(landmarks.head),rect=scene.getBoundingClientRect(),hx=parseFloat((scene as HTMLElement).style.getPropertyValue('--hit-x'))/100*rect.width,hy=parseFloat((scene as HTMLElement).style.getPropertyValue('--hit-y'))/100*rect.height;
  const gap=Math.hypot((a.x+b.x)/2-hx,(a.y+b.y)/2-hy),angle=Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI;
  let metalGap=10000;if(gap<6){const canvas=scene.querySelector('canvas')!,box=canvas.getBoundingClientRect(),x=Math.max(0,Math.min(canvas.width-1,Math.round(((a.x+b.x)/2+rect.left-box.left)/box.width*canvas.width))),pixels=canvas.getContext('2d')!.getImageData(x,0,1,canvas.height).data;let top=-1;for(let y=Math.floor(canvas.height*.35);y<canvas.height*.74;y++){if(pixels[y*4+3]!>=200){top=y;break;}}if(top>=0)metalGap=Math.abs((a.y+b.y)/2+rect.top-(box.top+top/canvas.height*box.height));}
  probe.frames.push({gap,angle,pivotGap:Math.hypot(grip.x-grip.pivotX,grip.y-grip.pivotY),headHeight:Math.hypot(head.x-(a.x+b.x)/2,head.y-(a.y+b.y)/2)*2,metalGap,time:performance.now()-started});
  contacts=gap<6&&Math.abs(angle)<10?contacts+1:0;if(contacts>=2||performance.now()-started>3000)probe.complete=true;else requestAnimationFrame(sample);
 }
 function start(e:Event){if(e instanceof KeyboardEvent&&![' ','Space','Enter'].includes(e.key))return;window.v3HammerProbeCleanup?.();started=performance.now();requestAnimationFrame(sample);}
 window.v3HammerProbeCleanup=()=>{scene.removeEventListener('pointerdown',start,true);scene.removeEventListener('keyup',start,true);};scene.addEventListener('pointerdown',start,{capture:true});scene.addEventListener('keyup',start,{capture:true});
});}
