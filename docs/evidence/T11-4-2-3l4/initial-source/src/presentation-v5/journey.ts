import {CHAPTERS,COMMISSIONS,commissionProgress,describeRoute,getRunView,routeAssessment} from '../core-v5/index.js';
import type {RunState} from '../core-v5/index.js';
import {freezeDeep} from '../core/immutable.js';

export type JourneyScreen='opening'|'workshop'|'receipt'|'chapter'|'complete'|'ending'|'defeat'|'future';
const CHAPTER_TWO='/assets/d/v07-chapter2/';
const CHAPTER_THREE='/assets/d/v07-chapter3/';

export const CAMPAIGN_GOAL='守住第4、8、12天的关键约定，至少完成10项，并带着契印归来，才能让十二灯复明。';
export const isCriticalDay=(day:number)=>[4,8,12].includes(day);

/** A release boundary changes available presentation, never a saved phase or day. */
export function journeyScreen(state:RunState,throughDay=12):JourneyScreen {
  if(state.day>throughDay)return 'future';
  if(state.phase==='defeat')return 'defeat';
  if(state.phase==='victory'||state.phase==='return')return 'ending';
  if(state.phase==='opening')return 'opening';
  if(state.phase==='chapter')return 'chapter';
  if(state.phase==='summary')return state.day===throughDay?'complete':'receipt';
  return 'workshop';
}

export interface CommissionImageFacts {
  complete:boolean;
  routeId?:string|null;
  count?:number;
  required?:number;
}

