import {describe,it,expect} from 'vitest';
import {plainRoute} from './v7-routes.js';
import {validateRun} from '../../src/core-v7/validation.js';
describe('v7 full campaign replay validation',()=>{
 it('reconstructs a whole journey and chapter rollback while preserving weapon identity history',()=>{
  const{r}=plainRoute();const serial=r.state.weaponSerial;
  r.act({type:'retryChapter'});r.act({type:'beginForge'});
  expect(r.state.forgeId).toBe(`w-${serial+1}`);expect(r.state.flags.donatedToAlan).toBeNull();
  expect(r.state.failedAttempts.at(-1)!.flags.donatedToAlan).not.toBeNull();
  const restored=validateRun(JSON.parse(JSON.stringify(r.state)));
  expect(restored.ok).toBe(true);if(restored.ok)expect(restored.state).toEqual(r.state);
 });
 it('rejects edited checkpoints, resources and retry history despite a valid journal',()=>{
  const{r}=plainRoute();r.act({type:'evacuate'});expect(validateRun(r.state).ok).toBe(true);
  for(const change of ['coins','checkpoint','serial','attempt']){
   const edited=JSON.parse(JSON.stringify(r.state));
   if(change==='coins')edited.coins++;
   if(change==='checkpoint')edited.checkpoint.blanks=99;
   if(change==='serial')edited.weaponSerial++;
   if(change==='attempt')edited.failedAttempts[0].flags.coreOwner='player';
   expect(validateRun(edited).ok).toBe(false);
  }
 });
});
