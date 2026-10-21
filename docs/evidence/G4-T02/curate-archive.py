from pathlib import Path
import json,hashlib,subprocess,shutil,gzip
base=Path('tmp/goal4-T02');out=Path('docs/evidence/G4-T02');sha=lambda b:hashlib.sha256(b).hexdigest()
# Only redundant, newly produced Git archive copies may be removed. The actual original PNGs stay intact.
assert not subprocess.check_output(['rtk','proxy','git','ls-files','docs/evidence/G4-T02'],text=True).strip()
selection=json.loads((base/'visual-selection.json').read_text());keep={e['relativePath'] for e in selection['screenshots']}
for name in ['victory','return','second-chapter-defeat']:
 matches=list((base/'runs/tail-matrix-01/artifacts').glob(f'*chromium-dpr1/restored-{name}-1280.png'));assert len(matches)==1;keep.add(str(matches[0]))
keep.add(str(base/'webkit-1280-actual-wheel-growth.png'))
wheel=base/'webkit-1280-actual-wheel-growth-03.png'
if wheel.exists():keep.add(str(wheel))
mapfile=out/'archive-map.json';mapping=json.loads(mapfile.read_text());by={e['original']:e for e in mapping['archived']};originals={e['path']:e for e in mapping['allLocalOriginals']};removed=[]
for key,e in list(by.items()):
 if Path(key).suffix!='.png' or key in keep or Path(key).name.startswith('test-failed'):continue
 original=Path(key);copy=Path(e['archive']);assert original.is_file() and sha(original.read_bytes())==e['rawSha256'];assert copy.is_relative_to(out) and copy.is_file() and sha(copy.read_bytes())==e['archiveSha256'];assert original.resolve()!=copy.resolve();copy.unlink();removed.append(e);del by[key]
for key in sorted(keep):
 p=Path(key);b=p.read_bytes();info={'path':key,'bytes':len(b),'sha256':sha(b)}
 if key in originals:assert originals[key]==info
 originals[key]=info;target=out/p.relative_to(base);target.parent.mkdir(parents=True,exist_ok=True)
 if target.exists():assert target.read_bytes()==b
 else:shutil.copyfile(p,target)
 by[key]={'original':key,'archive':str(target),'rawBytes':len(b),'rawSha256':sha(b),'archiveBytes':len(b),'archiveSha256':sha(b),'encoding':'identity'}
mapping.update({'scope':'All original local logs/JSON/PNG retained and SHA listed; raw JSON/log archives are lossless. Durable PNG copies are the six independently viewed cross-engine/DPR2 images, three ending representatives, actual720-height wheel check and every failure image. Redundant untracked Git archive PNG copies were removed to keep the repository lean, never original evidence.','archived':[by[k] for k in sorted(by)],'allLocalOriginals':[originals[k] for k in sorted(originals)]});mapfile.write_text(json.dumps(mapping,ensure_ascii=False,indent=2)+'\n')
for e in mapping['archived']:
 b=Path(e['archive']).read_bytes();assert sha(b)==e['archiveSha256'];assert sha(gzip.decompress(b) if e['encoding']=='gzip' else b)==e['rawSha256']
report={'ok':True,'scope':'Curation of duplicate archive copies only; no original evidence deleted, no screenshot edited/reencoded. All actual test failures remain archived.','selectedPNG':sorted(keep),'redundantArchiveCopiesRemoved':removed,'originalsStillRetained':len(originals),'archiveEntries':len(by),'archiveBytes':sum(p.stat().st_size for p in out.rglob('*') if p.is_file())};(out/'archive-curation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');shutil.copyfile(base/'curate-archive.py',out/'curate-archive.py');print(json.dumps({k:v for k,v in report.items() if k not in ['redundantArchiveCopiesRemoved','selectedPNG']}))
