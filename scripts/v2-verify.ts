import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { simulateV2 } from './v2/policy.js';
import type { Accuracy, Policy, RecordRow } from './v2/policy.js';
import type { RunState, Technique } from '../src/core-v2/index.js';

const args=process.argv.slice(2),options=new Map<string,string>();
for(let i=0;i<args.length;i+=2){const k=args[i],v=args[i+1];if(!k||!v||!['--seeds','--out'].includes(k)||options.has(k))throw Error('Use --seeds <1..1000> --out <new directory>');options.set(k,v);}
const seeds=Number(options.get('--seeds')??'32'),out=options.get('--out')??'tmp/v2-verification';if(!Number.isInteger(seeds)||seeds<1||seeds>1000)throw Error('seeds must be 1..1000');
await mkdir(out,{recursive:false});const begin=performance.now(),rows:RecordRow[]=[],witnesses:{victory?:RunState;defeat?:RunState}={};
const profiles:[Policy,Technique,Accuracy][]=[];for(const policy of['light','balanced','heavy']as const)for(const starter of['edgeTooth','bridgeClip','reheatSand']as const)for(const accuracy of['perfect','steady','shaky']as const)profiles.push([policy,starter,accuracy]);profiles.push(['raw','bridgeClip','perfect'],['salvage','bridgeClip','perfect']);
for(const [policy,starter,accuracy]of profiles){
  const group:RecordRow[]=[];for(let i=0;i<seeds;i++){const {row,state}=simulateV2(`v2-verify-${String(i).padStart(4,'0')}`,policy,starter,accuracy);rows.push(row);group.push(row);if(state.phase==='victory'&&!witnesses.victory)witnesses.victory=state;else if(state.phase==='defeat'&&!witnesses.defeat)witnesses.defeat=state;}
  console.log(JSON.stringify({policy,starter,accuracy,cases:group.length,victories:group.filter(r=>r.phase==='victory').length,meanStrikes:group.reduce((n,r)=>n+r.strikes,0)/group.length}));
}
const sources=['src/core-v2/game.ts','src/core-v2/model.ts','src/core-v2/rules.ts','src/core-v2/view.ts','src/core-v2/validate.ts','src/core/random.ts','src/core/validate.ts','src/platform/timing.ts','scripts/v2/policy.ts','scripts/v2-verify.ts'];
const sourceHashes=Object.fromEntries(await Promise.all(sources.map(async p=>[p,createHash('sha256').update(await readFile(p)).digest('hex')])));
const summary={rulesVersion:'forge-v2',seeds,profiles:profiles.length,cases:rows.length,elapsedMs:performance.now()-begin,method:'Formal accepted commands with known current views. Independent fixed input-error stream: perfect 0ms, steady uniform ±90ms, shaky uniform ±190ms, converted through actual hammer periods/timingMarkAt. No future random reads, wallet fixtures or injected endings. Each final snapshot replayed by validateRun. These assumed input distributions do not predict human fun or real win rates.',sourceHashes,rows};
await writeFile(`${out}/summary.json`,JSON.stringify(summary,null,2)+'\n',{flag:'wx'});
for(const [name,state]of Object.entries(witnesses))await writeFile(`${out}/${name}.json`,JSON.stringify(state,null,2)+'\n',{flag:'wx'});
if(!witnesses.victory||!witnesses.defeat)throw Error('A genuine full victory and defeat witness are required');
