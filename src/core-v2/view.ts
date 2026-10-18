import { freezeDeep } from '../core/immutable.js';
import type { HammerMode, RunState, Workpiece, Technique } from './model.js';
import { previewQuench, previewStrike, productionError } from './game.js';
import { CONDITION_NAMES, HAMMERS, marketValue, MATERIALS, PATTERN_NAMES, quotaFor, requestBonus, salvageValue, STAT_NAMES, statAt, TECHNIQUES } from './rules.js';

export function getTrial(piece:Workpiece){
  if(piece.quench===null||piece.status==='broken')return null;
  return freezeDeep({cut:Math.min(8,Math.floor(piece.ratings.edge/3)),block:Math.min(8,Math.floor(piece.ratings.toughness/3)),handling:Math.min(8,Math.floor(piece.ratings.balance/3))});
}
export function getCollection(state:RunState):readonly Workpiece[]{
  const pieces=new Map<string,Workpiece>();for(const summary of state.history)for(const p of summary.pieces)pieces.set(p.id,p);for(const p of state.pieces)pieces.set(p.id,p);
  return freezeDeep(structuredClone([...pieces.values()]));
}
/** Read-only presentation of real activation counters; it never changes the replayed rules. */
function techniqueStatus(state:RunState,piece:Workpiece|null,id:Technique){
  if(state.phase==='merchant'&&state.purchases.some(p=>p.afterRound===state.round&&p.productId===id))return{short:'下轮生效',status:'本次新装入，下一轮开始使用。'};
  if(!piece)return{short:'待上砧',status:'选择一件来料后查看本剑使用次数。'};
  const closed=piece.quench!==null||piece.status!=='active';
  if(id==='edgeTooth')return piece.patterns.includes('edge')?{short:'已生效',status:'本剑巡锋加成已生效；重复锻纹不再次领奖。'}:closed?{short:'已封存',status:'本剑未形成巡锋加成，已经结束加工，不能再触发。'}:{short:'待巡锋',status:'本剑尚未形成巡锋纹，可获得一次加成。'};
  if(id==='bridgeClip')return piece.bridgeUsed?{short:'已使用',status:'本剑水淬防应力已经使用。'}:closed?{short:'已封存',status:'本剑已经结束加工，水淬防应力未使用。'}:piece.patterns.includes('bridge')?{short:'保护就绪',status:'本剑已成游衡纹，水淬不会增加8应力。'}:{short:'待游衡',status:'本剑还需形成游衡纹才能保护水淬。'};
  if(id==='reheatSand')return piece.reheats?{short:'已使用',status:'本剑首回火加韧已使用；再次回火不重发。'}:closed?{short:'已封存',status:'本剑未使用首回火加韧，已经结束加工。'}:{short:'余1次',status:'本剑首回火加韧还可使用1次。'};
  if(id==='warmTongs'){const remaining=Math.max(0,2-piece.heavyStrikes);return{short:closed?`未用${remaining}次`:`余${remaining}次`,status:closed?`本剑已经结束加工，未用的${remaining}次重锤优惠不结转。`:`本剑前两次重锤优惠还剩${remaining}次，已经重锤${piece.heavyStrikes}次。`};}
  if(id==='shardBox')return state.roundBreaks?{short:'本轮已用',status:'本轮首碎补偿机会已用；下一轮重新计次。'}:{short:'待首碎',status:'本轮首件破碎额外补偿尚未使用。'};
  if(piece.quench)return{short:'已封存',status:`本剑已${piece.quench==='oil'?'油':'水'}淬，当前衡${piece.ratings.balance}，不能再淬火。`};
  if(piece.status!=='active')return{short:'已处置',status:'这件来料已经处置，不能再加工或淬火。'};
  const oil=previewQuench(state,piece,'oil'),bonus=oil.allowed?oil.piece.ratings.balance-piece.ratings.balance:0;
  return bonus>0?{short:`油淬+${bonus}衡`,status:`按当前真实预览，油淬会额外增加${bonus}衡。`}:{short:piece.strikes?'待均衡':'先落锤',status:piece.strikes?'当前油淬不会获得额外衡；比较三项性能后再决定。':'先落锤，再检查油淬的均衡条件。'};
}
export function getRunView(state:RunState,options:{pieceId?:string;node?:number;mode?:HammerMode}={}){
  const selected=state.pieces.find(p=>p.id===options.pieceId)??state.pieces[0]??null;
  const node=typeof options.node==='number'&&Number.isInteger(options.node)&&options.node>=0&&options.node<10?options.node:0;
  const mode=options.mode==='light'||options.mode==='heavy'?options.mode:'standard';
  const request=state.requests.find(r=>r.id===state.acceptedRequestId)??null;
  const delivered=state.pieces.reduce((n,p)=>n+p.paidValue,0),quota=quotaFor(state.round);
  const pieces=state.pieces.map(p=>({...p,materialName:MATERIALS[p.material].label,value:marketValue(p),salvage:salvageValue(p,state.condition),trial:getTrial(p)}));
  const current=selected?{
    ...selected,materialName:MATERIALS[selected.material].label,value:marketValue(selected),salvage:salvageValue(selected,state.condition),
    name:`${MATERIALS[selected.material].label}·${selected.patterns.length===3?'三纹名作':selected.patterns.length?selected.patterns.map(p=>PATTERN_NAMES[p]).join('·'):'未定之刃'}`,
    trial:getTrial(selected),requestBonus:request&&state.fulfilledRequestId===null?requestBonus(selected,request,state.condition):0,
    outcomes:(['precise','ordinary','mishit'] as const).map(grade=>({grade,...previewStrike(state,selected,node,mode,grade)})),
    quenches:(['water','oil'] as const).map(medium=>({medium,...previewQuench(state,selected,medium)})),
    productionError:productionError(state,selected),
    nodeViews:selected.nodes.map((used,index)=>({index,used,capacity:6,stat:statAt(index),label:STAT_NAMES[statAt(index)]})),
  }:null;
  return freezeDeep(structuredClone({rulesVersion:state.rulesVersion,runId:state.runId,revision:state.revision,phase:state.phase,round:state.round,totalRounds:12,
    quota,delivered,credit:state.credit,remaining:Math.max(0,quota-delivered-state.credit),coins:state.coins,scrap:state.scrap,coal:state.coal,seals:state.seals,
    condition:state.condition,conditionLabel:state.condition.kind==='reclaimed'&&state.condition.stat?`旧器回炉：${STAT_NAMES[state.condition.stat]}初始+2，底价−4`:state.condition.kind==='urgent'&&state.condition.pattern?`急件：委托额外+20，需${PATTERN_NAMES[state.condition.pattern]}纹`:CONDITION_NAMES[state.condition.kind],starterChosen:state.starterChosen,requestDecided:state.requestDecided,
    requests:state.requests,request,fulfilledRequestId:state.fulfilledRequestId,returns:state.returns,techniques:state.techniques.map(id=>({id,...TECHNIQUES[id],...techniqueStatus(state,selected,id)})),
    merchant:state.merchant.map(id=>({id,...TECHNIQUES[id],owned:state.techniques.includes(id),purchased:state.purchases.some(p=>p.afterRound===state.round&&p.productId===id)})),
    hammer:HAMMERS[mode],mode,node,pieces,selected:current,history:state.history,purchases:state.purchases}));
}
