import {COMMISSIONS,getRunView} from '../core-v4/index.js';
import type {RunState,DomainEvent} from '../core-v4/index.js';

export type FirstChapterScreen='opening'|'workshop'|'receipt'|'chapter'|'complete'|'defeat'|'future';
export function firstChapterScreen(s:RunState):FirstChapterScreen {
 if(s.day>4)return 'future';
 if(s.phase==='opening')return 'opening';
 if(s.phase==='defeat')return 'defeat';
 if(s.phase==='chapter')return 'chapter';
 if(s.phase==='summary')return s.day===4?'complete':'receipt';
 return 'workshop';
}
export function firstChapterFacts(s:RunState){
 const records=s.history.filter(h=>h.day<=4),bridge=records.find(h=>h.day===4);
 return{completed:records.filter(h=>h.met).length,days:records.length,bridgeMet:bridge?.met??false,
  bridgeResolved:!!bridge,chaptersEarned:s.history.some(h=>h.day===4&&h.sealsAfter>0),
  lamps:Array.from({length:4},(_,i)=>({day:i+1,title:COMMISSIONS[i]!.title,done:records.some(h=>h.day===i+1&&h.met)}))};
}
export interface ForgeNotice {title:string;copy:string;action:'gift'|'deliver'|'next'|'settle'|'resume'|'book'|'shop'|'journey'|'none';label:string}
export function noticeFromEvents(events:readonly DomainEvent[],s:RunState):ForgeNotice|null {
 const met=events.find(e=>e.type==='MainCompleted');
 if(met?.type==='MainCompleted')return{title:'这一站，有剑了',copy:COMMISSIONS[met.commissionId-1]!.success,action:s.gift==='available'?'gift':'settle',label:s.gift==='available'?'领一门手艺':'安排余剑与收工'};
 const delivered=events.find(e=>e.type==='Delivered');
 if(delivered?.type==='Delivered'&&delivered.matched){const progress=getRunView(s).commission.progress;return{title:'第一驿，接到剑了',copy:`${progress.routes.map(r=>`${r.count}/${r.required}`).join(' 或 ')} · 还要一柄各自合格的剑，第二站才会亮灯。已经交出的剑不会重复计数。`,action:'journey',label:'看看驿路的灯'};}
 const strike=events.find(e=>e.type==='Strike');
 if(strike?.type==='Strike'){
  const last=strike.hits.at(-1),b=s.blades.find(b=>b.id===strike.pieceId);
  if(last?.result==='broken')return{title:'剑断了，炉火还在',copy:'断剑已按底价回收。换一柄继续，或保留现有成果收工。',action:'next',label:'换下一柄'};
  if(last?.result==='crack')return{title:'裂纹出现了',copy:`这一记后身价为${last.after}。再裂会断，现在仍可收手交剑。`,action:'deliver',label:'看看能否交剑'};
  if(b?.charge===6)return{title:'锤势已满',copy:'下一次落锤是安全连锻，不会出现裂损。',action:'none',label:'安全连锻'};
 }
 const event=events.find(e=>e.type==='EventChoice');
 if(event?.type==='EventChoice')return{title:event.record.choice==='accept'?'选择已经记下':'这一晚，守住手里的剑',copy:event.record.choice==='accept'?'后果与资源已按本次选择结清，收工时可以回看。':'没有额外扣款，可以继续打造当前委托。',action:'none',label:''};
 if(events.some(e=>e.type==='Trait'))return{title:'手艺已放进行囊',copy:'手艺会在符合条件的锤击中生效，可点挂件查看作用。',action:'none',label:''};
 if(events.some(e=>e.type==='Upgraded'))return{title:'下一批铁料，备好了',copy:'新来料底价已提高，当前剑的底价与身价保持原值。',action:'none',label:''};
 if(events.some(e=>e.type==='Repaired'))return{title:'一枚契印，补回来了',copy:'当前契印已增加一枚，这次商人不能重复修补。',action:'none',label:''};
 return null;
}
