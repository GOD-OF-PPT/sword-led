import {CHAPTERS,COMMISSIONS,commissionProgress,describeRoute} from '../core-v4/index.js';
import type {RunState} from '../core-v4/index.js';
import {freezeDeep} from '../core/immutable.js';

export type JourneyScreen='opening'|'workshop'|'receipt'|'chapter'|'complete'|'defeat'|'future';
const CHAPTER_TWO='/assets/d/v07-chapter2/';

/** A release boundary changes available presentation, never a saved phase or day. */
export function journeyScreen(state:RunState,throughDay=8):JourneyScreen {
  if(state.day>throughDay)return 'future';
  if(state.phase==='defeat')return 'defeat';
  if(state.phase==='opening')return 'opening';
  if(state.phase==='chapter')return 'chapter';
  if(state.phase==='summary')return state.day===throughDay?'complete':'receipt';
  return 'workshop';
}

export function chapterFacts(state:RunState,chapterId:number) {
  const chapter=CHAPTERS.find(c=>c.id===chapterId);
  if(!chapter)throw new RangeError('Unknown journey chapter');
  const [startDay,endDay]=chapter.days;
  const records=state.history.filter(h=>h.day>=startDay!&&h.day<=endDay!);
  const closing=records.find(h=>h.day===endDay);
  return freezeDeep({chapterId:chapter.id,title:chapter.title,startDay:startDay!,endDay:endDay!,
    opening:chapter.opening,letter:chapter.letter,letterAvailable:state.day>=startDay!+2,
    completed:records.filter(h=>h.met).length,days:records.length,
    chapterEndMet:closing?.met??false,chapterResolved:!!closing,chapterEarned:!!closing&&closing.sealsAfter>0,
    closing:closing?{...closing,pieceIds:[...closing.pieceIds],recoveredIds:[...closing.recoveredIds]}:null,
    lamps:Array.from({length:endDay!-startDay!+1},(_,i)=>{
      const day=startDay!+i,commissionId=state.commissionOrder[day-1]!,record=records.find(h=>h.day===day);
      return{day,commissionId,title:COMMISSIONS[commissionId-1]!.title,resolved:!!record,done:record?.met??false};
    })});
}

/** Current counts use the core view; history uses only accepted, finalized receipts. */
export function journeyOutcome(state:RunState,commissionId:number) {
  const commission=COMMISSIONS.find(c=>c.id===commissionId),position=state.commissionOrder.indexOf(commissionId);
  if(!commission||position<0)throw new RangeError('Unknown journey commission');
  const day=position+1,record=state.history.find(h=>h.day===day&&h.commissionId===commissionId);
  const current=day===state.day?commissionProgress(state):null;
  const partialIds=commissionId===8?state.blades.filter(b=>b.status==='commissioned'&&b.commissionId===8&&b.finalizedDay===day).map(b=>b.id):[];
  const historicalRoutes=commission.routes.map(r=>{
    const ids=record?.met&&record.routeId===r.id?[...record.pieceIds]:!record?.met&&commissionId===8?partialIds:[];
    return{id:r.id,required:r.count,count:ids.length,pieceIds:ids,complete:!!record?.met&&record.routeId===r.id};
  });
  const routes=current?.routes??historicalRoutes,complete=current?.complete??record?.met??false;
  const leader=routes.find(r=>r.complete)??routes.reduce((a,b)=>b.count>a.count?b:a);
  const pieceIds=current?(current.complete?[...current.pieceIds]:[...new Set(current.routes.flatMap(r=>r.pieceIds))]):record?.met?[...record.pieceIds]:partialIds;
  const blades=pieceIds.map(id=>({...state.blades.find(b=>b.id===id)!}));
  const count=leader!.count,required=leader!.required;
  let image='/assets/d/v07/lantern-road-v1.webp';
  if(commissionId===4)image=`/assets/d/v07/bridge-${complete?'lit':'dark'}-v1.webp`;
  if(commissionId===5)image=CHAPTER_TWO+(complete?'returning-blade-v1.webp':'winter-forge-v1.webp');
  if(commissionId===6)image=CHAPTER_TWO+(complete?'cracked-work-v1.webp':'winter-forge-v1.webp');
  if(commissionId===7)image=CHAPTER_TWO+(complete?'rescue-path-v1.webp':'winter-forge-v1.webp');
  if(commissionId===8)image=CHAPTER_TWO+`twin-stations-${complete?'lit':count>0?'one':'dark'}-v1.webp`;
  return freezeDeep({commissionId,day,commission,complete,count,required,pieceIds,blades,image,
    settled:!!record,met:record?.met??complete,
    routes:routes.map((r,i)=>({...r,description:describeRoute(commission.routes[i]!)})),
    progressText:routes.map(r=>`${r.count}/${r.required}`).join(' 或 ')});
}
