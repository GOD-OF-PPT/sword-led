import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {Worker} from 'node:worker_threads';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {batch,partition,PROFILES} from './v2/batch.js';
import type {HashedRow} from './v2/batch.js';
import type {RunState} from '../src/core-v2/index.js';

const args=process.argv.slice(2),options=new Map<string,string>();
for(let i=0;i<args.length;i+=2){const k=args[i],v=args[i+1];if(!k||!v||!['--seeds','--out','--workers'].includes(k)||options.has(k))throw Error('Use --seeds <1..1000> --out <new directory> --workers <1..8>');options.set(k,v);}
const seeds=Number(options.get('--seeds')??'32'),workers=Number(options.get('--workers')??'4'),out=options.get('--out')??'tmp/v2-verification';
if(!Number.isInteger(seeds)||seeds<1||seeds>1000||!Number.isInteger(workers)||workers<1||workers>8)throw Error('seeds must be 1..1000 and workers 1..8');
const digest=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
async function sourceHashes(){
  const names=['package-lock.json','tsconfig.simulation.json','src/platform/timing.ts','scripts/v2-verify.ts'];
  for(const dir of ['src/core','src/core-v2','scripts/v2'])for(const name of (await readdir(dir)).filter(n=>n.endsWith('.ts')).sort())names.push(`${dir}/${name}`);
  return Object.fromEntries(await Promise.all(names.map(async p=>[p,digest(await readFile(p))])));
}
async function compiledHashes(){
  const root=fileURLToPath(new URL('../',import.meta.url)),names=['src/platform/timing.js','scripts/v2-verify.js'];
  for(const dir of ['src/core','src/core-v2','scripts/v2'])for(const name of (await readdir(join(root,dir))).filter(n=>n.endsWith('.js')).sort())names.push(`${dir}/${name}`);
  return Object.fromEntries(await Promise.all(names.map(async p=>[p,digest(await readFile(join(root,p)))])));
}
const sources=await sourceHashes(),compiled=await compiledHashes();await mkdir(out,{recursive:false});
const begin=performance.now(),inputs=partition(seeds),groups:HashedRow[][]=[],active=new Set<Worker>();
const witnesses:{victory?:{index:number;state:RunState};defeat?:{index:number;state:RunState}}={};let next=0,completed=0,failed=false;
try{
  await Promise.all(Array.from({length:Math.min(workers,inputs.length)},async()=>{
    for(let index=next++;!failed&&index<inputs.length;index=next++){
      const input=inputs[index];if(!input)throw Error('Missing batch');
      const result=workers===1?batch(input):await new Promise<ReturnType<typeof batch>>((resolve,reject)=>{
        const worker=new Worker(new URL('./v2/batch.js',import.meta.url),{workerData:{...input,kind:'sword-led-v2-batch'}});active.add(worker);
        let result:ReturnType<typeof batch>|undefined;
        worker.once('message',(message:ReturnType<typeof batch>)=>{result=message;});worker.once('error',reject);
        worker.once('exit',code=>{active.delete(worker);if(code!==0||!result)reject(Error(`V2 worker exited ${code} without a successful result`));else resolve(result);});
      });
      if(failed)return;
      if(result.rows.length!==input.count||result.rows.some((row,i)=>row.seed!==`v2-verify-${String(input.start+i).padStart(4,'0')}`||row.policy!==input.profile[0]||row.starter!==input.profile[1]||row.accuracy!==input.profile[2]||!/^[a-f0-9]{64}$/.test(row.stateSha256)))throw Error('Incomplete or mismatched batch');groups[index]=result.rows;completed+=result.rows.length;
      for(const phase of ['victory','defeat'] as const){const state=result.witnesses[phase];if(state&&(!witnesses[phase]||index<witnesses[phase].index))witnesses[phase]={index,state};}
      console.log(JSON.stringify({completed,total:seeds*PROFILES.length,profile:input.profile,start:input.start,count:input.count,victories:result.rows.filter(r=>r.phase==='victory').length}));
    }
  }));
}catch(error){failed=true;throw error;}finally{await Promise.all([...active].map(worker=>worker.terminate()));}
if(JSON.stringify(sources)!==JSON.stringify(await sourceHashes()))throw Error('Simulation source changed while running');
if(JSON.stringify(compiled)!==JSON.stringify(await compiledHashes()))throw Error('Simulation compiled output changed while running');
const rows=groups.flat();if(rows.length!==seeds*PROFILES.length||completed!==rows.length||!witnesses.victory||!witnesses.defeat)throw Error('Incomplete coverage or missing genuine victory/defeat');
const summary={rulesVersion:'forge-v2',seeds,profiles:PROFILES.length,cases:rows.length,workers,batches:inputs.length,replayedFinalStates:rows.length,elapsedMs:performance.now()-begin,
  method:'Unchanged formal-command policies and independent input error stream (0/±90/±190ms). Every final snapshot replayed by validateRun inside simulateV2. Bounded worker batches preserve canonical profile/seed ordering and earliest witnesses; no injected endings. Input assumptions do not predict human fun or real win rates.',
  sourceHashes:sources,compiledHashes:compiled,rows};
for(const phase of ['victory','defeat'] as const)await writeFile(`${out}/${phase}.json`,JSON.stringify(witnesses[phase]!.state,null,2)+'\n',{flag:'wx'});
await writeFile(`${out}/summary.json`,JSON.stringify(summary,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({complete:true,seeds,profiles:PROFILES.length,cases:rows.length,workers,elapsedMs:summary.elapsedMs}));
