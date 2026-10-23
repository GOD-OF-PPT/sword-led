import {describe,expect,it} from 'vitest';
import {createRun,OLD_SWORD_ID} from '../../src/core-v7/initial.js';
import {applyInventory,detach,handWeapon,inventoryError,retire,usable,weapon} from '../../src/core-v7/inventory.js';
import type {Action,DomainEvent,Draft,Weapon} from '../../src/core-v7/model.js';

function created(){
 const result=createRun({runId:'v7-inventory-contract',seed:'v7-inventory-contract'});
 if(!result.ok)throw new Error('Declared initial input rejected.');
 return result.state;
}
// These are unpublished module scenarios, not legal campaign replays or saved fixtures.
// The cast only removes readonly from a private structured clone of the real initial state.
function draft():Draft{return structuredClone(created()) as Draft;}
function addReserve(state:Draft,id='made-sword'):string{
 const value:Weapon={id,source:'forged',madeInChapter:1,status:'sealed',owner:'player',strength:4,
  sealedStrength:4,hits:4,cracked:false,fissureMarked:false,technique:null};
 state.weapons.push(value);state.reserveId=id;return id;
}
function encounter(state:Draft,node:6|7):void{
 state.node=node;state.phase='encounter';state.encounter={id:node===6?'n6':'n7',round:1,roundLimit:3,
  actions:2,block:3,opening:true,guarded:true,braced:true,braceAssistUsed:false,alanGuard:false,
  reboundClaimed:false,followUpUsed:false,furnaceTriggered:false,routeOpened:false,
  targets:[{id:node===6?'roof-lock':'main-rock',name:'Unit boundary target',role:'mechanism',
   health:8,maxHealth:8,armor:2,pressures:[3,4,5],requiresDestroyed:null}],environment:[4],steps:[]};
}
function accept(state:Draft,action:Action):DomainEvent[]{
 expect(inventoryError(state,action)).toBeNull();const events:DomainEvent[]=[];
 applyInventory(state,action,events);return events;
}
function unchangedByRejection(state:Draft,action:Action,error:string):void{
 const before=structuredClone(state);expect(inventoryError(state,action)).toBe(error);expect(state).toEqual(before);
}

