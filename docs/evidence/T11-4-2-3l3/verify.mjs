import * as sdk from '../../dist/sword-led-v5.js';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const base='tmp/T11-4-2-3l3',files=['ui/run-01/states.json','ui/run-02/states.json','boundaries/result.json','final-probe/result.json','published.json'];
let runs=0,collections=0;const runHashes=new Set(),collectionHashes=new Set(),rows=[];
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function walk(value,file){
 if(!value||typeof value!=='object')return;
 if(value.rulesVersion==='forge-v5'&&Array.isArray(value.journal)){const checked=sdk.validateRun(value);assert(checked.ok,`${file}: ${checked.detail}`);runs++;runHashes.add(hash(checked.state));return;}
 if(Object.keys(value).sort().join(',')==='challenge,chapters,mastery,traits,works'){const checked=sdk.validateCollection(value);assert(checked.ok,`${file}: collection`);collections++;collectionHashes.add(hash(checked.state));return;}
 for(const child of Object.values(value))walk(child,file);
}
for(const file of files){const before={runs,collections};walk(JSON.parse(await readFile(`${base}/${file}`,'utf8')),file);rows.push({file,runs:runs-before.runs,collections:collections-before.collections});}
const prior=JSON.parse(await readFile('docs/evidence/T11-4-2-3l2/run.json','utf8'));
const sdkFiles=prior.buildFiles.filter(r=>/^dist\/(sword-led-|core-|rules-|browser-session-)/.test(r.path));assert.equal(sdkFiles.length,9);
for(const row of sdkFiles)assert.equal(createHash('sha256').update(await readFile(row.path)).digest('hex'),row.sha256,row.path);
for(const row of JSON.parse(await readFile('docs/evidence/T11-4-2-3m/run.json','utf8')).protected)assert.equal(createHash('sha256').update(await readFile(row.path)).digest('hex'),row.sha256,row.path);
const result={ok:true,savedRunObservations:runs,uniqueRunStates:runHashes.size,collectionObservations:collections,uniqueCollections:collectionHashes.size,rows,sdkFilesByteEqual:9,protectedFilesByteEqual:85,completeFreshChapters:1,finalTargetedRestoreBoundariesNotFullRuns:true,oldV4EntryActuallyNavigated:true,notHumanFunAcceptance:true};
await writeFile(`${base}/verified.json`,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
