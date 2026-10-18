"""Encode original imagegen PNGs without retouching; verify alpha and retain provenance."""
from pathlib import Path
import hashlib, json, shutil, subprocess, struct, zlib
from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[2]
DESIGN = ROOT / 'design/d'
PUBLIC = ROOT / 'public/assets/d'
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def inspect(p):
    raw = p.read_bytes()
    if p.suffix == '.png':
        assert raw[:8] == b'\x89PNG\r\n\x1a\n'
        pos = 8
        while pos < len(raw):
            size = struct.unpack('>I',raw[pos:pos+4])[0]
            chunk = raw[pos+4:pos+8+size]
            assert zlib.crc32(chunk) & 0xffffffff == struct.unpack('>I',raw[pos+8+size:pos+12+size])[0]
            pos += 12 + size
        assert raw[-8:-4] == b'IEND'
    im = Image.open(p).convert('RGBA'); a = im.getchannel('A')
    return im, a, dict(width=im.width,height=im.height,alphaRange=a.getextrema(),alphaSha256=hashlib.sha256(a.tobytes()).hexdigest(),transparentFraction=a.histogram()[0]/(im.width*im.height),visibleBounds=a.point(lambda x:255 if x>=16 else 0).getbbox())

PUBLIC.mkdir(parents=True, exist_ok=True)
records=json.loads((DESIGN/'generation-records.json').read_text())
manifest=dict(task='T11.3',direction='D 行脚灯炉',tool='image_gen.imagegen',mode='built-in',model='not exposed by tool',encoding=dict(tool='cwebp',version=subprocess.check_output(['cwebp','-version'],text=True).strip(),arguments=['-q','90','-m','6','-alpha_q','100','-exact'],purpose='format export only, no creative image edits'),images=[],runtime=[])
for record in records:
    name=record['name']; p=DESIGN/'originals'/f'{name}.png'; source=Path(record['source']); prompt=DESIGN/'prompts'/f'{name}.md'
    assert not source.exists() or sha(p)==sha(source)
    im,a,info=inspect(p)
    item=dict(**record,**info,path=str(p.relative_to(ROOT)),sha256=sha(p),bytes=p.stat().st_size,prompt=str(prompt.relative_to(ROOT)),promptSha256=sha(prompt),referenceHashes={r:sha(ROOT/r) for r in record['references']})
    manifest['images'].append(item)
    if not record['selected']: continue
    out=PUBLIC/f'{name}.webp'
    if not out.exists():subprocess.run(['cwebp','-quiet','-q','90','-m','6','-alpha_q','100','-exact',str(p),'-o',str(out)],check=True)
    enc,ea,einfo=inspect(out)
    assert enc.size==im.size and not ImageChops.difference(a,ea).getbbox(), name
    if record['kind'] not in ('background','texture'):
        assert info['alphaRange']==(0,255) and info['transparentFraction']>.25, name
        # imagegen can leave a one-alpha brush speck at a corner; retain its exact alpha.
        assert max(a.getpixel(t) for t in [(0,0),(im.width-1,0),(0,im.height-1),(im.width-1,im.height-1)])<=1, name
    manifest['runtime'].append(dict(name=name,kind=record['kind'],src=f'/assets/d/{out.name}',**einfo,sha256=sha(out),bytes=out.stat().st_size,alphaMatchesOriginal=True))
manifest['totalRuntimeImageBytes']=sum(i['bytes'] for i in manifest['runtime'])
assert manifest['totalRuntimeImageBytes']<=3*1024*1024
(DESIGN/'manifest.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n')
(PUBLIC/'manifest.json').write_text(json.dumps(dict(direction='D',assets=manifest['runtime'],totalBytes=manifest['totalRuntimeImageBytes']),indent=2,ensure_ascii=False)+'\n')
print(json.dumps(dict(originals=len(records),runtime=len(manifest['runtime']),bytes=manifest['totalRuntimeImageBytes'],alphaPreserved=True)))
