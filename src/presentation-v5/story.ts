import {COMMISSIONS,getRunView} from '../core-v5/index.js';
import type {RunState,DomainEvent} from '../core-v5/index.js';

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
export interface NoticeSubject {runId:string;day:number;revision:number;pieceId:string;generation?:number}
export interface ForgeNotice {title:string;copy:string;action:'gift'|'deliver'|'inspect'|'next'|'settle'|'resume'|'book'|'shop'|'journey'|'none';label:string;subject?:NoticeSubject}
export function noticeFromEvents(events:readonly DomainEvent[],s:RunState):ForgeNotice|null {
 const met=events.find(e=>e.type==='MainCompleted');
 if(met?.type==='MainCompleted')return{title:'这一站，有剑了',copy:COMMISSIONS[met.commissionId-1]!.success,action:s.gift==='available'?'gift':'settle',label:s.gift==='available'?'领一门手艺':'安排余剑与收工'};
 const delivered=events.find(e=>e.type==='Delivered');
 if(delivered?.type==='Delivered'&&delivered.matched){const view=getRunView(s),progress=view.commission.progress,relay=view.commission.id===11;return{title:relay?'接力的第一柄，已经交出':'第一驿，接到剑了',copy:`${progress.routes.map(r=>`${r.count}/${r.required}`).join(' 或 ')} · ${relay?'还可再交一柄合格新剑，或用一柄合格旧剑完成另一条路线。':'还要一柄各自合格的剑，第二站才会亮灯。'}已经交出的剑不会重复计数。`,action:'journey',label:relay?'看看这次接力':'看看驿路的灯'};}
 const strike=events.find(e=>e.type==='Strike');
 if(strike?.type==='Strike'){
  const last=strike.hits.at(-1),b=s.blades.find(b=>b.id===strike.pieceId);
  const subject={runId:s.runId,day:s.day,revision:s.revision,pieceId:strike.pieceId};
  if(last?.result==='broken')return{title:'剑断了，炉火还在',copy:`断剑实得${last.recoveryAmount}铜钱，受今日钱袋限制。左侧还有兵器可继续，也可保留现有成果收工。`,action:s.blades.some(piece=>piece.status==='active')?'next':'settle',label:s.blades.some(piece=>piece.status==='active')?'回到铁砧':'安排收工',subject};
  if(last?.result==='crack')return{title:'裂纹出现了',copy:`这一记后身价为${last.after}。再裂会断，先看看这柄是否仍合纸单。`,action:'inspect',label:'看看这柄的差项',subject};
  if(b?.charge===6)return{title:'锤势已满',copy:'下一次落锤是安全连锻，不会出现裂损。',action:'none',label:'安全连锻',subject};
 }
 const reserved=events.find(e=>e.type==='Reserved');
 if(reserved?.type==='Reserved')return{title:s.reserveId===reserved.pieceId?'这一柄，留给明天':'剑已从架上取回',copy:s.reserveId===reserved.pieceId?'明日一柄旧剑＋两柄新坯。旧剑占一位，取下后也不补第四柄。':'可以继续打造或交给来客；今天的铁坯不会因此补发。',action:'none',label:''};
 const event=events.find(e=>e.type==='EventChoice');
 if(event?.type==='EventChoice')return{title:event.record.choice==='accept'?'选择已经记下':'这一晚，守住手里的剑',copy:event.record.choice==='accept'?'后果与资源已按本次选择结清，收工时可以回看。':'没有额外扣款，可以继续打造当前委托。',action:'none',label:''};
 if(events.some(e=>e.type==='Trait'))return{title:'手艺已放进行囊',copy:'手艺会在符合条件的锤击中生效，可点挂件查看作用。',action:'none',label:''};
 if(events.some(e=>e.type==='Upgraded'))return{title:'下一批铁料，备好了',copy:'新来料底价已提高，当前剑的底价与身价保持原值。',action:'none',label:''};
 if(events.some(e=>e.type==='Repaired'))return{title:'一枚契印，补回来了',copy:'当前契印已增加一枚，这次商人不能重复修补。',action:'none',label:''};
 return null;
}
