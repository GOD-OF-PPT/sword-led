import fs from 'node:fs';
import cp from 'node:child_process';
const ids=['lantern-road-v1','bridge-dark-v1','bridge-lit-v1','modifications-v1','events-v1'];
const records=[];let logs='';
for(const id of ids){const input='design/d/v07/originals/'+id+'.png',output='public/assets/d/v07/'+id+'.webp',quality=id==='modifications-v1'||id==='events-v1'?84:82;const args=['-q',String(quality),'-m','6','-alpha_q','100',input,'-o',output];const t=Date.now(),r=cp.spawnSync('cwebp',args,{encoding:'utf8'});logs+='cwebp '+args.join(' ')+'\n'+r.stdout+r.stderr+'\n';if(r.status!==0)throw new Error(id+': '+r.stderr);records.push({id,input,output,command:['cwebp',...args],exitCode:r.status,bytes:fs.statSync(output).size,elapsedMs:Date.now()-t});}
fs.writeFileSync('design/d/v07/verification/export-log.txt',logs);fs.writeFileSync('design/d/v07/verification/export.json',JSON.stringify({toolVersion:cp.spawnSync('cwebp',['-version'],{encoding:'utf8'}).stdout.trim(),records,totalBytes:records.reduce((s,r)=>s+r.bytes,0),budgetBytes:2097152},null,2)+'\n');console.log(JSON.stringify({records:records.map(({id,bytes})=>({id,bytes})),totalBytes:records.reduce((s,r)=>s+r.bytes,0),budgetBytes:2097152}));
