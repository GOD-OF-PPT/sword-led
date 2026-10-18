"""Losslessly encode browser evidence, retaining raw PNGs locally and verifying exact RGBA.

This only changes the image container. It never retouches, resizes or redraws screenshots.
Optional archive maintenance requires Pillow and cwebp; running the game/tests does not.
"""
from pathlib import Path
import argparse, json, hashlib, shutil, subprocess
from PIL import Image

parser=argparse.ArgumentParser()
parser.add_argument('--report',required=True)
parser.add_argument('--out',required=True)
args=parser.parse_args()
report_path=Path(args.report).resolve(); out=Path(args.out).resolve()
if out.exists():raise SystemExit('Use a new output directory; evidence is never overwritten')
if not shutil.which('cwebp'):raise SystemExit('Optional lossless export requires cwebp')
raw_report=report_path.read_bytes(); report=json.loads(raw_report)
out.mkdir(parents=True); (out/'originals').mkdir(); (out/'encoded').mkdir()
(out/'original-report.json').write_bytes(raw_report)
sha=lambda b:hashlib.sha256(b).hexdigest()
records=[];cache={}
def encode(path):
    source=Path(path).resolve(); data=source.read_bytes(); digest=sha(data)
    if digest not in cache:
        raw=out/'originals'/f'{digest}.png'; raw.write_bytes(data)
        with Image.open(raw) as im:rgba=im.convert('RGBA');info=dict(im.info)
        pixel_hash=sha(rgba.tobytes()); target=out/'encoded'/f'{digest}.webp'
        preserve_gamma='gamma' not in info or 'srgb' in info or 'icc_profile' in info
        reason=None
        if preserve_gamma:
            subprocess.run(['cwebp','-quiet','-lossless','-q','0','-m','0','-exact','-metadata','all',str(raw),'-o',str(target)],check=True)
            with Image.open(target) as encoded:
                if encoded.size!=rgba.size or encoded.convert('RGBA').tobytes()!=rgba.tobytes():raise ValueError('Lossless pixel verification failed: '+str(source))
                metadata_equal=all(info.get(k)==encoded.info.get(k) for k in ['icc_profile','exif'] if k in info)
            if not metadata_equal:reason='retain original metadata'
            elif target.stat().st_size>=len(data):reason='original container is smaller'
        else:reason='retain non-sRGB gamma metadata'
        selected=raw if reason else target
        if reason and target.exists():target.unlink()
        cache[digest]=dict(originalSha256=digest,originalBytes=len(data),rawLocalPath=str(raw),width=rgba.width,height=rgba.height,rgbaSha256=pixel_hash,selectedPath=str(selected),selectedSha256=sha(selected.read_bytes()),selectedBytes=selected.stat().st_size,format='image/png' if reason else 'image/webp',pixelsIdentical=True,retainedOriginalReason=reason)
    record=dict(sourcePath=str(source),**cache[digest]);records.append(record);return record

def walk(suites):
    for suite in suites:
        for spec in suite.get('specs',[]):
            for test in spec.get('tests',[]):
                for result in test.get('results',[]):
                    for attachment in result.get('attachments',[]):
                        path=attachment.get('path')
                        if path and Path(path).suffix.lower()=='.png':
                            record=encode(path);attachment['path']=record['selectedPath'];attachment['contentType']=record['format'];attachment['originalImage']=record
        walk(suite.get('suites',[]))
walk(report['suites'])
metadata=dict(method='cwebp lossless -q 0 -m 0 -exact -metadata all; exact decoded RGBA verified; no crop/retouch/resize',originalReportSha256=sha(raw_report),rawPngsRetainedLocally=True,rawCacheIsNotClaimedAsRemoteArtifact=True,images=records,uniqueImages=len(cache),uniqueOriginalBytes=sum(r['originalBytes'] for r in cache.values()),uniqueArchivedBytes=sum(r['selectedBytes'] for r in cache.values()))
report['imageEncoding']=metadata
(out/'report.json').write_text(json.dumps(report,indent=2)+'\n')
(out/'images.json').write_text(json.dumps(metadata,indent=2)+'\n')
print(json.dumps({k:v for k,v in metadata.items() if k!='images'}))