/** Shared by the current journey and saved work receipts; no synthetic run is needed. */
export function commissionImage(commissionId:number,{complete,count=0}:CommissionImageFacts):string {
  if(!COMMISSIONS.some(c=>c.id===commissionId))throw new RangeError('Unknown journey commission');
  if(commissionId===4)return `/assets/d/v07/bridge-${complete?'lit':'dark'}-v1.webp`;
  if(commissionId===5)return CHAPTER_TWO+(complete?'returning-blade-v1.webp':'winter-forge-v1.webp');
  if(commissionId===6)return CHAPTER_TWO+(complete?'cracked-work-v1.webp':'winter-forge-v1.webp');
  if(commissionId===7)return CHAPTER_TWO+(complete?'rescue-path-v1.webp':'winter-forge-v1.webp');
  if(commissionId===8)return CHAPTER_TWO+`twin-stations-${complete?'lit':count>0?'one':'dark'}-v1.webp`;
  if(commissionId===9)return CHAPTER_THREE+(complete?'double-fire-work-v1.webp':'mountain-pass-arrival-v1.webp');
  if(commissionId===10)return CHAPTER_THREE+(complete?'mountain-gap-held-v1.webp':'mountain-pass-arrival-v1.webp');
  if(commissionId===11)return CHAPTER_THREE+(complete?'relay-complete-v1.webp':count>0?'relay-one-v1.webp':'mountain-pass-arrival-v1.webp');
  if(commissionId===12)return CHAPTER_THREE+(complete?'last-lantern-delivered-v1.webp':'mountain-pass-arrival-v1.webp');
  return '/assets/d/v07/lantern-road-v1.webp';
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

/** Winning pieces and all matching deliveries stay distinct, including a missed multi-piece route. */
export function journeyOutcome(state:RunState,commissionId:number) {
  const source=COMMISSIONS.find(c=>c.id===commissionId),position=state.commissionOrder.indexOf(commissionId);
  if(!source||position<0)throw new RangeError('Unknown journey commission');
  const commission={...source,request:source.request.replaceAll('昨日','此前')};
  const day=position+1,record=state.history.find(h=>h.day===day&&h.commissionId===commissionId);
  const current=day===state.day&&!record?commissionProgress(state):null;
  const deliveryOrder=new Map(state.journal.flatMap((a,i)=>a.type==='deliver'?[[a.pieceId,i] as const]:[]));
  const delivered=state.blades.filter(b=>b.status==='commissioned'&&b.commissionId===commissionId&&b.finalizedDay===day)
    .sort((a,b)=>(deliveryOrder.get(a.id)??Number.MAX_SAFE_INTEGER)-(deliveryOrder.get(b.id)??Number.MAX_SAFE_INTEGER));
  const historicalRoutes=commission.routes.map(r=>{
    const ids=delivered.filter(b=>routeAssessment({day},b,r).matches).map(b=>b.id);
    return{id:r.id,required:r.count,count:ids.length,pieceIds:ids,complete:ids.length>=r.count};
  });
  const routes=current?.routes??historicalRoutes,complete=current?.complete??record?.met??false;
  const routeId=current?.routeId??record?.routeId??null;
  const leader=routes.find(r=>r.id===routeId)??routes.find(r=>r.complete)??routes.reduce((a,b)=>b.count>a.count?b:a);
  const pieceIds=current?[...current.pieceIds]:record?.met?[...record.pieceIds]:[];
  const matchedPieceIds=[...new Set(routes.flatMap(r=>r.pieceIds))].sort((a,b)=>(deliveryOrder.get(a)??Number.MAX_SAFE_INTEGER)-(deliveryOrder.get(b)??Number.MAX_SAFE_INTEGER));
  const blades=pieceIds.map(id=>({...state.blades.find(b=>b.id===id)!})),matchedBlades=matchedPieceIds.map(id=>({...state.blades.find(b=>b.id===id)!}));
  const count=leader!.count,required=leader!.required;
  const image=commissionImage(commissionId,{complete,routeId,count,required});
  return freezeDeep({commissionId,day,commission,complete,routeId,count,required,pieceIds,matchedPieceIds,blades,matchedBlades,image,
    settled:!!record,met:record?.met??complete,
    routes:routes.map((r,i)=>({...r,description:describeRoute(commission.routes[i]!)})),
    progressText:routes.map(r=>`${r.count}/${r.required}`).join(' 或 ')});
}

/** The core decides the ending. This read-only copy adds actual route and character memories. */
export function endingFacts(input:RunState) {
  if(input.phase!=='victory'&&input.phase!=='return'&&input.phase!=='defeat')return null;
  const state:RunState=structuredClone(input),view=getRunView(state),ending=view.ending!;
  const lamps=state.commissionOrder.map(commissionId=>{
    const outcome=journeyOutcome(state,commissionId);
    return {...outcome,status:outcome.settled?(outcome.met?'met' as const:'missed' as const):'unreached' as const};
  });
  const people=[
    {name:'阿岚',customer:'guard',commissionIds:[1,4,7,10]},
    {name:'阿禾',customer:'courier',commissionIds:[2,5,8,11]},
    {name:'杜伯',customer:'smith',commissionIds:[3,6,9,12]},
  ].map(person=>{
    const records=person.commissionIds.map(id=>lamps.find(lamp=>lamp.commissionId===id)!);
    const completed=records.filter(record=>record.status==='met').length;
    const met=(id:number)=>records.find(record=>record.commissionId===id)?.status==='met';
    const reached=(id:number)=>records.find(record=>record.commissionId===id)?.status!=='unreached';
    let afterword='';
    if(person.customer==='guard')afterword=met(4)&&met(10)?'渡口有人巡守，山口也有剑守着。你送来的每一柄，我都交到了等它的人手里。':met(4)?'渡口的灯守住了。山口还没接上的那一段，我会记着，等你下次来。':met(10)?'缺口前的护刃已经在岗。渡口留下的遗憾，也不会因为这一柄好剑被抹去。':completed?'你已经做成的巡剑，我会继续带着。还没点亮的地方，等下一炉。':'这一程还没等到合格的巡剑。灯站还在这里，等你下一炉再来。';
    if(person.customer==='courier')afterword=met(8)&&met(11)?'两条驿路都有了剑，最后的接力也送到了。归去的信，这回可以走同一条灯路。':met(8)?'双驿的两柄轻刃都到了。最后的接力还没接完，我会把这封信留着。':met(11)?'最后的接力接上了。双驿没能齐亮的那一夜，也留在信里。':records.some(record=>record.commissionId===8&&record.matchedBlades.length>0)?'你送到双驿的那一柄已经有人带走；另一站还在等，不能把一柄剑说成两柄。':completed?'送到过的剑和信，我都收妥了。没有走完的路，留待下一程。':'这次驿路还没等到合格的剑。信留着，下一程再接。';
    if(person.customer==='smith')afterword=met(12)?'护灯剑已经送到。锻纹、火候，还有你肯停手的那一刻，这柄剑都记住了。':!reached(12)?'这一程还没走到护灯的山口。炉谱只记已经学会的手艺，不替你写下尚未走到的结果。':met(9)?'两次连锻的回响我听见了。最后的护灯剑还差一点，但学会的火候不会白费。':completed?'护灯剑还没有做成。已经交来的作品我会留下，让下一炉有个可回看的起点。':'这次还没有收到合格的作品。炉火可以再起，不必把没做成的剑说成成品。';
    return {...person,records,afterword,completed,
      missed:records.filter(r=>r.status==='missed').length,unreached:records.filter(r=>r.status==='unreached').length};
  });
  const image=CHAPTER_THREE+(state.phase==='victory'?'ending-twelve-lights-v1.webp':state.phase==='return'?'ending-homeward-v1.webp':'ending-embers-v1.webp');
  return freezeDeep({...ending,phase:state.phase,image,lamps,people,
    works:lamps.filter(lamp=>lamp.met).map(lamp=>({commissionId:lamp.commissionId,day:lamp.day,routeId:lamp.routeId,pieceIds:[...lamp.pieceIds],blades:lamp.blades.map(b=>({...b}))})),
    chapters:view.collection.chapters.slice(),mastery:view.collection.mastery.slice(),traits:view.collection.traits.slice()});
}
