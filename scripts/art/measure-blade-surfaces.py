"""Read alpha silhouettes to emit numeric contact profiles; no image pixels are modified."""
import ast,hashlib,json,re
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[2]
source=(root/'src/presentation-v3/art-data.ts').read_text()
rects=ast.literal_eval(re.search(r'=\s*(\[[\s\S]*\]);',source).group(1))
names=['blade-jian-v2','blade-dao-v2','blade-cleaver-v1']; rows=[]; inputs={}
for name,frames in zip(names,rects):
    path=root/'design/d/originals'/f'{name}.png';alpha=Image.open(path).convert('RGBA').getchannel('A');profiles=[]
    inputs[str(path.relative_to(root))]=hashlib.sha256(path.read_bytes()).hexdigest()
    for sx,sy,sw,sh in frames:
        height=min(174,1000*sh/sw);profile=[]
        for i in range(21):
            x=.36+i*.46/20;px=round(sx+(x*1100-32)*sw/1000)
            ys=[y for y in range(sy,sy+sh) if max(alpha.getpixel((xx,y)) for xx in range(px-1,px+2))>=180]
            if not ys:raise ValueError(f'No opaque metal at {name} x={x}')
            profile.append(round((240-height*.5+(min(ys)-sy)*height/sh)/400,6))
        profiles.append(profile)
    rows.append(profiles)
out=root/'src/presentation-v3/surface-data.ts'
out.write_text('/** Actual opaque blade upper edges at x=0.36..0.82 in 21 steps; alpha read only. */\nexport const BLADE_SURFACES:readonly (readonly (readonly number[])[])[]='+json.dumps(rows,separators=(',',':'))+';\n')
manifest=dict(method='alpha >= 180 at 3 source columns, no image editing',inputs=inputs,rectangles='src/presentation-v3/art-data.ts',samplesPerFrame=21,frames=15,output=str(out.relative_to(root)),sha256=hashlib.sha256(out.read_bytes()).hexdigest())
(root/'design/d/blade-surface-measurement.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(manifest))
