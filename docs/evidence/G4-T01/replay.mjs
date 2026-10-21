import {readFile,readdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import * as v4 from '../../dist/sword-led-v4.js';
import * as v5 from '../../dist/sword-led-v5.js';
const base='tmp/goal4-T01',stateSet=new Set(),collectionSet=new Set(),batches=[];
const sort=v=>Array.isArray(v)?v.map(sort):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])])):v;
const canonical=v=>JSON.stringify(sort(v));const hash=b=>createHash('sha256').update(b).digest('hex');
let states=0,collections=0,rawMatches=0;
async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){const path=dir+'/'+e.name;if(e.isDirectory())await walk(path);else if(e.name.endsWith('.json')){const bytes=await readFile(path),value=JSON.parse(bytes.toString());let count=0;
function inspect(o){if(!o||typeof o!=='object')return;if(Array.isArray(o.journal)&&['forge-v4','forge-v5'].includes(o.rulesVersion)){const sdk=o.rulesVersion==='forge-v5'?v5:v4,checked=sdk.validateRun(o);assert(checked.ok,path+':'+JSON.stringify(checked));assert.equal(canonical(checked.state),canonical(o));states++;count++;stateSet.add(canonical(o));return;}for(const v of Object.values(o))inspect(v);}
inspect(value);
if(e.name==='v5-states.json')for(const o of value){if(o.collection){const c=v5.validateCollection(o.collection);assert(c.ok);assert.equal(canonical(c.state),canonical(o.collection));collections++;collectionSet.add(canonical(o.collection));}const raw=v5.decodeV5Save(o.raw.save);assert.equal(raw.status,'valid');assert.equal(canonical(raw.state),canonical(o.state));if(o.raw.collection){const c=v5.decodeCollection(o.raw.collection);assert.equal(c.status,'valid');assert.equal(canonical(c.state),canonical(o.collection));}else assert.equal(o.collection,null);rawMatches++;}
if(count)batches.push({path,sha256:hash(bytes),states:count});
}}}
await walk(base+'/runs');const result={ok:true,states,uniqueStates:stateSet.size,collections,uniqueCollections:collectionSet.size,rawMatches,batches,note:'Actual saved states from new v5 keyboard and old route smoke; counts are observations, not games. Runtime formal validators, canonical equality; raw/collection validation for v5 observations.'};await writeFile(base+'/replay.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({ok:true,states,uniqueStates:stateSet.size,collections,uniqueCollections:collectionSet.size,rawMatches,batches:batches.length}));
