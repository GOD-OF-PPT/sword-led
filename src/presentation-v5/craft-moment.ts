import {MODIFICATIONS,TRAITS} from '../core-v5/index.js';
import type {Hit,Trigger} from '../core-v5/index.js';
import type {ForgeContactFrame} from '../presentation-v4/forge.js';
import {forgeAppearance} from '../presentation-v4/forge.js';

interface Moment {
 readonly pieceId:string;
 readonly hits:readonly Hit[];
 readonly burst:boolean;
 contactIndex:number;
}

const triggerNames:Readonly<Record<Trigger,string>>={
 steady:TRAITS.steady.name,ember:TRAITS.ember.name,inherit:TRAITS.inherit.name,
 echo:TRAITS.echo.name,crackedEdge:TRAITS.crackedEdge.name,pardon:TRAITS.pardon.name,
 windbox:MODIFICATIONS.windbox.name,warmRack:MODIFICATIONS.warmRack.name,wideMouth:MODIFICATIONS.wideMouth.name,
 loan:'借锤',credit:'保价',shelter:'炉棚照应',
};
const resultNames:Readonly<Record<Hit['result'],string>>={success:'锻成',great:'大成',crack:'裂纹出现',broken:'剑断了'};
const fmt=(value:number)=>value.toLocaleString('zh-CN');
const signed=(value:number)=>`${value<0?'−':'＋'}${fmt(Math.abs(value))}`;

