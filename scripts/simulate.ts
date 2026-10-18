import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { Worker } from 'node:worker_threads';
import { validateRun } from '../src/core/index.js';
import { RULES_VERSION } from '../src/core/rules.js';
import type { RunResult, Scenario } from './simulation/model.js';
import { PROFILES, scenarios, SIMULATION_VERSION } from './simulation/model.js';
import { simulate } from './simulation/runner.js';
import { aggregate } from './simulation/report.js';
import { batch } from './simulation/worker.js';
import type { BatchInput } from './simulation/worker.js';

const digest = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
async function sourceHashes() {
  const names = ['package-lock.json'];
  for (const dir of ['src/core', 'scripts', 'scripts/simulation']) {
    for (const name of (await readdir(dir)).filter(name => name.endsWith('.ts')).sort()) names.push(`${dir}/${name}`);
  }
  return Object.fromEntries(await Promise.all(names.map(async path => [path, digest(await readFile(path))])));
}
function argumentsFrom(argv: readonly string[]): { replay: string } | { count: number; prefix: string; suite: 'full' | 'base' | 'abuse'; out: string; workers: number } {
  const options = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index]; const value = argv[index + 1];
    if (!flag || !['--seeds', '--prefix', '--suite', '--out', '--replay', '--workers'].includes(flag) || !value || options.has(flag)) throw new Error('Unknown, duplicate, or missing argument');
    options.set(flag, value);
  }
  if (options.has('--replay')) {
    if (options.size !== 1) throw new Error('--replay cannot be combined with simulation options');
    return { replay: options.get('--replay')! };
  }
  const count = Number(options.get('--seeds') ?? '1000');
  const prefix = options.get('--prefix') ?? 'verify-v1';
  const suite = options.get('--suite') ?? 'full';
  const workers = Number(options.get('--workers') ?? '4');
  if (!Number.isSafeInteger(count) || count < 1 || count > 10000 || !/^[a-zA-Z0-9_-]{1,40}$/.test(prefix)
    || !Number.isInteger(workers) || workers < 1 || workers > 8
    || (suite !== 'full' && suite !== 'base' && suite !== 'abuse')) throw new Error('Invalid seeds, prefix, suite, or workers');
  return { count, prefix, suite, workers, out: options.get('--out') ?? 'tmp/simulation-report' };
}

async function parallelBatches(inputs: readonly BatchInput[], count: number) {
  const results: ReturnType<typeof batch>[] = [];
  const active = new Set<Worker>();
  let next = 0;
  try {
    await Promise.all(Array.from({ length: Math.min(count, inputs.length) }, async () => {
      for (let index = next++; index < inputs.length; index = next++) {
        const input = inputs[index]; if (!input) throw new Error('Missing batch');
        const result = count === 1 ? batch(input) : await new Promise<ReturnType<typeof batch>>((resolveBatch, reject) => {
          const worker = new Worker(new URL('./simulation/worker.js', import.meta.url), { workerData: input });
          active.add(worker);
          let received = false;
          worker.once('message', (message: ReturnType<typeof batch>) => { received = true; resolveBatch(message); });
          worker.once('error', reject);
          worker.once('exit', code => { active.delete(worker); if (!received || code !== 0) reject(new Error(`Simulation worker exited ${code}`)); });
        });
        results[index] = result;
        console.log(`${input.scenario.id}: ${result.report.victories}/${input.count} wins; rounds ${result.report.meanRounds.toFixed(2)}; strikes ${result.report.meanStrikes.toFixed(1)}`);
      }
    }));
    return results;
  } finally { await Promise.all([...active].map(worker => worker.terminate())); }
}

