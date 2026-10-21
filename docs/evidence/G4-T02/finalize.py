from pathlib import Path
import json,hashlib,gzip,datetime,collections
base=Path('tmp/goal4-T02');out=Path('docs/evidence/G4-T02');sha=lambda b:hashlib.sha256(b).hexdigest()
projects=[f'{engine}-dpr{dpr}' for engine in ['chromium','firefox','webkit'] for dpr in [1,2]]
def read(p):return json.loads(Path(p).read_text())
def specs(suites):
 for suite in suites:
  yield from suite.get('specs',[])
  yield from specs(suite.get('suites',[]))
batches=[]
for label,logical in [('matrix-01',56),('tail-matrix-01',8)]:
 p=read(base/'runs'/label/'process.json');r=read(base/'runs'/label/'report.json');assert p['status']=='terminal' and p['actualExitCode']==0
 assert r['stats']['expected']==logical*6 and all(r['stats'][k]==0 for k in ['skipped','unexpected','flaky']) and not r.get('errors')
 counts=collections.Counter();caseRows=[]
 for spec in specs(r['suites']):
  for t in spec['tests']:
   assert t['projectName'] in projects and t['status']=='expected' and len(t['results'])==1
   result=t['results'][0];assert result['status']=='passed' and result['retry']==0 and not result['errors']
   counts[t['projectName']]+=1;caseRows.append({'project':t['projectName'],'file':spec['file'],'title':spec['title'],'status':result['status'],'retry':result['retry']})
 assert dict(counts)=={p:logical for p in projects}
 fp=read(base/(label+'-fingerprint.json'))
 batches.append({'label':label,'logicalCases':logical,'actualPassed':len(caseRows),'projects':dict(counts),'process':p,'stats':r['stats'],'cases':caseRows,'sourceInputs':len(fp['sourceHashes']),'runtimeFiles':len(fp['buildFiles']),'fingerprint':str(base/(label+'-fingerprint.json'))})
for label in ['build-04','tail-typecheck-02','replay-matrix-01','replay-tail-matrix-01','published-smoke-01']:
 p=read(base/'runs'/label/'process.json');assert p['status']=='terminal' and p['actualExitCode']==0,label
for label in ['matrix-01','tail-matrix-01']:
 r=read(base/f'replay-{label}.json');assert r['ok'] and r['actualSavedObservations']==r['rawMatches']
preserved=read(base/'preserved.json');assert preserved['ok'];published=read(base/'published.json');assert published['ok'] and len(published['http'])==80 and published['errors']==[]
mapfile=out/'archive-map.json';mapping=read(mapfile);by={e['original']:e for e in mapping['archived']};originals={e['path']:e for e in mapping['allLocalOriginals']}
def archive(p,relative=None):
 p=Path(p);b=p.read_bytes();key=str(p);info={'path':key,'bytes':len(b),'sha256':sha(b)}
 if key in originals:assert originals[key]==info
 originals[key]=info
 relative=Path(relative) if relative else p.relative_to(base);compress=p.suffix in ['.json','.log'] and len(b)>65536;target=out/(str(relative)+('.gz' if compress else ''));encoded=gzip.compress(b,mtime=0) if compress else b
 target.parent.mkdir(parents=True,exist_ok=True)
 if target.exists():assert target.read_bytes()==encoded,str(target)
 else:target.write_bytes(encoded)
 entry={'original':key,'archive':str(target),'rawBytes':len(b),'rawSha256':sha(b),'archiveBytes':len(encoded),'archiveSha256':sha(encoded),'encoding':'gzip' if compress else 'identity'}
 if key in by:assert by[key]==entry
 by[key]=entry
extras=['tail-preflight-01-fingerprint.json','tail-matrix-01-fingerprint.json','tail-activation.json','activate-tail.py','preserve.py','preserved.json','publish.mjs','snapshot.json','published.json','published-raw-run.json','finalize.py','visual-selection.json','scroll-review.mjs','scroll-review-02.mjs','scroll-review-03.mjs','scroll-review-02-wheel-frames.json','scroll-review-03-wheel-frames.json','scroll-review-03.json','scroll-review-note.md','webkit-1280-actual-wheel-growth.png','webkit-1280-actual-wheel-growth-03.png']
for name in extras:archive(base/name)
for p in sorted((base/'drafts').rglob('*')):
 if p.is_file():archive(p)
for name in ['G4-T02-current-case-map.md','G4-T02-visual-review.md','G4-T02-cross-engine-visual-review.md','G4-T02-v5-storage-coverage.md']:
 archive(Path('tmp')/name,Path('reviews')/name)
mapping.update({'scope':'Original reports/logs/state JSON archived losslessly; selected screenshots plus every failure screenshot archived. All original local files retained and SHA listed. Execution is established by actual process/report, not file presence.','archived':[by[k] for k in sorted(by)],'allLocalOriginals':[originals[k] for k in sorted(originals)]});mapfile.write_text(json.dumps(mapping,ensure_ascii=False,indent=2)+'\n')
result={'recordedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'baseCommit':'0a10baac4857099deb6911b1da288edab78c8649','rulesVersion':'forge-v5','task':'goal-4/T02','logicalCases':64,'actualPassed':384,'batches':batches,'compositeScope':'Two separately frozen batches, not one invocation. Main389 original inputs and same80 runtime checked unchanged before/after three independent tail tests and activation script were added.','runtimeFiles':read(base/'tail-matrix-01-fingerprint.json')['buildFiles'],'sourceHashes':read(base/'tail-matrix-01-fingerprint.json')['sourceHashes'],'preserved':preserved,'replay':[{k:v for k,v in read(base/f'replay-{label}.json').items() if k!='files'} for label in ['matrix-01','tail-matrix-01']],'freshUIJourneyCounts':{'perProject':5,'projects':6,'total':30,'victory':18,'return':6,'defeat':6,'scope':'Fresh UI campaigns only; restored boundary fixtures not included. Counts do not prove balance or human fun.'},'actualFailuresRetained':{'build-01':'four consumer TypeScript errors','preflight-01':'two real backup-source product failures','preflight-02':'four consumer matcher/route errors','tail-preflight-01':'one consumer qualification-text matcher error'},'preview':{'url':'http://127.0.0.1:4179/','snapshot':published['snapshot'],'session':published['previewSession'],'httpFiles':80,'actualSmokeExit':0,'errors':[],'scope':'Self-owned new context only; user profile/tab/save untouched; local not public deployment.'},'review':'docs/reviews/G4-T02-current-flows.md','remaining':['G4-T03 native browser lifecycle/audio/art failures/long-save/performance and three-task review','G4-T04 original five-task final audit and human feedback'],'wholeGoalComplete':False}
(out/'run.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'ok':True,'actualPassed':384,'batches':[{'label':b['label'],'actualPassed':b['actualPassed']} for b in batches],'archiveEntries':len(by),'localOriginals':len(originals),'wholeGoalComplete':False}))
