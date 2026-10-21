import {readFile,readdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import * as sdk from '../../dist/sword-led-v5.js';
const base='tmp/goal4-T02',selected=process.argv.slice(2);if(!selected.length)throw Error('Choose explicit terminal run labels');
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
const canonical=v=>JSON.stringify(stable(v)),hash=b=>createHash('sha256').update(b).digest('hex');
const uniqueStates=new Set(),uniqueCollections=new Set(),files=[];let stateObjects=0,actualObservations=0,rawMatches=0,collectionObjects=0,negativeRunSlots=0,negativeCollectionSlots=0;
function checkState(value,path){const checked=sdk.validateRun(value);assert(checked.ok,path+': '+JSON.stringify(checked));assert.equal(canonical(checked.state),canonical(value),path);stateObjects++;uniqueStates.add(canonical(value));}
function checkBook(value,path){const checked=sdk.validateCollection(value);assert(checked.ok,path+': '+JSON.stringify(checked));assert.equal(canonical(checked.state),canonical(value),path);collectionObjects++;uniqueCollections.add(canonical(value));}
function rawRun(raw,path){if(raw===null)return;const decoded=sdk.decodeV5Save(raw);if(decoded.status==='valid')checkState(decoded.state,path);else negativeRunSlots++;}
function rawBook(raw,path){if(raw===null)return;const decoded=sdk.decodeCollection(raw);if(decoded.status==='valid')checkBook(decoded.state,path);else negativeCollectionSlots++;}
function inspect(value,path){if(!value||typeof value!=='object')return;if(value.rulesVersion==='forge-v5'&&Array.isArray(value.journal)){checkState(value,path);return;}for(const child of Object.values(value))inspect(child,path);}
async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){const path=dir+'/'+e.name;if(e.isDirectory())await walk(path);else if(e.name.endsWith('.json')&&!['report.json','process.json'].includes(e.name)){
 const bytes=await readFile(path),value=JSON.parse(bytes.toString('utf8'));let kind='metadata';
 if(e.name==='v5-states.json'){
  kind='actual saved-state observations';assert(Array.isArray(value));
  for(const o of value){checkState(o.state,path);actualObservations++;const decoded=sdk.decodeV5Save(o.raw.save);assert.equal(decoded.status,'valid',path);assert.equal(canonical(decoded.state),canonical(o.state),path);if(o.collection)checkBook(o.collection,path);if(o.raw.collection){const book=sdk.decodeCollection(o.raw.collection);assert.equal(book.status,'valid',path);assert.equal(canonical(book.state),canonical(o.collection),path);}else assert.equal(o.collection,null,path);rawMatches++;}
 }else{
  inspect(value,path);
  if(e.name.endsWith('-storage.json')&&value.raw){kind='storage fault observation with explicitly declared expected/actual state';rawRun(value.raw['sword-led.save.v5']??null,path);rawBook(value.raw['sword-led.collection.v2']??null,path);}
  if(e.name.endsWith('-actual-book.json')){kind='actual downloaded memory collection';checkBook(value.collection,path);}
  if(e.name.endsWith('-actual-memory.json'))kind='actual downloaded memory run';
 }
 files.push({path,bytes:bytes.length,sha256:hash(bytes),kind});
}}}
for(const label of selected){assert(/^[a-z0-9-]+$/.test(label));const p=JSON.parse(await readFile(`${base}/runs/${label}/process.json`,'utf8'));assert.equal(p.status,'terminal');await walk(`${base}/runs/${label}/artifacts`);}
const result={ok:true,runs:selected,stateObjects,uniqueStates:uniqueStates.size,actualSavedObservations:actualObservations,rawMatches,collectionObjects,uniqueCollections:uniqueCollections.size,negativeRunSlots,negativeCollectionSlots,files,scope:'Formal replay/codec checks of retained actual disk observations, downloads and explicitly labelled expected-state metadata. Counts are objects/observations, not fresh campaigns or proof of fun.'};
await writeFile(`${base}/replay-${selected.join('_')}.json`,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...result,files:files.length}));
