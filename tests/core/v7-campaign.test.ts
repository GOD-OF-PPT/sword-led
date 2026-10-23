import {describe,it,expect} from 'vitest';
import {applyCommand} from '../../src/core-v7/game.js';
import type {RunState} from '../../src/core-v7/model.js';
import {run,plainRoute,fissureRoute} from './v7-routes.js';
describe('v7 entire authored journey through real commands',()=>{
 it('keeps a plain blade, rescues both stations, gives real swords away and relights the mother lamp',()=>{
  const{r,blade,backup}=plainRoute(),a=r.act;
  expect(r.state.node).toBe(9);expect(r.state.flags.coreOwner).toBe('socket');
  a({type:'depart'});a({type:'strike',targetId:'drive-lock'});a({type:'guard'});a({type:'endRound'});
  a({type:'strike',targetId:'reverse-wheel'});a({type:'guard'});a({type:'endRound'});
  a({type:'strike',targetId:'reverse-wheel'});a({type:'guard'});a({type:'endRound'});a({type:'ignite',weaponId:blade});
  expect(r.state.ending).toEqual({kind:'relit',node:9,dedicatedWeaponId:blade});
  expect(r.state.nodes.filter(n=>n.completed)).toHaveLength(9);
  expect(r.state.weapons.find(w=>w.id===backup)!.owner).toBe('alan');expect(r.state.weapons.find(w=>w.id==='du-old-sword')!.owner).toBe('shelter');
  expect(r.state.lamp).toBeGreaterThan(0);expect(Object.isFrozen(r.state)).toBe(true);
 });
 it('uses a safe six-strength fissure with furnace repair, carries the core and gets a distinct real ending state',()=>{
  const{r,blade}=fissureRoute(),a=r.act;
  expect(r.state.node).toBe(9);expect(r.state.charge).toBe(1);expect(r.state.weapons.find(w=>w.id===blade)!.strength).toBe(4);
  a({type:'depart'});a({type:'strike',targetId:'drive-lock'});a({type:'temper',weaponId:blade});a({type:'endRound'});
  a({type:'strike',targetId:'reverse-wheel'});a({type:'strike',targetId:'reverse-wheel'});a({type:'endRound'});
  a({type:'placeCore'});a({type:'assistBrace'});a({type:'ignite',weaponId:blade});
  expect(r.state.ending?.kind).toBe('relit');expect(r.state.weapons.find(w=>w.id===blade)).toMatchObject({strength:2,fissureMarked:true,owner:'lamp'});
  expect(r.state.flags).toMatchObject({ring:'taken',carrier:'player',crossingHeld:false,northSaved:true,southSaved:true});
 });
 it('withdraws with the unique core, and retries a failed chapter without keeping its resources',()=>{
  const{r}=plainRoute();r.act({type:'evacuate'});expect(r.state.ending?.kind).toBe('homeward');expect(r.state.flags.coreOwner).toBe('party');
  const f=run('failed'),a=f.act;a({type:'depart'});for(let i=0;i<3;i++)a({type:'endRound'});
  expect(f.state.phase).toBe('failed');a({type:'retryChapter'});expect(f.state).toMatchObject({node:1,lamp:8,coins:4,blanks:3,phase:'prepare'});
  expect(f.state.retries[1]).toBe(1);expect(f.state.failedAttempts).toHaveLength(1);
  a({type:'depart'});for(let i=0;i<3;i++)a({type:'endRound'});a({type:'acceptFailure'});expect(f.state.ending?.kind).toBe('embers');
 });
 it('rejects stale and invalid commands by retaining the exact frozen state',()=>{
  const r=run(),before:RunState=r.state;
  for(const command of [{runId:before.runId,expectedRevision:1,action:{type:'beginForge'}},{runId:before.runId,expectedRevision:0,action:{type:'forge',weaponId:'missing',kind:'ordinary'}},{runId:before.runId,expectedRevision:0,action:{type:'guard',extra:true}}]){
   const result=applyCommand(before,command);expect(result.ok).toBe(false);expect(result.state).toBe(before);expect(result.events).toEqual([]);
  }
 });
});
