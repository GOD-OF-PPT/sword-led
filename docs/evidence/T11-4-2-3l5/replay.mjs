import assert from 'node:assert/strict';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as sdk from '../../dist/sword-led-v5.js';

const base='tmp/T11-4-2-3l5',output=`${base}/replay.json`;
const readJson=async path=>JSON.parse(await readFile(path,'utf8'));
const canonical=value=>JSON.stringify(sort(value));
function sort(value){if(Array.isArray(value))return value.map(sort);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,sort(value[key])]));return value;}
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function statesIn(directory){const result=[];for(const entry of await readdir(directory,{withFileTypes:true})){const path=`${directory}/${entry.name}`;if(entry.isDirectory())result.push(...await statesIn(path));else if(entry.name==='states.json')result.push(path);}return result.sort();}
async function sameFiles(name,entries,expectedCount){assert.equal(entries.length,expectedCount,`${name} manifest count`);const files=[];for(const entry of entries){const actual=await readFile(entry.path),sha256=hash(actual);assert.equal(actual.byteLength,entry.bytes,`${name} bytes: ${entry.path}`);assert.equal(sha256,entry.sha256,`${name} hash: ${entry.path}`);files.push({path:entry.path,bytes:actual.byteLength,sha256,unchanged:true});}return{name,count:files.length,ok:true,files};}

const result={ok:false,at:new Date().toISOString(),method:'Read-only validation by final formal v5 SDK; raw save and observed state/collection exact canonical equality; canonical unique counts are observations, not games.',scope:'ui/*/states.json and extras*/**/states.json, including red batches',inputs:[],batches:[],stateOccurrences:0,collectionOccurrences:0,rawSaveOccurrences:0,rawCollectionOccurrences:0,protection:[]};
const states=new Set(),collections=new Set();
try{
 const roots=(await readdir(base,{withFileTypes:true})).filter(entry=>entry.isDirectory()&&(entry.name==='ui'||entry.name.startsWith('extras'))).map(entry=>`${base}/${entry.name}`).sort();
 const paths=[];for(const root of roots)paths.push(...await statesIn(root));assert(paths.length>0);
 for(const path of paths){
  const bytes=await readFile(path),observations=JSON.parse(bytes.toString('utf8'));assert(Array.isArray(observations));result.inputs.push({path,bytes:bytes.byteLength,sha256:hash(bytes)});
  const batch={path,stateOccurrences:0,collectionOccurrences:0,rawSaveOccurrences:0,rawCollectionOccurrences:0,observations:[]};
  for(const [index,observation]of observations.entries()){
   const label=observation.label??String(index),where=`${path}#${index}:${label}`,checked=sdk.validateRun(observation.state);assert(checked.ok,`${where}: ${JSON.stringify(checked)}`);assert.equal(canonical(checked.state),canonical(observation.state),`${where}: observed state differs from formal normalized state`);states.add(canonical(observation.state));result.stateOccurrences++;batch.stateOccurrences++;
   if(observation.collection!==null&&observation.collection!==undefined){const collection=sdk.validateCollection(observation.collection);assert(collection.ok,`${where}: collection validation`);assert.equal(canonical(collection.state),canonical(observation.collection),`${where}: collection normalization`);collections.add(canonical(observation.collection));result.collectionOccurrences++;batch.collectionOccurrences++;}
   assert(observation.raw&&typeof observation.raw.save==='string',`${where}: expected actual raw save`);
   const rawSave=sdk.decodeV5Save(observation.raw.save);assert.equal(rawSave.status,'valid',`${where}: raw save validity`);assert.equal(canonical(rawSave.state),canonical(observation.state),`${where}: raw save versus observed state`);result.rawSaveOccurrences++;batch.rawSaveOccurrences++;
   if(observation.raw.collection!==null){assert.equal(typeof observation.raw.collection,'string',`${where}: actual collection raw type`);const rawCollection=sdk.decodeCollection(observation.raw.collection);assert.equal(rawCollection.status,'valid',`${where}: raw collection validity`);assert.equal(canonical(rawCollection.state),canonical(observation.collection),`${where}: raw collection versus observation`);result.rawCollectionOccurrences++;batch.rawCollectionOccurrences++;}else assert.equal(observation.collection,null,`${where}: empty raw must have null observed collection`);
   batch.observations.push({index,label,runId:checked.state.runId,revision:checked.state.revision,day:checked.state.day,phase:checked.state.phase,validated:true,rawMatches:true,collection:observation.collection!==null&&observation.collection!==undefined});
  }result.batches.push(batch);
 }
 result.uniqueStates=states.size;result.uniqueCollections=collections.size;
 const protectedManifest=await readJson('docs/evidence/T11-4-2-3m/run.json'),baseline=await readJson('docs/evidence/T11-4-2-3l2/baseline.json'),sdkManifest=await readJson('docs/evidence/T11-4-2-3l2/run.json');
 result.protection.push(await sameFiles('85 protected original inputs approvals artwork and compiled evidence',protectedManifest.protected,85));
 result.protection.push(await sameFiles('113 preserved old product sources and resources',baseline.preservedSource,113));
 result.protection.push(await sameFiles('7 original v5 pure core sources',baseline.coreV5,7));
 result.protection.push(await sameFiles('9 formal SDK output files including dependencies',sdkManifest.buildFiles.filter(entry=>entry.path.endsWith('.js')&&!entry.path.startsWith('dist/assets/')),9));
 result.ok=true;await writeFile(output,JSON.stringify(result,null,2));console.log(JSON.stringify({ok:true,batches:result.batches.length,stateOccurrences:result.stateOccurrences,uniqueStates:result.uniqueStates,collectionOccurrences:result.collectionOccurrences,uniqueCollections:result.uniqueCollections,rawSaveOccurrences:result.rawSaveOccurrences,rawCollectionOccurrences:result.rawCollectionOccurrences,protection:result.protection.map(x=>({name:x.name,count:x.count,ok:x.ok}))}));
}catch(error){result.failure={message:String(error),stack:error.stack};result.uniqueStates=states.size;result.uniqueCollections=collections.size;await writeFile(output,JSON.stringify(result,null,2));throw error;}
