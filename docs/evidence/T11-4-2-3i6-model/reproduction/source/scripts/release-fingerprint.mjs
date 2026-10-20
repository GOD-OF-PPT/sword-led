import {readFile,readdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';

// These historical JSON inputs are read by the real UI/unit tests; reports and notes are not executable inputs.
const fixtures=['docs/evidence/T06','docs/evidence/T11-2/simulation/victory.json','docs/evidence/T11-3/polish-runtime/ui/d-keyboard-campaign.json','docs/evidence/T11-3/polish-runtime/ui/v2-three-round-contract.json'];
const config=/^(?:package.*\.json|tsconfig.*\.json|vite.*\.ts|vitest.*\.ts|playwright.*\.ts|index\.html|v2\.html|\.nvmrc|\.npmrc)$/;
export async function captureFingerprint(root=process.cwd(),extraInputs=[]){
  const sourceHashes={},buildFiles={},sha=b=>createHash('sha256').update(b).digest('hex');
  async function file(path,target){const b=await readFile(join(root,path));target[path]={sha256:sha(b),bytes:b.length};}
  async function tree(dir,target){for(const e of (await readdir(join(root,dir),{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const p=`${dir}/${e.name}`;if(e.isSymbolicLink())throw Error(`Symlink is not a frozen input: ${p}`);if(e.isDirectory())await tree(p,target);else if(e.isFile())await file(p,target);}}
  for(const dir of ['src','tests','scripts','public'])await tree(dir,sourceHashes);
  for(const name of (await readdir(root)).filter(n=>config.test(n)).sort())await file(name,sourceHashes);
  const inputs=[...fixtures,...extraInputs];
  for(const p of inputs){if(p.includes('..')||p.startsWith('/'))throw Error('Extra inputs must be repository-relative');const entries=await readdir(join(root,p),{withFileTypes:true}).catch(e=>{if(e.code==='ENOTDIR')return null;throw e;});if(entries===null)await file(p,sourceHashes);else await tree(p,sourceHashes);}
  await tree('dist',buildFiles);if(!Object.keys(buildFiles).length)throw Error('Build is empty');
  return{schemaVersion:1,recordedAt:new Date().toISOString(),environment:{node:process.version,platform:process.platform,arch:process.arch},extraInputs,sourceHashes,buildFiles};
}
export function changedInputs(expected,actual){
  if(expected.schemaVersion!==1)throw Error('Unsupported fingerprint schema');
  const changed=[];for(const group of ['sourceHashes','buildFiles']){if(!expected[group]||typeof expected[group]!=='object')throw Error('Missing fingerprint group');for(const p of new Set([...Object.keys(expected[group]),...Object.keys(actual[group])]))if(JSON.stringify(expected[group][p])!==JSON.stringify(actual[group][p]))changed.push(p);}
  return changed.sort();
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
  const [mode,path,...extra]=process.argv.slice(2);
  if(!path||!['capture','verify'].includes(mode)||(mode==='verify'&&extra.length))throw Error('Use capture <new manifest> [extra input paths...] or verify <manifest>');
  if(mode==='capture'){const snapshot=await captureFingerprint(process.cwd(),extra);await writeFile(path,JSON.stringify(snapshot,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({captured:true,sourceFiles:Object.keys(snapshot.sourceHashes).length,buildFiles:Object.keys(snapshot.buildFiles).length}));}
  else{const expected=JSON.parse(await readFile(path,'utf8')),actual=await captureFingerprint(process.cwd(),expected.extraInputs??[]),changed=changedInputs(expected,actual);console.log(JSON.stringify({matches:!changed.length,changed}));if(changed.length)process.exitCode=1;}
}
