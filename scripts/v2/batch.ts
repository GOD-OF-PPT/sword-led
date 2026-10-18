import {createHash} from 'node:crypto';
import {isMainThread,parentPort,workerData} from 'node:worker_threads';
import {simulateV2} from './policy.js';
import type {Accuracy,Policy,RecordRow} from './policy.js';
import type {RunState,Technique} from '../../src/core-v2/index.js';

export type Profile=readonly [Policy,Technique,Accuracy];
export const PROFILES:readonly Profile[]=[
  ...(['light','balanced','heavy'] as const).flatMap(policy=>(['edgeTooth','bridgeClip','reheatSand'] as const)
    .flatMap(starter=>(['perfect','steady','shaky'] as const).map(accuracy=>[policy,starter,accuracy] as const))),
  ['raw','bridgeClip','perfect'],['salvage','bridgeClip','perfect'],
];
export interface BatchInput {readonly profile:Profile;readonly start:number;readonly count:number}
export type HashedRow=RecordRow&{readonly stateSha256:string};
export function partition(seeds:number,size=25):BatchInput[]{
  if(!Number.isInteger(seeds)||seeds<1||seeds>1000||!Number.isInteger(size)||size<1)throw Error('Invalid seed count or batch size');
  return PROFILES.flatMap(profile=>Array.from({length:Math.ceil(seeds/size)},(_,i)=>({profile,start:i*size,count:Math.min(size,seeds-i*size)})));
}
export function batch({profile,start,count}:BatchInput){
  if(!PROFILES.some(p=>p.every((v,i)=>v===profile[i]))||!Number.isInteger(start)||!Number.isInteger(count)||start<0||count<1||start+count>1000)throw Error('Invalid batch');
  const rows:HashedRow[]=[],witnesses:{victory?:RunState;defeat?:RunState}={};
  for(let i=start;i<start+count;i++){
    const {row,state}=simulateV2(`v2-verify-${String(i).padStart(4,'0')}`,...profile);
    if((profile[0]==='raw'||profile[0]==='salvage')&&(state.phase!=='defeat'||state.round!==3))throw Error('Unforged policy survived');
    const stateSha256=createHash('sha256').update(JSON.stringify(state)).digest('hex');rows.push({...row,stateSha256});
    if(state.phase==='victory'&&!witnesses.victory)witnesses.victory=state;
    else if(state.phase==='defeat'&&!witnesses.defeat)witnesses.defeat=state;
  }
  return{rows,witnesses};
}
if(!isMainThread&&parentPort&&workerData?.kind==='sword-led-v2-batch')parentPort.postMessage(batch(workerData as BatchInput));
