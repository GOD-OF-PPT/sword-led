import json,hashlib,subprocess,datetime
from pathlib import Path
base=Path('tmp/goal4-T02');d=json.loads((base/'baseline.json').read_text());sha=lambda b:hashlib.sha256(b).hexdigest();checks={}
for group in ['oldSource','coreV5','protected']:
 for entry in d[group]:
  b=Path(entry['path']).read_bytes();assert len(b)==entry['bytes'] and sha(b)==entry['sha256'],entry['path']
 checks[group]=len(d[group])
sdk=[e for e in d['runtime'] if e['path'].endswith('.js') and '/assets/' not in e['path']];assert len(sdk)==9
for entry in sdk:assert sha(Path(entry['path']).read_bytes())==entry['sha256'],entry['path']
checks['SDK']=len(sdk)
ref=subprocess.check_output(['rtk','proxy','git','rev-parse','codex/workshop-scene-full-evidence'],text=True).strip();assert ref==d['backupRef']
assert sha(Path('goal-4/input.md').read_bytes())=='b961f5c651df51121659687138cfe5edf125e25dadda11642136dfc6aaca852b'
assert sha(Path('docs/evidence/v08-approval/approved-proposal.md').read_bytes())=='c6a605c29e29d83ee9f3bae6700270af96d749f30d29e6de2c17bfb14acd04aa'
# The main batch was fingerprint-verified BEFORE activating the three independent tail files.
# Recheck every original key; additions cannot silently replace its consumers or runtime bytes.
main=json.loads((base/'matrix-01-fingerprint.json').read_text());tail=json.loads((base/'tail-matrix-01-fingerprint.json').read_text())
for group in ['sourceHashes','buildFiles']:
 for p,entry in main[group].items():assert tail[group][p]==entry,(group,p);assert sha(Path(p).read_bytes())==entry['sha256'],p
additions=sorted(set(tail['sourceHashes'])-set(main['sourceHashes']))
assert additions==['tests/e2e/v5-completeness-helpers.ts','tests/e2e/v5-completeness.spec.ts','tests/e2e/v5-input-completeness.spec.ts','tmp/goal4-T02/activate-tail.py']
result={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'ok':True,'unchanged':checks,'backupRef':ref,'mainExistingInputsUnchanged':len(main['sourceHashes']),'productRuntimeUnchangedBetweenMainAndTail':len(main['buildFiles']),'additionsAfterMainTerminal':additions,'scope':'Preservation and composite-batch identity, not execution or fun evidence.'}
(base/'preserved.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps(result,ensure_ascii=False))
