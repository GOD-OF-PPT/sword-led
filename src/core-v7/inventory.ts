import type {Action,DomainEvent,Draft,ErrorCode,PlayableState,RunState,Weapon} from './model.js';

export function weapon(state:Pick<PlayableState,'weapons'>,id:string|null):Weapon|null{
 return id===null?null:state.weapons.find(value=>value.id===id)??null;
}

export function handWeapon(state:PlayableState):Weapon|null{
 return weapon(state,state.handId);
}

/** Historical weapons remain in the record; only the player's two live slots are usable. */
export function usable(state:PlayableState,id:string|null):boolean{
 const value=weapon(state,id);
 return value!==null&&value.owner==='player'&&value.status==='sealed'&&value.strength>0&&
  (state.handId===value.id||state.reserveId===value.id);
}

export function detach(draft:Draft,id:string):void{
 if(draft.handId===id)draft.handId=null;
 if(draft.reserveId===id)draft.reserveId=null;
}

/** Callers own strength changes and event choice; retiring never grants a reward. */
export function retire(draft:Draft,id:string,status:'discarded'|'broken'|'donated',owner:'none'|'alan'|'shelter'|'lamp'):void{
 const value=draft.weapons.find(item=>item.id===id);
 if(!value)throw new Error('Cannot retire an unknown weapon.');
 detach(draft,id);
 value.status=status;
 value.owner=owner;
}

export function inventoryError(state:RunState,action:Action):ErrorCode|null{
 switch(action.type){
  case'equip':
   if(state.phase!=='prepare'&&state.phase!=='encounter')return'wrong_phase';
   if(!usable(state,action.weaponId)||state.handId===action.weaponId)return'weapon_unavailable';
   if(state.phase==='encounter'){
    if(!state.encounter)return'wrong_phase';
    if(state.encounter.actions<1)return'not_enough_actions';
   }
   return null;
  case'discardWeapon':
   if(state.phase!=='prepare')return'wrong_phase';
   return usable(state,action.weaponId)?null:'weapon_unavailable';
  case'donate':{
   if(state.phase!=='encounter'||!state.encounter)return'wrong_phase';
   const value=weapon(state,action.weaponId);
   if(!usable(state,action.weaponId)||!value||value.strength<3)return'weapon_unavailable';
   if(action.recipient==='shelter'){
    if(state.node!==6||state.encounter.id!=='n6')return'invalid_target';
    if(state.flags.shelterSword!==null)return'unavailable';
   }else{
    if(state.node!==7||state.encounter.id!=='n7')return'invalid_target';
    if(state.reserveId!==action.weaponId)return'weapon_unavailable';
    if(state.encounter.alanGuard||state.flags.donatedToAlan!==null)return'unavailable';
   }
   return state.encounter.actions<1?'not_enough_actions':null;
  }
  default:return null;
 }
}

function spendAction(draft:Draft):number{
 const encounter=draft.encounter;
 if(!encounter)throw new Error('Inventory action requires an encounter.');
 encounter.actions--;
 encounter.braced=false;
 return encounter.actions;
}

/** Mutates only a private draft, after the command owner accepts inventoryError === null. */
export function applyInventory(draft:Draft,action:Action,events:DomainEvent[]):void{
 switch(action.type){
  case'equip':{
   const previousId=draft.handId;
   const actions=draft.phase==='encounter'?spendAction(draft):null;
   draft.handId=action.weaponId;
   draft.reserveId=previousId;
   if(draft.encounter)draft.encounter.braced=false;
   events.push({type:'Equipped',weaponId:action.weaponId,previousId,actions});
   break;
  }
  case'discardWeapon':
   retire(draft,action.weaponId,'discarded','none');
   events.push({type:'Discarded',weaponId:action.weaponId});
   break;
  case'donate':
   // Retire first so a broken internal caller cannot spend an action on an unknown ID.
   retire(draft,action.weaponId,'donated',action.recipient);
   spendAction(draft);
   if(action.recipient==='shelter')draft.flags.shelterSword=action.weaponId;
   else{
    draft.flags.donatedToAlan=action.weaponId;
    if(!draft.encounter)throw new Error('Alan guard requires an encounter.');
    draft.encounter.alanGuard=true;
   }
   events.push({type:'Donated',weaponId:action.weaponId,recipient:action.recipient});
   break;
  default:break;
 }
}
