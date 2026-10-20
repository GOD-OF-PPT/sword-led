import fs from 'node:fs';import {spawnSync} from 'node:child_process';
const root='design/d/v07-chapter3/',outputRoot='public/assets/d/v07-chapter3/',plan=JSON.parse(fs.readFileSync(root+'asset-plan.json'));
const stat=fs.statfsSync('.');if(stat.bavail*stat.bsize<256*1024**2)throw Error('DISK_BELOW_256_MIB');
const quality=72,method=6;fs.mkdirSync(outputRoot,{recursive:true});
const results=[];
for(const {id}of plan.assets){
 const source=root+'originals/'+id+'.png',output=outputRoot+id+'.webp',args=['-q',String(quality),'-m',String(method),'-metadata','none',source,'-o',output];
 const r=spawnSync('cwebp',args,{encoding:'utf8'});if(r.status!==0)throw Error(r.stderr||r.stdout);
 results.push({id,source,output,args,bytes:fs.statSync(output).size,log:(r.stdout+r.stderr).trim()});
}
const bytes=results.reduce((n,r)=>n+r.bytes,0),version=spawnSync('cwebp',['-version'],{encoding:'utf8'}).stdout.trim();
const report={tool:'cwebp',version,quality,method,metadata:'none',resized:false,cropped:false,creativePostprocessing:false,bytes,MiB:bytes/1024**2,targetBytes:2*1024**2,hardBudgetBytes:2.5*1024**2,targetMet:bytes<=2*1024**2,hardBudgetMet:bytes<=2.5*1024**2,results};
fs.writeFileSync(root+'export-log.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,results:results.map(({id,bytes})=>({id,bytes}))},null,2));
if(!report.hardBudgetMet)process.exitCode=1;
