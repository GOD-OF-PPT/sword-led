import {beginEncounter} from './encounters.js';
import {OLD_SWORD_ID} from './initial.js';
import {retire,usable} from './inventory.js';
import {archiveEncounter,finalEligible,setCheckpoint} from './journey.js';
import type {Action,Chapter,ChoiceId,ChoiceKind,DomainEvent,Draft,ErrorCode,NodeId,RunState} from './model.js';

const CHOICES:Readonly<Record<ChoiceKind,readonly ChoiceId[]>>={
 'first-road':['escort','salvage'],
 'bridge-rescue':['rescue-ferryman','save-cargo'],
 'bridge-tool':['take-rebound','take-furnace'],
 'crossing-extra':['leave-crossing','hold-crossing'],
 'camp-old-sword':['keep-old','dismantle-old','pay-upgrade'],
 'station-first':['north-first','south-first'],
 'station-second':['leave-station','continue-station'],
 'shelter-ring':['take-ring','leave-ring'],
 'relay-carrier':['courier-carries','player-carries'],
};
const CHOICE_NODES:Readonly<Record<ChoiceKind,NodeId>>={
 'first-road':1,'bridge-rescue':2,'bridge-tool':2,'crossing-extra':3,'camp-old-sword':4,
 'station-first':5,'station-second':5,'shelter-ring':6,'relay-carrier':8,
};

function oldSwordOwned(state:RunState):boolean{
 return usable(state,OLD_SWORD_ID)&&state.weapons.some(value=>value.id===OLD_SWORD_ID&&value.source==='inherited');
}

function nodeRecord(draft:Draft):Draft['nodes'][number]{
 let record=draft.nodes.find(value=>value.node===draft.node);
 if(!record){record={node:draft.node,choices:[],coinsEarned:0,completed:false};draft.nodes.push(record);}
 return record;
}

/** Completion is separate from leaving a node so its choices retain their original owner. */
export function completeNode(draft:Draft,events:DomainEvent[]):void{
 const record=nodeRecord(draft);
 if(record.completed)return;
 record.completed=true;
 events.push({type:'NodeCompleted',node:draft.node});
}

function coins(draft:Draft,amount:number,reason:string,events:DomainEvent[]):void{
 draft.coins+=amount;
 if(amount>0)nodeRecord(draft).coinsEarned+=amount;
 events.push({type:'CoinsChanged',amount,total:draft.coins,reason});
}

function light(draft:Draft,amount:number,reason:string,events:DomainEvent[]):void{
 draft.lamp+=amount;
 events.push({type:'LightChanged',amount,total:draft.lamp,reason});
}

function offer(draft:Draft,choice:ChoiceKind):void{
 draft.phase='choice';draft.choice=choice;
}

function prepareNode(draft:Draft,node:NodeId,events:DomainEvent[]):void{
 const chapter=Math.ceil(node/3) as Chapter;
 const startsChapter=chapter!==draft.chapter;
 draft.chapter=chapter;draft.node=node;draft.phase='prepare';draft.choice=null;
 nodeRecord(draft);
 if(startsChapter){
  const lampBefore=draft.lamp,blanksBefore=draft.blanks;
  draft.lamp=Math.min(8,draft.lamp+3);draft.blanks=3;draft.charge=1;
  if(node===4&&oldSwordOwned(draft))draft.choice='camp-old-sword';
  events.push({type:'ChapterStarted',chapter,lampBefore,lampAfter:draft.lamp,blanksBefore,blanksAfter:draft.blanks});
  if(draft.lamp!==lampBefore)events.push({type:'LightChanged',amount:draft.lamp-lampBefore,total:draft.lamp,reason:'chapter-supply'});
  setCheckpoint(draft);
 }
}

/** A discarded or replaced inherited sword cannot leave a phantom camp decision behind. */
export function syncPreparation(draft:Draft):void{
 if(draft.node===4&&draft.choice==='camp-old-sword'&&!oldSwordOwned(draft))draft.choice=null;
}

export function campaignError(state:RunState,action:Action):ErrorCode|null{
 if(action.type==='depart'){
  if(state.phase!=='prepare')return'wrong_phase';
  if(state.node===4&&state.choice==='camp-old-sword')return'not_ready';
  if(state.node===9&&![state.handId,state.reserveId].some(id=>id!==null&&finalEligible(state,id)))return'weapon_unavailable';
  return null;
 }
 if(action.type!=='choose')return null;
 const kind=state.choice;
 if(kind==='camp-old-sword'){
  if(state.phase!=='prepare')return'wrong_phase';
 }else if(state.phase!=='choice')return'wrong_phase';
 if(!kind||CHOICE_NODES[kind]!==state.node||!CHOICES[kind].includes(action.choice))return'choice_unavailable';
 switch(action.choice){
  case'salvage':return state.lamp>=2?null:'not_enough_light';
  case'keep-old':return oldSwordOwned(state)?null:'weapon_unavailable';
  case'dismantle-old':case'pay-upgrade':
   if(!oldSwordOwned(state))return'weapon_unavailable';
   if(!state.tool)return'no_tool';
   if(state.upgradeUsed||state.tool.level!==1)return'upgrade_used';
   return action.choice==='pay-upgrade'&&state.coins<4?'not_enough_coins':null;
  case'leave-station':case'continue-station':
   if(state.flags.northSaved===state.flags.southSaved)return'choice_unavailable';
   return action.choice==='continue-station'&&!state.flags.ferrymanSaved&&state.lamp<2?'not_enough_light':null;
  default:return null;
 }
}

