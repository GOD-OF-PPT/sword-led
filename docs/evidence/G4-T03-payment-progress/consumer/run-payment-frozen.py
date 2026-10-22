import sys,subprocess,pathlib,json,datetime
label=sys.argv[1];command=sys.argv[2:]
base=pathlib.Path("tmp/goal4-T03");snapshot=base/(label+"-fingerprint.json")
if not command or command[0]!="rtk":raise ValueError("Consumer must start rtk")
extras=["tmp/goal4-T03/run-payment-frozen.py","tmp/goal4-T03/drafts/payment-ui","tmp/goal4-T03/drafts/canvas-compare/snapshot-server.mjs","docs/evidence/T11-4-2-3l1/journeys/victory.json","docs/evidence/T11-4-2-3i1/witness-fixed/complete.json","tmp/goal4-T03/execute.py","tmp/goal4-T03/run-frozen.py","tmp/goal4-T03/harness"]
subprocess.run(["rtk","proxy","node","scripts/release-fingerprint.mjs","capture",str(snapshot),*extras],check=True)
result=subprocess.run(["rtk","proxy","python3",str(base/"execute.py"),label,*command])
verified=subprocess.run(["rtk","proxy","node","scripts/release-fingerprint.mjs","verify",str(snapshot)],capture_output=True,text=True)
receipt={"at":datetime.datetime.now(datetime.timezone.utc).isoformat(),"consumerActualExitCode":result.returncode,"fingerprintActualExitCode":verified.returncode,"stdout":verified.stdout,"stderr":verified.stderr}
(base/"runs"/label/"end-fingerprint.json").write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+"\n")
print(json.dumps(receipt,ensure_ascii=False),flush=True)
sys.exit(result.returncode if verified.returncode==0 else 2)
