import pathlib,json,hashlib,re,subprocess,datetime
base=pathlib.Path('tmp/goal4-T02');process=json.loads((base/'runs/matrix-01/process.json').read_text());assert process['status']=='terminal' and process['actualExitCode']==0,'Do not activate during the frozen matrix or before its actual successful terminal'
report=json.loads((base/'runs/matrix-01/report.json').read_text());assert report['stats']['expected']==336 and all(report['stats'][key]==0 for key in ['unexpected','skipped','flaky'])
subprocess.run(['rtk','proxy','node','scripts/release-fingerprint.mjs','verify',str(base/'matrix-01-fingerprint.json')],check=True)
sha=lambda b:hashlib.sha256(b).hexdigest();entries=[]
for name in ['v5-completeness.spec.ts','v5-completeness-helpers.ts','v5-input-completeness.spec.ts']:
 source=base/'drafts'/name;target=pathlib.Path('tests/e2e')/name;assert not target.exists(),str(target)+' already exists'
 raw=source.read_bytes();text=raw.decode('utf8')
 if text.startswith('/**'):text=text[text.index('*/')+2:].lstrip('\n')
 else:text=re.sub(r'\A(?://[^\n]*\n)+','',text).lstrip('\n')
 activated='// Current v5 UI boundaries. Each test labels restored fixtures and fresh openings explicitly.\n'+text
 target.write_text(activated);entries.append({'draft':str(source),'draftSha256':sha(raw),'target':str(target),'activeSha256':sha(target.read_bytes()),'transformation':'Replaced the obsolete unexecuted-draft header only; body and imports retained'})
record={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'matrixStats':report['stats'],'existing389ConsumersAnd80RuntimeVerifiedBeforeActivation':True,'added':entries,'scope':'Added independent tail cases after the actual336 terminal. No existing test, production source or runtime file changed. Strict/list/browser tail validation still pending.'}
(base/'tail-activation.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'activated':len(entries),'matrixExpected':336,'tailExecuted':False}))