/** One actual strike's presentation. The controller guards run/revision/generation/epoch. */
export function createCraftMoment(root:HTMLElement,reduced:()=>boolean){
 const surface=root.querySelector<HTMLElement>('#v5-craft-moment');
 if(!surface)throw Error('Missing craft moment surface');
 const container:HTMLElement=surface;
 const document=root.ownerDocument;
 const node=(tag:'p'|'div',className:string)=>{const value=document.createElement(tag);value.className=className;return value;};
 const kicker=node('p','v5-moment-kicker'),title=node('p','v5-moment-title'),delta=node('p','v5-moment-delta');
 const triggers=node('div','v5-moment-triggers'),progress=node('div','v5-moment-progress'),copy=node('p','v5-moment-copy');
 container.replaceChildren(kicker,title,delta,triggers,progress,copy);
 container.setAttribute('role','status');container.setAttribute('aria-live','polite');container.setAttribute('aria-atomic','true');
 progress.setAttribute('role','progressbar');progress.setAttribute('aria-label','本次安全连锻的实际接触');progress.setAttribute('aria-valuemin','0');
 let own:Moment|null=null,disposed=false;

 function clear(){
  own=null;container.hidden=true;container.setAttribute('aria-busy','false');
  for(const name of ['piece','result','burst','settled','reduced'])delete container.dataset[name];
  for(const item of [kicker,title,delta,copy])item.textContent='';
  triggers.replaceChildren();triggers.hidden=true;triggers.removeAttribute('aria-label');progress.replaceChildren();progress.hidden=true;
  progress.removeAttribute('aria-valuenow');progress.removeAttribute('aria-valuemax');
 }
 function showTriggers(ids:readonly Trigger[]){
  const unique=[...new Set(ids)];triggers.replaceChildren();triggers.hidden=unique.length===0;
  for(const id of unique.slice(0,3)){
   const badge=document.createElement('span');badge.dataset.trigger=id;badge.textContent=triggerNames[id];triggers.append(badge);
  }
  if(unique.length>3){const more=document.createElement('span');more.textContent=`＋${unique.length-3}`;more.title=unique.slice(3).map(id=>triggerNames[id]).join('、');triggers.append(more);}
  if(unique.length)triggers.setAttribute('aria-label','实际生效：'+unique.map(id=>triggerNames[id]).join('、'));
  else triggers.removeAttribute('aria-label');
 }
 function contactCopy(hit:Hit,moment:Moment){
  if(hit.result==='broken')return`断剑回收 ${fmt(hit.recoveryAmount)} 铜钱 · 换一柄，再起炉火`;
  if(hit.result==='crack')return hit.triggers.includes('steady')||hit.triggers.includes('credit')
   ?'首裂保价 · 裂纹仍在，再裂会断'
   :'留下裂纹 · 再裂会断，可以先收手安排';
  if(moment.burst)return`这一轮连锻 ${fmt(moment.hits[0]!.before)} → ${fmt(hit.after)}`;
  return '';
 }
 function begin(pieceId:string,hits:readonly Hit[],burst:boolean){
  if(disposed)return;clear();
  if(!pieceId||hits.length===0||hits.length>4)return;
  own={pieceId,hits:hits.map(hit=>({...hit,triggers:[...hit.triggers]})),burst,contactIndex:-1};
  container.dataset.piece=pieceId;container.dataset.burst=String(burst);container.dataset.settled='false';container.dataset.reduced=String(reduced());
  container.setAttribute('aria-busy','true');
  // The Accepted result is retained privately until its real contact is delivered.
  progress.hidden=!burst;progress.setAttribute('aria-valuemax',String(hits.length));progress.setAttribute('aria-valuenow','0');
  if(burst)for(let index=0;index<hits.length;index++){const mark=document.createElement('span');mark.setAttribute('aria-hidden','true');mark.dataset.contacted='false';progress.append(mark);}
 }
 function contact(frame:ForgeContactFrame){
  const moment=own;
  if(disposed||!moment||frame.pieceId!==moment.pieceId||frame.burst!==moment.burst||frame.total!==moment.hits.length||frame.index!==moment.contactIndex+1)return;
  const hit=moment.hits[frame.index];
  if(!hit||hit.result!==frame.hit.result||hit.before!==frame.hit.before||hit.after!==frame.hit.after||hit.level!==frame.hit.level
   ||hit.triggers.length!==frame.hit.triggers.length||hit.triggers.some((id,index)=>id!==frame.hit.triggers[index]))return;
  moment.contactIndex=frame.index;container.hidden=false;container.dataset.result=hit.result;container.dataset.reduced=String(reduced());
  kicker.textContent=hit.result==='broken'?'上一柄的落锤结果':moment.burst?`安全连锻 · ${frame.index+1}/${moment.hits.length}`:'炉火应锤';
  const before=forgeAppearance(frame.before),after=forgeAppearance(frame.after),grew=after.stage>before.stage&&hit.result!=='crack'&&hit.result!=='broken';
  title.textContent=grew?`${resultNames[hit.result]} · ${after.rank}`:resultNames[hit.result];delta.textContent=`估值 ${signed(hit.after-hit.before)}`;
  showTriggers(hit.triggers);copy.textContent=contactCopy(hit,moment);
  progress.setAttribute('aria-valuenow',String(frame.index+1));
  for(const [index,mark]of [...progress.children].entries())mark.setAttribute('data-contacted',String(index<=frame.index));
 }
 function settled(){
  if(disposed||!own)return;
  const moment=own;own=null;container.setAttribute('aria-busy','false');container.dataset.settled='true';
  if(moment.contactIndex<0)return;
  if(moment.burst){
   const last=moment.hits[moment.contactIndex]!;
   kicker.textContent=`安全连锻 · ${moment.contactIndex+1}/${moment.hits.length}记落定`;
   delta.textContent=`合计估值 ${signed(last.after-moment.hits[0]!.before)}`;
   showTriggers(moment.hits.slice(0,moment.contactIndex+1).flatMap(hit=>hit.triggers));
   copy.textContent=`${fmt(moment.hits[0]!.before)} → ${fmt(last.after)} · 继续锻，或趁热收手`;
  }
 }
 function cancel(){if(!disposed)clear();}
 function dispose(){
  if(disposed)return;clear();disposed=true;container.replaceChildren();
  for(const name of ['role','aria-live','aria-atomic','aria-busy'])container.removeAttribute(name);
 }
 clear();return{begin,contact,settled,cancel,dispose};
}
