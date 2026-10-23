import type {DomainEvent,Draft,Encounter,EncounterId,EncounterTarget,Mutable,PlayableState,TargetId} from './model.js';

export type EncounterOutcome='completed'|'light-exhausted'|'round-limit'|null;
const target=(id:TargetId,name:string,health:number,armor:number,pressures:number[]=[],requiresDestroyed:TargetId|null=null):EncounterTarget=>
 ({id,name,health,maxHealth:health,armor,pressures,role:pressures.length?'threat':'mechanism',requiresDestroyed});

/** Authored encounters share a turn vocabulary, but have different objectives and exits. */
export function createEncounter(state:PlayableState,id:EncounterId):Encounter{
 let targets:EncounterTarget[]=[],environment:number[]=[],roundLimit=3;
 switch(id){
  case'n1':targets=[target('wood-guard','巡路木卫',6,2,[2,2,3])];break;
  case'n2':targets=[target('bridge-latch','断桥铁闩',5,2)];environment=[2,3,3];break;
  case'n3-main':targets=[target('charger','冲阵者',5,1,[3,0,3]),target('flanker','绕行者',4,0,[0,3,4])];break;
  case'n3-extra':targets=[target('rammer','撞桩者',8,2,[5])];roundLimit=1;break;
  case'n5-north':targets=[target('north-latch','北驿门闩',6,1)];environment=[state.flags.firstStation==='north'?2:3];roundLimit=2;break;
  case'n5-south':targets=[target('south-latch','南驿障锁',6,2)];environment=[state.flags.firstStation==='south'?2:3];roundLimit=2;break;
  case'n6':targets=[target('roof-lock','失控顶锁',10,2)];environment=[4];break;
  case'n7':{
   const loose=target('loose-rock','散落碎石',4,0,[1,2,2]);
   targets=[target('main-rock','主落石',8,2,[3,4,5]),state.flags.northSaved&&state.flags.ring==='left'?{...loose,health:0}:loose];break;
  }
  case'n8':targets=[target('relay-latch','山口铁闩',8,2)];environment=[3];break;
  case'n9':targets=[target('drive-lock','传动锁',4,0),target('reverse-wheel','逆转轮',10,2,[],'drive-lock')];environment=[2,4,5,6,6];roundLimit=5;break;
 }
 return{id,round:1,roundLimit,actions:2,block:id==='n9'&&state.flags.carrier==='courier'?2:0,
  opening:false,guarded:false,braced:false,braceAssistUsed:false,alanGuard:false,reboundClaimed:false,
  followUpUsed:false,furnaceTriggered:false,routeOpened:false,targets,environment,steps:[]};
}

export function beginEncounter(draft:Draft,id:EncounterId,events:DomainEvent[]):void{
 draft.encounter=structuredClone(createEncounter(draft,id)) as Mutable<Encounter>;draft.phase='encounter';draft.choice=null;
 events.push({type:'EncounterStarted',encounterId:id,node:draft.node});
}

export function legalTarget(state:PlayableState,id:TargetId):EncounterTarget|null{
 const encounter=state.encounter;if(!encounter)return null;
 const value=encounter.targets.find(t=>t.id===id);if(!value||value.health<=0)return null;
 if(value.requiresDestroyed&&encounter.targets.some(t=>t.id===value.requiresDestroyed&&t.health>0))return null;
 return value;
}
function at(values:readonly number[],round:number):number{return values.length?values[Math.min(round-1,values.length-1)]!:0;}
export function pressurePreview(state:PlayableState):{pressure:number;reduction:number;block:number;loss:number}{
 const e=state.encounter;if(!e)return{pressure:0,reduction:0,block:0,loss:0};
 const pressure=e.targets.reduce((sum,t)=>sum+(t.health>0?at(t.pressures,e.round):0),0)+at(e.environment,e.round);
 const reduction=(e.id==='n3-main'&&e.round===1&&state.flags.escortFirst?1:0)+(e.alanGuard?2:0)+(e.id==='n9'&&state.flags.ring==='taken'?2:0);
 return{pressure,reduction,block:e.block,loss:Math.max(0,pressure-reduction-e.block)};
}

/** Called after the physical action/wear; an ended round pays pressure before survival wins. */
export function encounterOutcome(state:PlayableState,endedRound=false):EncounterOutcome{
 const e=state.encounter;if(!e||state.phase!=='encounter')return null;
 if(state.lamp<=0)return'light-exhausted';
 const allClear=e.targets.every(t=>t.health===0);
 if(e.id==='n6'&&state.flags.shelterSword!==null)return'completed';
 if(e.id!=='n9'&&(allClear||e.routeOpened))return'completed';
 if(endedRound&&e.round>=e.roundLimit){
  if(e.id==='n3-main'||e.id==='n3-extra'||e.id==='n7')return'completed';
  return'round-limit';
 }
 return null;
}
