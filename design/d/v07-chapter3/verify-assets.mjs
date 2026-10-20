import fs from 'node:fs';import crypto from 'node:crypto';import zlib from 'node:zlib';import {spawnSync} from 'node:child_process';
const root='design/d/v07-chapter3/',outputRoot='public/assets/d/v07-chapter3/',plan=JSON.parse(fs.readFileSync(root+'asset-plan.json')),exportLog=JSON.parse(fs.readFileSync(root+'export-log.json')),visual=JSON.parse(fs.readFileSync(root+'visual-review.json'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const assert=(c,m)=>{if(!c)throw Error(m);};
const describe=path=>{const b=fs.readFileSync(path);return{path,bytes:b.length,sha256:hash(b)};};
const check=expected=>{const actual=describe(expected.path);assert(actual.bytes===expected.bytes&&actual.sha256===expected.sha256,'Source hash mismatch '+expected.path);return actual;};
function pngInfo(path){
 const b=fs.readFileSync(path);assert(b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),'PNG signature '+path);
 const chunks=[];for(let p=8;p<b.length;){const n=b.readUInt32BE(p);assert(p+n+12<=b.length,'PNG bounds '+path);chunks.push(b.toString('ascii',p+4,p+8));p+=n+12;}
 assert(chunks.includes('IDAT')&&chunks.at(-1)==='IEND','PNG completeness '+path);
 return{width:b.readUInt32BE(16),height:b.readUInt32BE(20),bitDepth:b[24],colorType:b[25],interlace:b[28],transparencyChunk:chunks.includes('tRNS'),alpha:[4,6].includes(b[25])||chunks.includes('tRNS')};
}
function webpInfo(path){
 const r=spawnSync('webpinfo',['-summary',path],{encoding:'utf8'}),log=r.stdout+r.stderr;assert(r.status===0&&log.includes('No error detected.'),'WebP format '+path);
 const value=label=>Number(log.match(new RegExp('  '+label+': (\\d+)'))?.[1]);
 const width=value('Width'),height=value('Height'),alpha=Boolean(value('Alpha')),animation=Boolean(value('Animation'));
 assert(Number.isFinite(width)&&Number.isFinite(height),'WebP dimensions '+path);
 const d=spawnSync('dwebp',[path,'-pam','-o','-'],{maxBuffer:32*1024**2});assert(d.status===0,'WebP decode '+path);
 const marker=Buffer.from('ENDHDR\n'),end=d.stdout.indexOf(marker)+marker.length,header=d.stdout.subarray(0,end).toString('ascii'),depth=Number(header.match(/DEPTH (\d+)/)?.[1]),pixels=d.stdout.subarray(end);
 assert(end>=marker.length&&depth===4&&pixels.length===width*height*4,'PAM RGBA data '+path);
 let min=255,max=0;for(let i=3;i<pixels.length;i+=4){min=Math.min(min,pixels[i]);max=Math.max(max,pixels[i]);}assert(min===255&&max===255,'Opaque pixels '+path);
 return{width,height,alpha,animation,decodedAlpha:{min,max},decodedRGBASha256:hash(pixels),log};
}
const records=[];
for(const asset of plan.assets){
 const sourceRecordPath=root+asset.id+'-source.json',s=JSON.parse(fs.readFileSync(sourceRecordPath));assert(s.mode==='built-in image_gen'&&s.id===asset.id,'Imagegen source identity '+asset.id);
 const source=check(s.source),original=check(s.original),prompt=check(s.prompt),references=s.references.map(check);assert(source.sha256===original.sha256,'Exact source copy '+asset.id);
 assert(JSON.stringify(references.map(r=>r.path))===JSON.stringify(asset.references),'Reference chain '+asset.id);
 const png=pngInfo(original.path);assert(png.width*png.height>=1000000&&Math.abs(png.width/png.height/(16/9)-1)<0.005&&png.bitDepth===8&&png.colorType===2&&!png.alpha,'Native approximately 16:9 source dimensions/opacity '+asset.id);
 assert(s.width===png.width&&s.height===png.height&&s.bitDepth===png.bitDepth&&s.colorType===png.colorType,'Recorded source dimensions '+asset.id);
 const runtime=describe(outputRoot+asset.id+'.webp'),webp=webpInfo(runtime.path);assert(webp.width===png.width&&webp.height===png.height&&!webp.alpha&&!webp.animation,'Runtime dimensions/opacity '+asset.id);
 const logged=exportLog.results.find(r=>r.id===asset.id),args=['-q',String(exportLog.quality),'-m',String(exportLog.method),'-metadata','none',original.path,'-o',runtime.path];
 assert(logged&&logged.source===original.path&&logged.output===runtime.path&&logged.bytes===runtime.bytes&&JSON.stringify(logged.args)===JSON.stringify(args),'Actual export log '+asset.id);
 const encoded=spawnSync('cwebp',[...args.slice(0,-1),'-'],{maxBuffer:16*1024**2});assert(encoded.status===0&&hash(encoded.stdout)===runtime.sha256,'Exact source-to-WebP reproduction '+asset.id);
 // Preserve actual encoder diagnostics byte for byte in gzip, including terminal whitespace.
 fs.mkdirSync(root+'verification/encoder-logs',{recursive:true});const rawLogPath=root+'verification/encoder-logs/'+asset.id+'.stderr.log.gz';fs.writeFileSync(rawLogPath,zlib.gzipSync(encoded.stderr));assert(zlib.gunzipSync(fs.readFileSync(rawLogPath)).equals(encoded.stderr),'Exact raw encoder log '+asset.id);const rawLog={...describe(rawLogPath),uncompressedBytes:encoded.stderr.length,uncompressedSha256:hash(encoded.stderr),command:['cwebp',...args.slice(0,-1),'-']};
 const reviewed=visual.assets.find(r=>r.id===asset.id);assert(reviewed&&reviewed.originalSha256===original.sha256&&reviewed.runtimeSha256===runtime.sha256,'Pinned manual review '+asset.id);
 records.push({...asset,sourceRecord:describe(sourceRecordPath),source,original,prompt,references,png,runtime,webp,exactSourceCopy:true,sourceToRuntimeReproducedInMemory:true,visualReview:reviewed,export:{tool:'cwebp',quality:exportLog.quality,method:exportLog.method,metadata:'none',resized:false,cropped:false,creativePostprocessing:false,rawReencodeLog:rawLog}});
}
const master=describe(root+'originals/mountain-pass-arrival-v1.png');
for(const id of ['relay-one-v1','relay-complete-v1']){const r=records.find(r=>r.id===id),masterInfo=pngInfo(master.path);assert(r.references.length===1&&r.references[0].path===master.path&&r.references[0].sha256===master.sha256,'Direct common relay master '+id);assert(r.png.width===masterInfo.width&&r.png.height===masterInfo.height,'Relay exact master dimensions '+id);}
const bytes=records.reduce((n,r)=>n+r.runtime.bytes,0),budget={bytes,MiB:bytes/1024**2,targetBytes:2*1024**2,hardBudgetBytes:2.5*1024**2,targetMet:bytes<=2*1024**2,targetVarianceBytes:Math.max(0,bytes-2*1024**2),hardBudgetMet:bytes<=2.5*1024**2,qualityDecision:'q72 selected after actual q60 runtime inspection; coordinator explicitly prioritized visual quality within the 2.5MiB hard budget over the 2MiB soft target'};assert(budget.hardBudgetMet,'Combined runtime hard budget 2.5MiB');
const manifest={schema:1,generationMode:'built-in image_gen',sourceDimensions:'native per-asset approximately 16:9 dimensions preserved; see each png record',relayCommonMaster:master,budget,assets:records.map(({id,intent,usage,condition,sourceRecord,original,prompt,references,png,runtime,export:settings})=>({id,intent,usage,condition,sourceRecord,original,prompt,references,png,runtime,export:settings}))};
const verification={schema:1,verifiedAt:new Date().toISOString(),allChecksPassed:true,budget,visualReviewRecord:describe(root+'visual-review.json'),relayCommonMaster:master,checks:records,visualObservations:visual.observations,scope:'Art provenance, format, opacity, visual review and exact transcoding only; not actual UI business acceptance'};
fs.writeFileSync(root+'manifest.json',JSON.stringify(manifest,null,2)+'\n');fs.writeFileSync(root+'verification.json',JSON.stringify(verification,null,2)+'\n');console.log(JSON.stringify({allChecksPassed:true,runtimeFiles:records.length,budget,relayCommonMaster:master},null,2));