describe('forge-v7 inventory ownership boundaries',()=>{
 it('finds the real initial hand and excludes historical, unavailable and unowned weapons',()=>{
  const initial=created(),state=draft();
  expect(handWeapon(initial)).toBe(weapon(initial,OLD_SWORD_ID));expect(usable(initial,OLD_SWORD_ID)).toBe(true);
  expect(weapon(initial,null)).toBeNull();expect(weapon(initial,'missing')).toBeNull();
  const id=addReserve(state),value=state.weapons.find(item=>item.id===id);
  if(!value)throw new Error('Missing unit reserve.');
  state.reserveId=null;expect(usable(state,id)).toBe(false);state.reserveId=id;
  value.owner='alan';expect(usable(state,id)).toBe(false);value.owner='player';
  value.status='broken';expect(usable(state,id)).toBe(false);value.status='sealed';
  value.strength=0;expect(usable(state,id)).toBe(false);value.strength=4;
  expect(usable(state,id)).toBe(true);expect(initial).toEqual(created());
 });

 it('swaps two owned slots freely in preparation and fills an empty hand without duplication',()=>{
  const initial=created(),state=draft(),id=addReserve(state),rng=structuredClone(state.rng);
  expect(accept(state,{type:'equip',weaponId:id})).toEqual([{type:'Equipped',weaponId:id,previousId:OLD_SWORD_ID,actions:null}]);
  expect(state.handId).toBe(id);expect(state.reserveId).toBe(OLD_SWORD_ID);
  expect(accept(state,{type:'discardWeapon',weaponId:id})).toEqual([{type:'Discarded',weaponId:id}]);
  expect(state.handId).toBeNull();expect(state.reserveId).toBe(OLD_SWORD_ID);expect(usable(state,id)).toBe(false);
  expect(accept(state,{type:'equip',weaponId:OLD_SWORD_ID})).toEqual([{type:'Equipped',weaponId:OLD_SWORD_ID,previousId:null,actions:null}]);
  expect(state.handId).toBe(OLD_SWORD_ID);expect(state.reserveId).toBeNull();
  expect(state.weapons.filter(item=>item.owner==='player').map(item=>item.id)).toEqual([OLD_SWORD_ID]);
  expect(state.rng).toEqual(rng);expect(state.coins).toBe(4);expect(state.charge).toBe(1);expect(initial).toEqual(created());
 });

 it('charges exactly one encounter action for switching and clears only the braced commitment',()=>{
  const state=draft(),id=addReserve(state);encounter(state,7);
  expect(accept(state,{type:'equip',weaponId:id})).toEqual([{type:'Equipped',weaponId:id,previousId:OLD_SWORD_ID,actions:1}]);
  expect(state.encounter).toMatchObject({actions:1,braced:false,block:3,opening:true,guarded:true});
  if(!state.encounter)throw new Error('Missing unit encounter.');state.encounter.actions=0;
  unchangedByRejection(state,{type:'equip',weaponId:OLD_SWORD_ID},'not_enough_actions');
  unchangedByRejection(state,{type:'equip',weaponId:id},'weapon_unavailable');
  unchangedByRejection(state,{type:'discardWeapon',weaponId:id},'wrong_phase');
 });

 it('retires an actual reserve without granting resources and leaves unrelated actions to their owner',()=>{
  const state=draft(),id=addReserve(state),before=structuredClone(state);
  expect(accept(state,{type:'discardWeapon',weaponId:id})).toEqual([{type:'Discarded',weaponId:id}]);
  expect(state.reserveId).toBeNull();expect(weapon(state,id)).toMatchObject({status:'discarded',owner:'none',strength:4});
  expect(state.handId).toBe(OLD_SWORD_ID);expect(state.coins).toBe(before.coins);expect(state.blanks).toBe(before.blanks);
  expect(state.charge).toBe(before.charge);expect(state.rng).toEqual(before.rng);
  unchangedByRejection(state,{type:'discardWeapon',weaponId:id},'weapon_unavailable');
  const unrelated=structuredClone(state),events:DomainEvent[]=[];
  expect(inventoryError(state,{type:'guard'})).toBeNull();applyInventory(state,{type:'guard'},events);
  expect(state).toEqual(unrelated);expect(events).toEqual([]);
 });

 it('can donate either owned slot to the shelter for one action without a kill, charge or reward',()=>{
  for(const useReserve of [false,true]){
   const state=draft(),id=useReserve?addReserve(state):OLD_SWORD_ID;encounter(state,6);
   const before=structuredClone(state),events=accept(state,{type:'donate',weaponId:id,recipient:'shelter'});
   expect(events).toEqual([{type:'Donated',weaponId:id,recipient:'shelter'}]);
   expect(state.flags.shelterSword).toBe(id);expect(weapon(state,id)).toMatchObject({status:'donated',owner:'shelter'});
   expect(state.handId===id||state.reserveId===id).toBe(false);expect(usable(state,id)).toBe(false);
   expect(state.encounter).toMatchObject({actions:1,braced:false,furnaceTriggered:false,reboundClaimed:false});
   expect(state.encounter?.targets).toEqual(before.encounter?.targets);expect(state.encounter?.steps).toEqual([]);
   expect(state.charge).toBe(before.charge);expect(state.coins).toBe(before.coins);expect(state.phase).toBe('encounter');
   expect(state.node).toBe(6);expect(state.nodes).toEqual(before.nodes);expect(state.rng).toEqual(before.rng);
   unchangedByRejection(state,{type:'donate',weaponId:id,recipient:'shelter'},'weapon_unavailable');
  }
 });

 it('requires a positive strong reserve and an unused Alan guard in the correct encounter',()=>{
  const state=draft(),id=addReserve(state);encounter(state,7);
  unchangedByRejection(state,{type:'donate',weaponId:OLD_SWORD_ID,recipient:'alan'},'weapon_unavailable');
  unchangedByRejection(state,{type:'donate',weaponId:id,recipient:'shelter'},'invalid_target');
  const value=state.weapons.find(item=>item.id===id);if(!value||!state.encounter)throw new Error('Missing unit boundary.');
  value.strength=2;unchangedByRejection(state,{type:'donate',weaponId:id,recipient:'alan'},'weapon_unavailable');value.strength=3;
  state.encounter.actions=0;unchangedByRejection(state,{type:'donate',weaponId:id,recipient:'alan'},'not_enough_actions');state.encounter.actions=2;
  const targets=structuredClone(state.encounter.targets);
  expect(accept(state,{type:'donate',weaponId:id,recipient:'alan'})).toEqual([{type:'Donated',weaponId:id,recipient:'alan'}]);
  expect(state.flags.donatedToAlan).toBe(id);expect(state.reserveId).toBeNull();expect(state.handId).toBe(OLD_SWORD_ID);
  expect(weapon(state,id)).toMatchObject({status:'donated',owner:'alan'});
  expect(state.encounter).toMatchObject({actions:1,braced:false,alanGuard:true,furnaceTriggered:false,reboundClaimed:false});
  expect(state.encounter.targets).toEqual(targets);expect(state.charge).toBe(1);expect(state.coins).toBe(4);
  const second=addReserve(state,'another-sword');
  unchangedByRejection(state,{type:'donate',weaponId:second,recipient:'alan'},'unavailable');
 });

 it('detaches both slot references and supports retirement by later ownership commands',()=>{
  const state=draft();state.reserveId=OLD_SWORD_ID;detach(state,OLD_SWORD_ID);
  expect(state.handId).toBeNull();expect(state.reserveId).toBeNull();
  const made=addReserve(state);state.handId=made;state.reserveId=null;retire(state,made,'donated','lamp');
  expect(state.handId).toBeNull();expect(weapon(state,made)).toMatchObject({owner:'lamp',status:'donated',strength:4});
  expect(state.flags.shelterSword).toBeNull();expect(state.flags.donatedToAlan).toBeNull();expect(state.phase).toBe('prepare');
 });
});
