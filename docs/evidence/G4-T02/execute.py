import sys,subprocess,pathlib,json,datetime,re,os
label=sys.argv[1]
if not re.fullmatch(r'[a-z0-9-]+',label):raise ValueError('Unsafe run label')
command=sys.argv[2:]
if not command or command[0]!='rtk':raise ValueError('Command must begin rtk')
out=pathlib.Path('tmp/goal4-T02/runs')/label;out.mkdir(parents=True,exist_ok=False)
now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
meta={'label':label,'startedAt':now(),'command':command,'cwd':os.getcwd(),'status':'running'}
proc=subprocess.Popen(command,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
meta['pid']=proc.pid;(out/'process.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
with (out/'stdout.log').open('wb') as f:
 while True:
  line=proc.stdout.readline()
  if not line:break
  f.write(line);f.flush();sys.stdout.buffer.write(line);sys.stdout.buffer.flush()
code=proc.wait();meta.update({'completedAt':now(),'status':'terminal','actualExitCode':code});(out/'process.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n');sys.exit(code)
