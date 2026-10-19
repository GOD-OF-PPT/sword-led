import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, readdir, mkdir, writeFile} from 'node:fs/promises';
import {resolve, join, relative} from 'node:path';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {gzipSync, gunzipSync} from 'node:zlib';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const fields = ['seed','policy','starter','accuracy','phase','rounds','met','strikes','broken','orders','coins','scrap','patterns','actions'];
// Deliberately independent of the producer's exported profile list.
const profiles = [];
for (const policy of ['light','balanced','heavy'])
  for (const starter of ['edgeTooth','bridgeClip','reheatSand'])
    for (const accuracy of ['perfect','steady','shaky']) profiles.push([policy,starter,accuracy]);
profiles.push(['raw','bridgeClip','perfect'],['salvage','bridgeClip','perfect']);
const key = r => [r.policy,r.starter,r.accuracy,r.seed].join('|');

export function inspectRows(summary, old) {
  assert.equal(summary.rulesVersion, 'forge-v2');
  assert.equal(summary.seeds, 1000);
  assert.equal(summary.profiles, 29);
  assert.equal(summary.cases, 29000);
  assert.equal(summary.replayedFinalStates, 29000);
  assert.equal(summary.batches, 1160);
  assert.equal(summary.rows.length, 29000);
  assert.equal(old.rulesVersion, 'forge-v2');
  assert.equal(old.seeds, 32);
  assert.equal(old.rows.length, 928);
  const byKey = new Map(), stats = [];
  for (const [index, profile] of profiles.entries()) {
    const rows = summary.rows.slice(index * 1000, (index + 1) * 1000);
    for (const [seedIndex, row] of rows.entries()) {
      assert.deepEqual(Object.keys(row).sort(), [...fields,'stateSha256'].sort());
      assert.deepEqual([row.policy,row.starter,row.accuracy], profile);
      assert.equal(row.seed, `v2-verify-${String(seedIndex).padStart(4,'0')}`);
      assert(!byKey.has(key(row)), 'Duplicate profile/seed');
      assert.match(row.stateSha256, /^[a-f0-9]{64}$/);
      assert(['victory','defeat'].includes(row.phase));
      for (const name of fields.slice(5)) assert(Number.isSafeInteger(row[name]) && row[name] >= 0, `Invalid ${name}`);
      assert(row.rounds >= 3 && row.rounds <= 12);
      assert(row.met <= row.rounds);
      assert(row.broken <= row.rounds * 3);
      assert(row.orders <= row.rounds && row.patterns <= row.strikes);
      assert(row.actions > 0 && row.actions <= 987 && row.strikes <= 840);
      if (row.phase === 'victory') assert.equal(row.rounds, 12);
      if (profile[0] === 'raw' || profile[0] === 'salvage') {
        assert.equal(row.phase, 'defeat');
        assert.equal(row.rounds, 3);
        assert.equal(row.strikes, 0);
      }
      byKey.set(key(row), row);
    }
    const victories = rows.filter(r => r.phase === 'victory');
    const average = (subset, field) => subset.length ? subset.reduce((n,r) => n+r[field], 0)/subset.length : null;
    stats.push({profile, cases:rows.length, victories:victories.length, defeats:rows.length-victories.length,
      meanRounds:average(rows,'rounds'), meanStrikes:average(rows,'strikes'), meanBroken:average(rows,'broken'),
      meanOrders:average(rows,'orders'), meanCoins:average(rows,'coins'), meanPatterns:average(rows,'patterns'),
      meanActions:average(rows,'actions'), victoryMeanActions:average(victories,'actions'),
      minActions:Math.min(...rows.map(r=>r.actions)), maxActions:Math.max(...rows.map(r=>r.actions))});
  }
  const oldKeys = new Set();
  for (const [index,row] of old.rows.entries()) {
    assert.deepEqual(Object.keys(row).sort(), [...fields].sort());
    assert.deepEqual([row.policy,row.starter,row.accuracy],profiles[Math.floor(index/32)]);
    assert.equal(row.seed,`v2-verify-${String(index%32).padStart(4,'0')}`);
    assert(!oldKeys.has(key(row))); oldKeys.add(key(row));
    const current = byKey.get(key(row)); assert(current, 'Missing old overlap');
    for (const field of fields) assert.equal(current[field], row[field], `Overlap changed: ${key(row)}/${field}`);
  }
  return {uniqueCases:byKey.size, profiles:stats, overlapRows:oldKeys.size,
    maxActions:Math.max(...summary.rows.map(r=>r.actions)), maxStrikes:Math.max(...summary.rows.map(r=>r.strikes))};
}

async function verifyHashes(expected, root) {
  for (const [name, digest] of Object.entries(expected))
    assert.equal(hash(await readFile(join(root,name))), digest, `Fingerprint changed: ${root}/${name}`);
}

