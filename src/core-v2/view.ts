import { freezeDeep } from '../core/immutable.js';
import type { HammerMode, RunState, Workpiece } from './model.js';
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
    requests:state.requests,request,fulfilledRequestId:state.fulfilledRequestId,returns:state.returns,techniques:state.techniques.map(id=>({id,...TECHNIQUES[id]})),
    merchant:state.merchant.map(id=>({id,...TECHNIQUES[id],owned:state.techniques.includes(id),purchased:state.purchases.some(p=>p.afterRound===state.round&&p.productId===id)})),
    hammer:HAMMERS[mode],mode,node,pieces,selected:current,history:state.history,purchases:state.purchases}));
}
