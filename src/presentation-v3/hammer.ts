/** Landmarks measured on hammer-forge-v2.png, in original image pixels. */
export const HAMMER_ART=Object.freeze({width:1536,height:1024,face:{x:200,y:766},grip:{x:1380,y:515}});
export function createHammerMotion(node:HTMLElement,reduced:()=>boolean,animate:(node:HTMLElement,frames:Keyframe[],ms:number,easing?:string)=>void){
 let sequence=0;const frames=new Set<number>();
 node.style.setProperty('--face-x',String(HAMMER_ART.face.x/HAMMER_ART.width));node.style.setProperty('--face-y',String(HAMMER_ART.face.y/HAMMER_ART.width));
 node.style.setProperty('--grip-x',`${HAMMER_ART.grip.x/HAMMER_ART.width*100}%`);node.style.setProperty('--grip-y',`${HAMMER_ART.grip.y/HAMMER_ART.height*100}%`);
 function frame(fn:()=>void){const id=requestAnimationFrame(()=>{frames.delete(id);fn();});frames.add(id);}
 function reset(){sequence++;for(const id of frames)cancelAnimationFrame(id);frames.clear();for(const a of node.getAnimations())a.cancel();node.style.transform='';node.dataset.phase='idle';}
 function strike(great:boolean,touch:()=>void){
  reset();const own=sequence,valid=()=>own===sequence&&!document.hidden&&!reduced();
  if(reduced()){touch();return;}
  node.dataset.phase='swing';const start=performance.now();animate(node,[{transform:'rotate(8deg)'},{transform:'rotate(0deg)'}],55,'ease-in');
  function touchdown(){if(!valid())return;if(performance.now()-start<55){frame(touchdown);return;}
   for(const a of node.getAnimations())a.cancel();node.style.transform='rotate(0deg)';node.dataset.phase='contact';touch();
   // The flat face remains pinned through two real paints, including slow frames.
   frame(()=>frame(()=>{if(!valid())return;node.dataset.phase='rebound';animate(node,[{transform:'rotate(0deg)'},{transform:`rotate(${great?22:18}deg)`,offset:.58},{transform:'rotate(8deg)'}],great?155:115,'ease-out');node.style.transform='';void Promise.allSettled(node.getAnimations().map(a=>a.finished)).then(()=>{if(own===sequence)node.dataset.phase='idle';});}));
  }
  frame(touchdown);
 }
 return{reset,strike};
}
