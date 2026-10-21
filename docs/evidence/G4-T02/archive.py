import pathlib,json,hashlib,gzip,sys
base=pathlib.Path('tmp/goal4-T02');out=pathlib.Path('docs/evidence/G4-T02');out.mkdir(parents=True,exist_ok=True)
mapfile=out/'archive-map.json';mapping=json.loads(mapfile.read_text()) if mapfile.exists() else {'scope':'Lossless staged archive. Completion and actual execution scope are established by the final run/review, never by file presence.','archived':[],'allLocalOriginals':[]}
sha=lambda b:hashlib.sha256(b).hexdigest()
archiveBy={x['original']:x for x in mapping['archived']};originalBy={x['path']:x for x in mapping['allLocalOriginals']}
selected={'loan-event-offer-1280.png','loan-event-offer-1920.png','real-used-pardon-reacquired-1280.png','real-used-pardon-reacquired-1920.png','full-slot-real-replacement-1280.png','full-slot-real-replacement-1920.png','restored-twin-1-before-settlement-1280.png','restored-twin-1-chapter-summary-1920.png','changed-backup-requires-review-run-1280.png','changed-backup-requires-review-run-1920.png','changed-backup-requires-review-book-1280.png','changed-backup-requires-review-book-1920.png','keyboard-earned-challenge-victory-1280.png','keyboard-earned-challenge-victory-1920.png','fresh-mixed-return-ending-1280.png','fresh-two-new-ending-1920.png'}
paths=[]
for label in sys.argv[1:]:
 root=base/'runs'/label;process=json.loads((root/'process.json').read_text());assert process['status']=='terminal',label
 paths.extend(p for p in root.rglob('*') if p.is_file())
for name in ['baseline.json','checkpoint.json','execute.py','replay.mjs','preflight-01-fingerprint.json','preflight-02-fingerprint.json','preflight-03-fingerprint.json','matrix-01-fingerprint.json','archive.py']:
 p=base/name
 if p.exists() and name!='checkpoint.json':paths.append(p)
paths.extend(p for p in base.glob('replay-*.json') if p.is_file())
for p in sorted(set(paths)):
 b=p.read_bytes();original=str(p);info={'path':original,'bytes':len(b),'sha256':sha(b)}
 if original in originalBy:assert originalBy[original]==info,original+' changed after archive'
 originalBy[original]=info
 if p.suffix=='.png' and p.name not in selected and not p.name.startswith('test-failed'):continue
 relative=p.relative_to(base);compressed=p.suffix=='.log' or p.suffix=='.json' and len(b)>65536
 target=out/(str(relative)+('.gz' if compressed else ''));target.parent.mkdir(parents=True,exist_ok=True);encoded=gzip.compress(b,mtime=0) if compressed else b
 if target.exists():assert target.read_bytes()==encoded,str(target)+' would be overwritten with different data'
 else:target.write_bytes(encoded)
 entry={'original':original,'archive':str(target),'rawBytes':len(b),'rawSha256':sha(b),'archiveBytes':len(encoded),'archiveSha256':sha(encoded),'encoding':'gzip' if compressed else 'identity'}
 if original in archiveBy:assert archiveBy[original]==entry
 archiveBy[original]=entry
mapping['archived']=[archiveBy[p] for p in sorted(archiveBy)];mapping['allLocalOriginals']=[originalBy[p] for p in sorted(originalBy)];mapfile.write_text(json.dumps(mapping,ensure_ascii=False,indent=2)+'\n')
for entry in mapping['archived']:
 b=pathlib.Path(entry['archive']).read_bytes();assert sha(b)==entry['archiveSha256'];assert sha(gzip.decompress(b) if entry['encoding']=='gzip' else b)==entry['rawSha256']
print(json.dumps({'archiveEntries':len(mapping['archived']),'retainedLocalOriginals':len(mapping['allLocalOriginals']),'archiveBytes':sum(p.stat().st_size for p in out.rglob('*') if p.is_file()),'completionClaim':False}))
