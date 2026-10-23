import {describe,it,expect} from 'vitest';
import {createRun} from '../../src/core-v7/initial.js';
import {beginEncounter} from '../../src/core-v7/encounters.js';
import {combatError,applyCombat} from '../../src/core-v7/combat.js';
import {mechanismError,applyMechanism} from '../../src/core-v7/mechanisms.js';
import {shopError,applyShop} from '../../src/core-v7/shop.js';
import type {Action,Draft,DomainEvent,EncounterId} from '../../src/core-v7/model.js';
function scene(id:EncounterId,strength=4):Draft{
 const r=createRun({runId:'combat-check',seed:'clear'});if(!r.ok)throw Error(r.error);
 const d=structuredClone(r.state) as Draft;d.weapons[0]!.strength=strength;d.weapons[0]!.sealedStrength=strength;beginEncounter(d,id,[]);return d;
}
function combat(d:Draft,a:Action){expect(combatError(d,a)).toBeNull();const events:DomainEvent[]=[];return{outcome:applyCombat(d,a,events),events};}
function mech(d:Draft,a:Action){expect(mechanismError(d,a)).toBeNull();const events:DomainEvent[]=[];applyMechanism(d,a,events);return events;}
describe('v7 tactical consequences',()=>{
 it('guard opens a real armoured hit, and rounds pay visible pressure only on end',()=>{
  const d=scene('n1');combat(d,{type:'guard'});expect(d.lamp).toBe(8);expect(d.encounter!.actions).toBe(1);
  expect(combatError(d,{type:'guard'})).toBe('guard_already_used');
  const hit=combat(d,{type:'strike',targetId:'wood-guard'});expect(hit.outcome).toBe('completed');expect(d.encounter!.targets[0]!.health).toBe(0);
  const snow=scene('n6');combat(snow,{type:'guard'});combat(snow,{type:'endRound'});
  expect(snow.lamp).toBe(7);expect(snow.encounter).toMatchObject({round:2,actions:2,block:0,opening:true,guarded:false});
 });
 it('a final fissure hit can open the path while really breaking its own sword',()=>{
  const d=scene('n2',1),w=d.weapons[0]!;w.cracked=true;w.fissureMarked=true;
  combat(d,{type:'guard'});const hit=combat(d,{type:'strike',targetId:'bridge-latch'});
  expect(hit.outcome).toBe('completed');expect(w).toMatchObject({strength:0,status:'broken',owner:'none'});expect(d.handId).toBeNull();
  expect(hit.events.some(e=>e.type==='Broken')).toBe(true);expect(combatError(d,{type:'strike',targetId:'bridge-latch'})).not.toBeNull();
 });
 it('stored excess is a free, finite hit and never repeats sword damage',()=>{
  const d=scene('n3-main',8);d.tool={kind:'rebound',level:2,stored:4};
  combat(d,{type:'strike',targetId:'charger'});expect(d.tool.stored).toBe(4);expect(d.encounter!.actions).toBe(1);
  combat(d,{type:'followUp',targetId:'flanker'});expect(d.encounter!.targets[1]!.health).toBe(0);expect(d.encounter!.actions).toBe(1);expect(d.tool.stored).toBe(0);
  expect(combatError(d,{type:'followUp',targetId:'flanker'})).not.toBeNull();
 });
 it('furnace recharge can be spent on limited repair, never beyond sealed strength',()=>{
  const d=scene('n1',6);d.tool={kind:'furnace',level:2,stored:0};d.charge=0;
  combat(d,{type:'guard'});combat(d,{type:'strike',targetId:'wood-guard'});expect(d.charge).toBe(1);
  d.phase='prepare';d.encounter=null;const w=d.weapons[0]!;w.strength=3;w.cracked=true;
  combat(d,{type:'temper',weaponId:w.id});expect(w.strength).toBe(6);expect(w.cracked).toBe(false);expect(d.charge).toBe(0);
  expect(combatError(d,{type:'temper',weaponId:w.id})).not.toBeNull();
 });
 it('a saved crossing alone opens the relay, and a single helper never supplies extra block',()=>{
  const d=scene('n8');d.node=8;d.flags.crossingHeld=true;mech(d,{type:'useSideRoute'});expect(d.encounter!.routeOpened).toBe(true);expect(d.encounter!.actions).toBe(1);
  const final=scene('n9');final.node=9;final.flags.carrier='player';final.encounter!.targets.forEach(t=>{t.health=0;});
  mech(final,{type:'placeCore'});const block=final.encounter!.block;mech(final,{type:'assistBrace'});
  expect(final.encounter).toMatchObject({actions:1,braced:true,block});expect(final.flags.coreOwner).toBe('socket');
  expect(mechanismError(final,{type:'assistBrace'})).not.toBeNull();
  expect(mechanismError(final,{type:'ignite',weaponId:final.handId!})).not.toBeNull();
  final.weapons[0]!.source='forged';mech(final,{type:'ignite',weaponId:final.handId!});expect(final.ending?.kind).toBe('relit');expect(final.weapons[0]!.owner).toBe('lamp');expect(final.handId).toBeNull();
 });
 it('camp purchases debit once and exchanging tools never refunds upgrade eligibility',()=>{
  const d=scene('n1');d.phase='prepare';d.encounter=null;d.coins=10;d.tool={kind:'rebound',level:1,stored:3};
  expect(shopError(d,{type:'shop',item:'coal'})).toBe('at_capacity');
  applyShop(d,{type:'shop',item:'upgrade'},[]);expect(d.coins).toBe(6);expect(d.upgradeUsed).toBe(true);
  applyShop(d,{type:'shop',item:'exchange'},[]);expect(d.coins).toBe(4);expect(d.tool).toEqual({kind:'furnace',level:1,stored:0});
  expect(shopError(d,{type:'shop',item:'upgrade'})).toBe('upgrade_used');
 });
});
