import {describe,it,expect} from 'vitest';
import {createRun} from '../../src/core-v7/initial.js';
import {applyForge,forgeError} from '../../src/core-v7/forge.js';
import type {ForgeAction} from '../../src/core-v7/forge.js';
import type {Draft,DomainEvent} from '../../src/core-v7/model.js';
import {nextRandom} from '../../src/core/random.js';
function start():Draft{const r=createRun({runId:'forge-check',seed:'safe'});if(!r.ok)throw Error(r.error);return structuredClone(r.state) as Draft;}
function act(d:Draft,a:ForgeAction){expect(forgeError(d,a)).toBeNull();const e:DomainEvent[]=[];applyForge(d,a,e);return e;}
describe('v7 shared forge supply and ownership',()=>{
 it('three ordinary safe hits still draw, then a technique spends the shared charge without drawing',()=>{
  const d=start();act(d,{type:'beginForge'});const id=d.forgeId!;
  for(let i=0;i<3;i++)act(d,{type:'forge',weaponId:id,kind:'ordinary'});
  expect(d.weapons.at(-1)).toMatchObject({strength:3,cracked:false,hits:3});expect(d.rng.draws).toBe(3);
  act(d,{type:'forge',weaponId:id,kind:'steady'});expect(d.rng.draws).toBe(3);expect(d.charge).toBe(0);
  act(d,{type:'seal',weaponId:id,slot:'reserve',replace:false});act(d,{type:'beginForge'});
  expect(d.blanks).toBe(1);expect(d.charge).toBe(0);
  expect(forgeError(d,{type:'forge',weaponId:d.forgeId!,kind:'fissure'})).toBe('no_charge');
 });
 it('first crack loses one and a second crack really removes the forging blade',()=>{
  const d=start();act(d,{type:'beginForge'});const id=d.forgeId!,w=d.weapons.at(-1)!;
  w.strength=3;w.hits=3;
  let state=0;while(Math.floor(nextRandom({state,draws:0}).value*1000)>=200)state++;
  d.rng={state,draws:3};act(d,{type:'forge',weaponId:id,kind:'ordinary'});
  expect(w).toMatchObject({strength:2,cracked:true,status:'forging'});
  d.rng={state,draws:4};const events=act(d,{type:'forge',weaponId:id,kind:'ordinary'});
  expect(w).toMatchObject({strength:2,status:'broken',owner:'none'});expect(d.forgeId).toBeNull();expect(d.phase).toBe('prepare');
  expect(events.at(-1)).toEqual({type:'Broken',weaponId:id});
 });
 it('seal requires explicit replacement and retires the actual old sword',()=>{
  const d=start();const old=d.handId;act(d,{type:'beginForge'});const id=d.forgeId!;
  act(d,{type:'forge',weaponId:id,kind:'fissure'});
  expect(forgeError(d,{type:'seal',weaponId:id,slot:'hand',replace:false})).toBe('slot_occupied');
  act(d,{type:'seal',weaponId:id,slot:'hand',replace:true});
  expect(d.weapons.find(w=>w.id===old)).toMatchObject({status:'discarded',owner:'none'});
  expect(d.handId).toBe(id);expect(d.weapons.at(-1)).toMatchObject({sealedStrength:3,owner:'player',fissureMarked:true});
 });
});
