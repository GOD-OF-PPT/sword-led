import { createHash } from 'node:crypto';
import { parentPort, workerData } from 'node:worker_threads';
import type { RunResult, Scenario } from './model.js';
import { aggregate } from './report.js';
import { simulate } from './runner.js';

export interface BatchInput { readonly scenario: Scenario; readonly count: number; readonly prefix: string }
export function batch({ scenario, count, prefix }: BatchInput) {
  const results: RunResult[] = [];
  const rows: string[] = [];
  const digests: string[] = [];
  let witness: ({ scenario: Scenario } & RunResult) | null = null;
  for (let index = 0; index < count; index++) {
    const seed = `${prefix}-${String(index).padStart(4, '0')}`;
    const result = simulate(scenario, seed);
    const { state, metrics: m } = result;
    const sha = createHash('sha256').update(JSON.stringify(state)).digest('hex');
    digests.push(sha);
    if ((scenario.strategy === 'raw' || scenario.strategy === 'recycle') && (m.outcome !== 'defeat' || m.rounds !== 3)) throw new Error('Unforged resource loop survived');
    rows.push([scenario.id, seed, m.outcome, m.rounds, m.seals, m.coins, m.goldEarned, m.goldSpent, m.scrap, m.broken, m.strikes, m.heats, m.accepted, m.rejected, m.activeInputSeconds, m.stateBytes, sha].join(','));
    if (!witness && ((scenario.id === 'balanced-adaptive-medium-heat-normal-clean' && m.outcome === 'victory')
      || (scenario.strategy === 'raw' && m.outcome === 'defeat'))) witness = { scenario, ...result };
    results.push(result);
  }
  return { report: aggregate(scenario, results), rows, digests, witness };
}

if (parentPort) {
  // Only trusted task configuration from the local CLI enters this worker.
  const input: BatchInput = workerData;
  parentPort.postMessage(batch(input));
}
