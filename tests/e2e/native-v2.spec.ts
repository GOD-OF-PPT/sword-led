import {test,expect} from './fixtures';
import {verifyNativeV2Cache,verifyNativeV2Minimize} from './native-v2.mjs';
import {validateRun} from '../../src/core-v2/index.js';

test('native v2 minimization cancels the held physical input and accepts exactly one new strike',async({baseURL},info)=>{
  if(!baseURL)throw Error('No origin');const path=info.outputPath('native-v2-minimized.png'),result=await verifyNativeV2Minimize(baseURL,path);
  expect(result).toMatchObject({nativeMinimizedHidden:true,nativeBlurObserved:true,oldKeyupUnchanged:true,errors:[]});expect(result.finalState.revision).toBe(3);expect(result.finalState.pieces[0]?.strikes).toBe(1);expect(result.finalState.rng).toEqual(result.before.rng);
  for(const state of[result.before,result.finalState])expect(validateRun(state).ok).toBe(true);
  await info.attach('native-v2-minimized',{path,contentType:'image/png'});await info.attach('native-v2-input',{body:Buffer.from(JSON.stringify(result,null,2)),contentType:'application/json'});
});
test('native v2 cached heap rereads another writer and refuses the old keyup before explicit ownership recovery',async({baseURL},info)=>{
  if(!baseURL)throw Error('No origin');const result=await verifyNativeV2Cache(baseURL);
  expect(result).toMatchObject({nativePersisted:true,pageShowTrusted:true,heapRetained:true,oldKeyupUnchanged:true,errors:[]});expect(result.before.revision).toBe(3);expect(result.changed.revision).toBe(4);expect(result.restored).toEqual(result.changed);expect(result.finalState).toMatchObject({revision:5,coins:22});expect(result.finalState.pieces[0]?.strikes).toBe(2);expect(result.finalState.pieces[2]?.status).toBe('delivered');
  for(const state of[result.before,result.changed,result.restored,result.finalState])expect(validateRun(state).ok).toBe(true);
  await info.attach('native-v2-bfcache',{body:Buffer.from(JSON.stringify(result,null,2)),contentType:'application/json'});
});
