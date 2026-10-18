import { applyCommand, createRun, getRunView, validateRun } from '../../src/core/index.js';
import type { Action, HammerMode, RunState, RunView } from '../../src/core/index.js';
import { createInputModel } from './input.js';
import { createPolicy } from './policy.js';
import type { RunResult, Scenario } from './model.js';

export function assertInvariants(state: RunState, before?: RunState): void {
  const nonnegative = [state.coins, state.scrap, state.coal, state.seals, ...Object.values(state.stats)];
  if (nonnegative.some(value => !Number.isSafeInteger(value) || value < 0)
    || state.coins !== state.stats.coinsEarned - state.stats.coinsSpent
    || state.scrap !== state.stats.scrapEarned - state.stats.scrapSpent
    || state.seals > 3 || state.pieces.length !== 3 || state.round < 1 || state.round > 12
    || Object.values(state.upgrades).some(level => level < 0 || level > 2)
    || state.rng.strike.draws !== state.stats.strikes || state.rng.stock.draws !== state.round - 1
    || state.journal.length !== state.revision || state.revision > 2048) throw new Error('Run invariant failed');
  for (const piece of state.pieces) {
    if (piece.progress < 0 || piece.progress > 35 || piece.heat < 0 || piece.heat > 100
      || piece.stress < 0 || piece.stress > 100 || piece.integrity < 0 || piece.integrity > 4
      || (piece.integrity === 0) !== (piece.status === 'broken')) throw new Error('Piece invariant failed');
    const previous = before?.pieces.find(candidate => candidate.id === piece.id);
    if (previous && previous.status !== 'active' && JSON.stringify(piece) !== JSON.stringify(previous)) {
      throw new Error('A finalized piece changed');
    }
  }
}

export function simulate(scenario: Scenario, seed: string): RunResult {
  const created = createRun({ runId: 'simulation', seed });
  if (!created.ok) throw new Error(created.error);
  let state = created.state;
  const input = createInputModel(seed, scenario.skill, scenario.slow);
  const policy = createPolicy(scenario);
  const modes = { light: 0, standard: 0, heavy: 0 };
  const grades = { precise: 0, ordinary: 0, mishit: 0 };
  let activeUnits = 0; let rejected = 0;
  assertInvariants(state);
  if (scenario.strategy === 'idle') {
    for (let index = 0; index < 10; index++) {
      getRunView(state);
      const result = applyCommand(state, { runId: state.runId, expectedRevision: 0,
        action: { type: 'heat', pieceId: state.pieces[0].id } });
      if (result.ok || result.state !== state || result.events.length) throw new Error('Idle probe changed state');
      rejected++;
    }
  } else {
    while (state.phase !== 'victory' && state.phase !== 'defeat') {
      if (state.revision >= 2048) throw new Error(`Policy did not terminate: ${scenario.id}/${seed}`);
      const first = getRunView(state, { mode: 'light' });
      const pieceId = policy.select(first);
      const view = first.selected?.id === pieceId || pieceId === null ? first : getRunView(state, { pieceId, mode: 'light' });
      const quotes = new Map<HammerMode, RunView>([['light', view]]);
      const decision = policy.decide(view, mode => {
        let cached = quotes.get(mode);
        if (!cached) { cached = getRunView(state, { pieceId, mode }); quotes.set(mode, cached); }
        return cached;
      });
      let action: Action = decision.action;
      if (action.type === 'strike') {
        if (decision.periodMs === undefined) throw new Error('Strike period missing');
        const sample = input.sample(decision.periodMs);
        activeUnits += sample.activeUnits;
        action = { ...action, timingMark: sample.mark };
      }
      const command = { runId: state.runId, expectedRevision: state.revision, action };
      const result = applyCommand(state, command);
      if (!result.ok) throw new Error(`Invalid policy command ${scenario.id}/${seed}: ${result.error}`);
      const previous = state; state = result.state;
      assertInvariants(state, previous);
      for (const event of result.events) if (event.type === 'StrikeResolved') { modes[event.mode]++; grades[event.timing]++; }
      if (scenario.duplicateSpam) for (let index = 0; index < 5; index++) {
        const repeated = applyCommand(state, command);
        if (repeated.ok || repeated.state !== state || repeated.events.length) throw new Error('Duplicate command changed state');
        rejected++;
      }
    }
  }
  const validated = validateRun(state);
  if (!validated.ok) throw new Error(`Replay failed ${scenario.id}/${seed}: ${validated.detail}`);
  if (input.draws() !== state.stats.strikes * 14) throw new Error('Input stream consumed outside strikes');
  return { state, metrics: {
    outcome: state.phase === 'victory' ? 'victory' : state.phase === 'defeat' ? 'defeat' : 'idle',
    rounds: state.history.length, seals: state.seals, coins: state.coins, goldEarned: state.stats.coinsEarned,
    goldSpent: state.stats.coinsSpent, scrap: state.scrap, broken: state.stats.brokenPieces,
    strikes: state.stats.strikes, heats: state.stats.heats, accepted: state.revision, rejected,
    activeInputSeconds: activeUnits / 65536 / 1000, modeStrikes: modes, gradeStrikes: grades,
    replayValid: true, stateBytes: Buffer.byteLength(JSON.stringify(state)),
  } };
}
