import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {resolve,dirname} from 'node:path';
import {captureFingerprint,changedInputs} from '../../scripts/release-fingerprint.mjs';

const base='2fec6a18c75f33c26d48da4c07f542369411d90d',out='docs/evidence/T11-4-2-3i5';
const metadata=[out+'/publication-manifest.json',out+'/verification.json'];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const git=(...args)=>execFileSync('rtk',['proxy','git',...args],{maxBuffer:20*1024*1024});
const expected=JSON.parse(await readFile('tmp/T11-4-2-3i5/final-journeys/after.json','utf8'));
const current=await captureFingerprint(process.cwd(),expected.extraInputs);
assert.deepEqual(changedInputs(expected,current),[],'Final tested input/runtime drift');
const unit=JSON.parse(await readFile(out+'/validation/quality-final-memory/unit.json','utf8'));
assert(unit.success&&unit.numPassedTests===357&&unit.numFailedTests===0);
const coverage=JSON.parse(await readFile(out+'/case-coverage.json','utf8'));
assert.equal(coverage.length,24);assert.equal(new Set(coverage.map(row=>row.key)).size,24);
for(const project of ['v4-chromium','v4-firefox','v4-webkit'])assert.equal(coverage.filter(row=>row.project===project).length,8);
const preview=JSON.parse(await readFile(out+'/preview/result.json','utf8'));
assert.equal(preview.httpFiles,75);assert.equal(preview.freshLeftClicks,3);assert.deepEqual(preview.errors,[]);
const journeyTerminal=JSON.parse(await readFile('tmp/T11-4-2-3i5/final-journeys/terminal.json','utf8'));assert.equal(journeyTerminal.validationComplete,true);assert.equal(preview.finalJourneyToken,journeyTerminal.token);assert.equal(preview.http.length,75);assert.equal(new Set(preview.http.map(row=>row.file)).size,75);
assert.deepEqual(Object.fromEntries(preview.http.map(row=>['dist/'+row.file,{sha256:row.sha256,bytes:row.bytes}])),current.buildFiles,'Official HTTP receipt is not the final tested runtime');
const preserved=JSON.parse(await readFile(out+'/validation/preserved-inputs-final.json','utf8'));
assert.equal(preserved.allPreservedInputsMatch,true);assert.equal(preserved.compiledCount,21);assert.equal(preserved.artFreeze.frozenFiles,58);assert.equal(preserved.artFreeze.allHashesMatch,true);assert.equal(preserved.backupCommitObserved,'0316e0711fd590debb592dc41cfc4190d47e3be7');
for(const item of [...preserved.files,...preserved.compiled,...preserved.artFreeze.files]){assert.equal(item.matches,true);assert.equal(sha(await readFile(item.file)),item.sha256,'Preserved input drift: '+item.file);}
assert.equal(git('rev-parse',preserved.backupRef).toString().trim(),preserved.backupCommitObserved);
const unstaged=git('diff','--name-only','-z').toString('utf8').split('\0').filter(Boolean).filter(path=>!metadata.includes(path));
const untracked=git('ls-files','--others','--exclude-standard','-z').toString('utf8').split('\0').filter(Boolean).filter(path=>!metadata.includes(path));
assert.deepEqual(unstaged,[],'Unstaged publication input: review and stage every intended file');assert.deepEqual(untracked,[],'Untracked publication input: review and stage all original sources and assets');
const paths=git('diff','--cached','--name-only','-z',base).toString('utf8').split('\0').filter(Boolean).filter(path=>!metadata.includes(path));
const index=new Map(git('ls-files','--stage','-z').toString('utf8').split('\0').filter(Boolean).map(line=>{const tab=line.indexOf('\t');return[line.slice(tab+1),line.slice(0,tab).split(' ')[1]];}));
const patterns=[/\bgh[pousr]_[A-Za-z0-9]{28,}\b/,/\bgithub_pat_[A-Za-z0-9_]{30,}\b/,/\bsk-(?:proj-)?[A-Za-z0-9_-]{25,}\b/,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/];
let markdownFiles=0,localLinks=0,textFiles=0,gzipFiles=0;const files=[],deferredLinks=[];
for(const path of paths){
  assert(!/^(?:tmp|dist|node_modules)\//.test(path),'Runtime/dependency/temp output in publication: '+path);
  const bytes=await readFile(path),gitBlob=createHash('sha1').update(Buffer.concat([Buffer.from('blob '+bytes.length+'\0'),bytes])).digest('hex');
  assert.equal(gitBlob,index.get(path),'Staged/worktree mismatch: '+path);
  let text=null;
  if(path.endsWith('.gz')){text=gunzipSync(bytes).toString('utf8');gzipFiles++;}
  else if(!/\.(?:png|webp|jpg|jpeg|zip|mp4|webm)$/.test(path)){text=bytes.toString('utf8');textFiles++;}
  if(text!==null)for(const pattern of patterns)assert(!pattern.test(text),'Credential pattern: '+path);
  if(path.endsWith('.md')){
    markdownFiles++;assert.equal((text.match(/^```/gm)??[]).length%2,0,'Unclosed fence: '+path);
    for(const match of text.matchAll(/\]\(([^)]+)\)/g)){
      let target=match[1].trim().split(/\s+"/)[0];if(target.startsWith('<')&&target.endsWith('>'))target=target.slice(1,-1);
      if(/^(?:https?:|mailto:|app:|plugin:|#)/.test(target))continue;
      target=decodeURIComponent(target.split('#')[0]);if(!target)continue;
      const targetPath=resolve(dirname(path),target);if(metadata.some(file=>resolve(file)===targetPath))deferredLinks.push(targetPath);else await stat(targetPath);localLinks++;
    }
  }
  files.push({path,bytes:bytes.length,sha256:sha(bytes),gitBlob});
}
assert.equal(files.filter(row=>row.path.startsWith('public/assets/d/v07-chapter3/')&&row.path.endsWith('.webp')).length,9);
assert.equal(files.filter(row=>row.path.startsWith('design/d/v07-chapter3/originals/')&&row.path.endsWith('.png')).length,9);
git('diff','--cached','--check');
const verification={at:new Date().toISOString(),sourceBase:base,unitPassed:357,logicalUiCoverage:24,casesPerEngine:8,
  coverage:'Nine unaffected boundary passes + three repaired boundary passes + twelve final journeys; original failed attempts retained, not a single all-green 24-case batch.',
  frozenFinalInputs:Object.keys(current.sourceHashes).length,buildFiles:Object.keys(current.buildFiles).length,
  payloadFiles:files.length,markdownFiles,localLinks,textFiles,gzipFiles,credentialPatterns:'No matches in staged UTF-8 and decompressed gzip.',
  stagedDiffCheck:0,officialHttpFiles:75,goalComplete:false,playerAcceptance:'New complete-game player acceptance and final balance/matrix/R4 remain open.'};
await writeFile(out+'/verification.json',JSON.stringify(verification,null,2)+'\n');
await writeFile(out+'/publication-manifest.json',JSON.stringify({schemaVersion:1,phase:process.argv[2]??'source-prepared',at:new Date().toISOString(),base,metadataFilesExcluded:metadata,files},null,2)+'\n');
for(const path of deferredLinks)await stat(path);
console.log(JSON.stringify(verification));
