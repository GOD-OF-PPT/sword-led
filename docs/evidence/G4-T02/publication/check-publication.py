from pathlib import Path
import json,hashlib,subprocess,base64,datetime,urllib.parse
base=Path('tmp/goal4-T02');out=Path('docs/evidence/G4-T02');source='04c794c7bb1901212d72f5f44c66db5edee885de';sha=lambda b:hashlib.sha256(b).hexdigest()
run=lambda args:subprocess.check_output(['rtk','proxy',*args],text=True).strip()
push=json.loads((base/'runs/source-push-01/process.json').read_text());assert push['status']=='terminal' and push['actualExitCode']==0
assert run(['git','rev-parse','HEAD'])==source
remote=run(['git','ls-remote','origin','refs/heads/main']).split()[0];assert remote==source
blobs=[]
for path in ['src/presentation-v5/app.ts','tests/e2e/v5-keyboard.spec.ts','tests/e2e/v5-completeness.spec.ts','playwright.v5-ui.config.ts','docs/evidence/G4-T02/run.json','docs/v0.8-acceptance-map.md','docs/reviews/G4-T02-current-flows.md']:
 response=json.loads(run(['gh','api',f'repos/GOD-OF-PPT/sword-led/contents/{urllib.parse.quote(path,safe="/")}?ref={source}']));b=base64.b64decode(response['content']);assert b==Path(path).read_bytes();assert response['sha']==run(['git','hash-object',path]);blobs.append({'path':path,'gitBlob':response['sha'],'sha256':sha(b),'matches':True})
result={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceCommit':source,'freshRemoteMain':remote,'actualPushHandle':64930,'actualPushProcess':push,'blobs':blobs,'wholeGoalComplete':False};(out/'source-publication.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'sourceCommit':source,'freshRemoteMain':remote,'actualPushExit':0,'matchingGitHubBlobs':len(blobs)}))