async function main() {
  const args = argumentsFrom(process.argv.slice(2));
  if ('replay' in args) {
    const witness: unknown = JSON.parse(await readFile(args.replay, 'utf8'));
    if (!witness || typeof witness !== 'object' || !('state' in witness) || !('scenario' in witness) || !('metrics' in witness)) throw new Error('Witness structure missing');
    const checked = validateRun(witness.state);
    if (!checked.ok) throw new Error(checked.detail);
    const scenario = scenarios('full').find(candidate => JSON.stringify(candidate) === JSON.stringify(witness.scenario));
    if (!scenario) throw new Error('Unknown witness scenario');
    const rerun = simulate(scenario, checked.state.seed);
    if (JSON.stringify(rerun.state) !== JSON.stringify(checked.state) || JSON.stringify(rerun.metrics) !== JSON.stringify(witness.metrics)) throw new Error('Witness policy/input replay differs');
    console.log(JSON.stringify({ replayValid: true, outcome: checked.state.phase, seed: checked.state.seed, revision: checked.state.revision, sha256: digest(JSON.stringify(checked.state)) }));
    return;
  }
  const started = Date.now();
  const out = resolve(args.out);
  for (const suffix of ['json', 'csv.gz', 'medium-victory.json', 'raw-defeat.json']) {
    try { await lstat(`${out}.${suffix}`); throw new Error(`Evidence already exists: ${out}.${suffix}`); }
    catch (error) { if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) throw error; }
  }
  const hashes = await sourceHashes();
  const reports: ReturnType<typeof aggregate>[] = [];
  const csv = ['scenario,seed,outcome,rounds,seals,coins,earned,spent,scrap,broken,strikes,heats,accepted,rejected,inputSeconds,stateBytes,stateSha256'];
  const baselineDigests = new Map<string, string>();
  const witnesses = new Map<string, { scenario: Scenario } & RunResult>();
  const batches = await parallelBatches(scenarios(args.suite).map(scenario => ({ scenario, count: args.count, prefix: args.prefix })), args.workers);
  for (const result of batches) {
    const { scenario } = result.report;
    reports.push(result.report); csv.push(...result.rows);
    if (scenario.id === 'balanced-adaptive-medium-heat-normal-clean') result.digests.forEach((sha, index) => baselineDigests.set(String(index), sha));
    if (scenario.duplicateSpam && baselineDigests.size && result.digests.some((sha, index) => baselineDigests.get(String(index)) !== sha)) throw new Error('Spam changed the clean run');
    if (result.witness) witnesses.set(scenario.strategy === 'raw' ? 'raw-defeat' : 'medium-victory', result.witness);
  }
  if (JSON.stringify(hashes) !== JSON.stringify(await sourceHashes())) throw new Error('Simulation source changed while running');
  await mkdir(dirname(out), { recursive: true });
  const rows = gzipSync(`${csv.join('\n')}\n`, { level: 9 });
  const witnessFiles: string[] = [];
  for (const [key, witness] of witnesses) {
    const path = `${out}.${key}.json`;
    await writeFile(path, `${JSON.stringify(witness, null, 2)}\n`, { flag: 'wx' }); witnessFiles.push(path);
  }
  await writeFile(`${out}.csv.gz`, rows, { flag: 'wx' });
  await writeFile(`${out}.json`, `${JSON.stringify({ simulationVersion: SIMULATION_VERSION, rulesVersion: RULES_VERSION,
    recordedAt: new Date().toISOString(), node: process.version, platform: `${process.platform}/${process.arch}`,
    seedPrefix: args.prefix, seedsPerScenario: args.count, suite: args.suite, workers: args.workers, profiles: PROFILES,
    elapsedSeconds: (Date.now() - started) / 1000, sourceHashes: hashes,
    rows: { file: `${args.out}.csv.gz`, count: csv.length - 1, sha256: digest(rows) },
    witnesses: witnessFiles.map(path => path.slice(out.length + 1)), reports,
  }, null, 2)}\n`, { flag: 'wx' });
  console.log(`Evidence: ${args.out}.json (${csv.length - 1} runs, every final state replayed)`);
}

await main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