/** Applies only checked departures and one-time story decisions on the private command draft. */
export function applyCampaign(draft:Draft,action:Action,events:DomainEvent[]):void{
 if(action.type==='depart'){
  nodeRecord(draft);
  switch(draft.node){
   case 1:beginEncounter(draft,'n1',events);break;
   case 2:beginEncounter(draft,'n2',events);break;
   case 3:beginEncounter(draft,'n3-main',events);break;
   case 4:completeNode(draft,events);prepareNode(draft,5,events);break;
   case 5:offer(draft,'station-first');break;
   case 6:beginEncounter(draft,'n6',events);break;
   case 7:beginEncounter(draft,'n7',events);break;
   case 8:offer(draft,'relay-carrier');break;
   case 9:beginEncounter(draft,'n9',events);break;
  }
  return;
 }
 if(action.type!=='choose')return;
 nodeRecord(draft).choices.push(action.choice);
 events.push({type:'ChoiceMade',choice:action.choice,node:draft.node});
 switch(action.choice){
  case'escort':case'salvage':
   draft.flags.escortFirst=action.choice==='escort';
   if(action.choice==='salvage'){
    light(draft,-1,'first-road-salvage',events);coins(draft,3,'first-road-salvage',events);
   }
   completeNode(draft,events);prepareNode(draft,2,events);
   break;
  case'rescue-ferryman':case'save-cargo':
   draft.flags.ferrymanSaved=action.choice==='rescue-ferryman';
   if(action.choice==='save-cargo')coins(draft,5,'bridge-cargo',events);
   offer(draft,'bridge-tool');
   break;
  case'take-rebound':case'take-furnace':{
   const kind=action.choice==='take-rebound'?'rebound':'furnace';
   draft.tool={kind,level:1,stored:0};
   events.push({type:'ToolChanged',kind,level:1});
   completeNode(draft,events);prepareNode(draft,3,events);
   break;
  }
  case'leave-crossing':
   completeNode(draft,events);prepareNode(draft,4,events);
   break;
  case'hold-crossing':beginEncounter(draft,'n3-extra',events);break;
  case'keep-old':
   draft.flags.oldDecision='kept';draft.choice=null;
   break;
  case'dismantle-old':case'pay-upgrade':
   if(!draft.tool)throw new Error('The old-sword decision requires an owned tool.');
   if(action.choice==='dismantle-old'){
    retire(draft,OLD_SWORD_ID,'discarded','none');draft.flags.oldDecision='dismantled';
    events.push({type:'Donated',weaponId:OLD_SWORD_ID,recipient:'upgrade'});
   }else{
    coins(draft,-4,'camp-upgrade',events);draft.flags.oldDecision='paid';
   }
   draft.tool.level=2;draft.upgradeUsed=true;draft.choice=null;
   events.push({type:'ToolChanged',kind:draft.tool.kind,level:2});
   break;
  case'north-first':case'south-first':
   draft.flags.firstStation=action.choice==='north-first'?'north':'south';
   beginEncounter(draft,action.choice==='north-first'?'n5-north':'n5-south',events);
   break;
  case'leave-station':
   completeNode(draft,events);prepareNode(draft,6,events);
   break;
  case'continue-station':
   if(!draft.flags.ferrymanSaved)light(draft,-1,'station-travel',events);
   beginEncounter(draft,draft.flags.northSaved?'n5-south':'n5-north',events);
   break;
  case'take-ring':case'leave-ring':
   draft.flags.ring=action.choice==='take-ring'?'taken':'left';
   completeNode(draft,events);prepareNode(draft,7,events);
   break;
  case'courier-carries':case'player-carries':
   draft.flags.carrier=action.choice==='courier-carries'?'courier':'player';
   draft.flags.coreOwner=draft.flags.carrier;
   beginEncounter(draft,'n8',events);
   break;
 }
}

/** The command owner calls this once after a completed physical encounter, including sword wear. */
export function finishEncounter(draft:Draft,events:DomainEvent[]):void{
 const encounter=draft.encounter;
 if(!encounter||draft.phase!=='encounter'||encounter.id==='n9')return;
 const id=encounter.id;
 archiveEncounter(draft,'completed');
 events.push({type:'EncounterCompleted',encounterId:id,lamp:draft.lamp});
 switch(id){
  case'n1':coins(draft,2,'encounter-n1',events);offer(draft,'first-road');break;
  case'n2':offer(draft,'bridge-rescue');break;
  case'n3-main':coins(draft,3,'encounter-n3-main',events);offer(draft,'crossing-extra');break;
  case'n3-extra':
   draft.flags.crossingHeld=true;coins(draft,2,'encounter-n3-extra',events);
   completeNode(draft,events);prepareNode(draft,4,events);
   break;
  case'n5-north':case'n5-south':
   if(id==='n5-north')draft.flags.northSaved=true;else draft.flags.southSaved=true;
   coins(draft,2,'encounter-'+id,events);
   if(draft.flags.northSaved&&draft.flags.southSaved){completeNode(draft,events);prepareNode(draft,6,events);}
   else offer(draft,'station-second');
   break;
  case'n6':offer(draft,'shelter-ring');break;
  case'n7':
   coins(draft,2,'encounter-n7',events);completeNode(draft,events);prepareNode(draft,8,events);
   break;
  case'n8':
   if(draft.flags.carrier==='courier')draft.flags.coreOwner='socket';
   completeNode(draft,events);prepareNode(draft,9,events);
   break;
 }
}
