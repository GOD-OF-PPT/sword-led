import {describe,it,expect} from 'vitest';
import {createRun} from '../../src/core-v7/initial.js';
import {parseAction} from '../../src/core-v7/actions.js';

describe('v7 input and chapter checkpoint',()=>{
 it('starts with an independent post-supply checkpoint and immutable owned old sword',()=>{
  const r=createRun({runId:'campaign-1',seed:'  归炉  '});expect(r.ok).toBe(true);if(!r.ok)return;
  expect(r.state.seed).toBe('归炉');expect(r.state.lamp).toBe(8);expect(r.state.blanks).toBe(3);
  expect(r.state.checkpoint.weapons).not.toBe(r.state.weapons);
  expect(r.state.weapons[0]).toMatchObject({id:r.state.handId,strength:3,owner:'player',status:'sealed'});
  expect(Object.isFrozen(r.state.checkpoint.flags)).toBe(true);
  expect('weaponSerial' in r.state.checkpoint).toBe(false);
 });
 it('rejects ambiguous actions, extra fields and non-string enum impostors',()=>{
  expect(parseAction({type:'forge',weaponId:'w-1',kind:['ordinary']})).toBeNull();
  expect(parseAction({type:'shop',item:['coal']})).toBeNull();
  expect(parseAction({type:'guard',targetId:'wood-guard'})).toBeNull();
  expect(parseAction({type:'ignite',weaponId:'w-1',paid:false})).toBeNull();
  expect(parseAction({type:'seal',weaponId:'w-1',slot:'hand',replace:false})).toEqual({type:'seal',weaponId:'w-1',slot:'hand',replace:false});
  expect(parseAction({type:'choose',choice:'courier-carries'})).toEqual({type:'choose',choice:'courier-carries'});
 });
});
