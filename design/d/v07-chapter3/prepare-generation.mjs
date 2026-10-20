import fs from 'node:fs';
const root='design/d/v07-chapter3/',id=process.argv[2],plan=JSON.parse(fs.readFileSync(root+'asset-plan.json'));
const asset=plan.assets.find(a=>a.id===id);if(!asset)throw Error('Unknown asset '+id);
const stats=fs.statfsSync('.'),availableBytes=stats.bavail*stats.bsize;
if(availableBytes<256*1024**2)throw Error('DISK_BELOW_256_MIB '+availableBytes);
for(const path of asset.references)fs.accessSync(path);
console.log(JSON.stringify({id,availableBytes,prompt:fs.readFileSync(root+'prompts/'+id+'.txt','utf8'),references:asset.references.map(p=>process.cwd()+'/'+p)}));
