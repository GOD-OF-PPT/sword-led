import type {Hit} from '../core-v3/index.js';
import type {Cue,ForgeSound} from '../platform/audio.js';
import type {StrikePoint} from '../platform/direct-strike-input.js';
import {element} from '../presentation/dom.js';

export const IMPACT_SOUNDS:Readonly<Partial<Record<Cue,ForgeSound>>>=Object.freeze({
  standard:{tones:[139,947,2381],duration:.18,type:'triangle',fall:.72},
  heavy:{tones:[89,631,1723],duration:.29,type:'triangle',fall:.6},
  damage:{tones:[197,1499,3167],duration:.2,fall:.44},
  broken:{tones:[173,467,2279],duration:.4,type:'triangle',fall:.18},
});
export interface ImpactPoint {readonly x:number;readonly y:number}
export function impactPoint(rect:{left:number;top:number;width:number;height:number},pointer:StrikePoint|null):ImpactPoint{
  return{x:Math.max(.27,Math.min(.85,pointer?(pointer.clientX-rect.left)/Math.max(1,rect.width):.58)),y:Math.max(.54,Math.min(.64,pointer?(pointer.clientY-rect.top)/Math.max(1,rect.height):.6))};
}
interface Nodes {scene:HTMLElement;canvas:HTMLCanvasElement;hammer:HTMLElement;sparks:HTMLElement;glow:HTMLElement;ring:HTMLElement;reticle:HTMLElement;float:HTMLElement;badge:HTMLElement;value:HTMLElement}
interface Host {reduced():boolean;animate(node:HTMLElement,frames:Keyframe[],ms:number,easing?:string):void;cue(cue:Cue):void}
export function createImpactFeedback(nodes:Nodes,host:Host){
  let point:ImpactPoint={x:.58,y:.6},hammerSequence=0;
  const frames=new Set<number>();
  function frame(callback:()=>void){const id=requestAnimationFrame(()=>{frames.delete(id);callback();});frames.add(id);}
  function stopHammer(){hammerSequence++;for(const id of frames)cancelAnimationFrame(id);frames.clear();for(const a of nodes.hammer.getAnimations())a.cancel();nodes.hammer.style.transform='';}
  const particles=Array.from({length:36},()=>element('i'));nodes.sparks.replaceChildren(...particles);
  function position(p:ImpactPoint){
    point=p;nodes.scene.style.setProperty('--aim-x',`${p.x*100}%`);nodes.scene.style.setProperty('--aim-y',`${p.y*100}%`);
  }
  position(point);
  function reset(){stopHammer();nodes.scene.classList.remove('aiming','bursting','striking');nodes.scene.removeAttribute('data-outcome');nodes.badge.textContent='';nodes.float.textContent='';}
  function contact(hit:Hit,index:number,total:number){
    const great=hit.result==='great',bad=hit.result==='crack'||hit.result==='broken',broken=hit.result==='broken';
    nodes.scene.dataset.outcome=hit.result;nodes.scene.classList.add('striking');
    const delta=hit.after-hit.before;
    nodes.badge.textContent=total>1?`连锻 ${index+1}/${total}`:great?'大成！':broken?'断裂':bad?'裂纹警告':'锻成';
    nodes.float.textContent=`${delta>=0?'+':'−'}${Math.abs(delta).toLocaleString('zh-CN')} 身价`;
    nodes.scene.style.setProperty('--hit-color',bad?'#ff7851':great?'#fff1a6':'#ffba61');
    host.cue(broken?'broken':bad?'damage':great?'heavy':'standard');
    if(host.reduced()){nodes.scene.classList.remove('striking');return;}
    // Pin contact through two actual paints, so a slow frame cannot skip the hit.
    stopHammer();const sequence=hammerSequence;nodes.hammer.style.transform='translateY(23px)';
    frame(()=>frame(()=>{if(sequence!==hammerSequence||document.hidden||host.reduced())return;host.animate(nodes.hammer,[{transform:'translateY(23px)'},{transform:'translateY(-13px) rotate(-5deg)',offset:.6},{transform:'translateY(0)'}],great?170:130,'linear');nodes.hammer.style.transform='';}));
    host.animate(nodes.canvas,[{transform:'translate(0,0)'},{transform:`translate(${bad?-4:3}px,4px)`,offset:.28},{transform:'translate(-2px,-2px)',offset:.43},{transform:'translate(1px,1px)',offset:.62},{transform:'translate(0,0)'}],bad?270:180);
    host.animate(nodes.glow,[{opacity:0,transform:'translate(-50%,-50%) scale(.3)'},{opacity:great?.95:.65,offset:.18},{opacity:0,transform:'translate(-50%,-50%) scale(1.25)'}],great?460:260);
    host.animate(nodes.ring,[{opacity:.9,transform:'translate(-50%,-50%) scale(.15)'},{opacity:0,transform:`translate(-50%,-50%) scale(${great?2.8:1.7})`}],great?420:260);
    host.animate(nodes.value,[{transform:'scale(1)'},{transform:`scale(${great?1.14:1.065})`,offset:.24},{transform:'scale(1)'}],great?350:230);
    host.animate(nodes.float,[{opacity:0,transform:'translate(-50%,10px) scale(.8)'},{opacity:1,offset:.18,transform:'translate(-50%,-8px) scale(1.12)'},{opacity:1,offset:.68},{opacity:0,transform:'translate(-50%,-70px) scale(1)'}],total>1?270:540);
    host.animate(nodes.badge,[{opacity:0,transform:'translate(-50%,4px) scale(.8)'},{opacity:1,offset:.15},{opacity:1,offset:.75},{opacity:0,transform:'translate(-50%,-18px) scale(1.1)'}],total>1?250:500);
    const count=broken?28:great?36:22;
    for(const [i,particle]of particles.entries()){
      if(i>=count)continue;
      const angle=-Math.PI+(i/(count-1))*Math.PI,reach=35+(i*29%100)+(great?38:0);
      const x=Math.cos(angle)*reach,y=Math.sin(angle)*reach+(broken?60:0);
      particle.style.background=broken?i%2?'#66808b':'#e1a76e':bad?'#ef865e':i%3?'#ffca77':'#fff3bf';
      particle.style.width=`${broken?5+i%7:2+i%3}px`;particle.style.height=`${broken?5+i%9:5+i%8}px`;
      host.animate(particle,[{opacity:0,transform:'translate(0,0) rotate(0deg)'},{opacity:1,offset:.08},{opacity:1,offset:.55},{opacity:0,transform:`translate(${x}px,${y}px) rotate(${i*73}deg)`}],broken?600:270+i%4*50);
    }
  }
  return{position,point:()=>point,reset,aim(pointer:StrikePoint|null){if(pointer){position(impactPoint(nodes.scene.getBoundingClientRect(),pointer));nodes.scene.classList.add('aiming');}else{nodes.scene.classList.remove('aiming');position({x:.58,y:.6});}},start(pointer:StrikePoint|null,burst:boolean){position(impactPoint(nodes.scene.getBoundingClientRect(),pointer));nodes.scene.style.setProperty('--hit-x',`${point.x*100}%`);nodes.scene.style.setProperty('--hit-y',`${point.y*100}%`);nodes.scene.classList.toggle('bursting',burst);},contact};
}
