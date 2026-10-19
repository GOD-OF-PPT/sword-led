"""Format export only: preserve original pixels/alpha, record authored atlas source rectangles."""
from pathlib import Path
from PIL import Image
import hashlib,json,subprocess

root=Path(__file__).resolve().parents[2]
names=['blade-jian-v2','blade-dao-v2','blade-cleaver-v1','trait-props-v1']
# Rectangles are finalized after visual inspection of the original production atlas.
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
records=[]
for name in names:
    src=root/'design/d/originals'/f'{name}.png'; dest=root/'public/assets/d'/f'{name}.webp'
    if dest.exists(): raise RuntimeError(f'Refusing to replace {dest}')
    subprocess.run(['cwebp','-quiet','-q','92','-m','6','-alpha_q','100','-exact',str(src),'-o',str(dest)],check=True)
    image=Image.open(src).convert('RGBA'); exported=Image.open(dest).convert('RGBA'); alpha=image.getchannel('A'); data=alpha.tobytes()
    assert image.size==exported.size and data==exported.getchannel('A').tobytes()
    assert alpha.getextrema()[0]==0 and alpha.getextrema()[1]>=250 and data.count(0)/len(data)>.35
    prompt=root/'design/d/prompts'/f'{name}.md'
    records.append(dict(name=name,original=str(src.relative_to(root)),originalSha256=sha(src),src='/assets/d/'+dest.name,sha256=sha(dest),bytes=dest.stat().st_size,width=image.width,height=image.height,alphaRange=alpha.getextrema(),transparentFraction=data.count(0)/len(data),alphaMatchesOriginal=True,prompt=str(prompt.relative_to(root)),promptSha256=sha(prompt),reference='design/d/reference-main-v2.png',referenceSha256=sha(root/'design/d/reference-main-v2.png')))
assert sum(r['bytes'] for r in records)<2*1024*1024
(root/'design/d/v3-art-manifest.json').write_text(json.dumps(dict(tool='builtin image_gen.imagegen',task='T11.4.2.3b',processing='cwebp format export only; no creative edits or alpha retouching',assets=records,totalAdditionalRuntimeBytes=sum(r['bytes'] for r in records)),ensure_ascii=False,indent=2)+'\n')
print(json.dumps(dict(assets=len(records),bytes=sum(r['bytes'] for r in records),alphaPreserved=True)))
