import fs from 'node:fs';import crypto from 'node:crypto';
const root='design/d/v07-chapter3/',[id,source]=process.argv.slice(2),plan=JSON.parse(fs.readFileSync(root+'asset-plan.json'));
const asset=plan.assets.find(a=>a.id===id);if(!asset||!source)throw Error('Known id and source required');
const stats=fs.statfsSync('.');if(stats.bavail*stats.bsize<256*1024**2)throw Error('DISK_BELOW_256_MIB');
fs.mkdirSync(root+'originals',{recursive:true});const original=root+'originals/'+id+'.png';if(fs.existsSync(original))throw Error('Do not overwrite '+original);
const describe=path=>{const b=fs.readFileSync(path);return{path,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')}};
fs.copyFileSync(source,original);const b=fs.readFileSync(original),meta={mode:'built-in image_gen',id,intent:asset.intent,usage:asset.usage,condition:asset.condition,sourcePath:source,source:describe(source),original:describe(original),prompt:describe(root+'prompts/'+id+'.txt'),references:asset.references.map(describe),width:b.readUInt32BE(16),height:b.readUInt32BE(20),bitDepth:b[24],colorType:b[25],transparent_background:false};
if(meta.source.sha256!==meta.original.sha256)throw Error('Copy hash mismatch');fs.writeFileSync(root+id+'-source.json',JSON.stringify(meta,null,2)+'\n');console.log(JSON.stringify({id,original,width:meta.width,height:meta.height,colorType:meta.colorType,copyExact:true}));
