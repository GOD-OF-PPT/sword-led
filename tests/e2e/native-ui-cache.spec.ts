import { test, expect } from './fixtures';
import { verifyNativeUiCache } from './native-ui-cache.mjs';
import { validateRun } from '../../src/core/index.js';

test('production UI rereads a newer window save after a real native cached-heap restoration',async({baseURL},info)=>{
  if(!baseURL)throw new Error('No UI origin');const result=await verifyNativeUiCache(baseURL);
  expect(result).toMatchObject({nativePersisted:true,pageShowTrusted:true,heapRetained:true,oldKeyupUnchanged:true,errors:[]});
  for(const state of[result.before,result.changed,result.restored,result.finalState])expect(validateRun(state).ok).toBe(true);
  expect(result.before.revision).toBe(1);expect(result.changed.revision).toBe(2);expect(result.restored).toEqual(result.changed);expect(result.finalState.revision).toBe(3);
  await info.attach('native-ui-bfcache',{body:Buffer.from(JSON.stringify(result,null,2)),contentType:'application/json'});
});
