# Format-only export of the two versioned revision assets; refuses replacing existing WebP.
import json, hashlib, subprocess
from pathlib import Path
from PIL import Image
out=Path('public/assets/d'); records=[]
sha=lambda b:hashlib.sha256(b).hexdigest()
for name,kind in [('forge-backdrop-v2','background'),('commission-guard-v2','portrait')]:
    src=Path('design/d/originals')/(name+'.png'); dest=out/(name+'.webp')
    assert not dest.exists()
    subprocess.run(['cwebp','-quiet','-q','90','-alpha_q','100','-exact',str(src),'-o',str(dest)],check=True)
    original=Image.open(src).convert('RGBA'); img=Image.open(dest).convert('RGBA'); a=img.getchannel('A'); aa=a.tobytes()
    assert original.size==img.size and original.getchannel('A').tobytes()==aa
    records.append(dict(name=name,kind=kind,src='/assets/d/'+dest.name,width=img.width,height=img.height,alphaRange=list(a.getextrema()),alphaSha256=sha(aa),transparentFraction=aa.count(0)/len(aa),visibleBounds=list(a.getbbox()),sha256=sha(dest.read_bytes()),bytes=dest.stat().st_size,alphaMatchesOriginal=True,original=str(src),originalSha256=sha(src.read_bytes()),prompt='design/d/prompts/'+name+'.md',promptSha256=sha((Path('design/d/prompts')/(name+'.md')).read_bytes()),reference='design/d/reference-main-v2.png',referenceSha256=sha(Path('design/d/reference-main-v2.png').read_bytes())))
old=json.loads((out/'manifest.json').read_text()); old['assets']=[records[0] if a['name']=='forge-backdrop-v1' else a for a in old['assets']]+[records[1]];old['totalBytes']=sum(a['bytes'] for a in old['assets']); old['revision']='2026-10-19 actual-workshop-v2'
(out/'manifest.json').write_text(json.dumps(old,ensure_ascii=False,indent=2)+'\n')
Path('design/d/revision-v2-manifest.json').write_text(json.dumps(dict(tool='builtin image_gen.imagegen',model='not exposed by tool',creativeEdits='none; original PNGs preserved; cwebp format export only',assets=records),ensure_ascii=False,indent=2)+'\n')
print(json.dumps(dict(assets=records,totalRuntimeBytes=old['totalBytes']),ensure_ascii=False))
