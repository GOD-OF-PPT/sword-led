import {COMMISSIONS,TRAITS,EVENTS,getRunView} from '../core-v5/index.js';
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
export function noticeFromEvents(events:readonly DomainEvent[],s:RunState,before?:RunState):ForgeNotice|null {
 const met=events.find(e=>e.type==='MainCompleted');
 if(met?.type==='MainCompleted')return{title:'这一站，有剑了',copy:COMMISSIONS[met.commissionId-1]!.success,action:s.gift==='available'?'gift':'settle',label:s.gift==='available'?'领一门手艺':'安排余剑与收工'};
 const delivered=events.find(e=>e.type==='Delivered');
 if(delivered?.type==='Delivered'&&delivered.matched){const view=getRunView(s),progress=view.commission.progress,relay=view.commission.id===11;return{title:relay?'接力的第一柄，已经交出':'第一驿，接到剑了',copy:`${progress.routes.map(r=>`${r.count}/${r.required}`).join(' 或 ')} · ${relay?'还可再交一柄合格新剑，或用一柄合格旧剑完成另一条路线。':'还要一柄各自合格的剑，第二站才会亮灯。'}已经交出的剑不会重复计数。`,action:'journey',label:relay?'看看这次接力':'看看驿路的灯'};}
 const strike=events.find(e=>e.type==='Strike');
 if(strike?.type==='Strike'){
  const last=strike.hits.at(-1),b=s.blades.find(b=>b.id===strike.pieceId);
  const subject={runId:s.runId,day:s.day,revision:s.revision,pieceId:strike.pieceId};
  if(last?.result==='broken')return{title:'剑断了，炉火还在',copy:`断剑实得${last.recoveryAmount}铜钱，受今日钱袋限制。左侧还有兵器可继续，也可保留现有成果收工。`,action:s.blades.some(piece=>piece.status==='active')?'next':'settle',label:s.blades.some(piece=>piece.status==='active')?'回到铁砧':'安排收工',subject};
  if(last?.result==='crack')return{title:'裂纹出现了',copy:`这一记后估值为${last.after}。再裂会断，先看看这柄是否仍合纸单。`,action:'inspect',label:'看看这柄的差项',subject};
  if(b?.charge===6)return{title:'锤势已满',copy:'下一次落锤是安全连锻，不会出现裂损。',action:'none',label:'安全连锻',subject};
 }
 const reserved=events.find(e=>e.type==='Reserved');
 if(reserved?.type==='Reserved')return{title:s.reserveId===reserved.pieceId?(s.day===12?'暂放在本局剑架':'这一柄，留给明天'):'剑已从架上取回',copy:s.reserveId===reserved.pieceId?(s.day===12?'这是最后一炉。剑架只保留本局记录，不会把兵器带入新局。':'明日一柄旧剑＋两柄新坯。旧剑占一位，取下后也不补第四柄。'):'可以继续打造或交给来客；今天的铁坯不会因此补发。',action:'none',label:''};
 const coins=before?`铜钱 ${before.coins} → ${s.coins}。`:'';
 const event=events.find(e=>e.type==='EventChoice');
 if(event?.type==='EventChoice'){
  const effect:Record<string,string>={donation:'明日实际新坯底价＋20%；留剑时两柄，不留三柄，旧剑不加料。',loan:'借锤留给明日第一柄新坯，前三记普通锤正收益＋10%。',salvage:'架上的剑已换出，不再带往明日；160铜钱独立入袋。',credit:'保价已待用，下次完好剑首裂保住估值；裂纹仍留下。',shelter:'炉棚照顾明日第一柄新坯，当天裂损率少3个百分点。',rest:'剑和铜钱保持，继续安排这一炉。'};
  return{title:event.record.choice==='accept'?`${EVENTS[event.record.id].name} · 已记妥`:'这一晚，守住手里的剑',copy:event.record.choice==='accept'?coins+effect[event.record.id]:'没有额外扣款，可以继续打造当前委托。',action:'none',label:''};
 }
 const learned=events.find(e=>e.type==='Trait');
 if(learned?.type==='Trait')return{title:learned.traitId?`${TRAITS[learned.traitId].name} · 已入行囊`:'谢礼已折成旅费',copy:learned.traitId?`${before?.traits.find(t=>!s.traits.includes(t))?`换下${TRAITS[before.traits.find(t=>!s.traits.includes(t))!].name}。`:''}${TRAITS[learned.traitId].text} 可点实物查看当前用途。`:coins+`实收${learned.compensation}铜钱。`,action:'none',label:''};
 if(events.some(e=>e.type==='Upgraded')){const old=before?getRunView(before).next:null,next=getRunView(s).next;return{title:'下一批铁料，备好了',copy:coins+`明日普通新坯底价${old?.normalBase??'—'} → ${next?.normalBase??'—'}，只用于新坯。眼前剑和留剑不会涨价。`,action:'shop',label:'再看炉边摊'};}
 if(events.some(e=>e.type==='Repaired'))return{title:'一枚契印，补回来了',copy:coins+`契印 ${before?.seals??s.seals-1}/3 → ${s.seals}/3。修印不补回已经失约的约定。`,action:'shop',label:'再看炉边摊'};
 return null;
}
