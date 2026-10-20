import type {Page} from '@playwright/test';

export interface ForgeFrame {gap:number;angle:number;pivotGap:number;metalGap:number;time:number;sampleCostMs:number;phase:string}
declare global {interface Window {v4HammerGeometry:{frames:ForgeFrame[];complete:boolean;source:string;sourceAlpha:number[];inputToFirstSampleMs:number|null};v4HammerProbeCleanup?:()=>void}}

/** Physical face and grip landmarks are inspected in source pixels; metal is read from the actual canvas alpha. */
export async function installV4HammerProbe(page:Page){
  await page.locator('#v4-scene').evaluate(async scene=>{
    const hammer=scene.querySelector<HTMLElement>('#v4-hammer')!,image=hammer.querySelector('img')!,canvas=scene.querySelector<HTMLCanvasElement>('#v4-blade')!;
    window.v4HammerProbeCleanup?.();await image.decode();
    const landmarks={a:[120,765],b:[280,766],grip:[1380,515]};
    const source=document.createElement('canvas');source.width=image.naturalWidth;source.height=image.naturalHeight;const context=source.getContext('2d')!;context.drawImage(image,0,0);
    const sourceAlpha=[landmarks.a,landmarks.b,landmarks.grip].map(p=>context.getImageData(p[0]!,p[1]!,1,1).data[3]!);
    window.v4HammerGeometry={frames:[],complete:false,source:image.currentSrc||image.src,sourceAlpha,inputToFirstSampleMs:null};let inputAt=0,observedAt=-1,raf:number|null=null;
    function readPoint(p:number[]){
      const hs=getComputedStyle(hammer),is=getComputedStyle(image),w=image.clientWidth,h=image.clientHeight,fit=Math.min(w/image.naturalWidth,h/image.naturalHeight),fw=image.naturalWidth*fit,fh=image.naturalHeight*fit;
      const io=is.transformOrigin.split(' ').map(parseFloat),ho=hs.transformOrigin.split(' ').map(parseFloat),local=new DOMMatrix(is.transform==='none'?undefined:is.transform).transformPoint({x:(w-fw)/2+p[0]!*fit-io[0]!,y:(h-fh)/2+p[1]!*fit-io[1]!});
      const transformed=new DOMMatrix(hs.transform==='none'?undefined:hs.transform).transformPoint({x:local.x+io[0]!+image.offsetLeft-ho[0]!,y:local.y+io[1]!+image.offsetTop-ho[1]!});
      return {x:hammer.offsetLeft+transformed.x+ho[0]!,y:hammer.offsetTop+transformed.y+ho[1]!,pivotX:hammer.offsetLeft+ho[0]!,pivotY:hammer.offsetTop+ho[1]!};
    }
    function sample(){
      raf=null;const started=performance.now(),probe=window.v4HammerGeometry,a=readPoint(landmarks.a),b=readPoint(landmarks.b),grip=readPoint(landmarks.grip),rect=scene.getBoundingClientRect(),box=canvas.getBoundingClientRect();
      const x=(a.x+b.x)/2,y=(a.y+b.y)/2,hx=parseFloat((scene as HTMLElement).style.getPropertyValue('--hit-x'))/100*rect.width,hy=parseFloat((scene as HTMLElement).style.getPropertyValue('--hit-y'))/100*rect.height;
      const pixelX=Math.round((x+rect.left-box.left)/Math.max(1,box.width)*canvas.width);let metalGap=10000;
      if(pixelX>=0&&pixelX<canvas.width){const pixels=canvas.getContext('2d')!.getImageData(pixelX,0,1,canvas.height).data;for(let py=Math.floor(canvas.height*.35);py<canvas.height*.74;py++){if(pixels[py*4+3]!>=200){metalGap=Math.abs(y+rect.top-(box.top+py/canvas.height*box.height));break;}}}
      const measured=performance.now();if(observedAt<0){observedAt=measured;probe.inputToFirstSampleMs=measured-inputAt;}
      probe.frames.push({gap:Math.hypot(x-hx,y-hy),angle:Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI,pivotGap:Math.hypot(grip.x-grip.pivotX,grip.y-grip.pivotY),metalGap,time:measured-observedAt,sampleCostMs:measured-started,phase:hammer.dataset.phase??'unknown'});
      const contacts=probe.frames.filter(f=>f.phase==='contact'&&f.gap<6&&f.metalGap<6&&Math.abs(f.angle)<10).length;
      if(contacts>=2||measured-inputAt>4500)probe.complete=true;else raf=requestAnimationFrame(sample);
    }
    const start=(event:Event)=>{if(event instanceof PointerEvent&&event.button!==0)return;if(event instanceof KeyboardEvent&&![' ','Space','Enter'].includes(event.key))return;if(raf!==null)cancelAnimationFrame(raf);inputAt=performance.now();observedAt=-1;window.v4HammerGeometry.frames=[];window.v4HammerGeometry.complete=false;raf=requestAnimationFrame(sample);};
    scene.addEventListener('pointerdown',start,true);scene.addEventListener('keyup',start,true);
    window.v4HammerProbeCleanup=()=>{if(raf!==null)cancelAnimationFrame(raf);raf=null;scene.removeEventListener('pointerdown',start,true);scene.removeEventListener('keyup',start,true);};
  });
}

/** Real callback delivery is at least 250 ms apart; native animations and source data are untouched. */
export async function installV4SlowFrames(page:Page){
  await page.addInitScript(()=>{
    const native=window.requestAnimationFrame.bind(window),cancel=window.cancelAnimationFrame.bind(window),pending=new Map<number,number>();let serial=0;
    window.requestAnimationFrame=callback=>{const id=++serial,start=performance.now();const step=(time:number)=>{if(!pending.has(id))return;if(performance.now()-start>=250){pending.delete(id);callback(time);}else pending.set(id,native(step));};pending.set(id,native(step));return id;};
    window.cancelAnimationFrame=id=>{const handle=pending.get(id);if(handle!==undefined)cancel(handle);pending.delete(id);};
  });
}
