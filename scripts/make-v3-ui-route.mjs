// Visible-information QA route only. Not a balance model or an in-game autoplayer.
import {createRun,applyCommand,validateRun,quotaFor,merchantPresent,upgradePrice} from '../dist/sword-led-v3.js';
import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const output=process.argv[2];if(!output)throw Error('Pass a new output JSON path');
const repairMode=process.argv[3]==='repair';if(process.argv[3]&&!repairMode)throw Error('Optional third argument is repair');
const rank=['ember','echo','steady','pardon','inherit','crackedEdge'];
function next(s){
 const active=s.blades.filter(b=>b.status==='active'&&b.id!==s.reserveId),reserve=s.blades.find(b=>b.id===s.reserveId);
 if(s.phase==='summary')return{type:'advance'};if(s.phase!=='workshop')return null;
 if(s.gift==='available'){const id=['ember','steady'].find(id=>!s.traits.includes(id));return{type:'claimGift',traitId:id??null};}
 if(merchantPresent(s)){
  if(!s.sold.length&&s.shop.some(id=>!s.traits.includes(id))&&(active.length||reserve)){
   if(reserve)return{type:'reserve',pieceId:reserve.id};
   const traitId=[...s.shop].filter(id=>!s.traits.includes(id)).sort((a,b)=>rank.indexOf(a)-rank.indexOf(b))[0];
   const replaceId=s.traits.length===3?[...s.traits].sort((a,b)=>rank.indexOf(b)-rank.indexOf(a))[0]:undefined;
   return{type:'buy',pieceId:active[0].id,traitId,...(replaceId?{replaceId}:{})};
  }
  if(!s.upgraded&&s.coins>=upgradePrice(s.round))return{type:'upgrade'};
  if(!s.repaired&&s.seals<3&&s.coins>=Math.ceil(quotaFor(s.round)/2))return{type:'repair'};
 }
 if(s.delivered>=quotaFor(s.round)){
  const best=[...active].sort((a,b)=>b.value-a.value)[0];
  if(best&&best.hits<3)return{type:'strike',pieceId:best.id};
  if(best&&best.value>(reserve?.value??0))return{type:'reserve',pieceId:best.id};
  return{type:'settle'};
 }
 const best=[...active].sort((a,b)=>b.value-a.value)[0];
 if(!best)return reserve?{type:'reserve',pieceId:reserve.id}:{type:'settle'};
 return{type:best.value>=quotaFor(s.round)-s.delivered||best.cracked&&best.charge!==6?'deliver':'strike',pieceId:best.id};
}
const attempts=[];let selected;
for(let i=0;i<128;i++){
 const seed=`campaign-${i}`,start=createRun({runId:'campaign-verification',seed,roundLimit:12});if(!start.ok)throw Error(start.error);let s=start.state;const rounds=[],trades=[],upgrades=[],repairs=[];
 if(repairMode){for(const type of ['settle','advance']){const r=applyCommand(s,{runId:s.runId,expectedRevision:s.revision,action:{type}});if(!r.ok)throw Error(r.error);s=r.state;}rounds.push(s.history[0]);}
 for(let step=0;step<1000;step++){const action=next(s);if(!action)break;const before=s,result=applyCommand(s,{runId:s.runId,expectedRevision:s.revision,action});if(!result.ok)throw Error(JSON.stringify({seed,action,error:result.error}));s=result.state;
  if(action.type==='settle')rounds.push(s.history.at(-1));if(action.type==='buy')trades.push({round:s.round,action,previous:before.traits,next:s.traits});if(action.type==='upgrade')upgrades.push({round:s.round,cost:before.coins-s.coins,base:s.base});if(action.type==='repair')repairs.push({round:s.round,cost:before.coins-s.coins});
 }
 const v=validateRun(s);if(!v.ok)throw Error(v.detail);attempts.push({seed,phase:s.phase,round:s.round,commands:s.journal.length,upgrades:upgrades.length,trades:trades.length});
 if(s.phase==='victory'&&upgrades.length===3&&trades.length===3&&trades.some(t=>t.action.replaceId)&&(!repairMode||repairs.length)){
  selected={seed,roundLimit:12,actions:s.journal,finalState:s,rounds,trades,upgrades,repairs};break;
 }
}
if(!selected)throw Error('No route with all required live branches: '+JSON.stringify(attempts));
await writeFile(output,JSON.stringify({purpose:'Real GUI reproduction recipe from visible state; no balance conclusion',attempts,...selected,actionsSha256:createHash('sha256').update(JSON.stringify(selected.actions)).digest('hex')},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({attempts:attempts.length,seed:selected.seed,commands:selected.actions.length,met:selected.rounds.filter(r=>r.met).length,seals:selected.finalState.seals,trades:selected.trades.map(t=>[t.round,t.action.traitId,t.action.replaceId]),upgrades:selected.upgrades}));
