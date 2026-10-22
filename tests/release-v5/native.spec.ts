import {test,expect} from '@playwright/test';
import {mkdir,readFile,lstat} from 'node:fs/promises';
import {join} from 'node:path';
import {verifyNativeV5} from './native-v5.mjs';
import {releaseAudioProbeSource,readReleaseAudioSnapshot} from './audio-probe.js';
import type {NativeV5Scenario} from './native-v5.mjs';
import {validateRun} from '../../src/core-v5/index.js';
import {validateCollection} from '../../src/application/v5-collection.js';

for(const scenario of ['space-minimize','pointer-minimize','clean-cache','dirty-cache','memory-cache','stale-cache'] as const)test(`system Chrome production v5 native ${scenario}`,async({baseURL},info)=>{
 test.setTimeout(180000);if(!baseURL)throw Error('Missing immutable v5 origin');
 const root=process.env.V5_NATIVE_EVIDENCE_ROOT??process.env.V5_RELEASE_EVIDENCE_ROOT??info.outputPath('native-v5'),dir=join(root,info.project.name,scenario);await mkdir(join(root,info.project.name),{recursive:true});await lstat(dir).then(()=>{throw Error('Native evidence directory already exists; use a new batch root');},error=>{if(error.code!=='ENOENT')throw error;});
 try{
  const result=await verifyNativeV5(baseURL,dir,scenario as NativeV5Scenario,{initSource:releaseAudioProbeSource({}),snapshotSource:`(${readReleaseAudioSnapshot.toString()})()`});expect(result.passed).toBe(true);expect(result.launch.headless).toBe(false);expect(result.launch.executablePath).toBe('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');expect(result.closed?.profileRemoved).toBe(true);expect(result.errors).toEqual([]);
  for(const state of result.states)expect(validateRun(state).ok).toBe(true);for(const collection of result.collections)expect(validateCollection(collection).ok).toBe(true);
  if(scenario.endsWith('minimize'))expect(result.summary).toMatchObject({nativeMinimizedHidden:true,nativeBlurTrusted:true,nativeVisibilityTrusted:true,staleReleaseUnchanged:true,freshCommands:1});
  else expect(result.summary).toMatchObject({nativePersisted:true,pageShowTrusted:true,heapRetained:true,otherWriterUpdatedRunAndCollection:true,diskNotOverwritten:true});
 }finally{const path=join(dir,'native-log.json');try{await info.attach('actual-system-chrome-native-v5',{body:await readFile(path),contentType:'application/json'});}catch{/* The test failure remains authoritative if Chrome could not start or no report was written. */}}
});