export async function auditModel({input, oldPath, baselinePath, compiled, sdkPath, preview, out}) {
  const raw = await readFile(join(input,'summary.json')), summary = JSON.parse(raw);
  const oldRaw = await readFile(oldPath), old = JSON.parse(oldRaw);
  const baselineRaw = await readFile(baselinePath), baseline = JSON.parse(baselineRaw);
  const terminalPath='docs/evidence/T11-4-2/model-terminal-observation.json';
  const terminalRaw=await readFile(terminalPath), terminal=JSON.parse(terminalRaw);
  assert.equal(terminal.session,baseline.session);
  assert.equal(terminal.exitCode,0);
  assert.equal(terminal.last.complete,true);
  for(const field of ['seeds','profiles','cases','workers','elapsedMs']) assert.equal(terminal.last[field],summary[field]);
  assert.equal(Object.keys(summary.sourceHashes).length,23);
  assert.equal(Object.keys(summary.compiledHashes).length,21);
  assert.deepEqual(summary.sourceHashes,baseline.sourceHashes);
  assert.deepEqual(summary.compiledHashes,baseline.compiledHashes);
  assert.equal(summary.workers,baseline.workers);
  assert(Number.isFinite(summary.elapsedMs) && summary.elapsedMs > 0);
  await verifyHashes(summary.sourceHashes,'.');
  await verifyHashes(summary.compiledHashes,compiled);
  const inspected = inspectRows(summary,old);
  const sdkNames = (await readdir('dist')).filter(n=>n.endsWith('.js')).sort();
  assert.equal(sdkNames.length,5);
  const sdkHashes = {};
  for (const name of sdkNames) {
    const bytes = await readFile(join('dist',name));
    assert.equal(hash(bytes),hash(await readFile(join(preview,name))), `Preview SDK differs: ${name}`);
    sdkHashes[`dist/${name}`] = hash(bytes);
  }
  const sdk = await import(pathToFileURL(resolve(sdkPath)).href);
  const witnesses = {}, witnessBytes = {};
  for (const phase of ['victory','defeat']) {
    const bytes = await readFile(join(input,`${phase}.json`)), state = JSON.parse(bytes);
    const checked = sdk.validateRun(state); assert(checked.ok, checked.detail);
    assert.equal(state.phase,phase);
    const first = summary.rows.find(row=>row.phase===phase); assert(first);
    assert.equal(state.journal[0]?.techniqueId,first.starter);
    assert.equal(state.seed,first.seed);
    assert.equal(hash(JSON.stringify(state)),first.stateSha256);
    const pieces = sdk.getCollection(checked.state);
    const actual = {phase:state.phase,rounds:state.round,met:state.history.filter(h=>h.met).length,
      strikes:pieces.reduce((n,p)=>n+p.strikes,0),broken:pieces.filter(p=>p.status==='broken').length,
      orders:state.returns.length,coins:state.coins,scrap:state.scrap,
      patterns:pieces.reduce((n,p)=>n+p.patterns.length,0),actions:state.journal.length};
    for (const [field,value] of Object.entries(actual)) assert.equal(value,first[field], `${phase}/${field}`);
    const oldWitness = await readFile(join(resolve(oldPath,'..'),`${phase}.json`));
    assert.equal(hash(bytes),hash(oldWitness), 'Earliest witness changed from old32');
    witnessBytes[phase] = bytes;
    witnesses[phase] = {...actual,seed:state.seed,profile:[first.policy,first.starter,first.accuracy],
      stateSha256:first.stateSha256,fileSha256:hash(bytes),bytes:bytes.length,replay:'current production SDK validateRun passed'};
  }
  await verifyHashes(summary.sourceHashes,'.');
  await verifyHashes(summary.compiledHashes,compiled);
  const compressed = gzipSync(raw,{level:9});
  assert.equal(hash(gunzipSync(compressed)),hash(raw));
  const report = {scope:'forge-v2 only; model/coverage audit is not human playability or forge-v3 acceptance',
    ...inspected, witnesses, elapsedMs:summary.elapsedMs,
    replayEvidence:'All29000 producer states passed formal validateRun in the frozen policy; this audit independently replays the two archived full witnesses, not all29000 again.',
    sourceFiles:23,compiledFiles:21,sourceHashes:summary.sourceHashes,compiledHashes:summary.compiledHashes,sdkHashes,
    inputs:{summary:{path:join(input,'summary.json'),sha256:hash(raw),bytes:raw.length},
      oldSummary:{path:oldPath,sha256:hash(oldRaw)},baseline:{path:baselinePath,sha256:hash(baselineRaw)},
      terminal:{path:terminalPath,sha256:hash(terminalRaw),session:terminal.session,exitCode:terminal.exitCode}},
    archive:{summaryGzipSha256:hash(compressed),bytes:compressed.length,exactDecodedSha256:hash(raw)},
    auditorSha256:hash(await readFile(new URL(import.meta.url)))};
  await mkdir(out,{recursive:false});
  await writeFile(join(out,'summary.json.gz'),compressed,{flag:'wx'});
  for (const phase of ['victory','defeat']) await writeFile(join(out,`${phase}.json`),witnessBytes[phase],{flag:'wx'});
  await writeFile(join(out,'audit.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2);
  assert(args.length===2 && args[0]==='--out' && args[1], 'Usage: node scripts/audit-v2-model.mjs --out <new directory>');
  const report=await auditModel({input:'tmp/T12-v2-1000',oldPath:'docs/evidence/T11-2/simulation/summary.json',
    baselinePath:'docs/evidence/T12/run.json',compiled:'tmp/simulation',sdkPath:'dist/sword-led-v2.js',
    preview:'tmp/previews/T11-4-2',out:args[1]});
  console.log(JSON.stringify({cases:report.uniqueCases,profiles:report.profiles.length,overlap:report.overlapRows,
    maxActions:report.maxActions,maxStrikes:report.maxStrikes,witnesses:report.witnesses,out:relative('.',args[1])}));
}
