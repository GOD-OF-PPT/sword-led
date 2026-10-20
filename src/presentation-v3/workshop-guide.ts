import type{RunState,Blade}from'../core-v3/index.js';
import{quotaFor,atCap}from'../core-v3/index.js';
import{workshopHint}from'./scene.js';
/** One short contextual hint; redraws, menus and reloads cannot queue a stream of old tips. */
export function createWorkshopGuide(node:HTMLElement){
 let key='',timer:ReturnType<typeof setTimeout>|null=null;
 function cancel(){if(timer!==null)clearTimeout(timer);timer=null;node.hidden=true;}
 return{cancel,render(s:RunState,b:Blade|null,visible:boolean){
  const hint=workshopHint(s,b);node.querySelector('b')!.textContent=hint.title;node.querySelector('span')!.textContent=hint.copy;
  if(!visible){cancel();return hint;}
  const first=s.round===1&&!s.journal.some(a=>a.type==='strike'),learning=s.round===1&&!s.journal.some(a=>a.type==='deliver'),active=b?.status==='active'&&b.id!==s.reserveId,important=!first&&!!(active&&(learning||b.cracked||b.charge===6||atCap(b)||b.value>=Math.max(0,quotaFor(s.round)-s.delivered)));
  const next=`${s.runId}/${s.round}/${hint.title}/${hint.target}`;if(key!==next){cancel();key=next;if(important){node.hidden=false;timer=setTimeout(()=>{timer=null;node.hidden=true;},3800);}}
  return hint;
 }};
}
